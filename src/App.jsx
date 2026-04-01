import { useState, useEffect } from 'react'
import { getCurrentUser, signOut as amplifySignOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import AuthPage from './components/AuthPage.jsx'

export default function App() {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState('dashboard')

  async function loadUser() {
    try {
      const u = await getCurrentUser()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn')  loadUser()
      if (payload.event === 'signedOut') setUser(null)
    })
    return unsubscribe
  }, [])

  async function handleSignOut() {
    await amplifySignOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0c10', color:'#00d4aa', fontFamily:'DM Mono, monospace', fontSize:13 }}>
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={loadUser} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} user={user} signOut={handleSignOut} />
      <main style={{ marginLeft: 220, flex: 1 }}>
        {page === 'dashboard' && <Dashboard setPage={setPage} />}
        {page === 'clients'   && <Clients />}
      </main>
    </div>
  )
}
