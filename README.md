# Vibe Coding Platform

An end-to-end coding platform where users enter text prompts and an AI agent generates full-stack applications in a sandboxed environment with live preview, file explorer, and command logs.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=A+full-stack+coding+platform+built+with+Vercel%27s+AI+Cloud%2C+AI+SDK%2C+and+Next.js.&demo-image=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Fv1754588832%2FOSSvibecodingplatform%2Fscreenshot.png&demo-title=Vibe+Coding+Platform&demo-url=https%3A%2F%2Fvercel.fyi%2Fvibes&project-name=Vibe+Coding+Platform&repository-name=vibe-coding-platform&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fexamples%2Ftree%2Fmain%2Fapps%2Fvibe-coding-platform&from=vibe-coding-platform-app)

## Features

- Multi-model support via AI Gateway (Claude, GPT, Grok)
- Secure code execution with Vercel Sandbox
- Real-time live preview of generated apps
- File explorer for browsing project files
- Command logs and error monitoring
- One-click deploy to Vercel

## Tech Stack

- [Next.js](https://nextjs.org) with Turbopack
- [AI SDK](https://ai-sdk.dev) v6
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)

## Getting Started

### Run Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supported Models

- Claude Opus 4.6
- Claude Sonnet 4.6
- GPT-5.3 Codex
- Grok 4.1 Reasoning

## Deploy

The platform deploys to Vercel via Git integration — preview per PR, production
on merge to `main`. It builds and boots with **zero credentials** (anonymous,
unmetered mode) and switches on auth, billing, live models, and real sandboxes
as their environment variables appear.

See **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for the full deployment design:
topology, environments, the database/migration strategy, the secrets matrix,
CI/CD, health checks, security hardening, and the release runbook.

Quick paths:

- **One-click:** the *Deploy with Vercel* button above.
- **Dashboard:** import the repo as a Vercel project (Root Directory = repo
  root; Next.js auto-detected) and set environment variables per
  `docs/DEPLOYMENT.md` §5.
- **Health check:** `GET /api/health` reports DB connectivity and which
  subsystems are configured — use it for uptime monitoring and post-deploy
  smoke tests.
