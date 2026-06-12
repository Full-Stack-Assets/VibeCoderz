import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rotatingSuggestions,
  rotationWindow,
  ROTATION_MS,
  SUGGESTION_POOL,
} from '../lib/suggestions.ts'

test('rotation window sits in the 6–12h band and indexes time correctly', () => {
  assert.ok(ROTATION_MS >= 6 * 3600_000 && ROTATION_MS <= 12 * 3600_000)
  const t = 59_062 * ROTATION_MS // an aligned window start (~2023)
  assert.equal(rotationWindow(t), rotationWindow(t + ROTATION_MS - 1), 'same window within a period')
  assert.equal(rotationWindow(t + ROTATION_MS), rotationWindow(t) + 1, 'next period advances the index')
})

test('a deal is stable within a window and changes across windows', () => {
  const t = 59_062 * ROTATION_MS // aligned window start
  assert.deepEqual(rotatingSuggestions(t), rotatingSuggestions(t + ROTATION_MS - 1))
  // Some adjacent windows could coincidentally match on a tiny pool; across
  // several windows at least one deal must differ.
  const deals = Array.from({ length: 6 }, (_, i) => rotatingSuggestions(t + i * ROTATION_MS).join('|'))
  assert.ok(new Set(deals).size > 1, 'deals rotate over time')
})

test('every deal leads with a current-events prompt and has unique entries', () => {
  for (let i = 0; i < 12; i++) {
    const deal = rotatingSuggestions(1_700_000_000_000 + i * ROTATION_MS)
    assert.equal(deal.length, 4)
    assert.ok(SUGGESTION_POOL.current.includes(deal[0]), 'first chip exercises live web research')
    assert.equal(new Set(deal).size, deal.length, 'no duplicate chips')
    for (const s of deal) {
      assert.ok(
        Object.values(SUGGESTION_POOL).some((cat) => cat.includes(s)),
        'every chip comes from the pool'
      )
    }
  }
})

test('count is respected', () => {
  assert.equal(rotatingSuggestions(Date.now(), 2).length, 2)
  assert.equal(rotatingSuggestions(Date.now(), 4).length, 4)
})
