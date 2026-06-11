'use client'

/**
 * Web auth + plans for Conductor — mirrors the iOS app's model.
 *
 * The backend ships no auth and there's no mail server here, so sign-in is a
 * SELF-CONTAINED passwordless ("magic link") flow whose session + accounts live
 * in localStorage. Everything funnels through `AuthProvider`, so going live is a
 * one-file change: implement it against a real backend (Supabase / Clerk /
 * /api/auth) and stop returning `devCode`. Screens, context, and gating don't
 * change. The methods are async for parity with a networked implementation.
 */

export type PlanId = 'free' | 'pro' | 'max'

export interface Plan {
  id: PlanId
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Cost-optimized routing on a daily budget.',
    features: ['Smart model routing', '$1.00 daily budget', 'Web & data tools', 'Image understanding'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: '/month',
    tagline: 'More budget and premium models when they earn it.',
    features: [
      'Everything in Free',
      '$25 monthly budget',
      'Premium models (Opus, GPT-5.3)',
      'Priority routing',
      'Unlimited conversations',
    ],
    highlight: true,
  },
  {
    id: 'max',
    name: 'Max',
    price: '$100',
    period: '/month',
    tagline: 'Highest budget and quality floor for heavy use.',
    features: ['Everything in Pro', '$150 monthly budget', 'Highest quality floor', 'Early access features'],
  },
]

export const planById = (id: PlanId | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0]

export interface User {
  id: string
  email: string
  name?: string
  plan: PlanId
  createdAt: number
}

export interface Session {
  user: User
  token: string
  issuedAt: number
}

export interface MagicChallenge {
  challengeId: string
  email: string
  isNewUser: boolean
  /** Demo only: a real deployment emails this instead of returning it. */
  devCode?: string
}

export interface AuthProvider {
  requestMagicLink(email: string, name?: string): Promise<MagicChallenge>
  verifyMagicCode(challengeId: string, code: string): Promise<Session>
  setPlan(plan: PlanId): Promise<User>
  restore(): Promise<Session | null>
  signOut(): Promise<void>
}

const K = {
  session: 'conductor.auth.session.v1',
  users: 'conductor.auth.users.v1',
  pending: 'conductor.auth.pending.v1',
}
const CODE_TTL_MS = 10 * 60 * 1000

interface Pending {
  challengeId: string
  email: string
  code: string
  name?: string
  isNewUser: boolean
  expiresAt: number
}

const emailKey = (e: string) => e.trim().toLowerCase()
const randId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
const sixDigit = () => String(Math.floor(100000 + Math.random() * 900000))
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (e: string) => EMAIL_RE.test(e.trim())

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}
function remove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const localAuth: AuthProvider = {
  async requestMagicLink(email, name) {
    if (!isValidEmail(email)) throw new Error('Enter a valid email address.')
    const users = readJSON<Record<string, User>>(K.users, {})
    const isNewUser = !users[emailKey(email)]
    const challenge: Pending = {
      challengeId: randId(),
      email: email.trim(),
      code: sixDigit(),
      name: name?.trim() || undefined,
      isNewUser,
      expiresAt: Date.now() + CODE_TTL_MS,
    }
    writeJSON(K.pending, challenge)
    return { challengeId: challenge.challengeId, email: challenge.email, isNewUser, devCode: challenge.code }
  },

  async verifyMagicCode(challengeId, code) {
    const pending = readJSON<Pending | null>(K.pending, null)
    if (!pending || pending.challengeId !== challengeId) {
      throw new Error('This sign-in request expired. Request a new code.')
    }
    if (Date.now() > pending.expiresAt) {
      remove(K.pending)
      throw new Error('Your code expired. Request a new one.')
    }
    if (code.trim() !== pending.code) throw new Error('That code is incorrect. Check it and try again.')

    const users = readJSON<Record<string, User>>(K.users, {})
    const key = emailKey(pending.email)
    const user: User =
      users[key] ?? {
        id: randId(),
        email: pending.email,
        name: pending.name,
        plan: 'free',
        createdAt: Date.now(),
      }
    users[key] = user
    writeJSON(K.users, users)

    const session: Session = { user, token: randId(), issuedAt: Date.now() }
    writeJSON(K.session, session)
    remove(K.pending)
    return session
  },

  async setPlan(plan) {
    const session = readJSON<Session | null>(K.session, null)
    if (!session) throw new Error('Not signed in.')
    const user: User = { ...session.user, plan }
    writeJSON(K.session, { ...session, user })
    const users = readJSON<Record<string, User>>(K.users, {})
    users[emailKey(user.email)] = user
    writeJSON(K.users, users)
    return user
  },

  async restore() {
    const session = readJSON<Session | null>(K.session, null)
    if (!session || !session.user || !session.token) return null
    return session
  },

  async signOut() {
    remove(K.session)
    remove(K.pending)
  },
}
