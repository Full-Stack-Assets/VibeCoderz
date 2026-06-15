# Conductor / VibeCoderz — Product Strategy & Roadmap

_Last updated: 2026-06-14. Companion to `docs/INTEGRATION_RESEARCH.md`._
_Scope: the `conductor/` product (engine + web app). The brand is VibeCoderz._

This is a sequenced roadmap for making Conductor a product that *wins*, not a
clone that loses. It is deliberately honest about what is and isn't achievable,
and every step names the specific files and seams it touches.

---

## 0. The thesis (read this first)

**Conductor runs on top of the frontier models (Claude, GPT, Gemini, Grok) via a
gateway — its quality ceiling is the best model it can call.** It cannot be
"smarter" than ChatGPT or Claude. So the goal is **not** to out-model them. It is
to win decisively on the axes single-vendor incumbents are structurally unable or
unwilling to optimize:

| Axis | Why incumbents won't win it | Conductor's play |
| --- | --- | --- |
| **Cost-per-task** | They want you on their priciest model | Route to the cheapest *capable* model per turn |
| **Multi-model neutrality** | They only have their own models | Use the best model of *all* vendors, per task |
| **Transparency** | Opaque pricing is a feature for them | Show model, reason, fit score, and cost every turn |
| **Predictable spend** | Flat subscriptions ignore actual usage | Server-enforced budget caps + pay-for-value top-ups |

**Honest positioning:** Conductor will not be "better than ChatGPT" for everyone.
It will be **clearly better for cost-conscious, multi-model power users and teams**
— a segment the incumbents are paid to ignore. That is a winnable market.

**The one durable moat:** a cross-model `(task → model → quality → cost)` dataset
that no single-vendor product can ever assemble. Every other advantage here is
copyable; that flywheel is not. Phases 1 and 6 build it.

---

## 1. Where we stand (grounded reality)

What works today (verified in production this cycle): live multi-provider routing,
real sandbox execution, live web research + synthesis, budget enforcement,
per-turn transparency, and an agentic tool loop.

The gaps that matter for "superior":

- **The cost/quality claim is asserted, not measured.** `packages/eval/src/oracle.js`
  is a *synthetic prior* (a model of competence), and `BENCHMARKS.md` is generated
  from it. The real-judge path (`packages/eval/src/live-oracle.js`) exists but isn't
  the shipping signal.
- **Routing is static.** `packages/coo-engine/src/core.js` (`calculateFitnessScore`,
  `findBestAgentForTask`) scores from a hand-set `catalog.js`; nothing learns from
  outcomes.
- **The agent loop is shallow.** `packages/agent-tools/src/agent-loop.js`
  (`runAgenticTurn`) does one tool per step, no planning/reflection, capped at
  `MAX_AGENTIC_STEPS`.
- **No MCP client.** `packages/agent-tools/src/index.js` has the `ToolRegistry`
  seam but nothing populates it from external servers.
- **No cross-session memory or learning.** `packages/agent-memory` stores
  transcripts only.
- **Thin multi-tenant story.** Accounts/billing exist (`apps/web/lib/server/plans.ts`,
  `session.ts`) but no teams/SSO/shared budgets.

---

## 2. Roadmap (sequenced)

Phases are ordered by leverage. Do not start a later phase to avoid an earlier
one: until the routing advantage is **measured (Phase 1)** and **felt (Phase 2)**,
everything else is polish on an unproven core.

### Phase 1 — Make the routing provably better _(the wedge must be TRUE)_

**Goal:** replace "trust our synthetic benchmark" with a measured, continuously
re-validated cost/quality advantage.

- Promote the live judge to the shipping eval signal.
  - `packages/eval/src/live-oracle.js` (`makeLiveOracle`) → run it on a schedule,
    not just ad hoc; widen the golden set in `packages/eval` beyond 30 tasks.
  - Gate routing changes on it in CI (regression test: COO must hold ≥X% of
    premium quality at ≤Y% of cost, per domain).
- Capture the production feedback signal that already exists in the UI but is
  discarded.
  - `apps/web/components/Message.tsx` / `Chat.tsx` emit regenerate, edit, copy
    actions — log these as per-turn quality labels.
  - `apps/web/app/api/chat/route.ts` `persist(...)` already writes turn metadata
    (`model`, `score`, `domain`, `costUSD`); extend the record with the outcome
    label and a turn-feature vector.
- **Done when:** `BENCHMARKS.md` is regenerated from real model calls on a cadence,
  and a routing weight change can be accepted/rejected by a measured delta.

### Phase 2 — Verify-and-escalate _(make the promise visceral)_

**Goal:** literally deliver "frontier answers without frontier bills" — cheap by
default, premium only when needed, with receipts.

- Add an escalation policy to the completion path.
  - `packages/coo-engine/src/llm.js` `complete()` and
    `apps/web/app/api/chat/route.ts`: run the routed (cheap) model, score the
    output against a quality bar (reuse the `live-oracle` judge or a lightweight
    self-check), and **re-route to a premium model only on failure**.
  - Surface the escalation in the `decision`/`done` SSE events so
    `components/Message.tsx` can show "tried Grok → escalated to Opus because …".
- Keep it inside the budget guardrail (`lib/server/plans.ts` `chargeSplit`,
  `planLimits`) so escalation never silently blows the cap.
- **Done when:** most turns settle on a cheap model, hard turns auto-escalate, and
  the user sees when/why — measurably beating both a pinned-premium and a
  pinned-cheap baseline on the Phase 1 evals.

### Phase 3 — Agent capability parity (vs Manus / Claude Code)

**Goal:** close the autonomy and integration gap that lets dedicated agents win.

- **MCP client** behind the existing seam.
  - `packages/agent-tools/src/index.js` `ToolRegistry.register(schema, handler)` is
    the drop-in point; add an MCP client that registers external servers' tools and
    merges them into `tools()`/`TOOLS` for the planner. (Tier‑1 in
    `docs/INTEGRATION_RESEARCH.md`.) Unlocks GitHub, Slack, Linear, Postgres, etc.
    in one move.
- **Deeper loop:** plan → execute → reflect, parallel tool calls, checkpointed
  long-horizon runs.
  - `packages/agent-tools/src/agent-loop.js` `runAgenticTurn` — evolve beyond
    one-tool-per-step with a hard cap; add a planning step and a reflection step,
    and let independent tool calls run concurrently.
  - `packages/coo-engine/src/tool-planner.js` — the live planners already own the
    provider-native transcript; extend them to emit multiple parallel calls.
- **Persistent workspaces & artifacts:** `packages/agent-tools/src/executors.js`
  `VercelSandboxExecutor` currently creates an ephemeral microVM per turn; add an
  opt-in persistent workspace keyed to a project/conversation.
- **Done when:** Conductor completes a multi-tool, multi-file task (build → run →
  fix → deploy) end to end with external-system access, not just a single sandbox.

### Phase 4 — Memory & personalization

**Goal:** make turn N+1 smarter than turn 1 — something stateless chat can't do.

- Extend `packages/agent-memory` beyond transcript storage: durable user/project
  facts, preferences, and retrieval into the prompt.
  - `apps/web/app/api/chat/route.ts` `buildEngineMessages` / `SYSTEM` — inject a
    compact retrieved-memory block per turn.
- Feed memory hits as another routing feature (Phase 1 vector).
- **Done when:** the agent reuses prior project context and stated preferences
  without being re-told.

### Phase 5 — Trust, reliability & multi-tenant fundamentals

**Goal:** win the low-trust category on reliability — the lesson of this debugging
cycle (silent simulation, swallowed errors, corrupted file writes).

- **Observability/guardrails in CI and prod**, not after a user notices:
  the `simReason` signal added in `llm.js`/`route.ts` is the template — surface
  every degradation; assert quality floors in CI via Phase 1.
- **Safety routing:** never route sensitive/high-stakes turns to a below-bar model;
  add a domain/quality-floor gate in `packages/coo-engine/src/router.js` `routeTurn`.
- **Multi-tenant:** teams, SSO, and shared budgets on top of
  `apps/web/lib/server/plans.ts` + `session.ts`; per-user/project ownership.
- **Done when:** degradations are caught by tests/alerts, and teams can share a
  budget with SSO.

### Phase 6 — The moat: the routing data flywheel

**Goal:** turn accumulated routing data into a compounding, uncopyable advantage.

- Train routing weights/thresholds from the Phase 1 `(features → model → quality →
  cost)` corpus instead of hand-setting them in `catalog.js`/`core.js`.
- Auto-onboard new models: when a model is added to `catalog.js`, the eval harness
  scores it and the flywheel places it — so the catalog stays optimal as prices and
  models shift weekly.
- **Done when:** routing quality improves with usage, and adding a model is a
  data-driven, near-zero-touch operation.

### Phase 7 — Distribution (continuous, starts now)

Better tech loses to better distribution. Per `marketing/GTM.md`:
- Make the **live benchmark page** (Phase 1 output) the hero, shareable asset —
  "cut your AI bill ~70%, with receipts."
- Meet users where they are via the API / embed / Slack / CLI surfaces in
  `docs/INTEGRATION_RESEARCH.md` §6, so Conductor isn't just another chat tab.

---

## 3. Sequencing summary

| Phase | Thrust | Primary seams | Beats… |
| --- | --- | --- | --- |
| 1 | Measured routing advantage | `packages/eval/*`, `coo-engine/core.js`, `route.ts` persist | the "trust us" gap |
| 2 | Verify-and-escalate | `coo-engine/llm.js`, `route.ts`, `Message.tsx` | ChatGPT/Claude (single model) |
| 3 | Agent parity + MCP | `agent-tools/{agent-loop,index,executors}.js`, `tool-planner.js` | Manus / Claude Code |
| 4 | Memory/personalization | `packages/agent-memory`, `route.ts` | stateless chat |
| 5 | Trust + multi-tenant | `router.js`, `lib/server/{plans,session}.ts`, CI | low-trust category |
| 6 | Data flywheel (moat) | `coo-engine/{core,catalog}.js`, `packages/eval` | everyone (uncopyable) |
| 7 | Distribution | `marketing/*`, integration surfaces | obscurity |

**Start here:** Phase 1 + Phase 2 together. The advantage has to be *true*
(measured) and *felt* (escalation with receipts) before the rest is worth building.

---

## 4. Honest risks

- **Dependency risk:** Conductor relies on gateways/providers it doesn't control;
  pricing or access changes can erode the cost arbitrage. The flywheel (Phase 6) is
  the hedge — it profits from the spread regardless of which model leads.
- **Ceiling risk:** on the hardest tasks, "route to cheapest capable" collapses to
  "use the best model," and the advantage narrows to transparency + neutrality.
  That's still real, but don't oversell raw capability.
- **Distribution risk:** the incumbents have it and you don't. Phase 7 is not
  optional.
