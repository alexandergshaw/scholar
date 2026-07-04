import { useFavoritesStore } from '../stores/favoritesStore'
import ArticleCard from '../components/ArticleCard'
import './Favorites.css'

export default function Favorites() {
  const favorites = useFavoritesStore(state => state.favorites)

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Saved Articles</h1>
      </div>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">★</div>
          <h2>No saved articles yet</h2>
          <p>Articles you save will appear here. You can save articles from search results or while reading.</p>
        </div>
      ) : (
        <>
          <div className="favorites-count">
            {favorites.length} article{favorites.length !== 1 ? 's' : ''} saved
          </div>
          <div className="articles-list">
            {favorites.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
