/**
 * TURN CLASSIFIER — maps a chat turn to a COO "task".
 *
 * A lightweight, dependency-free heuristic classifier. It infers the turn's
 * specialty `type` (so the router can prefer the matching model), a `complexity`
 * score that raises the quality floor for harder asks, and a derived
 * `minQuality` bar used for capability-gated arbitrage. Deliberately
 * deterministic so routing is reproducible and testable.
 */

const SIGNALS = {
  code: [
    /```/, /\bfunction\b/i, /\bclass\b/i, /\bimplement\b/i, /\brefactor\b/i,
    /\bbug\b/i, /\bfix\b/i, /\bapi\b/i, /\bendpoint\b/i, /\bcompile\b/i,
    /\b(typescript|javascript|python|rust|golang|java|react|next\.?js|sql)\b/i,
  ],
  reasoning: [
    /\bdesign\b/i, /\barchitect/i, /\bwhy\b/i, /\bplan\b/i, /\bstrategy\b/i,
    /\btrade-?off/i, /\bdebug\b/i, /\breason/i, /\bprove\b/i, /\bapproach\b/i,
  ],
  writing: [
    /\bwrite\b/i, /\bdraft\b/i, /\bdocument/i, /\bdocs\b/i, /\bexplain\b/i,
    /\bsummar/i, /\bemail\b/i, /\bcopy\b/i, /\bblog\b/i, /\breadme\b/i,
  ],
  analysis: [
    /\banaly/i, /\bdata\b/i, /\bmetric/i, /\bcompare\b/i, /\bevaluat/i,
    /\bbenchmark/i, /\bstatistic/i, /\btrend/i, /\bchart\b/i,
  ],
};

function scoreType(text, patterns) {
  return patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

/**
 * Classify a turn.
 * @param {string} text - the user message (or concatenated context)
 * @param {{qualityFloor?: number}} [opts]
 * @returns {{type, complexity, minQuality, signals}}
 */
export function classifyTurn(text = '', opts = {}) {
  const t = String(text);
  const counts = {
    code: scoreType(t, SIGNALS.code),
    reasoning: scoreType(t, SIGNALS.reasoning),
    writing: scoreType(t, SIGNALS.writing),
    analysis: scoreType(t, SIGNALS.analysis),
  };

  // Pick the highest-signal type; default to reasoning for open-ended asks.
  let type = 'reasoning';
  let best = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > best) {
      best = v;
      type = k;
    }
  }

  // Complexity grows with length and explicit signal density, capped at 1.
  const lengthFactor = Math.min(1, t.length / 600);
  const signalFactor = Math.min(1, best / 4);
  const complexity = Math.max(0.3, 0.4 * lengthFactor + 0.6 * signalFactor);

  // Quality floor: harder turns demand a more capable model. A caller-supplied
  // qualityFloor sets a hard minimum (e.g. "always at least Sonnet").
  const derived = 0.55 + complexity * 0.4; // 0.67 .. 0.95
  const minQuality = Math.min(0.98, Math.max(opts.qualityFloor ?? 0, derived));

  return { type, complexity: Number(complexity.toFixed(2)), minQuality: Number(minQuality.toFixed(2)), signals: counts };
}
