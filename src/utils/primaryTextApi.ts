// Client-side helper to fetch primary source text via the proxy API

import { FullTextResult } from '../types'

export async function fetchPrimaryText(id: string): Promise<FullTextResult> {
  try {
    const response = await fetch(`/api/primary-text?id=${encodeURIComponent(id)}`)
    if (!response.ok) {
      return { available: false }
    }

    const result: FullTextResult = await response.json()
    return result
  } catch {
    return { available: false }
  }
}
