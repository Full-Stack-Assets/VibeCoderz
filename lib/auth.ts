import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'session'
const SESSION_TTL = '30d'

// Re-exported for server callers; source of truth lives in the client-safe
// billing module so the login page can import it too.
export { SIGNUP_CREDIT_GRANT } from './billing'

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set in production')
    }
    // Dev-only fallback so the flow works locally without configuration.
    return new TextEncoder().encode('dev-insecure-secret-change-me')
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
