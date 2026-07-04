// Vercel/serverless handler for TTS API
// Runs only in production; not used during dev

import { synthesize } from '../server/ttsCore.js'

export default async function handler(req: any, res: any) {
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      res.status(405).end('Method not allowed')
      return
    }

    // Vercel may pre-parse JSON, handle both cases
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}')
    const { text, voice, languageCode, rate, pitch } = body

    // Call synthesize
    const result = await synthesize({ text, voice, languageCode, rate, pitch })

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch (e) {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ configured: true, error: 'TTS handler error: ' + (e instanceof Error ? e.message : String(e)) })
  }
}
