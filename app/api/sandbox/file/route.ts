import { NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { requireUser, unauthorized, userOwnsSandbox } from '@/lib/authz'

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return unauthorized()

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

  // Only the sandbox's owner may read its files.
  if (!(await userOwnsSandbox(user.id, sandboxId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
