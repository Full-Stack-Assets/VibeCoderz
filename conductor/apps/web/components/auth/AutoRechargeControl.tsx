'use client'

import { useEffect, useState } from 'react'
import { TOPUP_PACKS } from '@/lib/auth'

interface Settings {
  enabled: boolean
  thresholdUSD: number
  packId: string | null
}

/**
 * Auto-recharge opt-in (off-session top-ups). Renders only when the server has
 * the feature switched on (CONDUCTOR_AUTORECHARGE=on); it's a no-op otherwise,
 * so it stays hidden until the flow is validated against Stripe.
 */
export function AutoRechargeControl() {
  const [available, setAvailable] = useState(false)
  const [s, setS] = useState<Settings>({ enabled: false, thresholdUSD: 2, packId: TOPUP_PACKS[0]?.id ?? null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/auto-recharge')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setAvailable(!!d.available)
        if (d.settings) {
          setS({
            enabled: d.settings.enabled,
            thresholdUSD: d.settings.thresholdUSD || 2,
            packId: d.settings.packId || TOPUP_PACKS[0]?.id || null,
          })
        }
      })
      .catch(() => {})
  }, [])

  if (!available) return null

  const save = async (next: Settings) => {
    setBusy(true)
    setError(null)
    setS(next) // optimistic
    try {
      const res = await fetch('/api/billing/auto-recharge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error || 'Could not save.')
        setS((prev) => ({ ...prev, enabled: false })) // revert the toggle on failure
      }
    } catch {
      setError('Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="autorecharge">
      <label className="autorecharge-row">
        <input
          type="checkbox"
          checked={s.enabled}
          disabled={busy}
          onChange={(e) => save({ ...s, enabled: e.target.checked })}
        />
        <span>Auto-recharge when my credit runs low</span>
      </label>
      {s.enabled && (
        <div className="autorecharge-cfg">
          <label>
            Below{' '}
            <select value={s.thresholdUSD} disabled={busy} onChange={(e) => save({ ...s, thresholdUSD: Number(e.target.value) })}>
              {[1, 2, 5, 10].map((v) => (
                <option key={v} value={v}>
                  ${v}
                </option>
              ))}
            </select>{' '}
            buy{' '}
            <select value={s.packId ?? ''} disabled={busy} onChange={(e) => save({ ...s, packId: e.target.value })}>
              {TOPUP_PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  ${p.priceUSD} → ${p.creditUSD}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
