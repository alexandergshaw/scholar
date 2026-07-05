import { useState, useRef, useEffect } from 'react'
import { Volume2, Play, Pause, Square, Loader2, SlidersHorizontal, SkipBack, SkipForward, Bookmark, BookmarkCheck, Download, X } from 'lucide-react'
import { CURATED_CLOUD_VOICES } from '../hooks/useCloudTts'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'
import { useTts } from '../hooks/useTts'
import { useBookmarksStore } from '../stores/bookmarksStore'
import { cacheAllSegments, cachedCount as getCachedCount, clearCachedAudio } from '../utils/audioCache'
import type { useReaderTts } from '../hooks/useReaderTts'
import './ListenBar.css'

interface ListenBarProps {
  segments: string[]
  tts: ReturnType<typeof useReaderTts>
  articleKey: string
}

// Helper to rank voice naturalness (mirrors the one in useTts.ts)
function naturalnessRank(voice: SpeechSynthesisVoice): number {
  const nameLower = voice.name.toLowerCase()

  if (nameLower.includes('natural') || nameLower.includes('neural')) {
    return 105
  }
  if (nameLower.includes('online')) {
    return 95
  }
  if (nameLower.includes('google')) {
    return 85
  }

  const naturalNames = ['aria', 'jenny', 'michelle', 'ava', 'samantha', 'serena', 'sonia', 'libby', 'emma', 'siri', 'allison', 'joanna', 'matthew']
  let baseRank = 10
  if (naturalNames.some(n => nameLower.includes(n))) {
    baseRank = 75
  }

  // Add 5 if language starts with "en"
  if (voice.lang.startsWith('en')) {
    baseRank += 5
  }

  return baseRank
}

export default function ListenBar({ segments, tts, articleKey }: ListenBarProps) {
  const { voiceURI, rate, pitch, engine, cloudVoice, setVoiceURI, setRate, setPitch, setEngine, setCloudVoice } = useTtsSettingsStore()
  const deviceSortedVoices = useTts().sortedVoices
  const [showSettings, setShowSettings] = useState(false)
  const { bookmarks, setBookmark } = useBookmarksStore()
  const bookmarkIndex = bookmarks[articleKey]
  const [caching, setCaching] = useState(false)
  const [cachedProgress, setCachedProgress] = useState(0)
  const [cachedTotal, setCachedTotal] = useState(0)
  const [cachedCount, setCachedCountLocal] = useState(0)
  const [cacheError, setCacheError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  // Load cached count on mount and when engine/voice changes
  useEffect(() => {
    if (engine === 'cloud' && showSettings) {
      getCachedCount(articleKey, cloudVoice).then((count: number) => setCachedCountLocal(count))
    }
  }, [engine, cloudVoice, showSettings, articleKey])

  // Handle device voice change
  const handleDeviceVoiceChange = (newVoiceURI: string | null) => {
    setVoiceURI(newVoiceURI)
    tts.changeVoice(newVoiceURI)
  }

  // Handle cloud voice change
  const handleCloudVoiceChange = (newVoiceId: string) => {
    setCloudVoice(newVoiceId)
    tts.changeVoice(newVoiceId)
  }

  const handleCacheAllSegments = async () => {
    setCaching(true)
    setCacheError(null)
    cancelRef.current = false
    setCachedProgress(0)

    const cloudVoiceInfo = CURATED_CLOUD_VOICES.find(v => v.id === cloudVoice) || CURATED_CLOUD_VOICES[0]
    const pitchMapped = (pitch - 1) * 10

    const result = await cacheAllSegments(
      articleKey,
      cloudVoice,
      cloudVoiceInfo.languageCode,
      rate,
      pitchMapped,
      segments,
      (done, total) => {
        setCachedProgress(done)
        setCachedTotal(total)
      },
      () => cancelRef.current
    )

    setCaching(false)
    if (result.ok) {
      setCachedCountLocal(result.cached)
      setCachedProgress(0)
      setCachedTotal(0)
    } else {
      setCacheError(result.error || 'Unknown error')
    }
  }

  const handleClearCache = async () => {
    await clearCachedAudio(articleKey)
    setCachedCountLocal(0)
  }

  if (!tts.supported) {
    return null
  }

  const handleListen = () => {
    if (segments.length > 0) {
      tts.speak(segments, 0)
    }
  }

  const togglePlayPause = () => {
    if (tts.paused) {
      tts.resume()
    } else {
      tts.pause()
    }
  }

  const handleStop = () => {
    tts.stop()
  }

  const handleBookmark = () => {
    if (tts.currentIndex >= 0) {
      setBookmark(articleKey, tts.currentIndex)
    }
  }

  const handleResume = () => {
    if (bookmarkIndex !== undefined) {
      tts.speak(segments, bookmarkIndex)
    }
  }

  // Partition voices into natural and other
  const naturalVoices = deviceSortedVoices.filter(v => naturalnessRank(v) >= 70)
  const otherVoices = deviceSortedVoices.filter(v => naturalnessRank(v) < 70)

  return (
    <div className="listen-bar">
      <div className="listen-controls">
        {tts.loading ? (
          <button className="listen-button" disabled title="Preparing audio...">
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Preparing...
          </button>
        ) : !tts.speaking && bookmarkIndex !== undefined ? (
          <>
            <button
              className="listen-button"
              onClick={handleResume}
              title="Resume from bookmark"
            >
              <Bookmark size={18} />
              Resume
            </button>
            <button
              className="listen-button"
              onClick={handleListen}
              title="Read from beginning"
            >
              <Volume2 size={18} />
              Listen
            </button>
          </>
        ) : !tts.speaking ? (
          <button
            className="listen-button"
            onClick={handleListen}
            title="Read aloud"
          >
            <Volume2 size={18} />
            Listen
          </button>
        ) : (
          <>
            <button
              className="listen-button"
              onClick={tts.prev}
              disabled={tts.currentIndex <= 0}
              title="Previous sentence"
            >
              <SkipBack size={18} />
            </button>
            <button
              className="listen-button playing"
              onClick={togglePlayPause}
              title={tts.paused ? 'Resume' : 'Pause'}
            >
              {tts.paused ? <Play size={18} /> : <Pause size={18} />}
              {tts.paused ? 'Resume' : 'Pause'}
            </button>
            <button
              className="listen-button"
              onClick={tts.next}
              disabled={tts.currentIndex >= segments.length - 1}
              title="Next sentence"
            >
              <SkipForward size={18} />
            </button>
            <button
              className="listen-button stop"
              onClick={handleStop}
              title="Stop"
            >
              <Square size={18} />
              Stop
            </button>
            <button
              className="listen-button bookmark"
              onClick={handleBookmark}
              disabled={tts.currentIndex < 0}
              title={bookmarkIndex !== undefined ? 'Update bookmark' : 'Bookmark this spot'}
            >
              {bookmarkIndex !== undefined ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
          </>
        )}
      </div>

      <button
        className="voice-settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        title="Voice settings"
      >
        <SlidersHorizontal size={18} />
      </button>

      {showSettings && (
        <div className="voice-settings-panel">
          {tts.error && (
            <div className="ask-error" style={{ marginBottom: '12px', fontSize: '0.9em' }}>
              {tts.error}
            </div>
          )}

          <div className="settings-section">
            <label className="settings-label">Engine</label>
            <div className="tts-engine-toggle">
              <button
                className={`tts-engine-btn${engine === 'device' ? ' active' : ''}`}
                onClick={() => setEngine('device')}
              >
                Device
              </button>
              <button
                className={`tts-engine-btn${engine === 'cloud' ? ' active' : ''}`}
                onClick={() => setEngine('cloud')}
              >
                Natural (cloud)
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label">{engine === 'device' ? 'Voice' : 'Natural Voice'}</label>
            {engine === 'device' ? (
              deviceSortedVoices.length > 0 ? (
                <select
                  className="voice-select"
                  value={voiceURI || ''}
                  onChange={(e) => handleDeviceVoiceChange(e.target.value || null)}
                >
                  <option value="">System default</option>
                  {naturalVoices.length > 0 && (
                    <optgroup label="Natural voices">
                      {naturalVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherVoices.length > 0 && (
                    <optgroup label="Other voices">
                      {otherVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <p className="no-voices-message">No voices available on this device</p>
              )
            ) : (
              <select
                className="voice-select"
                value={cloudVoice}
                onChange={(e) => handleCloudVoiceChange(e.target.value)}
              >
                {CURATED_CLOUD_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="settings-section">
            <label className="settings-label">
              Speed: {rate.toFixed(1)}x
            </label>
            <input
              type="range"
              className="settings-range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
            />
          </div>

          <div className="settings-section">
            <label className="settings-label">
              Pitch: {pitch.toFixed(1)}
            </label>
            <input
              type="range"
              className="settings-range"
              min="0"
              max="2"
              step="0.1"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
            />
          </div>

          {engine === 'cloud' && (
            <div className="settings-section cache-section">
              <label className="settings-label">Download voice audio for offline</label>
              <p className="cache-note">Uses the cloud voice API to generate audio (one request per sentence); lets you listen offline with the natural voice.</p>
              {cacheError && (
                <div className="ask-error" style={{ marginBottom: '12px', fontSize: '0.9em' }}>
                  {cacheError}
                </div>
              )}
              {caching ? (
                <div className="cache-progress">
                  <div className="cache-progress-text">
                    Caching audio… {cachedProgress}/{cachedTotal}
                  </div>
                  <div className="cache-progress-bar">
                    <div
                      className="cache-progress-fill"
                      style={{ width: `${cachedTotal > 0 ? (cachedProgress / cachedTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <button
                    className="cache-button cancel"
                    onClick={() => {
                      cancelRef.current = true
                    }}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              ) : cachedCount > 0 && cachedCount === segments.length ? (
                <div className="cache-status">
                  <p className="cache-status-text">Downloaded for offline (cloud voice): {cachedCount}/{segments.length}</p>
                  <button className="cache-button clear" onClick={handleClearCache}>
                    Clear
                  </button>
                </div>
              ) : (
                <div className="cache-action">
                  {cachedCount > 0 && (
                    <p className="cache-status-text">Cached: {cachedCount}/{segments.length}</p>
                  )}
                  <div className="cache-buttons">
                    <button
                      className="cache-button download"
                      onClick={handleCacheAllSegments}
                      disabled={segments.length === 0 || caching}
                    >
                      <Download size={16} />
                      Download all
                    </button>
                    {cachedCount > 0 && (
                      <button className="cache-button clear" onClick={handleClearCache} disabled={caching}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
