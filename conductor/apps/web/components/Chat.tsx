'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Burst } from './Burst'
import { Message } from './Message'
import { OrchestrationPanel } from './OrchestrationPanel'
import { Sandbox } from './Sandbox'
import { Sidebar } from './Sidebar'
import {
  listConversations,
  loadConversation,
  saveConversation,
  deleteConversation,
  titleFrom,
  type StoredConversation,
} from '@/lib/history'
import type { Attachment, Msg, RouteDecision, ToolStep } from '@/lib/types'

const SUGGESTIONS = [
  'Search the web for the latest on the EU AI Act and cite sources',
  'Analyze this CSV and find the outliers',
  'What’s in this screenshot? (attach an image)',
  'Design a fault-tolerant job queue, then draft the README',
]

const TEXT_EXT = /\.(csv|tsv|txt|md|json|log|ya?ml)$/i
const MAX_ATTACH_BYTES = 5 * 1024 * 1024 // 5 MB per file

function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

let idc = 0
const mkId = () => `m${Date.now()}_${idc++}`
const convId = () => `c${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

interface AuditItem {
  time: string
  modelLabel: string
  type: string
  score: number
  reason: string
}

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [spent, setSpent] = useState(0)
  const [decision, setDecision] = useState<RouteDecision | null>(null)
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [dark, setDark] = useState(false)
  const [agent, setAgent] = useState(false)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<Msg[]>([])
  messagesRef.current = messages
  const spentRef = useRef(0)
  spentRef.current = spent
  const mounted = useRef(false)

  useEffect(() => setConversations(listConversations()), [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Restore persisted theme + agent preference after mount (the inline script in
  // layout.tsx already applied the theme class pre-paint, so there's no flash).
  useEffect(() => {
    const stored = localStorage.getItem('conductor-theme')
    setDark(stored ? stored === 'dark' : document.documentElement.classList.contains('dark'))
    setAgent(localStorage.getItem('conductor-agent') === '1')
    mounted.current = true
  }, [])
  useEffect(() => {
    if (!mounted.current) return // don't clobber the pre-paint theme on first render
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('conductor-theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    if (!mounted.current) return
    localStorage.setItem('conductor-agent', agent ? '1' : '0')
  }, [agent])

  const autosize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }

  // Persist the current conversation to localStorage and refresh the list.
  const persistLocal = useCallback((id: string, msgs: Msg[], spentUSD: number) => {
    saveConversation({ id, title: titleFrom(msgs), updatedAt: Date.now(), spentUSD, messages: msgs })
    setConversations(listConversations())
  }, [])

  const patch = (id: string, fn: (m: Msg) => Msg) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))

  // Read selected files into attachments: images → data URL, text/data → text.
  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const read = (file: File) =>
      new Promise<Attachment | null>((resolve) => {
        if (file.size > MAX_ATTACH_BYTES) return resolve(null)
        const isImage = file.type.startsWith('image/')
        const isText = file.type.startsWith('text/') || TEXT_EXT.test(file.name) || file.type === 'application/json'
        if (!isImage && !isText) return resolve(null)
        const reader = new FileReader()
        reader.onerror = () => resolve(null)
        reader.onload = () =>
          resolve({
            id: `a${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: isImage ? 'image' : 'text',
            name: file.name,
            mediaType: file.type || (isImage ? 'image/png' : 'text/plain'),
            dataUrl: isImage ? String(reader.result) : undefined,
            text: isImage ? undefined : String(reader.result),
            size: file.size,
          })
        if (isImage) reader.readAsDataURL(file)
        else reader.readAsText(file)
      })
    const next = (await Promise.all(Array.from(files).map(read))).filter(Boolean) as Attachment[]
    if (next.length) setAttachments((prev) => [...prev, ...next])
  }, [])

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id))

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      const atts = attachments
      if ((!content && atts.length === 0) || sending) return
      setSending(true)

      const cid = currentId ?? convId()
      if (!currentId) setCurrentId(cid)

      const userMsg: Msg = { id: mkId(), role: 'user', content, attachments: atts.length ? atts : undefined }
      const pendingId = mkId()
      const history = [...messagesRef.current, userMsg]
      setMessages([...history, { id: pendingId, role: 'assistant', content: '', pending: true }])
      setInput('')
      setAttachments([])
      requestAnimationFrame(autosize)

      const ac = new AbortController()
      abortRef.current = ac

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })),
            spentUSD: spent,
            conversationId: cid,
            agentic: agent,
          }),
        })
        if (!res.body) throw new Error('no response stream')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let started = false

        const handle = (event: string, data: Record<string, unknown>) => {
          if (event === 'decision') {
            const d = data.decision as RouteDecision
            setDecision(d)
            patch(pendingId, (m) => ({ ...m, decision: d }))
            if (d.model) {
              setAudit((a) => [
                ...a,
                {
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  modelLabel: d.model!.label,
                  type: d.classification.type,
                  score: d.score,
                  reason: d.reason,
                },
              ])
            }
            if (typeof window !== 'undefined' && window.innerWidth > 980) setPanelOpen(true)
          } else if (event === 'tool') {
            const step = data.step as ToolStep
            patch(pendingId, (m) => ({ ...m, pending: false, steps: [...(m.steps || []), step] }))
          } else if (event === 'text') {
            started = true
            patch(pendingId, (m) => ({ ...m, pending: false, content: m.content + String(data.delta ?? '') }))
          } else if (event === 'done') {
            patch(pendingId, (m) => ({
              ...m,
              pending: false,
              simulated: data.simulated as boolean,
              costUSD: data.costUSD as number,
            }))
            setSpent(data.spentUSD as number)
          } else if (event === 'error') {
            patch(pendingId, (m) => ({ ...m, pending: false, content: `⚠️ ${data.error}` }))
          }
          void started
        }

        // SSE parse loop.
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() ?? ''
          for (const block of blocks) {
            let event = 'message'
            let dataStr = ''
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim()
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
            }
            if (dataStr) handle(event, JSON.parse(dataStr))
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          patch(pendingId, (m) => ({ ...m, pending: false, content: m.content || `⚠️ ${(err as Error).message}` }))
        } else {
          patch(pendingId, (m) => ({ ...m, pending: false, content: m.content + ' ⏹' }))
        }
      } finally {
        setSending(false)
        abortRef.current = null
        // Persist after the turn settles, keeping the session's running cost.
        setTimeout(() => persistLocal(cid, messagesRef.current, spentRef.current), 0)
      }
    },
    [sending, currentId, spent, agent, attachments, persistLocal]
  )

  // Persist whenever spend updates post-turn (captures final cost).
  useEffect(() => {
    if (currentId && messages.length > 0 && !sending) persistLocal(currentId, messages, spent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spent, sending])

  const stop = () => abortRef.current?.abort()

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const newChat = () => {
    setMessages([])
    setDecision(null)
    setAudit([])
    setSpent(0)
    setCurrentId(null)
    setSidebarOpen(false)
  }

  const selectConversation = (id: string) => {
    const conv = loadConversation(id)
    if (!conv) return
    setMessages(conv.messages)
    setCurrentId(conv.id)
    setSpent(conv.spentUSD || 0)
    const lastWithDecision = [...conv.messages].reverse().find((m) => m.decision)
    setDecision(lastWithDecision?.decision ?? null)
    setSidebarOpen(false)
  }

  const removeConversation = (id: string) => {
    deleteConversation(id)
    setConversations(listConversations())
    if (id === currentId) newChat()
  }

  const empty = messages.length === 0
  const routedLabel = decision?.model?.label

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        currentId={currentId}
        onNew={newChat}
        onSelect={selectConversation}
        onDelete={removeConversation}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <div className="topbar">
          <button className="iconbtn" onClick={() => setSidebarOpen((s) => !s)} title="Conversations" aria-label="Conversations">
            <MenuIcon />
          </button>
          <div className="brand">
            <span style={{ color: 'var(--coral)' }}>
              <Burst size={22} />
            </span>
            <span className="name">Conductor</span>
          </div>
          <div className="spacer" />
          <div className="model-pill" title="Model selected per-turn by the COO engine">
            <span className="dot" />
            {routedLabel ? routedLabel : 'Auto-routed'}
          </div>
          <a
            className="bench-link"
            href="/benchmark"
            title="Cost/quality benchmark — measured evidence the routing pays off"
          >
            <ChartIcon /> Benchmark
          </a>
          <button
            className={`agent-toggle ${agent ? 'on' : ''}`}
            onClick={() => setAgent((a) => !a)}
            title="Agent mode: the routed model drives sandbox tools"
          >
            <span className="agent-dot" /> Agent
          </button>
          <button className="iconbtn" onClick={() => setDark((d) => !d)} title="Toggle theme" aria-label="Toggle theme">
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className={`iconbtn ${panelOpen ? 'active' : ''}`}
            onClick={() => setPanelOpen((p) => !p)}
            title="Orchestration panel"
            aria-label="Toggle orchestration panel"
          >
            <SlidersIcon />
          </button>
        </div>

        <div className={`shell ${panelOpen ? 'panel-open' : ''}`}>
          <div className="conversation">
            {empty ? (
              <div className="greeting">
                <span className="burst-lg">
                  <Burst size={56} />
                </span>
                <h1>{greetingText()}</h1>
                <p>
                  A constraint-optimized general agent — code, web research, data analysis, and
                  images. Every turn is routed to the most cost-effective model that can handle it,
                  and you can see exactly why.
                </p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="thread">
                {messages.map((m) => (
                  <Message key={m.id} msg={m} onInspect={() => setPanelOpen(true)} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            <div className="composer-wrap">
              {attachments.length > 0 && (
                <div className="attach-row">
                  {attachments.map((a) => (
                    <div className={`attach-chip ${a.kind}`} key={a.id}>
                      {a.kind === 'image' && a.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.dataUrl} alt={a.name} />
                      ) : (
                        <FileIcon />
                      )}
                      <span className="attach-name">{a.name}</span>
                      <button className="attach-x" onClick={() => removeAttachment(a.id)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="composer">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.csv,.tsv,.txt,.md,.json,.log,.yml,.yaml,text/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void onFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <button
                  className="attach-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Attach images or data files"
                  aria-label="Attach files"
                >
                  <PaperclipIcon />
                </button>
                <textarea
                  ref={taRef}
                  value={input}
                  placeholder="Message Conductor…"
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value)
                    autosize()
                  }}
                  onKeyDown={onKeyDown}
                />
                {sending ? (
                  <button className="send stop" onClick={stop} aria-label="Stop">
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    className="send"
                    disabled={!input.trim() && attachments.length === 0}
                    onClick={() => send(input)}
                    aria-label="Send"
                  >
                    <ArrowUpIcon />
                  </button>
                )}
              </div>
            </div>
            <div className="composer-hint">
              Code · web research · data · images — routed by the COO engine, streamed live, simulated until a gateway key is set
            </div>
          </div>

          <aside className={`panel ${panelOpen ? 'show' : ''}`}>
            <OrchestrationPanel decision={decision} audit={audit} />
            <Sandbox />
          </aside>
          {panelOpen && <div className="scrim" onClick={() => setPanelOpen(false)} />}
        </div>
      </div>
    </div>
  )
}

/* ---- inline icons ---- */
const ArrowUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)
const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
)
const PaperclipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3 3 0 0 1 4.24 4.24l-8.49 8.49a1 1 0 0 1-1.41-1.41l7.78-7.78" />
  </svg>
)
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
)
const ChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <rect x="7" y="11" width="3" height="6" />
    <rect x="12" y="7" width="3" height="10" />
    <rect x="17" y="13" width="3" height="4" />
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
const SlidersIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
    <circle cx="16" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="13" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
)
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </svg>
)
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
