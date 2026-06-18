import { sql, relations } from 'drizzle-orm'
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  email: text('email').notNull().unique(),
  name: text('name'),
  // Current spendable credit balance. The credit_ledger table is the source of
  // truth / audit log; this column is a denormalized running total for fast reads.
  creditsBalance: integer('credits_balance').notNull().default(0),
  plan: text('plan').notNull().default('free'), // free, starter, pro, scale
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const creditLedger = sqliteTable('credit_ledger', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Positive for grants/top-ups, negative for spend.
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(), // signup_grant, monthly_grant, generation, topup, refund
  balanceAfter: integer('balance_after').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  // Owner of the project. Nullable so pre-existing rows (created before
  // ownership existed) don't break; all new projects set it, and every
  // project/sandbox endpoint authorizes against it.
  userId: text('user_id'),
  name: text('name').notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  code: text('code').notNull(),
  sandboxId: text('sandbox_id'),
  githubUrl: text('github_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  modelUsed: text('model_used'),
  status: text('status').default('completed'),
})

// Maps a Vercel Sandbox to its owner, recorded at creation time, so the
// sandbox file/command endpoints can authorize access (a sandbox id is
// guessable/enumerable, so "logged in" is not enough — it must be YOUR sandbox).
export const sandboxes = sqliteTable('sandboxes', {
  sandboxId: text('sandbox_id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Single-use email sign-in challenges (magic link + 6-digit OTP). Only HASHES
// of the token/code are stored; the plaintext is emailed and never persisted.
// A row is created on /api/auth/request and consumed on /api/auth/verify.
export const loginTokens = sqliteTable('login_tokens', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(), // epoch ms
  consumedAt: integer('consumed_at'), // epoch ms; set once used
  attempts: integer('attempts').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const projectFiles = sqliteTable('project_files', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  content: text('content').notNull(),
  language: text('language'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const chatHistory = sqliteTable('chat_history', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user, assistant
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const usersRelations = relations(users, ({ many }) => ({
  creditLedger: many(creditLedger),
}))

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  user: one(users, {
    fields: [creditLedger.userId],
    references: [users.id],
  }),
}))

export const projectsRelations = relations(projects, ({ many }) => ({
  projectFiles: many(projectFiles),
  chatHistory: many(chatHistory),
}))

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}))

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  project: one(projects, {
    fields: [chatHistory.projectId],
    references: [projects.id],
  }),
}))

export type User = typeof users.$inferSelect
export type CreditLedgerEntry = typeof creditLedger.$inferSelect
export type Project = typeof projects.$inferSelect
export type ProjectFile = typeof projectFiles.$inferSelect
export type ChatMessage = typeof chatHistory.$inferSelect
export type SandboxOwnership = typeof sandboxes.$inferSelect
export type LoginToken = typeof loginTokens.$inferSelect
