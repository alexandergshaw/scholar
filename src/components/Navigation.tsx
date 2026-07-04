import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Search, Waypoints, Star, Settings } from 'lucide-react'
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
        <Home size={22} className="nav-icon" />
        <span className="nav-label">Home</span>
      </button>
      <button
        className={`nav-item ${isActive('/search') ? 'active' : ''}`}
        onClick={() => navigate('/search')}
        aria-label="Search"
      >
        <Search size={22} className="nav-icon" />
        <span className="nav-label">Search</span>
      </button>
      <button
        className={`nav-item ${isActive('/web') ? 'active' : ''}`}
        onClick={() => navigate('/web')}
        aria-label="Web"
      >
        <Waypoints size={22} className="nav-icon" />
        <span className="nav-label">Web</span>
      </button>
      <button
        className={`nav-item ${isActive('/favorites') ? 'active' : ''}`}
        onClick={() => navigate('/favorites')}
        aria-label="Favorites"
      >
        <Star size={22} className="nav-icon" />
        <span className="nav-label">Favorites</span>
      </button>
      <button
        className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
        onClick={() => navigate('/settings')}
        aria-label="Settings"
      >
        <Settings size={22} className="nav-icon" />
        <span className="nav-label">Settings</span>
      </button>
    </nav>
  )
}
