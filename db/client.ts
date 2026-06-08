import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL || 'file:./vibe.db'
    const client = createClient({ url })
    db = drizzle(client, { schema })
  }
  return db
}

export { schema }
