import Stripe from 'stripe'

let stripe: Stripe | null = null

/**
 * Lazily constructs the Stripe client. Throws a clear error if the secret key
 * isn't configured, so billing routes degrade gracefully (the rest of the app
 * keeps working) until Stripe is set up.
 */
export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('Billing is not configured (missing STRIPE_SECRET_KEY)')
    }
    stripe = new Stripe(key)
  }
  return stripe
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  )
}
