/**
 * Native sponsorships (monetization B3) — config-driven, free-tier-only, and
 * clearly labeled. NO display-ad networks, nothing in the answer stream: just a
 * small "Sponsored" card on the empty state for free users (deploy targets,
 * data/search providers, etc.). Off by default — populate via the public env
 * var so it ships dark until there's a partner.
 *
 *   NEXT_PUBLIC_CONDUCTOR_SPONSORS=[{"id":"vercel","label":"Deploy on Vercel",
 *     "blurb":"Ship your generated app in one click.","url":"https://vercel.com?ref=conductor"}]
 */

export interface Sponsor {
  id: string
  label: string
  blurb: string
  url: string
}

export function getSponsors(): Sponsor[] {
  const raw = process.env.NEXT_PUBLIC_CONDUCTOR_SPONSORS
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr)
      ? arr.filter((s): s is Sponsor => !!s && typeof s.url === 'string' && typeof s.label === 'string')
      : []
  } catch {
    return []
  }
}
