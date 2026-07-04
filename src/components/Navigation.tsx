import { useLocation, useNavigate } from 'react-router-dom'
import './Navigation.css'

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${isActive('/') ? 'active' : ''}`}
        onClick={() => navigate('/')}
        aria-label="Home"
      >
        <span className="nav-icon">⌂</span>
        <span className="nav-label">Home</span>
      </button>
      <button
        className={`nav-item ${isActive('/search') ? 'active' : ''}`}
        onClick={() => navigate('/search')}
        aria-label="Search"
      >
        <span className="nav-icon">🔍</span>
        <span className="nav-label">Search</span>
      </button>
      <button
        className={`nav-item ${isActive('/favorites') ? 'active' : ''}`}
        onClick={() => navigate('/favorites')}
        aria-label="Favorites"
      >
        <span className="nav-icon">★</span>
        <span className="nav-label">Favorites</span>
      </button>
      <button
        className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
        onClick={() => navigate('/settings')}
        aria-label="Settings"
      >
        <span className="nav-icon">⚙</span>
        <span className="nav-label">Settings</span>
      </button>
    </nav>
  )
}
