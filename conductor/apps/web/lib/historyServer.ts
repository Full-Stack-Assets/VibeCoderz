'use client'

import type { StoredConversation } from './history'

/**
 * Best-effort cloud sync for conversation history. The app is offline-first:
 * localStorage stays the instant source of truth, and these helpers mirror it
 * to the per-account server store so history survives across sessions/devices
 * (durably when DATABASE_URL is configured; otherwise within a server instance).
 * Every call swallows errors — a sync failure never blocks the UI.
 */

const auth = (userId: string) => ({ 'content-type': 'application/json', 'x-user-id': userId })

export async function pullServerConversations(userId: string): Promise<StoredConversation[]> {
  try {
    const res = await fetch('/api/conversations', { headers: { 'x-user-id': userId } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.conversations) ? (data.conversations as StoredConversation[]) : []
  } catch {
    return []
  }
}

export async function pushServerConversation(userId: string, conv: StoredConversation): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(conv.id)}`, {
      method: 'PUT',
      headers: auth(userId),
      body: JSON.stringify(conv),
    })
  } catch {
    /* offline — localStorage already holds the canonical copy */
  }
}

export async function deleteServerConversation(userId: string, id: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    })
  } catch {
    /* ignore */
  }
}

export async function renameServerConversation(userId: string, id: string, title: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: auth(userId),
      body: JSON.stringify({ title }),
    })
  } catch {
    /* ignore */
  }
}
