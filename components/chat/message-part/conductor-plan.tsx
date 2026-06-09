import type { DataPart } from '@/ai/messages/data-parts'
import { WandSparklesIcon } from 'lucide-react'

interface Props {
  data: DataPart['conductor-plan']
}

export function ConductorPlan({ data }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-card">
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
            <WandSparklesIcon className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Build Plan
          </span>
        </div>
        <p className="mt-1.5 text-sm text-foreground/80">{data.summary}</p>
      </div>

      <div className="space-y-0 divide-y divide-border/60">
        {data.phases.map((phase, i) => (
          <div key={phase.id} className="flex items-start gap-3 px-4 py-2.5">
            <div className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {phase.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {phase.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
