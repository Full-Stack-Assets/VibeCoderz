import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLimits, sanitizeOverrides, PLAN_LIMITS } from '../lib/server/plans.ts'

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
