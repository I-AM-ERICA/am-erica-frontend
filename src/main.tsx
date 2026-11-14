import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/nanum-gothic/400.css'
import '@fontsource/nanum-gothic/700.css'
import '@fontsource/nanum-gothic/800.css'
import App from './App'
import './pages/styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
