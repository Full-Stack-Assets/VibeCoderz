'use client'

import { type ChatUIMessage } from '@/components/chat/types'
import { type ReactNode } from 'react'
import { Chat } from '@ai-sdk/react'
import { DataPart } from '@/ai/messages/data-parts'
import { DataUIPart } from 'ai'
import { createContext, useContext, useMemo, useRef } from 'react'
import { useDataStateMapper } from '@/app/state'
import { mutate } from 'swr'
import { toast } from 'sonner'

export const CHAT_MESSAGES_KEY = 'chat-messages'

interface ChatContextValue {
  chat: Chat<ChatUIMessage>
  hasRestoredSession: boolean
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const mapDataToState = useDataStateMapper()
  const mapDataToStateRef = useRef(mapDataToState)
  mapDataToStateRef.current = mapDataToState

  const { chat, hasRestoredSession } = useMemo(() => {
    let initialMessages: ChatUIMessage[] | undefined
    let restored = false
    try {
      const raw = localStorage.getItem(CHAT_MESSAGES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatUIMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialMessages = parsed
          restored = true
        }
      }
    } catch {
      // Corrupted storage — start fresh
    }

    return {
      chat: new Chat<ChatUIMessage>({
        messages: initialMessages,
        onToolCall: () => mutate('/api/auth/info'),
        onData: (data: DataUIPart<DataPart>) => mapDataToStateRef.current(data),
        onError: (error) => {
          toast.error(`Communication error with the AI: ${error.message}`)
          console.error('Error sending message:', error)
        },
      }),
      hasRestoredSession: restored,
    }
  }, [])

  return (
    <ChatContext.Provider value={{ chat, hasRestoredSession }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useSharedChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useSharedChatContext must be used within a ChatProvider')
  }
  return context
}
