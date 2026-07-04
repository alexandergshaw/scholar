// Vercel/serverless handler for full-text API
// Runs only in production; not used during dev

import { getFullText } from '../server/fulltextCore'

export default async function handler(req: any, res: any) {
  try {
    const { pmcid, pmid, doi } = req.query

    const result = await getFullText({
      pmcid: pmcid || undefined,
      pmid: pmid || undefined,
      doi: doi || undefined
    })

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(result)
  } catch {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ available: false })
  }
}
