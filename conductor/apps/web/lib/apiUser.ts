/**
 * Resolve the owning account for a conversation API request.
 *
 * DEMO-GRADE: identity is asserted by the client via the `x-user-id` header,
 * matching the app's client-side auth (lib/auth.ts). A production deployment
 * would instead verify a signed session cookie / bearer token here and derive
 * the id server-side — the route handlers don't change, only this function.
 */
export function ownerId(req: Request): string | null {
  const id = req.headers.get('x-user-id')
  return id && id.trim() ? id.trim() : null
}

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
