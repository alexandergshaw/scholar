import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchWorks } from '../utils/openalexApi'
import { searchPrimary } from '../utils/primaryApi'
import { Article, PrimarySource } from '../types'
import ArticleCard from '../components/ArticleCard'
import PrimarySourceCard from '../components/PrimarySourceCard'
import './Search.css'

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
  const [primaryMode, setPrimaryMode] = useState(searchParams.get('primary') === 'true')

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
        // Primary sources search
        const result = await searchPrimary(query, pageNum)

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
          <span className="toggle-text">Primary & historical sources</span>
        </label>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <input
            type="text"
            placeholder={
              primaryMode ? 'Search primary sources...' : 'Search articles...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {!primaryMode && (
          <>
            {/* Collapsible More Filters Section */}
            <button
              type="button"
              className="filters-toggle"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
            >
              <span className="filters-toggle-arrow">{filtersOpen ? '▾' : '▸'}</span>
              More filters
            </button>

            {filtersOpen && (
              <div className="filters-section">
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
                    checked={fullTextOnly}
                    onChange={e => setFullTextOnly(e.target.checked)}
                  />
                  <span>Full text available only</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={readableInlineOnly}
                    onChange={e => setReadableInlineOnly(e.target.checked)}
                  />
                  <span>Readable inline (arXiv/PMC)</span>
                </label>
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
          <div className="empty-state-icon">🔍</div>
          <h2>Start searching</h2>
          <p>Enter a query, author name, or topic to find articles</p>
        </div>
      )}

      {hasSearched &&
        !loading &&
        (primaryMode ? primarySources.length === 0 : articles.length === 0) && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
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
