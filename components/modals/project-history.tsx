'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FolderOpenIcon, ExternalLinkIcon, Trash2Icon, HistoryIcon } from 'lucide-react'
import { create } from 'zustand'
import { toast } from 'sonner'
import useSWR, { mutate as swrMutate } from 'swr'

interface State {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useProjectHistoryStore = create<State>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

interface Project {
  id: string
  name: string
  description: string | null
  prompt: string
  sandboxId: string | null
  githubUrl: string | null
  createdAt: string
  modelUsed: string | null
  status: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ProjectHistory() {
  const { open, setOpen } = useProjectHistoryStore()
  const { data: projects, isLoading } = useSWR<Project[]>(
    open ? '/api/projects' : null,
    fetcher
  )

  async function deleteProject(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      swrMutate('/api/projects')
      toast.success('Project deleted')
    } catch {
      toast.error('Failed to delete project')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase text-sm tracking-tight">
            <FolderOpenIcon className="w-4 h-4" />
            Saved Projects
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading…
          </p>
        )}

        {!isLoading && projects?.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No saved projects yet. Projects are saved automatically when the AI
            finishes building.
          </p>
        )}

        {!isLoading && projects && projects.length > 0 && (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.prompt}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {p.modelUsed && (
                      <span className="text-xs text-muted-foreground">
                        {p.modelUsed.split('/').pop()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.githubUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 w-7 p-0"
                    >
                      <a
                        href={p.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on GitHub"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteProject(p.id)}
                    title="Delete project"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ToggleProjectHistory() {
  const { setOpen } = useProjectHistoryStore()
  return (
    <Button
      className="cursor-pointer"
      onClick={() => setOpen(true)}
      variant="outline"
      size="sm"
    >
      <HistoryIcon className="w-4 h-4" />
      <span className="hidden lg:inline">Projects</span>
    </Button>
  )
}
