'use client'

import { Burst } from './Burst'
import type { RouteDecision } from '@/lib/types'

const DIM_LABEL: Record<string, string> = {
  type: 'Type match',
  cost: 'Cost efficiency',
  latency: 'Latency',
  load: 'Load',
  budget: 'Budget headroom',
}

interface AuditItem {
  time: string
  modelLabel: string
  type: string
  score: number
  reason: string
}

export function OrchestrationPanel({
  decision,
  audit,
}: {
  decision: RouteDecision | null
  audit: AuditItem[]
}) {
  if (!decision) {
    return (
      <div className="panel-inner">
        <h2>Orchestration</h2>
        <p className="sub">Constraint-optimized routing, live.</p>
        <div className="empty-panel">
          Send a message and the COO engine will route it here — showing which model
          it chose, the fitness score, and why.
        </div>
      </div>
    )
  }

  const m = decision.model
  const dims = decision.dims
  const weights = decision.weights
  const util = decision.budget.utilization * 100
  const budgetClass = util > 85 ? 'crit' : util > 60 ? 'warn' : ''

  return (
    <div className="panel-inner">
      <h2>Orchestration</h2>
      <p className="sub">Why this turn was routed the way it was.</p>

      {/* Routed model */}
      <div className="card">
        <div className="card-h">
          <span>Routed model</span>
          {decision.overridden ? <span>manual</span> : <span>optimal</span>}
        </div>
        {m && (
          <div className="routed-model">
            <div className="swatch">
              <Burst size={18} />
            </div>
            <div className="meta">
              <div className="label">{m.label}</div>
              <div className="blurb">{m.blurb || m.type}</div>
            </div>
          </div>
        )}
        <div className="score-ring">
          <div className="ring" style={{ ['--p' as string]: decision.score * 100 }}>
            <div className="inner">{(decision.score * 100).toFixed(0)}</div>
          </div>
          <div className="score-label">
            Fitness score across 5 weighted constraint dimensions.
            {decision.fallback && ' Cross-type fallback was used.'}
          </div>
        </div>
      </div>

      {/* Per-dimension breakdown */}
      {dims && weights && (
        <div className="card">
          <div className="card-h">
            <span>Fitness breakdown</span>
            <span>contribution</span>
          </div>
          <div className="dimbars">
            {(['type', 'cost', 'latency', 'load', 'budget'] as const).map((k) => {
              const contribution = dims[k]
              const max = weights[k] || 1
              const pct = Math.max(0, Math.min(100, (contribution / max) * 100))
              return (
                <div className="dimbar" key={k}>
                  <div className="dim-h">
                    <span>{DIM_LABEL[k]}</span>
                    <span>
                      {(contribution * 100).toFixed(0)} / {(max * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="track">
                    <div className={`fill ${k}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Classification */}
      <div className="card">
        <div className="card-h">
          <span>Turn classification</span>
        </div>
        <div className="chips-row">
          <span className="metachip">type · {decision.classification.type}</span>
          <span className="metachip">
            complexity · {decision.classification.complexity.toFixed(2)}
          </span>
          <span className="metachip">
            quality bar · {decision.classification.minQuality.toFixed(2)}
          </span>
          <span className="metachip">est · ${decision.estCostUSD.toFixed(5)}</span>
        </div>
      </div>

      {/* Budget */}
      <div className="card">
        <div className="card-h">
          <span>Session budget</span>
          <span>{util.toFixed(1)}%</span>
        </div>
        <div className="budget-bar">
          <div className={`fill ${budgetClass}`} style={{ width: `${Math.min(100, util)}%` }} />
        </div>
        <div className="budget-row">
          <span>${decision.budget.spentUSD.toFixed(5)} spent</span>
          <span>${decision.budget.budgetUSD.toFixed(2)} cap · throttle at 85%</span>
        </div>
      </div>

      {/* Audit trail */}
      <div className="card">
        <div className="card-h">
          <span>Routing log</span>
        </div>
        <div className="audit">
          {audit
            .slice()
            .reverse()
            .map((a, i) => (
              <div className="entry" key={i}>
                <span className="t">{a.time}</span>
                <strong>{a.modelLabel}</strong> · {a.type} · fit {(a.score * 100).toFixed(0)}%
                <div style={{ color: 'var(--muted)' }}>{a.reason}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
