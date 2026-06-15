# Conductor — UI/UX Redesign Research & Plan

_Last updated: 2026-06-15. Grounded in the actual `conductor/apps/web` UI + current best practices._

## 0. Honest assessment

The **design tokens are not the problem.** `app/globals.css` is a careful, Claude-grade
system: ivory/ink/coral palette, serif display + sans body, paper grain, soft
shadows, generous radii, a real dark mode, and well-built message typography
(headings, lists, tables, fenced code with language label + copy-on-hover). That
foundation is good.

What makes it *feel* off is **everything layered on top**: a cluttered message
meta row, panels added with one-off inline styles that ignore the token system,
a transparency story that's hidden in a side panel, a first-run screen that
under-sells the product, and almost no purposeful motion. The fix is mostly
**subtraction, consistency, and hierarchy** — not a re-skin.

Research consensus for AI/agent interfaces in 2026 converges on four pillars —
**capability transparency, confidence/trust display, graceful recovery, and
accessibility** ([Parallel](https://www.parallelhq.com/blog/ux-ai-chatbots),
[FuseLab Agent UX](https://fuselabcreative.com/ui-design-for-ai-agents/)) — and
on motion + microinteractions as *part of the system*, not garnish
([Acodez](https://acodez.in/micro-interactions-motion-design/)).

---

## 1. Principles (researched) → how they map here

### Content
- **Capability transparency before input** — users should know what the agent can
  do *before* they type ([Parallel](https://www.parallelhq.com/blog/ux-ai-chatbots)).
  Our empty state hints at it; make it explicit and tie it to the routing story.
- **Humane, specific microcopy** for empty/error/loading/cap states
  ([Eleken](https://www.eleken.co/blog-posts/empty-state-ux)). Our budget/cap and
  `simReason` messages are functional but terse.
- **Just-in-time coaching** — e.g. "Press ↑ to edit", "⌘↵ to send" surfaced after
  the first message ([Stream](https://getstream.io/blog/chat-ux/)).

### Design (visual)
- **Hierarchy through subtraction + spacing** — generous, *consistent* spacing
  groups related content and cuts cognitive load
  ([IxDF](https://ixdf.org/literature/topics/visual-hierarchy)). Our meta row does
  the opposite: ~10 competing chips.
- **One accent, used sparingly.** Coral is the brand; right now emoji (🛡 ↑ ✓ 👍 👎)
  fight the refined serif aesthetic and read as "cheap." Replace with monochrome
  icons + the single coral accent for the one thing that matters per row.
- **Tokens, everywhere.** No inline styles for layout — they drift from the system
  (see `MemoryPanel.tsx`, the benchmark CTA).

### Layout
- **Hybrid chat + structured UI** — blend the conversation with cards/controls so
  users switch between typing and clicking
  ([Gapsy](https://gapsystudio.com/blog/conversational-ui-design/)). We have the
  pieces (panel, cards) but they're stacked, not organized.
- **Progressive disclosure** — show the headline (model + cost), reveal the full
  routing rationale on demand. Don't dump every dimension inline.
- **Readable measure** — assistant text already caps line length well; keep it.

### UX
- **The transparency layer is the trust wedge** — make the agent's reasoning
  visible and give a clear path to intervene; projects that skip it lose trust in
  the first two weeks ([FuseLab](https://fuselabcreative.com/ui-design-for-ai-agents/)).
  Our routing rationale exists but is buried in a panel.
- **Streaming affordances** — render text immediately, defer code-block rendering
  to the closing fence, show a streaming indicator, expose Stop
  ([AI Chat UI](https://thefrontkit.com/blogs/ai-chat-ui-best-practices)). We have
  Stop + typing dots; tighten the rest.
- **Motion as communication** — every animation should explain *why* something
  happened (a tool step appearing, a turn escalating)
  ([Acodez](https://acodez.in/micro-interactions-motion-design/)).
- **Accessibility** — 44×44px targets, full keyboard nav, ARIA
  ([CometChat](https://www.cometchat.com/blog/chat-app-design-best-practices)). Our
  `.msg-action`/tag buttons are far under 44px.

---

## 2. Audit of the current UI

**Strong (keep):** the token system + dark mode (`globals.css`), assistant
markdown rendering + code blocks, the composer (attach + autosizing textarea +
send/stop, `Chat.tsx`), the empty-state greeting + suggestion chips, the
build-time benchmark page.

**Weak (fix), by file:**

| Area | File | Problem |
| --- | --- | --- |
| **Meta-row clutter** | `components/Message.tsx` | ~10 chips per assistant turn (model, domain, 🛡 sensitive, ↑ escalation, ✓ quality-checked, fit %, $cost, simulated, regenerate, copy, 👍/👎). No hierarchy; emoji clash with the aesthetic. |
| **Off-system panel** | `components/MemoryPanel.tsx` | Built with inline styles, not tokens/classes — visually inconsistent. |
| **Off-system CTA** | `app/benchmark/page.tsx` | Inline-styled CTA button instead of a real `.btn` class. |
| **Panel overload** | `Chat.tsx` (`<aside>`) | OrchestrationPanel + MemoryPanel + Sandbox stacked in one scroll column — no structure. |
| **Hidden transparency** | `OrchestrationPanel.tsx` | The "why this model" story (the differentiator) requires opening a panel; nothing glanceable inline. |
| **Thin first-run** | `Chat.tsx` greeting | Decent but doesn't make capability/routing legible before the first message, no just-in-time tips. |
| **Tiny targets** | `globals.css` `.msg-action`, `.tag` | Well under the 44px touch minimum; weak keyboard focus styles. |
| **Flat motion** | app-wide | Typing dots only; tool steps, escalation, and routing decisions appear without explanatory motion. |

---

## 3. Redesign plan (prioritized)

### Tier 1 — Quick wins (hours, high impact)
1. **Declutter the meta row** (`Message.tsx` + `globals.css`): show a compact
   **primary line** — routed model · cost — with a single coral accent. Move
   fit %, domain, escalation, quality-checked, sensitive into a **progressive
   "details" popover/expander** (click the model chip). Replace all emoji with
   monochrome icons (reuse `icons/`).
2. **Put `MemoryPanel` and the benchmark CTA on the design system** — swap inline
   styles for `.panel-inner`/`.card`/a new `.btn`/`.btn-primary` and the spacing
   tokens.
3. **Add a spacing scale + button primitives** to `globals.css`
   (`--space-1…6`, `.btn`, `.btn-primary`, `.btn-ghost`) and use them everywhere
   one-offs exist now. Bump `.msg-action`/`.tag` hit areas toward 44px and add a
   visible `:focus-visible` ring.
4. **Microcopy pass**: warmer, specific empty/cap/error strings; add a one-line
   "⌘↵ to send · ↑ to edit" hint under the composer after the first turn.

### Tier 2 — Structure & transparency (days)
5. **Reorganize the side panel into tabs** — *Routing · Memory · Sandbox* — instead
   of a stacked scroll (`Chat.tsx` `<aside>` + a small `Tabs` primitive). Less
   cramped, clearer mental model.
6. **Inline "why this model" affordance**: a one-line, glanceable routing summary
   under each assistant turn ("Sonnet — best fit at 1/3 the cost of Opus") that
   expands to the full dimension breakdown. Surfaces the differentiator without a
   panel trip — the trust wedge.
7. **Motion-as-communication pass**: stagger tool-step reveals, animate the
   escalation transition (cheap → premium), and a subtle routing-decision
   entrance. Keep it fast (120–200ms) and purposeful.

### Tier 3 — First-run & polish (days)
8. **Outcome-driven empty state**: a compact "what Conductor can do" capability
   row (code · research · data · vision) + a one-liner on routing with a link to
   the benchmark ("see the receipts"), above the suggestion chips.
9. **Confidence display**: render the routing fit score + escalation as a calm,
   legible confidence cue (not a raw %), consistent with the trust pillar.
10. **Accessibility sweep**: 44px targets, keyboard paths (composer ↔ messages ↔
    actions), ARIA roles/labels, reduced-motion support.

---

## 4. The single highest-leverage change

**Declutter the assistant meta row and promote one inline transparency line.**
It's a few hours, it directly removes the "cheap/cluttered" feeling, and it makes
the product's actual differentiator — *you can see which model ran and why* —
glanceable instead of buried. Everything else compounds from a calmer baseline.

---

## Sources
- [Parallel — UX for AI chatbots: trust](https://www.parallelhq.com/blog/ux-ai-chatbots)
- [FuseLab — Agent UX / UI for AI agents 2026](https://fuselabcreative.com/ui-design-for-ai-agents/)
- [FuseLab — Chatbot UI patterns 2026](https://fuselabcreative.com/chatbot-interface-design-guide/)
- [Gapsy — Conversational UI design](https://gapsystudio.com/blog/conversational-ui-design/)
- [TheFrontKit — AI chat UI best practices 2026](https://thefrontkit.com/blogs/ai-chat-ui-best-practices)
- [Stream — Chat UX best practices](https://getstream.io/blog/chat-ux/)
- [Eleken — Empty state UX](https://www.eleken.co/blog-posts/empty-state-ux)
- [IxDF — Visual hierarchy (2026)](https://ixdf.org/literature/topics/visual-hierarchy)
- [Acodez — Micro-interactions & motion 2026](https://acodez.in/micro-interactions-motion-design/)
- [CometChat — Chat app design best practices](https://www.cometchat.com/blog/chat-app-design-best-practices)
- [CHI 2026 — Sensemaking in multi-agent LLM interfaces](https://dl.acm.org/doi/10.1145/3772318.3791157)
