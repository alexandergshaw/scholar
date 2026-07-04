// Server-side aggregator for primary & historical sources
// Queries three free corpora: Project Gutenberg, Internet Archive, Chronicling America
// Keep this file free of React/Vite imports so it can run on Node.js only

export interface PrimarySource {
  id: string
  title: string
  creator?: string
  date?: string
  sourceName: 'Project Gutenberg' | 'Internet Archive' | 'Chronicling America' | 'Wikipedia' | 'Wikisource' | 'The Conversation' | 'DOAJ' | 'OAPEN' | 'Standard Ebooks' | 'Preprints' | 'Semantic Scholar'
  snippet?: string
  readUrl: string
}

// Helper to coerce a value to a single string (join arrays)
function str(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    return v.join('; ')
  }
  return v ? String(v) : undefined
}

// Helper to format author lifespan
function lifeSpan(a: { birth_year?: number; death_year?: number } | undefined): string | undefined {
  if (!a) return undefined
  if (a.birth_year || a.death_year) {
    return `${a.birth_year ?? ''}–${a.death_year ?? ''}`
  }
  return undefined
}

// Gutenberg API: fetch from Gutendex
async function fetchGutenberg(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://gutendex.com/books/')
    url.searchParams.append('search', query)
    url.searchParams.append('page', String(page))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      count?: number
      results?: Array<{
        id: number
        title: string
        authors?: Array<{ name: string; birth_year?: number; death_year?: number }>
        subjects?: string[]
        formats?: Record<string, string>
      }>
    }

    if (!data.results) return []

    return data.results
      .map(b => ({
        id: `gutenberg:${b.id}`,
        title: b.title,
        creator: b.authors?.[0]?.name,
        date: lifeSpan(b.authors?.[0]),
        sourceName: 'Project Gutenberg' as const,
        snippet: (b.subjects || []).slice(0, 3).join('; ') || undefined,
        readUrl: `https://www.gutenberg.org/ebooks/${b.id}`
      }))
  } catch {
    return []
  }
}

// Internet Archive API
async function fetchInternetArchive(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://archive.org/advancedsearch.php')
    url.searchParams.append('q', `${query} AND mediatype:texts`)
    url.searchParams.append('fl[]', 'identifier')
    url.searchParams.append('fl[]', 'title')
    url.searchParams.append('fl[]', 'creator')
    url.searchParams.append('fl[]', 'year')
    url.searchParams.append('fl[]', 'description')
    url.searchParams.append('sort[]', 'downloads desc')
    url.searchParams.append('rows', '10')
    url.searchParams.append('page', String(page))
    url.searchParams.append('output', 'json')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      response?: {
        numFound?: number
        docs?: Array<{
          identifier: string
          title?: string | string[]
          creator?: string | string[]
          year?: number
          description?: string | string[]
        }>
      }
    }

    if (!data.response?.docs) return []

    return data.response.docs
      .filter(d => d.identifier)
      .map(d => ({
        id: `ia:${d.identifier}`,
        title: str(d.title) || 'Untitled',
        creator: str(d.creator),
        date: d.year ? String(d.year) : undefined,
        sourceName: 'Internet Archive' as const,
        snippet: str(d.description)?.slice(0, 240),
        readUrl: `https://archive.org/details/${d.identifier}`
      }))
  } catch {
    return []
  }
}

// Chronicling America API (loc.gov)
async function fetchChroniclingAmerica(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://www.loc.gov/collections/chronicling-america/')
    url.searchParams.append('q', query)
    url.searchParams.append('fo', 'json')
    url.searchParams.append('c', '10')
    url.searchParams.append('sp', String(page))
    url.searchParams.append('at', 'results')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      results?: Array<{
        id?: string
        title?: string
        date?: string
        url?: string
      }>
    }

    if (!data.results) return []

    return data.results
      .filter(it => it.url)
      .map(it => ({
        id: `chronam:${it.id || it.url}`,
        title: (it.title || '').replace(/^Image \d+ of /, '').trim(),
        creator: undefined,
        date: it.date,
        sourceName: 'Chronicling America' as const,
        snippet: undefined,
        readUrl: it.url!
      }))
      .filter(item => item.title)
  } catch {
    return []
  }
}

// Wikipedia API
async function fetchWikipedia(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.append('action', 'query')
    url.searchParams.append('list', 'search')
    url.searchParams.append('format', 'json')
    url.searchParams.append('srlimit', '10')
    url.searchParams.append('srsearch', query)
    url.searchParams.append('sroffset', String((page - 1) * 10))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'scholar-app'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      query?: {
        search?: Array<{
          title: string
          snippet: string
          pageid: number
        }>
      }
    }

    if (!data.query?.search) return []

    return data.query.search.map(item => {
      const snippet = item.snippet
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()

      return {
        id: `wikipedia:${item.title}`,
        title: item.title,
        creator: undefined,
        date: undefined,
        sourceName: 'Wikipedia' as const,
        snippet: snippet || undefined,
        readUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
      }
    })
  } catch {
    return []
  }
}

// Wikisource API
async function fetchWikisource(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://en.wikisource.org/w/api.php')
    url.searchParams.append('action', 'query')
    url.searchParams.append('list', 'search')
    url.searchParams.append('format', 'json')
    url.searchParams.append('srlimit', '10')
    url.searchParams.append('srsearch', query)
    url.searchParams.append('sroffset', String((page - 1) * 10))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'scholar-app'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      query?: {
        search?: Array<{
          title: string
          snippet: string
          pageid: number
        }>
      }
    }

    if (!data.query?.search) return []

    return data.query.search.map(item => {
      const snippet = item.snippet
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()

      return {
        id: `wikisource:${item.title}`,
        title: item.title,
        creator: undefined,
        date: undefined,
        sourceName: 'Wikisource' as const,
        snippet: snippet || undefined,
        readUrl: `https://en.wikisource.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
      }
    })
  } catch {
    return []
  }
}

// The Conversation API
async function fetchTheConversation(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://theconversation.com/us/search')
    url.searchParams.append('q', query)
    url.searchParams.append('page', String(page))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (scholar-app)'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const html = await response.text()
    const { parse } = await import('node-html-parser')
    const root = parse(html)

    // Find all anchors and filter by href pattern
    const anchors = root.querySelectorAll('a')
    const results: PrimarySource[] = []
    const seenHrefs = new Set<string>()

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href')
      if (!href || !href.match(/^\/[a-z0-9-]+-\d{4,7}$/)) continue
      if (seenHrefs.has(href)) continue

      const title = anchor.text.trim()
      if (title.length <= 10) continue

      seenHrefs.add(href)
      const slug = href.slice(1)

      results.push({
        id: `conversation:${slug}`,
        title,
        creator: undefined,
        date: undefined,
        sourceName: 'The Conversation' as const,
        snippet: undefined,
        readUrl: `https://theconversation.com${href}`
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// DOAJ API (Directory of Open Access Journals)
async function fetchDoaj(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL(`https://doaj.org/api/search/articles/${encodeURIComponent(query)}`)
    url.searchParams.append('pageSize', '10')
    url.searchParams.append('page', String(page))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'scholar-app'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      results?: Array<{
        bibjson?: {
          title?: string
          year?: string
          abstract?: string
          author?: Array<{ name?: string }>
          journal?: { title?: string }
          link?: Array<{ type?: string; url?: string }>
        }
      }>
    }

    if (!data.results) return []

    const results: PrimarySource[] = []

    for (const result of data.results) {
      const bib = result.bibjson
      if (!bib || !bib.title) continue

      // Find fulltext link
      const links = bib.link || []
      const fulltextLink = links.find(l => l.type === 'fulltext')
      if (!fulltextLink || !fulltextLink.url) continue

      const ftUrl = fulltextLink.url

      results.push({
        id: `doaj:${ftUrl}`,
        title: bib.title,
        creator: bib.author?.[0]?.name,
        date: bib.year,
        sourceName: 'DOAJ' as const,
        snippet: (bib.abstract || '').replace(/\s+/g, ' ').trim().slice(0, 240) || undefined,
        readUrl: ftUrl
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// OAPEN API (DSpace 6 REST)
async function fetchOapen(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://library.oapen.org/rest/search')
    url.searchParams.append('query', query)
    url.searchParams.append('expand', 'bitstreams,metadata')
    url.searchParams.append('limit', '10')
    url.searchParams.append('offset', String((page - 1) * 10))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'scholar-app'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as Array<{
      name?: string
      handle?: string
      metadata?: Array<{ key: string; value: string }>
      bitstreams?: Array<{ bundleName?: string; mimeType?: string; name?: string; sizeBytes?: number; retrieveLink?: string }>
    }>

    if (!Array.isArray(data)) return []

    const results: PrimarySource[] = []

    for (const item of data) {
      // Skip partial items (the API returns items with null/empty name)
      if (!item.name || !item.handle) continue

      const readUrl = `https://library.oapen.org/handle/${item.handle}`

      // The real book PDF is the ORIGINAL-bundle bitstream with a pdf mimeType.
      // Do NOT fall back to largest sizeBytes (that picks the cover image),
      // and do NOT match by filename.
      const pdf = (item.bitstreams || []).find(
        b => b.bundleName === 'ORIGINAL' && String(b.mimeType || '').toLowerCase().includes('pdf')
      )

      // Extract metadata
      const metadata = item.metadata || []
      const author = metadata.find(m => m.key === 'dc.contributor.author')?.value
      const dateRaw = metadata.find(m => m.key === 'dc.date.issued')?.value
      const date = dateRaw ? dateRaw.slice(0, 4) : undefined
      const abstract = metadata.find(m => m.key === 'dc.description.abstract')?.value

      // With a real PDF bitstream, inline extraction works; otherwise fall back
      // to the handle page (discovery-only, external Source link).
      const id = pdf && pdf.retrieveLink
        ? `oapen:https://library.oapen.org${pdf.retrieveLink}`
        : `oapen:${readUrl}`

      results.push({
        id,
        title: item.name,
        creator: author,
        date,
        sourceName: 'OAPEN' as const,
        snippet: (abstract || '').replace(/\s+/g, ' ').trim().slice(0, 240) || undefined,
        readUrl
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// Standard Ebooks API
async function fetchStandardEbooks(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://standardebooks.org/ebooks')
    url.searchParams.append('query', query)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (scholar-app)'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const html = await response.text()
    const { parse } = await import('node-html-parser')
    const root = parse(html)

    // Find all anchors and filter by href pattern
    const anchors = root.querySelectorAll('a')
    const results: PrimarySource[] = []
    const seenHrefs = new Set<string>()

    const titleCase = (s: string): string =>
      s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href')
      if (!href || !href.match(/^\/ebooks\/[a-z0-9-]+\/[a-z0-9-]+$/)) continue
      if (seenHrefs.has(href)) continue

      seenHrefs.add(href)

      // Extract author and book slugs from href like /ebooks/author-slug/book-slug
      const parts = href.slice(1).split('/') // Remove leading /
      if (parts.length !== 3 || parts[0] !== 'ebooks') continue

      const authorSlug = parts[1]
      const bookSlug = parts[2]

      const title = titleCase(bookSlug)
      const creator = titleCase(authorSlug)

      results.push({
        id: `standardebooks:${authorSlug}/${bookSlug}`,
        title,
        creator,
        date: undefined,
        sourceName: 'Standard Ebooks' as const,
        snippet: undefined,
        readUrl: `https://standardebooks.org${href}`
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// Europe PMC Preprints API (bioRxiv, medRxiv, other preprints)
async function fetchPreprints(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search')
    url.searchParams.append('query', query + ' AND SRC:PPR')
    url.searchParams.append('format', 'json')
    url.searchParams.append('resultType', 'core')
    url.searchParams.append('pageSize', '10')
    url.searchParams.append('page', String(page))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'scholar-app'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      resultList?: {
        result?: Array<{
          title?: string
          authorString?: string
          doi?: string
          pubYear?: string
          firstPublicationDate?: string
          abstractText?: string
        }>
      }
    }

    if (!data.resultList?.result) return []

    const results: PrimarySource[] = []

    for (const result of data.resultList.result) {
      // Only include results with a DOI
      if (!result.doi || !result.title) continue

      results.push({
        id: 'preprint:' + result.doi,
        title: result.title,
        creator: result.authorString,
        date: result.pubYear,
        sourceName: 'Preprints' as const,
        snippet: (result.abstractText || '').replace(/\s+/g, ' ').trim().slice(0, 240) || undefined,
        readUrl: 'https://doi.org/' + result.doi
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// Semantic Scholar API
async function fetchSemanticScholar(query: string, page: number): Promise<PrimarySource[]> {
  try {
    const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
    url.searchParams.append('query', query)
    url.searchParams.append('offset', String((page - 1) * 10))
    url.searchParams.append('limit', '10')
    url.searchParams.append('fields', 'title,year,authors,abstract,openAccessPdf,tldr')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const headers: Record<string, string> = { 'User-Agent': 'scholar-app' }
    const s2Key = process.env.SEMANTIC_SCHOLAR_API_KEY
    if (s2Key) headers['x-api-key'] = s2Key

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const data = await response.json() as {
      data?: Array<{
        paperId: string
        title?: string
        year?: number
        authors?: Array<{ name?: string }>
        abstract?: string
        openAccessPdf?: { url?: string } | null
        tldr?: { text?: string } | null
      }>
    }

    if (!data.data) return []

    const results: PrimarySource[] = []

    for (const result of data.data) {
      if (!result.title) continue

      const oaUrl = result.openAccessPdf?.url
      const readUrl = oaUrl || (`https://www.semanticscholar.org/paper/${result.paperId}`)

      results.push({
        id: `s2:${oaUrl || readUrl}`,
        title: result.title,
        creator: result.authors?.[0]?.name,
        date: result.year != null ? String(result.year) : undefined,
        sourceName: 'Semantic Scholar' as const,
        snippet: (result.tldr?.text || result.abstract || '').replace(/\s+/g, ' ').trim().slice(0, 240) || undefined,
        readUrl
      })

      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// Main aggregator: query all three sources in parallel, merge round-robin
export async function searchPrimarySources(
  query: string,
  page = 1
): Promise<{ results: PrimarySource[] }> {
  if (!query || !query.trim()) {
    return { results: [] }
  }

  const results = await Promise.allSettled([
    fetchGutenberg(query, page),
    fetchInternetArchive(query, page),
    fetchChroniclingAmerica(query, page),
    fetchWikipedia(query, page),
    fetchWikisource(query, page),
    fetchTheConversation(query, page),
    fetchDoaj(query, page),
    fetchOapen(query, page),
    fetchStandardEbooks(query, page),
    fetchPreprints(query, page),
    fetchSemanticScholar(query, page)
  ])

  const sources: PrimarySource[][] = []
  for (const result of results) {
    sources.push(result.status === 'fulfilled' ? result.value : [])
  }

  // Round-robin interleave
  const merged: PrimarySource[] = []
  const maxLen = Math.max(...sources.map(s => s.length))

  for (let i = 0; i < maxLen; i++) {
    for (const source of sources) {
      if (i < source.length) {
        merged.push(source[i])
      }
    }
  }

  // Filter out any item missing title or readUrl
  const filtered = merged.filter(item => item.title && item.readUrl)

  return { results: filtered }
}
