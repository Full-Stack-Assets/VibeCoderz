import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit, clientIp, _resetRateLimit } from '../lib/server/ratelimit.ts'

test('rateLimit allows up to the limit, then blocks with a retry-after', () => {
  _resetRateLimit()
  const key = 'login:ip:1.2.3.4'
  for (let i = 0; i < 5; i++) {
    assert.equal(rateLimit(key, 5, 60_000).ok, true, `hit ${i + 1} allowed`)
  }
  const blocked = rateLimit(key, 5, 60_000)
  assert.equal(blocked.ok, false, '6th hit blocked')
  assert.ok(blocked.retryAfterSec > 0, 'reports a retry-after')
  // A different key is independent.
  assert.equal(rateLimit('login:ip:5.6.7.8', 5, 60_000).ok, true)
})

test('clientIp reads x-forwarded-for (first hop), else x-real-ip, else unknown', () => {
  assert.equal(clientIp(new Request('https://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })), '9.9.9.9')
  assert.equal(clientIp(new Request('https://x', { headers: { 'x-real-ip': '8.8.8.8' } })), '8.8.8.8')
  assert.equal(clientIp(new Request('https://x')), 'unknown')
})
