import { test } from 'node:test'
import assert from 'node:assert/strict'

// Read an SSE Response body fully and return a map of event name → last data
// payload seen for that event (enough to assert the terminal `done` frame).
async function readSSE(res: Response): Promise<Record<string, Record<string, unknown>>> {
  const text = await res.text()
  const out: Record<string, Record<string, unknown>> = {}
  for (const block of text.split('\n\n')) {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (data) {
      try {
        out[event] = JSON.parse(data)
      } catch {
        /* ignore a malformed frame */
      }
    }
  }
  return out
}

test('anonymous trial: bounded turns stream with the anon flag, then the wall (402)', async () => {
  process.env.CONDUCTOR_TRIAL = 'on'
  process.env.CONDUCTOR_TRIAL_TURNS = '2'
  const { _resetRateLimit } = await import('../lib/server/ratelimit.ts')
  _resetRateLimit()
  const { POST } = await import('../app/api/chat/route.ts')

  const call = () =>
    POST(
      new Request('https://x/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      })
    )

  // First allowed turn: streamed, flagged anonymous, one trial turn left.
  const r1 = await call()
  assert.equal(r1.status, 200)
  const e1 = await readSSE(r1)
  assert.equal(e1.done?.anon, true, 'done event is flagged anonymous')
  assert.equal(e1.done?.trialRemaining, 1)
  assert.equal(e1.done?.spentUSD, 0, 'anonymous turns are not metered to an account')

  // Second (last) allowed turn: zero remaining.
  const e2 = await readSSE(await call())
  assert.equal(e2.done?.trialRemaining, 0)

  // Third turn is walled with a 402 the client turns into the signup prompt.
  const r3 = await call()
  assert.equal(r3.status, 402)
  assert.equal((await r3.json()).trialExhausted, true)
})
