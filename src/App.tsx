import { useEffect, useState } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const session = await fetchAuthSession()
        setAuthenticated(!!session.tokens?.accessToken)
      } catch {
        setAuthenticated(false)
      } finally {
        setChecking(false)
      }
    }

    checkSession()
  }, [])

  if (checking) return <p>Checking session...</p>

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />
}