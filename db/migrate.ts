import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient } from '@libsql/client'
import path from 'path'

/**
 * Standalone migration runner for CI/deploy pipelines:
 *   pnpm db:migrate
 *
 * Reads DATABASE_URL / DATABASE_AUTH_TOKEN from the environment.
 */
async function main() {
  const url = process.env.DATABASE_URL || 'file:./vibe.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN
  const client = createClient({ url, authToken })
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'db/migrations'),
  })

  console.log(`Migrations applied to ${url}`)
  client.close()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
