'use client'

import type { ChatUIMessage } from '@/components/chat/types'
import { CHAT_MESSAGES_KEY } from '@/lib/chat-context'
import { MODEL_NAMES } from '@/ai/constants'
import { MessageCircleIcon, SendIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Input } from '@/components/ui/input'
import { Message } from '@/components/chat/message'
import { ModelSelector } from '@/components/settings/model-selector'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { Settings } from '@/components/settings/settings'
import { TEST_PROMPTS } from '@/ai/constants'
import { useChat } from '@ai-sdk/react'
import { useLocalStorageValue } from '@/lib/use-local-storage-value'
import { useCallback, useEffect, useRef } from 'react'
import { useSharedChatContext } from '@/lib/chat-context'
import { useSettings } from '@/components/settings/use-settings'
import { useSandboxStore } from './state'
import { toast } from 'sonner'

interface Props {
  className: string
}

export function Chat({ className }: Props) {
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

  // Show a one-time toast when a previous session is hydrated.
  const restoredToastShown = useRef(false)
  useEffect(() => {
    if (hasRestoredSession && !restoredToastShown.current && messages.length > 0) {
      restoredToastShown.current = true
      toast.info('Previous session restored.', {
        description: 'Your last conversation has been loaded.',
        action: {
          label: 'New session',
          onClick: handleNewSession,
        },
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
      if (status === 'streaming' || status === 'submitted') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [status])

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
      const prompt = firstUserMsg?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join(' ')
        ?? ''
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
          if (saved?.id) {
            setSavedProjectId(saved.id)
            toast.success('Project saved', {
              description: 'Find it under Projects in the header.',
            })
          }
        })
        .catch(() => {
          // Non-fatal — DB may not be configured.
          autoSaveAttempted.current = false
        })
    }
  }, [status, sandboxId, url, savedProjectId, messages, modelId, paths, setSavedProjectId])

  // Reset the auto-save ref when a new sandbox session starts.
  useEffect(() => {
    if (!sandboxId) {
      autoSaveAttempted.current = false
    }
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

  return (
    <Panel className={className}>
      <PanelHeader>
        <div className="flex items-center font-mono font-semibold uppercase">
          <MessageCircleIcon className="mr-2 w-4" />
          Chat
        </div>
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs font-mono opacity-60 hover:opacity-100"
              onClick={handleNewSession}
              title="Start a new session"
            >
              <PlusIcon className="w-3 h-3 mr-1" />
              New
            </Button>
          )}
          <span className="font-mono text-xs opacity-50">[{status}]</span>
        </div>
      </PanelHeader>

      {/* Messages Area */}
      {messages.length === 0 ? (
        <div className="flex-1 min-h-0">
          <div className="flex flex-col justify-center items-center h-full font-mono text-sm text-muted-foreground">
            <p className="flex items-center font-semibold">
              Click and try one of these prompts:
            </p>
            <ul className="p-4 space-y-1 text-center">
              {TEST_PROMPTS.map((prompt, idx) => (
                <li
                  key={idx}
                  className="px-4 py-2 rounded-sm border border-dashed shadow-sm cursor-pointer border-border hover:bg-secondary/50 hover:text-primary"
                  onClick={() => validateAndSubmitMessage(prompt)}
                >
                  {prompt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <Conversation className="relative w-full">
          <ConversationContent className="space-y-4">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <form
        className="flex items-center p-2 space-x-1 border-t border-primary/18 bg-background"
        onSubmit={async (event) => {
          event.preventDefault()
          validateAndSubmitMessage(input)
        }}
      >
        <Settings />
        <ModelSelector />
        <Input
          className="w-full font-mono text-sm rounded-sm border-0 bg-background"
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              validateAndSubmitMessage(input)
            }
          }}
          placeholder="Type your message… (⌘↵ to send)"
          value={input}
        />
        <Button type="submit" disabled={status !== 'ready' || !input.trim()}>
          <SendIcon className="w-4 h-4" />
        </Button>
      </form>
    </Panel>
  )
}
