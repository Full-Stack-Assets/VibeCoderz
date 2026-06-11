import { endSession } from '@/lib/server/session'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  await endSession(req)
  return Response.json({ ok: true })
}
