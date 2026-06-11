'use client'

import { useId, useRef } from 'react'
import { useFocusTrap } from '@/lib/useFocusTrap'

export interface CatalogModel {
  id: string
  label: string
  provider: string
  type: string
  capability: number
  multimodal: boolean
  pricing: { input: number; output: number }
  blurb: string
}

const FLOORS: { value: number; label: string; hint: string }[] = [
  { value: 0, label: 'Any', hint: 'Cheapest capable model' },
  { value: 0.85, label: 'Balanced', hint: 'Skip the weakest tier' },
  { value: 0.92, label: 'High', hint: 'Strong models only' },
  { value: 0.97, label: 'Max', hint: 'Top reasoning only' },
]

// A popover for manual routing overrides: pin a specific model (or stay on
// cost-optimized Auto) and set a minimum quality floor. Both feed straight into
// the engine's `preferModel` / `qualityFloor` inputs.
export function RoutingControls({
  models,
  preferModel,
  qualityFloor,
  routedLabel,
  onChange,
  onClose,
}: {
  models: CatalogModel[]
  preferModel: string | null
  qualityFloor: number
  routedLabel?: string
  onChange: (next: { preferModel: string | null; qualityFloor: number }) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(ref, true, onClose)

  return (
    <>
      <div className="rc-scrim" onClick={onClose} />
      <div
        className="rc-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={ref}
      >
        <div className="rc-head" id={titleId}>
          Routing
        </div>

        <div className="rc-section-label">Model</div>
        <button
          className={`rc-model ${preferModel === null ? 'active' : ''}`}
          onClick={() => onChange({ preferModel: null, qualityFloor })}
        >
          <div className="rc-model-main">
            <span className="rc-model-name">Auto · cost-optimized</span>
            <span className="rc-tag auto">recommended</span>
          </div>
          <span className="rc-model-blurb">
            The COO engine picks the cheapest capable model per turn
            {routedLabel ? ` — last: ${routedLabel}` : ''}.
          </span>
        </button>

        {models.map((m) => (
          <button
            key={m.id}
            className={`rc-model ${preferModel === m.id ? 'active' : ''}`}
            onClick={() => onChange({ preferModel: m.id, qualityFloor })}
          >
            <div className="rc-model-main">
              <span className="rc-model-name">{m.label}</span>
              <span className="rc-tag">{m.type}</span>
              {m.multimodal && <span className="rc-tag vision">vision</span>}
            </div>
            <span className="rc-model-blurb">{m.blurb}</span>
            <span className="rc-model-meta">
              cap {Math.round(m.capability * 100)} · ${m.pricing.input}/${m.pricing.output} per 1M
            </span>
          </button>
        ))}

        <div className="rc-section-label">Minimum quality floor</div>
        <div className="rc-floors" role="group" aria-label="Minimum quality floor">
          {FLOORS.map((f) => (
            <button
              key={f.value}
              className={`rc-floor ${qualityFloor === f.value ? 'active' : ''}`}
              onClick={() => onChange({ preferModel, qualityFloor: f.value })}
              title={f.hint}
              aria-pressed={qualityFloor === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="rc-note">
          A floor excludes models below the bar before cost optimization — the engine still picks
          the cheapest model that clears it.
        </p>
      </div>
    </>
  )
}
