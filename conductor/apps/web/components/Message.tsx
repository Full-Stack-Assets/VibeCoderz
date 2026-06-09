'use client'

import { useState } from 'react'
import { Burst } from './Burst'
import type { Msg } from '@/lib/types'

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="copy-btn"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

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
        // [label](https://url) → safe external link
        p = p.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
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
        <div className="bubble">
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="msg-attachments">
              {msg.attachments.map((a) =>
                a.kind === 'image' && a.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={a.dataUrl} alt={a.name} className="msg-img" />
                ) : (
                  <span key={a.id} className="msg-file" title={a.name}>
                    📄 {a.name}
                  </span>
                )
              )}
            </div>
          )}
          {msg.content && <span>{msg.content}</span>}
        </div>
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
          <>
            {msg.steps && msg.steps.length > 0 && (
              <div className="tool-steps">
                {msg.steps.map((s, i) => {
                  const arg = String(
                    s.args.command ??
                      s.args.query ??
                      s.args.url ??
                      s.args.expression ??
                      s.args.path ??
                      s.args.timezone ??
                      (s.tool === 'analyze_data' ? 'dataset' : s.args.dir ?? '.')
                  )
                  return (
                    <div className={`tool-step ${s.result.ok ? '' : 'err'}`} key={i}>
                      <div className="tool-step-h">
                        <span className="tool-badge">{s.tool}</span>
                        <code>{arg}</code>
                        <span className="tool-status">{s.result.ok ? '✓' : '✗'}</span>
                      </div>
                      <pre className="tool-step-out">
                        {s.result.ok ? s.result.output || '(no output)' : s.result.error}
                      </pre>
                    </div>
                  )
                })}
              </div>
            )}
            <div
              className="assistant-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          </>
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
            {msg.decision.classification?.domain && (
              <span className="tag domain">{msg.decision.classification.domain}</span>
            )}
            <span className="tag">fit {(msg.decision.score * 100).toFixed(0)}%</span>
            <span className="tag">${(msg.costUSD ?? 0).toFixed(5)}</span>
            {msg.simulated && <span className="tag sim">simulated</span>}
            {msg.decision.fallback && <span className="tag">fallback</span>}
            {msg.decision.overridden && <span className="tag">override</span>}
            {msg.content && <CopyButton text={msg.content} />}
          </div>
        )}
      </div>
    </div>
  )
}
