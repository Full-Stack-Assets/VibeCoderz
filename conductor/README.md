# Conductor

**A constraint-optimized general agentic assistant.** Conductor fuses three
projects into one product: it routes every chat turn to the *cheapest model that
is still good enough* using a patented-style Constraint-Optimized Orchestration
(COO) engine, runs it through a memory-backed agent runtime, and presents it all
in a web app whose look mirrors the **Claude iOS app** — warm ivory, coral
accent, serif display type, soft paper texture.

> Most agentic platforms pin one model or switch models by hand. Conductor's
> differentiator is that **model selection is an optimization problem solved per
> turn** — budget-aware, fitness-scored across five constraint dimensions, and
> **fully auditable**. You can see exactly which model was chosen and why.

## Capabilities

Conductor is a general agent, not just a coding tool. Each turn is classified
into a **domain** and routed to the best-fit model, and the agent can reach for
the matching tools:

| Domain | What it does | Tools |
| --- | --- | --- |
| **Coding** | Write/run/inspect code in a sandbox | `run_command`, `write_file`, `read_file`, `list_files` |
| **Research** | Search the live web and read pages, with sources | `web_search`, `fetch_url` |
| **Data** | Parse CSV/TSV/JSON and compute statistics | `analyze_data` |
| **Vision** | Reason over attached images & screenshots | (routed to a multimodal model) |
| **Everyday** | Quick math, current date/time | `calculator`, `current_time` |
| **Writing / Reasoning** | Drafting, explanation, planning, architecture | (direct completion) |

## What was combined

| Source repo | Role in Conductor | Lives in |
| --- | --- | --- |
| **COO-Engine-Implementation** | The orchestration brain — fitness scoring, fallback routing, adaptive weighting, budget/fitness admission gates, multi-provider LLM client | `packages/coo-engine` |
| **Claude (Code Assistant)** | The agent runtime — conversation memory (in-memory **or Postgres/Prisma**) + context-window replay, and the MCP tool-registry seam | `packages/agent-memory`, `packages/agent-tools` |
| **vibe-coding-platform2** | The product shell — Next.js app, multi-model catalog, chat UX, **sandboxed tool execution** | `apps/web`, `packages/agent-tools` |

## Architecture

```
            ┌──────────────────────────────────────────────┐
  user turn │  apps/web  (Next.js · Claude-iOS UI)          │
 ──────────▶│  components/Chat → POST /api/chat             │
            └───────────────┬──────────────────────────────┘
                            │
                 ┌──────────▼───────────┐   classifyTurn → COO task
                 │ @conductor/coo-engine │   routeTurn → fitness scoring
                 │  routeTurn()          │   admission gates (fitness / 85% budget)
                 └──────────┬───────────┘   → chosen model + audit trail
                            │
                 ┌──────────▼───────────┐   live provider call (Anthropic /
                 │ complete(modelId)     │   OpenAI / xAI) or deterministic
                 │  multi-provider + sim │   simulation when no key is set
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │ @conductor/agent-memory│  conversation + context window
                 └───────────────────────┘
```

The COO engine's math is reused **verbatim** where it matters: the same
`calculateFitnessScore` and `findBestAgentForTask` that schedule agents now
schedule model calls — the candidate "agents" are models, the "task" is a turn.
The only domain recalibration is the fitness admission threshold (0.55 → 0.50),
documented in `packages/coo-engine/src/core.js`.

### Agent runtime: memory + sandboxed tools

- **Memory** (`packages/agent-memory`) — every chat turn is persisted. Default
  is a zero-config in-process store; set `DATABASE_URL` and the same interface
  is served by a Postgres/Prisma backend (`PrismaStore`), selected at runtime by
  the store factory. The chat route returns a `conversationId` and replays a
  capped context window.
- **Tools** (`packages/agent-tools`) — the COO-routed model can drive a toolset
  spanning four groups: **sandbox** (`run_command`, `write_file`, `read_file`,
  `list_files`), **web** (`web_search`, `fetch_url`), **data** (`analyze_data`),
  and **utility** (`calculator`, `current_time`) — all through a pluggable
  **Executor**. Pure-compute tools (calculator, current_time, analyze_data) run
  for real everywhere. Sandbox tools are simulated by default;
  `CONDUCTOR_SANDBOX=local` switches to a real sandbox (isolated temp dir,
  path-traversal guards, a command allowlist). Web tools are simulated by default
  and go live with `CONDUCTOR_WEB=live` (using `TAVILY_API_KEY` when set, else a
  keyless DuckDuckGo fallback; `fetch_url` strips HTML to text and refuses
  private/loopback hosts). The `Executor` interface matches what a Vercel Sandbox
  / remote backend would implement, and a `ToolRegistry` lets MCP servers
  contribute tools behind the same dispatch surface. Try it live in the
  **Sandbox** card in the orchestration panel, or via `POST /api/tools/execute`.
- **Multimodal** — attach images (📎 in the composer) and the turn is gated to a
  **multimodal** model; images flow through to Anthropic / gateway / OpenAI vision
  formats, or are described in simulation. Text/data files (CSV, JSON, MD, …) are
  folded into the prompt for analysis.
- **Agent mode** (`runAgenticTurn`) — toggle **Agent** in the header and the
  COO-routed model autonomously drives the tools: classify → route → loop
  (call tool → feed result back → repeat) until it answers, with every tool
  step shown inline in the reply. **Live tool-calling is wired for every
  provider** (`makeLiveToolPlanner`): Anthropic via its native `tool_use`
  protocol, OpenAI and xAI via the OpenAI-compatible `tool_calls` protocol —
  activated whenever the routed model's provider key is set
  (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `XAI_API_KEY`). With no key, a
  deterministic simulated planner drives the exact same loop, so it works with
  zero config and degrades safely on any live-path error.

## Run it

Conductor runs end-to-end in **simulation mode with zero configuration** — no API
keys, no database.

```bash
cd conductor
pnpm install
pnpm dev            # → http://localhost:3000
```

**One gateway key makes every model live** — including Gemini. Because the
catalog ids are already `provider/model` slugs, a single **Vercel AI Gateway**
or **OpenRouter** key fronts Claude, GPT, Grok, and Gemini over one
OpenAI-compatible endpoint (used for both completions and agentic tool-calling).
A gateway takes precedence over per-provider keys.

```bash
cp .env.example apps/web/.env.local
# RECOMMENDED — one key, every model:
#   AI_GATEWAY_API_KEY=…   (Vercel AI Gateway)   or   OPENROUTER_API_KEY=…
# OR native per-provider:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY   (Gemini needs a gateway)
```

## Test it

The orchestration core, memory layer, tool sandbox, agentic loop, multimodal
routing, capability tools, and the evaluation harness are unit-tested with the
Node test runner (54 tests, no install required):

```bash
pnpm test
# or per package:
node --test packages/coo-engine     # routing, fitness, budget gates
node --test packages/agent-memory   # store factory + context window
node --test packages/agent-tools    # sandbox executor + registry
node --test packages/eval           # cost/quality benchmark + claims
```

## Evidence: the cost/quality benchmark

Routing is only worth anything if it saves money *without* losing quality. That
claim is **measured, not asserted** — `@conductor/eval` scores the **shipping
`routeTurn`** against pin-one-model baselines over an 18-task golden set
(coding, reasoning, writing, analysis, research, data, vision):

```bash
pnpm eval            # print the Markdown report
pnpm eval:write      # regenerate BENCHMARKS.md
pnpm eval -- --live  # use a real LLM-as-judge oracle (needs a gateway/provider key)
```

Current result (synthetic oracle — see `BENCHMARKS.md`):

| Strategy | Avg quality | $ / task |
| --- | ---: | ---: |
| **COO (this router)** | **98.1%** | **$0.0083** |
| Always-Premium (Opus) | 98.7% | $0.0257 |
| Always-Cheapest (Grok) | 86.9% | $0.0021 |

> **COO is ~68% cheaper than always-using-the-premium model while retaining
> ~99% of its quality, and delivers ~13% higher quality than always-using the
> cheapest.** Those two inequalities are locked in as regression tests.

The crux is the **quality oracle**, which is deliberately explicit and swappable
(`packages/eval/src/oracle.js`). The default is a transparent *synthetic prior*
(capability vs task difficulty, specialty match, vision capability) so the
benchmark runs deterministically in CI with zero keys — it is a model of
competence, **not** a live measurement. The `--live` oracle replaces the prior
with real model calls scored by an LLM judge; swapping it changes *only* the
oracle, not the strategies, dataset, or report. That separation is the point:
it's the seam that turns "transparent assumptions" into "evidence" the day you
add a key.

## Deploy to Vercel

A GitHub Actions workflow (`.github/workflows/deploy-conductor-vercel.yml`)
deploys `conductor/apps/web` to Vercel. **Zero-dashboard setup:** add one repo
secret — `VERCEL_TOKEN` (Settings → Secrets and variables → Actions). On the next
push to `main` that touches `conductor/**` (or a manual run via the Actions tab),
the Vercel CLI **creates a new "conductor" project and deploys it to
production** — no project needs to exist first. Optionally set `VERCEL_ORG_ID` /
`VERCEL_PROJECT_ID` to target an existing scope/project.

Prefer the dashboard? **Import** the repo as a new Vercel project and set **Root
Directory** to `conductor/apps/web` — Next.js and the parent pnpm workspace are
auto-detected. Set provider keys / `DATABASE_URL` / `CONDUCTOR_SANDBOX` as
environment variables as needed (it deploys fine with none — simulation mode).

## The model catalog

| Model | Specialty | Capability | Vision | Routed when… |
| --- | --- | --- | --- | --- |
| Claude Opus 4.6 | reasoning | 0.98 | 👁 | deep reasoning / architecture, or a high quality bar |
| GPT-5.3 Codex | code | 0.92 | 👁 | code generation & refactors |
| Claude Sonnet 4.6 | writing | 0.90 | 👁 | docs, explanations, balanced work |
| Grok 4.1 Reasoning | analysis | 0.85 | — | data analysis at scale — fastest & cheapest |
| Gemini 2.5 Pro | reasoning | 0.93 | 👁 | multimodal reasoning, huge context — cheaper than Opus |

Edit `packages/coo-engine/src/catalog.js` to change pricing, capability, or add
models. Pricing is USD per 1M tokens — verify against current provider rates
before relying on metered cost for billing.

## Product UX

A complete chat product, not just an API: responses **stream** token-by-token
over SSE (with the routing decision and each agentic tool step arriving live),
a **Stop** button aborts mid-stream, assistant messages have **Copy**, and a
**conversation sidebar** keeps your full history in `localStorage` so chats
survive reloads with zero backend — new / switch / delete, all client-side.
(The server additionally keeps a durable audit log via the memory store /
Postgres.)

## Design

The UI mirrors Anthropic / Claude's design language: ivory `#faf9f5`, ink
`#141413`, coral `#d97757`, clay borders `#e8e6dc`, a serif display face
(Copernicus/Tiempos family) for headings and a Styrene-family sans for body, a
subtle paper-grain texture, soft rounded message bubbles, and a warm dark mode
(`#262624`). See `apps/web/app/globals.css`.

## License

MIT (inherits the COO engine's open-core license).
