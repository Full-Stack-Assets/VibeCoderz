'use client'

import { Burst } from './Burst'
import type { StoredConversation } from '@/lib/history'

export function Sidebar({
  open,
  conversations,
  currentId,
  onNew,
  onSelect,
  onDelete,
  onClose,
}: {
  open: boolean
  conversations: StoredConversation[]
  currentId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
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
        <div className="conv-list">
          {conversations.length === 0 && <div className="conv-empty">No conversations yet</div>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conv-item ${c.id === currentId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="conv-name">{c.title}</span>
              <button
                className="conv-del"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(c.id)
                }}
              >
                <TrashIcon />
              </button>
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
