import { create } from 'zustand'
import { Article, PrimarySource } from '../types'

export interface SearchSnapshot {
  hasSnapshot: boolean
  query: string
  author: string
  topic: string
  yearFrom: string
  yearTo: string
  openAccessOnly: boolean
  fullTextOnly: boolean
  readableInlineOnly: boolean
  sort: 'relevance' | 'newest' | 'oldest' | 'citations'
  docType: string
  primaryMode: boolean
  enabledSources: string[]
  articles: Article[]
  primarySources: PrimarySource[]
  page: number
  total: number
  primaryPage: number
  primaryHasMore: boolean
  hasSearched: boolean
  scrollY: number
}

interface SearchStore extends SearchSnapshot {
  saveSnapshot: (s: Partial<SearchSnapshot>) => void
  setScrollY: (y: number) => void
}

const defaultSnapshot: SearchSnapshot = {
  hasSnapshot: false,
  query: '',
  author: '',
  topic: '',
  yearFrom: '',
  yearTo: '',
  openAccessOnly: false,
  fullTextOnly: false,
  readableInlineOnly: false,
  sort: 'relevance',
  docType: 'any',
  primaryMode: false,
  enabledSources: [],
  articles: [],
  primarySources: [],
  page: 1,
  total: 0,
  primaryPage: 1,
  primaryHasMore: false,
  hasSearched: false,
  scrollY: 0
}

export const useSearchStore = create<SearchStore>((set) => ({
  ...defaultSnapshot,
  saveSnapshot: (partial: Partial<SearchSnapshot>) =>
    set((state) => ({
      ...state,
      ...partial,
      hasSnapshot: true
    })),
  setScrollY: (y: number) => set({ scrollY: y })
}))
