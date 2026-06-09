import { NextResponse } from 'next/server'
import { routeTurn, complete, makeLiveToolPlanner } from '@conductor/coo-engine'
import { getStore } from '@conductor/agent-memory'
import {
  ToolRegistry,
  getExecutor,
  TOOLS,
  runAgenticTurn,
  makeSimulatedPlanner,
} from '@conductor/agent-tools'
import type { RouteDecision } from '@/lib/types'

interface CompletionResult {
  text: string
  costUSD: number
  simulated: boolean
}

interface ToolStep {
  tool: string
  args: Record<string, unknown>
  result: { ok: boolean; output?: string; error?: string }
}

// Bridges the JS planner factories (whose literal `type` widens to string) to
// the agentic loop's expected action union.
type Planner = (steps: ToolStep[]) => Promise<{
  type: 'tool' | 'final'
  tool?: string
  args?: Record<string, unknown>
  text?: string
}>

interface MemoryStore {
  createConversation: (title?: string) => Promise<{ id: string }>
  addMessage: (id: string, role: string, content: string, meta?: unknown) => Promise<unknown>
}

// Best-effort conversation persistence. Uses Postgres when DATABASE_URL is set,
// otherwise the in-process store. Never blocks or fails a chat turn.
async function persist(
  conversationId: string | undefined,
  userText: string,
  assistantText: string,
  meta: unknown
): Promise<string | undefined> {
  try {
    const store = (await getStore()) as MemoryStore
    let id = conversationId
    if (!id) id = (await store.createConversation(userText.slice(0, 60))).id
    await store.addMessage(id, 'user', userText)
    await store.addMessage(id, 'assistant', assistantText, meta)
    return id
  } catch {
    return conversationId
  }
}

export const runtime = 'nodejs'

const SYSTEM =
  'You are Conductor, an agentic coding assistant. You were routed to this turn ' +
  'by a constraint-optimized orchestrator that picked the most cost-effective ' +
  'model capable of handling the request. Be precise, helpful, and concise.'

interface Body {
  messages: { role: 'user' | 'assistant'; content: string }[]
  spentUSD?: number
  preferModel?: string
  qualityFloor?: number
  conversationId?: string
  agentic?: boolean
}

// Agentic turn: the COO-routed model autonomously drives the sandbox tools.
// Live tool-calling when the provider has a key (Anthropic), else a deterministic
// simulated planner. Always degrades to simulation on any live-path error.
async function runAgentic(
  modelId: string,
  messages: { role: string; content: string }[]
): Promise<{ text: string; steps: ToolStep[]; simulated: boolean }> {
  const registry = new ToolRegistry({ executor: getExecutor() })
  // Live tool-calling when the routed model's provider has a key (Anthropic
  // native, OpenAI/xAI tool_calls). Null → no key → simulated planner.
  const livePlanner = makeLiveToolPlanner({ modelId, system: SYSTEM, messages, tools: TOOLS })
  if (livePlanner) {
    try {
      const out = (await runAgenticTurn({ planner: livePlanner as unknown as Planner, registry })) as {
        text: string
        steps: ToolStep[]
      }
      return { ...out, simulated: false }
    } catch {
      // fall through to the simulated planner on any live-path error
    }
  }
  const planner = makeSimulatedPlanner(messages) as unknown as Planner
  const out = (await runAgenticTurn({ planner, registry })) as { text: string; steps: ToolStep[] }
  return { ...out, simulated: true }
}

const lastUser = (messages: { role: string; content: string }[]) =>
  [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return NextResponse.json({ error: 'no messages' }, { status: 400 })
  }

  const budgetUSD = Number(process.env.CONDUCTOR_BUDGET_USD || '1.0')
  const spentUSD = Number(body.spentUSD || 0)

  // 1) COO engine routes the turn → which model, and why (full audit trail).
  const decision = routeTurn({
    messages,
    budgetUSD,
    spentUSD,
    preferModel: body.preferModel,
    qualityFloor: body.qualityFloor,
  }) as RouteDecision

  // 2) Budget exhausted with no override → refuse honestly rather than overspend.
  if (!decision.ok || !decision.model) {
    return NextResponse.json({
      text:
        `**Budget guardrail engaged.** The orchestrator declined to route this turn — ` +
        `${decision.reason}. This is the COO engine's budget discipline: it never breaches ` +
        `the session cap. Raise \`CONDUCTOR_BUDGET_USD\` or start a new session to continue.`,
      decision,
      costUSD: 0,
      simulated: true,
      spentUSD,
    })
  }

  // 3a) Agentic turn → the model drives sandbox tools through the COO router.
  if (body.agentic) {
    let agent: { text: string; steps: ToolStep[]; simulated: boolean }
    try {
      agent = await runAgentic(decision.model.id, messages)
    } catch (err) {
      return NextResponse.json(
        { error: `agentic turn failed: ${(err as Error).message}`, decision },
        { status: 502 }
      )
    }
    // Approximate cost: one model call per tool step plus the final answer.
    const costUSD = Number((decision.estCostUSD * (agent.steps.length + 1)).toFixed(6))
    const conversationId = await persist(
      body.conversationId,
      lastUser(messages),
      agent.text,
      { model: decision.model.id, agentic: true, steps: agent.steps.length, simulated: agent.simulated }
    )
    return NextResponse.json({
      text: agent.text,
      steps: agent.steps,
      decision,
      costUSD,
      simulated: agent.simulated,
      spentUSD: Number((spentUSD + costUSD).toFixed(6)),
      conversationId,
    })
  }

  // 3b) Standard turn → a single completion on the chosen model.
  let result: CompletionResult
  try {
    result = (await complete(decision.model.id, {
      system: SYSTEM,
      messages,
      maxTokens: 1024,
    })) as CompletionResult
  } catch (err) {
    return NextResponse.json(
      { error: `model call failed: ${(err as Error).message}`, decision },
      { status: 502 }
    )
  }

  // 4) Persist the turn (durable Postgres when configured, else in-process).
  const conversationId = await persist(
    body.conversationId,
    lastUser(messages),
    result.text,
    { model: decision.model.id, score: decision.score, costUSD: result.costUSD, simulated: result.simulated }
  )

  return NextResponse.json({
    text: result.text,
    decision,
    costUSD: result.costUSD,
    simulated: result.simulated,
    spentUSD: Number((spentUSD + result.costUSD).toFixed(6)),
    conversationId,
  })
}
