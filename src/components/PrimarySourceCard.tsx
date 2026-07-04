import { useNavigate } from 'react-router-dom'
import { Star, ExternalLink, BookOpen } from 'lucide-react'
import { PrimarySource } from '../types'
import { useFavoritesStore } from '../stores/favoritesStore'
import './PrimarySourceCard.css'

interface PrimarySourceCardProps {
  source: PrimarySource
}

export default function PrimarySourceCard({ source }: PrimarySourceCardProps) {
  const navigate = useNavigate()
  const { isPrimaryFavorite, togglePrimaryFavorite } = useFavoritesStore()

  const handleReadInline = () => {
    const params = new URLSearchParams()
    params.append('src', source.id)
    params.append('title', source.title)
    params.append('source', source.sourceName)
    navigate(`/read/primary?${params.toString()}`)
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    togglePrimaryFavorite(source)
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
      </div>
      <button
        className={`favorite-btn ${isPrimaryFavorite(source.id) ? 'active' : ''}`}
        onClick={handleFavoriteClick}
        aria-label={isPrimaryFavorite(source.id) ? 'Remove from favorites' : 'Add to favorites'}
        title={isPrimaryFavorite(source.id) ? 'Saved' : 'Save source'}
      >
        <Star size={18} fill={isPrimaryFavorite(source.id) ? 'currentColor' : 'none'} />
      </button>
      <div className="primary-actions">
        <button className="primary-read-link primary-inline" onClick={handleReadInline}>
          <BookOpen size={16} />
          Read inline
        </button>
        <a
          className="primary-read-link primary-external"
          href={source.readUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${source.title} in new tab`}
        >
          Source
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  )
}
