// Server-side core for fetching and parsing full-text articles from PMC
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

export interface FullTextSection {
  heading: string | null
  paragraphs: string[]
}

export type FullTextResult =
  | { available: true; source: string; sections: FullTextSection[] }
  | { available: false }

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

// Main export: fetch full-text article from PMC
export async function getFullText(params: {
  pmcid?: string
  pmid?: string
  doi?: string
}): Promise<FullTextResult> {
  try {
    // Resolve PMCID
    const pmcid = await resolvePmcId(params)
    if (!pmcid) {
      return { available: false }
    }

    // Fetch BioC JSON
    const biocData = await fetchBioCJson(pmcid)
    if (!biocData?.documents?.[0]?.passages) {
      return { available: false }
    }

    // Parse passages into sections
    const sections = parseBioCPassages(biocData.documents[0].passages)
    if (sections.length === 0) {
      return { available: false }
    }

    return {
      available: true,
      source: 'PMC (Open Access)',
      sections
    }
  } catch {
    // Wrap any unexpected errors; never throw
    return { available: false }
  }
}
