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
import { currentUser } from '@/lib/server/session'
import { chargeSplit, planLimits, sanitizeOverrides, usageStore } from '@/lib/server/plans'

export const runtime = 'nodejs'

interface ToolStep {
  tool: string
  args: Record<string, unknown>
  result: { ok: boolean; output?: string; error?: string }
}

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

const SYSTEM =
  'You are Conductor, a general-purpose agentic assistant — not just a coding tool. ' +
  'You help with software, web research, data and document analysis, writing, ' +
  'planning, and reasoning over images. You were routed to this turn by a ' +
  'constraint-optimized orchestrator that picked the most cost-effective model ' +
  'capable of the request. You can use tools: run_command/write_file/read_file/' +
  'list_files (sandbox), web_search/fetch_url (live research — cite sources), ' +
  'analyze_data (datasets), calculator, and current_time. Prefer a tool over ' +
  'guessing when a fact is current, computable, or verifiable. Be precise, ' +
  'helpful, and concise.\n\n' +
  'Use tools efficiently — every tool call spends a step and real money:\n' +
  '- Decide the full set of files up front, then write each file exactly ONCE ' +
  'with its complete, final contents. Never rewrite a file you just wrote.\n' +
  '- After writing, run or test the code before making any further edits. Let ' +
  'real command output — not second-guessing — drive changes.\n' +
  '- If a command surfaces an error, make a targeted fix to the SPECIFIC file at ' +
  'fault; do not regenerate files that are already correct, and never repeat an ' +
  'identical write.\n' +
  '- Stop and give a final answer as soon as the task is verified working.'

interface Attachment {
  kind: 'image' | 'text'
  name: string
  mediaType: string
  dataUrl?: string
  text?: string
}

interface InMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
}

interface Body {
  messages: InMessage[]
  spentUSD?: number
  preferModel?: string
  qualityFloor?: number
  conversationId?: string
  agentic?: boolean
}

// A multimodal content block understood by the engine's provider converters.
type Block = { type: 'text'; text: string } | { type: 'image'; dataUrl: string }
interface EngineMessage {
  role: 'user' | 'assistant'
  content: string | Block[]
}

const MAX_TEXT_ATTACH = 20_000

// Max tool steps an agentic turn may take before it must answer. The loop's
// own default is a conservative 6, which a real coding task (sandbox → write →
// install → run → fix) outgrows quickly, leaving the turn cut off mid-task.
// Override with CONDUCTOR_MAX_STEPS; cost is still metered per step.
const MAX_AGENTIC_STEPS = Math.max(1, Number(process.env.CONDUCTOR_MAX_STEPS) || 12)

// Max output tokens per model call. The library default of 1024 truncates real
// answers (and large tool-call args) mid-output. Override with
// CONDUCTOR_MAX_TOKENS. This is a ceiling, not a target — cost scales with the
// tokens actually produced, so raising it only prevents truncation.
const MAX_OUTPUT_TOKENS = Math.max(256, Number(process.env.CONDUCTOR_MAX_TOKENS) || 4096)

// Build engine messages: fold text-file attachments into the text, and attach
// images as image blocks so vision-capable models receive them.
function buildEngineMessages(messages: InMessage[]): EngineMessage[] {
  return messages.map((m) => {
    const atts = m.attachments ?? []
    const images = atts.filter((a) => a.kind === 'image' && a.dataUrl)
    const files = atts.filter((a) => a.kind === 'text' && a.text)
    let text = m.content ?? ''
    for (const f of files) {
      text += `\n\n[Attached file: ${f.name}]\n${String(f.text).slice(0, MAX_TEXT_ATTACH)}`
    }
    if (images.length === 0) return { role: m.role, content: text }
    const blocks: Block[] = [{ type: 'text', text }]
    for (const img of images) blocks.push({ type: 'image', dataUrl: img.dataUrl as string })
    return { role: m.role, content: blocks }
  })
}

const hasImageAttachment = (messages: InMessage[]) =>
  messages.some((m) => (m.attachments ?? []).some((a) => a.kind === 'image' && a.dataUrl))

const lastUser = (messages: { role: string; content: string }[]) =>
  [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Split text into small chunks for progressive rendering (keeps whitespace).
function chunkText(text: string, size = 4): string[] {
  const tokens = text.split(/(\s+)/) // keep the separators
  const out: string[] = []
  for (let i = 0; i < tokens.length; i += size * 2) {
    out.push(tokens.slice(i, i + size * 2).join(''))
  }
  return out.filter(Boolean)
}

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

async function runAgentic(
  modelId: string,
  messages: EngineMessage[],
  onStep: (step: ToolStep) => void,
  maxTokens: number
): Promise<{ text: string; steps: ToolStep[]; simulated: boolean; simReason: string | null }> {
  const executor = getExecutor()
  const registry = new ToolRegistry({ executor })
  let simReason: string | null = null
  try {
    const livePlanner = makeLiveToolPlanner({ modelId, system: SYSTEM, messages, tools: TOOLS, maxTokens })
    if (livePlanner) {
      try {
        const out = (await runAgenticTurn({ planner: livePlanner as unknown as Planner, registry, onStep, maxSteps: MAX_AGENTIC_STEPS })) as {
          text: string
          steps: ToolStep[]
        }
        return { ...out, simulated: false, simReason: null }
      } catch (err) {
        // Don't let a live-path failure silently look like simulation — capture
        // why so "key set but still simulating" is diagnosable downstream.
        simReason = `live tool-calling failed: ${(err as Error)?.message ?? String(err)}`
        console.warn(`[chat] ${simReason}; falling back to simulated planner.`)
      }
    } else {
      simReason = 'no provider credential for live tool-calling (set AI_GATEWAY_API_KEY / OPENROUTER_API_KEY / a native key)'
    }
    const planner = makeSimulatedPlanner(messages) as unknown as Planner
    const out = (await runAgenticTurn({ planner, registry, onStep, maxSteps: MAX_AGENTIC_STEPS })) as { text: string; steps: ToolStep[] }
    return { ...out, simulated: true, simReason }
  } finally {
    // Stop the sandbox microVM (if the executor created one) after the turn.
    await (executor as { dispose?: () => Promise<void> }).dispose?.()
  }
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) return new Response('no messages', { status: 400 })

  // Server-authoritative plan enforcement. The client cannot pick its own
  // budget (we track spend per account in the DB, not from the request) and
  // cannot pin premium models or quality floors beyond what its plan allows.
  const user = await currentUser(req)
  if (!user) return new Response('Please sign in to chat.', { status: 401 })
  const lim = planLimits(user.plan)
  const periodMs = lim.periodDays * 24 * 60 * 60 * 1000
  const meter = await usageStore()
  const spentUSD = await meter.getUserUsage(user.id, periodMs)
  // Effective budget = plan allowance + any purchased top-up credit. Plan
  // allowance resets each period; top-up credit rolls over and is consumed only
  // once the plan allowance is used up (see the split metering in step 5).
  const planBudgetUSD = lim.budgetUSD
  const topupUSD = await meter.getUserCredit(user.id)
  const budgetUSD = planBudgetUSD + topupUSD
  const { preferModel, qualityFloor } = sanitizeOverrides(user.plan, body.preferModel, body.qualityFloor)

  const engineMessages = buildEngineMessages(messages)
  const hasImages = hasImageAttachment(messages)
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))

      try {
        // 1) Route the turn and surface the decision immediately.
        const decision = routeTurn({
          messages: engineMessages,
          budgetUSD,
          spentUSD,
          preferModel,
          qualityFloor,
          hasImages,
        }) as RouteDecision
        send('decision', { decision })

        // 2) Budget guardrail.
        if (!decision.ok || !decision.model) {
          const window = lim.periodDays === 1 ? 'today' : 'this month'
          const resetWord = lim.periodDays === 1 ? 'daily' : 'monthly'
          const msg =
            `**You've reached your ${user.plan} plan's budget** ($${planBudgetUSD.toFixed(2)} ${window}). ` +
            `The orchestrator won't spend past your cap. It resets ${resetWord} — or **add credits** below to ` +
            `keep going right now${user.plan === 'max' ? '.' : ', or upgrade for a higher monthly allowance and premium models.'}`
          for (const c of chunkText(msg)) {
            send('text', { delta: c })
            await sleep(8)
          }
          // capReached tells the client to surface the top-up ladder.
          send('done', { costUSD: 0, simulated: true, spentUSD, topupUSD, capReached: true, conversationId: body.conversationId })
          controller.close()
          return
        }

        // 3) Generate — agentic (tools, streamed steps) or a single completion.
        let fullText = ''
        let steps: ToolStep[] = []
        let simulated = false
        let costUSD = 0
        let simReason: string | null = null

        if (body.agentic) {
          const out = await runAgentic(decision.model.id, engineMessages, (step) => send('tool', { step }), MAX_OUTPUT_TOKENS)
          fullText = out.text
          steps = out.steps
          simulated = out.simulated
          simReason = out.simReason
          costUSD = Number((decision.estCostUSD * (steps.length + 1)).toFixed(6))
        } else {
          const result = (await complete(decision.model.id, { system: SYSTEM, messages: engineMessages, maxTokens: MAX_OUTPUT_TOKENS })) as {
            text: string
            costUSD: number
            simulated: boolean
            simReason?: string | null
          }
          fullText = result.text
          simulated = result.simulated
          simReason = result.simReason ?? null
          costUSD = result.costUSD
        }

        // Surface why a turn simulated despite a configured key — the cause
        // (e.g. a gateway model-slug 404) is otherwise invisible to the client.
        if (simulated && simReason) {
          console.warn(`[chat] simulated turn for ${decision.model.id}: ${simReason}`)
        }

        // 4) Stream the answer progressively.
        for (const c of chunkText(fullText)) {
          send('text', { delta: c })
          await sleep(simulated ? 14 : 6)
        }

        // 5) Meter the spend: charge the plan allowance first, then draw any
        // overflow from rolled-over top-up credit so spent never exceeds the
        // plan cap and purchased credit is consumed only once it's needed.
        const { fromPlan, fromTopup } = chargeSplit(planBudgetUSD, spentUSD, costUSD)
        const newSpent = await meter.addUserUsage(user.id, fromPlan)
        const newCredit = fromTopup > 0 ? await meter.addUserCredit(user.id, -fromTopup) : topupUSD
        const conversationId = await persist(body.conversationId, lastUser(messages), fullText, {
          model: decision.model.id,
          score: decision.score,
          domain: decision.classification?.domain,
          costUSD,
          simulated,
          agentic: !!body.agentic,
        })
        send('done', {
          costUSD,
          simulated,
          simReason,
          spentUSD: Number(newSpent.toFixed(6)),
          topupUSD: Number(newCredit.toFixed(6)),
          conversationId,
          stepCount: steps.length,
        })
        controller.close()
      } catch (err) {
        send('error', { error: (err as Error).message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
