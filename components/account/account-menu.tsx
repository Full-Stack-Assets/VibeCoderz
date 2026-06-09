'use client'

import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CoinsIcon, LogOutIcon, CreditCardIcon, ZapIcon } from 'lucide-react'
import { PLANS } from '@/lib/billing'
import { toast } from 'sonner'

interface Me {
  id: string
  email: string
  name: string | null
  plan: string
  creditsBalance: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('unauthenticated')
  return res.json()
}

export function AccountMenu() {
  const router = useRouter()
  const { data: me, mutate, isLoading } = useSWR<Me>('/api/auth/me', fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  })

  if (isLoading) {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-secondary" />
  }

  if (!me) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() => router.push('/login')}
      >
        Sign in
      </Button>
    )
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    mutate(undefined, { revalidate: false })
    router.push('/login')
    router.refresh()
  }

  async function buy(plan: string) {
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Checkout unavailable')
      }
      window.location.href = data.url
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Checkout is not available yet'
      )
    }
  }

  async function manageBilling() {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Unavailable')
      window.location.href = data.url
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Billing portal unavailable'
      )
    }
  }

  const low = me.creditsBalance <= 10

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer font-mono"
          title="Account & credits"
        >
          <CoinsIcon
            className={low ? 'text-destructive' : 'text-muted-foreground'}
          />
          <span className={low ? 'text-destructive' : ''}>
            {me.creditsBalance}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 font-mono">
        <div className="mb-3">
          <p className="truncate text-sm font-semibold">{me.email}</p>
          <p className="text-xs uppercase text-muted-foreground">
            {me.plan} plan · {me.creditsBalance} credits
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase text-muted-foreground">Buy credits</p>
          {Object.values(PLANS)
            .filter((p) => p.mode === 'subscription')
            .map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                size="sm"
                className="w-full cursor-pointer justify-between"
                onClick={() => buy(p.id)}
              >
                <span className="flex items-center">
                  <ZapIcon className="mr-2 h-3.5 w-3.5" />
                  {p.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ${p.priceUsd}/mo · {p.credits}
                </span>
              </Button>
            ))}
          <Button
            variant="secondary"
            size="sm"
            className="w-full cursor-pointer justify-between"
            onClick={() => buy('topup')}
          >
            <span className="flex items-center">
              <CoinsIcon className="mr-2 h-3.5 w-3.5" />
              {PLANS.topup.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ${PLANS.topup.priceUsd} · {PLANS.topup.credits}
            </span>
          </Button>
        </div>

        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer justify-start"
            onClick={manageBilling}
          >
            <CreditCardIcon className="mr-2 h-3.5 w-3.5" />
            Manage billing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer justify-start"
            onClick={logout}
          >
            <LogOutIcon className="mr-2 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
