'use client'

import { useEffect, useState } from 'react'
import { AuthProviderComponent, useAuth } from './auth/AuthContext'
import { AuthFlow } from './auth/AuthFlow'
import { Pricing } from './auth/Pricing'
import { Burst } from './Burst'
import { Chat } from './Chat'

/** Top-level gate: splash → auth → onboarding (new accounts) → chat. */
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
  if (!user) return <AuthFlow onAuthenticated={(isNewUser) => setOnboarding(isNewUser)} />
  if (onboarding) return <Pricing mode="onboarding" onDone={() => setOnboarding(false)} />
  return <Chat />
}
