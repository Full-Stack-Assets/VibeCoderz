import { stripeConfigured, priceIdForPlan } from '@/lib/server/stripe'

export const runtime = 'nodejs'

// Lets the client decide whether to offer real checkout vs. a "coming soon"
// state, without exposing any secret.
export async function GET() {
  return Response.json({
    enabled: stripeConfigured(),
    plans: { pro: !!priceIdForPlan('pro'), max: !!priceIdForPlan('max') },
  })
}
