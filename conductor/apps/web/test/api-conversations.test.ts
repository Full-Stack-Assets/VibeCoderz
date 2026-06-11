import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getStore } from '@conductor/agent-memory'

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
const idRoute = (await import('../app/api/conversations/%5Bid%5D/route.ts')) as {
  GET: Handler
  PUT: Handler
  PATCH: Handler
  DELETE: Handler
}
const listRoute = (await import('../app/api/conversations/route.ts')) as { GET: (req: Request) => Promise<Response> }

interface Store {
  createUser(i: { email: string; passwordHash: string }): Promise<{ id: string }>
  createSession(userId: string, token: string, expiresAt: number): Promise<unknown>
}
const store = (await getStore()) as unknown as Store

let seq = 0
async function account(): Promise<string> {
  const u = await store.createUser({ email: `u${seq++}@t.com`, passwordHash: 'x' })
  const token = `tok_${u.id}`
  await store.createSession(u.id, token, Date.now() + 100000)
  return token
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const cookie = (token?: string) => (token ? { cookie: `conductor_session=${token}` } : {})
const req = (method: string, id: string, token?: string, body?: unknown) =>
  new Request(`http://t/api/conversations/${id}`, {
    method,
    headers: { 'content-type': 'application/json', ...cookie(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const listReq = (token?: string) => new Request('http://t/api/conversations', { headers: cookie(token) })

test('requests without a valid session are rejected', async () => {
  assert.equal((await listRoute.GET(listReq())).status, 401)
  assert.equal((await idRoute.PUT(req('PUT', 'c1', undefined, {}), ctx('c1'))).status, 401)
  assert.equal((await idRoute.GET(req('GET', 'c1', 'bogus-token'), ctx('c1'))).status, 401)
})

test('PUT upserts a snapshot the owner can read back and list', async () => {
  const token = await account()
  const snap = { id: 'conv-a', title: 'Hello world', updatedAt: 5, messages: [{ id: 'm', role: 'user', content: 'hi' }] }
  assert.equal((await idRoute.PUT(req('PUT', 'conv-a', token, snap), ctx('conv-a'))).status, 200)

  const got = await idRoute.GET(req('GET', 'conv-a', token), ctx('conv-a'))
  assert.equal(got.status, 200)
  assert.equal((await got.json()).conversation.title, 'Hello world')

  const list = await (await listRoute.GET(listReq(token))).json()
  assert.ok(list.conversations.some((c: { id: string }) => c.id === 'conv-a'))
})

test('one account cannot read or delete another account’s conversation', async () => {
  const owner = await account()
  const other = await account()
  await idRoute.PUT(req('PUT', 'conv-b', owner, { id: 'conv-b', title: 'Secret', updatedAt: 1, messages: [] }), ctx('conv-b'))
  assert.equal((await idRoute.GET(req('GET', 'conv-b', other), ctx('conv-b'))).status, 404)
  assert.equal((await idRoute.DELETE(req('DELETE', 'conv-b', other), ctx('conv-b'))).status, 404)
  assert.equal((await idRoute.GET(req('GET', 'conv-b', owner), ctx('conv-b'))).status, 200)
})

test('PATCH renames and DELETE removes', async () => {
  const token = await account()
  await idRoute.PUT(req('PUT', 'conv-c', token, { id: 'conv-c', title: 'Before', updatedAt: 1, messages: [] }), ctx('conv-c'))
  assert.equal((await idRoute.PATCH(req('PATCH', 'conv-c', token, { title: 'After' }), ctx('conv-c'))).status, 200)
  const list = await (await listRoute.GET(listReq(token))).json()
  assert.equal(list.conversations.find((c: { id: string }) => c.id === 'conv-c').title, 'After')

  assert.equal((await idRoute.DELETE(req('DELETE', 'conv-c', token), ctx('conv-c'))).status, 200)
  assert.equal((await idRoute.GET(req('GET', 'conv-c', token), ctx('conv-c'))).status, 404)
})
