# Deployment Design

A production deployment design for the Vibe Coding Platform — how the system is
hosted, configured, released, observed, and rolled back. It is grounded in what
the code actually does today; every environment variable and behaviour below is
traceable to a file in this repo.

The goal is a deployment that is **safe by default**: the platform builds and
boots with zero credentials (anonymous, unmetered chatbot mode), and each
production capability — auth, billing, live models, real sandboxes — switches on
only when its env vars are present. Nothing fails closed because a key is
missing; it degrades to a documented fallback.

---

## 1. What gets deployed

This repository contains **two independently deployable Next.js applications**:

| App | Root | Purpose | Database |
| --- | --- | --- | --- |
| **Platform** | repo root | The product users see — prompt → AI generates a full-stack app in a Vercel Sandbox with live preview, file explorer, logs, accounts, and billing. | Turso / libSQL (SQLite) |
| **Conductor** | `conductor/apps/web` | The constraint-optimized orchestration engine + general agent demo. Self-contained pnpm workspace. | Postgres (optional) |

They share a repo but **not** a build, a database, or a Vercel project. Treat
them as two services. The rest of this document is about the **Platform** unless
a section says otherwise; Conductor's own deployment story lives in
`conductor/README.md` and is summarized in §9.

---

## 2. Topology

```
                         ┌────────────────────────────────────────────┐
   Browser ─── HTTPS ───▶│  Vercel Edge / CDN                          │
                         │  static assets · BotID challenge            │
                         └───────────────┬────────────────────────────┘
                                         │
                         ┌───────────────▼────────────────────────────┐
                         │  Next.js on Vercel (Node serverless)        │
                         │  app/  (RSC + route handlers)               │
                         │  /api/chat  /api/auth/*  /api/billing/*     │
                         │  /api/projects/*  /api/sandboxes/*  /api/health │
                         └───┬─────────┬──────────┬─────────┬──────────┘
                             │         │          │         │
              ┌──────────────▼─┐ ┌─────▼──────┐ ┌─▼───────┐ ┌▼──────────┐
              │ Turso / libSQL │ │ AI Gateway │ │ Vercel  │ │ Stripe    │
              │ (accounts,     │ │ (Claude /  │ │ Sandbox │ │ (checkout │
              │  projects,     │ │  GPT / Grok│ │ (code   │ │  + webhook│
              │  credit ledger)│ │  routing)  │ │  exec)  │ │  → credits│
              └────────────────┘ └────────────┘ └─────────┘ └───────────┘
```

Every external dependency is reached over the network from the serverless
runtime; there is no long-lived server to manage. State lives in Turso (durable)
and in the per-session Vercel Sandboxes (ephemeral, auto-expiring in 10–45 min).

---

## 3. Environments

| Environment | Trigger | Database | Models | Billing |
| --- | --- | --- | --- | --- |
| **Local dev** | `pnpm dev` | `file:./vibe.db` (auto-created, gitignored) | live if `AI_GATEWAY_API_KEY` set | off unless `NEXT_PUBLIC_BILLING_ENABLED=true` |
| **Preview** | every PR (Vercel Git integration) | a disposable Turso branch DB (see §6) | live (preview gateway key) | off — never charge on preview |
| **Production** | merge to `main` | the production Turso database | live | on |

Preview deployments must never share the production database or the production
Stripe keys. Use Vercel's per-environment environment variables (Production /
Preview / Development scopes) to enforce this — the same variable name resolves
to different values per environment.

---

## 4. Hosting (Vercel)

The Platform deploys from the **repo root** via Vercel's native Git
integration: preview deployment per PR, production deployment on merge to
`main`. `vercel.json` pins the framework and raises the function limit for the
streaming chat route:

- **Framework:** Next.js (auto-detected; pinned in `vercel.json`).
- **Node:** 22.x (`package.json` → `engines`).
- **Build:** `pnpm build` (Turbopack). Must succeed with **no** runtime
  credentials — CI enforces this (§8).
- **Function duration:** `app/api/chat/route.ts` exports `maxDuration = 300`
  and `vercel.json` mirrors it. Agentic runs stream for minutes (model turns +
  sandbox tool loops); the default ~10–15s ceiling would truncate them. 300s
  needs Vercel Pro; with Fluid Compute it can go higher.

There is no custom server, no Dockerfile, and no separate API tier — the Next.js
route handlers *are* the backend.

---

## 5. Configuration & secrets

The platform is **off-by-default**: it boots with nothing set and turns
capabilities on as keys appear. Set these as Vercel Environment Variables,
scoped per environment.

### Core

| Variable | Required? | What it does | Source |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | for live models | Routes to Claude / GPT / Grok via Vercel AI Gateway. Read implicitly by `@ai-sdk/gateway`. | `ai/gateway.ts` |
| `AI_GATEWAY_BASE_URL` | no | Override the gateway endpoint (e.g. self-hosted / OpenRouter). | `ai/gateway.ts` |
| `DATABASE_URL` | production | `libsql://<db>.turso.io` in prod; `file:./vibe.db` locally. | `db/client.ts` |
| `DATABASE_AUTH_TOKEN` | for remote Turso | Auth token for the libSQL endpoint; ignored for `file:` URLs. | `db/client.ts` |
| `GITHUB_TOKEN` | for "push to GitHub" | PAT used by the push-to-github tool to create repos. | `ai/tools/push-to-github.ts` |

### Sandbox (code execution)

| Variable | Required? | What it does |
| --- | --- | --- |
| `VERCEL_OIDC_TOKEN` | auto on Vercel | Injected by Vercel; `@vercel/sandbox` uses it to create sandboxes with no manual token. |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | local only | Manual sandbox auth for `pnpm dev` and `scripts/test_sandbox.py`, where OIDC isn't present. |

On Vercel, sandboxes work with **zero** sandbox config — OIDC is automatic.
Locally you supply a token triplet.

### Auth + billing (only when `NEXT_PUBLIC_BILLING_ENABLED=true`)

| Variable | Required when billing on | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_BILLING_ENABLED` | — | Master switch. `true` requires sign-in and meters credits. | 
| `AUTH_SECRET` | **yes** | Signs session JWTs. `lib/auth.ts` **throws in production if unset** — there is no insecure fallback outside dev. Generate with `openssl rand -base64 32`. |
| `STRIPE_SECRET_KEY` | for payments | Stripe API key. Billing routes are inert (`501`) until set. |
| `STRIPE_WEBHOOK_SECRET` | for payments | Verifies webhook signatures (`/api/billing/webhook`). |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_SCALE` / `_TOPUP` | for payments | Stripe Price IDs per plan (`lib/billing.ts` → `PLANS`). |
| `NEXT_PUBLIC_APP_URL` | for payments | Base URL for Stripe success/cancel redirects. |

**Secret hygiene:** never commit `.env*` (only `.env.example` is tracked,
enforced by `.gitignore`). Rotate `AUTH_SECRET` and Stripe keys out of band;
rotating `AUTH_SECRET` invalidates all sessions (acceptable, forces re-login).
The `/api/health` probe reports *which* of these are configured as booleans —
never their values (§10).

---

## 6. Database & migrations

The Platform uses **Drizzle ORM over libSQL** (`dialect: 'turso'`). Locally that
is a SQLite file; in production it is a Turso (libSQL) database reached over the
network with an auth token. The schema (`db/schema.ts`) covers `users`,
`credit_ledger`, `projects`, `project_files`, and `chat_history`.

### Migration strategy

Two paths exist, and the design uses **both** deliberately:

1. **Release step (preferred).** `pnpm db:migrate` (`db/migrate.ts`) applies all
   migrations against `DATABASE_URL`. Run this as a discrete deploy step against
   the production database **before** the new code serves traffic — it gives a
   single, ordered, observable point where schema changes land, with no race
   between concurrent cold starts.

2. **Lazy runtime fallback.** `getDb()` (`db/client.ts`) runs the migrator once
   per server instance on first DB use. This makes preview/local "just work"
   with zero ops. To support it on Vercel, `next.config.ts` bundles
   `db/migrations/**` into every DB-touching function via
   `outputFileTracingIncludes` — **if you add a new route that hits the DB, add
   it to that list** or its first request throws `ENOENT`.

Because the migrator records applied migrations in its own table, both paths are
idempotent and safe to combine. In production, lean on path 1 and treat path 2
as a safety net.

### Preview databases

`.github/workflows/neon_workflow.yml` provisions a disposable per-PR database
branch and tears it down when the PR closes — the standard pattern for isolating
preview data from production. Wire the branch's connection string into the
Vercel Preview environment (or run migrations against it) so previews never
touch production data. (Conductor speaks Postgres natively, so Neon fits it
directly; for the Turso-based Platform, use Turso's branch/replica feature or a
Postgres-compatible preview the same way — the principle is the constant:
**one throwaway database per preview, never production**.)

---

## 7. AI Gateway & model routing

`ai/gateway.ts` fronts every model through the Vercel AI Gateway using
`provider/model` slugs (`anthropic/claude-opus-4.6`, `openai/gpt-5.3-codex`,
`xai/grok-4.1-fast-reasoning`, …). One `AI_GATEWAY_API_KEY` unlocks all of them;
provider-specific options (Anthropic prompt caching, OpenAI reasoning effort /
priority tier) are applied per model in `getModelOptions`.

For deployment this means: **one secret, all models**, and the gateway is the
single place to enforce spend caps, rate limits, and provider failover. Per-1M
token rates that back the credit math live in `lib/billing.ts` (`MODEL_RATES`)
and must be re-verified against current provider pricing — they are list-price
estimates, and margin is keyed off the **gateway-billed** cost.

---

## 8. CI/CD pipeline

```
PR opened ──▶ CI (ci.yml)              ──▶ Vercel Preview deploy
              type-check · lint · build     (preview env vars, preview DB)
              + conductor tests

merge main ─▶ CI (ci.yml) ──▶ migrate prod DB ──▶ Vercel Production deploy
```

- **`.github/workflows/ci.yml`** is the pre-merge quality gate: it installs with
  a frozen lockfile, then runs `type-check`, `lint`, and `build` for the
  Platform, and `pnpm test` for Conductor. The build runs with **no** real
  credentials to prove the safe-by-default contract holds. Lint uses ESLint's
  flat config (`eslint.config.mjs`) via the ESLint CLI — `next lint` was removed
  in Next 16.
- **Vercel Git integration** owns the actual deploys (preview per PR, production
  on `main`). CI gates the merge; Vercel ships the artifact.
- **`.github/workflows/deploy-conductor-vercel.yml`** keeps Conductor's separate
  Vercel project pointed at `conductor/apps/web` and dumps build logs for
  diagnosis (config-only; Conductor also deploys via Git integration).
- **Run migrations** (`pnpm db:migrate`) against the production database between
  CI passing and production traffic — as a deploy hook or a manual gate for
  schema-changing releases.

---

## 9. Conductor (the second app)

Conductor is a standalone pnpm workspace under `conductor/`. It runs end-to-end
in **simulation mode with zero config** (no keys, no DB) and goes live the same
way the Platform does: one gateway key activates every model. Its database is
optional Postgres that **provisions its own tables on first use** — no migration
step. Deploy it as a *separate* Vercel project with Root Directory
`conductor/apps/web` (see `conductor/README.md`). Keep its env vars
(`CONDUCTOR_BUDGET_USD`, `CONDUCTOR_SANDBOX`, `CONDUCTOR_WEB`, `DATABASE_URL`)
out of the Platform project and vice versa.

---

## 10. Observability

- **Health probe:** `GET /api/health` checks database connectivity (`select 1`),
  reports configured subsystems as booleans (billing / gateway / sandbox /
  Stripe), and returns **503 when the database is unreachable** so a bad deploy
  is detectable by uptime monitors and can trigger a rollback. Point an external
  monitor (or Vercel's checks) at it.
- **Web analytics + performance:** `@vercel/analytics` and
  `@vercel/speed-insights` are wired in `app/layout.tsx`.
- **Errors:** server errors are logged to the function logs (Vercel
  Observability). The in-app error monitor (`components/error-monitor`) surfaces
  *generated-app* runtime errors back into the chat for auto-fix — that is a
  product feature, not platform monitoring.
- **Billing audit:** `credit_ledger` is an append-only audit log; the
  `users.credits_balance` column is a denormalized fast-read total. A periodic
  reconciliation recomputing the balance from the ledger detects drift
  (`docs/CREDITS_PLAN.md` §9).

---

## 11. Security hardening

| Concern | Control | Where |
| --- | --- | --- |
| Bot/abuse on expensive endpoints | `checkBotId()` gates `/api/chat`; Vercel BotID challenge at the edge. | `app/api/chat/route.ts`, `next.config.ts` (`withBotId`) |
| Session forgery | HS256-signed JWT in an **HTTP-only** cookie; `AUTH_SECRET` mandatory in prod. | `lib/auth.ts` |
| Webhook spoofing | Stripe signature verified against `STRIPE_WEBHOOK_SECRET` using the **raw** body. | `app/api/billing/webhook/route.ts` |
| Cost blow-out | Pre-flight balance gate (`402` when out of credits) + per-generation `ceil()` margin floor + `stepCountIs` / `maxDuration` caps. | `lib/billing.ts`, `app/api/chat/route.ts` |
| SVG/image injection | Sandboxed CSP on remote images. | `next.config.ts` (`images.contentSecurityPolicy`) |
| Untrusted code | All generated code runs **only** inside an ephemeral Vercel Sandbox, never on the platform runtime. | `ai/tools/create-sandbox.ts` |
| Secret leakage | `.gitignore` blocks `.env*`; `/api/health` exposes config presence as booleans, never values. | `.gitignore`, `app/api/health/route.ts` |

---

## 12. Cost & unit economics

Full margin math is in `docs/CREDITS_PLAN.md`. The deployment-relevant
invariant: every credit is sold so that loaded cost ≤ 85% of retail (≥15%
margin), metering reconciles to **actual** gateway-billed token usage in a DB
transaction, and Stripe fees + amortized sandbox/infra are folded into loaded
cost. Re-derive the credit cost basis whenever provider rates move.

---

## 13. Release runbook

**Deploy**

1. PR → CI green (`ci.yml`) → review → merge to `main`.
2. If the release changes `db/schema.ts`: run `pnpm db:migrate` against the
   production `DATABASE_URL` before/at deploy time.
3. Vercel builds and promotes the production deployment.
4. Verify `GET /api/health` returns `200 {"status":"ok"}` with the expected
   subsystems `true`.

**Rollback**

1. In Vercel, **Instant Rollback** to the previous production deployment
   (code-only; seconds).
2. Migrations are forward-only — never auto-revert. If a migration is the
   problem, ship a forward fix. Design migrations to be backward-compatible with
   the prior code (expand/contract) so a code rollback alone is always safe.
3. To kill spend immediately without a redeploy: remove `AI_GATEWAY_API_KEY` (or
   cap it at the gateway). Models stop; the app stays up.

---

## 14. Pre-launch checklist

- [ ] `AUTH_SECRET` set in Production (32+ random bytes) — verified the app
      refuses to boot without it in prod.
- [ ] Production `DATABASE_URL` + `DATABASE_AUTH_TOKEN` point at the production
      Turso database; migrations applied (`pnpm db:migrate`).
- [ ] `AI_GATEWAY_API_KEY` set, with a spend cap configured at the gateway.
- [ ] Preview environment uses a **separate** database and **test-mode** Stripe
      keys — never production.
- [ ] Stripe: live keys, the four `STRIPE_PRICE_*` IDs, webhook endpoint →
      `/api/billing/webhook` with `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
- [ ] `NEXT_PUBLIC_BILLING_ENABLED=true` only after the above are confirmed.
- [ ] External uptime monitor pointed at `/api/health`.
- [ ] CI required as a merge check on `main`.
- [ ] Any new DB-touching route added to `outputFileTracingIncludes` in
      `next.config.ts`.
