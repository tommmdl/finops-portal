import React from 'react'
import ReactDOM from 'react-dom/client'
import './aws-config.js'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  componentDidCatch(error, info) {
    console.error('[FinOps] Render error:', error, info)
  }
  static getDerivedStateFromError(error) {
    return { error: error.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace', background: '#0a0c10', minHeight: '100vh' }}>
          <h2 style={{ color: '#00d4aa', marginBottom: 16 }}>FinOps Portal — Erro ao carregar</h2>
          <pre style={{ background: '#111318', padding: 20, borderRadius: 8, border: '1px solid #ef4444' }}>
            {this.state.error}
          </pre>
          <p style={{ marginTop: 16, color: '#6b7280' }}>Abra o Console (F12) para mais detalhes.</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
