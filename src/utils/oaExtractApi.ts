// Client-side helper to extract full-text from open-access URLs

import { FullTextResult } from '../types'

export async function fetchOaExtract(url: string): Promise<FullTextResult> {
  try {
    const response = await fetch(`/api/oa-extract?${new URLSearchParams({ url })}`)
    if (!response.ok) {
      return { available: false }
    }

    const result: FullTextResult = await response.json()
    return result
  } catch {
    return { available: false }
  }
}
