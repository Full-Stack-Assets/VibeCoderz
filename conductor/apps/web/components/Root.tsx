'use client'

import { useEffect, useState } from 'react'
import { AuthProviderComponent, useAuth } from './auth/AuthContext'
import { Pricing } from './auth/Pricing'
import { Burst } from './Burst'
import { Chat } from './Chat'

/** Top-level gate: splash → chat (anonymous trial allowed) → onboarding for new
 *  accounts. Signed-out visitors get the chat directly so they can try it before
 *  the signup wall; Chat owns the sign-in/up modal and the trial wall. */
export function Root() {
  return (
    <AuthProviderComponent>
      <Gate />
    </AuthProviderComponent>
  )
}

function Gate() {
  const { loading, user, refresh } = useAuth()
  const [onboarding, setOnboarding] = useState(false)

  // Returning from Stripe Checkout: refresh the account (plan may have changed
  // via webhook) and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // checkout → plan may have changed; topup → credit may have been granted.
    // Both are applied by the Stripe webhook; refresh to pick them up.
    if (params.has('checkout') || params.has('topup')) {
      void refresh()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [refresh])

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-splash" style={{ color: 'var(--coral)' }}>
          <Burst size={48} />
        </div>
      </div>
    )
  }
  // A freshly-registered account sees plan onboarding once, then the chat.
  if (user && onboarding) return <Pricing mode="onboarding" onDone={() => setOnboarding(false)} />
  return <Chat onNewUser={() => setOnboarding(true)} />
}
