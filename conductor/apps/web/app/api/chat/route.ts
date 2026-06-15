import { routeTurn, complete, completeWithEscalation, makeLiveToolPlanner, getModel, judgeAnswer, topModelId, defaultJudgeModelId, estimateTurnCostUSD, costForModel, extractMemories, looksLikePreference } from '@conductor/coo-engine'
import { getStore } from '@conductor/agent-memory'
import {
  ToolRegistry,
  getExecutor,
  TOOLS,
  runAgenticTurn,
  makeSimulatedPlanner,
  registerMcpTools,
} from '@conductor/agent-tools'
import type { RouteDecision } from '@/lib/types'
import { currentUser } from '@/lib/server/session'
import { chargeSplit, planLimits, sanitizeOverrides, usageStore } from '@/lib/server/plans'
import { maybeAutoRecharge } from '@/lib/server/autorecharge'

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
  'analyze_data (datasets), calculator, and current_time. Additional tools from ' +
  'connected integrations (named like <service>__<tool>) may also be available — ' +
  'use them when relevant. Prefer a tool over guessing when a fact is current, ' +
  'computable, or verifiable. Be precise, helpful, and concise.\n\n' +
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

// Verify-and-escalate: judge a cheap model's answer and escalate to a premium
// model only when it misses the bar (off with CONDUCTOR_ESCALATE=off). The bar
// is a 0..1 quality score; tune with CONDUCTOR_QUALITY_BAR.
const ESCALATE_ENABLED = (process.env.CONDUCTOR_ESCALATE || 'on').toLowerCase() !== 'off'
const QUALITY_BAR = Math.min(1, Math.max(0, Number(process.env.CONDUCTOR_QUALITY_BAR) || 0.6))
// Auto-extract durable memories from preference-stating turns (off to disable).
const MEMORY_EXTRACT_ENABLED = (process.env.CONDUCTOR_MEMORY_EXTRACT || 'on').toLowerCase() !== 'off'
// Only verify/escalate models below this capability — re-checking an already
// top-tier model just burns money. Mirrors the default in coo-engine/escalate.js.
const ESCALATE_BELOW_CAPABILITY = 0.95

type Escalation = Record<string, unknown> | null

// Fill in human model labels so the client can render "tried <cheap> →
// escalated to <premium>" without shipping the catalog. Shared by both paths.
function enrichEscalation(esc: Escalation): Escalation {
  if (!esc) return esc
  const fm = esc.firstModel ? getModel(esc.firstModel as string) : null
  const tm = esc.finalModel ? getModel(esc.finalModel as string) : null
  if (fm) esc.firstLabel = fm.label
  if (tm) esc.finalLabel = tm.label
  return esc
}

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
): Promise<{ conversationId?: string; messageId?: string }> {
  try {
    const store = (await getStore()) as MemoryStore
    let id = conversationId
    if (!id) id = (await store.createConversation(userText.slice(0, 60))).id
    await store.addMessage(id, 'user', userText)
    const asst = (await store.addMessage(id, 'assistant', assistantText, meta)) as { id?: string }
    return { conversationId: id, messageId: asst?.id }
  } catch {
    return { conversationId }
  }
}

// One agentic run with `modelId`: live tool-calling if a key is set, else the
// simulated planner. Owns its own sandbox executor (a fresh microVM per run, so
// an escalated re-run starts clean) and disposes it afterwards.
async function runAgenticOnce(
  modelId: string,
  messages: EngineMessage[],
  onStep: (step: ToolStep) => void,
  maxTokens: number,
  system: string
): Promise<{ text: string; steps: ToolStep[]; simulated: boolean; simReason: string | null }> {
  const executor = getExecutor()
  const registry = new ToolRegistry({ executor })
  // Pull in any configured MCP servers' tools (no-op when CONDUCTOR_MCP is
  // unset). A server that fails to connect is skipped, never fatal.
  const mcp = await registerMcpTools(registry, process.env)
  if (mcp.errors.length) console.warn('[chat] MCP connect errors:', mcp.errors)
  // The planner must see every tool it can dispatch — built-ins + MCP — so the
  // model knows the remote tools exist (registry.run already routes them).
  const tools = registry.list()
  let simReason: string | null = null
  try {
    const livePlanner = makeLiveToolPlanner({ modelId, system, messages, tools, maxTokens })
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

// Agentic turn with verify-and-escalate: run the routed (cheap) model's tool
// loop, judge the final answer, and — if it misses the bar — re-run the whole
// loop with the strongest model. Returns the same `escalation` audit shape as
// the single-completion path, so the UI surface works for both, plus per-run
// step counts for cost accounting.
async function runAgentic(
  modelId: string,
  messages: EngineMessage[],
  onStep: (step: ToolStep) => void,
  maxTokens: number,
  userPrompt: string,
  escalateCfg: { enabled: boolean; qualityBar: number },
  system: string
): Promise<{
  text: string
  steps: ToolStep[]
  simulated: boolean
  simReason: string | null
  escalation: Escalation
  firstSteps: number
  secondSteps: number
}> {
  const first = await runAgenticOnce(modelId, messages, onStep, maxTokens, system)
  const routed = getModel(modelId)
  const base = { ...first, firstSteps: first.steps.length, secondSteps: 0 }

  // Only verify a real (non-simulated) answer from a non-top-tier model.
  const eligible =
    escalateCfg.enabled && !first.simulated && !!routed && routed.capability < ESCALATE_BELOW_CAPABILITY
  if (!eligible) {
    return { ...base, escalation: { evaluated: false, escalated: false } }
  }

  const { score } = await judgeAnswer({ prompt: userPrompt, answer: first.text, judgeModel: defaultJudgeModelId() })
  const target = topModelId(modelId)
  if (score == null || score >= escalateCfg.qualityBar || !target) {
    return {
      ...base,
      escalation: {
        evaluated: true,
        escalated: false,
        firstModel: modelId,
        score,
        qualityBar: escalateCfg.qualityBar,
        ...(target ? {} : { reason: 'no higher model' }),
      },
    }
  }

  // Escalate: re-run the loop with the strongest model.
  const second = await runAgenticOnce(target, messages, onStep, maxTokens, system)
  return {
    text: second.text,
    steps: [...first.steps, ...second.steps],
    simulated: second.simulated,
    simReason: second.simReason,
    firstSteps: first.steps.length,
    secondSteps: second.steps.length,
    escalation: {
      evaluated: true,
      escalated: true,
      firstModel: modelId,
      firstScore: score,
      qualityBar: escalateCfg.qualityBar,
      finalModel: target,
    },
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

  // Personalization: fold the user's durable memories into the system prompt so
  // every turn is informed by their saved preferences. Best-effort — never block
  // a turn on memory.
  let systemPrompt = SYSTEM
  try {
    const memStore = (await getStore()) as { listMemories?: (id: string) => Promise<Array<{ text: string }>> }
    const mems = (await memStore.listMemories?.(user.id)) ?? []
    if (mems.length) {
      const block = mems.slice(0, 50).map((m) => `- ${m.text}`).join('\n')
      systemPrompt =
        `${SYSTEM}\n\nWhat you know about this user (their saved preferences — ` +
        `honor them unless the current request overrides):\n${block}`
    }
  } catch {
    /* memory is best-effort */
  }

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
        let escalation: Record<string, unknown> | null = null
        // What this turn would have cost on the premium model minus what it
        // actually cost — the "you saved $X vs always-premium" receipt.
        let savedUSD = 0

        if (body.agentic) {
          const out = await runAgentic(
            decision.model.id,
            engineMessages,
            (step) => send('tool', { step }),
            MAX_OUTPUT_TOKENS,
            lastUser(messages),
            { enabled: ESCALATE_ENABLED, qualityBar: QUALITY_BAR },
            systemPrompt
          )
          fullText = out.text
          steps = out.steps
          simulated = out.simulated
          simReason = out.simReason
          // Cost: the cheap run over its steps, plus — if we escalated — the
          // premium run priced at the premium model's per-call estimate.
          let cost = decision.estCostUSD * (out.firstSteps + 1)
          if (out.escalation && out.escalation.escalated && out.escalation.finalModel) {
            const top = getModel(out.escalation.finalModel as string)
            const topEst = top ? estimateTurnCostUSD(top, lastUser(messages).length) : decision.estCostUSD
            cost += topEst * (out.secondSteps + 1)
          }
          costUSD = Number(cost.toFixed(6))
          escalation = enrichEscalation(out.escalation)
          if (escalation) send('escalation', { escalation })
          // Savings vs premium: same step count priced at the premium model.
          if (!simulated) {
            const premium = getModel(topModelId())
            const totalSteps = out.firstSteps + (out.escalation?.escalated ? out.secondSteps : 0)
            const premiumCost = premium ? estimateTurnCostUSD(premium, lastUser(messages).length) * (totalSteps + 1) : costUSD
            savedUSD = Math.max(0, Number((premiumCost - costUSD).toFixed(6)))
          }
        } else {
          const opts = { system: systemPrompt, messages: engineMessages, maxTokens: MAX_OUTPUT_TOKENS }
          const result = (await (ESCALATE_ENABLED
            ? completeWithEscalation(decision.model.id, opts, { qualityBar: QUALITY_BAR })
            : complete(decision.model.id, opts))) as {
            text: string
            costUSD: number
            simulated: boolean
            simReason?: string | null
            escalation?: Record<string, unknown>
            usage?: { input_tokens?: number; output_tokens?: number }
          }
          fullText = result.text
          simulated = result.simulated
          simReason = result.simReason ?? null
          costUSD = result.costUSD
          escalation = enrichEscalation(result.escalation ?? null)
          if (escalation) send('escalation', { escalation })
          // Savings vs premium: same token usage priced at the premium model.
          if (!simulated) {
            savedUSD = Math.max(0, Number((costForModel(topModelId(), result.usage ?? {}) - costUSD).toFixed(6)))
          }
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
        // Off-session auto-recharge when credit runs low (opt-in, default-off,
        // best-effort — never blocks the turn).
        try {
          await maybeAutoRecharge(user, newCredit)
        } catch {
          /* auto-recharge is best-effort */
        }
        // Accrue the lifetime "you saved $X vs premium" receipt (best-effort).
        let totalSavedUSD = user.savedUSD ?? 0
        if (savedUSD > 0) {
          try {
            totalSavedUSD = await meter.addUserSavings(user.id, savedUSD)
          } catch {
            /* savings is a best-effort stat — never block a turn */
          }
        }
        const persisted = await persist(body.conversationId, lastUser(messages), fullText, {
          model: decision.model.id,
          score: decision.score,
          domain: decision.classification?.domain,
          costUSD,
          simulated,
          agentic: !!body.agentic,
          // Routing-quality signal for the measured-advantage flywheel (Phase 1):
          // the judged quality and whether we had to escalate, per turn.
          escalation,
          savedUSD,
        })
        send('done', {
          costUSD,
          savedUSD,
          savedTotalUSD: Number(totalSavedUSD.toFixed(4)),
          simulated,
          simReason,
          escalation,
          spentUSD: Number(newSpent.toFixed(6)),
          topupUSD: Number(newCredit.toFixed(6)),
          conversationId: persisted.conversationId,
          // The stored assistant message id, so the client can attach feedback.
          messageId: persisted.messageId,
          stepCount: steps.length,
        })

        // Phase 4b: auto-extract durable memories from the user's message. Runs
        // AFTER 'done' (so the answer is already delivered) and best-effort — a
        // cheap, gated LLM call only on turns that look like a stated preference.
        if (MEMORY_EXTRACT_ENABLED && !simulated) {
          try {
            const userText = lastUser(messages)
            if (looksLikePreference(userText)) {
              const memStore = (await getStore()) as {
                listMemories?: (id: string) => Promise<Array<{ id: string; text: string; createdAt: number }>>
                addMemory?: (id: string, text: string) => Promise<{ id: string; text: string; createdAt: number }>
              }
              const existing = (await memStore.listMemories?.(user.id)) ?? []
              if (existing.length < 50) {
                const facts = await extractMemories({ text: userText, existing: existing.map((m) => m.text) })
                for (const f of facts.slice(0, 50 - existing.length)) {
                  const saved = await memStore.addMemory?.(user.id, f)
                  if (saved) send('memory', { memory: saved })
                }
              }
            }
          } catch {
            /* memory extraction is best-effort */
          }
        }
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
