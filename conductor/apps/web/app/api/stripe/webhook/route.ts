import { authStore, type PlanId, type DBUser, type AuthStore } from '@/lib/server/session'
import { verifyWebhook, planForPriceId } from '@/lib/server/stripe'

export const runtime = 'nodejs'

// Give-$5-get-$5, paid out on the referee's FIRST real purchase (not at signup,
// which is farmable). Capped per referrer to blunt bulk self-referral.
const REFERRAL_BONUS_USD = Number(process.env.REFERRAL_BONUS_USD) || 5
const REFERRAL_MAX_REWARDS = Number(process.env.REFERRAL_MAX_REWARDS) || 25

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

/**
 * On a referee's first paid action, atomically claim the one-shot referral
 * payout and credit both sides. No-op if the user wasn't referred, was already
 * rewarded, or the referrer hit the cap. Best-effort — never blocks the event.
 */
async function payReferralIfFirstPayment(store: AuthStore, refereeId: string): Promise<void> {
  // Best-effort: a referral failure must NOT 500 the handler, or Stripe would
  // retry and re-apply the (already-committed) purchase credit/plan change.
  try {
    const referrerId = await store.claimReferralReward(refereeId, REFERRAL_MAX_REWARDS)
    if (!referrerId) return
    await Promise.all([
      store.addUserCredit(refereeId, REFERRAL_BONUS_USD),
      store.addUserCredit(referrerId, REFERRAL_BONUS_USD),
    ])
  } catch (err) {
    console.error('[stripe-webhook] referral payout failed (non-fatal):', err)
  }
}

// Stripe subscription lifecycle → keep each account's plan/status in sync.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!secret || !verifyWebhook(payload, sig, secret)) {
    return new Response('invalid signature', { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response('invalid payload', { status: 400 })
  }
  if (!event.id) return new Response('missing event id', { status: 400 })

  const store = await authStore()

  // Idempotency: claim the event id up front. A duplicate/replayed delivery
  // (Stripe is at-least-once) is acknowledged without re-applying side effects —
  // critical for one-time top-ups, which would otherwise grant credit twice.
  if (!(await store.markEventProcessed(event.id))) {
    return Response.json({ received: true, duplicate: true })
  }

  const obj = event.data.object as Record<string, unknown>
  const meta = (obj.metadata as Record<string, string> | undefined) ?? {}

  try {
    if (event.type === 'checkout.session.completed' && meta.kind === 'topup') {
      // One-time credit purchase — grant the server-stamped credit amount.
      const userId = (obj.client_reference_id as string) || meta.userId
      const creditUSD = Number(meta.creditUSD)
      if (userId && creditUSD > 0) {
        await store.addUserCredit(userId, creditUSD)
        if (obj.customer) await store.updateUser(userId, { stripeCustomerId: obj.customer as string })
        await payReferralIfFirstPayment(store, userId)
      }
    } else if (event.type === 'checkout.session.completed') {
      const userId = (obj.client_reference_id as string) || meta.userId
      const patch: Partial<DBUser> = { subscriptionStatus: 'active' }
      if (obj.customer) patch.stripeCustomerId = obj.customer as string
      if (meta.plan) patch.plan = meta.plan as PlanId
      if (userId) {
        await store.updateUser(userId, patch)
        await payReferralIfFirstPayment(store, userId)
      }
    } else if (event.type === 'customer.subscription.updated') {
      const userId = meta.userId
      const items = obj.items as { data?: { price?: { id?: string } }[] } | undefined
      const plan = planForPriceId(items?.data?.[0]?.price?.id)
      const patch: Partial<DBUser> = { subscriptionStatus: obj.status as string }
      if (plan) patch.plan = plan
      if (userId) await store.updateUser(userId, patch)
    } else if (event.type === 'customer.subscription.deleted') {
      const userId = meta.userId
      if (userId) await store.updateUser(userId, { plan: 'free', subscriptionStatus: 'canceled' })
    } else if (event.type === 'payment_intent.succeeded' && meta.kind === 'auto-topup') {
      // Off-session auto-recharge succeeded — grant the credit and clear the claim.
      const userId = meta.userId
      const creditUSD = Number(meta.creditUSD)
      if (userId && creditUSD > 0) {
        await store.addUserCredit(userId, creditUSD)
        await store.clearRecharge(userId)
      }
    } else if (event.type === 'payment_intent.payment_failed' && meta.kind === 'auto-topup') {
      // A failed off-session charge (decline / SCA): release the claim and turn
      // auto-recharge off so we don't hammer a failing card.
      const userId = meta.userId
      if (userId) {
        await store.clearRecharge(userId)
        await store.setAutoRecharge(userId, { enabled: false })
      }
    }
  } catch (err) {
    // A transient failure (e.g. the DB write) must NOT be acknowledged — release
    // the idempotency claim and return 5xx so Stripe retries and the paid grant
    // isn't silently lost. The claim makes the retry safe from double-applying.
    console.error('[stripe-webhook] handler failed:', err)
    try {
      await store.releaseEvent(event.id)
    } catch {
      /* best-effort release */
    }
    return new Response('handler error', { status: 500 })
  }
  return Response.json({ received: true })
}
