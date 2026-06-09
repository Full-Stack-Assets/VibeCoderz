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

export interface ToolStep {
  tool: string
  args: Record<string, unknown>
  result: { ok: boolean; output?: string; error?: string }
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
