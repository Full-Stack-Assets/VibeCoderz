/**
 * Auth state for the app, backed by the swappable `AuthProvider` (demo: local).
 * Exposes the current user/session, a loading flag for the initial restore, and
 * the actions screens call. All async actions are guarded so a failure rejects
 * with a readable message rather than throwing into render.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  localAuth,
  type AuthProvider,
  type MagicChallenge,
  type PlanId,
  type Session,
  type User,
} from '../auth'

interface AuthContextValue {
  loading: boolean
  user: User | null
  session: Session | null
  requestMagicLink: (email: string, name?: string) => Promise<MagicChallenge>
  verifyMagicCode: (challengeId: string, code: string) => Promise<Session>
  setPlan: (plan: PlanId) => Promise<User>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthContextProvider({
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
      .then((s) => {
        if (alive) setSession(s)
      })
      .catch(() => {
        if (alive) setSession(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [provider])

  const requestMagicLink = useCallback(
    (email: string, name?: string) => provider.requestMagicLink(email, name),
    [provider]
  )

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

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user: session?.user ?? null,
      session,
      requestMagicLink,
      verifyMagicCode,
      setPlan,
      signOut,
    }),
    [loading, session, requestMagicLink, verifyMagicCode, setPlan, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider')
  return ctx
}
