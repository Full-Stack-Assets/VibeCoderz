import type { Command, CommandLog } from '@/components/commands-logs/types'
import type { DataPart } from '@/ai/messages/data-parts'
import type { ChatStatus, DataUIPart } from 'ai'
import { useMonitorState } from '@/components/error-monitor/state'
import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SandboxStore {
  addGeneratedFiles: (files: string[]) => void
  addLog: (data: { sandboxId: string; cmdId: string; log: CommandLog }) => void
  addPaths: (paths: string[]) => void
  chatStatus: ChatStatus
  clearGeneratedFiles: () => void
  clearSession: () => void
  commands: Command[]
  generatedFiles: Set<string>
  paths: string[]
  sandboxId?: string
  savedProjectId?: string
  setSavedProjectId: (id: string) => void
  setChatStatus: (status: ChatStatus) => void
  setSandboxId: (id: string) => void
  setStatus: (status: 'running' | 'stopped') => void
  setUrl: (url: string, uuid: string) => void
  status?: 'running' | 'stopped'
  upsertCommand: (command: Omit<Command, 'startedAt'>) => void
  url?: string
  urlUUID?: string
}

function getBackgroundCommandErrorLines(commands: Command[]) {
  return commands
    .flatMap(({ command, args, background, logs = [] }) =>
      logs.map((log) => ({ command, args, background, ...log }))
    )
    .sort((logA, logB) => logA.timestamp - logB.timestamp)
    .filter((log) => log.stream === 'stderr' && log.background)
}

export function useCommandErrorsLogs() {
  const { commands } = useSandboxStore()
  const errors = useMemo(
    () => getBackgroundCommandErrorLines(commands),
    [commands]
  )
  return { errors }
}

const PERSISTED_SANDBOX_KEYS: (keyof SandboxStore)[] = [
  'sandboxId',
  'url',
  'urlUUID',
  'paths',
  'status',
  'savedProjectId',
]

const initialSandboxState = {
  chatStatus: 'ready' as ChatStatus,
  commands: [] as Command[],
  generatedFiles: new Set<string>(),
  paths: [] as string[],
  sandboxId: undefined,
  savedProjectId: undefined,
  status: undefined,
  url: undefined,
  urlUUID: undefined,
}

export const useSandboxStore = create<SandboxStore>()(
  persist(
    (set) => ({
      ...initialSandboxState,
      addGeneratedFiles: (files) =>
        set((state) => ({
          generatedFiles: new Set([...state.generatedFiles, ...files]),
        })),
      addLog: (data) => {
        set((state) => {
          const idx = state.commands.findIndex((c) => c.cmdId === data.cmdId)
          if (idx === -1) {
            console.warn(`Command with ID ${data.cmdId} not found.`)
            return state
          }
          const updatedCmds = [...state.commands]
          updatedCmds[idx] = {
            ...updatedCmds[idx],
            logs: [...(updatedCmds[idx].logs ?? []), data.log],
          }
          return { commands: updatedCmds }
        })
      },
      addPaths: (paths) =>
        set((state) => ({ paths: [...new Set([...state.paths, ...paths])] })),
      clearGeneratedFiles: () => set(() => ({ generatedFiles: new Set<string>() })),
      clearSession: () => {
        localStorage.removeItem('chat-messages')
        localStorage.removeItem('prompt-input')
        set(() => ({ ...initialSandboxState, generatedFiles: new Set<string>() }))
      },
      setSavedProjectId: (id) => set(() => ({ savedProjectId: id })),
      setChatStatus: (status) =>
        set((state) =>
          state.chatStatus === status ? state : { chatStatus: status }
        ),
      setSandboxId: (sandboxId) =>
        set(() => ({
          sandboxId,
          status: 'running',
          commands: [],
          paths: [],
          url: undefined,
          savedProjectId: undefined,
          generatedFiles: new Set<string>(),
        })),
      setStatus: (status) => set(() => ({ status })),
      setUrl: (url, urlUUID) => set(() => ({ url, urlUUID })),
      upsertCommand: (cmd) => {
        set((state) => {
          const existingIdx = state.commands.findIndex((c) => c.cmdId === cmd.cmdId)
          const idx = existingIdx !== -1 ? existingIdx : state.commands.length
          const prev = state.commands[idx] ?? { startedAt: Date.now(), logs: [] }
          const cmds = [...state.commands]
          cmds[idx] = { ...prev, ...cmd }
          return { commands: cmds }
        })
      },
    }),
    {
      name: 'sandbox-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) =>
        Object.fromEntries(
          PERSISTED_SANDBOX_KEYS.map((k) => [k, state[k]])
        ) as Pick<SandboxStore, (typeof PERSISTED_SANDBOX_KEYS)[number]>,
    }
  )
)

interface FileExplorerStore {
  paths: string[]
  addPath: (path: string) => void
}

export const useFileExplorerStore = create<FileExplorerStore>()((set) => ({
  paths: [],
  addPath: (path) => {
    set((state) => {
      if (!state.paths.includes(path)) {
        return { paths: [...state.paths, path] }
      }
      return state
    })
  },
}))

export function useDataStateMapper() {
  const { addPaths, setSandboxId, setUrl, upsertCommand, addGeneratedFiles } =
    useSandboxStore()
  const { errors } = useCommandErrorsLogs()
  const { setCursor } = useMonitorState()

  return (data: DataUIPart<DataPart>) => {
    switch (data.type) {
      case 'data-create-sandbox':
        if (data.data.sandboxId) {
          setSandboxId(data.data.sandboxId)
        }
        break
      case 'data-generating-files':
        if (data.data.status === 'uploaded') {
          setCursor(errors.length)
          addPaths(data.data.paths)
          addGeneratedFiles(data.data.paths)
        }
        break
      case 'data-run-command':
        if (
          data.data.commandId &&
          (data.data.status === 'executing' || data.data.status === 'running')
        ) {
          upsertCommand({
            background: data.data.status === 'running',
            sandboxId: data.data.sandboxId,
            cmdId: data.data.commandId,
            command: data.data.command,
            args: data.data.args,
          })
        }
        break
      case 'data-get-sandbox-url':
        if (data.data.url) {
          setUrl(data.data.url, crypto.randomUUID())
        }
        break
      default:
        break
    }
  }
}
