import { useState, useEffect, useCallback, useRef } from 'react'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'

export interface CloudVoice {
  id: string
  label: string
  languageCode: string
}

export const CURATED_CLOUD_VOICES: CloudVoice[] = [
  { id: 'en-US-Neural2-F', label: 'Warm female (US)', languageCode: 'en-US' },
  { id: 'en-US-Neural2-C', label: 'Bright female (US)', languageCode: 'en-US' },
  { id: 'en-US-Neural2-D', label: 'Calm male (US)', languageCode: 'en-US' },
  { id: 'en-US-Neural2-A', label: 'Neutral male (US)', languageCode: 'en-US' },
  { id: 'en-GB-Neural2-A', label: 'British female', languageCode: 'en-GB' },
  { id: 'en-GB-Neural2-B', label: 'British male', languageCode: 'en-GB' },
  { id: 'en-US-Studio-O', label: 'Studio female (most natural)', languageCode: 'en-US' },
  { id: 'en-US-Studio-Q', label: 'Studio male (most natural)', languageCode: 'en-US' }
]

interface UseCloudTtsReturn {
  speaking: boolean
  paused: boolean
  loading: boolean
  error: string | null
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

export function useCloudTts(): UseCloudTtsReturn {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { cloudVoice, rate, pitch } = useTtsSettingsStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<string[]>([])
  const currentChunkIndexRef = useRef(0)

  // Helper to map pitch from 0-2 range to Google -20..20 range
  const mapPitch = (p: number): number => {
    return (p - 1) * 10
  }

  // Helper to split text into sentences
  const splitIntoSentences = (text: string): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
    return sentences.map((s) => s.trim()).filter((s) => s)
  }

  // Helper to chunk text into ~2000 char chunks on sentence boundaries
  const chunkText = (text: string): string[] => {
    const sentences = splitIntoSentences(text)
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length > 2000) {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = sentence
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
      }
    }

    if (currentChunk) chunks.push(currentChunk)
    return chunks
  }

  // Initialize audio element on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('ended', handleAudioEnded)
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded)
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const handleAudioEnded = useCallback(() => {
    currentChunkIndexRef.current += 1

    if (currentChunkIndexRef.current < chunksRef.current.length) {
      // Fetch and play next chunk
      fetchAndPlayChunk(currentChunkIndexRef.current)
    } else {
      // All chunks done
      setSpeaking(false)
      setPaused(false)
      chunksRef.current = []
      currentChunkIndexRef.current = 0
    }
  }, [])

  const fetchAndPlayChunk = useCallback(
    async (chunkIndex: number) => {
      if (chunkIndex >= chunksRef.current.length) return

      const chunk = chunksRef.current[chunkIndex]
      setLoading(true)

      try {
        const voiceInfo = CURATED_CLOUD_VOICES.find((v) => v.id === cloudVoice) || CURATED_CLOUD_VOICES[0]

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunk,
            voice: cloudVoice,
            languageCode: voiceInfo.languageCode,
            rate,
            pitch: mapPitch(pitch)
          })
        })

        if (!response.ok) {
          let bodyText = ''
          try {
            bodyText = await response.text()
          } catch {}
          setError(`Server error ${response.status}${bodyText ? ': ' + bodyText.slice(0, 300) : ''}`)
          setSpeaking(false)
          setPaused(false)
          setLoading(false)
          return
        }

        const result = await response.json()

        if (!result.configured) {
          setError(result.error || 'Cloud voices not configured.')
          setSpeaking(false)
          setPaused(false)
          setLoading(false)
          return
        }

        if (result.error) {
          setError(result.error)
          setSpeaking(false)
          setPaused(false)
          setLoading(false)
          return
        }

        if (result.audio && audioRef.current) {
          audioRef.current.src = 'data:audio/mp3;base64,' + result.audio
          audioRef.current.play()
          setLoading(false)
          setSpeaking(true)
        }
      } catch (err) {
        setError('Request failed: ' + (err instanceof Error ? err.message : String(err)))
        setSpeaking(false)
        setPaused(false)
        setLoading(false)
      }
    },
    [cloudVoice, rate, pitch]
  )

  const speak = useCallback(
    (text: string) => {
      if (!text?.trim()) return

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      // Clear chunks and reset
      chunksRef.current = chunkText(text)
      currentChunkIndexRef.current = 0
      setError(null)

      if (chunksRef.current.length === 0) return

      // Fetch and play first chunk
      fetchAndPlayChunk(0)
    },
    [fetchAndPlayChunk]
  )

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
      setPaused(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setSpeaking(false)
    setPaused(false)
    setLoading(false)
    chunksRef.current = []
    currentChunkIndexRef.current = 0
  }, [])

  return {
    speaking,
    paused,
    loading,
    error,
    speak,
    pause,
    resume,
    stop
  }
}
