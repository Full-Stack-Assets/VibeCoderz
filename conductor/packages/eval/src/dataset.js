/**
 * GOLDEN DATASET — the workload the routing strategies are scored against.
 *
 * Each task is annotated with:
 *   - `domain`        : product-facing capability (coding/research/data/…)
 *   - `idealType`     : the model specialty that best fits it (matches catalog
 *                       `type`: code | reasoning | writing | analysis)
 *   - `difficulty`    : ground-truth hardness in [0,1]; the quality oracle uses
 *                       this to decide which models are "good enough"
 *   - `requiresVision`: image input → only multimodal models can do it
 *   - `prompt`        : the actual request (drives classification + cost + the
 *                       live-judge oracle)
 *
 * The set is deliberately spread across difficulties so the cost/quality
 * tradeoff is visible: cheap models are good enough on easy/mid tasks, while the
 * premium model only pulls ahead on the hardest ones — exactly the regime where
 * cheapest-good-enough routing should win on cost without losing much quality.
 */

export const DATASET = [
  // --- coding -------------------------------------------------------------
  { id: 'code-easy-1', domain: 'coding', idealType: 'code', difficulty: 0.45,
    prompt: 'Write a JavaScript function that reverses a string.' },
  { id: 'code-mid-1', domain: 'coding', idealType: 'code', difficulty: 0.65,
    prompt: 'Implement a debounce utility in TypeScript with a cancel method and proper typing.' },
  { id: 'code-mid-2', domain: 'coding', idealType: 'code', difficulty: 0.7,
    prompt: 'Refactor this Express route into a Next.js API route handler with input validation and rate limiting.' },
  { id: 'code-hard-1', domain: 'coding', idealType: 'code', difficulty: 0.9,
    prompt: 'Implement a lock-free single-producer single-consumer ring buffer in Rust and explain the memory ordering guarantees.' },

  // --- reasoning / architecture ------------------------------------------
  { id: 'reason-mid-1', domain: 'reasoning', idealType: 'reasoning', difficulty: 0.6,
    prompt: 'Explain the tradeoffs between optimistic and pessimistic locking for a booking system.' },
  { id: 'reason-hard-1', domain: 'reasoning', idealType: 'reasoning', difficulty: 0.92,
    prompt: 'Design a globally distributed, strongly consistent counter service and justify the consensus protocol, failure modes, and latency budget.' },
  { id: 'reason-hard-2', domain: 'reasoning', idealType: 'reasoning', difficulty: 0.88,
    prompt: 'Prove that the routing fitness score is bounded in [0,1] and analyze when adaptive weighting changes the chosen model.' },

  // --- writing ------------------------------------------------------------
  { id: 'write-easy-1', domain: 'writing', idealType: 'writing', difficulty: 0.4,
    prompt: 'Draft a friendly two-sentence release note for a dark-mode feature.' },
  { id: 'write-mid-1', domain: 'writing', idealType: 'writing', difficulty: 0.62,
    prompt: 'Write a clear README introduction for an open-source constraint-optimized model router.' },
  { id: 'write-mid-2', domain: 'writing', idealType: 'writing', difficulty: 0.68,
    prompt: 'Summarize a technical RFC about budget-aware orchestration for a non-technical executive audience.' },

  // --- analysis -----------------------------------------------------------
  { id: 'analysis-mid-1', domain: 'analysis', idealType: 'analysis', difficulty: 0.58,
    prompt: 'Compare these latency benchmarks across three regions and identify the regression.' },
  { id: 'analysis-hard-1', domain: 'analysis', idealType: 'analysis', difficulty: 0.85,
    prompt: 'Given a noisy time series of request costs, detect change points and attribute them to likely causes.' },

  // --- research (live-information; routes on analysis) --------------------
  { id: 'research-mid-1', domain: 'research', idealType: 'analysis', difficulty: 0.6,
    prompt: 'Search the web for the current pricing of major LLM providers and summarize with sources.' },
  { id: 'research-mid-2', domain: 'research', idealType: 'analysis', difficulty: 0.66,
    prompt: 'Look up the latest guidance on the EU AI Act timeline and cite the primary sources.' },

  // --- data (structured; routes on analysis) -----------------------------
  { id: 'data-easy-1', domain: 'data', idealType: 'analysis', difficulty: 0.5,
    prompt: 'Parse this CSV of sales rows and report the mean and median revenue per column.' },
  { id: 'data-mid-1', domain: 'data', idealType: 'analysis', difficulty: 0.72,
    prompt: 'Analyze this dataset of user sessions, compute funnel conversion, and flag anomalous cohorts.' },

  // --- vision (image input; requires a multimodal model) -----------------
  { id: 'vision-mid-1', domain: 'vision', idealType: 'reasoning', difficulty: 0.6, requiresVision: true,
    prompt: 'What is shown in this screenshot and what is the likely bug?' },
  { id: 'vision-hard-1', domain: 'vision', idealType: 'reasoning', difficulty: 0.82, requiresVision: true,
    prompt: 'Read this architecture diagram image and identify the single point of failure.' },
];

/** Sanity invariants the dataset must satisfy (asserted in tests). */
export const VALID_TYPES = ['code', 'reasoning', 'writing', 'analysis'];
