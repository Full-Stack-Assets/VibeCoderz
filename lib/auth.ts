import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'session'
const SESSION_TTL = '30d'

// Re-exported for server callers; source of truth lives in the client-safe
// billing module so the login page can import it too.
export { SIGNUP_CREDIT_GRANT } from './billing'

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  // Required in EVERY environment — no insecure fallback. A predictable dev
  // secret lets anyone forge a session cookie, and dev secrets have a way of
  // reaching shared/preview deployments. Generate one: `openssl rand -base64 32`.
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET must be set to a strong value (>= 16 chars). Generate one with: openssl rand -base64 32'
    )
  }
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  sub: string // user id
  email: string
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret())
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

/** Reads and verifies the session from the request cookies (server-side only). */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}
