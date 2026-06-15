import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GET } from '../app/api/benchmark/route.ts'

test('benchmark endpoint surfaces the measured vs-premium headline for the landing wedge', async () => {
  const res = await GET()
  assert.equal(res.status, 200)
  const data = (await res.json()) as {
    headline?: { vsPremium?: { costSavingsPct?: number; qualityRetentionPct?: number } }
  }
  const v = data.headline?.vsPremium
  assert.ok(v, 'headline.vsPremium is present')
  assert.equal(typeof v!.costSavingsPct, 'number')
  // The wedge claim must stay true: meaningfully cheaper at near-premium quality.
  assert.ok(v!.costSavingsPct! >= 50, `savings ${v!.costSavingsPct}%`)
  assert.ok(v!.qualityRetentionPct! >= 95, `retention ${v!.qualityRetentionPct}%`)
})
