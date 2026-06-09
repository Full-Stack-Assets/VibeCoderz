/**
 * LIVE TOOL PLANNER — drives the agentic loop with a real model's tool calls.
 *
 * Produces a `planner(steps) => Action` closure for `runAgenticTurn`, backed by
 * a provider's native tool-calling protocol. Anthropic is implemented here (the
 * flagship provider); the closure owns the provider-native transcript and emits
 * one tool call per loop iteration, folding each executed result back in as a
 * `tool_result` before asking the model for its next move.
 *
 * Callers should guard usage and fall back to the simulated planner on any
 * error or when no key is present — this path is only exercised with a key.
 */

import { getModel } from './catalog.js';
import { gatewayConfig } from './llm.js';

const wireId = (model) => (model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id);
const resultText = (r) => (r?.ok ? String(r.output ?? '') : `ERROR: ${r?.error ?? 'tool failed'}`);

/**
 * True when live tool-calling is possible for this model — either a gateway key
 * (reaches every model) or the model's own provider key is set.
 */
export function canPlanLive(modelId, env = process.env) {
  const model = getModel(modelId);
  if (!model) return false;
  if (gatewayConfig(env)) return true; // one key reaches every model
  if (model.provider === 'anthropic') return !!env.ANTHROPIC_API_KEY;
  if (model.provider === 'openai') return !!env.OPENAI_API_KEY;
  if (model.provider === 'xai') return !!env.XAI_API_KEY;
  return false;
}

// OpenAI-compatible native providers: REST base URL, key env var, optional model
// override env var. Anthropic is handled separately (different wire protocol);
// gateways front everything (incl. Google/Gemini) over one OpenAI-compatible API.
const OPENAI_COMPATIBLE = {
  openai: { baseURL: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL' },
  xai: { baseURL: 'https://api.x.ai/v1', keyEnv: 'XAI_API_KEY', modelEnv: 'XAI_MODEL' },
};

/**
 * Unified live planner factory: returns an agentic-loop planner for the chosen
 * model, or null when nothing is configured (caller falls back to simulation).
 *
 * Precedence: a configured GATEWAY (Vercel AI Gateway / OpenRouter) fronts every
 * model over the OpenAI-compatible tool_calls protocol — so Gemini and any other
 * model become live with one key. Otherwise, native per-provider: Anthropic uses
 * its tool_use protocol; OpenAI/xAI use tool_calls.
 */
export function makeLiveToolPlanner({ modelId, system, messages, tools, maxTokens = 1024 }) {
  const model = getModel(modelId);
  if (!model) return null;

  const gw = gatewayConfig();
  if (gw) {
    return makeOpenAIToolPlanner({
      modelId, system, messages, tools, maxTokens,
      baseURL: gw.baseURL,
      apiKey: gw.apiKey,
      headers: gw.headers,
      modelName: model.id, // gateways use the full provider/model slug
    });
  }

  if (model.provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    return makeAnthropicToolPlanner({ modelId, system, messages, tools, maxTokens });
  }
  const cfg = OPENAI_COMPATIBLE[model.provider];
  if (!cfg || !process.env[cfg.keyEnv]) return null;
  return makeOpenAIToolPlanner({
    modelId, system, messages, tools, maxTokens,
    baseURL: cfg.baseURL,
    apiKey: process.env[cfg.keyEnv],
    modelName: process.env[cfg.modelEnv] || wireId(model),
  });
}

/**
 * Build an Anthropic-backed planner.
 * @param {object} o
 * @param {string} o.modelId
 * @param {string} o.system
 * @param {Array<{role,content}>} o.messages  initial conversation
 * @param {Array<{name,description,parameters}>} o.tools  tool schemas
 * @param {number} [o.maxTokens=1024]
 */
export function makeAnthropicToolPlanner({ modelId, system, messages, tools, maxTokens = 1024 }) {
  const model = getModel(modelId);
  const wire = wireId(model);
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  // Provider-native running transcript.
  const convo = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content),
  }));

  let queue = []; // pending tool_use blocks from the latest assistant turn
  let awaiting = null; // { id } of the tool we emitted, awaiting its result
  let pendingResults = []; // tool_result blocks gathered for the next user turn
  let lastAssistantContent = null; // raw content blocks of the latest assistant turn

  async function callAnthropic() {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || wire,
        max_tokens: maxTokens,
        system,
        tools: anthropicTools,
        messages: convo,
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return async function planner(steps) {
    // 1) Fold the just-executed tool result back into the transcript.
    if (awaiting) {
      const last = steps[steps.length - 1];
      pendingResults.push({ type: 'tool_result', tool_use_id: awaiting.id, content: resultText(last?.result) });
      awaiting = null;
    }

    // 2) Drain any queued tool calls one per iteration.
    if (queue.length > 0) {
      const call = queue.shift();
      awaiting = { id: call.id };
      return { type: 'tool', tool: call.name, args: call.input || {} };
    }

    // 3) Close out the prior assistant turn + its tool results, then ask again.
    if (lastAssistantContent) {
      convo.push({ role: 'assistant', content: lastAssistantContent });
      convo.push({ role: 'user', content: pendingResults });
      pendingResults = [];
      lastAssistantContent = null;
    }

    const data = await callAnthropic();
    lastAssistantContent = data.content || [];
    const toolUses = lastAssistantContent.filter((b) => b.type === 'tool_use');

    if (data.stop_reason === 'tool_use' && toolUses.length > 0) {
      queue = toolUses.map((b) => ({ id: b.id, name: b.name, input: b.input }));
      const call = queue.shift();
      awaiting = { id: call.id };
      return { type: 'tool', tool: call.name, args: call.input || {} };
    }

    // Final answer: concatenate text blocks.
    const text = lastAssistantContent.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { type: 'final', text };
  };
}

/**
 * Build an OpenAI-compatible planner (OpenAI, xAI, …). Uses the standard
 * `tool_calls` protocol: the model returns function calls, we execute them and
 * reply with `role: 'tool'` messages keyed by tool_call_id. Emits one tool call
 * per loop iteration, queueing any extras from the same assistant turn.
 */
export function makeOpenAIToolPlanner({ modelId, system, messages, tools, baseURL, apiKey, modelName, headers = {}, maxTokens = 1024 }) {
  const model = getModel(modelId);
  const wire = modelName || wireId(model);
  const openaiTools = tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const convo = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
  ];

  let queue = []; // pending tool_calls from the latest assistant turn
  let awaiting = null; // { id } of the call we emitted, awaiting its result

  async function callModel() {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...headers },
      body: JSON.stringify({
        model: wire,
        max_tokens: maxTokens,
        messages: convo,
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    });
    if (!res.ok) throw new Error(`${baseURL} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message || {};
  }

  const parseArgs = (s) => {
    try {
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  };

  return async function planner(steps) {
    // 1) Fold the just-executed tool result back into the transcript.
    if (awaiting) {
      const last = steps[steps.length - 1];
      convo.push({ role: 'tool', tool_call_id: awaiting.id, content: resultText(last?.result) });
      awaiting = null;
    }

    // 2) Drain queued tool calls one per iteration.
    if (queue.length > 0) {
      const call = queue.shift();
      awaiting = { id: call.id };
      return { type: 'tool', tool: call.function.name, args: parseArgs(call.function.arguments) };
    }

    // 3) Ask the model for its next move.
    const msg = await callModel();
    const calls = msg.tool_calls || [];
    if (calls.length > 0) {
      // The assistant turn (with tool_calls) must be in the transcript before its results.
      convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });
      queue = calls;
      const call = queue.shift();
      awaiting = { id: call.id };
      return { type: 'tool', tool: call.function.name, args: parseArgs(call.function.arguments) };
    }

    return { type: 'final', text: msg.content || '' };
  };
}
