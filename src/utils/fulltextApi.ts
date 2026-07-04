// Client-side helper to fetch full-text articles via the proxy API

import { Article, FullTextResult } from '../types'

export async function fetchFullText(article: Article): Promise<FullTextResult> {
  try {
    const params = new URLSearchParams()

    if (article.pmcid) {
      params.append('pmcid', article.pmcid)
    }
    if (article.pmid) {
      params.append('pmid', article.pmid)
    }
    if (article.doi) {
      params.append('doi', article.doi)
    }
    if (article.arxivId) {
      params.append('arxivId', article.arxivId)
    }

    // If we have none of these, return unavailable
    if (!article.pmcid && !article.pmid && !article.doi && !article.arxivId) {
      return { available: false }
    }

    const response = await fetch(`/api/fulltext?${params}`)
    if (!response.ok) {
      return { available: false }
    }

    const result: FullTextResult = await response.json()
    return result
  } catch {
    return { available: false }
  }
}
