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
  'helpful, and concise.'

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
  onStep: (step: ToolStep) => void
): Promise<{ text: string; steps: ToolStep[]; simulated: boolean }> {
  const registry = new ToolRegistry({ executor: getExecutor() })
  const livePlanner = makeLiveToolPlanner({ modelId, system: SYSTEM, messages, tools: TOOLS })
  if (livePlanner) {
    try {
      const out = (await runAgenticTurn({ planner: livePlanner as unknown as Planner, registry, onStep })) as {
        text: string
        steps: ToolStep[]
      }
      return { ...out, simulated: false }
    } catch {
      // fall through to simulation on any live-path error
    }
  }
  const planner = makeSimulatedPlanner(messages) as unknown as Planner
  const out = (await runAgenticTurn({ planner, registry, onStep })) as { text: string; steps: ToolStep[] }
  return { ...out, simulated: true }
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

  const engineMessages = buildEngineMessages(messages)
  const hasImages = hasImageAttachment(messages)

  const budgetUSD = Number(process.env.CONDUCTOR_BUDGET_USD || '1.0')
  const spentUSD = Number(body.spentUSD || 0)
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
          preferModel: body.preferModel,
          qualityFloor: body.qualityFloor,
          hasImages,
        }) as RouteDecision
        send('decision', { decision })

        // 2) Budget guardrail.
        if (!decision.ok || !decision.model) {
          const msg =
            `**Budget guardrail engaged.** The orchestrator declined to route this turn — ` +
            `${decision.reason}. The COO engine never breaches the session cap. Raise ` +
            `\`CONDUCTOR_BUDGET_USD\` or start a new session to continue.`
          for (const c of chunkText(msg)) {
            send('text', { delta: c })
            await sleep(8)
          }
          send('done', { costUSD: 0, simulated: true, spentUSD, conversationId: body.conversationId })
          controller.close()
          return
        }

        // 3) Generate — agentic (tools, streamed steps) or a single completion.
        let fullText = ''
        let steps: ToolStep[] = []
        let simulated = false
        let costUSD = 0

        if (body.agentic) {
          const out = await runAgentic(decision.model.id, engineMessages, (step) => send('tool', { step }))
          fullText = out.text
          steps = out.steps
          simulated = out.simulated
          costUSD = Number((decision.estCostUSD * (steps.length + 1)).toFixed(6))
        } else {
          const result = (await complete(decision.model.id, { system: SYSTEM, messages: engineMessages, maxTokens: 1024 })) as {
            text: string
            costUSD: number
            simulated: boolean
          }
          fullText = result.text
          simulated = result.simulated
          costUSD = result.costUSD
        }

        // 4) Stream the answer progressively.
        for (const c of chunkText(fullText)) {
          send('text', { delta: c })
          await sleep(simulated ? 14 : 6)
        }

        // 5) Persist + close.
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
          spentUSD: Number((spentUSD + costUSD).toFixed(6)),
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
