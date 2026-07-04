import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Theme, FontFamily, ReaderSettings } from '../types'

interface ReaderSettingsStoreState extends ReaderSettings {
  setFontSize: (size: number) => void
  setFontFamily: (family: FontFamily) => void
  setLineSpacing: (spacing: number) => void
  setTheme: (theme: Theme) => void
}

export const useReaderSettingsStore = create<ReaderSettingsStoreState>()(
  persist(
    (set) => ({
      fontSize: 3,
      fontFamily: 'serif',
      lineSpacing: 1.5,
      theme: 'light',
      setFontSize: (size: number) => set({ fontSize: size }),
      setFontFamily: (family: FontFamily) => set({ fontFamily: family }),
      setLineSpacing: (spacing: number) => set({ lineSpacing: spacing }),
      setTheme: (theme: Theme) => set({ theme })
    }),
    {
      name: 'reader-settings-store'
    }
  )
)
