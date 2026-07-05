import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Settings2, X, ExternalLink, Download, Check } from 'lucide-react'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useRecentsStore } from '../stores/recentsStore'
import { useOfflineStore } from '../stores/offlineStore'
import ReaderControls from '../components/ReaderControls'
import AskBox from '../components/AskBox'
import ListenBar from '../components/ListenBar'
import { useReaderTts } from '../hooks/useReaderTts'
import { Article, FullTextResult } from '../types'
import { getWorkById, shortIdOf } from '../utils/openalexApi'
import { fetchFullText } from '../utils/fulltextApi'
import { fetchOaExtract } from '../utils/oaExtractApi'
import { splitSentences } from '../utils/segmentText'
import './Reader.css'

export default function Reader() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [showControls, setShowControls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullText, setFullText] = useState<FullTextResult | null>(null)
  const [fullTextLoading, setFullTextLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)

  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { addRecent } = useRecentsStore()
  const { saveOffline, removeOffline } = useOfflineStore()
  const isSavedOffline = useOfflineStore(state => state.isSavedOffline)
  const tts = useReaderTts()

  // Build segments array for TTS (sentences)
  const segments = useMemo(() => {
    const segs: string[] = []
    if (fullText && fullText.available) {
      fullText.sections.forEach(section => {
        section.paragraphs.forEach(para => {
          splitSentences(para).forEach(sent => segs.push(sent))
        })
      })
    }
    return segs
  }, [fullText])

  // Load the article: first check offline store, then from persisted favorites/recents stores,
  // then fall back to fetching it directly from OpenAlex by id. The fallback makes
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

    const savedOffline = useOfflineStore.getState().getOffline(articleId)
    if (savedOffline) {
      setArticle(savedOffline.article)
      addRecent(savedOffline.article)
      return
    }

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
      // Check for saved offline copy first
      const savedOffline = useOfflineStore.getState().getOffline(article.id)
      if (savedOffline) {
        setFullText(savedOffline.fullText)
        setFullTextLoading(false)
        setExtracting(false)
        return
      }

      setFullTextLoading(true)
      setExtracting(false)
      const result = await fetchFullText(article)
      if (!cancelled) {
        setFullText(result)
        setFullTextLoading(false)

        // If unavailable but has a freeUrl, attempt inline extraction
        if (!result.available && result.freeUrl) {
          setExtracting(true)
          const extracted = await fetchOaExtract(result.freeUrl)
          if (!cancelled && extracted.available) {
            setFullText(extracted)
          }
          setExtracting(false)
        }
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
            <ArrowLeft size={18} />
            Back
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
            <ArrowLeft size={18} />
            Back
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
          <ArrowLeft size={18} />
          Back
        </button>
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

          {/* Byline and metadata */}
          <div className="reader-byline">
            {article.authors.length > 0 && (
              <span className="byline-authors">
                {article.authors.slice(0, 3).join(', ')}
                {article.authors.length > 3 ? ' et al.' : ''}
              </span>
            )}
            {article.year && (
              <>
                <span className="byline-separator">·</span>
                <span className="byline-year">{article.year}</span>
              </>
            )}
            {article.journal && article.journal !== 'Unknown Journal' && (
              <>
                <span className="byline-separator">·</span>
                <span className="byline-journal">{article.journal}</span>
              </>
            )}
          </div>

          {/* Secondary metadata */}
          {(article.doi || article.citedBy > 0) && (
            <div className="reader-meta-secondary">
              {article.doi && (
                <span className="meta-doi">
                  <a
                    href={article.doi.startsWith('http') ? article.doi : `https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    DOI: {article.doi.replace(/^https?:\/\/doi\.org\//, '')}
                  </a>
                </span>
              )}
              {article.citedBy > 0 && (
                <span className="meta-cited">Cited by {article.citedBy}</span>
              )}
            </div>
          )}

          {/* Action toolbar: favorites, offline, listen, ask, and settings */}
          <div className="reader-widgets">
            <button
              className={`favorite-btn ${isFavorite(article.id) ? 'active' : ''}`}
              onClick={() => toggleFavorite(article)}
              title={isFavorite(article.id) ? 'Saved' : 'Save article'}
            >
              <Star size={18} fill={isFavorite(article.id) ? 'currentColor' : 'none'} />
            </button>
            {(() => {
              const canSave = !!fullText && fullText.available
              const isSaved = isSavedOffline(article.id)
              const isDisabled = !canSave && !isSaved

              let title = 'No full text available to save offline'
              if (isSaved) title = 'Downloaded for offline reading & listening'
              else if (canSave) title = 'Download for offline reading & listening'

              return (
                <button
                  className={`offline-btn ${isSaved ? 'active' : ''}`}
                  onClick={() => {
                    if (isSaved) {
                      removeOffline(article.id)
                      setOfflineError(null)
                    } else if (canSave && fullText && fullText.available) {
                      const success = saveOffline(article, fullText)
                      if (!success) {
                        setOfflineError('Couldn\'t save offline — storage may be full.')
                      } else {
                        setOfflineError(null)
                      }
                    }
                  }}
                  disabled={isDisabled}
                  title={title}
                >
                  {isSaved ? <Check size={18} /> : <Download size={18} />}
                </button>
              )
            })()}
            <ListenBar segments={segments} tts={tts} articleKey={shortIdOf(article.id)} />
            <AskBox
              getContext={() => {
                const ft =
                  fullText && fullText.available
                    ? fullText.sections
                        .map(s => [s.heading, ...s.paragraphs].filter(Boolean).join('\n'))
                        .join('\n\n')
                    : article.abstract || ''
                return [article.title, ft].filter(Boolean).join('\n\n')
              }}
            />
            <button className="controls-toggle" onClick={() => setShowControls(!showControls)} title="Settings">
              <Settings2 size={18} />
            </button>
          </div>

          {/* Offline save error message */}
          {offlineError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              {offlineError}
            </div>
          )}

          {/* Full text content or abstract */}
          {(fullTextLoading || extracting) && (
            <div className="fulltext-loading">
              <p>{extracting ? 'Fetching open-access full text…' : 'Loading full text…'}</p>
            </div>
          )}

          {fullText && fullText.available && (
            <>
              <div className="fulltext-source">
                <p>Full text via {fullText.source}</p>
              </div>
              <div className="fulltext-sections">
                {(() => {
                  let globalSegIdx = 0
                  return fullText.sections.map((section, idx) => (
                    <div key={idx} className="fulltext-section">
                      {section.heading && (
                        <h2 className="section-heading">{section.heading}</h2>
                      )}
                      {section.paragraphs.map((paragraph, pidx) => (
                        <p key={pidx} className="section-paragraph">
                          {splitSentences(paragraph).map((sentence, sidx) => {
                            const segIdx = globalSegIdx
                            globalSegIdx += 1
                            return (
                              <span
                                key={sidx}
                                className={`tts-sentence${tts.currentIndex === segIdx ? ' tts-active' : ''}`}
                                onClick={() => tts.speak(segments, segIdx)}
                              >
                                {sentence}{' '}
                              </span>
                            )
                          })}
                        </p>
                      ))}
                    </div>
                  ))
                })()}
              </div>
            </>
          )}

          {!fullTextLoading && !extracting && !fullText?.available && article.abstract && (
            <div className="abstract-section">
              <h2>Abstract</h2>
              {!(fullText && fullText.freeUrl) && (
                <p className="abstract-note">
                  The full text couldn't be retrieved for this article, so only the abstract is shown. Use the link below to read it at the source.
                </p>
              )}
              <p>{article.abstract}</p>
            </div>
          )}

          {/* Inline embed of the OA copy when extraction also failed */}
          {fullText && !fullText.available && fullText.freeUrl && !extracting && (
            <div className="oa-embed-container">
              <p className="fulltext-source">Showing the open-access copy inline.</p>
              <iframe
                className="oa-embed"
                src={`/api/proxy?url=${encodeURIComponent(fullText.freeUrl)}`}
                title="Open-access full text"
              />
            </div>
          )}

          {/* Read full text button and fallback link */}
          <div className="read-full-text-container">
            {(() => {
              // Prioritize: oaUrl from article, then freeUrl from Unpaywall fallback
              const freeUrl = article.oaUrl || (fullText && !fullText.available ? fullText.freeUrl : undefined)
              if (freeUrl) {
                return (
                  <a
                    href={freeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="read-full-text-btn"
                  >
                    <ExternalLink size={16} />
                    Read free full text
                  </a>
                )
              } else if (article.doi) {
                return (
                  <a
                    href={`https://doi.org/${article.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="read-full-text-btn"
                  >
                    <ExternalLink size={16} />
                    View at publisher
                  </a>
                )
              } else {
                return <p className="no-full-text">Full text not available</p>
              }
            })()}
          </div>
        </article>
      </div>

      {/* Bottom sheet with controls */}
      {showControls && (
        <>
          <div className="controls-overlay" onClick={() => setShowControls(false)} />
          <div className="controls-sheet">
            <div className="controls-header">
              <h3>Reading Settings</h3>
              <button className="close-controls" onClick={() => setShowControls(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <ReaderControls />
          </div>
        </>
      )}
    </div>
  )
}
