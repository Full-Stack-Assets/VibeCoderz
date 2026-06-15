import { routeTurn, complete, completeWithEscalation } from '@conductor/coo-engine'
import { userFromApiKey } from '@/lib/server/apikey'
import { planLimits, usageStore, chargeSplit, sanitizeOverrides } from '@/lib/server/plans'
import type { RouteDecision } from '@/lib/types'

export const runtime = 'nodejs'

const SYSTEM =
  'You are Conductor, a general-purpose assistant routed by a constraint-optimized ' +
  'orchestrator to the most cost-effective model capable of the request. Be precise, ' +
  'helpful, and concise.'

interface InMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}
interface Body {
  messages?: InMessage[]
  preferModel?: string
  qualityFloor?: number
  escalate?: boolean
}

const err = (error: string, status: number) => Response.json({ error }, { status })

/**
 * Public chat API. Auth via `Authorization: Bearer sk_cond_…` (or `X-API-Key`).
 * Routes the turn with the shipping COO router, completes (verify-and-escalate
 * by default), meters against the key owner's plan budget, and returns JSON.
 */
export async function POST(req: Request) {
  const user = await userFromApiKey(req)
  if (!user) return err('invalid or missing API key', 401)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return err('invalid JSON', 400)
  }
  const messages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string' && m.content.trim())
  if (!messages.length) return err('messages: a non-empty array of { role, content } is required', 400)

  // Same server-authoritative budget enforcement as the web chat.
  const lim = planLimits(user.plan)
  const periodMs = lim.periodDays * 24 * 60 * 60 * 1000
  const meter = await usageStore()
  const spentUSD = await meter.getUserUsage(user.id, periodMs)
  const topupUSD = await meter.getUserCredit(user.id)
  const budgetUSD = lim.budgetUSD + topupUSD
  const { preferModel, qualityFloor } = sanitizeOverrides(user.plan, body.preferModel, body.qualityFloor)

  // The system role is folded into SYSTEM; only user/assistant turns are routed.
  const engineMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content }))

  const decision = routeTurn({ messages: engineMessages, budgetUSD, spentUSD, preferModel, qualityFloor }) as RouteDecision
  if (!decision.ok || !decision.model) {
    return Response.json(
      { error: 'plan budget exhausted', budget: { budgetUSD: lim.budgetUSD, spentUSD: Number(spentUSD.toFixed(6)) } },
      { status: 402 }
    )
  }

  const opts = { system: SYSTEM, messages: engineMessages, maxTokens: 4096 }
  const result = (await (body.escalate === false
    ? complete(decision.model.id, opts)
    : completeWithEscalation(decision.model.id, opts, { qualityBar: 0.6 }))) as {
    text: string
    costUSD: number
    simulated: boolean
    escalation?: Record<string, unknown>
  }

  // Meter: plan allowance first, then rolled-over top-up credit.
  const { fromPlan, fromTopup } = chargeSplit(lim.budgetUSD, spentUSD, result.costUSD || 0)
  await meter.addUserUsage(user.id, fromPlan)
  if (fromTopup > 0) await meter.addUserCredit(user.id, -fromTopup)

  return Response.json({
    text: result.text,
    model: { id: decision.model.id, label: decision.model.label },
    routing: {
      score: decision.score,
      domain: decision.classification?.domain ?? null,
      sensitive: decision.classification?.sensitive ?? null,
      reason: decision.reason,
    },
    escalation: result.escalation ?? null,
    costUSD: Number((result.costUSD || 0).toFixed(6)),
    simulated: !!result.simulated,
  })
}
