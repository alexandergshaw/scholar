import { useState } from 'react'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useRecentsStore } from '../stores/recentsStore'
import './Settings.css'

export default function Settings() {
  const { fontSize, fontFamily, lineSpacing, theme, setFontSize, setFontFamily, setLineSpacing, setTheme } = useReaderSettingsStore()
  const { clearFavorites } = useFavoritesStore()
  const { clearRecents } = useRecentsStore()
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearData = () => {
    clearFavorites()
    clearRecents()
    setShowClearConfirm(false)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-container">
        {/* Default reading preferences */}
        <section className="settings-section">
          <h2 className="section-title">Default reading preferences</h2>

          <div className="settings-group">
            <label className="setting-label">Text size</label>
            <div className="setting-buttons">
              {[1, 2, 3, 4, 5].map(size => (
                <button
                  key={size}
                  className={`size-btn ${fontSize === size ? 'active' : ''}`}
                  onClick={() => setFontSize(size)}
                  style={{ fontSize: `${0.75 + size * 0.15}rem` }}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          <div className="settings-group">
            <label className="setting-label">Font</label>
            <div className="setting-buttons">
              <button
                className={`btn ${fontFamily === 'serif' ? 'active' : ''}`}
                onClick={() => setFontFamily('serif')}
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Serif
              </button>
              <button
                className={`btn ${fontFamily === 'sans' ? 'active' : ''}`}
                onClick={() => setFontFamily('sans')}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Sans
              </button>
            </div>
          </div>

          <div className="settings-group">
            <label className="setting-label">Line spacing</label>
            <div className="setting-buttons">
              {[1, 1.5, 2].map(spacing => (
                <button
                  key={spacing}
                  className={`btn ${lineSpacing === spacing ? 'active' : ''}`}
                  onClick={() => setLineSpacing(spacing)}
                >
                  {spacing}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-group">
            <label className="setting-label">Theme</label>
            <div className="setting-buttons">
              <button
                className={`btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                title="Light"
              >
                ☀ Light
              </button>
              <button
                className={`btn ${theme === 'sepia' ? 'active' : ''}`}
                onClick={() => setTheme('sepia')}
                title="Sepia"
              >
                📄 Sepia
              </button>
              <button
                className={`btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Dark"
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="settings-section danger-zone">
          <h2 className="section-title">Data</h2>

          <div className="settings-group">
            <label className="setting-label">Clear all data</label>
            <p className="setting-description">Delete all saved articles, sources, and reading history.</p>
            {!showClearConfirm ? (
              <button className="danger-btn" onClick={() => setShowClearConfirm(true)}>
                Clear data
              </button>
            ) : (
              <div className="confirm-actions">
                <p className="confirm-text">Are you sure? This cannot be undone.</p>
                <div className="action-buttons">
                  <button className="btn confirm-btn" onClick={handleClearData}>
                    Yes, clear everything
                  </button>
                  <button className="btn cancel-btn" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* About */}
        <section className="settings-section about">
          <h2 className="section-title">About</h2>
          <div className="about-content">
            <p>
              <strong>Scholar</strong> is a mobile-first e-reader for open-access scholarly articles.
            </p>
            <p>
              Articles are sourced from{' '}
              <a href="https://openalex.org" target="_blank" rel="noopener noreferrer">
                OpenAlex
              </a>
              , a free and open catalog of academic knowledge.
            </p>
            <p className="version-info">Version 0.0.1</p>
          </div>
        </section>
      </div>
    </div>
  )
}
