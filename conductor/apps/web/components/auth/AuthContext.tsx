'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  localAuth,
  type AuthProvider,
  type MagicChallenge,
  type PlanId,
  type Session,
  type User,
} from '@/lib/auth'

interface AuthValue {
  loading: boolean
  user: User | null
  requestMagicLink: (email: string, name?: string) => Promise<MagicChallenge>
  verifyMagicCode: (challengeId: string, code: string) => Promise<Session>
  setPlan: (plan: PlanId) => Promise<User>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProviderComponent({
  children,
  provider = localAuth,
}: {
  children: ReactNode
  provider?: AuthProvider
}) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let alive = true
    provider
      .restore()
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [provider])

  const requestMagicLink = useCallback((email: string, name?: string) => provider.requestMagicLink(email, name), [provider])
  const verifyMagicCode = useCallback(
    async (challengeId: string, code: string) => {
      const s = await provider.verifyMagicCode(challengeId, code)
      setSession(s)
      return s
    },
    [provider]
  )
  const setPlan = useCallback(
    async (plan: PlanId) => {
      const user = await provider.setPlan(plan)
      setSession((prev) => (prev ? { ...prev, user } : prev))
      return user
    },
    [provider]
  )
  const signOut = useCallback(async () => {
    await provider.signOut()
    setSession(null)
  }, [provider])

  const value = useMemo<AuthValue>(
    () => ({ loading, user: session?.user ?? null, requestMagicLink, verifyMagicCode, setPlan, signOut }),
    [loading, session, requestMagicLink, verifyMagicCode, setPlan, signOut]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProviderComponent')
  return ctx
}
