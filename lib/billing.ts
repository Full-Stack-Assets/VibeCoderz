/**
 * Billing / credit configuration. Pure constants + math only — safe to import
 * from both client and server code (no server-only dependencies).
 *
 * See docs/CREDITS_PLAN.md for the full pricing model and margin math.
 */

// Free credits granted when an account is first created.
export const SIGNUP_CREDIT_GRANT = 50

// Retail value of one credit, in USD. Plan prices are derived from this.
export const CREDIT_RETAIL_USD = 0.05

// Target gross margin. Plan price = (credits * cost basis) / (1 - MARGIN).
export const TARGET_MARGIN = 0.15

// Cost-basis ceiling per credit: selling at retail above this yields >= margin.
export const CREDIT_COST_BASIS_USD = CREDIT_RETAIL_USD * (1 - TARGET_MARGIN) // $0.0425

// Flat overhead folded into every generation (sandbox runtime, infra, payment
// processing), amortized in USD.
const GENERATION_OVERHEAD_USD = 0.01

/**
 * Credits charged per AI generation, by model — an upfront *estimate* shown to
 * the user before a run. The ledger reconciles to actual measured usage after
 * the gateway responds (see `creditsForUsage`).
 */
export const MODEL_CREDIT_COST: Record<string, number> = {
  'anthropic/claude-opus-4.6': 5,
  'anthropic/claude-sonnet-4.6': 2,
  'openai/gpt-5.3-codex': 3,
  'xai/grok-4.1-fast-reasoning': 1,
}

export const DEFAULT_CREDIT_COST = 3

/** Per-token USD rates (provider list prices ÷ 1e6). Verify periodically. */
interface ModelRate {
  input: number
  output: number
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'anthropic/claude-opus-4.6': { input: 5e-6, output: 25e-6 },
  'anthropic/claude-sonnet-4.6': { input: 3e-6, output: 15e-6 },
  'openai/gpt-5.3-codex': { input: 3e-6, output: 12e-6 },
  'xai/grok-4.1-fast-reasoning': { input: 1e-6, output: 5e-6 },
}

const DEFAULT_RATE: ModelRate = { input: 5e-6, output: 25e-6 }

/** Convert a loaded USD cost into credits, guaranteeing >= target margin. */
export function costToCredits(loadedCostUsd: number): number {
  return Math.max(1, Math.ceil(loadedCostUsd / CREDIT_COST_BASIS_USD))
}

interface Usage {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
}

/**
 * Credits to deduct for a completed generation, based on actual token usage.
 * Cached input tokens are billed at ~0.1x the input rate.
 */
export function creditsForUsage(modelId: string, usage: Usage): number {
  const rate = MODEL_RATES[modelId] ?? DEFAULT_RATE
  const cachedInput = usage.cachedInputTokens ?? 0
  const freshInput = Math.max(0, (usage.inputTokens ?? 0) - cachedInput)
  const output = usage.outputTokens ?? 0

  const tokenCost =
    freshInput * rate.input +
    cachedInput * rate.input * 0.1 +
    output * rate.output

  return costToCredits(tokenCost + GENERATION_OVERHEAD_USD)
}

/**
 * Purchasable plans. Subscription price = included credits × retail, so a
 * fully-used plan lands on the 15% margin floor; breakage is upside.
 * Stripe price IDs are supplied via environment variables.
 */
export interface PlanConfig {
  id: string
  name: string
  credits: number
  priceUsd: number
  mode: 'subscription' | 'payment'
  priceEnv: string
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    credits: 200,
    priceUsd: 10,
    mode: 'subscription',
    priceEnv: 'STRIPE_PRICE_STARTER',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    credits: 600,
    priceUsd: 30,
    mode: 'subscription',
    priceEnv: 'STRIPE_PRICE_PRO',
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    credits: 2000,
    priceUsd: 100,
    mode: 'subscription',
    priceEnv: 'STRIPE_PRICE_SCALE',
  },
  topup: {
    id: 'topup',
    name: 'Credit top-up',
    credits: 200,
    priceUsd: 12,
    mode: 'payment',
    priceEnv: 'STRIPE_PRICE_TOPUP',
  },
}
