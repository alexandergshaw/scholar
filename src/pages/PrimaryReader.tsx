import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Settings2, X } from 'lucide-react'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import ReaderControls from '../components/ReaderControls'
import AskBox from '../components/AskBox'
import ListenBar from '../components/ListenBar'
import { useReaderTts } from '../hooks/useReaderTts'
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
  const tts = useReaderTts()

  // Build segments array for TTS
  const segments = useMemo(() => {
    const segs: string[] = []
    if (primaryText && primaryText.available) {
      primaryText.sections.forEach(section => {
        section.paragraphs.forEach(para => {
          segs.push(para)
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
            <ListenBar segments={segments} tts={tts} />
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
                      {section.paragraphs.map((paragraph, pidx) => {
                        const segIdx = globalSegIdx
                        globalSegIdx += 1
                        return (
                          <p
                            key={pidx}
                            className={`section-paragraph${tts.currentIndex === segIdx ? ' tts-active' : ''}`}
                            onClick={() => tts.speak(segments, segIdx)}
                            style={{ cursor: 'pointer' }}
                          >
                            {paragraph}
                          </p>
                        )
                      })}
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
