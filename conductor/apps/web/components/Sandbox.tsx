'use client'

import { useState } from 'react'

interface ToolResult {
  ok: boolean
  output?: string
  error?: string
  sandbox?: string
}

// A minimal window into the agent's sandbox: run a command through the same
// /api/tools/execute surface the COO-routed model uses during agentic turns.
// Simulated by default; CONDUCTOR_SANDBOX=vercel runs it for real in an
// isolated Vercel Sandbox microVM (CONDUCTOR_SANDBOX=local is dev-only).
export function Sandbox() {
  const [cmd, setCmd] = useState('node --version')
  const [result, setResult] = useState<ToolResult | null>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!cmd.trim() || running) return
    setRunning(true)
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool: 'run_command', args: { command: cmd } }),
      })
      setResult((await res.json()) as ToolResult)
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="panel-inner" style={{ paddingTop: 0 }}>
      <div className="card">
        <div className="card-h">
          <span>Sandbox</span>
          <span>{result?.sandbox ?? 'simulated'}</span>
        </div>
        <div className="sandbox-row">
          <span className="sandbox-prompt">$</span>
          <input
            className="sandbox-input"
            value={cmd}
            spellCheck={false}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="node --version"
          />
          <button className="sandbox-run" onClick={run} disabled={running}>
            {running ? '…' : 'Run'}
          </button>
        </div>
        {result && (
          <pre className={`sandbox-out ${result.ok ? '' : 'err'}`}>
            {result.ok ? result.output || '(no output)' : `✗ ${result.error}`}
          </pre>
        )}
        <div className="sandbox-hint">
          Tool execution behind the COO router · isolated microVM ·{' '}
          <code>CONDUCTOR_SANDBOX=vercel</code> to run for real
        </div>
      </div>
    </div>
  )
}
