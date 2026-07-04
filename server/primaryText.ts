// Server-side core for fetching and parsing primary source text
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

import type { FullTextSection, FullTextResult } from '../src/types'

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

// Main export: fetch primary source text
export async function getPrimaryText(id: string): Promise<FullTextResult> {
  try {
    if (id.startsWith('gutenberg:')) {
      return await getGutenbergText(id)
    } else if (id.startsWith('ia:')) {
      return await getInternetArchiveText(id)
    } else if (id.startsWith('chronam:')) {
      return await getChroniclingAmericaText(id)
    } else {
      return { available: false }
    }
  } catch {
    return { available: false }
  }
}
