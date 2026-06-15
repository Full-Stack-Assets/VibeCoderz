import { getStore } from '@conductor/agent-memory'
import { topupPack } from '@/lib/auth'
import { chargeOffSession, stripeConfigured } from '@/lib/server/stripe'
import type { AutoRecharge, DBUser } from './session'

// Master switch: auto-recharge charges a saved card OFF-SESSION, so it stays OFF
// until explicitly enabled AND validated against Stripe test mode.
export const AUTORECHARGE_ENABLED = (process.env.CONDUCTOR_AUTORECHARGE || 'off').toLowerCase() === 'on'

interface RechargeStore {
  getAutoRecharge(userId: string): Promise<AutoRecharge | null>
  claimRecharge(userId: string): Promise<boolean>
  clearRecharge(userId: string): Promise<void>
}

/**
 * Best-effort: when a user's top-up credit drops to/below their threshold and
 * they've opted in (and a card is on file), fire ONE off-session top-up. Gated
 * four ways — global flag, Stripe configured, user opt-in + saved customer — and
 * an atomic claim prevents concurrent low-credit turns from double-charging. The
 * credit itself is granted by the payment_intent.succeeded webhook (idempotent).
 */
export async function maybeAutoRecharge(user: DBUser, creditBalanceUSD: number): Promise<void> {
  if (!AUTORECHARGE_ENABLED || !stripeConfigured() || !user.stripeCustomerId) return
  const store = (await getStore()) as unknown as RechargeStore
  const ar = await store.getAutoRecharge(user.id)
  if (!ar?.enabled || !ar.packId || creditBalanceUSD > ar.thresholdUSD) return
  const pack = topupPack(ar.packId)
  if (!pack) return
  if (!(await store.claimRecharge(user.id))) return // a recharge is already in flight

  try {
    await chargeOffSession({
      customerId: user.stripeCustomerId,
      amountUSD: pack.priceUSD,
      metadata: { kind: 'auto-topup', userId: user.id, creditUSD: String(pack.creditUSD), packId: pack.id },
    })
    // Success → credit is granted by the webhook (payment_intent.succeeded).
  } catch {
    // No card / decline / SCA-required → release the claim. The webhook's
    // payment_intent.payment_failed handler disables auto-recharge for hard
    // failures so we never hammer a failing card.
    await store.clearRecharge(user.id)
  }
}
