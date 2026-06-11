'use client'

import { useEffect, useRef, useState } from 'react'
import { Burst } from './Burst'
import { Citations, DataChart } from './ToolResult'
import { renderMarkdown } from '@/lib/markdown'
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

/**
 * After markdown renders, attach a "Copy" button to each fenced code block.
 * Done via the DOM (rather than in the HTML string) so the click handler and
 * "Copied" feedback stay in React's world without re-parsing the markup.
 */
function useCodeCopyButtons(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    root.querySelectorAll<HTMLElement>('.codeblock').forEach((block) => {
      if (block.querySelector('.code-copy')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy'
      btn.textContent = 'Copy'
      btn.addEventListener('click', () => {
        const code = block.querySelector('code')?.textContent ?? ''
        navigator.clipboard
          ?.writeText(code)
          .then(() => {
            btn.textContent = 'Copied'
            setTimeout(() => {
              btn.textContent = 'Copy'
            }, 1200)
          })
          .catch(() => {})
      })
      block.appendChild(btn)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

export function Message({
  msg,
  onInspect,
  onEdit,
  onRegenerate,
}: {
  msg: Msg
  onInspect?: () => void
  onEdit?: (id: string, content: string) => void
  onRegenerate?: () => void
}) {
  // Hook must run for every message (Rules of Hooks); the ref only binds below.
  const bodyRef = useCodeCopyButtons([msg.content, msg.pending])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (msg.role === 'user') {
    if (editing) {
      return (
        <div className="msg user">
          <div className="edit-box">
            <textarea
              className="edit-area"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false)
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  onEdit?.(msg.id, draft)
                  setEditing(false)
                }
              }}
            />
            <div className="edit-actions">
              <button className="edit-cancel" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                className="edit-send"
                disabled={!draft.trim()}
                onClick={() => {
                  onEdit?.(msg.id, draft)
                  setEditing(false)
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )
    }
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
        {onEdit && (
          <div className="user-actions">
            <button
              className="msg-action"
              title="Edit & resend"
              onClick={() => {
                setDraft(msg.content)
                setEditing(true)
              }}
            >
              Edit
            </button>
          </div>
        )}
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
                  // First-class rendering for research & data results; raw
                  // output otherwise (and always for errors).
                  const hasCitations =
                    s.result.ok && s.tool === 'web_search' && !!s.result.results?.length
                  const hasChart =
                    s.result.ok && s.tool === 'analyze_data' && (!!s.result.stats || !!s.result.columns?.length)
                  return (
                    <div className={`tool-step ${s.result.ok ? '' : 'err'}`} key={i}>
                      <div className="tool-step-h">
                        <span className="tool-badge">{s.tool}</span>
                        <code>{arg}</code>
                        <span className="tool-status">{s.result.ok ? '✓' : '✗'}</span>
                      </div>
                      {hasCitations ? (
                        <Citations query={String(s.args.query ?? '')} results={s.result.results!} />
                      ) : hasChart ? (
                        <DataChart rows={s.result.rows} columns={s.result.columns} stats={s.result.stats} />
                      ) : (
                        <pre className="tool-step-out">
                          {s.result.ok ? s.result.output || '(no output)' : s.result.error}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div
              ref={bodyRef}
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
            {onRegenerate && (
              <button className="msg-action" title="Regenerate reply" onClick={onRegenerate}>
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
