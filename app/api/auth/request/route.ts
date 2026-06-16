import { NextResponse, type NextRequest } from 'next/server'
import { checkBotId } from 'botid/server'
import { z } from 'zod'
import { createLoginChallenge } from '@/lib/login-tokens'
import { sendLoginEmail } from '@/lib/email'
import { rateLimit, clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const bodySchema = z.object({ email: z.string().email() })

/**
 * Step 1 of email sign-in: issue a single-use magic link + OTP code to a
 * verified address. Replaces the old passwordless login that created an account
 * (and granted credits) for ANY email with no proof of ownership. We never
 * reveal whether the email already has an account — always a 200 — to avoid
 * account enumeration. The account is only created later, on verify.
 */
export async function POST(req: NextRequest) {
  const check = await checkBotId()
  if (check.isBot) return NextResponse.json({ error: 'Bot detected' }, { status: 403 })

  let email: string
  try {
    email = bodySchema.parse(await req.json()).email.toLowerCase().trim()
  } catch {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  // Throttle by email and by IP to blunt spamming inboxes / token grinding.
  const ip = clientIp(req)
  if (!rateLimit(`auth-req:email:${email}`, 5, 15 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  if (!rateLimit(`auth-req:ip:${ip}`, 15, 15 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  try {
    const { code, token } = await createLoginChallenge(email)
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(req.url).origin
    const link = `${origin}/api/auth/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
    await sendLoginEmail({ email, code, link })
  } catch (error) {
    console.error('Failed to issue login challenge:', error)
    return NextResponse.json({ error: 'Could not send the sign-in email.' }, { status: 500 })
  }

  // Always 200 — do not leak whether the address exists.
  return NextResponse.json({ ok: true })
}
