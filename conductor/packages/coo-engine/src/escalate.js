/**
 * VERIFY-AND-ESCALATE — deliver "frontier answers without frontier bills".
 *
 * The router (routeTurn) picks the cheapest *capable* model. This module makes
 * that promise safe: when we routed to a non-top model, we score its answer with
 * an LLM judge and escalate to a premium model ONLY if the answer misses the
 * quality bar. Most turns settle cheap; hard turns transparently get the
 * expensive model — and the caller gets an audit trail of what happened and why.
 *
 * Two seams reused elsewhere:
 *   - the judge (rubric + parseScore) mirrors `packages/eval/src/live-oracle.js`,
 *     so production escalation and the offline benchmark grade on the same scale.
 *   - `complete` is injectable so the loop is unit-testable with a deterministic
 *     stub (no keys, no network), matching the rest of the codebase's test seams.
 */

import { complete as defaultComplete } from './llm.js';
import { getModel, MODEL_CATALOG } from './catalog.js';

const JUDGE_SYSTEM =
  'You are a strict evaluation judge. Score how well an AI response answers a ' +
  'request on a 0–100 scale: 0 = wrong/unusable, 60 = acceptable, 100 = expert, ' +
  'complete, and correct. Reply with ONLY the integer score.';

/** Parse a 0–100 judge verdict to a 0..1 quality, or null if unparseable. */
export function parseScore(text) {
  const m = String(text).match(/\d{1,3}/);
  if (!m) return null;
  return Math.max(0, Math.min(100, Number(m[0]))) / 100;
}

/** Highest-capability catalog model id, optionally excluding one (the routed model). */
export function topModelId(exceptId) {
  const pool = MODEL_CATALOG.filter((m) => m.id !== exceptId);
  if (!pool.length) return null;
  return pool.reduce((best, m) => (m.capability > best.capability ? m : best)).id;
}

/**
 * Judge one answer against its prompt.
 * @returns {Promise<{score:number|null, costUSD:number, simulated:boolean}>}
 *   score is 0..1, or null when judging wasn't meaningful (simulated/unparseable).
 */
export async function judgeAnswer({ prompt, answer, judgeModel, complete = defaultComplete }) {
  const verdict = await complete(judgeModel, {
    system: JUDGE_SYSTEM,
    messages: [
      { role: 'user', content: `REQUEST:\n${prompt}\n\nRESPONSE:\n${answer}\n\nScore (0-100):` },
    ],
    maxTokens: 8,
  });
  const costUSD = verdict.costUSD || 0;
  // A simulated verdict carries no signal — treat as "no judgment".
  if (verdict.simulated) return { score: null, costUSD, simulated: true };
  return { score: parseScore(verdict.text), costUSD, simulated: false };
}

const lastUserPrompt = (messages = []) => {
  const m = [...messages].reverse().find((x) => x?.role === 'user');
  return typeof m?.content === 'string' ? m.content : '';
};

/**
 * Run a completion with verify-and-escalate.
 *
 * Flow: complete on `modelId` → if the answer is real AND the model is below the
 * top tier, judge it → escalate to the strongest model only when it misses the
 * bar. Returns the chosen answer plus an `escalation` audit. Cost is the sum of
 * every model call actually made (first answer + judge + optional escalation).
 *
 * @param {string} modelId           model the router chose
 * @param {object} opts              { system, messages, maxTokens } for complete
 * @param {object} [cfg]
 * @param {number} [cfg.qualityBar=0.6]              escalate below this 0..1 score
 * @param {number} [cfg.escalateBelowCapability=0.95] only verify models under this
 * @param {string} [cfg.judgeModelId]                judge (default: strongest model)
 * @param {string} [cfg.escalateToId]                target (default: strongest model)
 * @param {Function} [cfg.complete]                  injectable for tests
 */
export async function completeWithEscalation(modelId, opts = {}, cfg = {}) {
  const {
    qualityBar = 0.6,
    escalateBelowCapability = 0.95,
    judgeModelId,
    escalateToId,
    complete = defaultComplete,
  } = cfg;

  const routed = getModel(modelId);
  const first = await complete(modelId, opts);

  // Only verify when it's worth it: a real (non-simulated) answer from a
  // non-top-tier model. Judging a simulation is meaningless; re-checking a model
  // that's already top-tier just burns money.
  const eligible = !first.simulated && routed && routed.capability < escalateBelowCapability;
  if (!eligible) {
    return { ...first, escalation: { evaluated: false, escalated: false } };
  }

  const judgeModel = judgeModelId || topModelId();
  const { score, costUSD: judgeCost } = await judgeAnswer({
    prompt: lastUserPrompt(opts.messages),
    answer: first.text,
    judgeModel,
    complete,
  });
  const firstCost = (first.costUSD || 0) + judgeCost;

  // Unparseable verdict → keep the cheap answer rather than spend on escalation.
  if (score == null || score >= qualityBar) {
    return {
      ...first,
      costUSD: Number(firstCost.toFixed(6)),
      escalation: { evaluated: true, escalated: false, firstModel: modelId, score, qualityBar },
    };
  }

  const target = escalateToId || topModelId(modelId);
  if (!target || target === modelId) {
    return {
      ...first,
      costUSD: Number(firstCost.toFixed(6)),
      escalation: { evaluated: true, escalated: false, firstModel: modelId, score, qualityBar, reason: 'no higher model' },
    };
  }

  const second = await complete(target, opts);
  return {
    ...second,
    costUSD: Number((firstCost + (second.costUSD || 0)).toFixed(6)),
    escalation: {
      evaluated: true,
      escalated: true,
      firstModel: modelId,
      firstScore: score,
      qualityBar,
      finalModel: target,
    },
  };
}
