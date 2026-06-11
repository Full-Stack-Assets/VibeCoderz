/**
 * InMemoryStore — zero-dependency conversation memory.
 *
 * Ported in spirit from the Claude Code Assistant's conversation.service: the
 * same Conversation / Message / ToolExecution model and a context-window loader
 * that caps how much history is replayed to the model. Implements the store
 * interface that PrismaStore mirrors for durable Postgres persistence.
 */

let _id = 0;
const nextId = (p) => `${p}_${Date.now().toString(36)}_${(_id++).toString(36)}`;

export class InMemoryStore {
  constructor() {
    this.conversations = new Map(); // id -> { id, title, createdAt }
    this.messages = new Map(); // conversationId -> Message[]
    this.tools = new Map(); // conversationId -> ToolExecution[]
    this.owned = new Map(); // id -> { id, ownerId, title, updatedAt, snapshot }
  }

  // --- Per-account conversation snapshots ---------------------------------
  // User-facing chat history, owned by an account and stored as an opaque
  // snapshot (the client's full conversation). Distinct from the runtime
  // context above (addMessage/getContext), which feeds the model.

  async upsertConversation({ id, ownerId, title, updatedAt, snapshot }) {
    if (!id || !ownerId) throw new Error('id and ownerId are required');
    const rec = {
      id,
      ownerId,
      title: title || 'New conversation',
      updatedAt: updatedAt || Date.now(),
      snapshot: snapshot ?? null,
    };
    this.owned.set(id, rec);
    return rec;
  }

  async listConversations(ownerId) {
    return [...this.owned.values()]
      .filter((c) => c.ownerId === ownerId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  async getConversation(id, ownerId) {
    const rec = this.owned.get(id);
    if (!rec || rec.ownerId !== ownerId) return null;
    return rec;
  }

  async renameConversation(id, ownerId, title) {
    const rec = this.owned.get(id);
    if (!rec || rec.ownerId !== ownerId) return false;
    rec.title = title;
    rec.updatedAt = Date.now();
    // Keep the client snapshot in sync so list/hydrate reflect the new title.
    if (rec.snapshot && typeof rec.snapshot === 'object') {
      rec.snapshot.title = title;
      rec.snapshot.updatedAt = rec.updatedAt;
    }
    return true;
  }

  async deleteConversation(id, ownerId) {
    const rec = this.owned.get(id);
    if (!rec || rec.ownerId !== ownerId) return false;
    this.owned.delete(id);
    return true;
  }

  async createConversation(title = 'New conversation') {
    const id = nextId('conv');
    const conv = { id, title, createdAt: Date.now() };
    this.conversations.set(id, conv);
    this.messages.set(id, []);
    this.tools.set(id, []);
    return conv;
  }

  async addMessage(conversationId, role, content, meta = {}) {
    if (!this.messages.has(conversationId)) {
      // Auto-vivify so a client-supplied id works without an explicit create.
      this.conversations.set(conversationId, { id: conversationId, title: 'New conversation', createdAt: Date.now() });
      this.messages.set(conversationId, []);
      this.tools.set(conversationId, []);
    }
    const msg = { id: nextId('msg'), role, content, meta, createdAt: Date.now() };
    this.messages.get(conversationId).push(msg);
    return msg;
  }

  async logToolExecution(conversationId, name, input, output) {
    const list = this.tools.get(conversationId) || [];
    const rec = { id: nextId('tool'), name, input, output, createdAt: Date.now() };
    list.push(rec);
    this.tools.set(conversationId, list);
    return rec;
  }

  /**
   * Load the last `limit` messages as model-ready {role, content} pairs.
   * Mirrors the original's context-window cap that prevents token overflow.
   */
  async getContext(conversationId, limit = 10) {
    const list = this.messages.get(conversationId) || [];
    return list
      .slice(-limit)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async getMessages(conversationId) {
    return [...(this.messages.get(conversationId) || [])];
  }
}
