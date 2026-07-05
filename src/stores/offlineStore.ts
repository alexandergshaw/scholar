import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Article, FullTextResult } from '../types'
import { shortIdOf } from '../utils/openalexApi'

type AvailableFullText = Extract<FullTextResult, { available: true }>

export interface SavedOffline {
  article: Article
  fullText: AvailableFullText
  savedAt: number
}

export interface SavedOfflinePrimary {
  id: string
  title: string
  source: string
  fullText: AvailableFullText
  savedAt: number
}

interface OfflineStore {
  saved: SavedOffline[]
  savedPrimary: SavedOfflinePrimary[]
  saveOffline: (article: Article, fullText: AvailableFullText) => boolean
  removeOffline: (id: string) => void
  isSavedOffline: (id: string) => boolean
  getOffline: (id: string) => SavedOffline | undefined
  savePrimaryOffline: (id: string, title: string, source: string, fullText: AvailableFullText) => boolean
  removePrimaryOffline: (id: string) => void
  isPrimaryOffline: (id: string) => boolean
  getPrimaryOffline: (id: string) => SavedOfflinePrimary | undefined
}

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      saved: [],
      savedPrimary: [],
      saveOffline: (article: Article, fullText: AvailableFullText) => {
        try {
          const { saved } = get()
          const shortId = shortIdOf(article.id)
          // Upsert: remove if exists, then add new
          const filtered = saved.filter(s => shortIdOf(s.article.id) !== shortId)
          const updated = [...filtered, { article, fullText, savedAt: Date.now() }]
          set({ saved: updated })
          return true
        } catch (err) {
          // QuotaExceededError or other storage errors
          console.error('Failed to save offline:', err)
          return false
        }
      },
      removeOffline: (id: string) => {
        const { saved } = get()
        const shortId = shortIdOf(id)
        const filtered = saved.filter(
          s => shortIdOf(s.article.id) !== shortId && s.article.id !== id
        )
        set({ saved: filtered })
      },
      isSavedOffline: (id: string) => {
        const { saved } = get()
        const shortId = shortIdOf(id)
        return saved.some(
          s => shortIdOf(s.article.id) === shortId || s.article.id === id
        )
      },
      getOffline: (id: string) => {
        const { saved } = get()
        const shortId = shortIdOf(id)
        return saved.find(
          s => shortIdOf(s.article.id) === shortId || s.article.id === id
        )
      },
      savePrimaryOffline: (id: string, title: string, source: string, fullText: AvailableFullText) => {
        try {
          const { savedPrimary } = get()
          // Upsert: remove if exists, then add new
          const filtered = savedPrimary.filter(s => s.id !== id)
          const updated = [...filtered, { id, title, source, fullText, savedAt: Date.now() }]
          set({ savedPrimary: updated })
          return true
        } catch (err) {
          // QuotaExceededError or other storage errors
          console.error('Failed to save primary offline:', err)
          return false
        }
      },
      removePrimaryOffline: (id: string) => {
        const { savedPrimary } = get()
        const filtered = savedPrimary.filter(s => s.id !== id)
        set({ savedPrimary: filtered })
      },
      isPrimaryOffline: (id: string) => {
        const { savedPrimary } = get()
        return savedPrimary.some(s => s.id === id)
      },
      getPrimaryOffline: (id: string) => {
        const { savedPrimary } = get()
        return savedPrimary.find(s => s.id === id)
      }
    }),
    {
      name: 'offline-store'
    }
  )
)
