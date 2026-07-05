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
  currentIndex: number
  speak: (segments: string[], startIndex?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  seekTo: (index: number) => void
  next: () => void
  prev: () => void
  changeVoice: (newVoiceId: string) => void
}

export function useCloudTts(): UseCloudTtsReturn {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(-1)

  const { cloudVoice, rate, pitch } = useTtsSettingsStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const segmentsRef = useRef<string[]>([])
  const currentIndexRef = useRef(-1)
  const subChunksRef = useRef<string[]>([])
  const subChunkIndexRef = useRef(0)

  // Helper to map pitch from 0-2 range to Google -20..20 range
  const mapPitch = (p: number): number => {
    return (p - 1) * 10
  }

  // Helper to split text into sentences
  const splitIntoSentences = (text: string): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
    return sentences.map((s) => s.trim()).filter((s) => s)
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
    subChunkIndexRef.current += 1

    if (subChunkIndexRef.current < subChunksRef.current.length) {
      // Play next sub-chunk of current segment
      fetchAndPlayChunk(currentIndexRef.current, undefined, undefined, subChunkIndexRef.current)
    } else {
      // Current segment done, advance to next segment
      if (currentIndexRef.current < segmentsRef.current.length - 1) {
        const nextIdx = currentIndexRef.current + 1
        currentIndexRef.current = nextIdx
        setCurrentIndex(nextIdx)
        subChunkIndexRef.current = 0
        subChunksRef.current = []
        fetchAndPlayChunk(nextIdx)
      } else {
        // All segments done
        setSpeaking(false)
        setPaused(false)
        setLoading(false)
      }
    }
  }, [])

  const fetchAndPlayChunk = useCallback(
    async (segmentIndex: number, voiceOverride?: string, seekFraction?: number, subChunkIndex?: number) => {
      if (segmentIndex >= segmentsRef.current.length) return

      const segment = segmentsRef.current[segmentIndex]

      // If subChunks not initialized, chunk the segment
      if (subChunksRef.current.length === 0 || subChunkIndex === undefined) {
        const sentences = splitIntoSentences(segment)
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

        subChunksRef.current = chunks.length > 0 ? chunks : [segment]
        subChunkIndexRef.current = subChunkIndex ?? 0
      } else if (subChunkIndex !== undefined) {
        subChunkIndexRef.current = subChunkIndex
      }

      if (subChunkIndexRef.current >= subChunksRef.current.length) return

      const chunk = subChunksRef.current[subChunkIndexRef.current]
      setLoading(true)

      try {
        const effectiveVoice = voiceOverride || cloudVoice
        const voiceInfo = CURATED_CLOUD_VOICES.find((v) => v.id === effectiveVoice) || CURATED_CLOUD_VOICES[0]

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunk,
            voice: effectiveVoice,
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

          // Only seek when a voice change asked us to preserve position within
          // the current chunk. Normal chunk advancement plays from the start.
          if (seekFraction !== undefined) {
            const clampedFraction = Math.max(0, Math.min(1, seekFraction))
            const handleLoadedMetadata = () => {
              if (audioRef.current) {
                const newDuration = audioRef.current.duration
                if (isFinite(newDuration) && newDuration > 0) {
                  audioRef.current.currentTime = clampedFraction * newDuration
                }
                audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
              }
            }
            audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
          }

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
    (segments: string[], startIndex: number = 0) => {
      if (segments.length === 0) return

      // Clamp startIndex to valid range
      const idx = Math.max(0, Math.min(startIndex, segments.length - 1))

      // Store segments and reset
      segmentsRef.current = segments
      currentIndexRef.current = idx
      subChunksRef.current = []
      subChunkIndexRef.current = 0
      setError(null)
      setCurrentIndex(idx)

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      // Fetch and play first segment
      fetchAndPlayChunk(idx)
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
    currentIndexRef.current = -1
    setCurrentIndex(-1)
  }, [])

  const seekTo = useCallback(
    (index: number) => {
      if (segmentsRef.current.length === 0) return

      // Clamp to valid range
      const newIdx = Math.max(0, Math.min(index, segmentsRef.current.length - 1))

      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      currentIndexRef.current = newIdx
      setCurrentIndex(newIdx)
      subChunksRef.current = []
      subChunkIndexRef.current = 0

      // Fetch and play the segment
      fetchAndPlayChunk(newIdx)
    },
    [fetchAndPlayChunk]
  )

  const next = useCallback(() => {
    if (currentIndexRef.current < segmentsRef.current.length - 1) {
      seekTo(currentIndexRef.current + 1)
    }
  }, [seekTo])

  const prev = useCallback(() => {
    if (currentIndexRef.current > 0) {
      seekTo(currentIndexRef.current - 1)
    }
  }, [seekTo])

  const changeVoice = useCallback(
    (newVoiceId: string) => {
      // If not currently speaking or loading, do nothing
      if (!speaking && !loading) return

      const currentSegmentIndex = currentIndexRef.current

      // If we're past the segments, stop gracefully
      if (currentSegmentIndex < 0 || currentSegmentIndex >= segmentsRef.current.length) {
        setSpeaking(false)
        setPaused(false)
        return
      }

      // Capture pause state before re-fetching
      const wasPaused = paused

      // For cloud TTS, restart the current segment from the start (simpler than preserving position)
      subChunksRef.current = []
      subChunkIndexRef.current = 0

      // Re-fetch and play current segment with new voice
      fetchAndPlayChunk(currentSegmentIndex, newVoiceId)

      // If was paused, pause immediately after audio loads
      if (wasPaused && audioRef.current) {
        const handleLoadedMetadata = () => {
          if (audioRef.current) {
            audioRef.current.pause()
            setPaused(true)
            audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
          }
        }
        audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
      }
    },
    [speaking, loading, paused, fetchAndPlayChunk]
  )

  return {
    speaking,
    paused,
    loading,
    error,
    currentIndex,
    speak,
    pause,
    resume,
    stop,
    seekTo,
    next,
    prev,
    changeVoice
  }
}
