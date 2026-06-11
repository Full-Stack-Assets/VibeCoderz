import { getStore } from '@conductor/agent-memory'
import { ownerId, type ConversationStore } from '@/lib/apiUser'

export const runtime = 'nodejs'

const MAX = 100

// GET /api/conversations — full per-account history snapshots, newest first.
// Returns whole snapshots so the client can hydrate its cache in one round-trip.
export async function GET(req: Request) {
  const uid = ownerId(req)
  if (!uid) return new Response('unauthorized', { status: 401 })
  try {
    const store = (await getStore()) as unknown as ConversationStore
    const summaries = (await store.listConversations(uid)).slice(0, MAX)
    const full = await Promise.all(summaries.map((s) => store.getConversation(s.id, uid)))
    const conversations = full.filter(Boolean).map((c) => (c as { snapshot: unknown }).snapshot)
    return Response.json({ conversations })
  } catch {
    return Response.json({ conversations: [] })
  }
}
