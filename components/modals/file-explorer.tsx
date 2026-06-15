'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useSandboxStore } from '@/app/state'
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Files,
  LoaderIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useCallback } from 'react'
import { create } from 'zustand'

// ── shared open/close state ───────────────────────────────────────────────────

interface ExplorerDialogStore {
  open: boolean
  selectedPath: string | null
  setOpen: (v: boolean) => void
  openFile: (path: string) => void
}

const useExplorerDialog = create<ExplorerDialogStore>((set) => ({
  open: false,
  selectedPath: null,
  setOpen: (open) => set({ open }),
  openFile: (path) => set({ open: true, selectedPath: path }),
}))

/** Open the file explorer at a specific path — usable outside this module. */
export function useOpenFileExplorer() {
  return useExplorerDialog((s) => s.openFile)
}

// ── file tree helpers ─────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  fullPath: string
  type: 'file' | 'dir'
  children: TreeNode[]
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const rawPath of [...paths].sort()) {
    const parts = rawPath.split('/').filter(Boolean)
    let level = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const fullPath = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1

      let existing = level.find((n) => n.name === name)
      if (!existing) {
        existing = { name, fullPath, type: isFile ? 'file' : 'dir', children: [] }
        level.push(existing)
      }
      if (!isFile) level = existing.children
    }
  }

  return root
}

// ── tree node renderer ────────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isDir = node.type === 'dir'
  const isSelected = node.fullPath === selectedPath

  return (
    <>
      <button
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/80 hover:bg-accent hover:text-foreground'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          if (isDir) {
            setExpanded((e) => !e)
          } else {
            onSelect(node.fullPath)
          }
        }}
      >
        {isDir ? (
          <>
            <ChevronRightIcon
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                expanded && 'rotate-90'
              )}
            />
            {expanded ? (
              <FolderOpenIcon className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
            ) : (
              <FolderIcon className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
            )}
          </>
        ) : (
          <>
            <span className="h-3.5 w-3.5 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="min-w-0 truncate">{node.name}</span>
      </button>

      {isDir && expanded && node.children.map((child) => (
        <TreeNodeRow
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ── content viewer ────────────────────────────────────────────────────────────

function FileViewer({ sandboxId, path }: { sandboxId: string; path: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  if (path !== lastFetched && !loading) {
    setLoading(true)
    setError(null)
    setLastFetched(path)
    fetch(`/api/sandbox/file?sandboxId=${encodeURIComponent(sandboxId)}&path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setContent(data.content)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-4 text-xs leading-relaxed text-foreground/90 font-mono whitespace-pre-wrap break-all">
        {content ?? ''}
      </pre>
    </ScrollArea>
  )
}

// ── main components ───────────────────────────────────────────────────────────

export function ToggleFileExplorer() {
  const { setOpen } = useExplorerDialog()
  const { paths, sandboxId } = useSandboxStore()

  if (!sandboxId || paths.length === 0) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
      title="File explorer"
      onClick={() => setOpen(true)}
    >
      <Files className="h-4 w-4" />
    </Button>
  )
}

export function FileExplorer() {
  const { open, setOpen, selectedPath, openFile } = useExplorerDialog()
  const { paths, sandboxId } = useSandboxStore()

  const tree = buildTree(paths)

  const handleSelect = useCallback((path: string) => {
    openFile(path)
  }, [openFile])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex h-[80vh] max-w-4xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">
              Files
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {paths.length} file{paths.length !== 1 ? 's' : ''}
              </span>
            </DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              ✕
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* File tree */}
          <div className="w-56 shrink-0 border-r border-border">
            <ScrollArea className="h-full py-2">
              {tree.map((node) => (
                <TreeNodeRow
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={handleSelect}
                />
              ))}
            </ScrollArea>
          </div>

          {/* Content viewer */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selectedPath ? (
              <>
                <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-2 text-xs font-mono text-muted-foreground">
                  {selectedPath}
                </div>
                <div className="min-h-0 flex-1">
                  {sandboxId && (
                    <FileViewer
                      key={selectedPath}
                      sandboxId={sandboxId}
                      path={selectedPath}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileIcon className="h-8 w-8 opacity-30" />
                <p className="text-sm">Select a file to view its contents</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
