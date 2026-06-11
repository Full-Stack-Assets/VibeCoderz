/**
 * Per-user conversation memory, persisted to AsyncStorage.
 *
 * The point of this module is durability ACROSS an unfinished turn: assistant
 * text is streamed token-by-token into `messages`, and we persist continuously
 * (debounced) plus flush immediately when the app backgrounds. So if the app is
 * closed, killed, or crashes mid-stream, the partial reply and the whole
 * conversation are restored on next launch — the turn never needs to "finish"
 * for its memory to survive. On restore we sanitize any in-flight message
 * (clear `pending`, mark it `interrupted`) so the UI reopens in a clean state.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Msg } from './types'

export interface Memory {
  messages: Msg[]
  sessionSpent: number
  conversationId?: string
  updatedAt: number
}

const VERSION = 1
const keyFor = (userId: string) => `conductor.memory.${userId}.v${VERSION}`

/** Cap persisted history so the store can't grow without bound. */
const MAX_MESSAGES = 200

/** Drop heavy base64 image data before persisting — keep a lightweight marker. */
function lighten(messages: Msg[]): Msg[] {
  const tail = messages.slice(-MAX_MESSAGES)
  return tail.map((m) =>
    m.attachments && m.attachments.length
      ? { ...m, attachments: m.attachments.map((a) => ({ ...a, dataUrl: '' })) }
      : m
  )
}

/** Reopen any interrupted streaming turn in a clean, non-pending state. */
function sanitize(messages: Msg[]): Msg[] {
  return messages
    .map((m) => {
      if (!m.pending) return m
      const hasBody = !!m.content || (m.steps?.length ?? 0) > 0
      return { ...m, pending: false, interrupted: hasBody }
    })
    // A pending assistant turn that never produced anything is noise — drop it.
    .filter((m) => !(m.role === 'assistant' && !m.content && !(m.steps?.length) && !m.decision))
}

export async function loadMemory(userId: string): Promise<Memory | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Memory>
    if (!Array.isArray(parsed.messages)) return null
    return {
      messages: sanitize(parsed.messages as Msg[]),
      sessionSpent: Number(parsed.sessionSpent) || 0,
      conversationId: parsed.conversationId,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    }
  } catch {
    return null
  }
}

export async function saveMemory(
  userId: string,
  mem: Omit<Memory, 'updatedAt'>
): Promise<void> {
  try {
    const payload: Memory = {
      messages: lighten(mem.messages),
      sessionSpent: mem.sessionSpent,
      conversationId: mem.conversationId,
      updatedAt: Date.now(),
    }
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(payload))
  } catch {
    // best-effort
  }
}

export async function clearMemory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId))
  } catch {
    // best-effort
  }
}
