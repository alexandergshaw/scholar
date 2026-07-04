import { PrimarySource } from '../types'
import './PrimarySourceCard.css'

interface PrimarySourceCardProps {
  source: PrimarySource
}

export default function PrimarySourceCard({ source }: PrimarySourceCardProps) {
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
      </div>
      <a
        className="primary-read-link"
        href={source.readUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Read ${source.title}`}
      >
        Read →
      </a>
    </div>
  )
}
