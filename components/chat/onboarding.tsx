'use client'

import {
  SUGGESTED_PROMPTS,
  SKILLS,
  PROMPT_TIPS,
  type Skill,
} from '@/ai/constants'
import {
  ArrowUpRightIcon,
  LayersIcon,
  ServerIcon,
  CodeIcon,
  GlobeIcon,
  BugIcon,
  TerminalIcon,
  LightbulbIcon,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Layers: LayersIcon,
  Server: ServerIcon,
  Code: CodeIcon,
  Globe: GlobeIcon,
  Bug: BugIcon,
  Terminal: TerminalIcon,
}

function SkillCard({ skill }: { skill: Skill }) {
  const Icon = ICONS[skill.icon] ?? CodeIcon
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold text-foreground">{skill.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
    </div>
  )
}

interface Props {
  onSelect: (prompt: string) => void
}

export function ChatOnboarding({ onSelect }: Props) {
  return (
    <div className="mt-6 space-y-8">
      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(prompt)}
            className="group flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {prompt}
            <ArrowUpRightIcon className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        ))}
      </div>

      {/* Skills */}
      <section>
        <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What I can help you build
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((skill) => (
            <SkillCard key={skill.title} skill={skill} />
          ))}
        </div>
      </section>

      {/* Prompting tips */}
      <section>
        <h2 className="mb-3 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <LightbulbIcon className="h-3.5 w-3.5" />
          Tips for accurate results
        </h2>
        <ul className="mx-auto max-w-xl space-y-2.5">
          {PROMPT_TIPS.map((tip, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                {idx + 1}
              </span>
              <p className="text-sm text-foreground">
                <span className="font-medium">{tip.title}.</span>{' '}
                <span className="text-muted-foreground">{tip.description}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
