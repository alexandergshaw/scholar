import { useNavigate } from 'react-router-dom'
import { useRecentsStore } from '../stores/recentsStore'
import ArticleCard from '../components/ArticleCard'
import './Home.css'

const TOPICS = [
  'Climate change',
  'Machine learning',
  'Public health',
  'History',
  'Economics',
  'Neuroscience',
  'Astronomy',
  'Psychology'
]

export default function Home() {
  const navigate = useNavigate()
  const recents = useRecentsStore(state => state.recents)

  const handleTopicClick = (topic: string) => {
    navigate(`/search?topic=${encodeURIComponent(topic)}`)
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <h1>Scholar</h1>
      </div>

      {/* Recently Read */}
      {recents.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">Continue reading</h2>
          <div className="articles-list">
            {recents.slice(0, 5).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by Topic */}
      <section className="home-section">
        <h2 className="section-title">Browse by topic</h2>
        <div className="topic-chips">
          {TOPICS.map(topic => (
            <button
              key={topic}
              className="topic-chip"
              onClick={() => handleTopicClick(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
