import { getDb, schema } from '@/db/client'
import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const projects = await db.query.projects.findMany({
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const checkResult = await checkBotId()
  if (checkResult.isBot) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, prompt, code, modelUsed, sandboxId } = body

    const db = await getDb()
    const result = await db
      .insert(schema.projects)
      .values({
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
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
