# VibeCoderz — Codebase Deep Dive & Platform Integration Research

_Last updated: 2026-06-14. Scope: the `/` Next.js app and the `conductor/` monorepo._

This document maps the current codebase, catalogs every external-platform
integration surface that already exists, identifies what architecturally blocks
clean integration, and recommends a ranked set of changes to make VibeCoderz
integrate effectively with existing platforms — both **inbound** (services it
consumes) and **outbound** (surfaces through which other platforms consume it).

---

## 1. What this codebase actually is

There are **two distinct codebases in one repo**, currently mid-pivot:

| Codebase | Path | What it is | Status |
| --- | --- | --- | --- |
| **VibeCoderz app** | `/` (root) | A Vercel "vibe coding platform" fork: prompt → AI agent generates a full app → runs it in a Vercel Sandbox → live preview. Next.js 16, AI SDK v6, Drizzle/Turso, Stripe, custom JWT auth. | Shipped / production-shaped |
| **Conductor** | `/conductor` | A separate pnpm monorepo: a *general* agent with a Constraint-Optimized Orchestration (COO) routing engine, pluggable executors, an MCP-style tool registry, memory layer, eval harness, and an iOS app. | Engine / aspirational |

The marketing docs (`marketing/GTM.md`) make the intent explicit: **"Conductor is
the engine; VibeCoderz is the brand it ships under."** The product is repositioning
from "AI app builder" to **"cost-optimized AI router"** ("frontier-model answers
without frontier-model bills").

**Important drift to resolve:** `GTM.md` references `lib/server/plans.ts` →
`PLAN_LIMITS` and a spend-cap pricing model that **do not exist in the root app**
— the root app bills with a credit ledger (`lib/billing.ts` `PLANS`, `db/schema.ts`
`credit_ledger`). The README still describes the original Vercel example. The two
codebases also have different billing models, different execution abstractions, and
different model catalogs. Any integration work should first decide which codebase is
the trunk (recommendation in §6).

---

## 2. Architecture of the root app

```
User prompt
   │
   ▼
app/page.tsx (chat UI, zustand state, resizable panels)
   │  POST
   ▼
app/api/chat/route.ts ──── botid bot check
   │                  ├──── auth + credit gate (opt-in via NEXT_PUBLIC_BILLING_ENABLED)
   │                  ├──── runConductor() → one-shot plan (generateObject, Claude Sonnet)
   │                  └──── streamText() with tools, stopWhen=stepCountIs(20)
   ▼
ai/gateway.ts → Vercel AI Gateway → Claude / GPT / Grok
   │
   ▼
ai/tools/* (the integration layer):
   • createSandbox   → @vercel/sandbox  (Amazon Linux microVM)
   • generateFiles   → LLM streams file contents, writes into sandbox
   • runCommand      → exec in sandbox (stateless shell, detached)
   • getSandboxURL   → public preview URL
   • pushToGithub    → octokit, single server PAT
   • saveProject     → Drizzle insert into projects
```

Supporting layers:
- **Persistence:** `db/` — Drizzle ORM over libsql (`file:` local / Turso remote).
  Tables: `users`, `credit_ledger`, `projects`, `project_files`, `chat_history`.
  Migrations run lazily on first DB hit (`getDb()`), bundled into each function via
  `next.config.ts outputFileTracingIncludes`.
- **Auth:** `lib/auth.ts` — custom HS256 JWT in an httpOnly cookie. Login
  (`/api/auth/login`) is **email-only, no password, no OAuth** (it just upserts a
  user and grants 50 credits). `arctic` is a dependency but **no OAuth provider flow
  is wired**.
- **Billing:** `lib/billing.ts` + `lib/stripe.ts` + `/api/billing/*` — Stripe
  checkout/portal/webhook, credit ledger reconciliation against measured token usage.
- **Bot protection:** `botid` (`withBotId`, `checkBotId`).
- **Telemetry:** `@vercel/analytics`, `@vercel/speed-insights`, `instrumentation-client.ts`.

---

## 3. Current integration surfaces (inbound — services consumed)

| Surface | How it's wired | Coupling / limitation |
| --- | --- | --- |
| **Model providers** | `ai/gateway.ts` via `@ai-sdk/gateway` (Vercel AI Gateway). Catalog in `ai/constants.ts` (Claude Opus/Sonnet, GPT-5.3 Codex, Grok). | Clean abstraction — models are `provider/model` slugs. Hard-pinned to **Vercel AI Gateway**; no OpenRouter / native fallback in the root app (conductor has it). |
| **Code execution** | `@vercel/sandbox` directly inside three tools. | **Hard dependency on Vercel Sandbox.** No interface seam — swapping backends means editing every tool. Conductor already solves this (§5). |
| **Source control** | `pushToGithub` via `octokit` with a single `GITHUB_TOKEN`. | Pushes to **the operator's** GitHub account, not the user's. No GitLab/Bitbucket. No per-user identity. |
| **Deploy** | README "Deploy to Vercel" button; conductor has a GH Action that auto-creates a Vercel project. | Vercel-only. |
| **Database** | libsql/Turso via Drizzle. | Well-abstracted (any libsql endpoint). Conductor memory can use Postgres/Prisma. |
| **Payments** | Stripe (subscriptions + top-up). | Standard, fine. |
| **Identity** | Custom JWT, email-only. | No real IdP, no SSO, no social login despite `arctic` being installed. |
| **Bot/abuse** | `botid`. | Vercel-tied. |
| **MCP** | **Not present in root app.** Conductor has a `ToolRegistry.register()` seam (`conductor/packages/agent-tools/src/index.js`) but **no actual MCP client** — only the interface to attach one. | Biggest missing standard integration. |

---

## 4. What blocks clean platform integration today

1. **Vercel lock-in across three axes** — Sandbox (execution), AI Gateway (models),
   and deploy/botid. Each is consumed directly rather than behind an interface, so
   running on or integrating with non-Vercel infra means touching call sites.
2. **Fixed tool surface in the root app.** `ai/tools/index.ts` returns a hardcoded
   object. There is no registry, so you cannot add a tool (or an MCP server's tools)
   without code changes and a redeploy.
3. **GitHub uses one shared server PAT.** Cannot push to a user's own repos, can't do
   per-user scoping, and the token is a single point of blast radius.
4. **No user↔project ownership.** `projects` has no `userId` FK and `saveProject`
   never records an owner, so multi-tenant integrations (dashboards, per-user repo
   sync, team sharing) have nothing to key on.
5. **Whole-file generation, no diffs.** `generateFiles` regenerates entire files;
   there's no patch/incremental-edit path, which limits IDE/editor and CI integrations
   that expect diffs.
6. **Email-only auth.** No OAuth/SSO means no "Sign in with GitHub/Google," no
   enterprise identity, and no clean way to obtain per-user provider tokens.
7. **Two codebases + doc drift** (see §1) — integration code written against one
   won't match the other.

---

## 5. The asset already in `conductor/`: the integration seams you want

The conductor monorepo already implements the abstractions the root app lacks. These
are the templates to port:

- **Pluggable Executor interface** (`packages/agent-tools/src/executors.js`):
  one `execute(name, args)` contract with `SimulatedExecutor`, `LocalSandboxExecutor`
  (allowlist + path-traversal guards), and `VercelSandboxExecutor` (lazy microVM).
  Selected by `CONDUCTOR_SANDBOX` env. This is exactly the seam needed to add **E2B,
  Daytona, Modal, Fly Machines, or plain Docker** as execution backends without
  touching tool definitions.
- **ToolRegistry with an MCP seam** (`packages/agent-tools/src/index.js`):
  `register(schema, handler)` lets external tools (explicitly "backed by an MCP
  server") join the same dispatch surface; `list()` emits provider-ready JSON-Schema.
  A test already exercises an MCP-style registered tool.
- **Provider-agnostic model client**: one gateway/OpenRouter key fronts Claude, GPT,
  Grok, **and Gemini** over one OpenAI-compatible endpoint, with native per-provider
  keys as fallback, and a deterministic simulation mode when no key is set.
- **Tool schemas as portable JSON-Schema** (`packages/agent-tools/src/tools.js`) —
  directly handable to Anthropic/OpenAI tool-calling APIs.

The strategic move is to make the root app consume these seams rather than its
hardcoded, Vercel-pinned equivalents.

---

## 6. Recommended changes, ranked

### Tier 1 — high leverage, unlocks the most integrations

1. **Add MCP support to the agent.** Port the conductor `ToolRegistry` into the root
   `ai/tools/index.ts`, and add an MCP client that connects to configured MCP servers
   at request time and merges their tools into the `streamText({ tools })` set.
   - _Why:_ MCP is the emerging standard; one integration unlocks **GitHub, Slack,
     Linear, Notion, Postgres, Sentry, filesystem, browser** and hundreds of existing
     servers without bespoke code per platform.
   - _Where:_ `ai/tools/index.ts` (registry), new `ai/mcp/` (client + config),
     `app/api/chat/route.ts` (merge tools), env for server URLs/credentials.

2. **Introduce an Executor interface in the root app** mirroring
   `conductor/.../executors.js`, and make `createSandbox`/`runCommand`/`generateFiles`
   call it instead of `@vercel/sandbox` directly.
   - _Why:_ removes the single biggest lock-in; lets the platform run on E2B/Daytona/
     Modal/Docker and lets self-hosters avoid Vercel.
   - _Where:_ new `ai/exec/` with a `Sandbox`-shaped interface; refactor the three tools.

3. **Replace the shared GitHub PAT with a GitHub App / OAuth.** Push to the *user's*
   account with per-user tokens; abstract the provider so GitLab/Bitbucket can follow.
   - _Where:_ `ai/tools/push-to-github.ts` → `ai/tools/git/` provider interface; add
     OAuth callback routes; store tokens per user (needs §Tier-2 ownership).

### Tier 2 — makes the platform multi-tenant and embeddable

4. **Add user↔project ownership.** `userId` FK on `projects`, set it in `saveProject`,
   scope `/api/projects` reads by session. Prerequisite for dashboards, per-user repo
   sync, teams, and any outbound integration that addresses "my projects."
   - _Where:_ `db/schema.ts`, new migration, `ai/tools/save-project.ts`,
     `app/api/projects/*`.

5. **Finish real auth / SSO.** Wire `arctic` for GitHub + Google OAuth (the GitHub flow
   doubles as the per-user token source for #3), or adopt Auth.js / WorkOS / Clerk for
   enterprise SSO. Email-only login stays as a fallback.
   - _Where:_ `lib/auth.ts`, `app/api/auth/*`, `components/account/*`.

6. **Expose VibeCoderz as a platform (outbound surfaces).** Everything routes through
   `/api/chat`; thin clients are cheap:
   - **Public REST/SSE API** with API keys (reuse the credit ledger for metering).
   - **Embeddable widget** (`<script>`/iframe) so other products embed the builder.
   - **Slack / Discord bot** and a **CLI**, both as `/api/chat` clients.
   - **VS Code extension** once diff-based edits exist (#8).
   - _Where:_ new `app/api/v1/*`, an API-key table, docs.

### Tier 3 — quality / convergence

7. **Add deploy targets** beyond Vercel (Netlify, Cloudflare Pages, Railway) behind a
   `deployTo` tool, parallel to the git-provider abstraction.

8. **Incremental/diff-based file edits** in `generateFiles` (patch apply, not full
   rewrite) — improves cost, latency, and editor/CI integration fidelity.

9. **Unify the model layer** — give the root app the conductor's gateway-or-OpenRouter-
   or-native fallback chain and Gemini, instead of Gateway-only.

10. **Consolidate the two codebases and fix doc drift** — pick the trunk (recommend:
    promote conductor's seams *into* the root app rather than maintaining both), then
    reconcile `GTM.md`'s `PLAN_LIMITS`/spend-cap model with the shipped credit ledger,
    and rewrite the README away from the Vercel-example boilerplate.

---

## 7. Suggested sequencing

- **Quick wins (days):** project ownership (#4), GitHub OAuth token source (#3 part 1),
  README/doc reconciliation (#10 part).
- **Core integration platform (weeks):** Executor interface (#2) + MCP registry (#1) —
  do these together since both reshape `ai/tools/`.
- **Distribution (weeks):** public API + widget (#6) once ownership/auth land.
- **Convergence (ongoing):** model-layer unification (#9), deploy targets (#7),
  diff edits (#8), codebase consolidation (#10).

The throughline: **introduce interfaces where the root app currently calls vendors
directly** (execution, tools/MCP, git, deploy, models), most of which already exist as
working code in `conductor/`. That single architectural shift turns "integrate with
platform X" from a code change into a configuration/registration step.
