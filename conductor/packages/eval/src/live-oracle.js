/**
 * LIVE ORACLE — replace the synthetic prior with measured quality.
 *
 * For each (model, task) it actually runs the model via the engine's `complete`
 * and scores the output 0..1 with an LLM judge (a strong model graded on a
 * rubric). Only usable when a gateway/provider key is set; without one,
 * `complete` would itself be simulated and the scores meaningless — so the CLI
 * refuses `--live` unless `canJudge()` is true.
 *
 * Results are cached per (model, task) so each cell is computed once. This is
 * the seam that turns the harness from "transparent assumptions" into "evidence":
 * the strategies, dataset, and report are unchanged — only the oracle differs.
 */

import { complete, gatewayConfig } from '../../coo-engine/src/index.js';

const DEFAULT_JUDGE = 'anthropic/claude-opus-4.6';

/** True when live answers + judging are possible (a real key is configured). */
export function canJudge(env = process.env) {
  return (
    !!gatewayConfig(env) ||
    !!env.ANTHROPIC_API_KEY ||
    !!env.OPENAI_API_KEY ||
    !!env.XAI_API_KEY
  );
}

const JUDGE_SYSTEM =
  'You are a strict evaluation judge. Score how well an AI response answers a ' +
  'request on a 0–100 scale: 0 = wrong/unusable, 60 = acceptable, 100 = expert, ' +
  'complete, and correct. Reply with ONLY the integer score.';

function parseScore(text) {
  const m = String(text).match(/\d{1,3}/);
  if (!m) return null;
  return Math.max(0, Math.min(100, Number(m[0]))) / 100;
}

/**
 * Build a live judging oracle.
 * @param {object} [opts]
 * @param {string} [opts.judgeModel]  catalog id of the judge (default Opus)
 * @param {number} [opts.maxTokens]   answer length cap
 */
export function makeLiveOracle({ judgeModel = DEFAULT_JUDGE, maxTokens = 700 } = {}) {
  const cache = new Map(); // `${modelId}::${taskId}` -> quality

  async function quality(model, task) {
    const key = `${model.id}::${task.id}`;
    if (cache.has(key)) return cache.get(key);

    // A text-only model genuinely cannot answer a vision task.
    if (task.requiresVision && !model.multimodal) {
      cache.set(key, 0.1);
      return 0.1;
    }

    const answer = await complete(model.id, {
      system: 'You are a capable assistant. Answer the request as well as you can.',
      messages: [{ role: 'user', content: task.prompt }],
      maxTokens,
    });

    const verdict = await complete(judgeModel, {
      system: JUDGE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `REQUEST:\n${task.prompt}\n\nRESPONSE:\n${answer.text}\n\nScore (0-100):`,
        },
      ],
      maxTokens: 8,
    });

    const score = parseScore(verdict.text);
    const q = score == null ? 0.5 : score;
    cache.set(key, q);
    return q;
  }

  return { name: `live-judge(${judgeModel})`, live: true, quality };
}
