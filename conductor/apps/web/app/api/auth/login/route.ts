import { authStore, startSession, toPublicUser } from '@/lib/server/session'
import { verifyPassword } from '@/lib/server/password'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/server/ratelimit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  // Throttle by IP and by target email to blunt credential stuffing / brute force.
  const ip = clientIp(req)
  const byIp = rateLimit(`login:ip:${ip}`, 10, 10 * 60 * 1000)
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSec)
  if (email) {
    const byEmail = rateLimit(`login:email:${email}`, 5, 10 * 60 * 1000)
    if (!byEmail.ok) return tooManyRequests(byEmail.retryAfterSec)
  }

  const store = await authStore()
  const user = await store.getUserByEmail(email)
  // Verify even when the user is missing would be ideal for timing; a fixed
  // message avoids leaking which half was wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json({ error: 'Incorrect email or password.' }, { status: 401 })
  }
  await startSession(user.id)
  return Response.json({ user: toPublicUser(user) })
}
