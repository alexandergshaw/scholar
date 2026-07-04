import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TtsSettingsStoreState {
  voiceURI: string | null
  rate: number
  pitch: number
  engine: 'device' | 'cloud'
  cloudVoice: string
  setVoiceURI: (uri: string | null) => void
  setRate: (rate: number) => void
  setPitch: (pitch: number) => void
  setEngine: (engine: 'device' | 'cloud') => void
  setCloudVoice: (voice: string) => void
}

export const useTtsSettingsStore = create<TtsSettingsStoreState>()(
  persist(
    (set) => ({
      voiceURI: null,
      rate: 1,
      pitch: 1,
      engine: 'device',
      cloudVoice: 'en-US-Neural2-F',
      setVoiceURI: (uri: string | null) => set({ voiceURI: uri }),
      setRate: (rate: number) => set({ rate }),
      setPitch: (pitch: number) => set({ pitch }),
      setEngine: (engine: 'device' | 'cloud') => set({ engine }),
      setCloudVoice: (voice: string) => set({ cloudVoice: voice })
    }),
    {
      name: 'tts-settings-store'
    }
  )
)
