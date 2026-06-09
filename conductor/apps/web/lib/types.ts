export interface RouteDecision {
  ok: boolean
  model: {
    id: string
    label: string
    provider: string
    type: string
    blurb?: string
    capability: number
  } | null
  score: number
  dims: Record<'type' | 'cost' | 'latency' | 'load' | 'budget', number> | null
  weights: Record<'type' | 'cost' | 'latency' | 'load' | 'budget', number> | null
  fallback: boolean
  overridden: boolean
  optimizerChoice: string | null
  candidates: { id: string; label: string; score: number; typeMatch: boolean }[]
  classification: { type: string; complexity: number; minQuality: number }
  estCostUSD: number
  budget: { budgetUSD: number; spentUSD: number; utilization: number; throttled: boolean }
  reason: string
}

export interface ChatResponse {
  text: string
  decision: RouteDecision
  costUSD: number
  simulated: boolean
  spentUSD: number
}

export interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  decision?: RouteDecision
  simulated?: boolean
  costUSD?: number
  pending?: boolean
}
