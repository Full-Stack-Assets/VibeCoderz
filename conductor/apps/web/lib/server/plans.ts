import { getStore } from '@conductor/agent-memory'
import type { PlanId } from './session'

/**
 * Server-authoritative plan limits. These — not the client — decide the spend
 * budget, the spend period, and whether a user may override the router's model
 * choice. NOTE: `budgetUSD` is the per-period MODEL-SPEND ceiling (the margin
 * cap), NOT the subscription price — subscription prices live in lib/auth.ts
 * PLANS. Current caps: Free $0.20/day, Pro $10/mo, Max $50/mo. Tune here.
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
  // Caps are margin-safe ceilings (router keeps real spend well below them):
  // Pro $20 → ≤$10 model spend ≈ 50% gross; Max $100 → ≤$50 ≈ 50% gross.
  free: { budgetUSD: 0.2, periodDays: 1, allowPreferModel: false, maxQualityFloor: 0.85 },
  pro: { budgetUSD: 10, periodDays: 30, allowPreferModel: true, maxQualityFloor: 0.95 },
  max: { budgetUSD: 50, periodDays: 30, allowPreferModel: true, maxQualityFloor: 1 },
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

/**
 * Split a turn's cost across the plan allowance and rolled-over top-up credit.
 * The plan allowance is charged first (so `spent` never exceeds the plan cap);
 * any overflow is drawn from purchased credit. Pure + deterministic so the
 * money math is unit-tested independently of the streaming route.
 */
export function chargeSplit(
  planBudgetUSD: number,
  spentUSD: number,
  costUSD: number
): { fromPlan: number; fromTopup: number } {
  const planRoom = Math.max(0, planBudgetUSD - spentUSD)
  const fromPlan = Math.min(Math.max(0, costUSD), planRoom)
  const fromTopup = Math.max(0, Math.max(0, costUSD) - fromPlan)
  return { fromPlan, fromTopup }
}

export interface UsageStore {
  /** Current spend for the active period; resets the period if it has elapsed. */
  getUserUsage(userId: string, periodMs: number): Promise<number>
  /** Add metered cost to the user's running spend; returns the new total. */
  addUserUsage(userId: string, deltaUSD: number): Promise<number>
  /** Purchased top-up credit balance (rolls over; never resets with the period). */
  getUserCredit(userId: string): Promise<number>
  /** Add (or, with a negative delta, consume) top-up credit; floors at 0. */
  addUserCredit(userId: string, deltaUSD: number): Promise<number>
}

export async function usageStore(): Promise<UsageStore> {
  return (await getStore()) as unknown as UsageStore
}
