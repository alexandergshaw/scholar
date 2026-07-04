import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useRecentsStore } from '../stores/recentsStore'
import ReaderControls from '../components/ReaderControls'
import { Article, FullTextResult } from '../types'
import { getWorkById, shortIdOf } from '../utils/openalexApi'
import { fetchFullText } from '../utils/fulltextApi'
import './Reader.css'

export default function Reader() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [showControls, setShowControls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullText, setFullText] = useState<FullTextResult | null>(null)
  const [fullTextLoading, setFullTextLoading] = useState(false)

  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { addRecent } = useRecentsStore()

  // Load the article: first from the persisted favorites/recents stores, then
  // fall back to fetching it directly from OpenAlex by id. The fallback makes
  // reading work for fresh search results and survives a page reload / deep link.
  useEffect(() => {
    if (!articleId) {
      setError('No article found')
      return
    }

    setError(null)
    setArticle(null)
    setFullText(null)
    setFullTextLoading(false)

    const favorites = useFavoritesStore.getState().favorites
    const recents = useRecentsStore.getState().recents
    const matches = (a: Article) => shortIdOf(a.id) === articleId

    const cached = favorites.find(matches) || recents.find(matches)
    if (cached) {
      setArticle(cached)
      addRecent(cached)
      return
    }

    let cancelled = false
    getWorkById(articleId)
      .then(fetched => {
        if (cancelled) return
        setArticle(fetched)
        addRecent(fetched)
      })
      .catch(() => {
        if (!cancelled) setError('Article not found. Please search or browse to find articles.')
      })

    return () => {
      cancelled = true
    }
  }, [articleId, addRecent])

  // Load full text once the article is loaded
  useEffect(() => {
    if (!article) return

    let cancelled = false

    const loadFullText = async () => {
      setFullTextLoading(true)
      const result = await fetchFullText(article)
      if (!cancelled) {
        setFullText(result)
        setFullTextLoading(false)
      }
    }

    loadFullText()

    return () => {
      cancelled = true
    }
  }, [article?.id])

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
        <div className="error-message">{error}</div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="page-content">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </div>
    )
  }

  const fontSizeValue = [0.85, 1, 1.15, 1.3, 1.45][fontSize - 1] || 1
  const lineHeightValue = lineSpacing

  return (
    <div className="reader-page">
      {/* Top bar with back button */}
      <div className="reader-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="header-actions">
          <button
            className={`favorite-btn ${isFavorite(article.id) ? 'active' : ''}`}
            onClick={() => toggleFavorite(article)}
            title={isFavorite(article.id) ? 'Saved' : 'Save article'}
          >
            ★
          </button>
          <button className="controls-toggle" onClick={() => setShowControls(!showControls)}>
            ⚙
          </button>
        </div>
      </div>

      {/* Reading content */}
      <div className="reader-content">
        <article
          className="reading-pane"
          style={{
            fontSize: `${fontSizeValue}rem`,
            lineHeight: lineHeightValue,
            fontFamily: fontFamily === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)'
          }}
        >
          <h1 className="article-title">{article.title}</h1>

          {/* Metadata block */}
          <div className="article-metadata">
            {article.authors.length > 0 && (
              <p className="metadata-row">
                <strong>Authors:</strong> {article.authors.join(', ')}
              </p>
            )}
            <p className="metadata-row">
              <strong>Year:</strong> {article.year}
            </p>
            {article.journal && (
              <p className="metadata-row">
                <strong>Journal:</strong> {article.journal}
              </p>
            )}
            {article.doi && (
              <p className="metadata-row">
                <strong>DOI:</strong>{' '}
                <a
                  href={article.doi.startsWith('http') ? article.doi : `https://doi.org/${article.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {article.doi.replace(/^https?:\/\/doi\.org\//, '')}
                </a>
              </p>
            )}
            {article.citedBy > 0 && (
              <p className="metadata-row">
                <strong>Cited by:</strong> {article.citedBy}
              </p>
            )}
          </div>

          {/* Full text content or abstract */}
          {fullTextLoading && (
            <div className="fulltext-loading">
              <p>Loading full text…</p>
            </div>
          )}

          {fullText && fullText.available && (
            <>
              <div className="fulltext-source">
                <p>Full text via {fullText.source}</p>
              </div>
              <div className="fulltext-sections">
                {fullText.sections.map((section, idx) => (
                  <div key={idx} className="fulltext-section">
                    {section.heading && (
                      <h2 className="section-heading">{section.heading}</h2>
                    )}
                    {section.paragraphs.map((paragraph, pidx) => (
                      <p key={pidx} className="section-paragraph">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {!fullTextLoading && !fullText?.available && article.abstract && (
            <div className="abstract-section">
              <h2>Abstract</h2>
              <p>{article.abstract}</p>
            </div>
          )}

          {/* Read full text button and fallback link */}
          {article.oaUrl ? (
            <div className="read-full-text-container">
              <a
                href={article.oaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="read-full-text-btn"
              >
                Read full text (external)
              </a>
            </div>
          ) : (
            <div className="read-full-text-container">
              <p className="no-full-text">Full text not available</p>
            </div>
          )}
        </article>
      </div>

      {/* Bottom sheet with controls */}
      {showControls && (
        <>
          <div className="controls-overlay" onClick={() => setShowControls(false)} />
          <div className="controls-sheet">
            <div className="controls-header">
              <h3>Reading Settings</h3>
              <button className="close-controls" onClick={() => setShowControls(false)}>
                ✕
              </button>
            </div>
            <ReaderControls />
          </div>
        </>
      )}
    </div>
  )
}
