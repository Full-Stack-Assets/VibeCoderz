'use client'

import { useRef, useState } from 'react'
import { PLANS, TOPUP_PACKS, type PlanId } from '@/lib/auth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useAuth } from './AuthContext'
import { AutoRechargeControl } from './AutoRechargeControl'

export function Pricing({
  mode,
  onClose,
  onDone,
}: {
  mode: 'onboarding' | 'manage'
  onClose?: () => void
  onDone?: () => void
}) {
  const { user, billing, startCheckout, openPortal, startTopup } = useAuth()
  const currentPlan: PlanId = user?.plan ?? 'free'
  const hasSubscription = !!user?.subscriptionStatus && user.subscriptionStatus !== 'canceled'

  const [selected, setSelected] = useState<PlanId>(currentPlan)
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [busy, setBusy] = useState(false)
  const [toppingUp, setToppingUp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buyTopup = async (packId: string) => {
    if (toppingUp) return
    setError(null)
    setToppingUp(packId)
    try {
      window.location.href = await startTopup(packId)
    } catch (e) {
      setError((e as Error).message)
      setToppingUp(null)
    }
  }
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, mode === 'manage', onClose)

  const planEnabled = (id: PlanId) => id === 'free' || (billing.enabled && billing.plans[id as 'pro' | 'max'])

  const confirm = async () => {
    setError(null)
    if (selected === currentPlan) {
      onDone?.()
      onClose?.()
      return
    }
    if (selected === 'free') {
      // Downgrade: send paying users to the portal to cancel; others are done.
      if (hasSubscription) {
        setBusy(true)
        try {
          window.location.href = await openPortal()
        } catch (e) {
          setError((e as Error).message)
          setBusy(false)
        }
      } else {
        onDone?.()
        onClose?.()
      }
      return
    }
    // Paid plan → Stripe Checkout.
    if (!planEnabled(selected)) {
      setError('Billing isn’t configured for this plan yet. Set the Stripe keys to enable it.')
      return
    }
    setBusy(true)
    try {
      window.location.href = await startCheckout(selected, cycle)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const selectedName = PLANS.find((p) => p.id === selected)?.name
  const cta =
    selected === currentPlan
      ? mode === 'onboarding'
        ? `Continue with ${selectedName}`
        : 'Keep current plan'
      : selected === 'free'
        ? hasSubscription
          ? 'Cancel subscription'
          : 'Switch to Free'
        : `Subscribe to ${selectedName}`

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
            : 'Switch anytime. Paid plans are billed securely through Stripe.'}
        </p>

        {!billing.enabled && (
          <p className="pricing-notice">
            Live billing isn’t configured in this environment yet — Free works fully; paid plans need
            the Stripe keys set.
          </p>
        )}

        <div className="billing-cycle" role="group" aria-label="Billing cycle">
          <button
            type="button"
            className={`cycle-opt ${cycle === 'monthly' ? 'active' : ''}`}
            aria-pressed={cycle === 'monthly'}
            onClick={() => setCycle('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`cycle-opt ${cycle === 'annual' ? 'active' : ''}`}
            aria-pressed={cycle === 'annual'}
            onClick={() => setCycle('annual')}
          >
            Annual <span className="cycle-save">2 months free</span>
          </button>
        </div>

        <div className="pricing-grid">
          {PLANS.map((plan) => {
            const active = selected === plan.id
            const isCurrent = currentPlan === plan.id
            const annual = cycle === 'annual' && plan.annual
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
                  {annual ? `${annual.perMonth}` : plan.price}
                  <span className="plan-period"> {annual ? '/mo' : plan.period}</span>
                </div>
                {annual && <p className="plan-annual-note">{annual.price} billed yearly</p>}
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

        {mode === 'manage' && billing.enabled && (
          <div className="topup-section">
            <div className="topup-section-head">
              <span className="topup-section-title">Add routing credit</span>
              <span className="topup-section-bal">
                Balance: <strong>${(user?.topupUSD ?? 0).toFixed(2)}</strong>
              </span>
            </div>
            <p className="topup-section-sub">
              Pay-as-you-go credit for when you outpace your plan’s budget. It rolls over and never expires.
            </p>
            <div className="topup-section-packs">
              {TOPUP_PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="topup-buy"
                  disabled={!!toppingUp}
                  onClick={() => buyTopup(p.id)}
                >
                  <span className="topup-buy-price">${p.priceUSD}</span>
                  <span className="topup-buy-credit">
                    {toppingUp === p.id ? 'Redirecting…' : `$${p.creditUSD} credit`}
                  </span>
                </button>
              ))}
            </div>
            <AutoRechargeControl />
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        <div className="pricing-actions">
          <button className="auth-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Redirecting…' : cta}
          </button>
          {mode === 'manage' && hasSubscription && selected === currentPlan && (
            <button
              className="auth-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  window.location.href = await openPortal()
                } catch (e) {
                  setError((e as Error).message)
                  setBusy(false)
                }
              }}
            >
              Manage billing in Stripe
            </button>
          )}
          {mode === 'manage' && onClose && (
            <button className="auth-back" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
