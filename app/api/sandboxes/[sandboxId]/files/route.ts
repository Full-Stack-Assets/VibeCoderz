import { NextResponse, type NextRequest } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import z from 'zod/v3'
import { requireUser, unauthorized, userOwnsSandbox } from '@/lib/authz'

const FileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const { sandboxId } = await params
  const fileParams = FileParamsSchema.safeParse({
    path: request.nextUrl.searchParams.get('path'),
    sandboxId,
  })

  if (fileParams.success === false) {
    return NextResponse.json(
      { error: 'Invalid parameters. You must pass a `path` as query' },
      { status: 400 }
    )
  }

  // Only the sandbox's owner may read its files.
  if (!(await userOwnsSandbox(user.id, sandboxId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sandbox = await Sandbox.get(fileParams.data)
  const stream = await sandbox.readFile(fileParams.data)
  if (!stream) {
    return NextResponse.json(
      { error: 'File not found in the Sandbox' },
      { status: 404 }
    )
  }

  return new NextResponse(
    new ReadableStream({
      async pull(controller) {
        for await (const chunk of stream) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
  )
}
