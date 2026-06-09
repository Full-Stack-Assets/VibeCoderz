import type { DataPart } from '@/ai/messages/data-parts'
import type { UIMessage } from 'ai'
import type { Metadata } from '@/ai/messages/metadata'
import type { ToolSet } from '@/ai/tools'
import {
  WandSparklesIcon,
  CheckCircle2Icon,
  XCircleIcon,
  CircleIcon,
  LoaderIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Part = UIMessage<Metadata, DataPart, ToolSet>['parts'][number]
type PhaseStatus = 'pending' | 'active' | 'done' | 'error'

function mapToolStatus(status: string | undefined): PhaseStatus {
  if (!status) return 'pending'
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  return 'active'
}

function derivePhaseStatus(phaseId: string, allParts: Part[]): PhaseStatus {
  const id = phaseId.toLowerCase()

  if (/sandbox|setup|init|environ/.test(id)) {
    const p = allParts.find((p) => p.type === 'data-create-sandbox') as
      | { data: DataPart['create-sandbox'] }
      | undefined
    return p ? mapToolStatus(p.data.status) : 'pending'
  }

  if (/generat|code|file|write/.test(id)) {
    const p = allParts.find((p) => p.type === 'data-generating-files') as
      | { data: DataPart['generating-files'] }
      | undefined
    return p ? mapToolStatus(p.data.status) : 'pending'
  }

  if (/install|dep|package/.test(id)) {
    const cmds = allParts.filter((p) => p.type === 'data-run-command') as {
      data: DataPart['run-command']
    }[]
    const p = cmds.find((p) =>
      /install/.test(`${p.data.command} ${p.data.args.join(' ')}`)
    )
    return p ? mapToolStatus(p.data.status) : 'pending'
  }

  if (/start|server|dev|run|launch/.test(id)) {
    const cmds = allParts.filter((p) => p.type === 'data-run-command') as {
      data: DataPart['run-command']
    }[]
    const p = cmds.find((p) =>
      /dev|start|serve/.test(`${p.data.command} ${p.data.args.join(' ')}`)
    )
    return p ? mapToolStatus(p.data.status) : 'pending'
  }

  if (/preview|url|link|deploy|access/.test(id)) {
    const p = allParts.find((p) => p.type === 'data-get-sandbox-url') as
      | { data: DataPart['get-sandbox-url'] }
      | undefined
    return p ? mapToolStatus(p.data.status) : 'pending'
  }

  return 'pending'
}

function StatusIcon({ status }: { status: PhaseStatus }) {
  if (status === 'done')
    return (
      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
    )
  if (status === 'error')
    return <XCircleIcon className="h-4 w-4 shrink-0 text-destructive" />
  if (status === 'active')
    return (
      <LoaderIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
    )
  return <CircleIcon className="h-4 w-4 shrink-0 text-border" />
}

interface Props {
  data: DataPart['conductor-plan']
  allParts: Part[]
}

export function ConductorPlan({ data, allParts }: Props) {
  const statuses = data.phases.map((phase) =>
    derivePhaseStatus(phase.id, allParts)
  )
  const allDone = statuses.every((s) => s === 'done')
  const hasError = statuses.some((s) => s === 'error')

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-card">
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
              <WandSparklesIcon className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Build Plan
            </span>
          </div>
          {allDone && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Complete
            </span>
          )}
          {hasError && !allDone && (
            <span className="text-xs font-medium text-destructive">Error</span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-foreground/80">{data.summary}</p>
      </div>

      <div className="divide-y divide-border/60">
        {data.phases.map((phase, i) => {
          const status = statuses[i]
          return (
            <div
              key={phase.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors duration-300',
                status === 'active' && 'bg-primary/[0.04]',
                status === 'done' && 'opacity-60'
              )}
            >
              <StatusIcon status={status} />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-sm font-medium',
                    status === 'active' ? 'text-foreground' : 'text-foreground/80'
                  )}
                >
                  {phase.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {phase.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
