import { useMemo } from 'react'
import { useTts } from './useTts'
import { useCloudTts } from './useCloudTts'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'

export function useReaderTts() {
  const deviceTts = useTts()
  const cloudTts = useCloudTts()
  const { engine } = useTtsSettingsStore()

  // Select the active engine, with offline fallback for cloud engine
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const isDeviceEngine = engine === 'device' || (engine === 'cloud' && offline)
  const activeTts = isDeviceEngine ? deviceTts : cloudTts

  // Return unified interface delegating to the active engine
  return useMemo(() => ({
    supported: deviceTts.supported,
    engine,
    speaking: activeTts.speaking,
    paused: activeTts.paused,
    loading: 'loading' in activeTts ? activeTts.loading : false,
    error: 'error' in activeTts ? activeTts.error : null,
    currentIndex: activeTts.currentIndex,
    voices: deviceTts.voices,
    sortedVoices: deviceTts.sortedVoices,
    speak: (segments: string[], startIndex?: number) => activeTts.speak(segments, startIndex),
    pause: () => activeTts.pause(),
    resume: () => activeTts.resume(),
    stop: () => activeTts.stop(),
    seekTo: (index: number) => activeTts.seekTo(index),
    next: () => activeTts.next(),
    prev: () => activeTts.prev(),
    changeVoice: (voiceId: string | null) => {
      if (voiceId) {
        activeTts.changeVoice(voiceId)
      }
    }
  }), [engine, activeTts, deviceTts.supported, deviceTts.voices, deviceTts.sortedVoices])
}
