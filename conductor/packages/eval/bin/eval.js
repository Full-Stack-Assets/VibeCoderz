#!/usr/bin/env node
/**
 * CLI — run the routing benchmark and print (or write) the Markdown report.
 *
 *   node bin/eval.js            # synthetic oracle, print report
 *   node bin/eval.js --write    # also write conductor/BENCHMARKS.md
 *   node bin/eval.js --live     # use the LLM-judge oracle (requires a key)
 *   node bin/eval.js --json     # print the raw result object as JSON
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../src/run.js';
import { renderReport } from '../src/report.js';
import { makeSyntheticOracle } from '../src/oracle.js';
import { makeLiveOracle, canJudge } from '../src/live-oracle.js';
import { defaultStrategies } from '../src/strategies.js';
import { DATASET } from '../src/dataset.js';

async function main() {
  const args = new Set(process.argv.slice(2));

  let oracle;
  if (args.has('--live')) {
    if (!canJudge()) {
      console.error(
        'Refusing --live: no provider/gateway key set, so completions would be simulated and ' +
          'scores meaningless. Set AI_GATEWAY_API_KEY (or a native provider key) and retry.'
      );
      process.exit(2);
    }
    oracle = makeLiveOracle();
    console.error(`Running LIVE benchmark with ${oracle.name} — this calls real models…`);
  } else {
    oracle = makeSyntheticOracle();
  }

  const result = await evaluate({ dataset: DATASET, oracle, strategies: defaultStrategies(oracle) });

  if (args.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const md = renderReport(result, { dataset: DATASET });
  console.log(md);

  if (args.has('--write')) {
    // packages/eval/bin/ -> conductor/
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const out = path.join(root, 'BENCHMARKS.md');
    await fs.writeFile(out, md + '\n');
    console.error(`\nWrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
