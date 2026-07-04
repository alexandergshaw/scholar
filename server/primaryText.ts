// Server-side core for fetching and parsing primary source text
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

import { parse, HTMLElement } from 'node-html-parser'
import type { FullTextSection, FullTextResult } from '../src/types'
// Lazy loaders: the PDF/OA extraction path pulls in a heavy pdf.js dependency
// (unpdf, via oaExtractCore). Import it dynamically only when an extraction-based
// source is actually read, so a load failure in the serverless runtime can never
// take down the whole primary-text function — Wikipedia, Standard Ebooks,
// Gutenberg, etc. need no extraction and must keep working regardless.
async function extractOaFullText(url: string): Promise<FullTextResult> {
  try {
    const m = await import('./oaExtractCore.js')
    return await m.extractOaFullText(url)
  } catch {
    return { available: false }
  }
}
async function getUnpaywallFreeUrl(doi?: string): Promise<string | null> {
  try {
    const m = await import('./fulltextCore.js')
    return await m.getUnpaywallFreeUrl(doi)
  } catch {
    return null
  }
}

// Helper: fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 12000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// Strip Project Gutenberg boilerplate
function stripGutenbergBoilerplate(text: string): string {
  // Remove everything before and including the START marker
  const startMatch = text.match(/\*\*\* START OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*/i)
  if (startMatch) {
    text = text.substring(startMatch.index! + startMatch[0].length)
  }

  // Remove everything from and including the END marker
  const endMatch = text.match(/\*\*\* END OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*/i)
  if (endMatch) {
    text = text.substring(0, endMatch.index)
  }

  return text.trim()
}

// Convert plain text to sections (split on blank lines)
function textToSections(text: string): FullTextSection[] {
  // Split on one or more blank lines
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0)

  // Cap at 2000 paragraphs to keep DOM sane
  const cappedParagraphs = paragraphs.slice(0, 2000)

  if (cappedParagraphs.length === 0) {
    return []
  }

  return [
    {
      heading: null,
      paragraphs: cappedParagraphs
    }
  ]
}

// Fetch from Project Gutenberg
async function getGutenbergText(id: string): Promise<FullTextResult> {
  try {
    const num = id.replace(/^gutenberg:/, '')
    const url = `https://www.gutenberg.org/ebooks/${num}.txt.utf-8`

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return { available: false }
    }

    let text = await response.text()
    text = stripGutenbergBoilerplate(text)

    const sections = textToSections(text)
    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Project Gutenberg',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from Internet Archive
async function getInternetArchiveText(id: string): Promise<FullTextResult> {
  try {
    const identifier = id.replace(/^ia:/, '')

    // First try the standard _djvu.txt
    let url = `https://archive.org/download/${identifier}/${identifier}_djvu.txt`
    let response = await fetchWithTimeout(url)

    if (!response.ok) {
      // Fallback: fetch metadata and find a txt file
      const metaUrl = `https://archive.org/metadata/${identifier}`
      const metaResponse = await fetchWithTimeout(metaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!metaResponse.ok) {
        return { available: false }
      }

      const metaData = await metaResponse.json() as {
        files?: Array<{ name: string; format?: string }>
      }

      // Find a txt file (prefer _djvu.txt, then any .txt, or DjVuTXT format)
      const files = metaData.files || []
      let txtFile = files.find(f => f.name.endsWith('_djvu.txt'))
      if (!txtFile) {
        txtFile = files.find(f => f.format === 'DjVuTXT')
      }
      if (!txtFile) {
        txtFile = files.find(f => f.name.endsWith('.txt'))
      }

      if (!txtFile) {
        return { available: false }
      }

      url = `https://archive.org/download/${identifier}/${txtFile.name}`
      response = await fetchWithTimeout(url)

      if (!response.ok) {
        return { available: false }
      }
    }

    let text = await response.text()
    const sections = textToSections(text)

    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Internet Archive',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from Chronicling America
async function getChroniclingAmericaText(id: string): Promise<FullTextResult> {
  try {
    const locUrl = id.replace(/^chronam:/, '')

    // Fetch the page JSON with fulltext_service URL
    const pageUrl = `${locUrl}&fo=json`
    const pageResponse = await fetchWithTimeout(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })

    if (!pageResponse.ok) {
      return { available: false }
    }

    const pageData = await pageResponse.json() as {
      fulltext_service?: string
    }

    if (!pageData.fulltext_service) {
      return { available: false }
    }

    // Fetch the fulltext service JSON
    const ftResponse = await fetchWithTimeout(pageData.fulltext_service, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })

    if (!ftResponse.ok) {
      return { available: false }
    }

    const ftData = await ftResponse.json() as Record<string, { full_text?: string }>

    // The fulltext service returns a single object with one key mapping to { full_text: string }
    const fullText = Object.values(ftData)[0]?.full_text

    if (!fullText) {
      return { available: false }
    }

    const sections = textToSections(fullText)

    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Chronicling America',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from Wikipedia
async function getWikipediaText(id: string): Promise<FullTextResult> {
  try {
    const title = id.replace(/^wikipedia:/, '')

    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.append('action', 'query')
    url.searchParams.append('prop', 'extracts')
    url.searchParams.append('explaintext', '1')
    url.searchParams.append('redirects', '1')
    url.searchParams.append('format', 'json')
    url.searchParams.append('titles', title)

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': 'scholar-app'
      }
    })

    if (!response.ok) {
      return { available: false }
    }

    const data = await response.json() as {
      query?: {
        pages?: Record<string, { extract?: string }>
      }
    }

    const pages = data.query?.pages
    if (!pages) {
      return { available: false }
    }

    const pageData = Object.values(pages)[0]
    if (!pageData?.extract) {
      return { available: false }
    }

    const sections = textToSections(pageData.extract)

    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Wikipedia',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from Wikisource
// The MediaWiki extracts API does not return transcluded body text for
// Wikisource works, so use action=parse and parse the rendered HTML instead.
async function getWikisourceText(id: string): Promise<FullTextResult> {
  try {
    const title = id.replace(/^wikisource:/, '')

    const url = `https://en.wikisource.org/w/api.php?action=parse&prop=text&redirects=1&format=json&page=${encodeURIComponent(title)}`

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'scholar-app'
      }
    })

    if (!response.ok) {
      return { available: false }
    }

    const data = await response.json() as {
      parse?: {
        text?: { '*'?: string }
      }
    }

    const html = data?.parse?.text?.['*']
    if (!html) {
      return { available: false }
    }

    const root = parse(html)

    // Remove cruft that would pollute the reading text
    root
      .querySelectorAll(
        'style, script, table, .mw-editsection, .reference, sup.reference, .mw-references-wrap, .references, .noprint, .toc, .navbox, .catlinks, .ws-noexport, .mw-headline-number, #headerContainer, .header, .headertemplate, .licenseContainer'
      )
      .forEach(el => el.remove())

    // Pick the content root
    const contentRoot = root.querySelector('.mw-parser-output') || root

    const sections: FullTextSection[] = []
    const seen = new Set<string>()
    let currentSection: FullTextSection | null = null

    function pushParagraph(text: string) {
      const clean = text.replace(/\s+/g, ' ').trim()
      if (!clean || seen.has(clean)) return
      seen.add(clean)
      if (!currentSection) {
        currentSection = { heading: null, paragraphs: [] }
        sections.push(currentSection)
      }
      currentSection.paragraphs.push(clean)
    }

    function walkNode(node: HTMLElement) {
      if (!node.tagName) {
        // Non-element node; nothing to do
        return
      }

      const tagLower = node.tagName.toLowerCase()

      // Headings start a new section
      if (['h2', 'h3', 'h4'].includes(tagLower)) {
        const heading = node.text.replace(/\s+/g, ' ').trim()
        if (heading) {
          currentSection = { heading, paragraphs: [] }
          sections.push(currentSection)
        }
        return
      }

      // Paragraphs
      if (tagLower === 'p') {
        pushParagraph(node.text)
        return
      }

      // Poem blocks (plays/poetry keep their lines in <div class="poem">)
      if (tagLower === 'div' && (node.getAttribute('class') || '').split(/\s+/).includes('poem')) {
        pushParagraph(node.text)
        return
      }

      // Recurse into children
      for (const child of node.childNodes) {
        if (child instanceof HTMLElement) {
          walkNode(child)
        }
      }
    }

    walkNode(contentRoot)

    // Drop sections with no paragraphs
    const filteredSections = sections.filter(s => s.paragraphs.length > 0)

    const totalLength = filteredSections.reduce(
      (sum, s) => sum + s.paragraphs.join(' ').length,
      0
    )

    if (totalLength < 200 || filteredSections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Wikisource',
      sections: filteredSections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from The Conversation
async function getTheConversationText(id: string): Promise<FullTextResult> {
  try {
    const slug = id.replace(/^conversation:/, '')
    const url = `https://theconversation.com/${slug}`

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (scholar-app)'
      }
    })

    if (!response.ok) {
      return { available: false }
    }

    const html = await response.text()
    const root = parse(html)

    // Find the article body
    const body = root.querySelector('[itemprop="articleBody"]') || root.querySelector('.content-body')
    if (!body) {
      return { available: false }
    }

    // Remove cruft
    body
      .querySelectorAll('figure, script, style, aside, .inline-promos, .ad, .newsletter')
      .forEach(el => el.remove())

    const sections: FullTextSection[] = []
    const seen = new Set<string>()
    let currentSection: FullTextSection | null = null

    function pushParagraph(text: string) {
      const clean = text.replace(/\s+/g, ' ').trim()
      if (!clean || seen.has(clean)) return
      seen.add(clean)
      if (!currentSection) {
        currentSection = { heading: null, paragraphs: [] }
        sections.push(currentSection)
      }
      currentSection.paragraphs.push(clean)
    }

    function walkNode(node: HTMLElement) {
      if (!node.tagName) {
        // Non-element node; nothing to do
        return
      }

      const tagLower = node.tagName.toLowerCase()

      // Headings start a new section
      if (['h2', 'h3'].includes(tagLower)) {
        const heading = node.text.replace(/\s+/g, ' ').trim()
        if (heading) {
          currentSection = { heading, paragraphs: [] }
          sections.push(currentSection)
        }
        return
      }

      // Paragraphs
      if (tagLower === 'p') {
        pushParagraph(node.text)
        return
      }

      // Recurse into children
      for (const child of node.childNodes) {
        if (child instanceof HTMLElement) {
          walkNode(child)
        }
      }
    }

    walkNode(body)

    // Drop sections with no paragraphs
    const filteredSections = sections.filter(s => s.paragraphs.length > 0)

    const totalLength = filteredSections.reduce(
      (sum, s) => sum + s.paragraphs.join(' ').length,
      0
    )

    if (totalLength < 200 || filteredSections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'The Conversation',
      sections: filteredSections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from DOAJ (using open-access extractor)
async function getDoajText(id: string): Promise<FullTextResult> {
  try {
    const url = id.replace(/^doaj:/, '')
    if (!url) return { available: false }
    return await extractOaFullText(url)
  } catch {
    return { available: false }
  }
}

// Fetch from OAPEN (using open-access extractor)
async function getOapenText(id: string): Promise<FullTextResult> {
  try {
    const url = id.replace(/^oapen:/, '')
    // Only attempt extraction on an actual bitstream URL; a handle-page id
    // means discovery-only (no downloadable PDF for inline reading).
    if (!url.includes('/rest/bitstreams/')) return { available: false }
    return await extractOaFullText(url)
  } catch {
    return { available: false }
  }
}

// Fetch from Standard Ebooks
async function getStandardEbooksText(id: string): Promise<FullTextResult> {
  try {
    const path = id.replace(/^standardebooks:/, '')
    const url = `https://standardebooks.org/ebooks/${path}/text/single-page`

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (scholar-app)'
      }
    })

    if (!response.ok) {
      return { available: false }
    }

    const html = await response.text()
    const root = parse(html)

    // Content root: body or root
    let contentRoot = root.querySelector('body') || root

    // Remove nav, .toc
    contentRoot
      .querySelectorAll('nav, .toc')
      .forEach(el => el.remove())

    const sections: FullTextSection[] = []
    const seen = new Set<string>()
    let currentSection: FullTextSection | null = null

    function pushParagraph(text: string) {
      const clean = text.replace(/\s+/g, ' ').trim()
      if (!clean || seen.has(clean)) return
      seen.add(clean)
      if (!currentSection) {
        currentSection = { heading: null, paragraphs: [] }
        sections.push(currentSection)
      }
      currentSection.paragraphs.push(clean)
    }

    function walkNode(node: HTMLElement) {
      if (!node.tagName) {
        return
      }

      const tagLower = node.tagName.toLowerCase()

      // Headings start a new section
      if (['h1', 'h2', 'h3'].includes(tagLower)) {
        const heading = node.text.replace(/\s+/g, ' ').trim()
        if (heading) {
          currentSection = { heading, paragraphs: [] }
          sections.push(currentSection)
        }
        return
      }

      // Paragraphs
      if (tagLower === 'p') {
        pushParagraph(node.text)
        return
      }

      // Recurse into children
      for (const child of node.childNodes) {
        if (child instanceof HTMLElement) {
          walkNode(child)
        }
      }
    }

    walkNode(contentRoot)

    // Drop sections with no paragraphs
    const filteredSections = sections.filter(s => s.paragraphs.length > 0)

    // Cap the total number of paragraphs at 3000
    let paragraphCount = 0
    const cappedSections: FullTextSection[] = []
    for (const section of filteredSections) {
      const remaining = 3000 - paragraphCount
      if (remaining <= 0) break
      if (section.paragraphs.length > remaining) {
        cappedSections.push({
          heading: section.heading,
          paragraphs: section.paragraphs.slice(0, remaining)
        })
        break
      }
      cappedSections.push(section)
      paragraphCount += section.paragraphs.length
    }

    const totalLength = cappedSections.reduce(
      (sum, s) => sum + s.paragraphs.join(' ').length,
      0
    )

    if (totalLength < 200 || cappedSections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Standard Ebooks',
      sections: cappedSections
    }
  } catch {
    return { available: false }
  }
}

// Fetch from Preprints (bioRxiv, medRxiv, etc. via Europe PMC)
async function getPreprintText(id: string): Promise<FullTextResult> {
  try {
    const doi = id.replace(/^preprint:/, '')
    if (!doi) return { available: false }

    // First try Unpaywall for a free PDF
    const freeUrl = await getUnpaywallFreeUrl(doi)
    if (freeUrl) {
      const r = await extractOaFullText(freeUrl)
      if (r.available) return r
    }

    // Fallback: try the DOI directly (strip any URL prefix)
    const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    return await extractOaFullText('https://doi.org/' + cleanDoi)
  } catch {
    return { available: false }
  }
}

// Fetch from Semantic Scholar (using open-access extractor for PDFs, discovery-only for S2 pages)
async function getSemanticScholarText(id: string): Promise<FullTextResult> {
  try {
    const url = id.replace(/^s2:/, '')
    if (!url) return { available: false }
    // Only attempt extraction on actual PDF URLs; S2 web pages are discovery-only
    if (url.includes('semanticscholar.org')) return { available: false }
    return await extractOaFullText(url)
  } catch {
    return { available: false }
  }
}

// Fetch from CORE (core.ac.uk)
async function getCoreText(id: string): Promise<FullTextResult> {
  const key = process.env.CORE_API_KEY
  if (!key) return { available: false }

  try {
    const coreId = id.replace(/^core:/, '')
    if (!coreId) return { available: false }

    const response = await fetchWithTimeout(
      `https://api.core.ac.uk/v3/works/${coreId}`,
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'User-Agent': 'scholar-app'
        }
      }
    )

    if (!response.ok) {
      return { available: false }
    }

    const data = await response.json() as {
      fullText?: string
      downloadUrl?: string
    }

    // First try the stored full text
    if (data.fullText && typeof data.fullText === 'string' && data.fullText.trim().length > 0) {
      const sections = textToSections(data.fullText)
      if (sections.length > 0) {
        return {
          available: true,
          source: 'CORE',
          sections
        }
      }
    }

    // Fallback to extracting from downloadUrl
    if (data.downloadUrl) {
      const r = await extractOaFullText(data.downloadUrl)
      if (r.available) return r
    }

    return { available: false }
  } catch {
    return { available: false }
  }
}

// Main export: fetch primary source text
export async function getPrimaryText(id: string): Promise<FullTextResult> {
  try {
    if (id.startsWith('gutenberg:')) {
      return await getGutenbergText(id)
    } else if (id.startsWith('ia:')) {
      return await getInternetArchiveText(id)
    } else if (id.startsWith('chronam:')) {
      return await getChroniclingAmericaText(id)
    } else if (id.startsWith('wikipedia:')) {
      return await getWikipediaText(id)
    } else if (id.startsWith('wikisource:')) {
      return await getWikisourceText(id)
    } else if (id.startsWith('conversation:')) {
      return await getTheConversationText(id)
    } else if (id.startsWith('doaj:')) {
      return await getDoajText(id)
    } else if (id.startsWith('oapen:')) {
      return await getOapenText(id)
    } else if (id.startsWith('standardebooks:')) {
      return await getStandardEbooksText(id)
    } else if (id.startsWith('preprint:')) {
      return await getPreprintText(id)
    } else if (id.startsWith('s2:')) {
      return await getSemanticScholarText(id)
    } else if (id.startsWith('core:')) {
      return await getCoreText(id)
    } else {
      return { available: false }
    }
  } catch {
    return { available: false }
  }
}
