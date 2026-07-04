import { useState } from 'react'
import { useTts } from '../hooks/useTts'
import { useTtsSettingsStore } from '../stores/ttsSettingsStore'
import './ListenBar.css'

interface ListenBarProps {
  getText: () => string
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

export default function ListenBar({ getText }: ListenBarProps) {
  const { supported, sortedVoices, speaking, paused, speak, pause, resume, stop } = useTts()
  const { voiceURI, rate, pitch, setVoiceURI, setRate, setPitch } = useTtsSettingsStore()
  const [showSettings, setShowSettings] = useState(false)

  if (!supported) {
    return null
  }

  const handleListen = () => {
    const text = getText()
    if (text) {
      speak(text)
    }
  }

  const togglePlayPause = () => {
    if (paused) {
      resume()
    } else {
      pause()
    }
  }

  // Partition voices into natural and other
  const naturalVoices = sortedVoices.filter(v => naturalnessRank(v) >= 70)
  const otherVoices = sortedVoices.filter(v => naturalnessRank(v) < 70)

  return (
    <div className="listen-bar">
      <div className="listen-controls">
        {!speaking ? (
          <button
            className="listen-button"
            onClick={handleListen}
            title="Read aloud"
          >
            🔊 Listen
          </button>
        ) : (
          <>
            <button
              className="listen-button playing"
              onClick={togglePlayPause}
              title={paused ? 'Resume' : 'Pause'}
            >
              {paused ? '▶' : '⏸'} {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              className="listen-button stop"
              onClick={stop}
              title="Stop"
            >
              ⏹ Stop
            </button>
          </>
        )}
      </div>

      <button
        className="voice-settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        title="Voice settings"
      >
        ⚙
      </button>

      {showSettings && (
        <div className="voice-settings-panel">
          <div className="settings-section">
            <label className="settings-label">Voice</label>
            {sortedVoices.length > 0 ? (
              <select
                className="voice-select"
                value={voiceURI || ''}
                onChange={(e) => setVoiceURI(e.target.value || null)}
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
        </div>
      )}
    </div>
  )
}
