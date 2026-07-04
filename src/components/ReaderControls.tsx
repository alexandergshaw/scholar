import { Sun, BookOpen, Moon } from 'lucide-react'
import { useReaderSettingsStore } from '../stores/readerSettingsStore'
import './ReaderControls.css'

export default function ReaderControls() {
  const {
    fontSize,
    fontFamily,
    lineSpacing,
    theme,
    setFontSize,
    setFontFamily,
    setLineSpacing,
    setTheme
  } = useReaderSettingsStore()

  const fontSizes = [1, 2, 3, 4, 5]
  const lineSpacings = [1, 1.5, 2]

  return (
    <div className="reader-controls">
      {/* Font Size */}
      <div className="control-group">
        <label className="control-label">Text size</label>
        <div className="control-buttons">
          {fontSizes.map(size => (
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

      {/* Font Family */}
      <div className="control-group">
        <label className="control-label">Font</label>
        <div className="control-buttons">
          <button
            className={`font-btn ${fontFamily === 'serif' ? 'active' : ''}`}
            onClick={() => setFontFamily('serif')}
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Serif
          </button>
          <button
            className={`font-btn ${fontFamily === 'sans' ? 'active' : ''}`}
            onClick={() => setFontFamily('sans')}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Sans
          </button>
        </div>
      </div>

      {/* Line Spacing */}
      <div className="control-group">
        <label className="control-label">Line spacing</label>
        <div className="control-buttons">
          {lineSpacings.map(spacing => (
            <button
              key={spacing}
              className={`spacing-btn ${lineSpacing === spacing ? 'active' : ''}`}
              onClick={() => setLineSpacing(spacing)}
            >
              {spacing}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="control-group">
        <label className="control-label">Theme</label>
        <div className="control-buttons">
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light"
          >
            <Sun size={18} />
          </button>
          <button
            className={`theme-btn ${theme === 'sepia' ? 'active' : ''}`}
            onClick={() => setTheme('sepia')}
            title="Sepia"
          >
            <BookOpen size={18} />
          </button>
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark"
          >
            <Moon size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
