import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import ReaderControls from '../components/ReaderControls'
import { FullTextResult } from '../types'
import { fetchPrimaryText } from '../utils/primaryTextApi'
import './Reader.css'

export default function PrimaryReader() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const src = searchParams.get('src')
  const title = searchParams.get('title')
  const source = searchParams.get('source')

  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore()

  const [primaryText, setPrimaryText] = useState<FullTextResult | null>(null)
  const [primaryTextLoading, setPrimaryTextLoading] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load primary text on mount
  useEffect(() => {
    if (!src) {
      setError('No source ID provided')
      return
    }

    setError(null)
    setPrimaryText(null)
    setPrimaryTextLoading(true)

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
            ← Back
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
          ← Back
        </button>
        <div className="header-actions">
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
          {title && <h1 className="article-title">{title}</h1>}

          {/* Source metadata */}
          {source && (
            <div className="article-metadata">
              <p className="metadata-row">
                <strong>Source:</strong> {source}
              </p>
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
                {primaryText.sections.map((section, idx) => (
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
