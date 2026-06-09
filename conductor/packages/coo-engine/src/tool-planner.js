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

const wireId = (model) => (model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id);
const resultText = (r) => (r?.ok ? String(r.output ?? '') : `ERROR: ${r?.error ?? 'tool failed'}`);

/** True when the chosen model's provider has a usable key for live tool-calling. */
export function canPlanLive(modelId, env = process.env) {
  const model = getModel(modelId);
  if (!model) return false;
  if (model.provider === 'anthropic') return !!env.ANTHROPIC_API_KEY;
  return false; // OpenAI/xAI live tool-calling not yet wired → caller uses simulation
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
