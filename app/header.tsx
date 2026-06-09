'use client'

import { ToggleProjectHistory, ProjectHistory } from '@/components/modals/project-history'
import { AccountMenu } from '@/components/account/account-menu'
import { VercelDashed } from '@/components/icons/vercel-dashed'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export function Header({ className }: Props) {
  return (
    <>
      <header className={cn('flex items-center justify-between', className)}>
        <div className="flex items-center">
          <VercelDashed className="ml-1 md:ml-2.5 mr-1.5" />
          <span className="hidden md:inline text-sm uppercase font-mono font-bold tracking-tight">
            OSS Vibe Coding Platform
          </span>
        </div>
        <div className="flex items-center ml-auto space-x-1.5">
          <ToggleProjectHistory />
          <AccountMenu />
        </div>
      </header>
      <ProjectHistory />
    </>
  )
}
