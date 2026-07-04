import { OpenAlexWork, OpenAlexSearchResponse, Article, AutocompleteResult, OpenAlexAutocompleteResponse } from '../types'

const BASE_URL = 'https://api.openalex.org'
const MAILTO = 'scholar-app@example.com'

export interface SearchParams {
  query?: string
  author?: string
  authorId?: string
  topic?: string
  yearFrom?: number
  yearTo?: number
  openAccessOnly?: boolean
  fullTextOnly?: boolean
  page?: number
  perPage?: number
}

function buildAbstractFromInvertedIndex(invertedIndex?: Record<string, number[]>): string | undefined {
  if (!invertedIndex) return undefined

  const wordPositions: Array<[string, number]> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push([word, pos])
    }
  }

  wordPositions.sort((a, b) => a[1] - b[1])
  return wordPositions.map(([word]) => word).join(' ')
}

// OpenAlex ids are full URLs (e.g. "https://openalex.org/W123"). The trailing
// "W123" segment is the URL-safe key we use for routing and lookups.
export function shortIdOf(id: string): string {
  return id.split('/').pop() || id
}

export async function getWorkById(shortId: string): Promise<Article> {
  const url = `${BASE_URL}/works/${encodeURIComponent(shortId)}?mailto=${MAILTO}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status}`)
  }
  const work: OpenAlexWork = await response.json()
  return mapOpenAlexWorkToArticle(work)
}

export function mapOpenAlexWorkToArticle(work: OpenAlexWork): Article {
  return {
    id: work.id,
    title: work.display_name,
    authors: work.authorships.map(a => a.author.display_name),
    year: work.publication_year,
    journal: work.primary_location?.source?.display_name || 'Unknown Journal',
    doi: work.doi,
    isOA: work.open_access?.is_oa || false,
    oaUrl: work.open_access?.oa_url || work.best_oa_location?.pdf_url || work.best_oa_location?.landing_page_url,
    citedBy: work.cited_by_count || 0,
    abstract: buildAbstractFromInvertedIndex(work.abstract_inverted_index)
  }
}

export async function searchWorks(params: SearchParams): Promise<{ articles: Article[]; total: number }> {
  const filters: string[] = []

  if (params.openAccessOnly) {
    filters.push('is_oa:true')
  }

  if (params.fullTextOnly) {
    filters.push('has_fulltext:true')
  }

  if (params.yearFrom !== undefined || params.yearTo !== undefined) {
    const from = params.yearFrom || 1900
    const to = params.yearTo || new Date().getFullYear()
    filters.push(`publication_year:${from}-${to}`)
  }

  if (params.authorId) {
    filters.push(`authorships.author.id:${params.authorId}`)
  }

  let url = `${BASE_URL}/works?mailto=${MAILTO}`

  // OpenAlex accepts a single `search` param. Combine the provided fields into
  // one full-text query so that query + author + topic AND together instead of
  // silently overwriting each other. If authorId is set, ignore free-text author.
  const searchTerms = [params.query, params.authorId ? undefined : params.author, params.topic]
    .filter(Boolean)
    .join(' ')
  if (searchTerms) {
    url += `&search=${encodeURIComponent(searchTerms)}`
  }

  if (filters.length > 0) {
    url += `&filter=${encodeURIComponent(filters.join(','))}`
  }

  const page = params.page || 1
  const perPage = params.perPage || 25
  url += `&page=${page}&per_page=${perPage}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status}`)
  }

  const data: OpenAlexSearchResponse = await response.json()
  const articles = data.results.map(mapOpenAlexWorkToArticle)

  return {
    articles,
    total: data.meta.count
  }
}

export async function searchByTopic(topic: string, page: number = 1): Promise<{ articles: Article[]; total: number }> {
  return searchWorks({ topic, page, perPage: 25 })
}

export async function searchByAuthor(author: string, page: number = 1): Promise<{ articles: Article[]; total: number }> {
  return searchWorks({ author, page, perPage: 25 })
}

export async function autocomplete(mode: 'topics' | 'articles' | 'authors', q: string): Promise<AutocompleteResult[]> {
  const endpoints: Record<string, string> = {
    topics: 'concepts',
    articles: 'works',
    authors: 'authors'
  }

  const endpoint = endpoints[mode]
  const url = `${BASE_URL}/autocomplete/${endpoint}?q=${encodeURIComponent(q)}&mailto=${MAILTO}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return []
    }
    const data: OpenAlexAutocompleteResponse = await response.json()
    return data.results
  } catch (err) {
    return []
  }
}
