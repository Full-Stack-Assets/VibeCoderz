/**
 * Rotating starter prompts for the empty-chat greeting.
 *
 * A categorized pool, re-dealt deterministically every ROTATION_MS (8h — i.e.
 * fresh 2–3× a day). Every deal leads with a "current events" prompt that
 * exercises live web research, then fills from the other categories so the
 * chips always show breadth (code / data / images / writing / reasoning).
 * Deterministic seeding (time-window index → PRNG) keeps the deal stable
 * within a window and unit-testable.
 */

export const ROTATION_MS = 8 * 60 * 60 * 1000 // rotate every 8 hours

export const SUGGESTION_POOL: Record<string, string[]> = {
  current: [
    'Search the web: what are today’s top tech headlines? Cite sources',
    'What happened in AI this week? Search the web and summarize with links',
    'Search for the latest on the EU AI Act and cite sources',
    'What are the markets doing today? Search and give me the highlights',
    'Find this week’s most important science news and explain why it matters',
    'Search the web: any major open-source releases this week?',
    'What’s the latest in the chip industry? Search and summarize',
    'Search today’s news and brief me like I just woke up from a month offline',
  ],
  code: [
    'Design a fault-tolerant job queue, then draft the README',
    'Review this function for bugs (paste your code)',
    'Write a rate limiter in TypeScript with tests',
    'Explain the tradeoffs: Postgres LISTEN/NOTIFY vs a real message queue',
    'Refactor my code to be more testable (paste it in)',
    'Sketch a schema for a multi-tenant SaaS billing system',
  ],
  data: [
    'Analyze this CSV and find the outliers',
    'Turn this messy data into a clean summary table (paste or attach)',
    'What statistical test should I use? Describe your data and goal',
    'Forecast next quarter from this time series (attach a CSV)',
  ],
  images: [
    'What’s in this screenshot? (attach an image)',
    'Read the text out of this photo and format it as Markdown',
    'Critique this UI screenshot like a design reviewer',
  ],
  writing: [
    'Draft a launch announcement for my product — ask me 3 questions first',
    'Rewrite this paragraph to be half as long (paste it in)',
    'Write a cold email that doesn’t sound like a cold email',
  ],
  reasoning: [
    'Steelman both sides: monolith vs microservices for a 5-person team',
    'Estimate: how many piano tuners work in Chicago? Show your reasoning',
    'Help me think through a hard decision — ask me about it first',
  ],
}

// mulberry32 — tiny seeded PRNG so a window index deals the same hand
// everywhere (server, client, tests) without any shared state.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The rotation window this timestamp falls in (changes every ROTATION_MS). */
export const rotationWindow = (now = Date.now()): number => Math.floor(now / ROTATION_MS)

/**
 * Deal the suggestion chips for a moment in time: a current-events prompt
 * first, then one prompt from each of `count - 1` other categories, all chosen
 * by the window-seeded PRNG. Same window → same deal; next window → new deal.
 */
export function rotatingSuggestions(now = Date.now(), count = 4): string[] {
  const rnd = mulberry32(rotationWindow(now))
  const pick = (arr: string[]) => arr[Math.floor(rnd() * arr.length)]

  const others = Object.keys(SUGGESTION_POOL).filter((c) => c !== 'current')
  // Seeded shuffle of the non-current categories, then take what we need.
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }

  const deal = [pick(SUGGESTION_POOL.current)]
  for (const cat of others.slice(0, Math.max(0, count - 1))) deal.push(pick(SUGGESTION_POOL[cat]))
  return deal
}
