import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { SESSION_COOKIE, createSessionToken } from '@/lib/auth'
import { consumeLoginChallenge, type VerifyResult } from '@/lib/login-tokens'
import { upsertUserByVerifiedEmail } from '@/lib/users'
import { rateLimit, clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

const FAILURE_STATUS: Record<Exclude<VerifyResult, 'ok'>, number> = {
  invalid: 401,
  expired: 410,
  throttled: 429,
}
const FAILURE_MESSAGE: Record<Exclude<VerifyResult, 'ok'>, string> = {
  invalid: 'That code or link is invalid.',
  expired: 'That sign-in link has expired. Request a new one.',
  throttled: 'Too many attempts. Request a new code.',
}

/** Mint a verified session for `email` (creates the account on first sign-in). */
async function issueSession(email: string) {
  const user = await upsertUserByVerifiedEmail(email)
  const token = await createSessionToken({ sub: user.id, email: user.email })
  return { user, token }
}

/** Step 2a — OTP code entered in the UI. */
const bodySchema = z.object({ email: z.string().email(), code: z.string().min(4).max(12) })

export async function POST(req: NextRequest) {
  let email: string
  let code: string
  try {
    const parsed = bodySchema.parse(await req.json())
    email = parsed.email.toLowerCase().trim()
    code = parsed.code.trim()
  } catch {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }
  if (!rateLimit(`auth-verify:${clientIp(req)}`, 30, 15 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const result = await consumeLoginChallenge(email, { code })
  if (result !== 'ok') {
    return NextResponse.json({ error: FAILURE_MESSAGE[result] }, { status: FAILURE_STATUS[result] })
  }
  const { user, token } = await issueSession(email)
  const res = NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    creditsBalance: user.creditsBalance,
  })
  setSessionCookie(res, token)
  return res
}

/** Step 2b — magic link clicked from the email. Verifies then redirects home. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const email = (url.searchParams.get('email') || '').toLowerCase().trim()
  const token = url.searchParams.get('token') || ''
  const home = new URL('/', url.origin)

  if (!email || !token) {
    home.searchParams.set('auth_error', 'invalid')
    return NextResponse.redirect(home)
  }
  if (!rateLimit(`auth-verify:${clientIp(req)}`, 30, 15 * 60 * 1000).ok) {
    home.searchParams.set('auth_error', 'throttled')
    return NextResponse.redirect(home)
  }

  const result = await consumeLoginChallenge(email, { token })
  if (result !== 'ok') {
    home.searchParams.set('auth_error', result)
    return NextResponse.redirect(home)
  }

  const { token: sessionToken } = await issueSession(email)
  const redirect = NextResponse.redirect(home)
  setSessionCookie(redirect, sessionToken)
  return redirect
}
