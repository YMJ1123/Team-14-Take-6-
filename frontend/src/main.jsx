import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./styles/home.css";
import "./styles/casino-theme.css";
import "./styles/dark-accents.css";
import "./styles/fix-backgrounds.css"; // Import the fix for white backgrounds
import "./styles/double-click-hint.css"; // Import double-click hint styles
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
