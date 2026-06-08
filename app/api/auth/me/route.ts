import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const db = await getDb()
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.sub),
    })

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      creditsBalance: user.creditsBalance,
    })
  } catch (error) {
    console.error('Failed to load session user:', error)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }
}
