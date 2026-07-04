import { useState } from 'react'
import { askAboutText } from '../utils/askApi'
import './AskBox.css'

interface AskBoxProps {
  getContext: () => string
  compact?: boolean
}

export default function AskBox({ getContext, compact = false }: AskBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ answer?: string; error?: string; configured?: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Do nothing if question is empty
    if (!question.trim()) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const context = getContext()
      const askResult = await askAboutText(question, context)
      setResult(askResult)
    } finally {
      setLoading(false)
    }
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className={`ask-box ${compact ? 'compact' : ''}`} onClick={handleContainerClick}>
      <button
        className="ask-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Ask about this document"
      >
        Ask about this ✨
      </button>

      {isOpen && (
        <div className="ask-panel">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              className="ask-input"
              placeholder="Ask a question about this…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="ask-submit"
              disabled={loading || !question.trim()}
            >
              {loading ? 'Asking…' : 'Ask'}
            </button>
          </form>

          {loading && (
            <div className="ask-loading">
              <p>Thinking…</p>
            </div>
          )}

          {result && result.answer && (
            <div className="ask-answer">
              <p>{result.answer}</p>
            </div>
          )}

          {result && result.error && (
            <div className="ask-error">
              <p>{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
