'use client'

import { useState } from 'react'
import { Burst } from '../Burst'
import { isValidEmail, type MagicChallenge } from '@/lib/auth'
import { useAuth } from './AuthContext'

type Stage = 'welcome' | 'email' | 'code'
type Mode = 'signin' | 'signup'

export function AuthFlow({ onAuthenticated }: { onAuthenticated: (isNewUser: boolean) => void }) {
  const { requestMagicLink, verifyMagicCode } = useAuth()
  const [stage, setStage] = useState<Stage>('welcome')
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<MagicChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goEmail = (m: Mode) => {
    setMode(m)
    setError(null)
    setStage('email')
  }

  const sendLink = async () => {
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (mode === 'signup' && !name.trim()) return setError('Enter your name to create an account.')
    setBusy(true)
    setError(null)
    try {
      const ch = await requestMagicLink(email, mode === 'signup' ? name : undefined)
      setChallenge(ch)
      setCode('')
      setStage('code')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!challenge) return
    if (code.trim().length < 6) return setError('Enter the 6-digit code.')
    setBusy(true)
    setError(null)
    try {
      await verifyMagicCode(challenge.challengeId, code)
      onAuthenticated(challenge.isNewUser)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    setError(null)
    try {
      const ch = await requestMagicLink(email, mode === 'signup' ? name : undefined)
      setChallenge(ch)
      setCode('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span style={{ color: 'var(--coral)' }}>
            <Burst size={40} />
          </span>
          <h1 className="auth-wordmark">Conductor</h1>
          <p className="auth-tagline">The constraint-optimized assistant</p>
        </div>

        {stage === 'welcome' && (
          <div className="auth-block">
            <p className="auth-lede">
              Every message is routed to the cheapest model that can do the job — strong answers
              without overpaying.
            </p>
            <button className="auth-primary" onClick={() => goEmail('signup')}>
              Create account
            </button>
            <button className="auth-secondary" onClick={() => goEmail('signin')}>
              I already have an account
            </button>
            <p className="auth-fine">No password needed — we’ll email you a magic sign-in code.</p>
          </div>
        )}

        {stage === 'email' && (
          <form
            className="auth-block"
            onSubmit={(e) => {
              e.preventDefault()
              void sendLink()
            }}
          >
            <h2 className="auth-heading">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            {mode === 'signup' && (
              <>
                <label className="auth-label">Name</label>
                <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
              </>
            )}
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              autoFocus
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic code'}
            </button>
            <button type="button" className="auth-switch" onClick={() => goEmail(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
            </button>
            <button type="button" className="auth-back" onClick={() => setStage('welcome')}>
              ← Back
            </button>
          </form>
        )}

        {stage === 'code' && challenge && (
          <form
            className="auth-block"
            onSubmit={(e) => {
              e.preventDefault()
              void verify()
            }}
          >
            <h2 className="auth-heading">Check your email</h2>
            <p className="auth-sub">
              We sent a 6-digit code to <strong>{email}</strong>.
            </p>
            {challenge.devCode && (
              <button type="button" className="auth-demo" onClick={() => setCode(challenge.devCode!)}>
                <span className="auth-demo-label">DEMO MODE</span>
                <span className="auth-demo-code">{challenge.devCode}</span>
                <span className="auth-demo-hint">No mail server here — click to autofill. A real deployment emails this.</span>
              </button>
            )}
            <input
              className="auth-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button type="button" className="auth-switch" onClick={() => void resend()} disabled={busy}>
              Resend code
            </button>
            <button type="button" className="auth-back" onClick={() => setStage('email')}>
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
