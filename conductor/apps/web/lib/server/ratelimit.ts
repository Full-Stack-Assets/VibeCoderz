/**
 * Dependency-free in-memory sliding-window rate limiter for auth routes.
 *
 * Per-instance on serverless (each lambda limits independently), which is
 * meaningful brute-force/credential-stuffing friction without extra infra. For
 * a globally-consistent limit, back this with the store/Redis later — the call
 * sites won't change.
 */

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  retryAfterSec: number
  /** Calls still allowed in the current window (0 when the limit is hit). */
  remaining: number
}

/** Record a hit for `key`; allow up to `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const start = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > start)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000))
    return { ok: false, retryAfterSec, remaining: 0 }
  }
  hits.push(now)
  buckets.set(key, hits)
  return { ok: true, retryAfterSec: 0, remaining: Math.max(0, limit - hits.length) }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** A 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number, message = 'Too many attempts. Please wait and try again.'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfterSec) },
  })
}

// Test-only: reset state between cases.
export function _resetRateLimit() {
  buckets.clear()
}
