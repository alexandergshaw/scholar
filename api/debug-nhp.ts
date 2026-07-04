// TEMPORARY diagnostic: report how node-html-parser loads in the Vercel runtime.
export default async function handler(_req: any, res: any) {
  const out: any = { node: process.version }

  // 1) dynamic import
  try {
    const m: any = await import('node-html-parser')
    out.dynamic = {
      keys: Object.keys(m).slice(0, 10),
      parseType: typeof m.parse,
      hasDefault: !!m.default,
      defaultType: typeof m.default,
      defaultParseType: typeof m.default?.parse,
      defaultHTMLElementType: typeof m.default?.HTMLElement
    }
  } catch (e: any) {
    out.dynamicError = String(e?.message || e)
  }

  // 2) createRequire
  try {
    const { createRequire } = await import('module')
    const req = createRequire(import.meta.url)
    const r: any = req('node-html-parser')
    out.createRequire = { parseType: typeof r.parse, htmlElementType: typeof r.HTMLElement }
  } catch (e: any) {
    out.createRequireError = String(e?.message || e)
  }

  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(out)
}
