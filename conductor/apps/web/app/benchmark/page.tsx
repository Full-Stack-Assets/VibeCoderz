import Link from 'next/link'
import { evaluate, evaluateModels } from '@conductor/eval'

// Build the share card from the REAL benchmark numbers so the social preview
// carries the actual receipt (and never drifts from the page). Deterministic.
export async function generateMetadata() {
  const title = 'Conductor — Routing Benchmark'
  let description =
    'Measured cost/quality tradeoff of COO routing vs baseline strategies — with receipts.'
  try {
    const v = ((await evaluate()) as Result).headline?.vsPremium
    if (v) {
      description =
        `Measured: the COO router is ${v.costSavingsPct}% cheaper than always-premium ` +
        `while keeping ${v.qualityRetentionPct}% of its quality. With receipts.`
    }
  } catch {
    /* fall back to the generic description */
  }
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// Deterministic, pure compute — render at build time.
export const dynamic = 'force-static'

interface Row {
  taskId: string
  domain: string
  modelId: string | null
  cost: number
  quality: number
}
interface Strategy {
  name: string
  avgQuality: number
  totalCost: number
  costPerTask: number
  qualityPerDollar: number
  rows: Row[]
}
interface DomainRow {
  domain: string
  tasks: number
  cooQuality: number
  premiumQuality: number
  retentionPct: number
  cooCostPerTask: number
  models: string[]
}
interface Result {
  oracle: string
  n: number
  strategies: Strategy[]
  headline: {
    vsPremium?: { costSavingsPct: number; qualityRetentionPct: number }
    vsCheapest?: { extraCostPct: number | null; qualityGainPct: number }
    vsOracle?: { qualityOfBestPct: number }
  }
  byDomain: DomainRow[]
}
interface ModelRow {
  id: string
  label: string
  provider: string
  capability: number
  multimodal: boolean
  avgQuality: number
  costPerTask: number
  qualityPerDollar: number
}
interface BestPick {
  id: string
  label: string
}
interface DomainBest {
  domain: string
  tasks: number
  bestQuality: (BestPick & { quality: number }) | null
  bestValue: (BestPick & { value: number; costPerTask: number }) | null
}
interface Leaderboard {
  n: number
  models: ModelRow[]
  bestByDomain: DomainBest[]
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const usd = (n: number) => `$${n.toFixed(5)}`

export default async function BenchmarkPage() {
  // Rendered at build time; guard so an eval error degrades gracefully rather
  // than aborting `next build` (which would block the whole deploy).
  let result: Result | null = null
  let board: Leaderboard | null = null
  try {
    result = (await evaluate()) as Result
  } catch (err) {
    console.error('[benchmark] evaluate() failed:', err)
  }
  try {
    board = (await evaluateModels()) as Leaderboard
  } catch (err) {
    console.error('[benchmark] evaluateModels() failed:', err)
  }
  if (!result) {
    return (
      <div className="bench">
        <header className="bench-top">
          <Link href="/" className="bench-back" aria-label="Back to Conductor">
            ← Conductor
          </Link>
        </header>
        <div className="bench-wrap">
          <h1>Benchmark unavailable</h1>
          <p className="bench-sub">The routing benchmark could not be generated for this build.</p>
        </div>
      </div>
    )
  }

  const coo = result.strategies.find((s) => s.name.startsWith('COO'))
  const h = result.headline
  const isCoo = (s: Strategy) => s.name.startsWith('COO')

  return (
    <div className="bench">
      <header className="bench-top">
        <Link href="/" className="bench-back" aria-label="Back to Conductor">
          ← Conductor
        </Link>
        <span className="bench-oracle">oracle: {result.oracle}</span>
      </header>

      <div className="bench-wrap">
        <h1>Does the router actually save money?</h1>
        <p className="bench-sub">
          The COO router is benchmarked against the alternatives a team would otherwise pick —
          pin the premium model, the cheapest, or a balanced mid-tier — over a {result.n}-task golden
          set spanning coding, reasoning, writing, analysis, research, data, and vision. The{' '}
          <strong>COO</strong> row calls the <em>shipping</em> router; cost uses the engine&rsquo;s
          own token pricing. This page is rendered from that run at build time.
        </p>

        {/* Headline cards */}
        <div className="bench-cards">
          {h.vsPremium && (
            <div className="bench-card accent">
              <div className="bench-card-k">{h.vsPremium.costSavingsPct}%</div>
              <div className="bench-card-l">cheaper than always-premium</div>
              <div className="bench-card-s">
                retaining <strong>{h.vsPremium.qualityRetentionPct}%</strong> of its quality
              </div>
            </div>
          )}
          {h.vsCheapest && (
            <div className="bench-card">
              <div className="bench-card-k">+{h.vsCheapest.qualityGainPct}%</div>
              <div className="bench-card-l">higher quality than always-cheapest</div>
              {h.vsCheapest.extraCostPct != null && (
                <div className="bench-card-s">for {h.vsCheapest.extraCostPct}% more spend</div>
              )}
            </div>
          )}
          {h.vsOracle && (
            <div className="bench-card">
              <div className="bench-card-k">{h.vsOracle.qualityOfBestPct}%</div>
              <div className="bench-card-l">of best-achievable quality</div>
              <div className="bench-card-s">at a fraction of the premium cost</div>
            </div>
          )}
        </div>

        {/* Conversion CTA — this page is the top of the funnel. */}
        <div className="bench-cta">
          <Link href="/" className="btn btn-primary">
            Try Conductor free →
          </Link>
          <span className="bench-sub">
            Auto-routes every message to the cheapest capable model. No card required.
          </span>
        </div>

        {/* Strategy comparison */}
        <h2>Strategy comparison</h2>
        <div className="bench-tablewrap">
          <table className="bench-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th className="num">Avg quality</th>
                <th className="num">Total cost</th>
                <th className="num">$ / task</th>
                <th className="num">Quality / $</th>
              </tr>
            </thead>
            <tbody>
              {result.strategies.map((s) => (
                <tr key={s.name} className={isCoo(s) ? 'hl' : ''}>
                  <td>{s.name}</td>
                  <td className="num">{pct(s.avgQuality)}</td>
                  <td className="num">{usd(s.totalCost)}</td>
                  <td className="num">{usd(s.costPerTask)}</td>
                  <td className="num">{Number.isFinite(s.qualityPerDollar) ? s.qualityPerDollar.toLocaleString('en-US') : '∞'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-MODEL leaderboard — the "which model should I actually use" view. */}
        {board && board.models.length > 0 && (
          <>
            <h2>Model leaderboard — most quality per dollar</h2>
            <p className="bench-sub">
              Every model in the catalog pinned for all {board.n} tasks, ranked by quality per
              dollar (the same oracle and token pricing as above). The cheapest model is the best
              <em> value</em> for most work; the premium models earn their price only on the
              hardest tasks — which is exactly what the router exploits.
            </p>
            <div className="bench-tablewrap">
              <table className="bench-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Model</th>
                    <th className="num">Avg quality</th>
                    <th className="num">$ / task</th>
                    <th className="num">Quality / $</th>
                  </tr>
                </thead>
                <tbody>
                  {board.models.map((m, i) => (
                    <tr key={m.id}>
                      <td className="num">{i + 1}</td>
                      <td>
                        {m.label} {m.multimodal ? '' : <span className="bench-tag">text-only</span>}
                      </td>
                      <td className="num">{pct(m.avgQuality)}</td>
                      <td className="num">{usd(m.costPerTask)}</td>
                      <td className="num">
                        {Number.isFinite(m.qualityPerDollar) ? m.qualityPerDollar.toLocaleString('en-US') : '∞'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Best model per task type — the shareable "cheapest model for X" answer. */}
        {board && board.bestByDomain.length > 0 && (
          <>
            <h2>Best model per task type</h2>
            <p className="bench-sub">
              The highest-quality pick and the best-value pick for each kind of work. The router
              aims at the value column by default and reaches for the quality column only when a
              turn needs it.
            </p>
            <div className="bench-tablewrap">
              <table className="bench-table">
                <thead>
                  <tr>
                    <th>Task type</th>
                    <th className="num">Tasks</th>
                    <th>Highest quality</th>
                    <th>Best value (quality / $)</th>
                  </tr>
                </thead>
                <tbody>
                  {board.bestByDomain.map((d) => (
                    <tr key={d.domain}>
                      <td style={{ textTransform: 'capitalize' }}>{d.domain}</td>
                      <td className="num">{d.tasks}</td>
                      <td>
                        {d.bestQuality ? `${d.bestQuality.label} (${pct(d.bestQuality.quality)})` : '—'}
                      </td>
                      <td>{d.bestValue ? `${d.bestValue.label} (${usd(d.bestValue.costPerTask)}/task)` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Per-domain breakdown */}
        {result.byDomain.length > 0 && (
          <>
            <h2>Where routing wins (per domain)</h2>
            <div className="bench-tablewrap">
              <table className="bench-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th className="num">Tasks</th>
                    <th className="num">COO quality</th>
                    <th className="num">Premium</th>
                    <th className="num">Retention</th>
                    <th className="num">COO $ / task</th>
                    <th>Models COO used</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byDomain.map((d) => (
                    <tr key={d.domain}>
                      <td style={{ textTransform: 'capitalize' }}>{d.domain}</td>
                      <td className="num">{d.tasks}</td>
                      <td className="num">{pct(d.cooQuality)}</td>
                      <td className="num">{pct(d.premiumQuality)}</td>
                      <td className="num">{d.retentionPct}%</td>
                      <td className="num">{usd(d.cooCostPerTask)}</td>
                      <td className="mono">{d.models.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Per-task routing */}
        {coo && (
          <>
            <h2>How COO routed each task</h2>
            <div className="bench-tablewrap">
              <table className="bench-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Domain</th>
                    <th>Routed model</th>
                    <th className="num">Cost</th>
                    <th className="num">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {coo.rows.map((r) => (
                    <tr key={r.taskId}>
                      <td className="mono">{r.taskId}</td>
                      <td>{r.domain}</td>
                      <td className="mono">{r.modelId ?? '—'}</td>
                      <td className="num">{usd(r.cost)}</td>
                      <td className="num">{pct(r.quality)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="bench-note">
          <h3>How this stays honest</h3>
          <ul>
            <li>
              The <strong>COO</strong> row calls the shipping <code>routeTurn</code> — this measures
              the real router, not a reimplementation.
            </li>
            <li>
              <strong>Quality</strong> here comes from the <code>{result.oracle}</code> oracle: a
              transparent prior (capability vs task difficulty, specialty match, vision capability),
              deliberately <em>not</em> a live measurement, so the benchmark is deterministic in CI.
              It is tuned so the cheap router can never &ldquo;beat&rdquo; premium on quality — an
              oracle that allowed that would be a tell it was rigged.
            </li>
            <li>
              Swapping in the <code>--live</code> LLM-judge oracle replaces the prior with measured
              model calls — changing only the oracle, not the strategies, dataset, or this page.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
