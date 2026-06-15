/**
 * @conductor/coo-engine — Constraint-Optimized Orchestration for model routing.
 *
 * The orchestration brain of Conductor. Public surface:
 *   - routeTurn        : route one chat turn to the optimal model (+ audit trail)
 *   - complete         : run a completion on a chosen model (multi-provider + sim)
 *   - classifyTurn     : turn → COO task (type / complexity / quality bar)
 *   - MODEL_CATALOG    : the model pool, priced and capability-rated
 *   - core primitives  : calculateFitnessScore / findBestAgentForTask / weights
 */

export { routeTurn, estimateTurnCostUSD } from './router.js';
export { complete, simulate, gatewayConfig, messagesHaveImages, contentToText, toAnthropicContent, toOpenAIContent } from './llm.js';
export { makeAnthropicToolPlanner, makeOpenAIToolPlanner, makeLiveToolPlanner, canPlanLive } from './tool-planner.js';
export { classifyTurn, detectSensitive } from './classify.js';
export { MODEL_CATALOG, getModel, modelsAsAgents, visionModels } from './catalog.js';
export { completeWithEscalation, judgeAnswer, topModelId, parseScore, defaultJudgeModelId } from './escalate.js';
export {
  calculateFitnessScore,
  findBestAgentForTask,
  adaptiveWeights,
  BASE_WEIGHTS,
  FITNESS_THRESHOLD,
  BUDGET_THROTTLE,
} from './core.js';
