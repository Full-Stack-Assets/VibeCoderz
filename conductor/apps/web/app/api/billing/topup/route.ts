import { currentUser } from '@/lib/server/session'
import { topupPack } from '@/lib/auth'
import { createTopupCheckoutSession, stripeConfigured } from '@/lib/server/stripe'

export const runtime = 'nodejs'

// Create a Stripe one-time Checkout session to buy a top-up credit pack.
export async function POST(req: Request) {
  if (!stripeConfigured()) return Response.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  const user = await currentUser(req)
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  let body: { pack?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const pack = topupPack(body.pack)
  if (!pack) return Response.json({ error: 'Choose a valid top-up pack.' }, { status: 400 })

  const origin = new URL(req.url).origin
  try {
    const { url } = await createTopupCheckoutSession({
      userId: user.id,
      packId: pack.id,
      priceUSD: pack.priceUSD,
      creditUSD: pack.creditUSD,
      customerId: user.stripeCustomerId,
      email: user.email,
      successUrl: `${origin}/?topup=success`,
      cancelUrl: `${origin}/?topup=cancelled`,
    })
    return Response.json({ url })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
