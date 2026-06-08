/**
 * Billing / credit configuration. Pure constants only — safe to import from
 * both client and server code (no server-only dependencies).
 *
 * See docs/CREDITS_PLAN.md for the full pricing model and margin math.
 */

// Free credits granted when an account is first created.
export const SIGNUP_CREDIT_GRANT = 50

// Retail value of one credit, in USD. Plan prices are derived from this.
export const CREDIT_RETAIL_USD = 0.05

// Target gross margin. Plan price = (credits * cost basis) / (1 - MARGIN).
export const TARGET_MARGIN = 0.15

/**
 * Credits charged per AI generation, by model. Higher-cost models cost more
 * credits so that one credit maps to a roughly fixed retail value regardless
 * of which model the user picks.
 */
export const MODEL_CREDIT_COST: Record<string, number> = {
  'anthropic/claude-opus-4.6': 5,
  'anthropic/claude-sonnet-4.6': 2,
  'openai/gpt-5.3-codex': 3,
  'xai/grok-4.1-fast-reasoning': 1,
}

export const DEFAULT_CREDIT_COST = 3
