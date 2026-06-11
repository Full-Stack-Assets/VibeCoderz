import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyWebhook, planForPriceId, priceIdForPlan } from '../lib/server/stripe.ts'

test('verifyWebhook accepts a correct signature and rejects tampering', () => {
  const secret = 'whsec_test'
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  assert.ok(verifyWebhook(payload, `t=${t},v1=${sig}`, secret))
  assert.ok(!verifyWebhook(payload, `t=${t},v1=deadbeef`, secret), 'wrong signature rejected')
  assert.ok(!verifyWebhook(payload + 'x', `t=${t},v1=${sig}`, secret), 'tampered payload rejected')
  assert.ok(!verifyWebhook(payload, null, secret), 'missing header rejected')
})

test('plan/price mapping is driven by env', () => {
  process.env.STRIPE_PRICE_PRO = 'price_pro'
  process.env.STRIPE_PRICE_MAX = 'price_max'
  assert.equal(priceIdForPlan('pro'), 'price_pro')
  assert.equal(priceIdForPlan('max'), 'price_max')
  assert.equal(priceIdForPlan('free'), undefined)
  assert.equal(planForPriceId('price_pro'), 'pro')
  assert.equal(planForPriceId('price_max'), 'max')
  assert.equal(planForPriceId('price_unknown'), null)
  assert.equal(planForPriceId(undefined), null)
})
