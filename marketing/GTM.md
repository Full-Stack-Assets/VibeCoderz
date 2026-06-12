# VibeCoderz — Go‑to‑Market & Pricing Strategy

_A Full‑Stack Assets product. Last updated: 2026‑06‑12._

> **Conductor** is the engine; **VibeCoderz** is the brand it ships under. This
> doc covers positioning, ICP, pricing, channels, a 90‑day launch plan, and the
> investor framing — for the flagship product only (per current scope).

---

## 1. One‑liner

**VibeCoderz gives you frontier‑model answers without frontier‑model bills.**
Every message is routed by a constraint‑optimized orchestrator (the *COO
engine*) to the cheapest model that can actually do the job — and you see which
model ran, why, and what it cost.

## 2. The insight (why this exists)

- Frontier LLMs are priced 10–50× higher than mid‑tier models, but **most real
  queries don't need the most expensive model.** Summaries, edits, lookups, and
  routine code don't justify Opus pricing.
- Today users either (a) overpay by defaulting everything to a premium model, or
  (b) manually model‑switch and guess. Both are bad.
- **VibeCoderz automates the trade‑off.** The router scores each turn on task
  type, required quality, latency, and remaining budget, then picks the
  cost‑optimal model that clears the bar — typically **50–90% cheaper than
  pin‑one‑premium**, at ~99% of the quality (see `BENCHMARKS.md`).

## 3. Positioning statement

> For **cost‑conscious heavy AI users** (indie devs, startups, prosumers) who
> are tired of overpaying for one premium model, **VibeCoderz** is an AI
> assistant that **automatically routes every task to the most cost‑effective
> capable model** — unlike ChatGPT/Claude (single fixed model) or raw API
> gateways (you do the routing), it optimizes cost *for you* and shows its work.

**Category:** Cost‑optimized AI orchestration / "the smart router for AI."

## 4. Ideal Customer Profile (ICP)

| Segment | Why they buy | Where they are |
|---|---|---|
| **Indie devs / makers** (primary) | Use AI daily, watch every dollar, love transparency & control | X/Twitter, HN, Reddit, Product Hunt, dev Discords |
| **Early‑stage startups** | Burn‑conscious, want AI in their stack without a big bill | YC/accelerator networks, founder communities |
| **Prosumers / power users** | Want premium answers but hate the $20–200/mo lock‑in | Newsletters, YouTube, TikTok tech |
| **Small teams** (expansion) | Need shared usage + a budget ceiling | Outbound, referrals from indie users |

**Anti‑ICP for now:** large enterprises (long sales cycles, procurement, SSO/compliance) — revisit post‑traction.

## 5. Differentiation / moat

1. **Measured savings, not vibes** — the benchmark harness quantifies cost‑vs‑quality vs. pin‑one‑model baselines. Lead with the number.
2. **Transparency** — per‑turn model, routing reason, fit score, and live cost. Trust is the wedge.
3. **The COO engine** — constraint‑optimized routing is the defensible IP; it improves as the model catalog and pricing shift.
4. **Budget as a first‑class primitive** — server‑enforced per‑plan spend caps mean predictable bills for users and protected margin for us.

## 6. Pricing

**Principle:** the spend *cap* is a worst‑case ceiling, not expected cost — the
router keeps actual spend far below it. Caps bound downside; **top‑ups** capture
upside from heavy users instead of blocking or subsidizing them.

| Tier | Price | Spend cap | What you get |
|---|---|---|---|
| **Free** | $0 | ~$0.20/day | Cost‑optimized Auto routing, web/data/image tools, full transparency. Loss‑leader for acquisition. |
| **Pro** | $20/mo | ~$10/mo | + Premium models (Opus, GPT‑5.x), model pinning, higher quality floor, unlimited convos. ~50% gross margin at the cap. |
| **Max** | $100/mo | ~$50/mo | + Highest quality floor, priority routing, early features. ~50% gross margin at the cap. |
| **Top‑up** | usage | pay‑as‑you‑go | When you hit your cap, buy more credits (passthrough + small margin) instead of being blocked. |

**Why these numbers:** the previously‑shipped caps ($1/day, $25/mo, $150/mo)
*exceed* revenue and lose money on heavy users. The values above target ~50%+
gross margin on model spend at the cap while keeping the headline prices ($0 /
$20 / $100) and feature story intact. The enforcement is already live
(`lib/server/plans.ts` → `PLAN_LIMITS`); this is a one‑file change to adopt.

**Unit economics (worst case, user pinned at cap):**
- Pro: $20 rev − ~$10 model − ~$0.88 Stripe ≈ **$9 contribution.**
- Max: $100 rev − ~$50 model − ~$3.20 Stripe ≈ **$47 contribution.**
- Expected case is much better — most users spend a fraction of the cap.

## 7. GTM motion — Product‑Led Growth (PLG)

**Loop:** Free tier (instant value, no card) → transparency builds trust → user
hits a premium model or the daily cap → upgrade prompt → Pro/Max → top‑ups.

**Channels (ranked by fit):**
1. **Build‑in‑public on X** — post the cost‑savings benchmark, routing decisions, weekly numbers. The transparency angle is inherently shareable.
2. **Launch on Product Hunt + Hacker News** — "Show HN: an AI assistant that auto‑routes to the cheapest capable model (with receipts)." Lead with the benchmark.
3. **SEO/content** — "GPT‑5 vs Claude Opus cost per task," "how to cut your AI bill 70%," interactive benchmark page as a linkable asset.
4. **Dev communities** — Reddit (r/LocalLLaMA, r/sideproject), Discords, indie newsletters.
5. **Referral** — give credits for referrals (cheap, viral with the cost‑savings hook).

## 8. 90‑day launch plan

**Days 0–30 — Foundation & private beta**
- Finalize margin‑safe pricing + top‑ups; confirm billing/webhooks end‑to‑end.
- Polish onboarding, the routing transparency UI, and the public benchmark page (the hero asset).
- 25–50 hand‑picked beta users from dev communities; collect savings testimonials.

**Days 31–60 — Public launch**
- Product Hunt + Show HN, coordinated X thread with the benchmark.
- Publish 3 SEO cornerstone posts + the interactive benchmark.
- Turn on referral credits. Target: first 1,000 signups, first paying cohort.

**Days 61–90 — Iterate to retention/revenue**
- Instrument funnel (signup → first value → cap hit → upgrade). Optimize the upgrade prompt.
- Ship 1–2 most‑requested features; add team plan waitlist.
- Target: 5–8% free→paid, <5% monthly churn, positive contribution margin.

## 9. KPIs

- **Acquisition:** signups, CAC by channel, viral coefficient (referrals).
- **Activation:** % reaching first routed turn; time‑to‑first‑value.
- **Revenue:** free→paid %, MRR, ARPU, top‑up attach rate.
- **Margin:** avg model spend / user vs. cap (the whole thesis lives here).
- **Retention:** D7/D30, monthly logo + revenue churn.

## 10. Investor framing (the studio thesis)

- **Full‑Stack Assets is a product studio** shipping focused, AI‑native products; VibeCoderz is the flagship and the proof of the operating model: build fast, instrument economics from day one, price for margin.
- **Why now:** model prices and capabilities diverge weekly; a routing layer that arbitrages that gap compounds in value as the catalog grows. We don't bet on one model winning — we profit from the spread.
- **Defensibility:** the COO engine + accumulating routing/quality data; transparency as a brand moat in a low‑trust category.
- **TAM:** the AI‑assistant + API‑spend market, intersected with the (large, growing) cost‑sensitive long tail that current single‑model products ignore.
- **What we'd do with capital:** broaden the model catalog + native providers, ship teams/enterprise (SSO, shared budgets), and replicate the studio playbook across the next product.

---

### Immediate action items
- [ ] Adopt margin‑safe `PLAN_LIMITS` (Free $0.20/day, Pro $10/mo, Max $50/mo) + ship the **top‑up** flow (Stripe `TOPUP` scaffold already exists).
- [ ] Make the **benchmark page** the public hero asset and link it everywhere.
- [ ] Verify billing/webhook + `DATABASE_URL` on the production project so sign‑ins persist before any launch push.
