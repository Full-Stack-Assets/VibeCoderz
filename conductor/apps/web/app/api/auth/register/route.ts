import { authStore, startSession, toPublicUser } from '@/lib/server/session'
import { hashPassword, passwordProblem } from '@/lib/server/password'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/server/ratelimit'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The owner account (you) is granted admin + the top plan automatically.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'nsalbertson26@gmail.com').trim().toLowerCase()
// Top-up credit granted to BOTH sides when a new account signs up via a referral.
const REFERRAL_BONUS_USD = Number(process.env.REFERRAL_BONUS_USD) || 5

export async function POST(req: Request) {
  // Throttle sign-ups per IP to blunt abuse/enumeration.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec)

  let body: { email?: string; name?: string; password?: string; referralCode?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const name = body.name ? String(body.name).trim().slice(0, 80) : null
  const password = String(body.password ?? '')
  const referralCode = String(body.referralCode ?? '').trim()

  if (!EMAIL_RE.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
  const pwProblem = passwordProblem(password)
  if (pwProblem) return Response.json({ error: pwProblem }, { status: 400 })

  const store = await authStore()
  if (await store.getUserByEmail(email)) {
    return Response.json({ error: 'An account with that email already exists. Try signing in.' }, { status: 409 })
  }

  // Resolve a referral code (if any) to the referring account before creating.
  const referrer = referralCode ? await store.getUserByReferralCode(referralCode) : null

  const isOwner = email === OWNER_EMAIL
  const user = await store.createUser({
    email,
    name,
    passwordHash: await hashPassword(password),
    plan: isOwner ? 'max' : 'free',
    role: isOwner ? 'admin' : 'user',
    referredBy: referrer ? referrer.id : null,
  })
  await startSession(user.id)

  // Give-$5-get-$5: credit both the new user and the referrer. Self-referral is
  // impossible (the referee is brand new), and it's one-time by construction
  // (only at signup). Best-effort — never block account creation.
  if (referrer) {
    try {
      await Promise.all([
        store.addUserCredit(user.id, REFERRAL_BONUS_USD),
        store.addUserCredit(referrer.id, REFERRAL_BONUS_USD),
      ])
    } catch {
      /* credit grant is best-effort */
    }
  }

  const fresh = (await store.getUserById(user.id)) ?? user
  return Response.json({ user: toPublicUser(fresh) })
}
