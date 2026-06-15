'use client'

import { useEffect, useState } from 'react'
import { getSponsors } from '@/lib/sponsors'
import { useAuth } from './auth/AuthContext'

/**
 * A single clearly-labeled sponsored card for the empty state. Free-tier only
 * (paying users never see ads), never in the answer stream, and a no-op until
 * sponsors are configured. Renders after mount to avoid SSR hydration mismatch
 * and rotates the slot per page load.
 */
export function SponsoredSlot() {
  const { user } = useAuth()
  const [idx, setIdx] = useState<number | null>(null)
  const sponsors = getSponsors()

  useEffect(() => {
    if (sponsors.length) setIdx(Math.floor(Math.random() * sponsors.length))
  }, [sponsors.length])

  // Paid users (and signed-out / no config) see nothing.
  if (idx === null || !sponsors.length || (user && user.plan !== 'free')) return null
  const s = sponsors[idx % sponsors.length]

  return (
    <a className="sponsored" href={s.url} target="_blank" rel="sponsored noopener noreferrer">
      <span className="sponsored-tag">Sponsored</span>
      <span className="sponsored-body">
        <strong>{s.label}</strong>
        <span className="sponsored-blurb">{s.blurb}</span>
      </span>
      <span className="sponsored-arrow">↗</span>
    </a>
  )
}
