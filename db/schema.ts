import { sql, relations } from 'drizzle-orm'
import { text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
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
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

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

export type Project = typeof projects.$inferSelect
export type ProjectFile = typeof projectFiles.$inferSelect
export type ChatMessage = typeof chatHistory.$inferSelect
