import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TtsSettingsStoreState {
  voiceURI: string | null
  rate: number
  pitch: number
  setVoiceURI: (uri: string | null) => void
  setRate: (rate: number) => void
  setPitch: (pitch: number) => void
}

export const useTtsSettingsStore = create<TtsSettingsStoreState>()(
  persist(
    (set) => ({
      voiceURI: null,
      rate: 1,
      pitch: 1,
      setVoiceURI: (uri: string | null) => set({ voiceURI: uri }),
      setRate: (rate: number) => set({ rate }),
      setPitch: (pitch: number) => set({ pitch })
    }),
    {
      name: 'tts-settings-store'
    }
  )
)
