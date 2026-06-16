import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'
import { requireUser, unauthorized } from '@/lib/authz'

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorized()
  try {
    const db = await getDb()
    // Scope to the caller's own projects — never the whole table.
    const projects = await db.query.projects.findMany({
      where: eq(schema.projects.userId, user.id),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const check = await checkBotId()
  if (check.isBot) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 403 })
  }
  const user = await requireUser()
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const { name, description, prompt, code, modelUsed, sandboxId } = body

    const db = await getDb()
    const result = await db
      .insert(schema.projects)
      .values({
        userId: user.id, // stamp ownership on every new project
        name,
        description,
        prompt,
        code,
        modelUsed,
        sandboxId,
        status: 'completed',
      })
      .returning()

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
