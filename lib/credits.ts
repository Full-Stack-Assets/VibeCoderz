import { getDb, schema } from '@/db/client'
import { eq, sql } from 'drizzle-orm'

type Reason =
  | 'signup_grant'
  | 'monthly_grant'
  | 'generation'
  | 'topup'
  | 'refund'

/**
 * Deduct credits from a user and record a ledger entry. Returns the new
 * balance. The balance update is a single atomic SQL expression; the ledger
 * row is the audit trail.
 */
export async function deductCredits(
  userId: string,
  credits: number,
  reason: Reason
): Promise<number> {
  if (credits <= 0) return getBalance(userId)
  const db = await getDb()

  await db
    .update(schema.users)
    .set({
      creditsBalance: sql`${schema.users.creditsBalance} - ${credits}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId))

  const balanceAfter = await getBalance(userId)

  await db.insert(schema.creditLedger).values({
    userId,
    delta: -credits,
    reason,
    balanceAfter,
  })

  return balanceAfter
}

/** Grant credits to a user and record a ledger entry. Returns the new balance. */
export async function grantCredits(
  userId: string,
  credits: number,
  reason: Reason
): Promise<number> {
  if (credits <= 0) return getBalance(userId)
  const db = await getDb()

  await db
    .update(schema.users)
    .set({
      creditsBalance: sql`${schema.users.creditsBalance} + ${credits}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId))

  const balanceAfter = await getBalance(userId)

  await db.insert(schema.creditLedger).values({
    userId,
    delta: credits,
    reason,
    balanceAfter,
  })

  return balanceAfter
}

async function getBalance(userId: string): Promise<number> {
  const db = await getDb()
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })
  return user?.creditsBalance ?? 0
}
