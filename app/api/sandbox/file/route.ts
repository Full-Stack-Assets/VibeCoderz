import { NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sandboxId = searchParams.get('sandboxId')
  const filePath = searchParams.get('path')

  if (!sandboxId || !filePath) {
    return NextResponse.json({ error: 'Missing sandboxId or path' }, { status: 400 })
  }

  // Prevent path traversal
  if (filePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    const sandbox = await Sandbox.get({ sandboxId })
    const cmd = await sandbox.runCommand({
      detached: true,
      cmd: 'cat',
      args: [filePath],
    })
    const done = await cmd.wait()

    if (done.exitCode !== 0) {
      const stderr = await done.stderr()
      return NextResponse.json(
        { error: stderr || 'File not found' },
        { status: 404 }
      )
    }

    const content = await done.stdout()
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}
