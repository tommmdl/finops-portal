import { useState } from 'react'
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'

function Portal() {
  const { signOut, user } = useAuthenticator()
  const [page, setPage] = useState('dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} user={user} signOut={signOut} />
      <main style={{ marginLeft: 220, flex: 1 }}>
        {page === 'dashboard' && <Dashboard setPage={setPage} />}
        {page === 'clients'   && <Clients />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      components={{
        Header() {
          return (
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{
                width: 40, height: 40, background: '#00d4aa', borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e8eaf0' }}>
                FinOps Portal
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
                AWS MANAGEMENT
              </div>
            </div>
          )
        }
      }}
    >
      <Portal />
    </Authenticator>
  )
}
