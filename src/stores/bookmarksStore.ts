import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BookmarksStore {
  bookmarks: Record<string, number>
  setBookmark: (key: string, index: number) => void
  getBookmark: (key: string) => number | undefined
  removeBookmark: (key: string) => void
}

export const useBookmarksStore = create<BookmarksStore>()(
  persist(
    (set, get) => ({
      bookmarks: {},
      setBookmark: (key: string, index: number) => {
        const current = get().bookmarks
        set({ bookmarks: { ...current, [key]: index } })
      },
      getBookmark: (key: string) => {
        return get().bookmarks[key]
      },
      removeBookmark: (key: string) => {
        const current = get().bookmarks
        const updated = { ...current }
        delete updated[key]
        set({ bookmarks: updated })
      }
    }),
    {
      name: 'bookmarks-store'
    }
  )
)
