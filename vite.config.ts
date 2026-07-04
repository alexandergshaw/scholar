import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { getFullText } from './server/fulltextCore'
import { searchPrimarySources } from './server/primarySources'
import { getPrimaryText } from './server/primaryText'
import { askGemini } from './server/askCore'
import { synthesize } from './server/ttsCore'

const fulltextPlugin = {
  name: 'fulltext-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/fulltext', async (req: any, res: any, next: any) => {
      try {
        const url = new URL(req.originalUrl, `http://${req.headers.host}`)
        const pmcid = url.searchParams.get('pmcid') || undefined
        const pmid = url.searchParams.get('pmid') || undefined
        const doi = url.searchParams.get('doi') || undefined
        const arxivId = url.searchParams.get('arxivId') || undefined

        const result = await getFullText({ pmcid, pmid, doi, arxivId })
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ available: false }))
      }
    })
  }
}

const primaryPlugin = {
  name: 'primary-sources-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/primary', async (req: any, res: any, next: any) => {
      try {
        const url = new URL(req.originalUrl, `http://${req.headers.host}`)
        const q = url.searchParams.get('q') || ''
        const page = Number(url.searchParams.get('page')) || 1

        const result = await searchPrimarySources(q, page)
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ results: [] }))
      }
    })
  }
}

const primaryTextPlugin = {
  name: 'primary-text-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/primary-text', async (req: any, res: any, next: any) => {
      try {
        const url = new URL(req.originalUrl, `http://${req.headers.host}`)
        const id = url.searchParams.get('id') || ''

        const result = await getPrimaryText(id)
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ available: false }))
      }
    })
  }
}

const askPlugin = {
  name: 'ask-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/ask', async (req: any, res: any, next: any) => {
      try {
        // Only handle POST requests
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        // Read body chunks
        let body = ''
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            resolve()
          })
          req.on('error', reject)
        })

        // Parse JSON
        let data
        try {
          data = JSON.parse(body || '{}')
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ configured: true, error: 'Bad request.' }))
          return
        }

        const { question, context } = data

        // Call askGemini
        const result = await askGemini(question, context)
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ configured: true, error: 'Ask request failed.' }))
      }
    })
  }
}

const ttsPlugin = {
  name: 'tts-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/tts', async (req: any, res: any, next: any) => {
      try {
        // Only handle POST requests
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        // Read body chunks
        let body = ''
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            resolve()
          })
          req.on('error', reject)
        })

        // Parse JSON
        let data
        try {
          data = JSON.parse(body || '{}')
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ configured: true, error: 'Bad request.' }))
          return
        }

        const { text, voice, languageCode, rate, pitch } = data

        // Call synthesize
        const result = await synthesize({ text, voice, languageCode, rate, pitch })
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ configured: true, error: 'TTS request failed.' }))
      }
    })
  }
}

export default defineConfig({
  plugins: [
    fulltextPlugin,
    primaryPlugin,
    primaryTextPlugin,
    askPlugin,
    ttsPlugin,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Scholar',
        short_name: 'Scholar',
        description: 'A mobile-first e-reader for open-access scholarly articles',
        theme_color: '#f5f1e8',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openalex\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openalex-api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 86400
              }
            }
          }
        ]
      }
    })
  ]
})
