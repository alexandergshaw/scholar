// Client-side helper to fetch primary & historical sources via the proxy API

import { PrimarySourcesResponse } from '../types'

export async function searchPrimary(
  query: string,
  page = 1
): Promise<PrimarySourcesResponse> {
  try {
    const params = new URLSearchParams()
    params.append('q', query)
    params.append('page', String(page))

    const response = await fetch(`/api/primary?${params}`)
    if (!response.ok) {
      return { results: [] }
    }

    const result: PrimarySourcesResponse = await response.json()
    return result
  } catch {
    return { results: [] }
  }
}
