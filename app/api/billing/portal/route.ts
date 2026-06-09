import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getStripe, getAppUrl } from '@/lib/stripe'

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const db = await getDb()
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.sub),
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account yet. Buy credits first.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: getAppUrl(),
    })

    return NextResponse.json({ url: portal.url })
  } catch (error) {
    console.error('Portal failed:', error)
    const message = error instanceof Error ? error.message : 'Portal failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
