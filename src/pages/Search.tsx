import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchWorks } from '../utils/openalexApi'
import { Article } from '../types'
import ArticleCard from '../components/ArticleCard'
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

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = async (pageNum: number = 1) => {
    const hasQuery = query || author || authorId || topic

    if (!hasQuery) {
      setError(null)
      setHasSearched(false)
      setArticles([])
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const result = await searchWorks({
        query: query || undefined,
        author: author || undefined,
        authorId: authorId || undefined,
        topic: topic || undefined,
        yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
        yearTo: yearTo ? parseInt(yearTo) : undefined,
        openAccessOnly,
        fullTextOnly,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search articles')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    performSearch(1)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(1)
  }

  const handleLoadMore = () => {
    performSearch(page + 1)
  }

  const canLoadMore = articles.length < total && !loading

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Search</h1>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Search articles..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
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
            checked={fullTextOnly}
            onChange={e => setFullTextOnly(e.target.checked)}
          />
          <span>Full text available only</span>
        </label>

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

      {hasSearched && articles.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h2>No results found</h2>
          <p>Try different search terms or adjust your filters</p>
        </div>
      )}

      {articles.length > 0 && (
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
