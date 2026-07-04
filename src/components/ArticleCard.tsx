import { useNavigate } from 'react-router-dom'
import { Article } from '../types'
import { useFavoritesStore } from '../stores/favoritesStore'
import { shortIdOf } from '../utils/openalexApi'
import AskBox from './AskBox'
import './ArticleCard.css'

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavoritesStore()

  const handleCardClick = () => {
    navigate(`/reader/${shortIdOf(article.id)}`)
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(article)
  }

  return (
    <div className="article-card" onClick={handleCardClick}>
      <div className="article-card-content">
        <h3 className="article-title">{article.title}</h3>
        <p className="article-authors">{article.authors.join(', ')}</p>
        <div className="article-meta">
          <span className="article-year">{article.year}</span>
          <span className="article-journal">{article.journal}</span>
          {article.isOA && <span className="oa-badge">OA</span>}
        </div>
        {article.abstract && <p className="article-summary">{article.abstract}</p>}
        <AskBox
          compact
          getContext={() =>
            [article.title, article.authors.join(', '), article.journal, article.abstract]
              .filter(Boolean)
              .join('\n')
          }
        />
      </div>
      <button
        className={`favorite-btn ${isFavorite(article.id) ? 'active' : ''}`}
        onClick={handleFavoriteClick}
        aria-label={isFavorite(article.id) ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorite(article.id) ? 'Saved' : 'Save article'}
      >
        ★
      </button>
    </div>
  )
}
