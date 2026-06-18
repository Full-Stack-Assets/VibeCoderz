/**
 * Dependency-free in-memory sliding-window rate limiter.
 *
 * Per-instance on serverless (each lambda limits independently), which is
 * meaningful abuse friction without extra infra. Back it with Redis/the DB for
 * a globally-consistent limit later — call sites won't change.
 */

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  retryAfterSec: number
}

/** Record a hit for `key`; allow up to `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const start = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > start)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) }
  }
  hits.push(now)
  buckets.set(key, hits)
  return { ok: true, retryAfterSec: 0 }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
