import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, planById, PLANS } from '../lib/auth.ts'

test('isValidEmail accepts well-formed addresses and rejects junk', () => {
  assert.ok(isValidEmail('ada@example.com'))
  assert.ok(isValidEmail('  spaced@example.com  '))
  assert.ok(!isValidEmail('nope'))
  assert.ok(!isValidEmail('a@b'))
  assert.ok(!isValidEmail(''))
})

test('planById falls back to Free for unknown/undefined plans', () => {
  assert.equal(planById('pro').id, 'pro')
  assert.equal(planById(undefined).id, 'free')
  assert.equal(PLANS.length, 3)
})
