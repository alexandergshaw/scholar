import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Article } from '../types'

interface FavoritesStore {
  favorites: Article[]
  toggleFavorite: (article: Article) => void
  isFavorite: (id: string) => boolean
  removeFavorite: (id: string) => void
  clearFavorites: () => void
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (article: Article) => {
        const { favorites, isFavorite } = get()
        if (isFavorite(article.id)) {
          set({ favorites: favorites.filter(f => f.id !== article.id) })
        } else {
          set({ favorites: [...favorites, article] })
        }
      },
      isFavorite: (id: string) => {
        return get().favorites.some(f => f.id === id)
      },
      removeFavorite: (id: string) => {
        set({ favorites: get().favorites.filter(f => f.id !== id) })
      },
      clearFavorites: () => {
        set({ favorites: [] })
      }
    }),
    {
      name: 'favorites-store'
    }
  )
)
