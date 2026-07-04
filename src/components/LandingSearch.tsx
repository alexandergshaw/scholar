import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { autocomplete, shortIdOf } from '../utils/openalexApi'
import { AutocompleteResult } from '../types'
import './LandingSearch.css'

type SearchMode = 'articles' | 'authors' | 'topics'

export default function LandingSearch() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SearchMode>('articles')
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const placeholders: Record<SearchMode, string> = {
    articles: 'Search articles…',
    authors: 'Search authors…',
    topics: 'Search topics…'
  }

  const performAutocomplete = useCallback(async (query: string, currentRequestId: number) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const results = await autocomplete(mode, query)

      // Ignore if a newer request has come in
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      setSuggestions(results.slice(0, 8))
      setShowDropdown(true)
      setSelectedIndex(-1)
    } catch (err) {
      // Silent error handling
      setSuggestions([])
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [mode])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setSelectedIndex(-1)

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Increment request ID to cancel stale requests
    requestIdRef.current += 1
    const currentRequestId = requestIdRef.current

    if (value.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setLoading(false)
      return
    }

    // Debounce 250ms
    debounceTimerRef.current = setTimeout(() => {
      performAutocomplete(value, currentRequestId)
    }, 250)
  }

  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode)
    setSuggestions([])
    setShowDropdown(false)
    setSelectedIndex(-1)
    setInput('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const selectSuggestion = (suggestion: AutocompleteResult) => {
    switch (mode) {
      case 'topics':
        navigate(`/search?topic=${encodeURIComponent(suggestion.display_name)}`)
        break
      case 'authors':
        navigate(`/search?authorId=${encodeURIComponent(shortIdOf(suggestion.id))}&author=${encodeURIComponent(suggestion.display_name)}`)
        break
      case 'articles':
        navigate(`/reader/${shortIdOf(suggestion.id)}`)
        break
    }
    setInput('')
    setSuggestions([])
    setShowDropdown(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) {
      return
    }

    // If there's a selected suggestion, use it
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      selectSuggestion(suggestions[selectedIndex])
      return
    }

    // Otherwise, navigate with free-text search
    switch (mode) {
      case 'topics':
        navigate(`/search?topic=${encodeURIComponent(input)}`)
        break
      case 'authors':
        navigate(`/search?author=${encodeURIComponent(input)}`)
        break
      case 'articles':
        navigate(`/search?query=${encodeURIComponent(input)}`)
        break
    }
    setInput('')
    setSuggestions([])
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSubmit(e as any)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex])
        } else {
          handleSubmit(e as any)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        break
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="landing-search">
      {/* Mode selector */}
      <div className="search-mode-selector">
        <button
          className={`mode-tab ${mode === 'articles' ? 'active' : ''}`}
          onClick={() => handleModeChange('articles')}
          aria-label="Search articles mode"
        >
          Articles
        </button>
        <button
          className={`mode-tab ${mode === 'authors' ? 'active' : ''}`}
          onClick={() => handleModeChange('authors')}
          aria-label="Search authors mode"
        >
          Authors
        </button>
        <button
          className={`mode-tab ${mode === 'topics' ? 'active' : ''}`}
          onClick={() => handleModeChange('topics')}
          aria-label="Search topics mode"
        >
          Topics
        </button>
      </div>

      {/* Search input with dropdown */}
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrapper" ref={dropdownRef}>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={placeholders[mode]}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (input.length >= 2 && suggestions.length > 0) {
                setShowDropdown(true)
              }
            }}
            aria-label={`Search ${mode}`}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls="search-suggestions"
          />
          {loading && <div className="loading-spinner" aria-label="Loading suggestions" />}

          {/* Suggestions dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="suggestions-dropdown" id="search-suggestions" role="listbox">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={suggestion.id}
                  className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => selectSuggestion(suggestion)}
                  role="option"
                  aria-selected={idx === selectedIndex}
                >
                  <div className="suggestion-label">{suggestion.display_name}</div>
                  {suggestion.hint && <div className="suggestion-hint">{suggestion.hint}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="search-button" aria-label="Search">
          Search
        </button>
      </form>
    </div>
  )
}
