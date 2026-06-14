import { authStore, type PlanId, type DBUser } from '@/lib/server/session'
import { verifyWebhook, planForPriceId } from '@/lib/server/stripe'

export const runtime = 'nodejs'

interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
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

  const store = await authStore()
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
      }
    } else if (event.type === 'checkout.session.completed') {
      const userId = (obj.client_reference_id as string) || meta.userId
      const patch: Partial<DBUser> = { subscriptionStatus: 'active' }
      if (obj.customer) patch.stripeCustomerId = obj.customer as string
      if (meta.plan) patch.plan = meta.plan as PlanId
      if (userId) await store.updateUser(userId, patch)
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
    }
  } catch {
    // Respond 200 even on a handler bug so Stripe doesn't enter retry storms;
    // the event is logged on Stripe's side and can be resent.
  }
  return Response.json({ received: true })
}
