import { authStore, startSession, toPublicUser } from '@/lib/server/session'
import { verifyPassword } from '@/lib/server/password'

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
