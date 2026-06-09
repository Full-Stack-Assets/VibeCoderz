'use client'

import type { DataPart } from '@/ai/messages/data-parts'
import {
  CheckIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MonitorIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { Spinner } from './spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { Button } from '@/components/ui/button'
import { useCallback, useState } from 'react'

export function GetSandboxURL({
  message,
}: {
  message: DataPart['get-sandbox-url']
}) {
  const [showPreview, setShowPreview] = useState(true)
  const [iframeKey, setIframeKey] = useState(0)
  const handleRefresh = useCallback(() => setIframeKey((k) => k + 1), [])

  return (
    <div className="space-y-2">
      <ToolMessage>
        <ToolHeader>
          <GlobeIcon className="h-3.5 w-3.5" />
          <span>Preview URL</span>
        </ToolHeader>
        <div className="relative min-h-5 pl-6">
          <Spinner
            className="absolute left-0 top-0"
            loading={message.status === 'loading'}
          >
            <CheckIcon className="h-4 w-4" />
          </Spinner>
          {message.url ? (
            <div className="flex items-center gap-2">
              <a
                href={message.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate text-primary hover:underline"
              >
                {message.url}
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6 shrink-0"
                onClick={() => setShowPreview((p) => !p)}
                title={showPreview ? 'Hide preview' : 'Show preview'}
              >
                {showPreview ? (
                  <XIcon className="h-3 w-3" />
                ) : (
                  <MonitorIcon className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <span>Getting Sandbox URL…</span>
          )}
        </div>
      </ToolMessage>

      {message.url && showPreview && (
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
            </div>
            <div className="flex-1 truncate rounded-md bg-background px-2 py-0.5 text-center text-xs text-muted-foreground">
              {message.url}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleRefresh}
                title="Refresh"
              >
                <RefreshCwIcon className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                asChild
              >
                <a
                  href={message.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setShowPreview(false)}
                title="Hide preview"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <iframe
            key={iframeKey}
            src={message.url}
            className="h-[520px] w-full border-0 bg-white"
            title="App preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      )}
    </div>
  )
}
