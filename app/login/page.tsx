'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VercelDashed } from '@/components/icons/vercel-dashed'
import { GithubIcon } from '@/components/icons/github'
import { SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { SIGNUP_CREDIT_GRANT } from '@/lib/billing'

type Stage = 'email' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not send the code')
      }
      setStage('code')
      toast.success('Check your email', {
        description: 'We sent a 6-digit code and a sign-in link. Both expire in 10 minutes.',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Invalid code')
      }
      const user = await res.json()
      toast.success(`Welcome${user.name ? `, ${user.name}` : ''}!`, {
        description: `You have ${user.creditsBalance} credits available.`,
      })
      router.push('/')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <VercelDashed className="mb-4 h-8 w-8" />
          <h1 className="font-mono text-lg font-bold uppercase tracking-tight">
            OSS Vibe Coding Platform
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with email to start building. New accounts get{' '}
            <span className="font-semibold text-foreground">
              {SIGNUP_CREDIT_GRANT} free credits
            </span>
            .
          </p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 p-6 shadow-sm">
          {stage === 'email' ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono text-xs uppercase">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={loading || !email.trim()}
              >
                <SparklesIcon className="mr-2 h-4 w-4" />
                {loading ? 'Sending…' : 'Email me a sign-in code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="font-mono text-xs uppercase">
                  6-digit code
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
                <p className="text-xs text-muted-foreground">
                  Sent to {email}. You can also click the link in that email.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={loading || !code.trim()}
              >
                {loading ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <button
                type="button"
                className="w-full text-center font-mono text-xs uppercase text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStage('email')
                  setCode('')
                }}
              >
                ← Use a different email
              </button>
            </form>
          )}

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-xs uppercase text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() =>
              toast.info('GitHub sign-in is coming soon', {
                description: 'OAuth via arctic is on the roadmap — see docs/CREDITS_PLAN.md.',
              })
            }
          >
            <GithubIcon className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to the demo terms. This is a demonstration
          platform; do not store sensitive data.
        </p>
      </div>
    </div>
  )
}
