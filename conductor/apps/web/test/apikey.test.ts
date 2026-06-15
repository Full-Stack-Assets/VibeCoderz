import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashKey, generateApiKey, keyFromRequest } from '../lib/server/apikey.ts'

test('hashKey is deterministic and not the plaintext', () => {
  assert.equal(hashKey('sk_cond_abc'), hashKey('sk_cond_abc'))
  assert.notEqual(hashKey('sk_cond_abc'), 'sk_cond_abc')
  assert.equal(hashKey('sk_cond_abc').length, 64) // sha-256 hex
})

test('generateApiKey returns a prefixed key and its matching hash', () => {
  const { key, hash } = generateApiKey()
  assert.match(key, /^sk_cond_[A-Za-z0-9_-]+$/)
  assert.equal(hash, hashKey(key))
  // Two keys are distinct.
  assert.notEqual(generateApiKey().key, generateApiKey().key)
})

test('keyFromRequest reads Bearer and X-API-Key, else null', () => {
  const bearer = new Request('https://x/api', { headers: { authorization: 'Bearer sk_cond_xyz' } })
  assert.equal(keyFromRequest(bearer), 'sk_cond_xyz')
  const xkey = new Request('https://x/api', { headers: { 'x-api-key': 'sk_cond_123' } })
  assert.equal(keyFromRequest(xkey), 'sk_cond_123')
  assert.equal(keyFromRequest(new Request('https://x/api')), null)
})
