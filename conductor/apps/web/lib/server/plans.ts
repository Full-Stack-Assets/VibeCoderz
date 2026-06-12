import { getStore } from '@conductor/agent-memory'
import type { PlanId } from './session'

/**
 * Server-authoritative plan limits. These — not the client — decide the spend
 * budget, the spend period, and whether a user may override the router's model
 * choice. Amounts mirror the marketing copy in lib/auth.ts (Free $1/day, Pro
 * $25/mo, Max $150/mo); tune here, in one place.
 */
export interface PlanLimits {
  budgetUSD: number
  periodDays: number
  /** May the user pin a specific model (preferModel)? Paid-only feature. */
  allowPreferModel: boolean
  /** Hard cap on the quality floor a user can demand (stops free→Opus-only). */
  maxQualityFloor: number
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { budgetUSD: 1, periodDays: 1, allowPreferModel: false, maxQualityFloor: 0.85 },
  pro: { budgetUSD: 25, periodDays: 30, allowPreferModel: true, maxQualityFloor: 0.95 },
  max: { budgetUSD: 150, periodDays: 30, allowPreferModel: true, maxQualityFloor: 1 },
}

export const planLimits = (plan: PlanId): PlanLimits => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

/** Clamp client-supplied routing overrides to what the plan permits. */
export function sanitizeOverrides(
  plan: PlanId,
  preferModel?: string,
  qualityFloor?: number
): { preferModel: string | undefined; qualityFloor: number | undefined } {
  const lim = planLimits(plan)
  const floor = Math.min(Math.max(qualityFloor ?? 0, 0), lim.maxQualityFloor)
  return {
    preferModel: lim.allowPreferModel ? preferModel || undefined : undefined,
    qualityFloor: floor > 0 ? floor : undefined,
  }
}

export interface UsageStore {
  /** Current spend for the active period; resets the period if it has elapsed. */
  getUserUsage(userId: string, periodMs: number): Promise<number>
  /** Add metered cost to the user's running spend; returns the new total. */
  addUserUsage(userId: string, deltaUSD: number): Promise<number>
}

export async function usageStore(): Promise<UsageStore> {
  return (await getStore()) as unknown as UsageStore
}
