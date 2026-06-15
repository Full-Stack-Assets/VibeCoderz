import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { BILLING_ENABLED } from '@/lib/billing'

/**
 * Liveness + readiness probe for load balancers, uptime monitors, and
 * post-deploy smoke checks. Reports process health, database connectivity, and
 * which optional subsystems are configured. Returns 503 when a hard dependency
 * (the database) is unreachable so a bad deploy can be detected and rolled back.
 *
 * Always dynamic — never cache a health check.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()

  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {
    database: 'skipped',
  }

  let healthy = true

  try {
    const db = await getDb()
    await db.run(sql`select 1`)
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }

  // Configuration readiness — surfaced as booleans, not secrets, so the probe
  // doubles as a "is this environment wired up" signal without leaking values.
  const config = {
    billingEnabled: BILLING_ENABLED,
    aiGateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    sandbox: Boolean(
      process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN
    ),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      config,
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}
