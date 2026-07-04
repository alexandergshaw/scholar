// Vercel/serverless handler for ask API
// Runs only in production; not used during dev

import { askGemini } from '../server/askCore.js'

export default async function handler(req: any, res: any) {
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      res.status(405).end('Method not allowed')
      return
    }

    // Vercel may pre-parse JSON, handle both cases
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}')
    const { question, context } = body

    // Call askGemini
    const result = await askGemini(question, context)

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ configured: true, error: 'Ask request failed.' })
  }
}
