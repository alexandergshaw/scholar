import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SearchX } from 'lucide-react'
import { searchWorks } from '../utils/openalexApi'
import { searchPrimary } from '../utils/primaryApi'
import { Article, PrimarySource } from '../types'
import ArticleCard from '../components/ArticleCard'
import PrimarySourceCard from '../components/PrimarySourceCard'
import './Search.css'

const ALL_SOURCE_NAMES = [
  'Project Gutenberg',
  'Internet Archive',
  'Chronicling America',
  'Wikipedia',
  'Wikisource',
  'The Conversation',
  'DOAJ',
  'OAPEN',
  'Standard Ebooks',
  'Preprints',
  'Semantic Scholar',
  'CORE',
  'Stanford Encyclopedia'
]

const SOURCE_GROUPS = [
  {
    heading: 'Reference & encyclopedias',
    sources: ['Wikipedia', 'Wikisource', 'Stanford Encyclopedia']
  },
  {
    heading: 'Books',
    sources: ['Project Gutenberg', 'Standard Ebooks', 'Internet Archive', 'OAPEN']
  },
  {
    heading: 'Journal articles',
    sources: ['DOAJ', 'CORE', 'Semantic Scholar']
  },
  {
    heading: 'Preprints',
    sources: ['Preprints']
  },
  {
    heading: 'News & explainers',
    sources: ['The Conversation']
  },
  {
    heading: 'Historical newspapers',
    sources: ['Chronicling America']
  }
]

export default function Search() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('query') || '')
  const [author, setAuthor] = useState(searchParams.get('author') || '')
  const [authorId] = useState(searchParams.get('authorId') || '')
  const [topic, setTopic] = useState(searchParams.get('topic') || '')
  const [yearFrom, setYearFrom] = useState(searchParams.get('yearFrom') || '')
  const [yearTo, setYearTo] = useState(searchParams.get('yearTo') || '')
  const [openAccessOnly, setOpenAccessOnly] = useState(searchParams.get('openAccessOnly') === 'true')
  const [fullTextOnly, setFullTextOnly] = useState(searchParams.get('fullText') === 'true')
  const [readableInlineOnly, setReadableInlineOnly] = useState(searchParams.get('readableInline') === 'true')
  const [sort, setSort] = useState<'relevance' | 'newest' | 'oldest' | 'citations'>('relevance')
  const [docType, setDocType] = useState('any')
  const [primaryMode, setPrimaryMode] = useState(searchParams.get('primary') === 'true')
  const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set(ALL_SOURCE_NAMES))

  const [articles, setArticles] = useState<Article[]>([])
  const [primarySources, setPrimarySources] = useState<PrimarySource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [primaryPage, setPrimaryPage] = useState(1)
  const [primaryHasMore, setPrimaryHasMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const didMountRef = useRef(false)

  const performSearch = async (pageNum: number = 1) => {
    if (!query) {
      setError(null)
      setHasSearched(false)
      setArticles([])
      setPrimarySources([])
      setPrimaryHasMore(false)
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      if (primaryMode) {
        // Check if at least one source is selected
        if (enabledSources.size === 0) {
          setError('Select at least one source')
          setLoading(false)
          return
        }

        // Primary sources search
        const sourceList = enabledSources.size === ALL_SOURCE_NAMES.length
          ? undefined
          : Array.from(enabledSources)
        const result = await searchPrimary(query, pageNum, sourceList)

        if (pageNum === 1) {
          setPrimarySources(result.results)
        } else {
          setPrimarySources(prev => [...prev, ...result.results])
        }
        // The primary API has no total count; treat a non-empty page as
        // an indication that more results may be available.
        setPrimaryHasMore(result.results.length > 0)
        setPrimaryPage(pageNum)
      } else {
        // Scholarly works search
        const result = await searchWorks({
          query: query || undefined,
          author: author || undefined,
          authorId: authorId || undefined,
          topic: topic || undefined,
          yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
          yearTo: yearTo ? parseInt(yearTo) : undefined,
          openAccessOnly,
          fullTextOnly,
          readableInlineOnly,
          sort: sort !== 'relevance' ? sort : undefined,
          docType: docType !== 'any' ? docType : undefined,
          page: pageNum,
          perPage: 25
        })

        if (pageNum === 1) {
          setArticles(result.articles)
        } else {
          setArticles(prev => [...prev, ...result.articles])
        }
        setTotal(result.total)
        setPage(pageNum)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search')
      setArticles([])
      setPrimarySources([])
      setPrimaryHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handlePrimaryModeToggle = () => {
    setPrimaryMode(!primaryMode)
    setArticles([])
    setPrimarySources([])
    setHasSearched(false)
    setPage(1)
    setPrimaryPage(1)
    setPrimaryHasMore(false)
  }

  useEffect(() => {
    // Auto-run search if there's a query in the URL
    if (query) {
      performSearch(1)
    }
  }, [])

  useEffect(() => {
    // Skip the very first run (component mount) so we don't double-fetch.
    if (!didMountRef.current) { didMountRef.current = true; return }
    // Only auto-refetch once the user actually has a query to search.
    if (!query.trim()) return
    const t = setTimeout(() => {
      setPage(1)
      setPrimaryPage(1)
      performSearch(1)
    }, 350)
    return () => clearTimeout(t)
  }, [
    openAccessOnly, fullTextOnly, readableInlineOnly, sort, docType,
    yearFrom, yearTo, author, topic, primaryMode,
    Array.from(enabledSources).sort().join(',')
  ])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Reset pagination for a fresh search.
    setPrimaryPage(1)
    setPage(1)
    performSearch(1)
  }

  const handleLoadMore = () => {
    performSearch(page + 1)
  }

  const handlePrimaryLoadMore = () => {
    performSearch(primaryPage + 1)
  }

  const canLoadMore = articles.length < total && !loading
  const canLoadMorePrimary = primaryHasMore && !loading

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Search</h1>
      </div>

      <div className="mode-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={primaryMode}
            onChange={handlePrimaryModeToggle}
            className="toggle-checkbox"
          />
          <span className="toggle-text">Books & other sources</span>
        </label>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <input
            type="text"
            placeholder={
              primaryMode ? 'Search books, encyclopedias, preprints…' : 'Search articles...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {!primaryMode && (
          <>
            {/* Collapsible Advanced Filters Section */}
            <button
              type="button"
              className="filters-toggle"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
            >
              <span className="filters-toggle-arrow">{filtersOpen ? '▾' : '▸'}</span>
              Advanced filters
            </button>

            {filtersOpen && (
              <div className="filters-section">
                <div className="form-row">
                  <div className="form-group">
                    <select
                      value={sort}
                      onChange={e => setSort(e.target.value as 'relevance' | 'newest' | 'oldest' | 'citations')}
                      className="search-input"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="citations">Most cited</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="search-input"
                    >
                      <option value="any">Any type</option>
                      <option value="article">Journal article</option>
                      <option value="review">Review</option>
                      <option value="book">Book</option>
                      <option value="book-chapter">Book chapter</option>
                      <option value="preprint">Preprint</option>
                      <option value="dataset">Dataset</option>
                      <option value="dissertation">Dissertation</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Author name"
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Topic"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <input
                      type="number"
                      placeholder="Year from"
                      value={yearFrom}
                      onChange={e => setYearFrom(e.target.value)}
                      className="search-input"
                      min="1900"
                      max={new Date().getFullYear()}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      placeholder="Year to"
                      value={yearTo}
                      onChange={e => setYearTo(e.target.value)}
                      className="search-input"
                      min="1900"
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={openAccessOnly}
                    onChange={e => setOpenAccessOnly(e.target.checked)}
                  />
                  <span>Open access only</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={readableInlineOnly}
                    onChange={e => setReadableInlineOnly(e.target.checked)}
                  />
                  <span>Readable in-app (arXiv/PMC)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fullTextOnly}
                    onChange={e => setFullTextOnly(e.target.checked)}
                  />
                  <span>Full-text indexed (may be paywalled)</span>
                </label>
              </div>
            )}
          </>
        )}

        {primaryMode && (
          <>
            {/* Sources filter section */}
            <button
              type="button"
              className="filters-toggle"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              aria-expanded={sourcesOpen}
            >
              <span className="filters-toggle-arrow">{sourcesOpen ? '▾' : '▸'}</span>
              Sources
            </button>

            {sourcesOpen && (
              <div className="filters-section">
                <div className="select-all-clear">
                  <button
                    type="button"
                    onClick={() => setEnabledSources(new Set(ALL_SOURCE_NAMES))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnabledSources(new Set())}
                  >
                    Clear all
                  </button>
                </div>

                {SOURCE_GROUPS.map((group) => (
                  <div key={group.heading} className="filter-group">
                    <div className="filter-group-heading">{group.heading}</div>
                    <div className="filter-group-items">
                      {group.sources.map((sourceName) => (
                        <label key={sourceName} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={enabledSources.has(sourceName)}
                            onChange={(e) => {
                              const updated = new Set(enabledSources)
                              if (e.target.checked) {
                                updated.add(sourceName)
                              } else {
                                updated.delete(sourceName)
                              }
                              setEnabledSources(updated)
                            }}
                          />
                          <span>{sourceName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <button type="submit" className="search-button" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {!hasSearched && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <SearchIcon size={40} />
          </div>
          <h2>Start searching</h2>
          <p>Enter a query, author name, or topic to find articles</p>
        </div>
      )}

      {hasSearched &&
        !loading &&
        (primaryMode ? primarySources.length === 0 : articles.length === 0) && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <SearchX size={40} />
            </div>
            <h2>No results found</h2>
            <p>Try different search terms or adjust your filters</p>
          </div>
        )}

      {primaryMode && primarySources.length > 0 && (
        <>
          <div className="results-count">
            Showing {primarySources.length} results
          </div>
          <div className="articles-list">
            {primarySources.map(source => (
              <PrimarySourceCard key={source.id} source={source} />
            ))}
          </div>

          {canLoadMorePrimary && (
            <div className="load-more-container">
              <button className="load-more-btn" onClick={handlePrimaryLoadMore}>
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {!primaryMode && articles.length > 0 && (
        <>
          <div className="results-count">
            Showing {articles.length} of {total} results
          </div>
          <div className="articles-list">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {canLoadMore && (
            <div className="load-more-container">
              <button className="load-more-btn" onClick={handleLoadMore}>
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
