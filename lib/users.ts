import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/db/client'
import { SIGNUP_CREDIT_GRANT } from '@/lib/billing'
import type { User } from '@/db/schema'

/**
 * Find a user by (verified) email, creating the account on first sign-in and
 * granting starter credits. Only ever called AFTER the email has been proven
 * via the magic-link/OTP challenge, so account creation can't be farmed.
 */
export async function upsertUserByVerifiedEmail(email: string, name?: string): Promise<User> {
  const db = await getDb()
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  })
  if (existing) return existing

  const inserted = await db
    .insert(schema.users)
    .values({ email, name, creditsBalance: SIGNUP_CREDIT_GRANT, plan: 'free' })
    .returning()
  const user = inserted[0]

  await db.insert(schema.creditLedger).values({
    userId: user.id,
    delta: SIGNUP_CREDIT_GRANT,
    reason: 'signup_grant',
    balanceAfter: SIGNUP_CREDIT_GRANT,
  })
  return user
}
