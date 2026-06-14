import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PlanId } from './session'

/**
 * Minimal Stripe client over the REST API (no SDK dependency). All calls are
 * form-encoded POSTs authenticated with STRIPE_SECRET_KEY. Configure:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_MAX
 */
const STRIPE_API = 'https://api.stripe.com/v1'

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY

export function priceIdForPlan(plan: PlanId): string | undefined {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO
  if (plan === 'max') return process.env.STRIPE_PRICE_MAX
  return undefined
}

/** Reverse a Stripe price id back to a plan (for subscription webhooks). */
export function planForPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_MAX) return 'max'
  return null
}

function form(data: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(data)) if (v != null) p.append(k, v)
  return p.toString()
}

async function stripePost(path: string, body: Record<string, string | undefined>) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured.')
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: { message?: string } })?.error?.message || `Stripe error ${res.status}`)
  return json
}

export async function createCheckoutSession(opts: {
  priceId: string
  userId: string
  plan: PlanId
  customerId?: string | null
  email?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string }> {
  const session = (await stripePost('/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': '1',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.userId,
    customer: opts.customerId || undefined,
    customer_email: opts.customerId ? undefined : opts.email,
    'metadata[userId]': opts.userId,
    'metadata[plan]': opts.plan,
    'subscription_data[metadata][userId]': opts.userId,
    'subscription_data[metadata][plan]': opts.plan,
  })) as { url?: string }
  if (!session.url) throw new Error('Stripe did not return a checkout URL.')
  return { url: session.url }
}

/**
 * One-time payment Checkout for a top-up pack. Uses inline price_data so no
 * pre-created Stripe price is needed. The granted credit is stamped into the
 * session metadata (server-controlled) and read back by the webhook — the
 * browser only ever names a pack id, never the credit amount.
 */
export async function createTopupCheckoutSession(opts: {
  userId: string
  packId: string
  priceUSD: number
  creditUSD: number
  customerId?: string | null
  email?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string }> {
  const session = (await stripePost('/checkout/sessions', {
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `VibeCoderz routing credit ($${opts.creditUSD})`,
    'line_items[0][price_data][unit_amount]': String(Math.round(opts.priceUSD * 100)),
    'line_items[0][quantity]': '1',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.userId,
    customer: opts.customerId || undefined,
    customer_email: opts.customerId ? undefined : opts.email,
    'metadata[kind]': 'topup',
    'metadata[userId]': opts.userId,
    'metadata[packId]': opts.packId,
    'metadata[creditUSD]': String(opts.creditUSD),
  })) as { url?: string }
  if (!session.url) throw new Error('Stripe did not return a checkout URL.')
  return { url: session.url }
}

export async function createPortalSession(opts: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
  const session = (await stripePost('/billing_portal/sessions', {
    customer: opts.customerId,
    return_url: opts.returnUrl,
  })) as { url?: string }
  if (!session.url) throw new Error('Stripe did not return a portal URL.')
  return { url: session.url }
}

/** Verify a Stripe webhook signature (the `Stripe-Signature` header). */
export function verifyWebhook(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=')
      return [kv.slice(0, i), kv.slice(i + 1)]
    })
  )
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(v1)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
