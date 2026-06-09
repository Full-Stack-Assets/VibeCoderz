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
