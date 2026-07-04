// Server-side same-origin proxy for open-access URLs.
// Returns raw bytes so a PDF/HTML can be embedded in an iframe from our own origin.
// This file is imported by both the Vite dev middleware and serverless functions.
// Keep it free of React/Vite imports so it can run on Node.js only.

import { isSafePublicUrl } from './oaExtractCore'

export type ProxyResult =
  | { ok: true; contentType: string; body: Uint8Array }
  | { ok: false }

const MAX_BYTES = 15 * 1024 * 1024 // 15MB

export async function fetchProxied(rawUrl: string): Promise<ProxyResult> {
  try {
    // Reuse the exact same SSRF guard as the extractor
    if (!isSafePublicUrl(rawUrl)) {
      return { ok: false }
    }

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

    if (!response.ok) {
      return { ok: false }
    }

    // Enforce size cap via content-length header if present
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const bytes = parseInt(contentLength, 10)
      if (!Number.isNaN(bytes) && bytes > MAX_BYTES) {
        return { ok: false }
      }
    }

    const buf = new Uint8Array(await response.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false }
    }

    // Determine content type from upstream header
    let contentType = response.headers.get('content-type') || ''
    if (!contentType || contentType === 'application/octet-stream') {
      // If URL path ends in .pdf and no useful type, assume PDF
      if (rawUrl.toLowerCase().split('?')[0].endsWith('.pdf')) {
        contentType = 'application/pdf'
      } else if (!contentType) {
        contentType = 'application/octet-stream'
      }
    }

    return { ok: true, contentType, body: buf }
  } catch {
    return { ok: false }
  }
}
