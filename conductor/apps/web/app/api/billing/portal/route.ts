import { currentUser } from '@/lib/server/session'
import { createPortalSession, stripeConfigured } from '@/lib/server/stripe'

export const runtime = 'nodejs'

// Open the Stripe billing portal so the customer can manage/cancel.
export async function POST(req: Request) {
  if (!stripeConfigured()) return Response.json({ error: 'Billing is not configured yet.' }, { status: 503 })
  const user = await currentUser(req)
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
  if (!user.stripeCustomerId) {
    return Response.json({ error: 'No billing account yet — subscribe to a plan first.' }, { status: 400 })
  }
  const origin = new URL(req.url).origin
  try {
    const { url } = await createPortalSession({ customerId: user.stripeCustomerId, returnUrl: `${origin}/` })
    return Response.json({ url })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
