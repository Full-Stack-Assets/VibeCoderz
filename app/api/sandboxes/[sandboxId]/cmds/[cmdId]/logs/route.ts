import { NextResponse, type NextRequest } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { requireUser, unauthorized, userOwnsSandbox } from '@/lib/authz'

interface Params {
  sandboxId: string
  cmdId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const logParams = await params
  // Only the sandbox's owner may stream its command logs.
  if (!(await userOwnsSandbox(user.id, logParams.sandboxId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const sandbox = await Sandbox.get(logParams)
  const command = await sandbox.getCommand(logParams.cmdId)

  return new NextResponse(
    new ReadableStream({
      async pull(controller) {
        for await (const logline of command.logs()) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                data: logline.data,
                stream: logline.stream,
                timestamp: Date.now(),
              }) + '\n'
            )
          )
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } }
  )
}
