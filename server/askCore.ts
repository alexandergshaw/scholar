// Server-side core for answering questions about documents using Gemini API
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

export interface AskResult {
  answer?: string
  error?: string
  configured: boolean
}

export async function askGemini(question: string, context: string): Promise<AskResult> {
  const key = process.env.GEMINI_API_KEY

  // Check if API key is configured
  if (!key || key.trim() === '') {
    return {
      configured: false,
      error: 'Gemini API key not configured. Set GEMINI_API_KEY to enable answers.'
    }
  }

  // Check if question is empty
  if (!question?.trim()) {
    return {
      configured: true,
      error: 'Please enter a question.'
    }
  }

  // Cap context to 100000 characters
  const ctx = (context || '').slice(0, 100000)

  // Build the prompt
  const prompt = `You are a helpful research assistant. Answer the user's question using ONLY the document context below. If the answer isn't in the context, say so briefly.

--- DOCUMENT CONTEXT ---
${ctx}

--- QUESTION ---
${question}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        }),
        signal: AbortSignal.timeout(30000)
      }
    )

    if (!response.ok) {
      let errorMessage = `Gemini request failed (${response.status})`
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = `Gemini request failed: ${errorData.error.message}`
        }
      } catch {
        // Continue with status-only message
      }
      return {
        configured: true,
        error: errorMessage
      }
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (text) {
      return {
        configured: true,
        answer: text
      }
    }

    return {
      configured: true,
      error: 'No answer returned.'
    }
  } catch {
    return {
      configured: true,
      error: 'Ask request failed.'
    }
  }
}
