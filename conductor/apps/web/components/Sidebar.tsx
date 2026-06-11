'use client'

import { useState } from 'react'
import { Burst } from './Burst'
import type { StoredConversation } from '@/lib/history'

export function Sidebar({
  open,
  conversations,
  currentId,
  onNew,
  onSelect,
  onDelete,
  onRename,
  onExport,
  onClose,
}: {
  open: boolean
  conversations: StoredConversation[]
  currentId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onExport: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations

  const startRename = (c: StoredConversation) => {
    setEditingId(c.id)
    setDraft(c.title)
  }
  const commitRename = () => {
    if (editingId) onRename(editingId, draft)
    setEditingId(null)
    setDraft('')
  }

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <span className="brand" style={{ color: 'var(--coral)' }}>
            <Burst size={20} />
          </span>
          <span className="sidebar-title">Conductor</span>
        </div>
        <button className="new-chat" onClick={onNew}>
          <PlusIcon /> New chat
        </button>
        {conversations.length > 0 && (
          <input
            className="conv-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
        )}
        <div className="conv-list">
          {conversations.length === 0 && <div className="conv-empty">No conversations yet</div>}
          {conversations.length > 0 && filtered.length === 0 && (
            <div className="conv-empty">No matches</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`conv-item ${c.id === currentId ? 'active' : ''}`}
              onClick={() => editingId !== c.id && onSelect(c.id)}
            >
              {editingId === c.id ? (
                <input
                  className="conv-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') {
                      setEditingId(null)
                      setDraft('')
                    }
                  }}
                />
              ) : (
                <span className="conv-name" onDoubleClick={() => startRename(c)} title={c.title}>
                  {c.title}
                </span>
              )}
              <div className="conv-actions">
                <button
                  className="conv-act"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(c)
                  }}
                >
                  <PencilIcon />
                </button>
                <button
                  className="conv-act"
                  title="Export as Markdown"
                  onClick={(e) => {
                    e.stopPropagation()
                    onExport(c.id)
                  }}
                >
                  <DownloadIcon />
                </button>
                <button
                  className="conv-act"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(c.id)
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-foot">Constraint-optimized orchestration</div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
    </>
  )
}

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)
const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
)
