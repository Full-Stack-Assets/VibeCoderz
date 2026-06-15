import { authStore, startSession, toPublicUser } from '@/lib/server/session'
import { hashPassword, passwordProblem } from '@/lib/server/password'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/server/ratelimit'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The owner account (you) is granted admin + the top plan automatically.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'nsalbertson26@gmail.com').trim().toLowerCase()

export async function POST(req: Request) {
  // Throttle sign-ups per IP to blunt abuse/enumeration.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 10 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec)

  let body: { email?: string; name?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const name = body.name ? String(body.name).trim().slice(0, 80) : null
  const password = String(body.password ?? '')

  if (!EMAIL_RE.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
  const pwProblem = passwordProblem(password)
  if (pwProblem) return Response.json({ error: pwProblem }, { status: 400 })

  const store = await authStore()
  if (await store.getUserByEmail(email)) {
    return Response.json({ error: 'An account with that email already exists. Try signing in.' }, { status: 409 })
  }

  const isOwner = email === OWNER_EMAIL
  const user = await store.createUser({
    email,
    name,
    passwordHash: await hashPassword(password),
    plan: isOwner ? 'max' : 'free',
    role: isOwner ? 'admin' : 'user',
  })
  await startSession(user.id)
  return Response.json({ user: toPublicUser(user) })
}
