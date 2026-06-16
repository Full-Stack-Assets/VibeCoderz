import { getDb, schema } from '@/db/client'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'
import { requireUser, unauthorized } from '@/lib/authz'

const notFound = () => NextResponse.json({ error: 'Project not found' }, { status: 404 })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) return unauthorized()
  const { id } = await params
  try {
    const db = await getDb()
    const project = await db.query.projects.findFirst({
      // Ownership is part of the lookup, so a non-owner gets an honest 404
      // (no existence leak) rather than another user's project.
      where: and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)),
      with: { projectFiles: true },
    })
    if (!project) return notFound()
    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to fetch project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await checkBotId()
  if (check.isBot) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 403 })
  }
  const user = await requireUser()
  if (!user) return unauthorized()

  const { id } = await params
  try {
    const body = await req.json()
    const { name, description, code, status } = body

    const db = await getDb()
    const result = await db
      .update(schema.projects)
      .set({
        name,
        description,
        code,
        status,
        updatedAt: new Date().toISOString(),
      })
      // The WHERE enforces ownership: a non-owner update matches no rows.
      .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
      .returning()

    if (result.length === 0) return notFound()
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await checkBotId()
  if (check.isBot) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 403 })
  }
  const user = await requireUser()
  if (!user) return unauthorized()

  const { id } = await params
  try {
    const db = await getDb()
    const result = await db
      .delete(schema.projects)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
      .returning()

    if (result.length === 0) return notFound()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
