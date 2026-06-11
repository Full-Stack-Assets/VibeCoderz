import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, passwordProblem } from '../lib/server/password.ts'

test('hash/verify round-trips and rejects the wrong password', async () => {
  const stored = await hashPassword('correct horse battery')
  assert.match(stored, /^[0-9a-f]+:[0-9a-f]+$/)
  assert.ok(await verifyPassword('correct horse battery', stored))
  assert.ok(!(await verifyPassword('wrong', stored)))
})

test('each hash uses a fresh salt', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'))
})

test('verifyPassword tolerates a malformed stored value', async () => {
  assert.equal(await verifyPassword('x', 'not-a-valid-hash'), false)
})

test('passwordProblem enforces a minimum length', () => {
  assert.ok(passwordProblem('short'))
  assert.equal(passwordProblem('longenough1'), null)
})
