import { getStore } from '@conductor/agent-memory'
import { currentUser } from '@/lib/server/session'

export const runtime = 'nodejs'

interface MemoryItem {
  id: string
  text: string
  createdAt: number
}
interface MemoryStore {
  listMemories?: (userId: string) => Promise<MemoryItem[]>
  addMemory?: (userId: string, text: string) => Promise<MemoryItem>
  deleteMemory?: (userId: string, memoryId: string) => Promise<boolean>
}

const MAX_LEN = 500
const MAX_COUNT = 50

/** List the signed-in user's durable memories. */
export async function GET(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  const store = (await getStore()) as MemoryStore
  const memories = (await store.listMemories?.(user.id)) ?? []
  return Response.json({ memories })
}

/** Add a memory ({ text }). Capped in length and count. */
export async function POST(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  let body: { text?: string }
  try {
    body = (await req.json()) as { text?: string }
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const text = String(body.text ?? '').trim()
  if (!text) return new Response('text is required', { status: 400 })
  if (text.length > MAX_LEN) return new Response(`text too long (max ${MAX_LEN})`, { status: 400 })

  const store = (await getStore()) as MemoryStore
  const existing = (await store.listMemories?.(user.id)) ?? []
  if (existing.length >= MAX_COUNT) return new Response(`memory limit reached (${MAX_COUNT})`, { status: 409 })
  const memory = await store.addMemory?.(user.id, text)
  return Response.json({ memory })
}

/** Delete a memory by id (?id=). */
export async function DELETE(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('id is required', { status: 400 })
  const store = (await getStore()) as MemoryStore
  const ok = (await store.deleteMemory?.(user.id, id)) ?? false
  return Response.json({ ok })
}
