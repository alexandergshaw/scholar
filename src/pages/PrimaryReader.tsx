import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Settings2, X, Download, Check, FileDown } from 'lucide-react'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import { useOfflineStore } from '../stores/offlineStore'
import ReaderControls from '../components/ReaderControls'
import AskBox from '../components/AskBox'
import ListenBar from '../components/ListenBar'
import { useReaderTts } from '../hooks/useReaderTts'
import { FullTextResult } from '../types'
import { fetchPrimaryText } from '../utils/primaryTextApi'
import { splitSentences } from '../utils/segmentText'
import { sectionsToPlainText, downloadTextFile, safeFilename } from '../utils/downloadText'
import './Reader.css'

export default function PrimaryReader() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const src = searchParams.get('src')
  const title = searchParams.get('title')
  const source = searchParams.get('source')

  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore()
  const { savePrimaryOffline, removePrimaryOffline, isPrimaryOffline } = useOfflineStore()

  const [primaryText, setPrimaryText] = useState<FullTextResult | null>(null)
  const [primaryTextLoading, setPrimaryTextLoading] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const tts = useReaderTts()

  // Build segments array for TTS (sentences)
  const segments = useMemo(() => {
    const segs: string[] = []
    if (primaryText && primaryText.available) {
      primaryText.sections.forEach(section => {
        section.paragraphs.forEach(para => {
          splitSentences(para).forEach(sent => segs.push(sent))
        })
      })
    }
    return segs
  }, [primaryText])

  // Load primary text on mount
  useEffect(() => {
    if (!src) {
      setError('No source ID provided')
      return
    }

    setError(null)
    setPrimaryText(null)
    setPrimaryTextLoading(true)

    // Check offline store first
    const savedOffline = useOfflineStore.getState().getPrimaryOffline(src)
    if (savedOffline) {
      setPrimaryText(savedOffline.fullText)
      setPrimaryTextLoading(false)
      return
    }

    const loadPrimaryText = async () => {
      const result = await fetchPrimaryText(src)
      setPrimaryText(result)
      setPrimaryTextLoading(false)
    }

    loadPrimaryText()
  }, [src])

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
          {title && <h1 className="article-title">{title}</h1>}

          {/* Source metadata */}
          {source && (
            <div className="article-metadata">
              <p className="metadata-row">
                <strong>Source:</strong> {source}
              </p>
            </div>
          )}

          {/* Action toolbar: listen, ask, and settings */}
          <div className="reader-widgets">
            {(() => {
              const canSave = !!primaryText && primaryText.available
              const isSaved = src ? isPrimaryOffline(src) : false
              const isDisabled = !canSave && !isSaved

              let btnTitle = 'No full text available to save offline'
              if (isSaved) btnTitle = 'Downloaded for offline reading & listening'
              else if (canSave) btnTitle = 'Download for offline reading & listening'

              return src ? (
                <button
                  className={`offline-btn ${isSaved ? 'active' : ''}`}
                  onClick={() => {
                    if (isSaved) {
                      removePrimaryOffline(src)
                      setOfflineError(null)
                    } else if (canSave && primaryText && primaryText.available) {
                      const success = savePrimaryOffline(src, title || '', source || '', primaryText)
                      if (!success) {
                        setOfflineError('Couldn\'t save offline — storage may be full.')
                      } else {
                        setOfflineError(null)
                      }
                    }
                  }}
                  disabled={isDisabled}
                  title={btnTitle}
                >
                  {isSaved ? <Check size={18} /> : <Download size={18} />}
                </button>
              ) : null
            })()}
            {primaryText && primaryText.available && (
              <button
                className="offline-btn"
                onClick={() => {
                  if (primaryText && primaryText.available) {
                    downloadTextFile(safeFilename(title || 'document'), sectionsToPlainText(title || '', primaryText.sections))
                  }
                }}
                title="Download as text file (.txt)"
              >
                <FileDown size={18} />
              </button>
            )}
            <ListenBar segments={segments} tts={tts} articleKey={src || title || 'primary'} />
            <AskBox
              getContext={() => {
                const ft =
                  primaryText && primaryText.available
                    ? primaryText.sections
                        .map(s => [s.heading, ...s.paragraphs].filter(Boolean).join('\n'))
                        .join('\n\n')
                    : ''
                return [title, ft].filter(Boolean).join('\n\n')
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

          {/* Loading state */}
          {primaryTextLoading && (
            <div className="fulltext-loading">
              <p>Loading full text…</p>
            </div>
          )}

          {/* Available text */}
          {primaryText && primaryText.available && (
            <>
              <div className="fulltext-source">
                <p>Full text via {primaryText.source}</p>
              </div>
              <div className="fulltext-sections">
                {(() => {
                  let globalSegIdx = 0
                  return primaryText.sections.map((section, idx) => (
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

          {/* Not available message */}
          {!primaryTextLoading && !primaryText?.available && (
            <div className="error-section">
              <p>Full text couldn't be loaded for this source. Please visit the source directly.</p>
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
