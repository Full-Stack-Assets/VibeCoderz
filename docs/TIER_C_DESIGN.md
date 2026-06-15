# Design: Auto-recharge (B1), Teams/SSO, and the MCP Marketplace

_Last updated: 2026-06-15. Companion to `docs/MONETIZATION_PLAN.md`._

These three are deliberately **not** bundled into one change: **B1 charges real
customer cards off-session**, **Teams/SSO is security-sensitive auth**, and the
**marketplace** stores third-party credentials. Each warrants its own focused,
reviewed pass (and B1 must be validated in Stripe **test mode** before it can
charge anyone). This doc specifies all three so they can be built cleanly.

Status: **B3 (native sponsorships) is shipped** (`lib/sponsors.ts` +
`SponsoredSlot`, free-tier-only, off until `NEXT_PUBLIC_CONDUCTOR_SPONSORS` is set).

---

## B1 — Auto-recharge top-ups (off-session)  ·  IMPLEMENTED (default-off)
**Status:** built end-to-end behind `CONDUCTOR_AUTORECHARGE` (default **off**):
per-user prefs + atomic recharge claim on all stores; top-up checkout now saves
the card (`setup_future_usage=off_session`); `chargeOffSession` + the chat-route
trigger (`maybeAutoRecharge`); `payment_intent.succeeded/payment_failed` webhook
handling (grant + clear / disable); `/api/billing/auto-recharge` + a UI control.
**Before flipping it on: validate the off-session charge + both webhook events in
Stripe TEST mode.** It cannot charge anyone until the flag is on AND a user opts
in AND a card is on file.

**Goal:** when a user's top-up credit runs low, automatically buy their chosen
pack so heavy users never hit a wall — opt-in.

**Why its own pass:** this is the only feature that charges a saved card without
the user present. A bug = erroneous charges/chargebacks. It cannot be verified
here (no live Stripe); it must be exercised in **Stripe test mode** and ship
**disabled by default** (`CONDUCTOR_AUTORECHARGE`).

**Data** (per user): `autoRecharge { enabled: boolean; thresholdUSD: number; packId: string }`,
plus `rechargeInFlightAt: number|null` (debounce) and a saved Stripe payment
method (relies on `stripeCustomerId`, already stored by the webhook).

**Flow:**
1. **Save a card**: the top-up Checkout sets `payment_intent_data[setup_future_usage]=off_session`
   (or a SetupIntent) so the customer has a reusable default PM.
2. **UI**: an Auto-recharge toggle in the top-up section (threshold + pack).
3. **Trigger** (in the metering path, after top-up credit is consumed): if
   enabled AND `credit < threshold` AND no recharge in flight → create an
   off-session PaymentIntent (`POST /payment_intents`, `customer`, `amount`,
   `off_session:true`, `confirm:true`, `metadata{kind:'auto-topup', userId, creditUSD}`);
   stamp `rechargeInFlightAt`.
4. **Webhook**: `payment_intent.succeeded` (kind=auto-topup) → `addUserCredit`,
   clear in-flight. `payment_intent.payment_failed` / `requires_action` (SCA) →
   clear in-flight, **disable** auto-recharge, notify the user.

**Safety:** the existing webhook idempotency + the in-flight flag prevent
double-charging; SCA/decline disables the feature rather than retrying blindly.
**Effort:** ~2–3 days incl. test-mode validation.

---

## Teams / SSO
**Goal:** multi-seat orgs with a shared budget, roles, and enterprise SSO —
higher ACV / expansion revenue.

**Why its own pass:** multi-tenant data model + security-sensitive auth. Don't
roll your own SSO.

**Data:** `Organization { id, name, ownerId, plan, budgetUSD, periodDays }`,
`Membership { orgId, userId, role: 'admin'|'member' }`, `Invite { orgId, email, token, expiresAt }`.

**Metering:** extend `UsageStore` to key spend/savings by `orgId` when the user
belongs to an org (turns charge the shared org budget instead of personal);
`sanitizeOverrides`/plan limits read the org plan.

**Billing:** per-seat Stripe subscription (`quantity = seats`); the existing
checkout/webhook generalize to set the org plan.

**SSO:** integrate **WorkOS** (or Auth0) for SAML/OIDC rather than building it —
add an SSO callback that maps the federated identity → user → org. Keep the
email+password path for non-SSO.

**Phasing:** (a) orgs + seats + shared budget; (b) invites + roles + an admin
view; (c) SSO via WorkOS. **Effort:** multi-week.

---

## MCP connector marketplace
**Goal:** a curated catalog of MCP connectors users can enable (GitHub, Slack,
Postgres, …), with featured/sponsored placement (rev-share) — extends the
native-sponsorship model and the MCP client that already exists.

**Builds on:** `registerMcpTools` (reads `CONDUCTOR_MCP` today) and the
`ToolRegistry` seam — already shipped.

**Data:** a curated `connectorCatalog` (config: `{ id, name, description, url,
authType, sponsored? }`), `UserConnector { userId, connectorId, credentials }`
with **credentials encrypted at rest** and per-user scoping.

**Flow:** a Connectors tab lists the catalog; enabling one collects its auth
(e.g., a token) → stored per user; the chat route loads each user's enabled
connectors (in addition to the env-configured ones) into `registerMcpTools`.

**Monetization:** featured/sponsored slots in the catalog (rev-share), consistent
with B3's "labeled, useful, never in the answer" rule.

**Security:** connector tokens are secrets — encrypt at rest, never return them
to the client, scope strictly per user. **Effort:** ~1–2 weeks; phase as
(a) catalog + per-user enable/creds + wiring, (b) marketplace UI + placement.

---

## Recommended sequence
1. **B1** — highest near-term revenue (heavy-user capture); smallest of the
   three, but build it carefully and validate in Stripe test mode first.
2. **MCP marketplace** — leverages shipped infra (MCP client) and compounds the
   integration moat.
3. **Teams/SSO** — biggest lift; do once paid traction + `DATABASE_URL`-backed
   data justify the enterprise motion.
