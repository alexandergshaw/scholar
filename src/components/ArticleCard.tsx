import { useNavigate } from 'react-router-dom'
import { Star, BookOpen } from 'lucide-react'
import { Article } from '../types'
import { useFavoritesStore } from '../stores/favoritesStore'
import { shortIdOf, isReadableInApp } from '../utils/openalexApi'
import './ArticleCard.css'

interface ArticleCardProps {
  article: Article
  compact?: boolean
}

export default function ArticleCard({ article, compact = false }: ArticleCardProps) {
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavoritesStore()

  const handleCardClick = () => {
    navigate(`/reader/${shortIdOf(article.id)}`)
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(article)
  }

  if (compact) {
    return (
      <div className="article-card compact" onClick={handleCardClick}>
        <div className="article-card-content">
          <h3 className="article-title">{article.title}</h3>
          <div className="article-meta">
            {article.journal && <span>{article.journal}</span>}
            {article.year && <span>{article.year}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="article-card" onClick={handleCardClick}>
      <div className="article-card-content">
        <h3 className="article-title">{article.title}</h3>
        <p className="article-authors">{article.authors.slice(0, 3).join(', ')}{article.authors.length > 3 ? ' et al.' : ''}</p>
        <div className="article-meta">
          <span className="article-year">{article.year}</span>
          {article.journal && article.journal !== 'Unknown Journal' && <span className="article-journal">{article.journal}</span>}
          {article.isOA && <span className="oa-badge">OA</span>}
          {isReadableInApp(article) && (
            <span className="inline-badge" title="Full text renders inside the app">
              <BookOpen size={12} />
              Readable in-app
            </span>
          )}
        </div>
        {article.abstract && <p className="article-summary">{article.abstract}</p>}
      </div>
      <button
        className={`favorite-btn ${isFavorite(article.id) ? 'active' : ''}`}
        onClick={handleFavoriteClick}
        aria-label={isFavorite(article.id) ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorite(article.id) ? 'Saved' : 'Save article'}
      >
        <Star size={18} fill={isFavorite(article.id) ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
