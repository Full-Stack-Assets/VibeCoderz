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
  OPENROUTER_API_KEY: undefined,
};

test('canPlanLive gates each provider on its own key', () => {
  withEnv(NO_KEYS, () => {
    assert.equal(canPlanLive('anthropic/claude-opus-4.6'), false);
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
    assert.equal(canPlanLive('google/gemini-2.5-pro'), true);
    assert.equal(canPlanLive('anthropic/claude-opus-4.6'), true);
    const planner = makeLiveToolPlanner({ modelId: 'google/gemini-2.5-pro', ...ARGS });
    assert.equal(typeof planner, 'function'); // gateway-backed, no network yet
  });
  withEnv({ ...NO_KEYS, OPENROUTER_API_KEY: 'or-test' }, () => {
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), true);
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
    const planner = makeLiveToolPlanner({ modelId: 'anthropic/claude-opus-4.6', ...ARGS });
    assert.equal(typeof planner, 'function');
  });
});

test('unknown model yields no live planner', () => {
  withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-test' }, () => {
    assert.equal(makeLiveToolPlanner({ modelId: 'nope/model', ...ARGS }), null);
  });
});
