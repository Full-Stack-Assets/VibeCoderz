import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS,
  TOOL_NAMES,
  PURE_TOOL_NAMES,
  calculator,
  analyzeData,
  currentTime,
  webSearch,
  fetchUrl,
  webEnabled,
  SimulatedExecutor,
} from '../src/index.js';

test('the toolset spans coding, web, data, and utility groups', () => {
  for (const name of ['run_command', 'web_search', 'fetch_url', 'analyze_data', 'calculator', 'current_time']) {
    assert.ok(TOOL_NAMES.includes(name), `missing tool: ${name}`);
  }
  // every tool has a provider-ready JSON schema
  for (const t of TOOLS) {
    assert.equal(t.parameters.type, 'object');
    assert.ok(Array.isArray(t.parameters.required));
  }
});

test('calculator evaluates safely and rejects non-arithmetic input', () => {
  assert.deepEqual(calculator({ expression: '(2 + 3) * 4' }).value, 20);
  assert.equal(calculator({ expression: 'process.exit(1)' }).ok, false);
  assert.equal(calculator({ expression: '1/0' }).ok, false); // Infinity is not finite
});

test('analyze_data parses CSV and computes numeric stats', () => {
  const r = analyzeData({ data: 'name,score\nA,10\nB,20\nC,30' });
  assert.equal(r.ok, true);
  assert.equal(r.rows, 3);
  assert.deepEqual(r.columns, ['name', 'score']);
  assert.equal(r.stats.score.mean, 20);
  assert.equal(r.stats.score.median, 20);
  assert.equal(r.stats.score.max, 30);
});

test('analyze_data parses a JSON array of objects', () => {
  const r = analyzeData({ data: '[{"x":1},{"x":3}]' });
  assert.equal(r.ok, true);
  assert.equal(r.rows, 2);
  assert.equal(r.stats.x.mean, 2);
});

test('current_time returns an ISO timestamp', () => {
  const r = currentTime({});
  assert.equal(r.ok, true);
  assert.match(r.iso, /^\d{4}-\d{2}-\d{2}T/);
});

test('web tools are simulated unless CONDUCTOR_WEB=live', async () => {
  const env = {}; // no CONDUCTOR_WEB
  const s = await webSearch({ query: 'anything' }, env);
  assert.equal(s.ok, true);
  assert.match(s.output, /simulated/i);
  const f = await fetchUrl({ url: 'https://example.com' }, env);
  assert.equal(f.ok, true);
  assert.match(f.output, /simulated/i);
});

test('web auto-enables on Vercel only with a Tavily backend; off-switch and force win', () => {
  // Deployment + reliable backend → live automatically (no CONDUCTOR_WEB needed).
  assert.equal(webEnabled({ VERCEL: '1', TAVILY_API_KEY: 'tvly-x' }), true)
  assert.equal(webEnabled({ VERCEL_ENV: 'production', TAVILY_API_KEY: 'tvly-x' }), true)
  // Deployment without a backend → stay simulated (avoids keyless 403 spam).
  assert.equal(webEnabled({ VERCEL: '1' }), false)
  // Explicit force opts into the keyless path anywhere; explicit off always wins.
  assert.equal(webEnabled({ CONDUCTOR_WEB: 'live' }), true)
  assert.equal(webEnabled({ VERCEL: '1', TAVILY_API_KEY: 'tvly-x', CONDUCTOR_WEB: 'off' }), false)
  // No deployment signal and no flag → simulated.
  assert.equal(webEnabled({}), false)
})

test('fetch_url refuses private hosts when live', async () => {
  const env = { CONDUCTOR_WEB: 'live' };
  const f = await fetchUrl({ url: 'http://localhost:8080/admin' }, env);
  assert.equal(f.ok, false);
  assert.match(f.error, /private|loopback/i);
});

test('the simulated executor runs pure tools for real', async () => {
  const ex = new SimulatedExecutor();
  const calc = await ex.execute('calculator', { expression: '6*7' });
  assert.equal(calc.value, 42);
  const web = await ex.execute('web_search', { query: 'x' });
  assert.match(web.output, /simulated/i);
});

test('PURE_TOOL_NAMES lists only the side-effect-free tools', () => {
  assert.deepEqual([...PURE_TOOL_NAMES].sort(), ['analyze_data', 'calculator', 'current_time']);
});
