// Vercel/serverless handler for the same-origin OA proxy.
// Returns RAW BYTES (not JSON) so a PDF/HTML renders inside an iframe.
// Runs only in production; not used during dev.

import { fetchProxied } from '../server/proxyCore.js'

export default async function handler(req: any, res: any) {
  try {
    const { url } = req.query

    if (!url) {
      res.status(400).end()
      return
    }

    const result = await fetchProxied(url)

    if (!result.ok) {
      res.status(502).end()
      return
    }

    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', 'inline') // so PDFs render, not download
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
    res.status(200).send(Buffer.from(result.body))
  } catch {
    res.status(502).end()
  }
}
