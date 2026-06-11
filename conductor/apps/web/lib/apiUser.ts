// Conversation snapshot store shape (owner-scoped). Ownership is resolved from
// the session cookie in the route handlers — see lib/server/session.ts.
export interface ConversationStore {
  upsertConversation(input: {
    id: string
    ownerId: string
    title: string
    updatedAt: number
    snapshot: unknown
  }): Promise<unknown>
  listConversations(ownerId: string): Promise<{ id: string; title: string; updatedAt: number }[]>
  getConversation(
    id: string,
    ownerId: string
  ): Promise<{ id: string; title: string; updatedAt: number; snapshot: unknown } | null>
  renameConversation(id: string, ownerId: string, title: string): Promise<boolean>
  deleteConversation(id: string, ownerId: string): Promise<boolean>
}
