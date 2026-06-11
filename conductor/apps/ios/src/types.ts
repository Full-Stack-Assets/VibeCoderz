/**
 * Wire types shared with the Conductor backend (`/api/chat`).
 * Mirrors conductor/apps/web/lib/types.ts so the mobile client speaks the
 * exact same protocol as the web shell.
 */

export type Dim = 'type' | 'cost' | 'latency' | 'load' | 'budget'

export interface RouteModel {
  id: string
  label: string
  provider: string
  type: string
  blurb?: string
  capability: number
}

export interface RouteDecision {
  ok: boolean
  model: RouteModel | null
  score: number
  dims: Record<Dim, number> | null
  weights: Record<Dim, number> | null
  fallback: boolean
  overridden: boolean
  optimizerChoice: string | null
  candidates: { id: string; label: string; score: number; typeMatch: boolean }[]
  classification: {
    type: string
    domain?: string
    complexity: number
    minQuality: number
    requiresVision?: boolean
  }
  estCostUSD: number
  budget: { budgetUSD: number; spentUSD: number; utilization: number; throttled: boolean }
  reason: string
}

export interface Citation {
  title: string
  url: string
  snippet?: string
}

export interface ColumnStats {
  count: number
  min: number
  max: number
  mean: number
  median: number
}

export interface ToolStep {
  tool: string
  args: Record<string, unknown>
  result: {
    ok: boolean
    output?: string
    error?: string
    results?: Citation[]
    rows?: number
    columns?: string[]
    stats?: Record<string, ColumnStats>
  }
}

/** Server's terminal `done` event payload. */
export interface DoneInfo {
  costUSD?: number
  simulated?: boolean
  spentUSD?: number
  conversationId?: string
  stepCount?: number
}

/** A chat message as held in the UI. */
export interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  decision?: RouteDecision
  simulated?: boolean
  costUSD?: number
  pending?: boolean
  steps?: ToolStep[]
  error?: boolean
}
