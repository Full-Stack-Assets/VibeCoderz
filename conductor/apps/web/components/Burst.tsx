/**
 * Conductor mark — a Claude-style radiant burst (the warm "sparkle" silhouette),
 * rendered as tapered rays around a center. Inherits `currentColor` so it picks
 * up the coral accent wherever it's placed.
 */
export function Burst({ size = 22 }: { size?: number }) {
  const rays = 12
  const cx = 50
  const cy = 50
  const inner = 7
  const outer = 46
  const halfW = 5.2 // ray half-width at the base

  const paths = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2 - Math.PI / 2
    const perp = a + Math.PI / 2
    const tipX = cx + Math.cos(a) * outer
    const tipY = cy + Math.sin(a) * outer
    const b1x = cx + Math.cos(a) * inner + Math.cos(perp) * halfW
    const b1y = cy + Math.sin(a) * inner + Math.sin(perp) * halfW
    const b2x = cx + Math.cos(a) * inner - Math.cos(perp) * halfW
    const b2y = cy + Math.sin(a) * inner - Math.sin(perp) * halfW
    return `M ${b1x.toFixed(2)} ${b1y.toFixed(2)} L ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${b2x.toFixed(2)} ${b2y.toFixed(2)} Z`
  }).join(' ')

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <path d={paths} />
    </svg>
  )
}
