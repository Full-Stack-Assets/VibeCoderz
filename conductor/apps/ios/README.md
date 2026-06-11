# Conductor — iOS app

A native iOS client for **Conductor**, built with **Expo / React Native** (TypeScript).
It's a chat client for the same backend the web shell uses (`POST /api/chat`), and it
surfaces Conductor's signature feature: every turn shows **which model the COO engine
routed to and what it cost**.

> Built to run on a real iPhone via **Expo Go — no Mac or Xcode required.**

## Features

- **Streaming chat** over the backend's Server-Sent Events (`decision` → `text`/`tool` → `done`),
  parsed in `src/api.ts` with an RN-safe `XMLHttpRequest` reader (React Native's `fetch`
  can't stream a response body).
- **Routing transparency** — a pill above each reply shows the routed model + estimated
  cost; tap it for the full decision sheet (score, task domain, candidate models, budget).
- **Session cost meter** in the header, with the budget guardrail surfaced live.
- **Agentic tools toggle** — flip on sandbox / web-search / data tools; tool calls render
  as inline step cards.
- **Claude-iOS styling** — palette and type ported from the web `globals.css`, with full
  light/dark support that follows the system appearance.
- **Configurable backend** — defaults to the deployed Conductor; point it at your local
  `next dev` from the in-app Settings sheet.

## Run it

```bash
cd conductor/apps/ios
npm install            # already installed if you scaffolded here
npx expo start         # then press `i`, or scan the QR code with Expo Go on your iPhone
```

On your iPhone: install **Expo Go** from the App Store, open the camera, and scan the QR
code printed by `expo start`. The app connects to the backend set in **Settings ⚙** —
which defaults to the deployed Conductor (`https://conductor-xi.vercel.app`).

### Pointing at a local backend

If you're running the web app locally (`pnpm --filter @conductor/web dev`), set the
backend URL in **Settings** to your machine's LAN address, e.g. `http://192.168.1.20:3000`
(your phone and computer must be on the same network; `localhost` won't resolve from the
phone).

## Project layout

```
App.tsx                     Root: header, message list, composer, settings wiring
index.ts                    Expo entry (registers App)
src/
  api.ts                    streamChat() — SSE client over XMLHttpRequest
  config.ts                 Persisted settings (backend URL, tool mode) via AsyncStorage
  theme.ts                  Claude-iOS design tokens (light/dark)
  types.ts                  Wire types shared with the backend (mirrors web lib/types.ts)
  components/
    MessageBubble.tsx       User/assistant rows
    DecisionPill.tsx        Routing pill + decision detail sheet
    ToolStepView.tsx        Agentic tool-call cards
    Composer.tsx            Input bar + tools toggle + send/stop
    SettingsSheet.tsx       Backend URL + defaults
    TypingDots.tsx          In-flight indicator
```

## Notes

- This app lives at `apps/ios` but is intentionally **excluded from the pnpm workspace**
  (see `pnpm-workspace.yaml`) — Expo/Metro need a normal npm `node_modules`, not pnpm's
  hoisted/symlinked layout. Install and run it with `npm` from this directory.
- A standalone build (App Store / TestFlight) does require macOS + Xcode, or EAS Build.
  The Expo Go path above needs neither.
