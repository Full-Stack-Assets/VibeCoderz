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

import { complete, gatewayConfig } from '@conductor/coo-engine';

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

/**
 * Classify a transport failure so the CLI can print an actionable fix instead
 * of a raw 403 stack trace. Pure (operates on the error text) so it's unit-
 * testable with no network. Order matters: a blocked host arrives AS a 403
 * ("Host not in allowlist"), so the network check must run before the auth one.
 *   - 'network' : host blocked by an allowlist / DNS / connection failure — the
 *                 gateway is unreachable from this environment.
 *   - 'auth'    : the gateway/provider rejected the credentials (bad/absent key).
 *   - 'unknown' : anything else.
 */
export function classifyTransportError(err) {
  const msg = String(err?.message ?? err);
  if (/not in allowlist|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)) {
    return 'network';
  }
  if (/\b401\b|\b403\b|unauthor|forbidden|invalid[\s_-]*(api|key)|x-api-key|api key/i.test(msg)) {
    return 'auth';
  }
  return 'unknown';
}

/** Pick the cheapest model the current config can reach live for the probe. */
function probeModelId(env = process.env) {
  if (gatewayConfig(env)) return 'xai/grok-4.1-fast-reasoning'; // gateway reaches every model
  if (env.XAI_API_KEY) return 'xai/grok-4.1-fast-reasoning';
  if (env.OPENAI_API_KEY) return 'openai/gpt-5.3-codex';
  if (env.ANTHROPIC_API_KEY) return 'anthropic/claude-sonnet-4.6';
  return 'xai/grok-4.1-fast-reasoning';
}

/**
 * PREFLIGHT — make one cheap real completion before the full benchmark so a
 * misconfigured gateway (blocked host, invalid key) fails fast with an
 * actionable message instead of throwing a raw 403 on task 1 of N. Returns a
 * result object rather than throwing, so the CLI can render a clean diagnostic.
 *
 * @returns {Promise<{ok:boolean, kind?:string, detail:string, provider?:string}>}
 */
export async function preflight({ env = process.env } = {}) {
  const modelId = probeModelId(env);
  try {
    const r = await complete(modelId, {
      system: 'Connectivity check. Reply with the single token OK.',
      messages: [{ role: 'user', content: 'OK?' }],
      maxTokens: 4,
    });
    if (r.simulated) {
      return {
        ok: false,
        kind: 'simulated',
        detail: `probe to ${modelId} returned a simulated completion (no live transport)`,
      };
    }
    return { ok: true, provider: r.provider, detail: `reached ${r.provider} via ${modelId}` };
  } catch (err) {
    return { ok: false, kind: classifyTransportError(err), detail: String(err?.message ?? err) };
  }
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
