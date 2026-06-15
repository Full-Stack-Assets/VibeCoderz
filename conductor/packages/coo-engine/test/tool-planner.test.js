import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlanLive, makeLiveToolPlanner } from '../src/index.js';

// Minimal tool schema (shape matches @conductor/agent-tools TOOLS) — kept inline
// so this package's tests have no cross-package dependency.
const TOOLS = [
  { name: 'run_command', description: 'run', parameters: { type: 'object', properties: {} } },
];
const ARGS = { system: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: TOOLS };

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const NO_KEYS = {
  ANTHROPIC_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  XAI_API_KEY: undefined,
  AI_GATEWAY_API_KEY: undefined,
  VERCEL_OIDC_TOKEN: undefined,
  OPENROUTER_API_KEY: undefined,
};

test('canPlanLive gates each provider on its own key', () => {
  withEnv(NO_KEYS, () => {
    assert.equal(canPlanLive('anthropic/claude-opus-4.8'), false);
    assert.equal(canPlanLive('openai/gpt-5.3-codex'), false);
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), false);
  });
  withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-test' }, () => {
    assert.equal(canPlanLive('openai/gpt-5.3-codex'), true);
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), false); // no xai key, no gateway
  });
});

test('a gateway key makes every model live — including Gemini', () => {
  withEnv({ ...NO_KEYS, AI_GATEWAY_API_KEY: 'gw-test' }, () => {
    assert.equal(canPlanLive('google/gemini-3.1-pro-preview'), true);
    assert.equal(canPlanLive('anthropic/claude-opus-4.8'), true);
    const planner = makeLiveToolPlanner({ modelId: 'google/gemini-3.1-pro-preview', ...ARGS });
    assert.equal(typeof planner, 'function'); // gateway-backed, no network yet
  });
  withEnv({ ...NO_KEYS, OPENROUTER_API_KEY: 'or-test' }, () => {
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), true);
  });
});

test("Vercel's auto-injected OIDC token alone makes every model live", () => {
  // On a Vercel deployment VERCEL_OIDC_TOKEN is present without any explicit
  // gateway key — live mode must activate with zero key management.
  withEnv({ ...NO_KEYS, VERCEL_OIDC_TOKEN: 'oidc-test' }, () => {
    assert.equal(canPlanLive('anthropic/claude-opus-4.8'), true);
    assert.equal(canPlanLive('google/gemini-3.1-pro-preview'), true);
    const planner = makeLiveToolPlanner({ modelId: 'anthropic/claude-opus-4.8', ...ARGS });
    assert.equal(typeof planner, 'function');
  });
});

test('makeLiveToolPlanner returns null without a key, a planner with one', () => {
  withEnv(NO_KEYS, () => {
    assert.equal(makeLiveToolPlanner({ modelId: 'openai/gpt-5.3-codex', ...ARGS }), null);
  });
  withEnv({ ...NO_KEYS, XAI_API_KEY: 'xai-test' }, () => {
    const planner = makeLiveToolPlanner({ modelId: 'xai/grok-4.1-fast-reasoning', ...ARGS });
    assert.equal(typeof planner, 'function'); // closure built; no network call yet
  });
  withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'ant-test' }, () => {
    const planner = makeLiveToolPlanner({ modelId: 'anthropic/claude-opus-4.8', ...ARGS });
    assert.equal(typeof planner, 'function');
  });
});

test('unknown model yields no live planner', () => {
  withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-test' }, () => {
    assert.equal(makeLiveToolPlanner({ modelId: 'nope/model', ...ARGS }), null);
  });
});

test('OpenAI/gateway planner replays the assistant tool-call turn with content:null (gateway→Anthropic fix)', async () => {
  // Regression: an empty-string content on the assistant tool-call message broke
  // the gateway's OpenAI→Anthropic translation (the tool_use block was dropped,
  // orphaning the following tool_result). The replayed turn must use content:null.
  const reqs = [];
  const origFetch = global.fetch;
  const origKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'gw-test';
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    reqs.push(body);
    const message =
      reqs.length === 1
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'run_command', arguments: '{}' } }] }
        : { role: 'assistant', content: 'all done' };
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  };
  try {
    const planner = makeLiveToolPlanner({ modelId: 'anthropic/claude-opus-4.8', ...ARGS });
    const a1 = await planner([]);
    assert.equal(a1.type, 'tool');
    const a2 = await planner([{ tool: 'run_command', args: {}, result: { ok: true, output: 'x' } }]);
    assert.equal(a2.type, 'final');
    // The second request replays the transcript: assistant tool-call turn + result.
    const asst = reqs[1].messages.find((m) => m.role === 'assistant' && m.tool_calls);
    assert.ok(asst, 'assistant tool-call turn is replayed');
    assert.equal(asst.content, null, 'content is null, not an empty string');
    assert.equal(reqs[1].messages.find((m) => m.role === 'tool').tool_call_id, 'toolu_1');
  } finally {
    global.fetch = origFetch;
    if (origKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = origKey;
  }
});
