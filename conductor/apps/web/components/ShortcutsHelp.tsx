'use client'

import { useRef } from 'react'
import { useFocusTrap } from '@/lib/useFocusTrap'

const ROWS: [string, string][] = [
  ['⌘ / Ctrl + K', 'Focus the message box'],
  ['⌘ / Ctrl + Shift + O', 'New chat'],
  ['⌘ / Ctrl + B', 'Toggle conversations'],
  ['Enter', 'Send message'],
  ['Shift + Enter', 'New line'],
  ['Esc', 'Stop generating · close panels'],
  ['?', 'Show this help'],
]

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, onClose)
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="shortcuts"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-head">Keyboard shortcuts</div>
        <dl className="shortcuts-list">
          {ROWS.map(([keys, desc]) => (
            <div className="shortcut-row" key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <button className="auth-back" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
