'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext'

interface Memory {
  id: string
  text: string
  createdAt: number
}

/**
 * Manage the signed-in user's durable memories — the personalization surface for
 * Phase 4. Saved items are folded into every turn's system prompt server-side.
 * Self-contained: fetches /api/memory and renders nothing when signed out.
 */
export function MemoryPanel() {
  const { user } = useAuth()
  const [memories, setMemories] = useState<Memory[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/memory')
      if (!res.ok) return
      const data = (await res.json()) as { memories: Memory[] }
      setMemories(data.memories ?? [])
    } catch {
      /* best-effort */
    }
  }, [])

  useEffect(() => {
    if (user) void load()
    else setMemories([])
  }, [user, load])

  // Reload when the chat stream auto-extracts a new memory.
  useEffect(() => {
    if (!user) return
    const onChange = () => void load()
    window.addEventListener('conductor:memory-changed', onChange)
    return () => window.removeEventListener('conductor:memory-changed', onChange)
  }, [user, load])

  if (!user) return null

  const add = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const data = (await res.json()) as { memory?: Memory }
        if (data.memory) setMemories((prev) => [...prev, data.memory as Memory])
        setDraft('')
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const remove = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id)) // optimistic
    void fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="panel-inner">
      <h2>Memory</h2>
      <p className="sub">Saved preferences the assistant applies to every turn.</p>
      <div className="card">
        <div className="memory-add">
          <input
            className="memory-input"
            value={draft}
            maxLength={500}
            placeholder="e.g. Prefer TypeScript and concise answers"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
          />
          <button className="btn" disabled={!draft.trim() || busy} onClick={() => void add()}>
            Add
          </button>
        </div>
        {memories.length === 0 ? (
          <div className="empty-panel">
            No saved memories yet. Add facts or preferences and they&rsquo;ll inform every reply.
          </div>
        ) : (
          <ul className="memory-list">
            {memories.map((m) => (
              <li key={m.id} className="memory-item">
                <span>{m.text}</span>
                <button className="icon-btn" title="Forget" aria-label="Forget" onClick={() => remove(m.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
