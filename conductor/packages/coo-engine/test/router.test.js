import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeTurn, complete, classifyTurn, getModel } from '../src/index.js';

test('classifyTurn detects a coding turn', () => {
  const c = classifyTurn('Please implement a TypeScript function to fix the API bug');
  assert.equal(c.type, 'code');
  assert.ok(c.minQuality >= 0.55 && c.minQuality <= 0.98);
});

test('classifyTurn detects an analysis turn', () => {
  const c = classifyTurn('Analyze this data and compare the benchmark metrics');
  assert.equal(c.type, 'analysis');
});

test('routeTurn routes a coding turn to the code specialist', () => {
  const r = routeTurn({
    messages: [{ role: 'user', content: 'Refactor this React component and fix the bug' }],
    budgetUSD: 1.0,
    spentUSD: 0,
  });
  assert.equal(r.ok, true);
  assert.equal(r.model.type, 'code');
  assert.equal(r.model.id, 'openai/gpt-5.3-codex');
  assert.ok(r.score >= 0.55, 'score clears the admission threshold');
  assert.ok(r.estCostUSD > 0);
});

test('routeTurn surfaces per-dimension fitness and weights', () => {
  const r = routeTurn({ messages: [{ role: 'user', content: 'Design a distributed system architecture' }] });
  assert.ok(r.dims && typeof r.dims.cost === 'number');
  assert.ok(r.weights && Math.abs(
    r.weights.type + r.weights.cost + r.weights.latency + r.weights.load + r.weights.budget - 1
  ) < 1e-9, 'weights renormalize to 1');
});

test('budget throttle blocks routing past 85% with no override', () => {
  const r = routeTurn({
    messages: [{ role: 'user', content: 'Write some docs' }],
    budgetUSD: 1.0,
    spentUSD: 0.95,
  });
  assert.equal(r.ok, false);
  assert.equal(r.budget.throttled, true);
});

test('manual override is honoured but records the optimizer choice', () => {
  const r = routeTurn({
    messages: [{ role: 'user', content: 'Refactor this code' }],
    preferModel: 'anthropic/claude-opus-4.8',
  });
  assert.equal(r.model.id, 'anthropic/claude-opus-4.8');
  assert.equal(r.overridden, true);
  assert.equal(r.optimizerChoice, 'openai/gpt-5.3-codex');
});

test('capability gate: a high quality floor excludes the cheapest model', () => {
  const r = routeTurn({
    messages: [{ role: 'user', content: 'Trivial question' }],
    qualityFloor: 0.95,
  });
  assert.equal(r.ok, true);
  assert.ok(getModel(r.model.id).capability >= 0.95);
});

test('complete() simulates with no provider key and meters cost', async () => {
  const r = await complete('xai/grok-4.1-fast-reasoning', {
    messages: [{ role: 'user', content: 'hello' }],
  });
  assert.equal(r.simulated, true);
  assert.equal(r.model, 'xai/grok-4.1-fast-reasoning');
  assert.ok(r.text.includes('simulation'));
  assert.ok(r.costUSD >= 0);
});
