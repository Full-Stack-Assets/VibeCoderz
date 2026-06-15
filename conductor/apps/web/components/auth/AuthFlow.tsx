'use client'

import { useState, type ReactNode } from 'react'
import { Burst } from '../Burst'
import { isValidEmail } from '@/lib/auth'
import { useAuth } from './AuthContext'

type Stage = 'welcome' | 'form'
type Mode = 'signin' | 'signup'

export function AuthFlow({
  onAuthenticated,
  onClose,
  intro,
  initialMode = 'signup',
}: {
  onAuthenticated: (isNewUser: boolean) => void
  /** When set, the flow renders as a dismissible modal (adds a Close control). */
  onClose?: () => void
  /** Optional banner above the welcome buttons (e.g. the trial savings receipt). */
  intro?: ReactNode
  initialMode?: Mode
}) {
  const { login, register } = useAuth()
  const [stage, setStage] = useState<Stage>('welcome')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = (m: Mode) => {
    setMode(m)
    setError(null)
    setStage('form')
  }

  const submit = async () => {
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (mode === 'signup' && !name.trim()) return setError('Enter your name.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') {
        await register(email, password, name)
        onAuthenticated(true)
      } else {
        await login(email, password)
        onAuthenticated(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={onClose ? 'auth-screen auth-screen-modal' : 'auth-screen'}>
      <div className="auth-card">
        {onClose && (
          <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        <div className="auth-brand">
          <span style={{ color: 'var(--coral)' }}>
            <Burst size={40} />
          </span>
          <h1 className="auth-wordmark">Conductor</h1>
          <p className="auth-tagline">The constraint-optimized assistant</p>
        </div>

        {stage === 'welcome' && (
          <div className="auth-block">
            {intro}
            <p className="auth-lede">
              Every message is routed to the cheapest model that can do the job — strong answers
              without overpaying.
            </p>
            <button className="auth-primary" onClick={() => go('signup')}>
              Create account
            </button>
            <button className="auth-secondary" onClick={() => go('signin')}>
              I already have an account
            </button>
          </div>
        )}

        {stage === 'form' && (
          <form
            className="auth-block"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <h2 className="auth-heading">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            {mode === 'signup' && (
              <>
                <label className="auth-label" htmlFor="auth-name">
                  Name
                </label>
                <input
                  id="auth-name"
                  className="auth-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  autoFocus
                />
              </>
            )}
            <label className="auth-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              autoFocus={mode === 'signin'}
            />
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            <button type="button" className="auth-switch" onClick={() => go(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
            </button>
            <button type="button" className="auth-back" onClick={() => setStage('welcome')}>
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
