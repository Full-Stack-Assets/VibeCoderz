import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, params.id),
      with: {
        projectFiles: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to fetch project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, description, code, status } = body

    const db = getDb()
    const result = await db
      .update(schema.projects)
      .set({
        name,
        description,
        code,
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.projects.id, params.id))
      .returning()

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    await db.delete(schema.projects).where(eq(schema.projects.id, params.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
