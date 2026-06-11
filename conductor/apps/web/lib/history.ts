'use client'

import type { Msg } from './types'

// Client-side conversation history. localStorage is the single source of truth
// for the visible chat list, so history survives reloads with zero backend
// configuration. (The server additionally keeps a durable audit log via the
// memory store / Postgres, independent of this.)

const KEY = 'conductor.conversations.v1'

export interface StoredConversation {
  id: string
  title: string
  updatedAt: number
  spentUSD: number
  messages: Msg[]
}

function read(): StoredConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredConversation[]) : []
  } catch {
    return []
  }
}

function write(list: StoredConversation[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function listConversations(): StoredConversation[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadConversation(id: string): StoredConversation | undefined {
  return read().find((c) => c.id === id)
}

export function saveConversation(conv: StoredConversation) {
  const list = read().filter((c) => c.id !== conv.id)
  // Strip transient fields and heavy base64 image data before persisting — full
  // data URLs would quickly blow the ~5MB localStorage quota. We keep a marker
  // so the attachment still shows as a file chip after reload.
  const messages = conv.messages
    .filter((m) => !m.pending)
    .map((m) => ({
      ...m,
      pending: false,
      attachments: m.attachments?.map((a) =>
        a.kind === 'image' ? { ...a, dataUrl: undefined } : a
      ),
    }))
  list.push({ ...conv, messages })
  write(list)
}

export function renameConversation(id: string, title: string) {
  const clean = title.trim().slice(0, 80)
  if (!clean) return
  write(read().map((c) => (c.id === id ? { ...c, title: clean } : c)))
}

export function deleteConversation(id: string) {
  write(read().filter((c) => c.id !== id))
}

export function titleFrom(messages: Msg[]): string {
  const first = messages.find((m) => m.role === 'user')?.content || 'New conversation'
  return first.length > 48 ? first.slice(0, 48) + '…' : first
}

/** Render a conversation as portable Markdown for export/download. */
export function conversationToMarkdown(conv: StoredConversation): string {
  const lines: string[] = [`# ${conv.title}`, '']
  for (const m of conv.messages) {
    if (m.role === 'user') {
      lines.push('**You:**', '', m.content || '_(attachment only)_', '')
    } else {
      const model = m.decision?.model?.label
      lines.push(`**Conductor${model ? ` · ${model}` : ''}:**`, '', m.content || '', '')
    }
  }
  return lines.join('\n').trim() + '\n'
}
