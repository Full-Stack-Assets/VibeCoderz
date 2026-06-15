import { randomBytes } from 'node:crypto'
import { getStore } from '@conductor/agent-memory'

export const SESSION_COOKIE = 'conductor_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export type PlanId = 'free' | 'pro' | 'max'

export interface DBUser {
  id: string
  email: string
  name: string | null
  passwordHash: string
  plan: PlanId
  role: 'user' | 'admin'
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  topupUSD: number
  createdAt: number | Date
}

export interface AuthStore {
  createUser(input: {
    email: string
    name?: string | null
    passwordHash: string
    plan?: PlanId
    role?: 'user' | 'admin'
  }): Promise<DBUser>
  getUserByEmail(email: string): Promise<DBUser | null>
  getUserById(id: string): Promise<DBUser | null>
  updateUser(id: string, patch: Partial<DBUser>): Promise<DBUser | null>
  createSession(userId: string, token: string, expiresAt: number): Promise<unknown>
  getSession(token: string): Promise<{ user: DBUser } | null>
  deleteSession(token: string): Promise<unknown>
  /** Grant top-up routing credit (e.g. from a completed Stripe payment). */
  addUserCredit(userId: string, deltaUSD: number): Promise<number>
  /** Atomically claim a webhook event id; false if already processed. */
  markEventProcessed(eventId: string): Promise<boolean>
  /** Release an event claim so a failed handler can be retried. */
  releaseEvent(eventId: string): Promise<void>
}

export async function authStore(): Promise<AuthStore> {
  return (await getStore()) as unknown as AuthStore
}

export interface PublicUser {
  id: string
  email: string
  name: string | null
  plan: PlanId
  role: 'user' | 'admin'
  subscriptionStatus: string | null
  topupUSD: number
}

export function toPublicUser(u: DBUser): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    role: u.role,
    subscriptionStatus: u.subscriptionStatus,
    topupUSD: u.topupUSD ?? 0,
  }
}

/** Read our session token from a request's Cookie header. */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === SESSION_COOKIE) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

/** Resolve the signed-in user from the request's session cookie, or null. */
export async function currentUser(req: Request): Promise<DBUser | null> {
  const token = tokenFromRequest(req)
  if (!token) return null
  const found = await (await authStore()).getSession(token)
  return found?.user ?? null
}

/** Issue a session for a user and set the HTTP-only cookie on the response. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_TTL_MS
  await (await authStore()).createSession(userId, token, expiresAt)
  const { cookies } = await import('next/headers')
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

/** Clear the current session (server record + cookie). */
export async function endSession(req: Request): Promise<void> {
  const token = tokenFromRequest(req)
  if (token) await (await authStore()).deleteSession(token)
  const { cookies } = await import('next/headers')
  ;(await cookies()).delete(SESSION_COOKIE)
}
