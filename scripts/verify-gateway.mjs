// Smoke test for the Vercel AI Gateway integration.
//
// Mirrors the app's provider config (see ai/gateway.ts) and makes one tiny
// generateText call against the default model. Use this to confirm that a
// session's network policy actually allows ai-gateway.vercel.sh and that
// AI_GATEWAY_API_KEY is valid.
//
// Run:  node scripts/verify-gateway.mjs
//
// Expected outcomes:
//   - "OK" + a short reply  -> allowlist + auth both working.
//   - "Host not in allowlist" / network error -> session is NOT on a policy
//     that permits ai-gateway.vercel.sh (start a fresh session under the
//     Custom environment with ai-gateway.vercel.sh in Allowed domains).
//   - 401/403 from Vercel    -> host reachable but AI_GATEWAY_API_KEY invalid.

import { createGatewayProvider } from '@ai-sdk/gateway'
import { generateText } from 'ai'

const MODEL = process.env.GATEWAY_TEST_MODEL ?? 'anthropic/claude-opus-4.6'

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error('FAIL: AI_GATEWAY_API_KEY is not set in this environment.')
  process.exit(1)
}

const gateway = createGatewayProvider({
  baseURL: process.env.AI_GATEWAY_BASE_URL,
  headers: {
    'http-referer': 'https://oss-vibe-coding-platform.vercel.app/',
    'x-title': 'Vibe Coding Platform',
  },
})

console.log(
  `Testing gateway -> ${process.env.AI_GATEWAY_BASE_URL ?? 'ai-gateway.vercel.sh (default)'} with model ${MODEL} ...`
)

try {
  const { text, usage } = await generateText({
    model: gateway(MODEL),
    prompt: 'Reply with exactly: gateway ok',
  })
  console.log('OK: gateway reachable and authenticated.')
  console.log('  reply:', JSON.stringify(text.trim()))
  console.log('  usage:', JSON.stringify(usage))
  process.exit(0)
} catch (err) {
  console.error('FAIL: request did not succeed.')
  console.error('  message:', err?.message ?? String(err))
  if (err?.responseBody) console.error('  body:', err.responseBody)
  if (err?.statusCode) console.error('  status:', err.statusCode)
  process.exit(1)
}
