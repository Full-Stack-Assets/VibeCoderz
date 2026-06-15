/**
 * AUTOMATIC MEMORY EXTRACTION (Phase 4b).
 *
 * Distils DURABLE, user-specific facts/preferences from a turn so personalization
 * doesn't depend on the user manually saving everything. Cost is controlled two
 * ways: a cheap heuristic GATE (`looksLikePreference`) means an extraction LLM
 * call only fires on turns that plausibly state a lasting fact, and the
 * extraction itself runs on the cheap judge model with a small token budget.
 * `complete` is injectable so the parser/dedup logic is unit-testable with no key.
 */

import { complete as defaultComplete } from './llm.js';
import { defaultJudgeModelId } from './escalate.js';

const EXTRACT_SYSTEM =
  'You extract DURABLE, user-specific facts or preferences worth remembering ' +
  'across future conversations — e.g. "prefers TypeScript", "is building a Next.js ' +
  'app", "wants concise answers", "based in Berlin". Ignore ephemeral or ' +
  'task-specific details, questions, and anything already known. Output ONLY a ' +
  'JSON array of short strings (0 to 3). If nothing durable, output [].';

// Gate: only spend an extraction call on turns that plausibly state a lasting
// fact/preference. Keeps cost negligible across normal Q&A traffic.
const PREF_SIGNAL =
  /\b(i (prefer|like|love|hate|use|usually|always|never|need|want|am|work)|i'?m (working|building|using|based)|my (name|stack|project|team|company|goal|preference)|call me|remember (that|this)|from now on|in the future)\b/i;

export function looksLikePreference(text = '') {
  return PREF_SIGNAL.test(String(text));
}

/**
 * Parse the model's JSON array, drop blanks/overlong, and dedup vs. `existing`.
 * @param {string} out
 * @param {string[]} [existing]
 * @returns {string[]}
 */
export function parseMemoryList(out, existing = []) {
  let arr;
  try {
    const m = String(out).match(/\[[\s\S]*\]/);
    arr = m ? JSON.parse(m[0]) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set(existing.map((s) => String(s).toLowerCase().trim()));
  const result = [];
  for (const item of arr) {
    const s = String(item).trim();
    const key = s.toLowerCase();
    if (!s || s.length > 200 || seen.has(key)) continue;
    seen.add(key);
    result.push(s);
    if (result.length >= 3) break;
  }
  return result;
}

/**
 * Extract new durable memories from a user message. Returns [] without an LLM
 * call when the turn doesn't look like a preference, or when running simulated.
 * @param {{ text?: string, existing?: string[], model?: string, complete?: Function }} [opts]
 * @returns {Promise<string[]>} new facts not already in `existing`
 */
export async function extractMemories({ text, existing = [], model, complete = defaultComplete } = {}) {
  if (!looksLikePreference(text)) return [];
  const judge = model || defaultJudgeModelId();
  const known = existing.length
    ? `\n\nAlready known (do NOT repeat):\n${existing.map((m) => `- ${m}`).join('\n')}`
    : '';
  const res = await complete(judge, {
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: `USER MESSAGE:\n${text}${known}\n\nReturn the JSON array:` }],
    maxTokens: 200,
  });
  if (res.simulated) return [];
  return parseMemoryList(res.text, existing);
}
