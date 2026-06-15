import { currentUser } from '@/lib/server/session'
import { apiKeyStore, generateApiKey } from '@/lib/server/apikey'

export const runtime = 'nodejs'

const MAX_KEYS = 10

/** List the signed-in user's API keys (metadata only — never the secret). */
export async function GET(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  const keys = await (await apiKeyStore()).listApiKeys(user.id)
  return Response.json({ keys })
}

/** Mint a new API key. The plaintext is returned ONCE here and never stored. */
export async function POST(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  // API access is a paid feature — gate key creation to Pro/Max.
  if (user.plan === 'free') {
    return Response.json({ error: 'API access is a paid feature. Upgrade to Pro or Max to create keys.' }, { status: 402 })
  }
  let body: { label?: string } = {}
  try {
    body = (await req.json()) as { label?: string }
  } catch {
    /* label is optional */
  }
  const store = await apiKeyStore()
  const existing = await store.listApiKeys(user.id)
  if (existing.length >= MAX_KEYS) return new Response(`key limit reached (${MAX_KEYS})`, { status: 409 })
  const { key, hash } = generateApiKey()
  const label = String(body.label ?? '').slice(0, 60) || 'API key'
  const rec = await store.createApiKey(user.id, label, hash)
  return Response.json({ key, id: rec.id, label: rec.label })
}

/** Revoke a key by id (?id=). */
export async function DELETE(req: Request) {
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in.', { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('id is required', { status: 400 })
  const ok = await (await apiKeyStore()).revokeApiKey(user.id, id)
  return Response.json({ ok })
}
