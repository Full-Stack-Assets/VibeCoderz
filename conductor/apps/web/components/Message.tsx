'use client'

import { Burst } from './Burst'
import type { Msg } from '@/lib/types'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tiny, safe markdown subset: fenced code, inline code, bold, blockquote, paragraphs. */
function renderMarkdown(src: string): string {
  const blocks = src.split(/```/)
  let html = ''
  blocks.forEach((block, i) => {
    if (i % 2 === 1) {
      const body = block.replace(/^[a-z0-9]*\n/i, '')
      html += `<pre><code>${esc(body.replace(/\n$/, ''))}</code></pre>`
      return
    }
    block
      .split(/\n{2,}/)
      .filter((p) => p.trim().length)
      .forEach((para) => {
        let p = esc(para)
        p = p.replace(/`([^`]+)`/g, '<code>$1</code>')
        p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        if (/^&gt;\s?/.test(p)) {
          html += `<blockquote>${p.replace(/^&gt;\s?/gm, '')}</blockquote>`
        } else {
          html += `<p>${p.replace(/\n/g, '<br/>')}</p>`
        }
      })
  })
  return html
}

export function Message({ msg, onInspect }: { msg: Msg; onInspect?: () => void }) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble">{msg.content}</div>
      </div>
    )
  }

  return (
    <div className="msg assistant">
      <div className="avatar">
        <Burst size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.pending ? (
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div
            className="assistant-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
        {msg.decision?.model && !msg.pending && (
          <div className="msg-meta">
            <span
              className="tag routed"
              title={msg.decision.reason}
              onClick={onInspect}
              style={{ cursor: 'pointer' }}
            >
              <Burst size={11} /> {msg.decision.model.label}
            </span>
            <span className="tag">fit {(msg.decision.score * 100).toFixed(0)}%</span>
            <span className="tag">${(msg.costUSD ?? 0).toFixed(5)}</span>
            {msg.simulated && <span className="tag sim">simulated</span>}
            {msg.decision.fallback && <span className="tag">fallback</span>}
            {msg.decision.overridden && <span className="tag">override</span>}
          </div>
        )}
      </div>
    </div>
  )
}
