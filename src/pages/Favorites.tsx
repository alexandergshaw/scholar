import { useFavoritesStore } from '../stores/favoritesStore'
import ArticleCard from '../components/ArticleCard'
import PrimarySourceCard from '../components/PrimarySourceCard'
import './Favorites.css'

export default function Favorites() {
  const favorites = useFavoritesStore(state => state.favorites)
  const primaryFavorites = useFavoritesStore(state => state.primaryFavorites)

  const hasNoFavorites = favorites.length === 0 && primaryFavorites.length === 0

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Saved</h1>
      </div>

      {hasNoFavorites ? (
        <div className="empty-state">
          <div className="empty-state-icon">★</div>
          <h2>No saved articles or sources yet</h2>
          <p>Articles and sources you save will appear here. You can save them from search results or while reading.</p>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <>
              <div className="section-header">
                <h2>Saved articles</h2>
                <span className="section-count">{favorites.length}</span>
              </div>
              <div className="articles-list">
                {favorites.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </>
          )}

          {primaryFavorites.length > 0 && (
            <>
              <div className="section-header">
                <h2>Saved sources</h2>
                <span className="section-count">{primaryFavorites.length}</span>
              </div>
              <div className="sources-list">
                {primaryFavorites.map(source => (
                  <PrimarySourceCard key={source.id} source={source} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
