/**
 * TURN CLASSIFIER — maps a chat turn to a COO "task".
 *
 * A lightweight, dependency-free heuristic classifier. It infers the turn's
 * specialty `type` (so the router can prefer the matching model), a `complexity`
 * score that raises the quality floor for harder asks, and a derived
 * `minQuality` bar used for capability-gated arbitrage. Deliberately
 * deterministic so routing is reproducible and testable.
 *
 * Conductor is a GENERAL agent, not just a coding tool: beyond `code`, the
 * classifier recognises research, data/document analysis, writing, reasoning,
 * and vision (image) turns. Several intent buckets fold onto the same routing
 * `type` (the four model specialties), while a human-facing `domain` label is
 * surfaced for the UI/audit trail. When a turn carries images, `requiresVision`
 * gates routing to a multimodal model.
 */

// Intent buckets. Each maps to a model routing `type` and a UI `domain` below.
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
    /\bwrite\b/i, /\bdraft\b/i, /\bdocument\b/i, /\bdocs\b/i, /\bexplain\b/i,
    /\bsummar/i, /\bemail\b/i, /\bcopy\b/i, /\bblog\b/i, /\breadme\b/i,
  ],
  analysis: [
    /\banaly/i, /\bdata\b/i, /\bmetric/i, /\bcompare\b/i, /\bevaluat/i,
    /\bbenchmark/i, /\bstatistic/i, /\btrend/i, /\bchart\b/i,
  ],
  // Live-information intent — folds onto the `analysis` routing type but is
  // surfaced as the "research" domain (and nudges the agent toward web tools).
  research: [
    /\bsearch\b/i, /\blook ?up\b/i, /\bfind out\b/i, /\blatest\b/i, /\bnews\b/i,
    /\bcurrent\b/i, /\btoday\b/i, /\bsources?\b/i, /\bcite\b/i, /\bweb\b/i,
    /\bonline\b/i, /\brecent\b/i, /\bwho is\b/i, /\bgoogle\b/i,
  ],
  // Structured-data / document intent — also an `analysis` route, "data" domain.
  data: [
    /\bcsv\b/i, /\bdataset\b/i, /\bspreadsheet\b/i, /\bcolumns?\b/i, /\brows?\b/i,
    /\bparse\b/i, /\bjson\b/i, /\btable\b/i, /\baverage\b/i, /\bsum\b/i,
  ],
};

// bucket -> { type (routing), domain (UI label) }
const BUCKET = {
  code: { type: 'code', domain: 'coding' },
  reasoning: { type: 'reasoning', domain: 'reasoning' },
  writing: { type: 'writing', domain: 'writing' },
  analysis: { type: 'analysis', domain: 'analysis' },
  research: { type: 'analysis', domain: 'research' },
  data: { type: 'analysis', domain: 'data' },
};

function scoreType(text, patterns) {
  return patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

/**
 * Classify a turn.
 * @param {string} text - the user message (or concatenated context)
 * @param {{qualityFloor?: number, hasImages?: boolean}} [opts]
 * @returns {{type, domain, complexity, minQuality, requiresVision, signals}}
 */
export function classifyTurn(text = '', opts = {}) {
  const t = String(text);
  const counts = {};
  for (const k of Object.keys(SIGNALS)) counts[k] = scoreType(t, SIGNALS[k]);

  // Pick the highest-signal bucket; default to reasoning for open-ended asks.
  let bucket = null;
  let best = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > best) {
      best = v;
      bucket = k;
    }
  }
  const mapped = bucket ? BUCKET[bucket] : { type: 'reasoning', domain: 'general' };
  let { type, domain } = mapped;

  // Images present → require a multimodal model; surface the "vision" domain.
  const requiresVision = !!opts.hasImages;
  if (requiresVision) domain = 'vision';

  // Complexity grows with length and explicit signal density, capped at 1.
  const lengthFactor = Math.min(1, t.length / 600);
  const signalFactor = Math.min(1, best / 4);
  let complexity = Math.max(0.3, 0.4 * lengthFactor + 0.6 * signalFactor);
  if (requiresVision) complexity = Math.max(complexity, 0.5); // vision is never trivial

  // Quality floor: harder turns demand a more capable model. A caller-supplied
  // qualityFloor sets a hard minimum (e.g. "always at least Sonnet").
  const derived = 0.55 + complexity * 0.4; // 0.67 .. 0.95
  const minQuality = Math.min(0.98, Math.max(opts.qualityFloor ?? 0, derived));

  return {
    type,
    domain,
    complexity: Number(complexity.toFixed(2)),
    minQuality: Number(minQuality.toFixed(2)),
    requiresVision,
    signals: counts,
  };
}
