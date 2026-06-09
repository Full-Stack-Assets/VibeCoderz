import type { ChatUIMessage } from './types'
import { MessagePart } from './message-part'
import { SparklesIcon } from 'lucide-react'
import { memo, createContext, useContext, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  message: ChatUIMessage
}

interface ReasoningContextType {
  expandedReasoningIndex: number | null
  setExpandedReasoningIndex: (index: number | null) => void
}

const ReasoningContext = createContext<ReasoningContextType | null>(null)

export const useReasoningContext = () => {
  const context = useContext(ReasoningContext)
  return context
}

export const Message = memo(function Message({ message }: Props) {
  const [expandedReasoningIndex, setExpandedReasoningIndex] = useState<
    number | null
  >(null)

  const reasoningParts = message.parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.type === 'reasoning')

  useEffect(() => {
    if (reasoningParts.length > 0) {
      const latestReasoningIndex =
        reasoningParts[reasoningParts.length - 1].index
      setExpandedReasoningIndex(latestReasoningIndex)
    }
  }, [reasoningParts])

  const isUser = message.role === 'user'

  return (
    <ReasoningContext.Provider
      value={{ expandedReasoningIndex, setExpandedReasoningIndex }}
    >
      {isUser ? (
        <div className="flex justify-end">
          <div className="max-w-[85%] space-y-1.5 rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground">
            {message.parts.map((part, index) => (
              <MessagePart key={index} part={part} partIndex={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground'
            )}
            aria-hidden
          >
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            {message.parts.map((part, index) => (
              <MessagePart key={index} part={part} partIndex={index} />
            ))}
          </div>
        </div>
      )}
    </ReasoningContext.Provider>
  )
})
