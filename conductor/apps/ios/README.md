# Conductor — iOS app

A native iOS client for **Conductor**, built with **Expo / React Native** (TypeScript).
It's a chat client for the same backend the web shell uses (`POST /api/chat`), and it
surfaces Conductor's signature feature: every turn shows **which model the COO engine
routed to and what it cost**.

> Built to run on a real iPhone via **Expo Go — no Mac or Xcode required.**

## Features

- **Sign in / sign up** — a passwordless **magic-code** flow (welcome → email → 6-digit
  code), then **plan selection** (Free / Pro / Max) for new accounts. Session + accounts
  persist on-device. See _Auth_ below for the demo vs. real-backend boundary.
- **Streaming chat** over the backend's Server-Sent Events (`decision` → `text`/`tool` → `done`),
  parsed in `src/api.ts` with an RN-safe `XMLHttpRequest` reader (React Native's `fetch`
  can't stream a response body).
- **Image attachments** — attach up to 4 photos per message (downscaled + base64); they're
  sent to vision-capable models and rendered in the conversation.
- **Persistent memory** — the conversation is saved continuously per account and **survives
  an unfinished turn**: close, background, or crash mid-stream and the partial reply +
  history reload on next launch (marked as interrupted). See `src/storage.ts`.
- **Routing transparency** — a pill above each reply shows the routed model + estimated
  cost; tap it for the full decision sheet (score, task domain, candidate models, budget).
- **Session cost meter** in the header, with the budget guardrail surfaced live.
- **Agentic tools toggle** — flip on sandbox / web-search / data tools; tool calls render
  as inline step cards.
- **Crash-resistant** — a top-level `ErrorBoundary` turns any render error into a
  recoverable screen (memory is preserved), and image-pick / storage / network failures are
  caught and surfaced as friendly messages rather than crashes.
- **Account management** — view your plan, switch plans, start a new chat, or sign out from
  Settings.
- **Claude-iOS styling** — palette and type ported from the web `globals.css`, with full
  light/dark support that follows the system appearance.
- **Configurable backend** — defaults to the deployed Conductor; point it at your local
  `next dev` from the in-app Settings sheet.

## Auth (demo vs. real)

The Conductor backend ships no auth and this repo has no mail server, so sign-in is a
**self-contained demo**: the magic code is shown in-app (clearly labelled “Demo mode”)
instead of emailed, and accounts/sessions live in `AsyncStorage`. Everything goes through
the `AuthProvider` interface in `src/auth.ts`, so going live is a **one-file change** —
implement `AuthProvider` against a real backend (Supabase / Clerk / a custom `/api/auth`)
and stop returning `devCode`. The screens, context (`src/context/AuthContext.tsx`), and
gating in `App.tsx` don't change. Pricing is display-only; wire StoreKit/RevenueCat for
real billing.

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
App.tsx                     Root: auth gate → splash / auth flow / onboarding / chat
index.ts                    Expo entry (registers App)
src/
  api.ts                    streamChat() — SSE client over XMLHttpRequest
  auth.ts                   AuthProvider interface + local demo provider + plans
  config.ts                 Persisted settings (backend URL, tool mode) via AsyncStorage
  imagePicker.ts            Crash-safe image picking → base64 Attachments
  storage.ts                Per-user conversation memory (survives unfinished turns)
  theme.ts                  Claude-iOS design tokens (light/dark)
  types.ts                  Wire types shared with the backend (mirrors web lib/types.ts)
  context/
    AuthContext.tsx         Auth state + actions
  screens/
    AuthFlow.tsx            Welcome → email → magic-code
    PricingScreen.tsx       Plan selection (onboarding + manage)
  components/
    MessageBubble.tsx       User/assistant rows (+ image attachments)
    DecisionPill.tsx        Routing pill + decision detail sheet
    ToolStepView.tsx        Agentic tool-call cards
    Composer.tsx            Input bar + attach + tools toggle + send/stop
    SettingsSheet.tsx       Account, plan, backend URL, new chat, sign out
    ErrorBoundary.tsx       Top-level crash guard
    TypingDots.tsx          In-flight indicator
```

## Notes

- This app lives at `apps/ios` but is intentionally **excluded from the pnpm workspace**
  (see `pnpm-workspace.yaml`) — Expo/Metro need a normal npm `node_modules`, not pnpm's
  hoisted/symlinked layout. Install and run it with `npm` from this directory.
- A standalone build (App Store / TestFlight) does require macOS + Xcode, or EAS Build.
  The Expo Go path above needs neither.
