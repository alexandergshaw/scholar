import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useReaderSettingsStore } from './stores/readerSettingsStore'
import { useRecentsStore } from './stores/recentsStore'
import { useFavoritesStore } from './stores/favoritesStore'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import Search from './pages/Search'
import Reader from './pages/Reader'
import PrimaryReader from './pages/PrimaryReader'
import Favorites from './pages/Favorites'
import Settings from './pages/Settings'
import ConceptWeb from './pages/ConceptWeb'
import './App.css'

function App() {
  const theme = useReaderSettingsStore(state => state.theme)
  const fontFamily = useReaderSettingsStore(state => state.fontFamily)

  // Initialize stores (trigger hydration from localStorage)
  useRecentsStore()
  useFavoritesStore()
  useReaderSettingsStore()

  // Apply theme to the document root so themed variables inherit everywhere
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('theme-light', 'theme-sepia', 'theme-dark')
    if (theme !== 'light') {
      el.classList.add(`theme-${theme}`)
    }
  }, [theme])

  // Apply font family to body
  useEffect(() => {
    if (fontFamily === 'serif') {
      document.documentElement.style.fontFamily = 'var(--font-serif)'
    } else {
      document.documentElement.style.fontFamily = 'var(--font-sans)'
    }
  }, [fontFamily])

  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/reader/:articleId" element={<Reader />} />
          <Route path="/read/primary" element={<PrimaryReader />} />
          <Route path="/web" element={<ConceptWeb />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Navigation />
      </div>
    </BrowserRouter>
  )
}

export default App
