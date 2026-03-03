import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/variables.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/timeline.css'
import './styles/project.css'
import './styles/attendance.css'
import './styles/admin.css'
import './styles/metrics.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
