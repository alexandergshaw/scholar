import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
