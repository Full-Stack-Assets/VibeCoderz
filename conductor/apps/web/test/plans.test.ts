import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLimits, sanitizeOverrides, chargeSplit, PLAN_LIMITS } from '../lib/server/plans.ts'
import { TOPUP_PACKS, topupPack } from '../lib/auth.ts'

test('free cannot pin a model and is capped to its quality floor', () => {
  const s = sanitizeOverrides('free', 'anthropic/claude-opus-4.8', 0.97)
  assert.equal(s.preferModel, undefined, 'preferModel dropped for free')
  assert.ok((s.qualityFloor ?? 0) <= PLAN_LIMITS.free.maxQualityFloor)
})

test('paid plans may pin a model and request higher floors', () => {
  assert.equal(sanitizeOverrides('pro', 'anthropic/claude-opus-4.8', 0.95).preferModel, 'anthropic/claude-opus-4.8')
  assert.equal(sanitizeOverrides('max', undefined, 1).qualityFloor, 1)
})

test('budgets increase with plan tier', () => {
  assert.ok(planLimits('max').budgetUSD > planLimits('pro').budgetUSD)
  assert.ok(planLimits('pro').budgetUSD > planLimits('free').budgetUSD)
})

test('chargeSplit bills the plan allowance before top-up credit', () => {
  // Whole cost fits in remaining plan budget → nothing drawn from top-up.
  assert.deepEqual(chargeSplit(10, 4, 2), { fromPlan: 2, fromTopup: 0 })
  // Cost straddles the cap → split between plan room and top-up.
  assert.deepEqual(chargeSplit(10, 9, 3), { fromPlan: 1, fromTopup: 2 })
  // Plan already exhausted → the whole cost is drawn from top-up credit.
  assert.deepEqual(chargeSplit(10, 10, 3), { fromPlan: 0, fromTopup: 3 })
  // Spent past the cap (shouldn't happen, but stay safe) → no negative plan room.
  assert.deepEqual(chargeSplit(10, 12, 3), { fromPlan: 0, fromTopup: 3 })
  // A free turn costs nothing from either bucket.
  assert.deepEqual(chargeSplit(10, 5, 0), { fromPlan: 0, fromTopup: 0 })
})

test('top-up packs form a $10/$25/$50 ladder at a 20% margin', () => {
  assert.deepEqual(
    TOPUP_PACKS.map((p) => p.priceUSD),
    [10, 25, 50]
  )
  for (const p of TOPUP_PACKS) {
    assert.equal(p.creditUSD, p.priceUSD * 0.8, `${p.id} grants 80% of price as credit`)
  }
  assert.equal(topupPack('topup_25')?.creditUSD, 20)
  assert.equal(topupPack('nope'), undefined)
})
