import { MODEL_CATALOG } from '@conductor/coo-engine'

export const runtime = 'nodejs'

interface CatalogModel {
  id: string
  label: string
  provider: string
  type: string
  capability: number
  multimodal: boolean
  pricing: { input: number; output: number }
  blurb: string
}

// Expose the routing catalog to the client so the model picker stays in sync
// with the engine — a single source of truth for ids, labels, and pricing.
export async function GET() {
  const models = (MODEL_CATALOG as CatalogModel[]).map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    type: m.type,
    capability: m.capability,
    multimodal: m.multimodal,
    pricing: m.pricing,
    blurb: m.blurb,
  }))
  return Response.json(
    { models },
    { headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' } }
  )
}
