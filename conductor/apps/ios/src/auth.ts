/**
 * Authentication + plans for Conductor.
 *
 * The Conductor backend currently ships no auth, and this environment has no
 * mail server, so sign-in is implemented as a SELF-CONTAINED passwordless
 * ("magic link") flow whose session + accounts persist on-device via
 * AsyncStorage. Everything funnels through the `AuthProvider` interface, so
 * swapping in a real backend (Supabase / Clerk / a custom `/api/auth`) is a
 * one-file change: implement `AuthProvider` against the network and stop
 * returning `devCode`. The screens, context, and gating do not change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

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

/** Plans mirror Conductor's routing tiers (cheapest-capable → always-premium). */
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
    features: [
      'Everything in Pro',
      '$150 monthly budget',
      'Highest quality floor',
      'Early access features',
    ],
  },
]

export const planById = (id: PlanId | undefined): Plan =>
  PLANS.find((p) => p.id === id) ?? PLANS[0]

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

/** Result of requesting a magic link. `devCode` is only present in demo mode. */
export interface MagicChallenge {
  challengeId: string
  email: string
  /** New (unseen) email → onboard through pricing after verifying. */
  isNewUser: boolean
  /** Demo only: the code that a real deployment would email instead. */
  devCode?: string
}

export interface AuthProvider {
  /** Begin sign-in/sign-up for an email. Sends (or, in demo, returns) a code. */
  requestMagicLink(email: string, name?: string): Promise<MagicChallenge>
  /** Exchange a code for a session. Throws on bad/expired code. */
  verifyMagicCode(challengeId: string, code: string): Promise<Session>
  /** Update the signed-in user's plan; returns the updated user. */
  setPlan(plan: PlanId): Promise<User>
  /** Load a persisted session, or null. */
  restore(): Promise<Session | null>
  /** Clear the active session (accounts + memory are retained on-device). */
  signOut(): Promise<void>
}

// ── Local (demo) implementation ────────────────────────────────────────────

const K = {
  session: 'conductor.auth.session.v1',
  users: 'conductor.auth.users.v1',
  pending: 'conductor.auth.pending.v1',
}

const CODE_TTL_MS = 10 * 60 * 1000

interface PendingChallenge {
  challengeId: string
  email: string
  code: string
  name?: string
  isNewUser: boolean
  expiresAt: number
}

const emailKey = (email: string) => email.trim().toLowerCase()
const randId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
const sixDigit = () => String(Math.floor(100000 + Math.random() * 900000))

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // best-effort persistence
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim())

/** A swappable demo provider. Replace this object to go live. */
export const localAuth: AuthProvider = {
  async requestMagicLink(email, name) {
    if (!isValidEmail(email)) throw new Error('Enter a valid email address.')
    const users = await readJSON<Record<string, User>>(K.users, {})
    const isNewUser = !users[emailKey(email)]
    const challenge: PendingChallenge = {
      challengeId: randId(),
      email: email.trim(),
      code: sixDigit(),
      name: name?.trim() || undefined,
      isNewUser,
      expiresAt: Date.now() + CODE_TTL_MS,
    }
    await writeJSON(K.pending, challenge)
    // A real provider emails the code/link here and returns no devCode.
    return { challengeId: challenge.challengeId, email: challenge.email, isNewUser, devCode: challenge.code }
  },

  async verifyMagicCode(challengeId, code) {
    const pending = await readJSON<PendingChallenge | null>(K.pending, null)
    if (!pending || pending.challengeId !== challengeId) {
      throw new Error('This sign-in request expired. Request a new code.')
    }
    if (Date.now() > pending.expiresAt) {
      await AsyncStorage.removeItem(K.pending).catch(() => {})
      throw new Error('Your code expired. Request a new one.')
    }
    if (code.trim() !== pending.code) {
      throw new Error('That code is incorrect. Check it and try again.')
    }

    const users = await readJSON<Record<string, User>>(K.users, {})
    const key = emailKey(pending.email)
    const existing = users[key]
    const user: User = existing ?? {
      id: randId(),
      email: pending.email,
      name: pending.name,
      plan: 'free',
      createdAt: Date.now(),
    }
    users[key] = user
    await writeJSON(K.users, users)

    const session: Session = { user, token: randId(), issuedAt: Date.now() }
    await writeJSON(K.session, session)
    await AsyncStorage.removeItem(K.pending).catch(() => {})
    return session
  },

  async setPlan(plan) {
    const session = await readJSON<Session | null>(K.session, null)
    if (!session) throw new Error('Not signed in.')
    const user: User = { ...session.user, plan }
    await writeJSON(K.session, { ...session, user })
    const users = await readJSON<Record<string, User>>(K.users, {})
    users[emailKey(user.email)] = user
    await writeJSON(K.users, users)
    return user
  },

  async restore() {
    const session = await readJSON<Session | null>(K.session, null)
    if (!session || !session.user || !session.token) return null
    return session
  },

  async signOut() {
    await AsyncStorage.removeItem(K.session).catch(() => {})
    await AsyncStorage.removeItem(K.pending).catch(() => {})
  },
}
