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

test('canPlanLive gates each provider on its own key', () => {
  withEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, XAI_API_KEY: undefined }, () => {
    assert.equal(canPlanLive('anthropic/claude-opus-4.6'), false);
    assert.equal(canPlanLive('openai/gpt-5.3-codex'), false);
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), false);
  });
  withEnv({ OPENAI_API_KEY: 'sk-test' }, () => {
    assert.equal(canPlanLive('openai/gpt-5.3-codex'), true);
    assert.equal(canPlanLive('xai/grok-4.1-fast-reasoning'), !!process.env.XAI_API_KEY);
  });
});

test('makeLiveToolPlanner returns null without a key, a planner with one', () => {
  withEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, XAI_API_KEY: undefined }, () => {
    assert.equal(makeLiveToolPlanner({ modelId: 'openai/gpt-5.3-codex', ...ARGS }), null);
  });
  withEnv({ XAI_API_KEY: 'xai-test' }, () => {
    const planner = makeLiveToolPlanner({ modelId: 'xai/grok-4.1-fast-reasoning', ...ARGS });
    assert.equal(typeof planner, 'function'); // closure built; no network call yet
  });
  withEnv({ ANTHROPIC_API_KEY: 'ant-test' }, () => {
    const planner = makeLiveToolPlanner({ modelId: 'anthropic/claude-opus-4.6', ...ARGS });
    assert.equal(typeof planner, 'function');
  });
});

test('unknown model yields no live planner', () => {
  withEnv({ OPENAI_API_KEY: 'sk-test' }, () => {
    assert.equal(makeLiveToolPlanner({ modelId: 'nope/model', ...ARGS }), null);
  });
});
