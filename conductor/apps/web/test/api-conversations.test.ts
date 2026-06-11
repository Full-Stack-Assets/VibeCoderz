import { test } from 'node:test'
import assert from 'node:assert/strict'

// Bracketed dynamic route path — encode the [id] segment for the import URL.
const idRoute = (await import('../app/api/conversations/%5Bid%5D/route.ts')) as {
  GET: Handler
  PUT: Handler
  PATCH: Handler
  DELETE: Handler
}
const listRoute = (await import('../app/api/conversations/route.ts')) as { GET: (req: Request) => Promise<Response> }

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string, id: string, user?: string, body?: unknown) =>
  new Request(`http://t/api/conversations/${id}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(user ? { 'x-user-id': user } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const listReq = (user?: string) =>
  new Request('http://t/api/conversations', { headers: user ? { 'x-user-id': user } : {} })

test('requests without an account id are rejected', async () => {
  assert.equal((await listRoute.GET(listReq())).status, 401)
  assert.equal((await idRoute.PUT(req('PUT', 'c1', undefined, {}), ctx('c1'))).status, 401)
})

test('PUT upserts a snapshot the owner can read back and list', async () => {
  const snap = { id: 'conv-a', title: 'Hello world', updatedAt: 5, messages: [{ id: 'm', role: 'user', content: 'hi' }] }
  assert.equal((await idRoute.PUT(req('PUT', 'conv-a', 'alice', snap), ctx('conv-a'))).status, 200)

  const got = await idRoute.GET(req('GET', 'conv-a', 'alice'), ctx('conv-a'))
  assert.equal(got.status, 200)
  assert.equal((await got.json()).conversation.title, 'Hello world')

  const list = await (await listRoute.GET(listReq('alice'))).json()
  assert.ok(list.conversations.some((c: { id: string }) => c.id === 'conv-a'))
})

test('one account cannot read or delete another account’s conversation', async () => {
  const snap = { id: 'conv-b', title: 'Secret', updatedAt: 1, messages: [] }
  await idRoute.PUT(req('PUT', 'conv-b', 'bob', snap), ctx('conv-b'))
  assert.equal((await idRoute.GET(req('GET', 'conv-b', 'mallory'), ctx('conv-b'))).status, 404)
  assert.equal((await idRoute.DELETE(req('DELETE', 'conv-b', 'mallory'), ctx('conv-b'))).status, 404)
  assert.equal((await idRoute.GET(req('GET', 'conv-b', 'bob'), ctx('conv-b'))).status, 200)
})

test('PATCH renames and DELETE removes', async () => {
  const snap = { id: 'conv-c', title: 'Before', updatedAt: 1, messages: [] }
  await idRoute.PUT(req('PUT', 'conv-c', 'carol', snap), ctx('conv-c'))
  assert.equal((await idRoute.PATCH(req('PATCH', 'conv-c', 'carol', { title: 'After' }), ctx('conv-c'))).status, 200)
  const list = await (await listRoute.GET(listReq('carol'))).json()
  assert.equal(list.conversations.find((c: { id: string }) => c.id === 'conv-c').title, 'After')

  assert.equal((await idRoute.DELETE(req('DELETE', 'conv-c', 'carol'), ctx('conv-c'))).status, 200)
  assert.equal((await idRoute.GET(req('GET', 'conv-c', 'carol'), ctx('conv-c'))).status, 404)
})
