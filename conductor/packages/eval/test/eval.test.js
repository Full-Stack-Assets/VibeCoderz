import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATASET,
  VALID_TYPES,
  syntheticQuality,
  makeSyntheticOracle,
  evaluate,
  defaultStrategies,
  renderReport,
  cooStrategy,
  qualityOracleStrategy,
  classifyTransportError,
} from '../src/index.js';
import { getModel } from '@conductor/coo-engine';

test('dataset is well-formed and covers every domain', () => {
  const domains = new Set();
  for (const t of DATASET) {
    assert.ok(t.id && typeof t.id === 'string');
    assert.ok(t.prompt && t.prompt.length > 5, `${t.id} has a prompt`);
    assert.ok(VALID_TYPES.includes(t.idealType), `${t.id} idealType valid`);
    assert.ok(t.difficulty >= 0 && t.difficulty <= 1, `${t.id} difficulty in range`);
    domains.add(t.domain);
  }
  for (const d of ['coding', 'reasoning', 'writing', 'analysis', 'research', 'data', 'vision']) {
    assert.ok(domains.has(d), `dataset covers ${d}`);
  }
});

test('synthetic oracle: capability dominates and stays in [0,1]', () => {
  const opus = getModel('anthropic/claude-opus-4.6');
  const grok = getModel('xai/grok-4.1-fast-reasoning');
  const hard = { idealType: 'reasoning', difficulty: 0.95 };
  const qo = syntheticQuality(opus, hard);
  const qg = syntheticQuality(grok, hard);
  assert.ok(qo >= 0 && qo <= 1 && qg >= 0 && qg <= 1);
  assert.ok(qo > qg, 'the more capable model scores higher on a hard task');
});

test('synthetic oracle: a text-only model is near-zero on a vision task', () => {
  const grok = getModel('xai/grok-4.1-fast-reasoning'); // multimodal: false
  const gemini = getModel('google/gemini-2.5-pro'); // multimodal: true
  const visionTask = { idealType: 'reasoning', difficulty: 0.6, requiresVision: true };
  assert.ok(syntheticQuality(grok, visionTask) <= 0.25);
  assert.ok(syntheticQuality(gemini, visionTask) > 0.8);
});

test('the synthetic oracle never lets a cheap router beat premium on quality', async () => {
  // An oracle where cheapest > premium quality would be a tell it was rigged.
  const r = await evaluate();
  const coo = r.strategies.find((s) => s.name.startsWith('COO'));
  const premium = r.strategies.find((s) => s.name.startsWith('Always-Premium'));
  assert.ok(coo.avgQuality <= premium.avgQuality + 1e-9, 'COO does not exceed premium quality');
});

test('HEADLINE: COO is much cheaper than premium while retaining ~all of its quality', async () => {
  const r = await evaluate();
  assert.equal(r.oracle, 'synthetic');
  // Cost: COO is at least 50% cheaper than always-premium.
  assert.ok(r.headline.vsPremium.costSavingsPct >= 50, `savings ${r.headline.vsPremium.costSavingsPct}%`);
  // Quality: COO retains at least 95% of premium quality.
  assert.ok(
    r.headline.vsPremium.qualityRetentionPct >= 95,
    `retention ${r.headline.vsPremium.qualityRetentionPct}%`
  );
});

test('HEADLINE: COO delivers clearly higher quality than always-cheapest', async () => {
  const r = await evaluate();
  assert.ok(r.headline.vsCheapest.qualityGainPct >= 8, `gain ${r.headline.vsCheapest.qualityGainPct}%`);
});

test('COO gets close to the best achievable quality', async () => {
  const r = await evaluate();
  assert.ok(r.headline.vsOracle.qualityOfBestPct >= 95);
});

test('per-domain breakdown covers every domain and holds quality everywhere', async () => {
  const r = await evaluate();
  const domains = new Set(r.byDomain.map((d) => d.domain));
  for (const d of ['coding', 'reasoning', 'writing', 'analysis', 'research', 'data', 'vision']) {
    assert.ok(domains.has(d), `breakdown covers ${d}`);
  }
  // Routing should retain most of premium quality in EVERY domain, not just on average.
  for (const d of r.byDomain) {
    assert.ok(d.retentionPct >= 90, `${d.domain} retention ${d.retentionPct}% >= 90%`);
    assert.ok(d.tasks > 0 && d.models.length > 0);
  }
});

test('routing correctness: COO never sends a vision task to a text-only model', () => {
  for (const task of DATASET.filter((t) => t.requiresVision)) {
    const modelId = cooStrategy(task);
    const model = getModel(modelId);
    assert.ok(model && model.multimodal, `${task.id} routed to a multimodal model (got ${modelId})`);
  }
});

test('qualityOracleStrategy resolves correctly with an async (live) oracle', async () => {
  // A live oracle's quality() is async; the strategy must await it rather than
  // comparing Promises (which would silently pick the first model every time).
  const asyncOracle = {
    name: 'mock-live',
    live: true,
    quality: async (model) => (model.id === 'google/gemini-2.5-pro' ? 0.99 : 0.5),
  };
  const pick = qualityOracleStrategy(asyncOracle);
  const id = await pick({ idealType: 'reasoning', difficulty: 0.5 });
  assert.equal(id, 'google/gemini-2.5-pro');
})

test('report renders a Markdown table with the headline', async () => {
  const oracle = makeSyntheticOracle();
  const r = await evaluate({ oracle, strategies: defaultStrategies(oracle) });
  const md = renderReport(r, { dataset: DATASET });
  assert.match(md, /## Headline/);
  assert.match(md, /COO/);
  assert.match(md, /cheaper while retaining/);
});

test('classifyTransportError: a blocked gateway host is network, not auth', () => {
  // The real failure mode in a restricted environment: the proxy returns a 403
  // whose body is "Host not in allowlist". Despite the 403, this is a network/
  // policy problem, so the preflight must surface the allowlist fix — not "bad key".
  assert.equal(
    classifyTransportError(new Error('https://ai-gateway.vercel.sh/v1 403: Host not in allowlist')),
    'network'
  );
  assert.equal(classifyTransportError(new Error('fetch failed')), 'network');
  assert.equal(classifyTransportError('getaddrinfo ENOTFOUND api.example'), 'network');
  // A genuine credential rejection (no allowlist hint) is auth.
  assert.equal(
    classifyTransportError(new Error('https://api.anthropic.com 401: x-api-key header is required')),
    'auth'
  );
  assert.equal(classifyTransportError(new Error('boom')), 'unknown');
});
