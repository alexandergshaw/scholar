// Vercel/serverless handler for OA text extraction API
// Runs only in production; not used during dev

import { extractOaFullText } from '../server/oaExtractCore.js'

export default async function handler(req: any, res: any) {
  try {
    const { url } = req.query

    if (!url) {
      res.setHeader('Content-Type', 'application/json')
      res.status(200).json({ available: false })
      return
    }

    const result = await extractOaFullText(url)

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ available: false })
  }
}
