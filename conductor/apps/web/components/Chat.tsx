'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Burst } from './Burst'
import { Message } from './Message'
import { OrchestrationPanel } from './OrchestrationPanel'
import { Sandbox } from './Sandbox'
import type { ChatResponse, Msg, RouteDecision } from '@/lib/types'

const SUGGESTIONS = [
  'Implement a Next.js API route with rate limiting',
  'Design a fault-tolerant job queue architecture',
  'Analyze these benchmark numbers and find the regression',
  'Draft a README for an open-source CLI',
]

function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

let idc = 0
const mkId = () => `m${Date.now()}_${idc++}`

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
  const [spent, setSpent] = useState(0)
  const [decision, setDecision] = useState<RouteDecision | null>(null)
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [dark, setDark] = useState(false)
  const [agent, setAgent] = useState(false)
  const convIdRef = useRef<string | undefined>(undefined)

  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const autosize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || sending) return
      setSending(true)

      const userMsg: Msg = { id: mkId(), role: 'user', content }
      const pendingId = mkId()
      const history = [...messages, userMsg]
      setMessages([...history, { id: pendingId, role: 'assistant', content: '', pending: true }])
      setInput('')
      requestAnimationFrame(autosize)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            spentUSD: spent,
            conversationId: convIdRef.current,
            agentic: agent,
          }),
        })
        const data = (await res.json()) as ChatResponse & { error?: string; conversationId?: string }
        if (data.error) throw new Error(data.error)
        if (data.conversationId) convIdRef.current = data.conversationId

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  content: data.text,
                  decision: data.decision,
                  simulated: data.simulated,
                  costUSD: data.costUSD,
                  steps: data.steps,
                }
              : m
          )
        )
        setSpent(data.spentUSD)
        setDecision(data.decision)
        if (data.decision.model) {
          setAudit((a) => [
            ...a,
            {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              modelLabel: data.decision.model!.label,
              type: data.decision.classification.type,
              score: data.decision.score,
              reason: data.decision.reason,
            },
          ])
        }
        if (typeof window !== 'undefined' && window.innerWidth > 860) setPanelOpen(true)
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, pending: false, content: `⚠️ ${(err as Error).message}` }
              : m
          )
        )
      } finally {
        setSending(false)
      }
    },
    [messages, sending, spent, agent]
  )

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
    convIdRef.current = undefined
  }

  const empty = messages.length === 0
  const routedLabel = decision?.model?.label

  return (
    <div className="app">
      <div className="topbar">
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
        <button className="iconbtn" onClick={newChat} title="New chat" aria-label="New chat">
          <PlusIcon />
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
                A constraint-optimized agent. Every turn is routed to the most cost-effective
                model that can handle it — and you can see exactly why.
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
            <div className="composer">
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
              <button
                className="send"
                disabled={!input.trim() || sending}
                onClick={() => send(input)}
                aria-label="Send"
              >
                <ArrowUpIcon />
              </button>
            </div>
          </div>
          <div className="composer-hint">
            Routed by the COO engine · runs in simulation mode until a provider key is set
          </div>
        </div>

        <aside className={`panel ${panelOpen ? 'show' : ''}`}>
          <OrchestrationPanel decision={decision} audit={audit} />
          <Sandbox />
        </aside>
        {panelOpen && <div className="scrim" onClick={() => setPanelOpen(false)} />}
      </div>
    </div>
  )
}

/* ---- inline icons (stroke = currentColor) -------------------------------- */
const ArrowUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
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
