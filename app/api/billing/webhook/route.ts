import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { grantCredits } from '@/lib/credits'

// Stripe requires the raw request body to verify the signature.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 501 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const userId = s.metadata?.userId
        const credits = Number(s.metadata?.credits ?? 0)
        const planId = s.metadata?.planId
        if (userId && credits > 0) {
          await grantCredits(
            userId,
            credits,
            s.mode === 'subscription' ? 'monthly_grant' : 'topup'
          )
          if (s.mode === 'subscription' && planId) {
            const db = await getDb()
            await db
              .update(schema.users)
              .set({
                plan: planId,
                stripeSubscriptionId:
                  typeof s.subscription === 'string' ? s.subscription : null,
              })
              .where(eq(schema.users.id, userId))
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // Only handle renewals here; the first invoice is covered by
        // checkout.session.completed to avoid double-granting.
        if (invoice.billing_reason === 'subscription_cycle') {
          const subId = (invoice as unknown as { subscription?: string })
            .subscription
          if (subId) {
            const stripe = getStripe()
            const sub = await stripe.subscriptions.retrieve(subId)
            const userId = sub.metadata?.userId
            const credits = Number(sub.metadata?.credits ?? 0)
            if (userId && credits > 0) {
              await grantCredits(userId, credits, 'monthly_grant')
            }
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          const db = await getDb()
          await db
            .update(schema.users)
            .set({ plan: 'free', stripeSubscriptionId: null })
            .where(eq(schema.users.id, userId))
        }
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`Failed to handle webhook ${event.type}:`, error)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
