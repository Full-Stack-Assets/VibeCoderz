'use client'

import type { StoredConversation } from './history'

/**
 * Best-effort cloud sync for conversation history. The app is offline-first:
 * localStorage stays the instant source of truth, and these helpers mirror it
 * to the signed-in account's server store (ownership resolved from the session
 * cookie, sent automatically with same-origin fetches). Every call swallows
 * errors — a sync failure never blocks the UI.
 */

const JSON_HEADERS = { 'content-type': 'application/json' }

export async function pullServerConversations(): Promise<StoredConversation[]> {
  try {
    const res = await fetch('/api/conversations')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.conversations) ? (data.conversations as StoredConversation[]) : []
  } catch {
    return []
  }
}

export async function pushServerConversation(conv: StoredConversation): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(conv.id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(conv),
    })
  } catch {
    /* offline — localStorage already holds the canonical copy */
  }
}

export async function deleteServerConversation(id: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch {
    /* ignore */
  }
}

export async function renameServerConversation(id: string, title: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title }),
    })
  } catch {
    /* ignore */
  }
}
