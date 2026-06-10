/**
 * REPORT — render an evaluation result as Markdown (table + headline + notes).
 */

/** Render the per-strategy comparison as a Markdown report string. */
export function renderReport(result, { dataset } = {}) {
  const { strategies, headline, oracle, n, byDomain = [] } = result;

  const lines = [];
  lines.push('# Conductor — Routing Benchmark');
  lines.push('');
  lines.push(
    `Comparison of the **COO router** against pin-one-model baselines over a ${n}-task ` +
      `golden set spanning coding, reasoning, writing, analysis, research, data, and vision. ` +
      `Cost is computed with the engine's own token pricing; quality comes from the ` +
      `\`${oracle}\` oracle.`
  );
  lines.push('');

  // Strategy table.
  lines.push('| Strategy | Avg quality | Total cost | $ / task | Quality / $ |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const s of strategies) {
    const qpd = Number.isFinite(s.qualityPerDollar) ? s.qualityPerDollar.toLocaleString('en-US') : '∞';
    lines.push(
      `| ${s.name} | ${(s.avgQuality * 100).toFixed(1)}% | $${s.totalCost.toFixed(5)} | ` +
        `$${s.costPerTask.toFixed(5)} | ${qpd} |`
    );
  }
  lines.push('');

  // Headline.
  lines.push('## Headline');
  lines.push('');
  if (headline.vsPremium) {
    lines.push(
      `- **vs Always-Premium (Opus):** ${headline.vsPremium.costSavingsPct}% cheaper while ` +
        `retaining ${headline.vsPremium.qualityRetentionPct}% of its quality.`
    );
  }
  if (headline.vsCheapest) {
    const extra = headline.vsCheapest.extraCostPct;
    lines.push(
      `- **vs Always-Cheapest (Grok):** ${headline.vsCheapest.qualityGainPct}% higher quality` +
        (extra != null ? ` for ${extra}% more spend.` : '.')
    );
  }
  if (headline.vsOracle) {
    lines.push(
      `- **vs Quality-Oracle (best achievable):** COO reaches ${headline.vsOracle.qualityOfBestPct}% ` +
        `of the best-possible quality — at a fraction of the premium cost.`
    );
  }
  lines.push('');

  // Per-domain breakdown: where cheap-good-enough holds vs where premium earns it.
  if (byDomain.length) {
    lines.push('## Where routing wins (per domain)');
    lines.push('');
    lines.push('| Domain | Tasks | COO quality | Premium quality | Retention | COO $ / task | Models COO used |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const d of byDomain) {
      lines.push(
        `| ${d.domain} | ${d.tasks} | ${(d.cooQuality * 100).toFixed(1)}% | ${(d.premiumQuality * 100).toFixed(1)}% | ` +
          `${d.retentionPct}% | $${d.cooCostPerTask.toFixed(5)} | ${d.models.join(', ')} |`
      );
    }
    lines.push('');
  }

  // Per-domain routing (which model COO chose).
  const coo = strategies.find((s) => s.name.startsWith('COO'));
  if (coo) {
    lines.push('## How COO routed each task');
    lines.push('');
    lines.push('| Task | Domain | Routed model | Cost | Quality |');
    lines.push('| --- | --- | --- | ---: | ---: |');
    for (const r of coo.rows) {
      lines.push(
        `| ${r.taskId} | ${r.domain} | ${r.modelId || '—'} | $${r.cost.toFixed(5)} | ${(r.quality * 100).toFixed(1)}% |`
      );
    }
    lines.push('');
  }

  lines.push('## Method & honesty notes');
  lines.push('');
  lines.push(
    '- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, ' +
      'not a reimplementation.'
  );
  lines.push(
    '- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.'
  );
  lines.push(
    '- **Quality** is currently the `synthetic` oracle: a transparent prior (capability vs ' +
      'task difficulty, specialty match, vision capability), not a live measurement. It exists ' +
      'so the harness runs deterministically in CI. Swap in the **LLM-judge** oracle ' +
      '(`--live`, requires a gateway/provider key) to replace the prior with measured scores — ' +
      'the strategies, dataset, and this report do not change.'
  );
  lines.push(
    '- Regenerate with `pnpm eval` (add `--write` to update this file).'
  );
  lines.push('');
  return lines.join('\n');
}
