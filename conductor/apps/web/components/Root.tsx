'use client'

import { useState } from 'react'
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
  const { loading, user, setPlan } = useAuth()
  const [onboarding, setOnboarding] = useState(false)

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
  if (onboarding) {
    return (
      <Pricing
        mode="onboarding"
        currentPlan={user.plan}
        onChoose={async (plan) => {
          await setPlan(plan)
          setOnboarding(false)
        }}
      />
    )
  }
  return <Chat />
}
