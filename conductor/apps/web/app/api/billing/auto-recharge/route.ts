import { currentUser } from '@/lib/server/session'
import { getStore } from '@conductor/agent-memory'
import { topupPack } from '@/lib/auth'
import { AUTORECHARGE_ENABLED } from '@/lib/server/autorecharge'
import type { AutoRecharge } from '@/lib/server/session'

export const runtime = 'nodejs'

interface RechargeStore {
  getAutoRecharge(userId: string): Promise<AutoRecharge | null>
  setAutoRecharge(userId: string, patch: Partial<Omit<AutoRecharge, 'inFlightAt'>>): Promise<AutoRecharge | null>
}

/** Read the user's auto-recharge settings (+ whether the feature is enabled). */
export async function GET(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  const store = (await getStore()) as unknown as RechargeStore
  const settings = (await store.getAutoRecharge(user.id)) ?? { enabled: false, thresholdUSD: 0, packId: null }
  return Response.json({ available: AUTORECHARGE_ENABLED, settings })
}

/** Update auto-recharge settings. Requires a paid plan + a configured pack. */
export async function POST(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  if (!AUTORECHARGE_ENABLED) return Response.json({ error: 'Auto-recharge is not available yet.' }, { status: 503 })

  let body: { enabled?: boolean; thresholdUSD?: number; packId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  // Enabling requires a valid pack + a saved card (a prior top-up created one).
  if (body.enabled) {
    if (!body.packId || !topupPack(body.packId)) return Response.json({ error: 'Choose a valid top-up pack.' }, { status: 400 })
    if (!user.stripeCustomerId) {
      return Response.json({ error: 'Buy a top-up first so a card is on file, then enable auto-recharge.' }, { status: 409 })
    }
  }
  const store = (await getStore()) as unknown as RechargeStore
  const settings = await store.setAutoRecharge(user.id, {
    enabled: body.enabled,
    thresholdUSD: body.thresholdUSD,
    packId: body.packId,
  })
  return Response.json({ settings })
}
