import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Build marker (helps confirm a deploy landed; harmless).
document.documentElement.dataset.build = 'debugnhp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
