import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Article, PrimarySource } from '../types'

interface FavoritesStore {
  favorites: Article[]
  primaryFavorites: PrimarySource[]
  toggleFavorite: (article: Article) => void
  isFavorite: (id: string) => boolean
  removeFavorite: (id: string) => void
  togglePrimaryFavorite: (source: PrimarySource) => void
  isPrimaryFavorite: (id: string) => boolean
  clearFavorites: () => void
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      primaryFavorites: [],
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
      togglePrimaryFavorite: (source: PrimarySource) => {
        const { primaryFavorites, isPrimaryFavorite } = get()
        if (isPrimaryFavorite(source.id)) {
          set({ primaryFavorites: primaryFavorites.filter(f => f.id !== source.id) })
        } else {
          set({ primaryFavorites: [...primaryFavorites, source] })
        }
      },
      isPrimaryFavorite: (id: string) => {
        return get().primaryFavorites.some(f => f.id === id)
      },
      clearFavorites: () => {
        set({ favorites: [], primaryFavorites: [] })
      }
    }),
    {
      name: 'favorites-store'
    }
  )
)
