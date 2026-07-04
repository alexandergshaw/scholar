import { useState, useEffect, useCallback } from 'react'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'

interface UseTtsReturn {
  supported: boolean
  voices: SpeechSynthesisVoice[]
  speaking: boolean
  paused: boolean
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

export function useTts(): UseTtsReturn {
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [syncIntervalId, setSyncIntervalId] = useState<number | null>(null)

  const { voiceURI, rate, pitch } = useTtsSettingsStore()

  // Initialize speech synthesis support and load voices
  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

    if (isSupported) {
      setSupported(true)

      // Load voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices()
        setVoices(availableVoices)
      }

      loadVoices()

      // Subscribe to voices changed event (voices load async in Chrome)
      window.speechSynthesis.onvoiceschanged = loadVoices

      return () => {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Start a sync interval when speaking to track state accurately
  const startSyncInterval = useCallback(() => {
    if (syncIntervalId !== null) return

    const id = window.setInterval(() => {
      if ('speechSynthesis' in window) {
        setSpeaking(window.speechSynthesis.speaking)
        setPaused(window.speechSynthesis.paused)

        // Clear interval if no longer speaking
        if (!window.speechSynthesis.speaking) {
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

  const speak = useCallback(
    (text: string) => {
      if (!supported || !window.speechSynthesis) return

      // Clear any existing speech
      window.speechSynthesis.cancel()

      // Chunk text into sentences
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]

      // Group consecutive sentences into chunks of up to ~1000 chars
      const chunks: string[] = []
      let currentChunk = ''

      for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (!trimmed) continue

        if ((currentChunk + ' ' + trimmed).length > 1000) {
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

      // Queue utterances
      chunks.forEach((chunk, idx) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.rate = rate
        utterance.pitch = pitch

        if (selectedVoice) {
          utterance.voice = selectedVoice
        }

        // Set state tracking on the last chunk
        if (idx === chunks.length - 1) {
          utterance.onend = () => {
            setSpeaking(false)
            setPaused(false)
            stopSyncInterval()
          }

          utterance.onerror = () => {
            setSpeaking(false)
            setPaused(false)
            stopSyncInterval()
          }
        }

        window.speechSynthesis.speak(utterance)
      })

      setSpeaking(true)
      setPaused(false)
      startSyncInterval()
    },
    [supported, voices, voiceURI, rate, pitch, startSyncInterval, stopSyncInterval]
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
    stopSyncInterval()
  }, [stopSyncInterval])

  return {
    supported,
    voices,
    speaking,
    paused,
    speak,
    pause,
    resume,
    stop
  }
}
