'use client'

import type { Citation, ColumnStats } from '@/lib/types'

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Research sources rendered as clickable citation cards. */
export function Citations({ query, results }: { query?: string; results: Citation[] }) {
  if (!results.length) return null
  return (
    <div className="citations">
      {query && <div className="citations-h">Sources for “{query}”</div>}
      <ol className="citation-list">
        {results.map((r, i) => {
          const host = hostOf(r.url)
          const card = (
            <>
              <span className="citation-idx">{i + 1}</span>
              <span className="citation-body">
                <span className="citation-title">{r.title || host || 'source'}</span>
                {host && <span className="citation-host">{host}</span>}
                {r.snippet && <span className="citation-snippet">{r.snippet}</span>}
              </span>
            </>
          )
          return (
            <li key={r.url || i} className="citation">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="citation-link">
                  {card}
                </a>
              ) : (
                <div className="citation-link">{card}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return n.toExponential(2)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/**
 * Data summary as a first-class chart: a stats table for numeric columns, each
 * with a bar showing where the mean sits within that column's [min, max] range.
 */
export function DataChart({
  rows,
  columns,
  stats,
}: {
  rows?: number
  columns?: string[]
  stats?: Record<string, ColumnStats>
}) {
  const numeric = stats ? Object.entries(stats) : []
  const textCols = (columns || []).filter((c) => !stats || !stats[c])
  if (!numeric.length && !textCols.length) return null

  return (
    <div className="datachart">
      <div className="datachart-h">
        {typeof rows === 'number' ? `${rows} rows` : 'dataset'}
        {columns?.length ? ` · ${columns.length} columns` : ''}
      </div>
      {numeric.length > 0 && (
        <div className="datachart-rows">
          {numeric.map(([name, s]) => {
            const span = s.max - s.min
            const pct = span > 0 ? ((s.mean - s.min) / span) * 100 : 50
            return (
              <div className="datachart-row" key={name}>
                <div className="dc-top">
                  <span className="dc-name">{name}</span>
                  <span className="dc-mean">μ {fmt(s.mean)}</span>
                </div>
                <div className="dc-track" title={`min ${fmt(s.min)} · mean ${fmt(s.mean)} · max ${fmt(s.max)}`}>
                  <div className="dc-fill" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
                </div>
                <div className="dc-scale">
                  <span>{fmt(s.min)}</span>
                  <span>med {fmt(s.median)}</span>
                  <span>{fmt(s.max)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {textCols.length > 0 && (
        <div className="dc-textcols">
          {textCols.map((c) => (
            <span className="dc-chip" key={c}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
