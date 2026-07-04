/* OpenAlex API types */
export interface OpenAlexAuthor {
  id: string
  display_name: string
}

export interface OpenAlexAuthorship {
  author: OpenAlexAuthor
}

export interface OpenAlexSource {
  display_name: string
}

export interface OpenAlexLocation {
  source: OpenAlexSource
}

export interface OpenAlexOpenAccess {
  is_oa: boolean
  oa_url?: string
}

export interface OpenAlexBestOALocation {
  pdf_url?: string
  landing_page_url?: string
}

export interface OpenAlexWork {
  id: string
  display_name: string
  publication_year: number
  authorships: OpenAlexAuthorship[]
  primary_location: OpenAlexLocation
  open_access: OpenAlexOpenAccess
  best_oa_location: OpenAlexBestOALocation
  doi?: string
  cited_by_count: number
  abstract_inverted_index?: Record<string, number[]>
  ids?: { openalex?: string; doi?: string; mag?: string; pmid?: string; pmcid?: string }
}

export interface OpenAlexSearchResponse {
  results: OpenAlexWork[]
  meta: {
    count: number
    page: number
    per_page: number
  }
}

/* Full-text types */
export interface FullTextSection {
  heading: string | null
  paragraphs: string[]
}

export type FullTextResult =
  | { available: true; source: string; sections: FullTextSection[] }
  | { available: false }

/* App domain types */
export interface Article {
  id: string
  title: string
  authors: string[]
  year: number
  journal: string
  doi?: string
  isOA: boolean
  oaUrl?: string
  citedBy: number
  abstract?: string
  pmcid?: string
  pmid?: string
}

/* OpenAlex Autocomplete types */
export interface AutocompleteResult {
  id: string
  display_name: string
  hint: string | null
  cited_by_count: number
  entity_type: string
  works_count: number
}

export interface OpenAlexAutocompleteResponse {
  results: AutocompleteResult[]
}

export type Theme = 'light' | 'sepia' | 'dark'
export type FontFamily = 'serif' | 'sans'

export interface ReaderSettings {
  fontSize: number // 1-5
  fontFamily: FontFamily
  lineSpacing: number // 1, 1.5, 2
  theme: Theme
}
