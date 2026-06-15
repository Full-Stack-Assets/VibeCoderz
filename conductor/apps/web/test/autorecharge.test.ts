import { test } from 'node:test'
import assert from 'node:assert/strict'

// AUTORECHARGE_ENABLED and stripeConfigured() are read when the module loads,
// so the env must be set before the dynamic import below.
test('a synchronous decline/SCA disables auto-recharge (not just the async webhook)', async () => {
  process.env.CONDUCTOR_AUTORECHARGE = 'on'
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'

  const { getStore } = await import('@conductor/agent-memory')
  const { maybeAutoRecharge } = await import('../lib/server/autorecharge.ts')

  const store = (await getStore()) as unknown as {
    createUser(i: { email: string; passwordHash: string }): Promise<{ id: string }>
    updateUser(id: string, patch: Record<string, unknown>): Promise<unknown>
    setAutoRecharge(id: string, patch: Record<string, unknown>): Promise<unknown>
    getAutoRecharge(id: string): Promise<{ enabled: boolean; inFlightAt: number | null }>
    getUserById(id: string): Promise<Record<string, unknown>>
  }
  const u = await store.createUser({ email: 'ar-decline@x.com', passwordHash: 'h' })
  await store.updateUser(u.id, { stripeCustomerId: 'cus_test' })
  await store.setAutoRecharge(u.id, { enabled: true, thresholdUSD: 5, packId: 'topup_10' })

  // Make the off-session charge fail synchronously (chargeOffSession → fetch).
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('card_declined')
  }) as typeof fetch
  try {
    const fresh = await store.getUserById(u.id)
    await maybeAutoRecharge(fresh as never, 0) // credit below threshold
  } finally {
    globalThis.fetch = realFetch
  }

  const ar = await store.getAutoRecharge(u.id)
  assert.equal(ar.enabled, false, 'a synchronous decline turns auto-recharge off')
  assert.equal(ar.inFlightAt, null, 'and releases the in-flight claim')
})
