import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import path from 'path'

type DB = ReturnType<typeof drizzle<typeof schema>>

let db: DB | null = null

export function getDb(): DB {
  if (!db) {
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'vibe.db')
    const sqlite = new Database(dbPath)
    db = drizzle(sqlite, { schema })
  }
  return db
}

export { schema }
