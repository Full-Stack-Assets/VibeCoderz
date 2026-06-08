import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'
import { z } from 'zod'
import {
  SESSION_COOKIE,
  SIGNUP_CREDIT_GRANT,
  createSessionToken,
} from '@/lib/auth'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
})

export async function POST(req: NextRequest) {
  const checkResult = await checkBotId()
  if (checkResult.isBot) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 403 })
  }

  let email: string
  let name: string | undefined
  try {
    const parsed = bodySchema.parse(await req.json())
    email = parsed.email.toLowerCase().trim()
    name = parsed.name
  } catch {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  try {
    const db = await getDb()

    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    })

    // First-time login creates the account and grants starter credits.
    if (!user) {
      const inserted = await db
        .insert(schema.users)
        .values({
          email,
          name,
          creditsBalance: SIGNUP_CREDIT_GRANT,
          plan: 'free',
        })
        .returning()
      user = inserted[0]

      await db.insert(schema.creditLedger).values({
        userId: user.id,
        delta: SIGNUP_CREDIT_GRANT,
        reason: 'signup_grant',
        balanceAfter: SIGNUP_CREDIT_GRANT,
      })
    }

    const token = await createSessionToken({ sub: user.id, email: user.email })

    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      creditsBalance: user.creditsBalance,
    })

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return res
  } catch (error) {
    console.error('Login failed:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
