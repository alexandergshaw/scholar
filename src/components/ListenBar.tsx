import { useState } from 'react'
import { useTts } from '../hooks/useTts'
import { useCloudTts, CURATED_CLOUD_VOICES } from '../hooks/useCloudTts'
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
  const { speaking: cloudSpeaking, paused: cloudPaused, loading: cloudLoading, error: cloudError, speak: cloudSpeak, pause: cloudPause, resume: cloudResume, stop: cloudStop } = useCloudTts()
  const { voiceURI, rate, pitch, engine, cloudVoice, setVoiceURI, setRate, setPitch, setEngine, setCloudVoice } = useTtsSettingsStore()
  const [showSettings, setShowSettings] = useState(false)

  if (!supported) {
    return null
  }

  // Use active engine's state and controls
  const isActive = engine === 'device'
  const activeSpeaking = isActive ? speaking : cloudSpeaking
  const activePaused = isActive ? paused : cloudPaused
  const activeLoading = isActive ? false : cloudLoading
  const activeError = isActive ? null : cloudError

  const handleListen = () => {
    const text = getText()
    if (text) {
      if (engine === 'device') {
        speak(text)
      } else {
        cloudSpeak(text)
      }
    }
  }

  const togglePlayPause = () => {
    if (engine === 'device') {
      if (paused) {
        resume()
      } else {
        pause()
      }
    } else {
      if (cloudPaused) {
        cloudResume()
      } else {
        cloudPause()
      }
    }
  }

  const handleStop = () => {
    if (engine === 'device') {
      stop()
    } else {
      cloudStop()
    }
  }

  // Partition voices into natural and other
  const naturalVoices = sortedVoices.filter(v => naturalnessRank(v) >= 70)
  const otherVoices = sortedVoices.filter(v => naturalnessRank(v) < 70)

  return (
    <div className="listen-bar">
      <div className="listen-controls">
        {activeLoading ? (
          <button className="listen-button" disabled title="Preparing audio...">
            ⏳ Preparing...
          </button>
        ) : !activeSpeaking ? (
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
              title={activePaused ? 'Resume' : 'Pause'}
            >
              {activePaused ? '▶' : '⏸'} {activePaused ? 'Resume' : 'Pause'}
            </button>
            <button
              className="listen-button stop"
              onClick={handleStop}
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
          {activeError && (
            <div className="ask-error" style={{ marginBottom: '12px', fontSize: '0.9em' }}>
              {activeError}
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
              sortedVoices.length > 0 ? (
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
              )
            ) : (
              <select
                className="voice-select"
                value={cloudVoice}
                onChange={(e) => setCloudVoice(e.target.value)}
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
        </div>
      )}
    </div>
  )
}
