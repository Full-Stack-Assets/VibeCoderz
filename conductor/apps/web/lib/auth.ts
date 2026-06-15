'use client'

/**
 * Shared auth types + plan catalog for the web client.
 *
 * Authentication is real and server-side now: email + password with an
 * HTTP-only session cookie (see app/api/auth/* and lib/server/*). The client
 * never sees password hashes or session tokens — it talks to those routes and
 * reads the current account from /api/auth/me. Billing is real Stripe Checkout
 * (app/api/billing/*).
 */

export type PlanId = 'free' | 'pro' | 'max'

export interface Plan {
  id: PlanId
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  highlight?: boolean
  /** Annual pricing (≈2 months free). Absent for Free. */
  annual?: { price: string; perMonth: string }
}

export type BillingCycle = 'monthly' | 'annual'

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Cost-optimized routing on a daily budget.',
    features: ['Smart model routing', 'Generous daily free usage', 'Web & data tools', 'Image understanding'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: '/month',
    tagline: 'More headroom and premium models when they earn it.',
    features: [
      'Everything in Free',
      'High monthly usage limit',
      'Premium models (Opus, GPT-5.3)',
      'Pin any model · priority routing',
      'Unlimited conversations',
    ],
    highlight: true,
    annual: { price: '$200', perMonth: '$16.67' },
  },
  {
    id: 'max',
    name: 'Max',
    price: '$100',
    period: '/month',
    tagline: 'Highest usage limit and quality floor for heavy use.',
    features: ['Everything in Pro', 'Highest usage limit', 'Highest quality floor', 'Early access features'],
    annual: { price: '$1,000', perMonth: '$83.33' },
  },
]

export const planById = (id: PlanId | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0]

export interface User {
  id: string
  email: string
  name: string | null
  plan: PlanId
  role: 'user' | 'admin'
  subscriptionStatus: string | null
  /** Remaining pay-as-you-go top-up credit (USD). */
  topupUSD: number
  /** Lifetime routing savings vs. always-premium (USD) — the value receipt. */
  savedUSD: number
}

/**
 * Client-safe mirror of the server's plan limits (lib/server/plans.ts) — used
 * only to gate the UI. The server is always the source of truth; this just
 * avoids showing controls a plan can't use.
 */
export interface PlanCaps {
  allowPreferModel: boolean
  maxQualityFloor: number
  budgetLabel: string
}
export const PLAN_CAPS: Record<PlanId, PlanCaps> = {
  free: { allowPreferModel: false, maxQualityFloor: 0.85, budgetLabel: '$0.20 / day' },
  pro: { allowPreferModel: true, maxQualityFloor: 0.95, budgetLabel: '$10 / month' },
  max: { allowPreferModel: true, maxQualityFloor: 1, budgetLabel: '$50 / month' },
}
export const planCaps = (plan: PlanId | undefined): PlanCaps => PLAN_CAPS[plan ?? 'free'] ?? PLAN_CAPS.free

/**
 * Pay-as-you-go top-up ladder. When a user exhausts their plan budget, they can
 * buy more routing credit instead of waiting for the period to reset. `priceUSD`
 * is what they pay; `creditUSD` is the routing budget it grants (a 20% margin —
 * tune the ratio here, in one place). Credit rolls over and never expires. This
 * is client-safe metadata; the server (lib/server/stripe.ts) is authoritative on
 * price → credit so the amount can't be tampered with from the browser.
 */
export interface TopupPack {
  id: string
  priceUSD: number
  creditUSD: number
}
export const TOPUP_PACKS: TopupPack[] = [
  { id: 'topup_10', priceUSD: 10, creditUSD: 8 },
  { id: 'topup_25', priceUSD: 25, creditUSD: 20 },
  { id: 'topup_50', priceUSD: 50, creditUSD: 40 },
]
export const topupPack = (id: string | undefined): TopupPack | undefined =>
  TOPUP_PACKS.find((p) => p.id === id)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (e: string) => EMAIL_RE.test(e.trim())
