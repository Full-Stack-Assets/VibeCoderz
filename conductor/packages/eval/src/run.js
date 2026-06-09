/**
 * RUN — score every strategy over the dataset on cost and quality.
 *
 * Cost uses the engine's own `estimateTurnCostUSD` (the same pricing the product
 * meters with), so the dollar figures are consistent with what the router sees.
 * Quality comes from the pluggable oracle. The result includes per-strategy
 * aggregates plus headline comparisons of COO against the premium and cheapest
 * baselines — the "X% cheaper at Y% of the quality" claim, computed not asserted.
 */

import { estimateTurnCostUSD, getModel } from '../../coo-engine/src/index.js';
import { DATASET } from './dataset.js';
import { makeSyntheticOracle } from './oracle.js';
import { defaultStrategies } from './strategies.js';

const round = (n, d = 6) => Number(n.toFixed(d));

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

  return { oracle: oracle.name, n: dataset.length, strategies: results, headline };
}
