/**
 * @conductor/agent-memory — conversation memory for the agent runtime.
 *
 * Ported in spirit from the Claude Code Assistant's conversation.service: the
 * same Conversation / Message / ToolExecution model and a context-window loader
 * that caps how much history is replayed to the model. Ships a zero-dependency
 * in-memory store (so Conductor runs with no database) behind a `MemoryStore`
 * interface that a Postgres/Prisma adapter can implement unchanged — exactly the
 * persistence boundary the original used.
 */

let _id = 0;
const nextId = (p) => `${p}_${Date.now().toString(36)}_${(_id++).toString(36)}`;

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {'user'|'assistant'|'tool'} role
 * @property {string} content
 * @property {Object} [meta]        routing decision, model, cost, etc.
 * @property {number} createdAt
 */

/**
 * In-memory implementation of the store interface. Drop-in replaceable with a
 * database-backed adapter that implements the same five methods.
 */
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
    const list = this.messages.get(conversationId);
    if (!list) throw new Error(`unknown conversation ${conversationId}`);
    const msg = { id: nextId('msg'), role, content, meta, createdAt: Date.now() };
    list.push(msg);
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

// Default singleton store for the running app. Swap for a DB-backed store by
// passing a different implementation into the chat handler.
export const memory = new InMemoryStore();
