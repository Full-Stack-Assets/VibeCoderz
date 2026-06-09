'use client'

import type { ChatUIMessage } from '@/components/chat/types'
import { CHAT_MESSAGES_KEY } from '@/lib/chat-context'
import { ArrowUpIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Input } from '@/components/ui/input'
import { Message } from '@/components/chat/message'
import { ModelSelector } from '@/components/settings/model-selector'
import { Settings } from '@/components/settings/settings'
import {
  ToggleProjectHistory,
  ProjectHistory,
} from '@/components/modals/project-history'
import { AccountMenu } from '@/components/account/account-menu'
import { ChatOnboarding } from '@/components/chat/onboarding'
import { ThemeToggle } from '@/components/theme-toggle'
import { BILLING_ENABLED } from '@/lib/billing'
import { useChat } from '@ai-sdk/react'
import { useLocalStorageValue } from '@/lib/use-local-storage-value'
import { useCallback, useEffect, useRef } from 'react'
import { useSharedChatContext } from '@/lib/chat-context'
import { useSettings } from '@/components/settings/use-settings'
import { useSandboxStore } from './state'
import { toast } from 'sonner'

export function Chat() {
  const [input, setInput] = useLocalStorageValue('prompt-input')
  const { chat, hasRestoredSession } = useSharedChatContext()
  const { modelId, reasoningEffort } = useSettings()
  const { messages, sendMessage, status } = useChat<ChatUIMessage>({ chat })
  const {
    setChatStatus,
    sandboxId,
    url,
    clearSession,
    savedProjectId,
    setSavedProjectId,
    paths,
  } = useSandboxStore()

  const busy = status === 'streaming' || status === 'submitted'

  // Show a one-time toast when a previous session is hydrated.
  const restoredToastShown = useRef(false)
  useEffect(() => {
    if (hasRestoredSession && !restoredToastShown.current && messages.length > 0) {
      restoredToastShown.current = true
      toast.info('Previous conversation restored.', {
        action: { label: 'New chat', onClick: handleNewSession },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRestoredSession, messages.length])

  // Persist messages to localStorage on every change.
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages))
      } catch {
        // Storage quota exceeded — non-fatal
      }
    }
  }, [messages])

  // Warn before leaving while the AI is streaming.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (busy) e.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [busy])

  useEffect(() => {
    setChatStatus(status)
  }, [status, setChatStatus])

  // Auto-save to DB when the AI finishes and a sandbox URL exists.
  const autoSaveAttempted = useRef(false)
  useEffect(() => {
    if (
      status === 'ready' &&
      sandboxId &&
      url &&
      !savedProjectId &&
      !autoSaveAttempted.current &&
      messages.length > 0
    ) {
      autoSaveAttempted.current = true
      const firstUserMsg = messages.find((m) => m.role === 'user')
      const prompt =
        firstUserMsg?.parts
          ?.filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join(' ') ?? ''
      const name = prompt.slice(0, 80) || 'Untitled project'

      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          prompt,
          code: JSON.stringify({ sandboxUrl: url, files: paths }),
          modelUsed: modelId,
          sandboxId,
        }),
      })
        .then((r) => r.json())
        .then((saved) => {
          if (saved?.id) setSavedProjectId(saved.id)
        })
        .catch(() => {
          autoSaveAttempted.current = false
        })
    }
  }, [status, sandboxId, url, savedProjectId, messages, modelId, paths, setSavedProjectId])

  useEffect(() => {
    if (!sandboxId) autoSaveAttempted.current = false
  }, [sandboxId])

  const validateAndSubmitMessage = useCallback(
    (text: string) => {
      if (text.trim()) {
        sendMessage({ text }, { body: { modelId, reasoningEffort } })
        setInput('')
      }
    },
    [sendMessage, modelId, setInput, reasoningEffort]
  )

  function handleNewSession() {
    clearSession()
    window.location.reload()
  }

  const composer = (
    <form
      className="rounded-3xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:border-primary/40"
      onSubmit={(event) => {
        event.preventDefault()
        validateAndSubmitMessage(input)
      }}
    >
      <Input
        className="w-full border-0 bg-transparent px-2 py-1.5 text-base shadow-none focus-visible:ring-0"
        disabled={busy}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            validateAndSubmitMessage(input)
          }
        }}
        placeholder="Reply to Studio…"
        value={input}
      />
      <div className="mt-1 flex items-center gap-1">
        <Settings />
        <ModelSelector />
        <Button
          type="submit"
          size="icon"
          className="ml-auto h-8 w-8 rounded-full"
          disabled={status !== 'ready' || !input.trim()}
          aria-label="Send message"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleNewSession}
          title="New chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New chat</span>
        </Button>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <ToggleProjectHistory />
          {BILLING_ENABLED && <AccountMenu />}
        </div>
      </header>

      {messages.length === 0 ? (
        /* Empty state — greeting, composer, and onboarding (scrollable) */
        <div className="flex-1 overflow-y-auto px-4">
          <div className="mx-auto w-full max-w-3xl py-10 sm:py-14">
            <h1 className="mb-6 text-center font-serif text-3xl text-foreground">
              How can I help you today?
            </h1>
            <div className="mx-auto max-w-2xl">{composer}</div>
            <ChatOnboarding onSelect={validateAndSubmitMessage} />
          </div>
        </div>
      ) : (
        /* Conversation */
        <>
          <Conversation className="relative w-full flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
        </>
      )}

      <ProjectHistory />
    </div>
  )
}
