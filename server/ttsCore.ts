// Server-side core for Google Cloud Text-to-Speech synthesis
// This file is imported by both the Vite dev middleware and serverless functions
// Keep it free of React/Vite imports so it can run on Node.js only

export interface TtsResult {
  audio?: string
  error?: string
  configured: boolean
}

export async function synthesize(params: {
  text: string
  voice: string
  languageCode: string
  rate?: number
  pitch?: number
}): Promise<TtsResult> {
  const key = process.env.GOOGLE_TTS_API_KEY

  // Check if API key is configured
  if (!key || key.trim() === '') {
    return {
      configured: false,
      error: 'Cloud voices not configured. Set GOOGLE_TTS_API_KEY to enable natural voices.'
    }
  }

  // Check if text is empty
  if (!params.text?.trim()) {
    return {
      configured: true,
      error: 'No text.'
    }
  }

  // Clamp text to 4900 characters
  const text = params.text.slice(0, 4900)

  // Clamp speaking rate to [0.25, 4.0]
  const speakingRate = Math.min(Math.max(params.rate ?? 1, 0.25), 4)

  // Clamp pitch to [-20, 20]
  const pitch = Math.min(Math.max(params.pitch ?? 0, -20), 20)

  // Studio voices don't support pitch parameter
  const isStudio = (params.voice || '').includes('Studio')
  const audioConfig: any = { audioEncoding: 'MP3', speakingRate }
  if (!isStudio) {
    audioConfig.pitch = pitch
  }

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: params.languageCode || 'en-US',
            name: params.voice
          },
          audioConfig
        }),
        signal: AbortSignal.timeout(30000)
      }
    )

    if (!response.ok) {
      let errorMessage = `Google TTS ${response.status}`
      try {
        const raw = await response.text()
        let gErr: any
        try {
          gErr = JSON.parse(raw)?.error
        } catch {
          // Not JSON, use raw text
        }
        if (gErr?.message) {
          errorMessage = `Google TTS ${response.status}${gErr.status ? ' ' + gErr.status : ''}: ${gErr.message}`
        } else if (raw) {
          errorMessage = `Google TTS ${response.status}: ${raw.slice(0, 300)}`
        }
      } catch {
        // Keep status-only message
      }
      return {
        configured: true,
        error: errorMessage
      }
    }

    const data = await response.json()
    const audioContent = data.audioContent

    if (audioContent) {
      return {
        configured: true,
        audio: audioContent
      }
    }

    return {
      configured: true,
      error: 'No audio returned.'
    }
  } catch (e) {
    return {
      configured: true,
      error: 'TTS proxy error: ' + (e instanceof Error ? e.message : String(e))
    }
  }
}
