'use client'

import { useRef, useState } from 'react'
import { PLANS, type PlanId } from '@/lib/auth'
import { useFocusTrap } from '@/lib/useFocusTrap'

export function Pricing({
  mode,
  currentPlan,
  onChoose,
  onClose,
}: {
  mode: 'onboarding' | 'manage'
  currentPlan?: PlanId
  onChoose: (plan: PlanId) => Promise<void> | void
  onClose?: () => void
}) {
  const [selected, setSelected] = useState<PlanId>(currentPlan ?? 'free')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Trap focus only when shown as a modal overlay (manage); onboarding is a page.
  useFocusTrap(ref, mode === 'manage', onClose)

  const confirm = async () => {
    setBusy(true)
    try {
      await onChoose(selected)
    } finally {
      setBusy(false)
    }
  }

  const selectedName = PLANS.find((p) => p.id === selected)?.name
  const cta =
    mode === 'onboarding'
      ? selected === 'free'
        ? 'Start with Free'
        : `Continue with ${selectedName}`
      : currentPlan === selected
        ? 'Keep current plan'
        : `Switch to ${selectedName}`

  return (
    <div
      className={mode === 'manage' ? 'pricing pricing-modal' : 'pricing'}
      ref={ref}
      tabIndex={mode === 'manage' ? -1 : undefined}
      role={mode === 'manage' ? 'dialog' : undefined}
      aria-modal={mode === 'manage' ? true : undefined}
      aria-label={mode === 'manage' ? 'Manage plan' : undefined}
    >
      <div className="pricing-inner">
        <h1 className="pricing-title">{mode === 'onboarding' ? 'Choose your plan' : 'Your plan'}</h1>
        <p className="pricing-sub">
          {mode === 'onboarding'
            ? 'Start free — upgrade anytime. The router keeps every plan cost-efficient.'
            : 'Switch anytime. Changes apply to your routing budget immediately.'}
        </p>

        <div className="pricing-grid">
          {PLANS.map((plan) => {
            const active = selected === plan.id
            const isCurrent = currentPlan === plan.id
            return (
              <button
                key={plan.id}
                className={`plan-card ${active ? 'active' : ''}`}
                onClick={() => setSelected(plan.id)}
                type="button"
              >
                <div className="plan-head">
                  <span className="plan-name">{plan.name}</span>
                  {plan.highlight && <span className="plan-badge">Popular</span>}
                  {isCurrent && <span className="plan-badge current">Current</span>}
                </div>
                <div className="plan-price">
                  {plan.price}
                  <span className="plan-period"> {plan.period}</span>
                </div>
                <p className="plan-tagline">{plan.tagline}</p>
                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="plan-check">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <div className="pricing-actions">
          <button className="auth-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Saving…' : cta}
          </button>
          {mode === 'manage' && onClose && (
            <button className="auth-back" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <p className="auth-fine">Demo pricing — no charge is made. Wire to Stripe for real billing.</p>
      </div>
    </div>
  )
}
