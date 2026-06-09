# Credit System & Pricing Plan

A plan for monetizing the Vibe Coding Platform with a usage-based credit system:
a small free starter grant, monthly subscriptions, and pay-as-you-go top-ups —
all priced to guarantee a **minimum 15% gross margin**.

> Status: **plan**. The data model (`users`, `credit_ledger`) and authentication
> (email login → session JWT → starter grant) are implemented. Metering,
> Stripe billing, and the GitHub OAuth path described below are the remaining
> build-out.

---

## 1. Principles

1. **Floor of 15% margin.** Every credit sold is priced so that the loaded cost
   of fulfilling it is at most 85% of its price:

   ```
   price = cost / (1 − margin) = cost / 0.85 ≈ cost × 1.1765
   ```

   Equivalently, **loaded cost per credit ≤ 85% of retail per credit.**

2. **Meter on actual usage, not estimates.** The AI Gateway returns token usage
   per request; we convert that to a real dollar cost and deduct credits to
   match. Flat per-model numbers are only upfront estimates / holds.

3. **Breakage and cheap models lift realized margin above the 15% floor.**
   Unused subscription credits and traffic on cheaper models (Grok, Sonnet)
   cost well under the ceiling, so realized margin is typically 20–40%.

4. **Small free starter grant** to drive signups while capping customer
   acquisition cost (CAC).

---

## 2. Unit economics

| Constant | Value | Where |
| --- | --- | --- |
| Retail value per credit | **$0.05** | `lib/billing.ts` → `CREDIT_RETAIL_USD` |
| Cost-basis ceiling per credit | **$0.0425** (= $0.05 × 0.85) | derived |
| Target margin | **15%** | `lib/billing.ts` → `TARGET_MARGIN` |
| Starter grant | **50 credits** (~$2.13 cost) | `lib/billing.ts` → `SIGNUP_CREDIT_GRANT` |

As long as the **loaded cost** of a credit stays at or below $0.0425, selling it
for $0.05 yields ≥15% margin.

### What "loaded cost" includes

```
loaded_cost = model_token_cost          # AI Gateway billed cost (input+output, post-cache)
            + sandbox_runtime_cost      # Vercel Sandbox seconds × rate, amortized per generation
            + payment_processing        # Stripe ≈ 2.9% + $0.30, amortized per credit
            + infra_overhead            # DB, hosting, bandwidth (small, amortized)
```

Use the **gateway-billed** token cost (which may include the gateway's own
markup), not provider list price, so the margin holds end-to-end.

---

## 3. Model rates → credits per generation

Provider list prices (per 1M tokens) for the currently supported models:

| Model | Input $/1M | Output $/1M |
| --- | --- | --- |
| Claude Opus 4.6 | $5.00 | $25.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| GPT-5.3 Codex | ~$3–4 (verify) | ~$12–15 (verify) |
| Grok 4.1 Fast Reasoning | ~$1 (verify) | ~$5 (verify) |

Because models differ ~5× in cost, a credit must buy *less* Opus than Grok.
**Credits deducted per generation:**

```
credits_charged = ceil( loaded_cost_of_generation / $0.0425 )
```

This guarantees ≥15% margin on every single generation, regardless of model or
token variance. The flat per-model values in `lib/billing.ts`
(`MODEL_CREDIT_COST`: Opus 5, Codex 3, Sonnet 2, Grok 1) are **upfront
estimates** used to (a) show the user "~N credits" before they run and (b) place
a hold / block when the balance is too low. The ledger reconciles to the
actual measured cost after the gateway responds.

### Worked example (one generation)

A mid-size assistant turn: ~20K input tokens (mostly cache reads at ~0.1×) and
~2K output tokens.

| Model | Token cost | + sandbox/overhead | Loaded cost | Credits (`ceil / 0.0425`) | Revenue (×$0.05) | Margin |
| --- | --- | --- | --- | --- | --- | --- |
| Opus 4.6 | $0.10 | $0.02 | $0.12 | 3 | $0.15 | 20% |
| Sonnet 4.6 | $0.045 | $0.02 | $0.065 | 2 | $0.10 | 35% |
| Grok 4.1 | $0.015 | $0.02 | $0.035 | 1 | $0.05 | 30% |

Every row clears the 15% floor; rounding `ceil()` is what pushes realized margin
above it.

---

## 4. Plans

Each subscription's price is simply **included credits × $0.05**, so a fully-used
plan lands exactly on the 15% floor and any breakage is upside.

| Plan | Price / mo | Included credits | Worst-case margin | Notes |
| --- | --- | --- | --- | --- |
| **Free** | $0 | 50 (one-time) | — (CAC) | Starter grant on signup |
| **Starter** | $10 | 200 / mo | 15% | Hobby / evaluation |
| **Pro** | $30 | 600 / mo | 15% | Individual heavy use |
| **Scale** | $100 | 2,000 / mo | 15% | Teams |
| **Top-up** | pay-as-you-go | $0.06 / credit | ~29% | Overage above plan; à-la-carte |

Design choices:

- **Top-ups are priced higher ($0.06)** than bundled credits ($0.05) so
  subscriptions are the better deal and overage carries extra margin.
- **Credits roll over** within an active subscription up to a cap (e.g. 2×
  monthly grant) to feel fair without unbounded liability.
- **Monthly grant** is applied as a `monthly_grant` ledger entry on each renewal.

---

## 5. Data model (implemented)

`db/schema.ts`:

- **`users`** — `id`, `email` (unique), `name`, `creditsBalance` (denormalized
  running total), `plan` (`free` | `pro` | `scale`), timestamps.
- **`credit_ledger`** — append-only audit log: `userId`, `delta` (+grant /
  −spend), `reason` (`signup_grant` | `monthly_grant` | `generation` | `topup` |
  `refund`), `balanceAfter`, `createdAt`.

`creditsBalance` is the fast-read total; `credit_ledger` is the source of truth.
A reconciliation job can recompute the balance from the ledger to detect drift.

---

## 6. Metering integration

Deduct credits where generations happen — `app/api/chat/route.ts`:

1. **Pre-flight (before streaming):** look up the session user; estimate credits
   from `MODEL_CREDIT_COST[modelId]`. If `creditsBalance < estimate`, return
   `402 Payment Required` and surface an "out of credits" prompt in the UI.
2. **Reconcile (after streaming):** the AI SDK exposes token usage in the stream
   result. Compute `loaded_cost`, then
   `credits = ceil(loaded_cost / 0.0425)`. In a single transaction:
   - `UPDATE users SET credits_balance = credits_balance - credits`
   - `INSERT INTO credit_ledger (delta = -credits, reason = 'generation', balanceAfter)`
3. **Gate the route on auth:** require a valid session (via `getSessionUser()`),
   matching the existing `checkBotId()` pattern.

Sandbox-creating tools (`createSandbox`, `runCommand`) can optionally meter
runtime separately, or fold an amortized constant into each generation (simpler;
chosen above).

---

## 7. Auth (implemented + roadmap)

**Implemented:** email login (`/login`) → `POST /api/auth/login` upserts the
user, grants 50 starter credits on first login, and sets an HTTP-only session
JWT (`lib/auth.ts`, signed with `AUTH_SECRET`). `GET /api/auth/me` returns the
current user + balance; `POST /api/auth/logout` clears the session.

**Roadmap:**

- **GitHub OAuth** via `arctic` (already a dependency): `/api/auth/github` →
  redirect to GitHub → `/api/auth/github/callback` → exchange code → upsert user
  by GitHub email → issue the same session JWT. The login page already has the
  button wired as a placeholder.
- **Magic links** as the production-grade passwordless email path (the current
  "type your email and you're in" flow is demo-grade).
- **Route protection:** middleware redirecting unauthenticated users from `/` to
  `/login` once auth is enforced.

---

## 8. Billing (Stripe) — roadmap

1. Stripe Checkout for subscriptions (Starter/Pro/Scale) and one-off top-ups.
2. Webhooks: `checkout.session.completed` and `invoice.paid` → insert a
   `monthly_grant` / `topup` ledger entry and bump `creditsBalance`.
3. `customer.subscription.deleted` → downgrade `plan` to `free`.
4. Store `stripeCustomerId` / `stripeSubscriptionId` on `users` (add columns).
5. Idempotency on webhook handlers keyed by Stripe event ID.

---

## 9. Risks & safeguards

| Risk | Safeguard |
| --- | --- |
| **Cost spike** (long agent loops, expensive model) | Per-generation `ceil()` margin floor; hard `max_tokens` / `stepCountIs` caps; pre-flight balance gate |
| **Provider price changes** | Margin keys off gateway-billed cost; re-derive credit cost basis if rates move |
| **Abuse of free grant** (multi-account) | One grant per verified email; rate-limit signups; `checkBotId()` on login |
| **Negative balance from race** | Deduct in a DB transaction; reject concurrent spend past zero |
| **Ledger ↔ balance drift** | Periodic reconciliation recomputing balance from `credit_ledger` |
| **Stripe fees eroding margin** | Folded into `loaded_cost`; top-ups priced higher to absorb fixed $0.30 |

---

## 10. Rollout phases

1. **Phase 1 (done):** auth + accounts + starter credits + ledger schema.
2. **Phase 2 (done):** metering in `/api/chat` (deduct on generation via
   `onFinish` token usage, auth + balance gate) + a credit-balance indicator
   and account menu in the header.
3. **Phase 3 (done):** Stripe subscriptions + top-ups + webhooks
   (`/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook`).
   Configure via `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the
   `STRIPE_PRICE_*` env vars; billing is inert (and the app unaffected) until
   they're set.
4. **Phase 4:** GitHub OAuth / magic links, route protection, usage dashboard.
5. **Phase 5:** rollover caps, team billing, reconciliation job, alerting.

### Stripe setup

1. Create four recurring/one-off Prices in the Stripe dashboard (Starter $10/mo,
   Pro $30/mo, Scale $100/mo, Top-up $12 one-time) and set their IDs in
   `STRIPE_PRICE_STARTER` / `_PRO` / `_SCALE` / `_TOPUP`.
2. Add a webhook endpoint pointing at `/api/billing/webhook` subscribed to
   `checkout.session.completed`, `invoice.paid`, and
   `customer.subscription.deleted`; put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.
3. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_APP_URL`.

> All dollar figures are illustrative and driven by the constants in
> `lib/billing.ts`. Re-run the margin formula whenever model rates or the credit
> cost basis change.
