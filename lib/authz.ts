import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getDb, schema } from '@/db/client'

/**
 * Authorization helpers shared by the API routes.
 *
 * Authentication is now required on every sensitive route (no more
 * BILLING_ENABLED-gated anonymous access). Resource routes additionally check
 * OWNERSHIP — a logged-in user may only touch their own projects/sandboxes,
 * since ids are guessable/enumerable.
 */

export interface SessionUser {
  id: string
  email: string
}

/** The signed-in user, or null. */
export async function requireUser(): Promise<SessionUser | null> {
  const s = await getSessionUser()
  return s ? { id: s.sub, email: s.email } : null
}

/** Standard 401 for unauthenticated requests. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 })
}

/**
 * Does `userId` own `sandboxId`? True if the sandbox was created by them
 * (recorded at creation) OR a saved project of theirs carries this sandbox id.
 */
export async function userOwnsSandbox(userId: string, sandboxId: string): Promise<boolean> {
  const db = await getDb()
  const owned = await db.query.sandboxes.findFirst({
    where: and(eq(schema.sandboxes.sandboxId, sandboxId), eq(schema.sandboxes.userId, userId)),
  })
  if (owned) return true
  const viaProject = await db.query.projects.findFirst({
    where: and(eq(schema.projects.sandboxId, sandboxId), eq(schema.projects.userId, userId)),
  })
  return !!viaProject
}
