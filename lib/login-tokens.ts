import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/db/client'

/**
 * Single-use email sign-in challenges (magic link + 6-digit OTP).
 *
 * Only HASHES of the token/code are persisted; the plaintext is emailed and
 * never stored. Each challenge is short-lived, single-use, and attempt-capped,
 * which (together with email delivery) is what proves the requester actually
 * controls the address — closing the old "type any email, get an account +
 * free credits" hole.
 */

export const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const MAX_VERIFY_ATTEMPTS = 5

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function hashesEqual(a: string, b: string): boolean {
  // Both are fixed-length sha256 hex; compare in constant time.
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/** Create a fresh challenge for `email`, returning the plaintext code + token. */
export async function createLoginChallenge(email: string): Promise<{ code: string; token: string }> {
  const db = await getDb()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const token = randomBytes(32).toString('base64url')
  // Supersede any earlier unconsumed challenge for this address.
  await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, email))
  await db.insert(schema.loginTokens).values({
    email,
    codeHash: sha256(code),
    tokenHash: sha256(token),
    expiresAt: Date.now() + LOGIN_TOKEN_TTL_MS,
  })
  return { code, token }
}

export type VerifyResult = 'ok' | 'invalid' | 'expired' | 'throttled'

/** Verify and consume a challenge by OTP code or magic-link token. */
export async function consumeLoginChallenge(
  email: string,
  opts: { code?: string; token?: string }
): Promise<VerifyResult> {
  const db = await getDb()
  const rec = await db.query.loginTokens.findFirst({
    where: eq(schema.loginTokens.email, email),
  })
  if (!rec || rec.consumedAt != null) return 'invalid'
  if (Date.now() > rec.expiresAt) return 'expired'
  if (rec.attempts >= MAX_VERIFY_ATTEMPTS) return 'throttled'

  const presented = opts.token ? sha256(opts.token) : opts.code ? sha256(opts.code) : ''
  const expected = opts.token ? rec.tokenHash : rec.codeHash
  if (!presented || !hashesEqual(presented, expected)) {
    await db
      .update(schema.loginTokens)
      .set({ attempts: rec.attempts + 1 })
      .where(eq(schema.loginTokens.id, rec.id))
    return 'invalid'
  }

  await db
    .update(schema.loginTokens)
    .set({ consumedAt: Date.now() })
    .where(eq(schema.loginTokens.id, rec.id))
  return 'ok'
}
