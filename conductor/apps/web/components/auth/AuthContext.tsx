'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PlanId, User } from '@/lib/auth'

interface BillingConfig {
  enabled: boolean
  plans: { pro: boolean; max: boolean }
}

interface AuthValue {
  loading: boolean
  user: User | null
  billing: BillingConfig
  register: (email: string, password: string, name: string) => Promise<User>
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
  /** Start Stripe Checkout for a paid plan; resolves to a redirect URL. */
  startCheckout: (plan: PlanId, cycle?: 'monthly' | 'annual') => Promise<string>
  /** Open the Stripe billing portal; resolves to a redirect URL. */
  openPortal: () => Promise<string>
  /** Buy a top-up credit pack; resolves to a Stripe Checkout redirect URL. */
  startTopup: (pack: string) => Promise<string>
}

const Ctx = createContext<AuthValue | null>(null)

async function postJSON(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return (data as { error?: string }).error || fallback
  } catch {
    return fallback
  }
}

export function AuthProviderComponent({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false, plans: { pro: false, max: false } })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = (await res.json()) as { user: User | null }
      setUser(data.user)
      return data.user
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      refresh(),
      fetch('/api/billing/config')
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([, cfg]) => {
      if (alive && cfg) setBilling(cfg as BillingConfig)
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [refresh])

  const register = useCallback(async (email: string, password: string, name: string) => {
    // Capture a referral code from the landing URL (?ref=CODE), if present.
    const referralCode =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') || undefined : undefined
    const res = await postJSON('/api/auth/register', { email, password, name, referralCode })
    if (!res.ok) throw new Error(await readError(res, 'Could not create your account.'))
    const { user } = (await res.json()) as { user: User }
    setUser(user)
    return user
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await postJSON('/api/auth/login', { email, password })
    if (!res.ok) throw new Error(await readError(res, 'Could not sign you in.'))
    const { user } = (await res.json()) as { user: User }
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    await postJSON('/api/auth/logout').catch(() => {})
    setUser(null)
  }, [])

  const startCheckout = useCallback(async (plan: PlanId, cycle: 'monthly' | 'annual' = 'monthly') => {
    const res = await postJSON('/api/billing/checkout', { plan, cycle })
    if (!res.ok) throw new Error(await readError(res, 'Could not start checkout.'))
    return ((await res.json()) as { url: string }).url
  }, [])

  const openPortal = useCallback(async () => {
    const res = await postJSON('/api/billing/portal')
    if (!res.ok) throw new Error(await readError(res, 'Could not open the billing portal.'))
    return ((await res.json()) as { url: string }).url
  }, [])

  const startTopup = useCallback(async (pack: string) => {
    const res = await postJSON('/api/billing/topup', { pack })
    if (!res.ok) throw new Error(await readError(res, 'Could not start the top-up.'))
    return ((await res.json()) as { url: string }).url
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ loading, user, billing, register, login, logout, refresh, startCheckout, openPortal, startTopup }),
    [loading, user, billing, register, login, logout, refresh, startCheckout, openPortal, startTopup]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProviderComponent')
  return ctx
}
