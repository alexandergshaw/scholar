import { useNavigate } from 'react-router-dom'
import { PrimarySource } from '../types'
import AskBox from './AskBox'
import './PrimarySourceCard.css'

interface PrimarySourceCardProps {
  source: PrimarySource
}

export default function PrimarySourceCard({ source }: PrimarySourceCardProps) {
  const navigate = useNavigate()

  const handleReadInline = () => {
    const params = new URLSearchParams()
    params.append('src', source.id)
    params.append('title', source.title)
    params.append('source', source.sourceName)
    navigate(`/read/primary?${params.toString()}`)
  }

  return (
    <div className="primary-card">
      <div className="primary-card-content">
        <h3 className="primary-title">{source.title}</h3>
        <div className="primary-meta">
          {source.creator && <span className="primary-creator">{source.creator}</span>}
          {source.date && <span className="primary-date">{source.date}</span>}
        </div>
        <span className={`source-badge source-${source.sourceName.toLowerCase().replace(/ /g, '-')}`}>
          {source.sourceName}
        </span>
        {source.snippet && <p className="primary-snippet">{source.snippet}</p>}
        <AskBox
          compact
          getContext={() =>
            [source.title, source.creator, source.sourceName, source.snippet]
              .filter(Boolean)
              .join('\n')
          }
        />
      </div>
      <div className="primary-actions">
        <button className="primary-read-link primary-inline" onClick={handleReadInline}>
          Read inline
        </button>
        <a
          className="primary-read-link primary-external"
          href={source.readUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${source.title} in new tab`}
        >
          Source ↗
        </a>
      </div>
    </div>
  )
}
