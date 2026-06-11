import { getStore } from '@conductor/agent-memory'
import { type ConversationStore } from '@/lib/apiUser'
import { currentUser } from '@/lib/server/session'

export const runtime = 'nodejs'

interface Snapshot {
  id: string
  title?: string
  updatedAt?: number
  messages?: unknown[]
  spentUSD?: number
}

async function store() {
  return (await getStore()) as unknown as ConversationStore
}

// GET — the full snapshot for one conversation (owner-scoped).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req)
  if (!user) return new Response('unauthorized', { status: 401 })
  const { id } = await ctx.params
  const rec = await (await store()).getConversation(id, user.id)
  if (!rec) return new Response('not found', { status: 404 })
  return Response.json({ conversation: rec.snapshot })
}

// PUT — upsert the conversation snapshot (the client's source of truth).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req)
  if (!user) return new Response('unauthorized', { status: 401 })
  const { id } = await ctx.params
  let body: Snapshot
  try {
    body = (await req.json()) as Snapshot
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  await (await store()).upsertConversation({
    id,
    ownerId: user.id,
    title: body.title || 'New conversation',
    updatedAt: body.updatedAt || Date.now(),
    snapshot: body,
  })
  return Response.json({ ok: true })
}

// PATCH — rename.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req)
  if (!user) return new Response('unauthorized', { status: 401 })
  const { id } = await ctx.params
  let title = ''
  try {
    title = String(((await req.json()) as { title?: string }).title ?? '').trim()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!title) return new Response('title required', { status: 400 })
  const ok = await (await store()).renameConversation(id, user.id, title)
  return ok ? Response.json({ ok: true }) : new Response('not found', { status: 404 })
}

// DELETE — remove a conversation the caller owns.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(req)
  if (!user) return new Response('unauthorized', { status: 401 })
  const { id } = await ctx.params
  const ok = await (await store()).deleteConversation(id, user.id)
  return ok ? Response.json({ ok: true }) : new Response('not found', { status: 404 })
}
