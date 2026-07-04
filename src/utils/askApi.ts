// Client-side helper to ask questions about documents via the Gemini proxy API

import { AskResult } from '../types'

export async function askAboutText(question: string, context: string): Promise<AskResult> {
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question, context })
    })

    if (!response.ok) {
      return {
        configured: true,
        error: 'Network error.'
      }
    }

    const result: AskResult = await response.json()
    return result
  } catch {
    return {
      configured: true,
      error: 'Network error.'
    }
  }
}
