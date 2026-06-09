/**
 * TURN ROUTER — the public entry point Conductor's chat path calls.
 *
 * Given the conversation and a budget, it (1) classifies the turn, (2) builds a
 * COO state from the model catalog, (3) runs the constraint-optimized router,
 * and (4) returns the chosen model plus a full, human-readable audit trail. This
 * is the differentiator versus single-model agentic platforms: every turn is
 * priced, scored, and either routed to the cheapest good-enough model or
 * explicitly throttled when the budget is exhausted.
 */

import { findBestAgentForTask } from './core.js';
import { classifyTurn } from './classify.js';
import { MODEL_CATALOG, getModel, modelsAsAgents } from './catalog.js';
import { contentToText } from './llm.js';

const lastUserText = (messages = []) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return contentToText(messages[i].content);
  }
  return contentToText(messages[messages.length - 1]?.content);
};

/**
 * Estimate a turn's cost in USD from the model's token pricing and a rough
 * token forecast (prompt + expected completion).
 */
export function estimateTurnCostUSD(model, promptChars, maxTokens = 1024) {
  if (!model?.pricing) return 0;
  const inTokens = Math.ceil(promptChars / 4);
  const outTokens = maxTokens;
  return (inTokens / 1e6) * model.pricing.input + (outTokens / 1e6) * model.pricing.output;
}

/**
 * Route a single chat turn.
 *
 * @param {Object} opts
 * @param {Array<{role,content}>} opts.messages   conversation so far
 * @param {number} [opts.budgetUSD=1.0]           total budget for the session
 * @param {number} [opts.spentUSD=0]              already-spent in the session
 * @param {number} [opts.qualityFloor]            hard minimum capability (0..1)
 * @param {string} [opts.preferModel]             manual model override (id)
 * @param {boolean}[opts.hasImages=false]         turn carries images → require a multimodal model
 * @param {boolean}[opts.adaptiveWeighting=true]  shift weights to the binding constraint
 * @returns {Object} decision with chosen model + audit trail
 */
export function routeTurn(opts = {}) {
  const {
    messages = [],
    budgetUSD = 1.0,
    spentUSD = 0,
    qualityFloor,
    preferModel,
    hasImages = false,
    adaptiveWeighting = true,
  } = opts;

  const text = lastUserText(messages);
  const classification = classifyTurn(text, { qualityFloor, hasImages });

  const task = {
    id: 'turn',
    type: classification.type,
    complexity: classification.complexity,
    minQuality: classification.minQuality,
    requiresVision: classification.requiresVision,
    status: 'queued',
  };

  const state = {
    agents: modelsAsAgents(),
    tasks: [task],
    totalCost: spentUSD,
    constraints: { maxCost: budgetUSD, maxAgents: MODEL_CATALOG.length },
    adaptiveWeighting,
  };

  // Manual override: honour the user's pinned model, but still record what the
  // optimizer WOULD have chosen, so the audit trail stays honest.
  let manual = null;
  if (preferModel) {
    const pinned = getModel(preferModel);
    if (pinned) {
      manual = pinned;
    }
  }

  const decision = findBestAgentForTask(task, state);
  const optimizerModel = decision.agent ? getModel(decision.agent.id) : null;
  const chosen = manual || optimizerModel;

  const estCostUSD = chosen ? estimateTurnCostUSD(chosen, text.length) : 0;
  const utilization = budgetUSD > 0 ? spentUSD / budgetUSD : 0;

  return {
    ok: !!chosen,
    model: chosen,                         // null when throttled with no override
    score: decision.score,
    dims: decision.dims || null,           // per-dimension fitness contribution
    weights: decision.weights || null,     // weights actually used (may be adaptive)
    fallback: !!decision.fallback,
    overridden: !!manual && (!optimizerModel || manual.id !== optimizerModel.id),
    optimizerChoice: optimizerModel ? optimizerModel.id : null,
    candidates: decision.candidates || [],
    classification,
    estCostUSD: Number(estCostUSD.toFixed(6)),
    budget: {
      budgetUSD,
      spentUSD,
      utilization: Number(utilization.toFixed(4)),
      throttled: !decision.agent && /budget/.test(decision.reason || ''),
    },
    reason: manual
      ? `manual override → ${manual.label} (optimizer suggested ${optimizerModel ? optimizerModel.label : 'none'})`
      : decision.reason,
  };
}
