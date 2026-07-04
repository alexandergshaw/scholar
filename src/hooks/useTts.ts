import { useState, useEffect, useCallback, useRef } from 'react'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'

interface UseTtsReturn {
  supported: boolean
  voices: SpeechSynthesisVoice[]
  sortedVoices: SpeechSynthesisVoice[]
  speaking: boolean
  paused: boolean
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

// Helper to rank voice naturalness
function naturalnessRank(voice: SpeechSynthesisVoice): number {
  const nameLower = voice.name.toLowerCase()

  if (nameLower.includes('natural') || nameLower.includes('neural')) {
    return 105
  }
  if (nameLower.includes('online')) {
    return 95
  }
  if (nameLower.includes('google')) {
    return 85
  }

  const naturalNames = ['aria', 'jenny', 'michelle', 'ava', 'samantha', 'serena', 'sonia', 'libby', 'emma', 'siri', 'allison', 'joanna', 'matthew']
  let baseRank = 10
  if (naturalNames.some(n => nameLower.includes(n))) {
    baseRank = 75
  }

  // Add 5 if language starts with "en"
  if (voice.lang.startsWith('en')) {
    baseRank += 5
  }

  return baseRank
}

export function useTts(): UseTtsReturn {
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [sortedVoices, setSortedVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [syncIntervalId, setSyncIntervalId] = useState<number | null>(null)
  const hasStartedRef = useRef(false)

  const { voiceURI, rate, pitch, setVoiceURI } = useTtsSettingsStore()

  // Initialize speech synthesis support and load voices
  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

    if (isSupported) {
      setSupported(true)

      // Load voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices()
        setVoices(availableVoices)

        // Sort voices by naturalness
        const sorted = [...availableVoices].sort((a, b) => {
          const rankDiff = naturalnessRank(b) - naturalnessRank(a)
          if (rankDiff !== 0) return rankDiff
          return a.name.localeCompare(b.name)
        })
        setSortedVoices(sorted)

        // Auto-select best voice if none selected or previous selection is unavailable
        if (!voiceURI || !availableVoices.some(v => v.voiceURI === voiceURI)) {
          if (sorted.length > 0) {
            setVoiceURI(sorted[0].voiceURI)
          }
        }
      }

      loadVoices()

      // Subscribe to voices changed event (voices load async in Chrome)
      window.speechSynthesis.onvoiceschanged = loadVoices

      return () => {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Start a sync interval when speaking to track state accurately (fallback only)
  const startSyncInterval = useCallback(() => {
    if (syncIntervalId !== null) return

    const id = window.setInterval(() => {
      if ('speechSynthesis' in window) {
        // Update paused state
        setPaused(window.speechSynthesis.paused)

        // Only end speech if we've actually started AND nothing is speaking/pending
        // hasStartedRef prevents premature revert during spin-up
        if (hasStartedRef.current && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          setSpeaking(false)
          window.clearInterval(id)
          setSyncIntervalId(null)
        }
      }
    }, 250)

    setSyncIntervalId(id)
  }, [syncIntervalId])

  const stopSyncInterval = useCallback(() => {
    if (syncIntervalId !== null) {
      window.clearInterval(syncIntervalId)
      setSyncIntervalId(null)
    }
  }, [syncIntervalId])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      stopSyncInterval()
    }
  }, [stopSyncInterval])

  // Build, queue, and speak chunks
  const buildAndQueueUtterances = useCallback(
    (text: string) => {
      if (!supported || !window.speechSynthesis) return

      // Chunk text into sentences
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]

      // Group consecutive sentences into chunks of up to ~250 chars
      const chunks: string[] = []
      let currentChunk = ''

      for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (!trimmed) continue

        if ((currentChunk + ' ' + trimmed).length > 250) {
          if (currentChunk) chunks.push(currentChunk)
          currentChunk = trimmed
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed
        }
      }

      if (currentChunk) chunks.push(currentChunk)

      if (chunks.length === 0) return

      // Find the selected voice
      const selectedVoice = voiceURI ? voices.find(v => v.voiceURI === voiceURI) : undefined

      // Queue utterances with event handlers
      chunks.forEach((chunk, idx) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.rate = rate
        utterance.pitch = pitch

        if (selectedVoice) {
          utterance.voice = selectedVoice
        }

        // Set onstart on the FIRST utterance
        if (idx === 0) {
          utterance.onstart = () => {
            hasStartedRef.current = true
            setSpeaking(true)
            setPaused(false)
          }
        }

        // Set onend on the LAST utterance
        if (idx === chunks.length - 1) {
          utterance.onend = () => {
            setSpeaking(false)
            setPaused(false)
            hasStartedRef.current = false
            stopSyncInterval()
          }
        }

        // Set onerror on EVERY utterance (ignore cancel-related errors)
        utterance.onerror = (e) => {
          if (e.error === 'interrupted' || e.error === 'canceled') {
            return
          }
          setSpeaking(false)
          setPaused(false)
          hasStartedRef.current = false
          stopSyncInterval()
        }

        window.speechSynthesis.speak(utterance)
      })
    },
    [supported, voices, voiceURI, rate, pitch, stopSyncInterval]
  )

  const speak = useCallback(
    (text: string) => {
      if (!supported || !window.speechSynthesis) return

      // Set optimistic state immediately for responsive UI
      setSpeaking(true)
      setPaused(false)
      hasStartedRef.current = false

      // Avoid cancel-race: if already speaking or pending, queue the utterances after a delay
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel()
        setTimeout(() => {
          buildAndQueueUtterances(text)
          startSyncInterval()
        }, 120)
      } else {
        buildAndQueueUtterances(text)
        startSyncInterval()
      }
    },
    [supported, buildAndQueueUtterances, startSyncInterval]
  )

  const pause = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume()
      setPaused(false)
    }
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
    setPaused(false)
    hasStartedRef.current = false
    stopSyncInterval()
  }, [stopSyncInterval])

  return {
    supported,
    voices,
    sortedVoices,
    speaking,
    paused,
    speak,
    pause,
    resume,
    stop
  }
}
