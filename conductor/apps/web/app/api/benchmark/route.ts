import { evaluate } from '@conductor/eval'

export const runtime = 'nodejs'

// The eval is deterministic, pure compute — memoize the first run for the
// lifetime of the serverless instance so the landing wedge can read the real
// headline ("X% cheaper at Y% of premium quality") without recomputing per hit.
let cached: Promise<unknown> | null = null

/** Public: the headline cost/quality numbers behind the routing claim. */
export async function GET() {
  try {
    if (!cached) cached = evaluate()
    const r = (await cached) as { headline?: unknown; n?: number; oracle?: string }
    return Response.json(
      { headline: r.headline ?? {}, n: r.n ?? 0, oracle: r.oracle ?? null },
      { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    // Never fail the landing page on a benchmark hiccup — the client falls back
    // to its static copy when the headline is absent.
    return Response.json({ headline: {}, n: 0, oracle: null })
  }
}
