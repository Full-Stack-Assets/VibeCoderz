/**
 * QUALITY ORACLE — the ground-truth "how good was this model on this task?".
 *
 * This is the crux of the harness, so it is made EXPLICIT and SWAPPABLE. A
 * routing strategy is only as credible as the quality measurement it is judged
 * against, so we separate the *oracle* (what quality is) from the *comparison*
 * (cost vs quality across strategies). Two oracles share one interface
 * `quality(model, task) -> [0,1]`:
 *
 *   - syntheticQuality (default, offline, deterministic): a transparent MODEL of
 *     model competence. It is NOT a measurement — it encodes a defensible prior
 *     (capability vs task difficulty, specialty match, vision capability) so the
 *     harness runs in CI with zero keys and the assumptions are auditable in one
 *     place rather than hidden in hand-tuned per-cell numbers.
 *   - liveJudgeQuality (see live-oracle.js): calls the model for real and scores
 *     the output with an LLM judge. Drop it in to replace the prior with data.
 *
 * The honest framing: today the headline numbers come from the synthetic prior;
 * the value of the harness is that swapping in measured scores requires changing
 * only this oracle, not the strategies, dataset, or report.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Synthetic competence model.
 *
 * Above the difficulty bar a model is "good enough" and quality saturates near
 * the top (premium edges ahead only via headroom); below the bar quality falls
 * off sharply. A matching specialty helps a little; an image task is near-zero
 * for a text-only model.
 */
export function syntheticQuality(model, task) {
  const capability = model.capability ?? 0.8;
  const headroom = capability - task.difficulty;

  let q;
  if (headroom >= 0) {
    q = 0.9 + 0.1 * Math.min(1, headroom / 0.25); // good enough → 0.90 .. 1.00
  } else {
    q = 0.9 + headroom * 1.6; // under-capable → drops fast
  }

  // Specialty match: a small edge for the type-fit specialist. Deliberately
  // SMALL and one-sided — capability dominates, and we do NOT penalize a
  // high-capability generalist off-type (a frontier model isn't *worse* than a
  // specialist, just pricier). Routing's value is cost, not beating premium on
  // quality; an oracle that let the cheap router "win" on quality would be a
  // tell that it was rigged.
  if (model.type === task.idealType) q += 0.02;

  // Vision: a text-only model effectively cannot do an image task.
  if (task.requiresVision && !model.multimodal) q = Math.min(q, 0.2);

  return Number(clamp01(q).toFixed(4));
}

/** Default oracle (offline, deterministic). */
export function makeSyntheticOracle() {
  return { name: 'synthetic', live: false, quality: syntheticQuality };
}
