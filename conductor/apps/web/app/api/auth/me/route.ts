import { currentUser, toPublicUser } from '@/lib/server/session'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await currentUser(req)
  return Response.json({ user: user ? toPublicUser(user) : null })
}
