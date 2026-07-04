// Vercel/serverless handler for primary sources API
// Runs only in production; not used during dev

import { searchPrimarySources } from '../server/primarySources.js'

export default async function handler(req: any, res: any) {
  try {
    const { q = '', page = 1, sources = '' } = req.query
    const pageNum = Number(page) || 1

    // Parse sources param (comma-separated)
    let sourceList: string[] | undefined
    if (sources && typeof sources === 'string') {
      sourceList = sources
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      if (sourceList.length === 0) sourceList = undefined
    } else if (Array.isArray(sources)) {
      sourceList = sources.filter(s => typeof s === 'string' && s.length > 0)
      if (sourceList.length === 0) sourceList = undefined
    }

    const result = await searchPrimarySources(q, pageNum, sourceList)

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ results: [] })
  }
}
