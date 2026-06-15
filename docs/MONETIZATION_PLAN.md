# Conductor / VibeCoderz — Immediate Value & Monetization Plan

_Last updated: 2026-06-15. Grounded in what's already shipped (Stripe checkout +
top-ups, plans, the public API, the flywheel data, the benchmark page)._

The product already has the hard parts: server-enforced plans (Free/Pro/Max),
Stripe subscription checkout + one-time top-ups (`lib/server/stripe.ts`,
`/api/billing/*`), credit metering (`chargeSplit`, `usageStore`), a public API
with keys (`/api/v1/chat`, `/api/keys`), and per-turn cost/quality data being
persisted. So most of these are **packaging + a few endpoints**, not new infra.

Ranked by **value × immediacy ÷ effort**. On ads specifically: see §3 — for a
trust/transparency-branded product, *affiliate/native sponsorships beat display
ad networks*, and nothing belongs in the answer stream.

---

## 1. Tier A — ship this week (low effort, high leverage)

### A1. The "you saved $X" value receipt _(highest leverage)_
**What:** show each user how much the router saved them vs. always-using-Opus,
per session and per month ("You saved **$18.40** this month — 71% vs. premium").
**Why now:** it's the product's entire thesis made personal — it drives
retention, word-of-mouth, and is the single best *upgrade justification*. The
data already exists: every persisted turn carries `model`, `costUSD`, and the
escalation/quality metadata.
**Where:** compute `sum(premium_cost_estimate − actual_cost)` from the turn
metadata (reuse `estimateTurnCostUSD` with the premium model); surface as a badge
in the header + a line on the Pricing/upgrade screen. **Effort: ~1 day.**
**Requires:** `DATABASE_URL` (so the data persists — already flagged).

### A2. Annual billing
**What:** add annual price IDs (`STRIPE_PRICE_PRO_ANNUAL`, `…_MAX_ANNUAL`) and a
monthly/annual toggle on `Pricing.tsx`, at ~2 months free (≈17% off).
**Why now:** better cash flow + materially higher retention; standard SaaS lever.
**Where:** `priceIdForPlan` already maps plan→price; extend to a `(plan, cycle)`
map; the checkout flow is unchanged otherwise. **Effort: ~0.5 day.**

### A3. Package the premium upsells + cap→upgrade CTA
**What:** the paid-only levers already enforced (`allowPreferModel`, higher
`maxQualityFloor`) aren't *sold*. Put a crisp feature matrix on `Pricing.tsx`
(model pinning, higher quality floor, priority routing, bigger budget, API
access, longer memory). Add an **"Upgrade to Pro"** button next to the existing
top-up bar that appears at the budget cap (`Chat.tsx` `capReached`).
**Why now:** converts the moment of highest intent (hitting the cap). **Effort: ~0.5 day.**

### A4. Referral credits
**What:** a referral code that grants both parties top-up credit on the
referee's first paid action.
**Why now:** cheap, viral, and on-brand (the cost-savings hook is shareable). The
grant primitive already exists (`addUserCredit`).
**Where:** a `referrals` table + a code on signup; grant via `addUserCredit`.
**Effort: ~1–2 days.**

---

## 2. Tier B — next (weeks)

### B1. Auto-recharge top-ups
Opt-in: when top-up credit drops below a threshold, automatically buy the
configured pack (off-session Stripe charge). Captures heavy-user revenue with
zero friction. Builds on the existing top-up + webhook flow. **Effort: ~2 days.**

### B2. Monetize the public API
The API (`/api/v1/chat`) is scaffolded and meters against the plan budget today.
Turn it into a revenue surface: an API/Developer tier (or API credits separate
from chat), **per-key rate limits**, and a usage dashboard. Keys + metering
already exist. **Effort: ~3–5 days.** New, recurring, high-margin revenue.

### B3. Native/affiliate sponsorships (the tasteful "ads" — see §3)
Contextual partner placements that are genuinely useful: "Deploy to Vercel /
Netlify," "Get a Tavily key for live search," model-provider sign-ups — paid via
affiliate, clearly labeled, **free-tier only**, never in the answer. **Effort: ~2 days.**

---

## 3. On "ads" — do this, not that

Conductor's wedge is **trust and "we save you money."** Stuffing display-network
banners (AdSense-style) into a paid, transparency-branded AI product **damages
the brand for low yield** and contradicts the value prop. So:

**Recommended (low brand risk, real revenue):**
- **Affiliate / native sponsorships** (B3): useful, contextual, labeled, free-tier
  only — e.g. deploy targets, data/search providers, model providers.
- **Sponsored MCP connectors / a connector marketplace**: once MCP is in the
  product, partners pay for placement of their tool. On-brand, recurring.
- **Sponsored starter prompts** on the empty state — one clearly-labeled chip,
  hidden for paid users.

**Avoid:** banner/display ad networks, anything in the response stream, anything
shown to paying users. They'd undercut the premium positioning and the
cost-savings promise that drives upgrades.

**Rule of thumb:** ads should never make the product feel cheaper than the
benchmark page promises. Monetize *attention you're not already charging for*
(free tier, marketplace) — not the core experience people pay to keep clean.

---

## 4. Tier C — bigger bets (when there's traction)
- **Teams / seats plan** — multi-seat org with a shared budget, admin, and SSO.
  Higher ACV / expansion revenue (flagged in `PRODUCT_STRATEGY.md` Phase 5).
- **MCP connector marketplace** — third-party tools, rev-share.
- **Usage analytics for teams** — the flywheel data, packaged as an admin
  dashboard (which models, what spend, savings per member).

---

## 5. Suggested sequence
1. **A1 (you-saved-$X)** + **A3 (upsell packaging + cap CTA)** — the conversion
   engine, both ~a day, both use code that exists.
2. **A2 (annual)** + **A4 (referrals)** — revenue + growth.
3. **B2 (API monetization)** — opens a second, high-margin revenue line on the
   API that's already built.
4. **B3 + §3 (native sponsorships)** — the right form of "ads," free-tier only.
5. **Tier C** once paid traction + `DATABASE_URL`-backed data justify it.

**Prerequisite for the data-driven items (A1, B2 metering, C analytics):**
`DATABASE_URL` must be set so turn/usage data persists — otherwise the "you
saved $X" stat and API usage history are per-instance and ephemeral.
