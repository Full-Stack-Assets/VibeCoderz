/**
 * Streaming client for Conductor's `POST /api/chat`.
 *
 * The backend replies with Server-Sent Events (text/event-stream), emitting
 * `decision`, then `text` / `tool` frames, then `done` (or `error`). React
 * Native's `fetch` cannot read a streaming response body, so we drive an XHR and
 * parse the `\n\n`-delimited SSE frames out of the growing `responseText`.
 * This mirrors the web shell's reader loop in components/Chat.tsx.
 */
import type { Attachment, DoneInfo, RouteDecision, ToolStep } from './types'
import { normalizeBaseUrl } from './config'

/** What the backend's `/api/chat` accepts per attachment (image branch). */
interface OutAttachment {
  kind: 'image'
  name: string
  mediaType: string
  dataUrl: string
}

export interface OutMsg {
  role: 'user' | 'assistant'
  content: string
  attachments?: OutAttachment[]
}

/** Strip UI-only fields, keeping just what the server needs to forward images. */
export const toOutAttachments = (atts: Attachment[] | undefined): OutAttachment[] | undefined => {
  if (!atts || atts.length === 0) return undefined
  const out = atts
    .filter((a) => a.kind === 'image' && a.dataUrl)
    .map((a) => ({ kind: 'image' as const, name: a.name, mediaType: a.mediaType, dataUrl: a.dataUrl }))
  return out.length ? out : undefined
}

export interface ChatRequest {
  baseUrl: string
  messages: OutMsg[]
  spentUSD?: number
  agentic?: boolean
  preferModel?: string
  qualityFloor?: number
  conversationId?: string
}

export interface ChatHandlers {
  onDecision?: (decision: RouteDecision) => void
  onText?: (delta: string) => void
  onTool?: (step: ToolStep) => void
  onDone?: (info: DoneInfo) => void
  onError?: (message: string) => void
}

/** Start a streaming chat turn. Returns a `cancel()` that aborts the request. */
export function streamChat(req: ChatRequest, handlers: ChatHandlers): () => void {
  const xhr = new XMLHttpRequest()
  const url = `${normalizeBaseUrl(req.baseUrl)}/api/chat`

  let seen = 0 // chars of responseText already consumed
  let buffer = '' // partial SSE frame carried across reads
  let finished = false // a terminal event (done/error) was dispatched

  const dispatch = (event: string, dataStr: string) => {
    let data: Record<string, unknown> = {}
    if (dataStr) {
      try {
        data = JSON.parse(dataStr) as Record<string, unknown>
      } catch {
        return // ignore malformed frame
      }
    }
    switch (event) {
      case 'decision':
        handlers.onDecision?.(data.decision as RouteDecision)
        break
      case 'text':
        handlers.onText?.(String(data.delta ?? ''))
        break
      case 'tool':
        handlers.onTool?.(data.step as ToolStep)
        break
      case 'done':
        finished = true
        handlers.onDone?.(data as DoneInfo)
        break
      case 'error':
        finished = true
        handlers.onError?.(String(data.error ?? 'Unknown error'))
        break
    }
  }

  const drain = () => {
    const text = xhr.responseText
    if (text.length <= seen) return
    buffer += text.slice(seen)
    seen = text.length

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? '' // last chunk may be incomplete
    for (const frame of frames) {
      if (!frame.trim()) continue
      let event = 'message'
      let dataStr = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
      }
      dispatch(event, dataStr)
    }
  }

  xhr.onreadystatechange = () => {
    // readyState 3 (LOADING) fires repeatedly as bytes arrive; 4 = DONE.
    if (xhr.readyState >= 3) drain()
    if (xhr.readyState === 4) {
      drain()
      if (!finished) {
        if (xhr.status >= 400) {
          handlers.onError?.(`Server returned ${xhr.status}. Check the backend URL in Settings.`)
        } else if (xhr.status === 0) {
          handlers.onError?.('Could not reach the server. Check the URL and your connection.')
        } else {
          // Stream closed without a `done` frame — treat as a soft completion.
          handlers.onDone?.({})
        }
      }
    }
  }

  xhr.onerror = () => {
    if (!finished) handlers.onError?.('Network error. Check the backend URL and your connection.')
  }

  try {
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.setRequestHeader('Accept', 'text/event-stream')
    xhr.send(
      JSON.stringify({
        messages: req.messages,
        spentUSD: req.spentUSD ?? 0,
        agentic: req.agentic ?? false,
        preferModel: req.preferModel,
        qualityFloor: req.qualityFloor,
        conversationId: req.conversationId,
      })
    )
  } catch (e) {
    handlers.onError?.(`Failed to start request: ${(e as Error).message}`)
  }

  return () => {
    try {
      xhr.abort()
    } catch {
      // already finished
    }
  }
}

/** Format a USD cost compactly: sub-cent values keep enough precision to read. */
export function formatUSD(n: number | undefined): string {
  const v = Number(n ?? 0)
  if (v === 0) return '$0.00'
  if (v < 0.01) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}
