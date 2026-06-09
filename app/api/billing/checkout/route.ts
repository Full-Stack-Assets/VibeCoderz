import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getStripe, getAppUrl } from '@/lib/stripe'
import { PLANS } from '@/lib/billing'

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let planId: string
  try {
    const body = await req.json()
    planId = String(body.plan)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const plan = PLANS[planId]
  if (!plan) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  }

  const priceId = process.env[plan.priceEnv]
  if (!priceId) {
    return NextResponse.json(
      { error: 'This plan is not available yet.' },
      { status: 501 }
    )
  }

  try {
    const stripe = getStripe()
    const db = await getDb()
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.sub),
    })
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Ensure a Stripe customer exists for this user.
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await db
        .update(schema.users)
        .set({ stripeCustomerId: customerId })
        .where(eq(schema.users.id, user.id))
    }

    const appUrl = getAppUrl()
    const metadata = {
      userId: user.id,
      planId: plan.id,
      credits: String(plan.credits),
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: plan.mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      metadata,
      ...(plan.mode === 'subscription'
        ? { subscription_data: { metadata } }
        : {}),
    })

    return NextResponse.json({ url: checkout.url })
  } catch (error) {
    console.error('Checkout failed:', error)
    const message =
      error instanceof Error ? error.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
