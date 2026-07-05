import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useOfflineStore } from '../stores/offlineStore'
import ArticleCard from '../components/ArticleCard'
import PrimarySourceCard from '../components/PrimarySourceCard'
import './Favorites.css'

export default function Favorites() {
  const navigate = useNavigate()
  const favorites = useFavoritesStore(state => state.favorites)
  const primaryFavorites = useFavoritesStore(state => state.primaryFavorites)
  const savedOffline = useOfflineStore(state => state.saved)
  const savedPrimary = useOfflineStore(state => state.savedPrimary)

  const hasNoFavorites = favorites.length === 0 && primaryFavorites.length === 0 && savedOffline.length === 0 && savedPrimary.length === 0

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Saved</h1>
      </div>

      {hasNoFavorites ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Star size={40} />
          </div>
          <h2>No saved articles or sources yet</h2>
          <p>Articles and sources you save will appear here. You can save them from search results or while reading.</p>
        </div>
      ) : (
        <>
          {(savedOffline.length > 0 || savedPrimary.length > 0) && (
            <>
              <div className="section-header">
                <h2>Available offline</h2>
                <span className="section-count">{savedOffline.length + savedPrimary.length}</span>
              </div>
              <div className="articles-list">
                {savedOffline.map(offline => (
                  <ArticleCard key={offline.article.id} article={offline.article} />
                ))}
                {savedPrimary.map(primary => (
                  <div
                    key={primary.id}
                    className="primary-offline-card"
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--color-card-bg)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      marginBottom: '0.5rem'
                    }}
                    onClick={() => navigate(`/read/primary?src=${encodeURIComponent(primary.id)}&title=${encodeURIComponent(primary.title)}&source=${encodeURIComponent(primary.source)}`)}
                  >
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>{primary.title}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {primary.source}
                    </p>
                    <button
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-button-text)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/read/primary?src=${encodeURIComponent(primary.id)}&title=${encodeURIComponent(primary.title)}&source=${encodeURIComponent(primary.source)}`)
                      }}
                    >
                      Read offline
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

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
