# Full-Stack Assets — Marketing & GTM (VibeCoderz)

Strategy, copy, and a ready-to-ship landing page for the flagship product.

| File | What it is |
|---|---|
| [`GTM.md`](./GTM.md) | Go-to-market + pricing strategy: positioning, ICP, pricing table, channels, 90-day launch plan, KPIs, investor framing. |
| [`COPY.md`](./COPY.md) | Reusable marketing copy: taglines, hero, features, Product Hunt / Show HN / X launch, cold email, FAQ. |
| [`fullstack-assets/index.html`](./fullstack-assets/index.html) | The Full-Stack Assets landing page — a self-contained, dependency-free brand hub fronting VibeCoderz. Serves both customers (Try CTA) and investors (studio thesis). |

## Preview the landing page
It's a single static file — just open it:

```bash
open marketing/fullstack-assets/index.html      # macOS
# or serve it
npx serve marketing/fullstack-assets
```

## Deploy it
No build step. Any static host works. With Vercel:

```bash
cd marketing/fullstack-assets
vercel            # → point a domain (e.g. fullstackassets.com) at it
```

Update the CTA/links in `index.html` (currently `https://vibecoderz.app`,
`/benchmark`, and `mailto:`) if the product URL or contact changes.

## Open follow-ups (from GTM.md)
- Adopt the margin-safe `PLAN_LIMITS` (Free $0.20/day, Pro $10/mo, Max $50/mo) + ship the **top-up** flow.
- Make the **benchmark page** the public hero asset and link it everywhere.
- Confirm `DATABASE_URL` + billing on the production project before any launch push.
