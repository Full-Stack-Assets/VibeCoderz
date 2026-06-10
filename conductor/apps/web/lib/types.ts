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
  classification: { type: string; domain?: string; complexity: number; minQuality: number; requiresVision?: boolean }
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
    /** web_search: structured, rankable results for citation cards. */
    results?: Citation[]
    /** analyze_data: dataset shape + per-column numeric statistics. */
    rows?: number
    columns?: string[]
    stats?: Record<string, ColumnStats>
  }
}

export interface ChatResponse {
  text: string
  decision: RouteDecision
  costUSD: number
  simulated: boolean
  spentUSD: number
  steps?: ToolStep[]
}

/** A user-attached file: an image (sent to vision models) or a text/data file. */
export interface Attachment {
  id: string
  kind: 'image' | 'text'
  name: string
  mediaType: string
  /** data: URL for images (base64). */
  dataUrl?: string
  /** Decoded text for text/data files (csv, json, txt, md). */
  text?: string
  size: number
}

export interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  decision?: RouteDecision
  simulated?: boolean
  costUSD?: number
  pending?: boolean
  steps?: ToolStep[]
}
