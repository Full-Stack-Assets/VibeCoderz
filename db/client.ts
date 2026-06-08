import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient } from '@libsql/client'
import * as schema from './schema'
import path from 'path'

type DB = ReturnType<typeof drizzle<typeof schema>>

let db: DB | null = null
let migrationPromise: Promise<void> | null = null

function createDb(): DB {
  const url = process.env.DATABASE_URL || 'file:./vibe.db'
  // Auth token is required for remote (libsql://) Turso databases and
  // ignored for local file:// URLs used in development.
  const authToken = process.env.DATABASE_AUTH_TOKEN
  const client = createClient({ url, authToken })
  return drizzle(client, { schema })
}

/**
 * Returns a migrated Drizzle client. Migrations are applied lazily once per
 * server instance; the migrator tracks applied migrations in its own table, so
 * this is idempotent and safe to call on every request.
 */
export async function getDb(): Promise<DB> {
  if (!db) {
    db = createDb()
  }
  if (!migrationPromise) {
    const instance = db
    migrationPromise = migrate(instance, {
      migrationsFolder: path.join(process.cwd(), 'db/migrations'),
    }).catch((error) => {
      // Reset so a later request can retry rather than caching the failure.
      migrationPromise = null
      throw error
    })
  }
  await migrationPromise
  return db
}

export { schema }
