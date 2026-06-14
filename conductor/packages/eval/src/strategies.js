/**
 * ROUTING STRATEGIES — the policies being compared.
 *
 * Each strategy is `(task) => modelId`. The whole point is that `coo` calls the
 * REAL `routeTurn` from the engine (not a reimplementation), so the benchmark
 * measures the shipping router. The baselines are the alternatives a team would
 * otherwise pick: pin the premium model, pin the cheapest, pin a balanced
 * mid-tier — plus a `qualityOracle` upper bound (always the highest-quality
 * model per task) to show how close COO gets to the best achievable quality.
 */

import { routeTurn, MODEL_CATALOG } from '@conductor/coo-engine';

// Roomy budget so the eval measures routing choices, not the budget throttle
// (cost is accounted separately in run.js).
const BIG_BUDGET = 1e6;

/** The shipping COO router. Vision tasks pass `hasImages` to gate to multimodal. */
export function cooStrategy(task) {
  const decision = routeTurn({
    messages: [{ role: 'user', content: task.prompt }],
    budgetUSD: BIG_BUDGET,
    spentUSD: 0,
    hasImages: !!task.requiresVision,
  });
  return decision.model ? decision.model.id : null;
}

/** Pin one model for every task. */
export function alwaysStrategy(modelId) {
  return () => modelId;
}

/**
 * Upper bound: always the model with the highest oracle quality for the task.
 * The oracle's `quality` may be async (the live LLM-judge), so await each call
 * and compare scalars — a synchronous reduce would compare unresolved Promises.
 */
export function qualityOracleStrategy(oracle) {
  return async (task) => {
    let bestModel = MODEL_CATALOG[0];
    let bestQ = await oracle.quality(bestModel, task);
    for (const m of MODEL_CATALOG.slice(1)) {
      const q = await oracle.quality(m, task);
      if (q > bestQ) {
        bestQ = q;
        bestModel = m;
      }
    }
    return bestModel.id;
  };
}

// Conventional baseline picks from the catalog.
export const PREMIUM_MODEL = 'anthropic/claude-opus-4.8';
export const CHEAPEST_MODEL = 'xai/grok-4.1-fast-reasoning';
export const BALANCED_MODEL = 'anthropic/claude-sonnet-4.6';

/** Build the default strategy set, given an oracle for the quality upper bound. */
export function defaultStrategies(oracle) {
  return {
    'COO (this router)': cooStrategy,
    'Always-Premium (Opus)': alwaysStrategy(PREMIUM_MODEL),
    'Always-Balanced (Sonnet)': alwaysStrategy(BALANCED_MODEL),
    'Always-Cheapest (Grok)': alwaysStrategy(CHEAPEST_MODEL),
    'Quality-Oracle (upper bound)': qualityOracleStrategy(oracle),
  };
}
