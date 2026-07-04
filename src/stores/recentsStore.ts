import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Article } from '../types'

interface RecentsStore {
  recents: Article[]
  addRecent: (article: Article) => void
  enrichRecent: (article: Article) => void
  clearRecents: () => void
}

export const useRecentsStore = create<RecentsStore>()(
  persist(
    (set, get) => ({
      recents: [],
      addRecent: (article: Article) => {
        const { recents } = get()
        // Remove if already exists (deduplication), then add to front
        const filtered = recents.filter(r => r.id !== article.id)
        const updated = [article, ...filtered].slice(0, 20) // Cap at 20
        set({ recents: updated })
      },
      enrichRecent: (article: Article) => {
        const { recents } = get()
        // Replace the article in recents if it exists, else do nothing
        const updated = recents.map(r => (r.id === article.id ? article : r))
        set({ recents: updated })
      },
      clearRecents: () => {
        set({ recents: [] })
      }
    }),
    {
      name: 'recents-store'
    }
  )
)
