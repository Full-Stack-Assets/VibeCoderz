/**
 * @conductor/eval — the evidence layer.
 *
 * Quantifies the cost/quality tradeoff of COO routing against baseline
 * strategies over a golden dataset. Pure functions + a pluggable quality oracle
 * (synthetic by default, LLM-judge when keys exist), so the headline claim —
 * "cheaper than premium, better than cheapest" — is computed, regression-tested,
 * and reproducible rather than asserted in a pitch deck.
 */

export { DATASET, VALID_TYPES } from './dataset.js';
export { syntheticQuality, makeSyntheticOracle } from './oracle.js';
export { makeLiveOracle, canJudge, preflight, classifyTransportError } from './live-oracle.js';
export {
  cooStrategy,
  alwaysStrategy,
  qualityOracleStrategy,
  defaultStrategies,
  PREMIUM_MODEL,
  CHEAPEST_MODEL,
  BALANCED_MODEL,
} from './strategies.js';
export { evaluate, scoreStrategy, evaluateModels } from './run.js';
export { renderReport } from './report.js';
