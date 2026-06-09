# Conductor

**A constraint-optimized agentic coding platform.** Conductor fuses three
projects into one product: it routes every chat turn to the *cheapest model that
is still good enough* using a patented-style Constraint-Optimized Orchestration
(COO) engine, runs it through a memory-backed agent runtime, and presents it all
in a web app whose look mirrors the **Claude iOS app** — warm ivory, coral
accent, serif display type, soft paper texture.

> Most agentic platforms pin one model or switch models by hand. Conductor's
> differentiator is that **model selection is an optimization problem solved per
> turn** — budget-aware, fitness-scored across five constraint dimensions, and
> **fully auditable**. You can see exactly which model was chosen and why.

## What was combined

| Source repo | Role in Conductor | Lives in |
| --- | --- | --- |
| **COO-Engine-Implementation** | The orchestration brain — fitness scoring, fallback routing, adaptive weighting, budget/fitness admission gates, multi-provider LLM client | `packages/coo-engine` |
| **Claude (Code Assistant)** | The agent runtime concept — conversation memory + context-window replay behind a DB-swappable store | `packages/agent-memory` |
| **vibe-coding-platform2** | The product shell — Next.js app, multi-model catalog, chat UX | `apps/web` |

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

## Run it

Conductor runs end-to-end in **simulation mode with zero configuration** — no API
keys, no database.

```bash
cd conductor
pnpm install
pnpm dev            # → http://localhost:3000
```

Add any provider key to switch that provider's models to **live** responses; the
router automatically uses whichever providers are configured:

```bash
cp .env.example apps/web/.env.local
# set ANTHROPIC_API_KEY and/or OPENAI_API_KEY and/or XAI_API_KEY
```

## Test it

The orchestration core and memory layer are unit-tested with the Node test
runner (no install required):

```bash
pnpm test
# or per package:
node --test packages/coo-engine
node --test packages/agent-memory
```

## The model catalog

| Model | Specialty | Capability | Routed when… |
| --- | --- | --- | --- |
| Claude Opus 4.6 | reasoning | 0.98 | deep reasoning / architecture, or a high quality bar |
| GPT-5.3 Codex | code | 0.92 | code generation & refactors |
| Claude Sonnet 4.6 | writing | 0.90 | docs, explanations, balanced work |
| Grok 4.1 Reasoning | analysis | 0.85 | analysis at scale — fastest & cheapest |

Edit `packages/coo-engine/src/catalog.js` to change pricing, capability, or add
models. Pricing is USD per 1M tokens — verify against current provider rates
before relying on metered cost for billing.

## Design

The UI mirrors Anthropic / Claude's design language: ivory `#faf9f5`, ink
`#141413`, coral `#d97757`, clay borders `#e8e6dc`, a serif display face
(Copernicus/Tiempos family) for headings and a Styrene-family sans for body, a
subtle paper-grain texture, soft rounded message bubbles, and a warm dark mode
(`#262624`). See `apps/web/app/globals.css`.

## License

MIT (inherits the COO engine's open-core license).
