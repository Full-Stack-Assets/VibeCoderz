'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Burst } from './Burst'
import { CodeIcon, SearchIcon, BarsIcon, EyeIcon } from './icons'
import { Message } from './Message'
import { OrchestrationPanel } from './OrchestrationPanel'
import { MemoryPanel } from './MemoryPanel'
import { SponsoredSlot } from './SponsoredSlot'
import { Sandbox } from './Sandbox'
import { Sidebar } from './Sidebar'
import {
  listConversations,
  loadConversation,
  saveConversation,
  deleteConversation,
  renameConversation,
  conversationToMarkdown,
  setHistoryNamespace,
  titleFrom,
  type StoredConversation,
} from '@/lib/history'
import {
  pullServerConversations,
  pushServerConversation,
  deleteServerConversation,
  renameServerConversation,
} from '@/lib/historyServer'
import type { Attachment, Msg, RouteDecision, ToolStep } from '@/lib/types'
import { useAuth } from './auth/AuthContext'
import { AuthFlow } from './auth/AuthFlow'
import { Pricing } from './auth/Pricing'
import { RoutingControls, type CatalogModel } from './RoutingControls'
import { ShortcutsHelp } from './ShortcutsHelp'
import { planById, planCaps, TOPUP_PACKS } from '@/lib/auth'
import { rotatingSuggestions, rotationWindow } from '@/lib/suggestions'
import { useFocusTrap } from '@/lib/useFocusTrap'

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
// Honor reduced-motion for programmatic scrolls (scrollIntoView ignores the CSS
// scroll-behavior override, so we pick the behavior explicitly).
const scrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

interface AuditItem {
  time: string
  modelLabel: string
  type: string
  score: number
  reason: string
}

export function Chat({ onNewUser }: { onNewUser?: () => void } = {}) {
  const { user, logout, startTopup, billing } = useAuth()
  // Scope conversation history to this account before any read/write below.
  setHistoryNamespace(user?.id ?? null)
  // Stable handle to the current account id for fire-and-forget cloud sync.
  const userIdRef = useRef<string | null>(null)
  userIdRef.current = user?.id ?? null
  const [accountOpen, setAccountOpen] = useState(false)
  const [refCopied, setRefCopied] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [routingOpen, setRoutingOpen] = useState(false)
  const [preferModel, setPreferModel] = useState<string | null>(null)
  const [qualityFloor, setQualityFloor] = useState(0)
  const [models, setModels] = useState<CatalogModel[]>([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [budgetCap, setBudgetCap] = useState<number | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'routing' | 'memory' | 'sandbox'>('routing')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [spent, setSpent] = useState(0)
  const [credit, setCredit] = useState(0)
  const [savedUSD, setSavedUSD] = useState(0)
  const [decision, setDecision] = useState<RouteDecision | null>(null)
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [dark, setDark] = useState(false)
  const [agent, setAgent] = useState(false)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [atBottom, setAtBottom] = useState(true)
  const [capReached, setCapReached] = useState(false)
  const [toppingUp, setToppingUp] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>(() => rotatingSuggestions())
  // Anonymous trial: signed-out visitors get a few real turns before the wall.
  // `trialRemaining` is null until the server reports it (or for signed-in users).
  const [trialRemaining, setTrialRemaining] = useState<number | null>(null)
  const [anonSaved, setAnonSaved] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [trialWall, setTrialWall] = useState(false)
  // Real headline numbers from the routing benchmark, for the landing wedge.
  const [headline, setHeadline] = useState<{ costSavingsPct: number; qualityRetentionPct: number } | null>(null)
  const trialRemainingRef = useRef<number | null>(null)
  trialRemainingRef.current = trialRemaining

  const convRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  atBottomRef.current = atBottom
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
  // Keep the live credit balance in sync with the account (updated again after
  // each turn via the stream's `done` event, and after returning from Stripe).
  useEffect(() => setCredit(user?.topupUSD ?? 0), [user?.topupUSD])
  useEffect(() => setSavedUSD(user?.savedUSD ?? 0), [user?.savedUSD])
  // Once signed in, tear down all trial UI (counter, wall, auth modal).
  useEffect(() => {
    if (user) {
      setTrialRemaining(null)
      setTrialWall(false)
      setAuthOpen(false)
    }
  }, [user])

  const openAuth = useCallback((mode: 'signin' | 'signup') => {
    setAuthMode(mode)
    setAuthOpen(true)
  }, [])
  // Re-deal the starter prompts when the rotation window rolls over, so even a
  // tab left open gets fresh suggestions (a minutely index check, no re-render
  // unless the window actually changed).
  useEffect(() => {
    let win = rotationWindow()
    const id = setInterval(() => {
      const next = rotationWindow()
      if (next !== win) {
        win = next
        setSuggestions(rotatingSuggestions())
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    let alive = true
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => alive && setModels(d.models ?? []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  // Pull the measured routing headline (X% cheaper at Y% of premium quality) so
  // the greeting leads with a real number, not a hand-wavy range.
  useEffect(() => {
    let alive = true
    fetch('/api/benchmark')
      .then((r) => r.json())
      .then((d) => {
        const v = d?.headline?.vsPremium
        if (alive && v && typeof v.costSavingsPct === 'number') setHeadline(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  // On sign-in, pull this account's cloud history and merge it into the local
  // cache (server wins only when strictly newer), then refresh the list.
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    let alive = true
    pullServerConversations().then((remote) => {
      if (!alive || remote.length === 0) return
      const local = new Map(listConversations().map((c) => [c.id, c.updatedAt ?? 0]))
      let changed = false
      for (const rc of remote) {
        if (!rc?.id) continue
        if (!local.has(rc.id) || (rc.updatedAt ?? 0) > (local.get(rc.id) ?? 0)) {
          saveConversation(rc)
          changed = true
        }
      }
      if (changed) setConversations(listConversations())
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  // Auto-scroll only when the user is already pinned to the bottom, so reading
  // back through a streaming reply doesn't yank them down.
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: scrollBehavior() })
  }, [messages])

  const onConvScroll = () => {
    const el = convRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior() })
    setAtBottom(true)
  }

  useFocusTrap(accountMenuRef, accountOpen, () => setAccountOpen(false))

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

  // Persist the current conversation to localStorage (instant) and mirror it to
  // the per-account cloud store (best-effort) so it survives across sessions.
  const persistLocal = useCallback((id: string, msgs: Msg[], spentUSD: number) => {
    const conv: StoredConversation = { id, title: titleFrom(msgs), updatedAt: Date.now(), spentUSD, messages: msgs }
    saveConversation(conv)
    setConversations(listConversations())
    if (userIdRef.current) void pushServerConversation(conv)
  }, [])

  const patch = (id: string, fn: (m: Msg) => Msg) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))

  // Record a per-turn quality label. Optimistic; best-effort POST to the server,
  // which merges it into the stored message's meta (the feedback flywheel input).
  const sendFeedback = (msg: Msg, signal: 'up' | 'down') => {
    if (!msg.storeId || !currentId) return
    patch(msg.id, (m) => ({ ...m, feedback: signal }))
    void fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: currentId, messageId: msg.storeId, signal }),
    }).catch(() => {})
  }

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

  // Stream one turn for a given message history (ending in a user turn). Shared
  // by send, regenerate, and edit-and-resend.
  const runTurn = useCallback(
    async (history: Msg[]) => {
      if (sending) return
      const last = history[history.length - 1]
      if (!last || last.role !== 'user') return
      setSending(true)
      setCapReached(false)

      const cid = currentId ?? convId()
      if (!currentId) setCurrentId(cid)

      const pendingId = mkId()
      setMessages([...history, { id: pendingId, role: 'assistant', content: '', pending: true }])

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
            preferModel: preferModel ?? undefined,
            qualityFloor: qualityFloor || undefined,
          }),
        })
        // Anonymous trial spent → server returns 402; show the signup wall and
        // drop the optimistic pending bubble rather than rendering an error.
        if (res.status === 402) {
          const data = (await res.json().catch(() => ({}))) as { trialExhausted?: boolean }
          if (data.trialExhausted) {
            setMessages(history)
            setTrialRemaining(0)
            setTrialWall(true)
            return
          }
        }
        if (!res.body) throw new Error('no response stream')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handle = (event: string, data: Record<string, unknown>) => {
          if (event === 'decision') {
            const d = data.decision as RouteDecision
            setDecision(d)
            if (d.budget?.budgetUSD) setBudgetCap(d.budget.budgetUSD)
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
          } else if (event === 'escalation') {
            patch(pendingId, (m) => ({ ...m, escalation: data.escalation as Msg['escalation'] }))
          } else if (event === 'memory') {
            // A memory was auto-extracted server-side; nudge the panel to reload.
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('conductor:memory-changed'))
          } else if (event === 'text') {
            patch(pendingId, (m) => ({ ...m, pending: false, content: m.content + String(data.delta ?? '') }))
          } else if (event === 'done') {
            patch(pendingId, (m) => ({
              ...m,
              pending: false,
              simulated: data.simulated as boolean,
              costUSD: data.costUSD as number,
              storeId: (data.messageId as string) || m.storeId,
            }))
            setSpent(data.spentUSD as number)
            if (typeof data.topupUSD === 'number') setCredit(data.topupUSD as number)
            if (typeof data.savedTotalUSD === 'number') setSavedUSD(data.savedTotalUSD as number)
            if (data.capReached) setCapReached(true)
            // Anonymous trial: track turns left + accumulate the savings receipt.
            if (data.anon) {
              if (typeof data.trialRemaining === 'number') setTrialRemaining(data.trialRemaining)
              if (typeof data.savedUSD === 'number') setAnonSaved((s) => s + (data.savedUSD as number))
            }
          } else if (event === 'error') {
            patch(pendingId, (m) => ({ ...m, pending: false, error: true, content: `⚠️ ${data.error}` }))
          }
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
            if (dataStr) {
              try {
                handle(event, JSON.parse(dataStr))
              } catch {
                /* skip a malformed frame rather than aborting the stream */
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          patch(pendingId, (m) => ({ ...m, pending: false, error: true, content: m.content || `⚠️ ${(err as Error).message}` }))
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
    [sending, currentId, spent, agent, preferModel, qualityFloor, persistLocal]
  )

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      const atts = attachments
      if ((!content && atts.length === 0) || sending) return
      // Out of free trial turns (signed-out) → show the wall instead of a doomed
      // request. The server enforces this too (402); this just saves a round-trip.
      if (!user && trialRemainingRef.current !== null && trialRemainingRef.current <= 0) {
        setTrialWall(true)
        return
      }
      const userMsg: Msg = { id: mkId(), role: 'user', content, attachments: atts.length ? atts : undefined }
      const history = [...messagesRef.current, userMsg]
      setInput('')
      setAttachments([])
      requestAnimationFrame(autosize)
      await runTurn(history)
    },
    [attachments, sending, runTurn, user]
  )

  // Buy a top-up credit pack — redirect to Stripe Checkout.
  const buyTopup = useCallback(
    async (packId: string) => {
      if (toppingUp) return
      setToppingUp(packId)
      try {
        window.location.href = await startTopup(packId)
      } catch (e) {
        setToppingUp(null)
        alert((e as Error).message)
      }
    },
    [toppingUp, startTopup]
  )

  // Re-run the most recent user turn, replacing the assistant reply.
  const regenerate = useCallback(async () => {
    if (sending) return
    const msgs = messagesRef.current
    let idx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        idx = i
        break
      }
    }
    if (idx < 0) return
    await runTurn(msgs.slice(0, idx + 1))
  }, [sending, runTurn])

  // Edit a user message and resend from that point (drops everything after it).
  const editResend = useCallback(
    async (id: string, newContent: string) => {
      if (sending) return
      const msgs = messagesRef.current
      const idx = msgs.findIndex((m) => m.id === id)
      if (idx < 0 || msgs[idx].role !== 'user') return
      const edited: Msg = { ...msgs[idx], content: newContent.trim() }
      await runTurn([...msgs.slice(0, idx), edited])
    },
    [sending, runTurn]
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

  const newChat = useCallback(() => {
    setMessages([])
    setDecision(null)
    setAudit([])
    setSpent(0)
    setCurrentId(null)
    setSidebarOpen(false)
  }, [])

  // Global keyboard shortcuts. Overlays with focus traps handle their own
  // Escape (they stop propagation), so this only closes the trapless sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && e.shiftKey && k === 'o') {
        e.preventDefault()
        newChat()
      } else if (mod && k === 'k') {
        e.preventDefault()
        taRef.current?.focus()
      } else if (mod && k === 'b') {
        e.preventDefault()
        setSidebarOpen((s) => !s)
      } else if (e.key === '?' && !mod && !e.altKey) {
        const el = document.activeElement as HTMLElement | null
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (!typing) {
          e.preventDefault()
          setShortcutsOpen(true)
        }
      } else if (e.key === 'Escape') {
        if (abortRef.current) abortRef.current.abort()
        else setSidebarOpen((s) => (s ? false : s))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newChat])

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
    if (userIdRef.current) void deleteServerConversation(id)
  }

  const renameConv = (id: string, title: string) => {
    renameConversation(id, title)
    setConversations(listConversations())
    if (userIdRef.current) void renameServerConversation(id, title.trim().slice(0, 80))
  }

  const exportConv = (id: string) => {
    const conv = loadConversation(id)
    if (!conv) return
    const blob = new Blob([conversationToMarkdown(conv)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conv.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'conversation'}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const empty = messages.length === 0
  const routedLabel = decision?.model?.label
  const pinnedLabel =
    (preferModel && models.find((m) => m.id === preferModel)?.label) ||
    preferModel?.split('/').pop() ||
    ''
  const budgetUtil = budgetCap ? spent / budgetCap : 0

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        currentId={currentId}
        onNew={newChat}
        onSelect={selectConversation}
        onDelete={removeConversation}
        onRename={renameConv}
        onExport={exportConv}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <div className="topbar">
          <button className="iconbtn" onClick={() => setSidebarOpen((s) => !s)} title="Conversations (⌘/Ctrl+B)" aria-label="Conversations">
            <MenuIcon />
          </button>
          <div className="brand">
            <span style={{ color: 'var(--coral)' }}>
              <Burst size={22} />
            </span>
            <span className="name">Conductor</span>
          </div>
          <div className="spacer" />
          <div className="account">
            <button
              className={`model-pill ${preferModel || qualityFloor ? 'pinned' : ''}`}
              onClick={() => setRoutingOpen((o) => !o)}
              title="Routing controls — pin a model or set a quality floor"
              aria-haspopup="dialog"
              aria-expanded={routingOpen}
            >
              <span className="dot" />
              {preferModel ? pinnedLabel : routedLabel ? routedLabel : 'Auto-routed'}
              {preferModel && <span className="pin-mark">📌</span>}
            </button>
            {routingOpen && (
              <RoutingControls
                models={models}
                preferModel={preferModel}
                qualityFloor={qualityFloor}
                routedLabel={routedLabel}
                canPin={planCaps(user?.plan).allowPreferModel}
                maxQualityFloor={planCaps(user?.plan).maxQualityFloor}
                onChange={({ preferModel: pm, qualityFloor: qf }) => {
                  setPreferModel(pm)
                  setQualityFloor(qf)
                }}
                onClose={() => setRoutingOpen(false)}
              />
            )}
          </div>
          {!user && trialRemaining !== null && (
            <span className="trial-pill" title="Free trial — create an account for your own budget, history, and more.">
              {trialRemaining > 0 ? `${trialRemaining} free message${trialRemaining === 1 ? '' : 's'} left` : 'Free trial used'}
            </span>
          )}
          {(user ? savedUSD : anonSaved) >= 0.01 && (
            <span
              className="saved-badge"
              title={`Routing has saved about $${(user ? savedUSD : anonSaved).toFixed(2)} vs. always using the premium model.`}
            >
              saved ${(user ? savedUSD : anonSaved) < 100 ? (user ? savedUSD : anonSaved).toFixed(2) : Math.round(user ? savedUSD : anonSaved)}
            </span>
          )}
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
          <div className="account">
            {!user ? (
              <div className="auth-actions">
                <button className="auth-signin-link" onClick={() => openAuth('signin')}>
                  Sign in
                </button>
                <button className="auth-cta" onClick={() => openAuth('signup')}>
                  Create free account
                </button>
              </div>
            ) : (
              <button
                className="avatar-btn"
                onClick={() => setAccountOpen((o) => !o)}
                title={user?.email}
                aria-label="Account"
              >
                {(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}
              </button>
            )}
            {user && accountOpen && (
              <>
                <div className="account-scrim" onClick={() => setAccountOpen(false)} />
                <div className="account-menu" ref={accountMenuRef} role="dialog" aria-modal="true" aria-label="Account" tabIndex={-1}>
                  <div className="account-head">
                    <div className="account-avatar">
                      {(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="account-id">
                      {user?.name && <div className="account-name">{user.name}</div>}
                      <div className="account-email">{user?.email}</div>
                    </div>
                    <span className="plan-pill">{planById(user?.plan).name}</span>
                  </div>
                  <button
                    className="account-item"
                    onClick={() => {
                      setAccountOpen(false)
                      setPlanOpen(true)
                    }}
                  >
                    Manage plan
                  </button>
                  {user?.referralCode && (
                    <button
                      className="account-item"
                      title="Share your link — you both get $5 of routing credit"
                      onClick={() => {
                        const link = `${window.location.origin}/?ref=${user.referralCode}`
                        navigator.clipboard
                          ?.writeText(link)
                          .then(() => {
                            setRefCopied(true)
                            setTimeout(() => setRefCopied(false), 1600)
                          })
                          .catch(() => {})
                      }}
                    >
                      {refCopied ? 'Referral link copied ✓' : 'Refer & earn — give $5, get $5'}
                    </button>
                  )}
                  <button
                    className="account-item danger"
                    onClick={async () => {
                      setAccountOpen(false)
                      await logout()
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`shell ${panelOpen ? 'panel-open' : ''}`}>
          <div className="conversation" ref={convRef} onScroll={onConvScroll}>
            {empty ? (
              <div className="greeting">
                <span className="burst-lg">
                  <Burst size={56} />
                </span>
                <h1>{greetingText()}</h1>
                <p>
                  {headline ? (
                    <>
                      Same answers, <strong>{headline.costSavingsPct}% cheaper</strong>. Conductor
                      routes every message to the cheapest model that can actually handle it —
                      keeping {headline.qualityRetentionPct}% of premium quality — and shows you
                      which model, and why.
                    </>
                  ) : (
                    <>
                      A general agent that routes every message to the cheapest model that can
                      actually handle it — and shows you which one, and why.
                    </>
                  )}
                </p>
                <div className="capabilities" aria-label="What Conductor can do">
                  <span className="cap">
                    <CodeIcon size={15} /> Code
                  </span>
                  <span className="cap">
                    <SearchIcon size={15} /> Research
                  </span>
                  <span className="cap">
                    <BarsIcon size={15} /> Data
                  </span>
                  <span className="cap">
                    <EyeIcon size={15} /> Vision
                  </span>
                </div>
                <p className="routing-hook">
                  Measured on a public benchmark, not asserted — <a href="/benchmark">see the receipt →</a>
                </p>
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <SponsoredSlot />
              </div>
            ) : (
              <div className="thread">
                {messages.map((m, i) => (
                  <Message
                    key={m.id}
                    msg={m}
                    onInspect={() => {
                      setPanelTab('routing')
                      setPanelOpen(true)
                    }}
                    onEdit={m.role === 'user' && !sending ? editResend : undefined}
                    onRegenerate={
                      m.role === 'assistant' && i === messages.length - 1 && !sending && !m.pending
                        ? regenerate
                        : undefined
                    }
                    onFeedback={
                      m.role === 'assistant' && m.storeId && !m.pending
                        ? (signal) => sendFeedback(m, signal)
                        : undefined
                    }
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            <div className="composer-wrap">
              {!empty && !atBottom && (
                <button className="scroll-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom" title="Scroll to bottom">
                  <ArrowDownIcon />
                </button>
              )}
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
              <div className="composer-hint">
                <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
              </div>
              {!user && trialRemaining !== null && trialRemaining <= 0 && (
                <div className="trial-bar" role="region" aria-label="Free trial used">
                  <span className="trial-bar-label">You’ve used your free messages.</span>
                  <button type="button" className="trial-bar-cta" onClick={() => setTrialWall(true)}>
                    Create a free account to keep going →
                  </button>
                </div>
              )}
              {capReached && billing.enabled && (
                <div className="topup-bar" role="region" aria-label="Out of budget">
                  <span className="topup-label">Out of budget — add credit to keep going:</span>
                  <div className="topup-packs">
                    {TOPUP_PACKS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="topup-pack"
                        disabled={!!toppingUp}
                        onClick={() => buyTopup(p.id)}
                        title={`Pay $${p.priceUSD} for $${p.creditUSD} of routing credit (rolls over)`}
                      >
                        {toppingUp === p.id ? '…' : `$${p.priceUSD}`}
                        <span className="topup-credit">+${p.creditUSD}</span>
                      </button>
                    ))}
                  </div>
                  {user?.plan !== 'max' && (
                    <button type="button" className="topup-upgrade" onClick={() => setPlanOpen(true)}>
                      Upgrade for a bigger budget →
                    </button>
                  )}
                </div>
              )}
              {budgetCap && (
                <div className="composer-budget" title="Session budget — turns throttle near the cap">
                  <div className="cb-bar">
                    <div
                      className={`cb-fill ${budgetUtil > 0.85 ? 'crit' : budgetUtil > 0.6 ? 'warn' : ''}`}
                      style={{ width: `${Math.min(100, budgetUtil * 100)}%` }}
                    />
                  </div>
                  <span className="cb-label">
                    ${spent.toFixed(4)} / ${budgetCap.toFixed(2)}
                    {budgetUtil >= 0.85 ? ' · near cap' : ''}
                  </span>
                  {credit > 0 && (
                    <span className="cb-credit" title="Pay-as-you-go top-up credit (rolls over)">
                      +${credit.toFixed(2)} credit
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="composer-hint">
              Code · web research · data · images — routed by the COO engine, streamed live, simulated until a gateway key is set
            </div>
          </div>

          <aside className={`panel ${panelOpen ? 'show' : ''}`} aria-label="Details panel">
            <div className="panel-tabs" role="tablist" aria-label="Side panel">
              {(['routing', 'memory', 'sandbox'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={panelTab === t}
                  className={`panel-tab ${panelTab === t ? 'active' : ''}`}
                  onClick={() => setPanelTab(t)}
                >
                  {t === 'routing' ? 'Routing' : t === 'memory' ? 'Memory' : 'Sandbox'}
                </button>
              ))}
            </div>
            <div className="panel-body" role="tabpanel" aria-label={`${panelTab} panel`}>
              {panelTab === 'routing' && <OrchestrationPanel decision={decision} audit={audit} />}
              {panelTab === 'memory' && <MemoryPanel />}
              {panelTab === 'sandbox' && <Sandbox />}
            </div>
          </aside>
          {panelOpen && <div className="scrim" onClick={() => setPanelOpen(false)} />}
        </div>
      </div>

      {planOpen && <Pricing mode="manage" onClose={() => setPlanOpen(false)} />}
      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}

      {(authOpen || trialWall) && (
        <AuthFlow
          initialMode={trialWall ? 'signup' : authMode}
          onClose={() => {
            setAuthOpen(false)
            setTrialWall(false)
          }}
          intro={
            trialWall ? (
              <div className="trial-receipt">
                <div className="trial-receipt-title">That’s your free trial</div>
                <p className="trial-receipt-body">
                  Conductor routed every message to the cheapest model that could handle it
                  {anonSaved >= 0.01 ? (
                    <>
                      {' '}
                      — saving about <strong>${anonSaved.toFixed(2)}</strong> vs. always using a premium model
                    </>
                  ) : (
                    ' — keeping each one cheap'
                  )}
                  . Create a free account to keep chatting, save your conversations, and track your savings.
                </p>
              </div>
            ) : undefined
          }
          onAuthenticated={(isNewUser) => {
            setAuthOpen(false)
            setTrialWall(false)
            if (isNewUser) onNewUser?.()
          }}
        />
      )}
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
const ArrowDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7" />
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
