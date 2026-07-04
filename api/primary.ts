// Vercel/serverless handler for primary sources API
// Runs only in production; not used during dev

import { searchPrimarySources } from '../server/primarySources'

export default async function handler(req: any, res: any) {
  try {
    const { q = '', page = 1 } = req.query
    const pageNum = Number(page) || 1

    const result = await searchPrimarySources(q, pageNum)

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ results: [] })
  }
}
