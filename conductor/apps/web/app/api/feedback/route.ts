import { getStore } from '@conductor/agent-memory'
import { currentUser } from '@/lib/server/session'

export const runtime = 'nodejs'

interface FeedbackStore {
  recordFeedback?: (conversationId: string, messageId: string, signal: string) => Promise<boolean>
}

interface Body {
  conversationId?: string
  messageId?: string
  signal?: string
}

/**
 * Record a per-turn quality label ('up' | 'down') against a stored assistant
 * message — the human-feedback channel of the measured-advantage flywheel. The
 * signal merges into the message's meta next to its routing/escalation data.
 */
export async function POST(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const { conversationId, messageId, signal } = body
  if (!conversationId || !messageId || (signal !== 'up' && signal !== 'down')) {
    return new Response('conversationId, messageId, and signal (up|down) are required', { status: 400 })
  }

  const store = (await getStore()) as FeedbackStore
  const ok = (await store.recordFeedback?.(conversationId, messageId, signal)) ?? false
  return Response.json({ ok })
}
