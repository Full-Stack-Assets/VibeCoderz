import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getStore } from '@conductor/agent-memory'
import { generateApiKey } from '../lib/server/apikey.ts'
import { POST } from '../app/api/v1/chat/route.ts'

const bearer = (key: string, body: unknown) =>
  new Request('https://x/api/v1/chat', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('the public API rejects a Free-plan key with 402 (no paid access on a lapsed/downgraded account)', async () => {
  const store = (await getStore()) as unknown as {
    createUser(i: { email: string; passwordHash: string; plan?: string }): Promise<{ id: string }>
    createApiKey(userId: string, label: string | undefined, hash: string): Promise<unknown>
    updateUser(id: string, patch: Record<string, unknown>): Promise<unknown>
  }
  const user = await store.createUser({ email: 'free-api@x.com', passwordHash: 'h', plan: 'free' })
  const { key, hash } = generateApiKey()
  await store.createApiKey(user.id, 'k', hash)

  const res = await POST(bearer(key, { messages: [{ role: 'user', content: 'hi' }] }))
  assert.equal(res.status, 402, 'a Free-plan key is denied at call time, not just at key creation')

  // A paid plan clears the gate (it does not 402 on the plan check).
  await store.updateUser(user.id, { plan: 'pro' })
  const res2 = await POST(bearer(key, { messages: [{ role: 'user', content: 'hi' }] }))
  assert.notEqual(res2.status, 402, 'a paid plan is not blocked by the API gate')
})

test('the public API rejects a missing/invalid key with 401', async () => {
  const res = await POST(
    new Request('https://x/api/v1/chat', { method: 'POST', body: '{}' })
  )
  assert.equal(res.status, 401)
})
