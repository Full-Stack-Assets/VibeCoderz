import Link from 'next/link'
import { evaluate } from '@conductor/eval'

export const metadata = {
  title: 'Conductor — Routing Benchmark',
  description: 'Measured cost/quality tradeoff of COO routing vs baseline strategies.',
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
interface Result {
  oracle: string
  n: number
  strategies: Strategy[]
  headline: {
    vsPremium?: { costSavingsPct: number; qualityRetentionPct: number }
    vsCheapest?: { extraCostPct: number | null; qualityGainPct: number }
    vsOracle?: { qualityOfBestPct: number }
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const usd = (n: number) => `$${n.toFixed(5)}`

export default async function BenchmarkPage() {
  const result = (await evaluate()) as Result
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
                  <td className="num">{Number.isFinite(s.qualityPerDollar) ? s.qualityPerDollar.toLocaleString() : '∞'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
