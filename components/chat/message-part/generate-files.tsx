'use client'

import type { DataPart } from '@/ai/messages/data-parts'
import { CheckIcon, CloudUploadIcon, XIcon } from 'lucide-react'
import { Spinner } from './spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { useSandboxStore } from '@/app/state'
import { useOpenFileExplorer } from '@/components/modals/file-explorer'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  message: DataPart['generating-files']
}

export function GenerateFiles({ className, message }: Props) {
  const openFile = useOpenFileExplorer()
  // Snapshot the paths that existed before this generation started.
  const { paths: storePaths, sandboxId } = useSandboxStore()
  const preExisting = useRef(new Set(storePaths))

  const [hoveredPath, setHoveredPath] = useState<string | null>(null)

  const isDone = message.status === 'done'
  const lastInProgress = ['error', 'uploading', 'generating'].includes(
    message.status
  )

  // When done and per-file metadata is available, render the enriched view.
  if (isDone && message.files && message.files.length > 0) {
    return (
      <ToolMessage className={className}>
        <ToolHeader>
          <CloudUploadIcon className="h-3.5 w-3.5" />
          <span>
            Uploaded {message.files.length} file
            {message.files.length !== 1 ? 's' : ''}
          </span>
        </ToolHeader>
        <div className="mt-0.5 space-y-0.5 text-sm">
          {message.files.map((file) => {
            const isNew = !preExisting.current.has(file.path)
            const clickable = !!sandboxId
            return (
              <div
                key={file.path}
                className={cn(
                  'flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
                  clickable && 'cursor-pointer hover:bg-accent/50'
                )}
                onClick={() => clickable && openFile(file.path)}
                onMouseEnter={() => setHoveredPath(file.path)}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <CheckIcon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate whitespace-pre-wrap',
                    hoveredPath === file.path && 'underline'
                  )}
                >
                  {file.path}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {file.lines} lines
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1 text-xs font-semibold',
                    isNew
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                  )}
                >
                  {isNew ? 'NEW' : 'MOD'}
                </span>
              </div>
            )
          })}
        </div>
      </ToolMessage>
    )
  }

  // Streaming / uploading / error state (original UI).
  const generated = lastInProgress
    ? message.paths.slice(0, message.paths.length - 1)
    : message.paths

  const generating = lastInProgress
    ? message.paths[message.paths.length - 1] ?? ''
    : null

  return (
    <ToolMessage className={className}>
      <ToolHeader>
        <CloudUploadIcon className="h-3.5 w-3.5" />
        <span>
          {isDone ? 'Uploaded files' : 'Generating files'}
        </span>
      </ToolHeader>
      <div className="relative min-h-5 text-sm">
        {generated.map((path, index) => (
          <div className="flex items-center" key={index}>
            <CheckIcon className="mx-1 h-4 w-4" />
            <span className="whitespace-pre-wrap">{path}</span>
          </div>
        ))}
        {typeof generating === 'string' && (
          <div className="flex">
            <Spinner
              className="mr-1"
              loading={message.status !== 'error'}
            >
              {message.status === 'error' ? (
                <XIcon className="h-4 w-4 text-red-700" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
            </Spinner>
            <span>{generating}</span>
          </div>
        )}
      </div>
    </ToolMessage>
  )
}
