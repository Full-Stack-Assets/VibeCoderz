import { NextResponse } from 'next/server'
import { runTool, TOOL_NAMES } from '@conductor/agent-tools'

export const runtime = 'nodejs'

interface ToolResult {
  ok: boolean
  output?: string
  error?: string
}

interface Body {
  tool?: string
  args?: Record<string, unknown>
}

// Executes a single tool call in the configured sandbox. Simulated by default;
// set CONDUCTOR_SANDBOX=local to run real (allowlisted) commands in an isolated
// working directory. This is the same execution surface the COO-routed model
// drives during a live agentic turn.
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 })
  }

  const tool = body.tool
  if (!tool || !TOOL_NAMES.includes(tool)) {
    return NextResponse.json(
      { ok: false, error: `unknown tool. available: ${TOOL_NAMES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = (await runTool(tool, body.args || {})) as ToolResult
  return NextResponse.json({
    ...result,
    sandbox: (process.env.CONDUCTOR_SANDBOX || 'simulated').toLowerCase(),
  })
}

export async function GET() {
  return NextResponse.json({ tools: TOOL_NAMES, sandbox: (process.env.CONDUCTOR_SANDBOX || 'simulated').toLowerCase() })
}
