import { useState, type FormEvent } from 'react'
import { signIn } from 'aws-amplify/auth'
import './Login.css'

type LoginProps = {
  onSuccess: () => void
}

export default function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isLoading) return
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn({ username: username.trim(), password })
      if (result.isSignedIn) {
        onSuccess()
      } else {
        console.info('Next authentication step:', result.nextStep.signInStep)
        setError('Logowanie wymaga dodatkowego kroku weryfikacji. Skontaktuj się z administratorem.')
      }
    } catch (err: unknown) {
      console.error('Cognito authentication failed:', err)
      setError('Nie udało się zalogować. Sprawdź nazwę użytkownika i hasło.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c-3.1 4.1-6.5 7.7-6.5 11.3a6.5 6.5 0 0 0 13 0C18.5 10.7 15.1 7.1 12 3Z" />
            <path d="M9 16a3 3 0 0 0 3 3" />
          </svg>
        </div>
        <h1 id="login-title">Monitoring poziomu wody</h1>
        <p className="login-subtitle">Zaloguj się, aby sprawdzić stan zbiornika i historię pomiarów.</p>

        <form onSubmit={handleLogin} className="login-form">
          <label htmlFor="login-username">Nazwa użytkownika</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            placeholder="Wpisz nazwę użytkownika"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />

          <label htmlFor="login-password">Hasło</label>
          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Wpisz hasło"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Ukryj' : 'Pokaż'}
            </button>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
        <p className="login-footer">Panel monitorowania zbiornika</p>
      </section>
    </main>
  )
}