import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStorage } from './_shim.ts'
import { localAuth, isValidEmail } from '../lib/auth.ts'

beforeEach(() => {
  installBrowserStorage()
})

test('isValidEmail accepts well-formed addresses and rejects junk', () => {
  assert.ok(isValidEmail('ada@example.com'))
  assert.ok(!isValidEmail('nope'))
  assert.ok(!isValidEmail('a@b'))
  assert.ok(!isValidEmail(''))
})

test('requestMagicLink flags a new account and returns a 6-digit demo code', async () => {
  const ch = await localAuth.requestMagicLink('new@example.com', 'Ada')
  assert.equal(ch.isNewUser, true)
  assert.match(ch.devCode ?? '', /^\d{6}$/)
})

test('verifyMagicCode rejects a wrong code and accepts the right one', async () => {
  const ch = await localAuth.requestMagicLink('ada@example.com', 'Ada')
  await assert.rejects(() => localAuth.verifyMagicCode(ch.challengeId, 'XXXXXX'))
  const session = await localAuth.verifyMagicCode(ch.challengeId, ch.devCode!)
  assert.equal(session.user.email, 'ada@example.com')
  assert.equal(session.user.plan, 'free')
  assert.ok(session.token)
})

test('a returning email is not flagged as new and reuses the same account', async () => {
  const first = await localAuth.requestMagicLink('repeat@example.com', 'R')
  const s1 = await localAuth.verifyMagicCode(first.challengeId, first.devCode!)
  const second = await localAuth.requestMagicLink('repeat@example.com')
  assert.equal(second.isNewUser, false)
  const s2 = await localAuth.verifyMagicCode(second.challengeId, second.devCode!)
  assert.equal(s2.user.id, s1.user.id, 'same account id on re-login')
})

test('setPlan persists and restore returns the session until signOut', async () => {
  const ch = await localAuth.requestMagicLink('plan@example.com', 'P')
  await localAuth.verifyMagicCode(ch.challengeId, ch.devCode!)
  const user = await localAuth.setPlan('pro')
  assert.equal(user.plan, 'pro')
  const restored = await localAuth.restore()
  assert.equal(restored?.user.plan, 'pro')
  await localAuth.signOut()
  assert.equal(await localAuth.restore(), null)
})

test('an unverified challenge cannot be reused after verification', async () => {
  const ch = await localAuth.requestMagicLink('once@example.com', 'O')
  await localAuth.verifyMagicCode(ch.challengeId, ch.devCode!)
  await assert.rejects(() => localAuth.verifyMagicCode(ch.challengeId, ch.devCode!))
})
