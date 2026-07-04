// Server-side core for fetching and parsing full-text articles from PMC and arXiv
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

import { parse, HTMLElement } from 'node-html-parser'

export interface FullTextSection {
  heading: string | null
  paragraphs: string[]
}

export type FullTextResult =
  | { available: true; source: string; sections: FullTextSection[] }
  | { available: false; freeUrl?: string }

interface BioCPassage {
  offset: number
  text: string
  infons?: {
    section_type?: string
    type?: string
  }
}

interface BioCDocument {
  passages?: BioCPassage[]
}

interface BioCResponse {
  documents?: BioCDocument[]
}

// Sections to skip (front-matter title, references, figures, tables, boilerplate).
// TITLE is skipped because the article title is already rendered as the page h1.
const SKIP_SECTION_TYPES = new Set([
  'TITLE',
  'REF',
  'FIG',
  'TABLE',
  'ACK_FUND',
  'SUPPL',
  'COMP_INT',
  'AUTH_CONT'
])

// Normalize DOI by stripping common URL prefixes
function normalizeDoi(doi: string): string {
  if (!doi) return doi
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
}

// Extract PMC ID from a URL-like string (e.g., "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12345/" -> "PMC12345")
function extractPmcId(pmcid: string): string {
  if (!pmcid) return pmcid
  const match = pmcid.match(/PMC\d+/)
  return match ? match[0] : pmcid
}

// Resolve PMCID from various identifiers using NCBI ID Converter
async function resolvePmcId(params: {
  pmcid?: string
  pmid?: string
  doi?: string
}): Promise<string | null> {
  // If we already have a PMCID, use it (after extraction)
  if (params.pmcid) {
    const extracted = extractPmcId(params.pmcid)
    return extracted && extracted.startsWith('PMC') ? extracted : null
  }

  // Try to resolve via NCBI ID Converter
  const id = params.pmid || params.doi
  if (!id) return null

  try {
    const normalized = params.doi ? normalizeDoi(params.doi) : params.pmid
    const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=scholar&email=scholar-app@example.com&ids=${encodeURIComponent(normalized)}&format=json`

    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json() as { records?: Array<{ pmcid?: string }> }
    const pmcid = data.records?.[0]?.pmcid
    return pmcid || null
  } catch {
    return null
  }
}

// Resolve PMCID via Europe PMC search API as a fallback
async function resolvePmcIdViaEuropePmc(params: {
  doi?: string
  pmid?: string
}): Promise<string | null> {
  if (!params.doi && !params.pmid) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

    let query: string
    if (params.doi) {
      const normalizedDoi = normalizeDoi(params.doi)
      query = encodeURIComponent(`DOI:"${normalizedDoi}"`)
    } else {
      query = encodeURIComponent(`EXT_ID:${params.pmid} AND SRC:MED`)
    }

    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}&format=json&resultType=core`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'scholar-app' },
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json() as {
      resultList?: {
        result?: Array<{
          pmcid?: string
          inEPMC?: string
        }>
      }
    }

    const result = data.resultList?.result?.[0]
    if (result && result.pmcid && result.inEPMC === 'Y') {
      return result.pmcid
    }

    return null
  } catch {
    return null
  }
}

// Fetch and parse BioC JSON from NCBI
async function fetchBioCJson(pmcid: string): Promise<BioCResponse | null> {
  try {
    const url = `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/${encodeURIComponent(pmcid)}/unicode`
    const response = await fetch(url)
    if (!response.ok) return null

    // NCBI returns an array of collections; extract the first one
    const data = await response.json() as BioCResponse[] | BioCResponse
    const collection = Array.isArray(data) ? data[0] : data
    return collection
  } catch {
    return null
  }
}

// Parse BioC passages into FullTextSection array
function parseBioCPassages(passages: BioCPassage[]): FullTextSection[] {
  const sections: FullTextSection[] = []
  let currentSection: FullTextSection | null = null

  for (const passage of passages) {
    const sectionType = passage.infons?.section_type
    const passageType = passage.infons?.type

    // Skip boilerplate sections
    if (sectionType && SKIP_SECTION_TYPES.has(sectionType)) {
      continue
    }

    const text = passage.text.trim()
    if (!text) continue

    // A passage is a heading iff its BioC type contains "title" (case-insensitive).
    // This matches title_1, title_2, abstract_title_1, etc., while treating
    // "front"/"abstract"/"paragraph" passages as body text.
    const isHeading = /title/i.test(passageType || '')

    if (isHeading) {
      // Start a new section using this passage's text as the heading
      currentSection = { heading: text, paragraphs: [] }
      sections.push(currentSection)
    } else {
      // Body text: if no section started yet, open one with a null heading
      if (!currentSection) {
        currentSection = { heading: null, paragraphs: [] }
        sections.push(currentSection)
      }
      currentSection.paragraphs.push(text)
    }
  }

  // Clean up: drop empty paragraphs and sections with no content
  return sections
    .map(section => ({
      ...section,
      paragraphs: section.paragraphs.filter(p => p.length > 0)
    }))
    .filter(section => section.paragraphs.length > 0)
}

// Fetch and parse Europe PMC JATS XML
async function getEuropePmcFullText(pmcid: string): Promise<FullTextResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(pmcid)}/fullTextXML`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'scholar-app' },
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return { available: false }
    }

    const xml = await response.text()
    if (!xml) {
      return { available: false }
    }

    const root = parse(xml)
    const sections: FullTextSection[] = []
    const seen = new Set<string>()

    // Extract abstract
    const abstractEl = root.querySelector('abstract')
    if (abstractEl) {
      const abstractParagraphs: string[] = []
      const abstractPs = abstractEl.querySelectorAll('p')
      for (const p of abstractPs) {
        const text = (p as HTMLElement).text.replace(/\s+/g, ' ').trim()
        if (text.length > 0 && !seen.has(text)) {
          seen.add(text)
          abstractParagraphs.push(text)
        }
      }

      if (abstractParagraphs.length > 0) {
        sections.push({
          heading: 'Abstract',
          paragraphs: abstractParagraphs
        })
      }
    }

    // Extract body sections
    // Strategy: iterate through direct children of <body> and collect <sec> elements
    const bodyEl = root.querySelector('body')
    if (bodyEl) {
      const bodySections = bodyEl.querySelectorAll('sec')
      for (const sec of bodySections) {
        // Skip reference lists and other unwanted sections
        const secType = (sec as HTMLElement).getAttribute('sec-type')
        if (secType && ['references', 'ref-list'].includes(secType.toLowerCase())) {
          continue
        }

        // Get the heading from the first direct-child <title>
        let heading: string | null = null
        let titleEl: HTMLElement | null = null
        for (const child of sec.childNodes) {
          if (typeof child === 'string') continue
          const childEl = child as HTMLElement
          if (childEl.tagName && childEl.tagName.toLowerCase() === 'title') {
            titleEl = childEl
            break
          }
        }
        if (titleEl) {
          heading = titleEl.text.trim()
        }

        // Collect paragraphs from direct <p> children only (avoid nested <sec> content)
        const paragraphs: string[] = []
        for (const child of sec.childNodes) {
          if (typeof child === 'string') continue
          const childEl = child as HTMLElement
          if (!childEl.tagName) continue

          const tagLower = childEl.tagName.toLowerCase()

          // Skip nested <sec>, <fig>, <table-wrap>, <ref-list>
          if (['sec', 'fig', 'figure', 'table-wrap', 'table', 'ref-list'].includes(tagLower)) {
            continue
          }

          // Collect direct <p> elements
          if (tagLower === 'p') {
            const text = childEl.text.replace(/\s+/g, ' ').trim()
            if (text.length > 0 && !seen.has(text)) {
              seen.add(text)
              paragraphs.push(text)
            }
          }
        }

        // Only add section if it has paragraphs and non-empty heading
        if (paragraphs.length > 0 && heading) {
          sections.push({
            heading,
            paragraphs
          })
        }
      }
    }

    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'Europe PMC',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch and parse arXiv HTML using node-html-parser
async function getArxivFullText(arxivId: string): Promise<FullTextResult> {
  try {
    let html: string | null = null

    // Try arxiv.org first
    let response = await fetch(`https://arxiv.org/html/${arxivId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (!response.ok) {
      // Fallback to ar5iv
      response = await fetch(`https://ar5iv.labs.arxiv.org/html/${arxivId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
    }

    if (!response.ok) {
      return { available: false }
    }

    html = await response.text()
    if (!html) {
      return { available: false }
    }

    const root = parse(html)

    // Pre-clean: replace math elements with their alttext
    const mathElements = root.querySelectorAll('math')
    for (const mathEl of mathElements) {
      const alttext = (mathEl as HTMLElement).getAttribute('alttext')
      if (alttext) {
        // Replace the math element with a text node
        const parent = mathEl.parentNode
        if (parent) {
          const textNode = alttext
          mathEl.replaceWith(textNode)
        }
      }
    }

    // Remove unwanted elements: references, figures, tables, footnotes, etc.
    const toRemove = root.querySelectorAll(
      '.ltx_bibliography, .ltx_figure, figure, .ltx_table, table, .ltx_ERROR, .ltx_flex_figure, [class*="ltx_role_footnote"]'
    )
    for (const el of toRemove) {
      el.remove()
    }

    const sections: FullTextSection[] = []

    // Track cleaned paragraph strings across the whole article. LaTeXML sometimes
    // nests a .ltx_p inside another .ltx_p (framed/quoted blocks), so a naive
    // querySelectorAll('.ltx_p') returns both the outer and inner element with
    // identical text. A real paper never repeats a full paragraph verbatim, so
    // global exact-string dedup safely removes these parser artifacts.
    const seen = new Set<string>()

    // Extract abstract if present
    const abstractEl = root.querySelector('.ltx_abstract')
    if (abstractEl) {
      const abstractParagraphs: string[] = []
      for (const p of abstractEl.querySelectorAll('.ltx_p')) {
        const text = (p as HTMLElement).text.replace(/\s+/g, ' ').trim()
        if (text.length > 0 && !seen.has(text)) {
          seen.add(text)
          abstractParagraphs.push(text)
        }
      }

      if (abstractParagraphs.length > 0) {
        sections.push({
          heading: 'Abstract',
          paragraphs: abstractParagraphs
        })
      }
    }

    // Build sections from ltx_section and ltx_subsection
    // Strategy: iterate through all sections and subsections in document order.
    // Paragraphs can be in ltx_para divs or directly as ltx_p elements.
    // To avoid duplicates from nested subsections, we collect paragraphs that belong
    // to this section but not to any nested subsection.

    const allSectionHeadings = root.querySelectorAll('.ltx_section, .ltx_subsection')

    for (const sectionEl of allSectionHeadings) {
      const titleEl = sectionEl.querySelector('.ltx_title_section, .ltx_title_subsection')
      const heading = titleEl ? titleEl.text.trim() : null

      if (!heading) {
        continue
      }

      // Collect paragraphs that are direct children (not in nested subsections)
      const paragraphs: string[] = []
      const isSection = sectionEl.classList.contains('ltx_section')

      for (const child of sectionEl.childNodes) {
        if (typeof child === 'string') continue

        const childEl = child as HTMLElement
        if (!childEl.classList) continue

        // Skip the title element
        if (childEl.classList.contains('ltx_title_section') || childEl.classList.contains('ltx_title_subsection')) {
          continue
        }

        // If this is a section and we encounter a subsection, skip its contents
        if (isSection && childEl.classList.contains('ltx_subsection')) {
          continue
        }

        // Collect paragraphs from ltx_para divs
        if (childEl.classList.contains('ltx_para')) {
          const ps = childEl.querySelectorAll('.ltx_p')
          for (const p of ps) {
            const text = (p as HTMLElement).text.replace(/\s+/g, ' ').trim()
            if (text.length > 0 && !seen.has(text)) {
              seen.add(text)
              paragraphs.push(text)
            }
          }
        }

        // Also collect direct ltx_p elements
        if (childEl.classList.contains('ltx_p')) {
          const text = childEl.text.replace(/\s+/g, ' ').trim()
          if (text.length > 0 && !seen.has(text)) {
            seen.add(text)
            paragraphs.push(text)
          }
        }
      }

      if (paragraphs.length > 0) {
        sections.push({ heading, paragraphs })
      }
    }

    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'arXiv',
      sections
    }
  } catch {
    return { available: false }
  }
}

// Fetch a free-to-read link from Unpaywall
async function getUnpaywallFreeUrl(doi?: string): Promise<string | null> {
  if (!doi) return null

  const email = process.env.UNPAYWALL_EMAIL
  if (!email) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

    const normalizedDoi = normalizeDoi(doi)
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(normalizedDoi)}?email=${encodeURIComponent(email)}`
    const response = await fetch(url, { signal: controller.signal })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json() as {
      is_oa?: boolean
      best_oa_location?: {
        url_for_pdf?: string
        url?: string
      }
    }

    if (data.is_oa && data.best_oa_location) {
      return data.best_oa_location.url_for_pdf || data.best_oa_location.url || null
    }

    return null
  } catch {
    return null
  }
}

// Main export: fetch full-text article from PMC, Europe PMC, then arXiv
export async function getFullText(params: {
  pmcid?: string
  pmid?: string
  doi?: string
  arxivId?: string
}): Promise<FullTextResult> {
  try {
    // Try PMC first
    let pmcid = await resolvePmcId(params)

    // Fallback to Europe PMC resolution if NCBI didn't find it
    if (!pmcid) {
      pmcid = await resolvePmcIdViaEuropePmc(params)
    }

    if (pmcid) {
      // Fetch BioC JSON
      const biocData = await fetchBioCJson(pmcid)
      if (biocData?.documents?.[0]?.passages) {
        // Parse passages into sections
        const sections = parseBioCPassages(biocData.documents[0].passages)
        if (sections.length > 0) {
          return {
            available: true,
            source: 'PMC (Open Access)',
            sections
          }
        }
      }

      // Fallback to Europe PMC if BioC produced no sections
      const europePmcResult = await getEuropePmcFullText(pmcid)
      if (europePmcResult.available) {
        return europePmcResult
      }
    }

    // Fallback to arXiv if PMC not available
    if (params.arxivId) {
      const arxivResult = await getArxivFullText(params.arxivId)
      if (arxivResult.available) {
        return arxivResult
      }
    }

    // All in-app attempts failed; try Unpaywall for a free link
    const freeUrl = await getUnpaywallFreeUrl(params.doi)
    return { available: false, ...(freeUrl ? { freeUrl } : {}) }
  } catch {
    // Wrap any unexpected errors; never throw
    const freeUrl = await getUnpaywallFreeUrl(params.doi)
    return { available: false, ...(freeUrl ? { freeUrl } : {}) }
  }
}
