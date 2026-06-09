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

import { routeTurn, getModel, MODEL_CATALOG } from '../../coo-engine/src/index.js';

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

/** Upper bound: always the model with the highest oracle quality for the task. */
export function qualityOracleStrategy(oracle) {
  return (task) =>
    MODEL_CATALOG.reduce((best, m) => (oracle.quality(m, task) > oracle.quality(best, task) ? m : best)).id;
}

// Conventional baseline picks from the catalog.
export const PREMIUM_MODEL = 'anthropic/claude-opus-4.6';
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

export { getModel };
