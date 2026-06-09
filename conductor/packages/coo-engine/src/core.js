/**
 * CONSTRAINT-OPTIMIZED ORCHESTRATION (COO) — CORE
 *
 * Ported, verbatim where it matters, from the COO Engine Implementation. This is
 * the orchestration brain of Conductor: multi-dimensional fitness scoring,
 * intelligent fallback routing, context-adaptive weighting, and the budget /
 * fitness admission gates that make routing decisions auditable.
 *
 * In Conductor the "agents" being scored are CANDIDATE MODELS and the "task" is a
 * single chat turn. The math is unchanged — that is the point: the same
 * constraint-optimized router that schedules agents now schedules model calls,
 * so every turn is routed to the cheapest model that is still good enough, and
 * never in a way that breaches the budget.
 */

// Specialty fallback table — per-type cost/latency priors used only when a
// candidate model does not carry its own costPerSec / maxLatency.
export const AGENT_TYPES = {
  reasoning: { costPerSec: 0.015, maxLatency: 3000 },
  code: { costPerSec: 0.012, maxLatency: 2000 },
  writing: { costPerSec: 0.008, maxLatency: 1500 },
  analysis: { costPerSec: 0.010, maxLatency: 2500 },
};

export const MAX_COST_PER_SEC = Math.max(...Object.values(AGENT_TYPES).map((a) => a.costPerSec));
export const MAX_LATENCY_MS = Math.max(...Object.values(AGENT_TYPES).map((a) => a.maxLatency));

// Static fitness weights (type 30 / cost 25 / latency 20 / load 15 / budget 10).
export const BASE_WEIGHTS = { type: 0.30, cost: 0.25, latency: 0.20, load: 0.15, budget: 0.10 };

// Admission gates.
// NOTE: the agent-scheduling engine uses 0.55. Recalibrated to 0.50 for the
// model-routing domain: here every candidate is a *different* model, so the
// premium model is always the max on cost AND latency and scores those two
// dimensions at ~0. With an explicit capability gate already guaranteeing
// quality (task.minQuality), 0.55 would wrongly throttle a quality-justified
// route to the top model. 0.50 keeps the load/budget guardrails while letting a
// type-matched premium model through. The 85% budget throttle is unchanged.
export const FITNESS_THRESHOLD = 0.50; // refuse structurally poor routes
export const BUDGET_THROTTLE = 0.85; // refuse routing past 85% of budget

/**
 * Compute fitness dimension weights that adapt to the currently-binding
 * constraint: budget pressure shifts weight toward cost+budget, queue/latency
 * pressure toward latency, load saturation toward load balancing. Renormalized
 * to sum to 1 so the score stays in [0, 1].
 */
export function adaptiveWeights(state) {
  const w = { ...BASE_WEIGHTS };
  const maxCost = state.constraints?.maxCost || 1;
  const util = Math.max(0, (state.totalCost || 0) / maxCost);
  const tasks = state.tasks || [];
  const queued = tasks.filter((t) => t.status === 'queued').length;
  const agents = state.agents || [];
  const idle = agents.filter((a) => a.status === 'idle' && !a.retiring).length;

  const budgetPressure = Math.min(1, Math.max(0, (util - 0.5) / 0.5));
  const queuePressure = Math.min(1, queued / 10);
  const loadPressure = agents.length ? 1 - idle / agents.length : 0;

  w.cost += 0.20 * budgetPressure;
  w.budget += 0.10 * budgetPressure;
  w.latency += 0.25 * queuePressure;
  w.load += 0.10 * loadPressure;

  const sum = w.type + w.cost + w.latency + w.load + w.budget;
  for (const k of Object.keys(w)) w[k] /= sum;
  return w;
}

/**
 * Calculate fitness score [0, 1] for a (model, task) pair across 5 constraint
 * dimensions: type match (30%), cost efficiency (25%), latency (20%), load
 * (15%), budget headroom (10%). Returns a per-dimension breakdown alongside the
 * aggregate so callers can render WHY a model was chosen.
 */
export function calculateFitnessScore(agent, task, state) {
  const typeMatch = agent.type === task.type ? 1.0 : 0.5;

  const costPerSec = agent.costPerSec ?? AGENT_TYPES[agent.type]?.costPerSec ?? 0.01;
  const costScore = Math.max(0, 1 - costPerSec / MAX_COST_PER_SEC);

  const agentLatency = agent.maxLatency ?? AGENT_TYPES[agent.type]?.maxLatency ?? 2000;
  const latencyScore = Math.max(0, 1 - agentLatency / MAX_LATENCY_MS);

  const agentLoad = agent.load || 0;
  const loadScore = 1 - agentLoad;

  const budgetUtilization = Math.max(0, state.totalCost / state.constraints.maxCost);
  const budgetMargin = Math.max(0, 1 - budgetUtilization);

  const w = state.weights || (state.adaptiveWeighting ? adaptiveWeights(state) : BASE_WEIGHTS);

  const dims = {
    type: Math.min(1, typeMatch) * w.type,
    cost: Math.min(1, costScore) * w.cost,
    latency: Math.min(1, latencyScore) * w.latency,
    load: Math.min(1, loadScore) * w.load,
    budget: Math.min(1, budgetMargin) * w.budget,
  };
  const finalScore = dims.type + dims.cost + dims.latency + dims.load + dims.budget;
  const score = Math.max(0, Math.min(1, finalScore));
  return { score, dims, weights: w };
}

/**
 * Route a task to the best-scoring model.
 *
 * STAGE 1 score every available model; STAGE 2 prefer a primary type match;
 * STAGE 3 fall back cross-type when no primary match exists; STAGE 4 enforce the
 * fitness threshold; STAGE 5 enforce the budget throttle. A capability gate
 * (task.minQuality) first filters to models good enough for the task, so the
 * cost-weighted score then picks the CHEAPEST model that still clears the bar.
 */
export function findBestAgentForTask(task, state) {
  let candidates = state.agents.filter((a) => a.status === 'idle' && !a.retiring);

  if (candidates.length === 0) {
    return { agent: null, score: 0, fallback: false, reason: 'no available models' };
  }

  // Vision gate: an image-bearing turn can only route to a multimodal model.
  if (task.requiresVision) {
    const seeing = candidates.filter((a) => a.multimodal);
    if (seeing.length === 0) {
      return { agent: null, score: 0, fallback: false, reason: 'no multimodal model available for image input' };
    }
    candidates = seeing;
  }

  if (task.minQuality != null) {
    const qualified = candidates.filter((a) => (a.capability != null ? a.capability : 1) >= task.minQuality);
    if (qualified.length === 0) {
      return { agent: null, score: 0, fallback: false, reason: `no model meets quality bar ${task.minQuality}` };
    }
    candidates = qualified;
  }

  const scored = candidates.map((agent) => {
    const fit = calculateFitnessScore(agent, task, state);
    return { agent, score: fit.score, dims: fit.dims, weights: fit.weights, typeMatch: agent.type === task.type };
  });

  const primaryMatches = scored.filter((c) => c.typeMatch);
  const bestPrimary = primaryMatches.length > 0
    ? primaryMatches.reduce((a, b) => (a.score > b.score ? a : b))
    : null;

  let best = bestPrimary;
  let usedFallback = false;
  if (!best) {
    best = scored.reduce((a, b) => (a.score > b.score ? a : b));
    usedFallback = true;
  }

  if (best.score < FITNESS_THRESHOLD) {
    return {
      agent: null,
      score: best.score,
      dims: best.dims,
      weights: best.weights,
      fallback: usedFallback,
      reason: `fitness ${best.score.toFixed(2)} < threshold ${FITNESS_THRESHOLD}`,
    };
  }

  const budgetUtilization = state.totalCost / state.constraints.maxCost;
  if (budgetUtilization > BUDGET_THROTTLE) {
    return {
      agent: null,
      score: best.score,
      dims: best.dims,
      weights: best.weights,
      fallback: usedFallback,
      reason: `budget at ${(budgetUtilization * 100).toFixed(0)}% (throttled)`,
    };
  }

  return {
    agent: best.agent,
    score: best.score,
    dims: best.dims,
    weights: best.weights,
    fallback: usedFallback,
    candidates: scored.map((c) => ({ id: c.agent.id, label: c.agent.label, score: c.score, typeMatch: c.typeMatch })),
    reason: usedFallback
      ? `cross-type fallback to ${best.agent.label} (no primary match, score ${best.score.toFixed(2)})`
      : `optimal match: ${best.agent.label} (score ${best.score.toFixed(2)})`,
  };
}
