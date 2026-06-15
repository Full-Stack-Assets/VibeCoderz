/**
 * RUN — score every strategy over the dataset on cost and quality.
 *
 * Cost uses the engine's own `estimateTurnCostUSD` (the same pricing the product
 * meters with), so the dollar figures are consistent with what the router sees.
 * Quality comes from the pluggable oracle. The result includes per-strategy
 * aggregates plus headline comparisons of COO against the premium and cheapest
 * baselines — the "X% cheaper at Y% of the quality" claim, computed not asserted.
 */

import { estimateTurnCostUSD, getModel, MODEL_CATALOG } from '@conductor/coo-engine';
import { DATASET } from './dataset.js';
import { makeSyntheticOracle } from './oracle.js';
import { defaultStrategies, alwaysStrategy } from './strategies.js';

const round = (n, d = 6) => Number(n.toFixed(d));

const avgBy = (rows, key) => (rows.length ? rows.reduce((s, r) => s + r[key], 0) / rows.length : 0);

/**
 * Per-domain breakdown: where does cheapest-good-enough routing hold up, and
 * where does the premium model actually earn its price? Computed from the
 * already-scored rows of the COO and premium strategies.
 */
function domainBreakdown(coo, premium) {
  const domains = [...new Set(coo.rows.map((r) => r.domain))];
  return domains.map((domain) => {
    const cr = coo.rows.filter((r) => r.domain === domain);
    const pr = premium ? premium.rows.filter((r) => r.domain === domain) : [];
    const cooQuality = avgBy(cr, 'quality');
    const premiumQuality = avgBy(pr, 'quality');
    return {
      domain,
      tasks: cr.length,
      cooQuality: round(cooQuality, 4),
      premiumQuality: round(premiumQuality, 4),
      retentionPct: premiumQuality > 0 ? round((cooQuality / premiumQuality) * 100, 1) : 100,
      cooCostPerTask: round(avgBy(cr, 'cost')),
      models: [...new Set(cr.map((r) => r.modelId))],
    };
  });
}

/** Score one strategy across the dataset. */
export async function scoreStrategy(name, pick, { dataset, oracle }) {
  let totalCost = 0;
  let totalQuality = 0;
  const rows = [];
  for (const task of dataset) {
    const modelId = await pick(task);
    const model = modelId ? getModel(modelId) : null;
    const cost = model ? estimateTurnCostUSD(model, task.prompt.length) : 0;
    const quality = model ? await oracle.quality(model, task) : 0;
    totalCost += cost;
    totalQuality += quality;
    rows.push({ taskId: task.id, domain: task.domain, modelId, cost: round(cost), quality: round(quality, 4) });
  }
  const n = dataset.length;
  return {
    name,
    n,
    avgQuality: round(totalQuality / n, 4),
    totalCost: round(totalCost),
    costPerTask: round(totalCost / n),
    qualityPerDollar: totalCost > 0 ? round(totalQuality / n / (totalCost / n), 2) : Infinity,
    rows,
  };
}

/**
 * Evaluate a set of strategies.
 * @param {object} [opts]
 * @param {Array} [opts.dataset]      defaults to the golden DATASET
 * @param {object} [opts.oracle]      defaults to the synthetic oracle
 * @param {object} [opts.strategies]  name -> (task)=>modelId; defaults to the standard set
 * @returns {Promise<{ oracle:string, n:number, strategies:object[], headline:object }>}
 */
export async function evaluate(opts = {}) {
  const dataset = opts.dataset || DATASET;
  const oracle = opts.oracle || makeSyntheticOracle();
  const strategies = opts.strategies || defaultStrategies(oracle);

  const results = [];
  for (const [name, pick] of Object.entries(strategies)) {
    results.push(await scoreStrategy(name, pick, { dataset, oracle }));
  }

  const by = (n) => results.find((r) => r.name.startsWith(n));
  const coo = by('COO');
  const premium = by('Always-Premium');
  const cheapest = by('Always-Cheapest');
  const best = by('Quality-Oracle');

  const headline = {};
  if (coo && premium) {
    headline.vsPremium = {
      costSavingsPct: round((1 - coo.totalCost / premium.totalCost) * 100, 1),
      qualityRetentionPct: round((coo.avgQuality / premium.avgQuality) * 100, 1),
    };
  }
  if (coo && cheapest) {
    headline.vsCheapest = {
      extraCostPct: cheapest.totalCost > 0 ? round((coo.totalCost / cheapest.totalCost - 1) * 100, 1) : null,
      qualityGainPct: round((coo.avgQuality / cheapest.avgQuality - 1) * 100, 1),
    };
  }
  if (coo && best) {
    headline.vsOracle = {
      qualityOfBestPct: round((coo.avgQuality / best.avgQuality) * 100, 1),
    };
  }

  const byDomain = coo ? domainBreakdown(coo, premium) : [];

  return { oracle: oracle.name, n: dataset.length, strategies: results, headline, byDomain };
}

/**
 * Per-MODEL leaderboard — the "which model should I actually use" view.
 *
 * Scores every catalog model as an always-pin strategy over the dataset, then
 * ranks by quality-per-dollar (value) and surfaces the best model per task
 * domain (both the highest raw quality and the best value). This is the public,
 * shareable leaderboard the marketing page renders; it reuses the same dataset,
 * oracle, and pricing as `evaluate()`, so the numbers are consistent.
 */
export async function evaluateModels(opts = {}) {
  const dataset = opts.dataset || DATASET;
  const oracle = opts.oracle || makeSyntheticOracle();

  const scored = [];
  for (const m of MODEL_CATALOG) {
    const s = await scoreStrategy(m.label, alwaysStrategy(m.id), { dataset, oracle });
    scored.push({
      id: m.id,
      label: m.label,
      provider: m.provider,
      capability: m.capability,
      multimodal: !!m.multimodal,
      avgQuality: s.avgQuality,
      costPerTask: s.costPerTask,
      qualityPerDollar: s.qualityPerDollar,
      rows: s.rows,
    });
  }

  const domains = [...new Set(dataset.map((t) => t.domain))];
  const bestByDomain = domains.map((domain) => {
    let bestQuality = null;
    let bestValue = null;
    for (const m of scored) {
      const dr = m.rows.filter((r) => r.domain === domain);
      if (!dr.length) continue;
      const quality = avgBy(dr, 'quality');
      const cost = avgBy(dr, 'cost');
      const value = cost > 0 ? quality / cost : Infinity;
      if (!bestQuality || quality > bestQuality.quality) {
        bestQuality = { id: m.id, label: m.label, quality: round(quality, 4) };
      }
      if (!bestValue || value > bestValue.value) {
        bestValue = { id: m.id, label: m.label, value: round(value, 2), costPerTask: round(cost) };
      }
    }
    return { domain, tasks: dataset.filter((t) => t.domain === domain).length, bestQuality, bestValue };
  });

  // Strip the per-task rows from the public shape; rank by value (quality/$).
  const models = scored
    .map(({ rows: _rows, ...rest }) => rest)
    .sort((a, b) => b.qualityPerDollar - a.qualityPerDollar);

  return { n: dataset.length, models, bestByDomain };
}
