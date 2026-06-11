import { currentUser } from '@/lib/server/session'
import { createCheckoutSession, priceIdForPlan, stripeConfigured } from '@/lib/server/stripe'

export const runtime = 'nodejs'

// Create a Stripe Checkout session for a paid plan and return its URL.
export async function POST(req: Request) {
  if (!stripeConfigured()) return Response.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  const user = await currentUser(req)
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const plan = body.plan
  if (plan !== 'pro' && plan !== 'max') return Response.json({ error: 'Choose a paid plan.' }, { status: 400 })

  const priceId = priceIdForPlan(plan)
  if (!priceId) return Response.json({ error: `No Stripe price configured for the ${plan} plan.` }, { status: 503 })

  const origin = new URL(req.url).origin
  try {
    const { url } = await createCheckoutSession({
      priceId,
      userId: user.id,
      plan,
      customerId: user.stripeCustomerId,
      email: user.email,
      successUrl: `${origin}/?checkout=success`,
      cancelUrl: `${origin}/?checkout=cancelled`,
    })
    return Response.json({ url })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
