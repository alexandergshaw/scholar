// Vercel/serverless handler for primary text API
// Runs only in production; not used during dev

import { getPrimaryText } from '../server/primaryText.js'

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query

    const result = await getPrimaryText(id || '')

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ available: false })
  }
}
