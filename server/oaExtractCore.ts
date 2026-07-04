// Server-side extraction of text from open-access PDFs and HTML pages
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

// Default-import the CJS module (see note in fulltextCore.ts): a named import of
// `HTMLElement` crashes Vercel's ESM serverless runtime. Type-only for the type.
// See note in fulltextCore.ts: node-html-parser (CJS) must be loaded via a lazy
// dynamic import, reading `parse` off `.default` for Vercel's ESM interop.
// See note in fulltextCore.ts: namespace-import node-html-parser (CJS) and read
// `parse` off `.default` for Vercel serverless interop.
import * as nodeHtmlParser from 'node-html-parser'
import type { HTMLElement } from 'node-html-parser'
const parse = (((nodeHtmlParser as any).default ?? nodeHtmlParser).parse) as typeof import('node-html-parser').parse
import { extractText, getDocumentProxy } from 'unpdf'

export interface FullTextSection {
  heading: string | null
  paragraphs: string[]
}

export type FullTextResult =
  | { available: true; source: string; sections: FullTextSection[] }
  | { available: false; freeUrl?: string }

// SSRF guard: reject unsafe URLs (loopback, private networks, etc.)
export function isSafePublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Only http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()

    // Reject localhost and *.localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false
    }

    // Reject IP addresses in loopback/private/link-local ranges
    // IPv4: 127.x.x.x, 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 169.254.x.x, 0.0.0.0
    // IPv6: ::1, fc00::/7 (fd00-fcff)
    if (
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.startsWith('169.254.') ||
      /^f[cd]/i.test(hostname.slice(0, 2)) // IPv6 private (fd/fc prefix)
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

// Extract text from PDF using unpdf
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
    // Use mergePages:false: it keeps the per-page newlines that paragraph
    // splitting relies on. mergePages:true joins everything with spaces and
    // strips all newlines, collapsing the whole document into one paragraph.
    // Join pages with a blank line so page boundaries become paragraph breaks.
    const { text } = await extractText(pdf, { mergePages: false })
    const pages = Array.isArray(text) ? text : [text]
    const joined = pages.join('\n\n')
    return joined || null
  } catch {
    return null
  }
}

// Extract text from HTML using node-html-parser
function extractTextFromHtml(html: string): FullTextResult {
  try {
    const root = parse(html)

    // Remove unwanted elements
    const toRemove = root.querySelectorAll(
      'script, style, nav, header, footer, aside, form, noscript'
    )
    for (const el of toRemove) {
      el.remove()
    }

    // Pick a root element: prefer <article>, then <main>, else <body>
    let contentRoot = root.querySelector('article')
    if (!contentRoot) contentRoot = root.querySelector('main')
    if (!contentRoot) contentRoot = root.querySelector('body')
    if (!contentRoot) contentRoot = root // fallback to entire document

    const sections: FullTextSection[] = []
    const seen = new Set<string>()
    let currentSection: FullTextSection | null = null

    // Walk through all children of contentRoot
    function walkNode(node: any) {
      if (typeof node === 'string') {
        // Text node
        const text = (node as string).trim()
        if (text && currentSection) {
          currentSection.paragraphs.push(text)
        }
        return
      }

      if (!node.tagName) return

      const tagLower = node.tagName.toLowerCase()

      // Process headings (h1-h3)
      if (['h1', 'h2', 'h3'].includes(tagLower)) {
        const heading = (node as HTMLElement).text.replace(/\s+/g, ' ').trim()
        if (heading) {
          currentSection = { heading, paragraphs: [] }
          sections.push(currentSection)
        }
        return
      }

      // Process paragraphs
      if (tagLower === 'p') {
        const text = (node as HTMLElement).text.replace(/\s+/g, ' ').trim()
        if (text && text.length > 0 && !seen.has(text)) {
          seen.add(text)
          if (!currentSection) {
            currentSection = { heading: null, paragraphs: [] }
            sections.push(currentSection)
          }
          currentSection.paragraphs.push(text)
        }
        return
      }

      // Recurse into children
      for (const child of (node as any).childNodes) {
        walkNode(child)
      }
    }

    walkNode(contentRoot)

    // Filter out empty sections and deduplicate paragraphs
    const filteredSections = sections
      .map(section => ({
        ...section,
        paragraphs: section.paragraphs.filter(
          (p, i, arr) => p.length > 0 && arr.indexOf(p) === i
        )
      }))
      .filter(section => section.paragraphs.length > 0)

    // Calculate total text length
    const totalLength = filteredSections.reduce(
      (sum, s) => sum + s.paragraphs.join(' ').length,
      0
    )

    if (totalLength < 500 || filteredSections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Open access (extracted)',
      sections: filteredSections
    }
  } catch {
    return { available: false }
  }
}

// Main export: extract full text from a free OA URL (PDF or HTML)
export async function extractOaFullText(rawUrl: string): Promise<FullTextResult> {
  try {
    // SSRF guard
    if (!isSafePublicUrl(rawUrl)) {
      return { available: false }
    }

    // Fetch with timeout and size limit
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const response = await fetch(rawUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (scholar-app)'
      },
      signal: controller.signal
    })

    clearTimeout(timeout)

    // Non-200 status
    if (!response.ok) {
      return { available: false }
    }

    // Check content-length header if available
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const bytes = parseInt(contentLength, 10)
      if (bytes > 15 * 1024 * 1024) {
        // > 15MB
        return { available: false }
      }
    }

    // Read as ArrayBuffer with size cap
    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > 15 * 1024 * 1024) {
      return { available: false }
    }

    // Determine type: PDF or HTML
    const contentType = response.headers.get('content-type') || ''
    const isPdf =
      contentType.includes('application/pdf') || rawUrl.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      // Extract from PDF
      const text = await extractTextFromPdf(arrayBuffer)
      if (!text) {
        return { available: false }
      }

      // Split into paragraphs on the RAW text BEFORE collapsing newlines.
      // Blank lines are hard paragraph breaks; otherwise flush at sentence
      // boundaries once a paragraph is a decent length.
      const lines = text.split(/\n/).map(l => l.trim())
      const rawParagraphs: string[] = []
      let buf = ''
      for (const line of lines) {
        if (line === '') {
          // blank line = hard paragraph break
          if (buf.trim()) rawParagraphs.push(buf.trim())
          buf = ''
          continue
        }
        buf = buf ? buf + ' ' + line : line
        // flush when we have a decent chunk that ends a sentence
        if (buf.length > 500 && /[.!?]["')\]]?$/.test(line)) {
          rawParagraphs.push(buf.trim())
          buf = ''
        }
      }
      if (buf.trim()) rawParagraphs.push(buf.trim())

      const paragraphs = rawParagraphs
        .map(p => p.replace(/\s+/g, ' ').trim()) // normalize spaces WITHIN a paragraph
        .filter(
          p =>
            p.length > 40 && // Drop very short fragments (page numbers, headers)
            !/^\d+\s*$/.test(p) && // Drop page numbers
            !/^Page\s*\d+/i.test(p) // Drop "Page N" headers
        )

      const totalLength = paragraphs.join(' ').length
      if (totalLength < 500) {
        return { available: false }
      }

      return {
        available: true,
        source: 'Open access (extracted PDF)',
        sections: [{ heading: null, paragraphs }]
      }
    } else {
      // Extract from HTML. The fetch body was already consumed by
      // response.arrayBuffer() above (a Response body can only be read once),
      // so decode the bytes we already have instead of reading again.
      const html = new TextDecoder('utf-8').decode(arrayBuffer)
      if (!html) {
        return { available: false }
      }

      return extractTextFromHtml(html)
    }
  } catch {
    // Never throw; always return unavailable
    return { available: false }
  }
}
