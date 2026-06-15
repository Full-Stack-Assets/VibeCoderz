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
    this.users = new Map(); // id -> User
    this.usersByEmail = new Map(); // lowercased email -> id
    this.sessions = new Map(); // token -> { token, userId, expiresAt }
    this.memories = new Map(); // userId -> [{ id, text, createdAt }] durable prefs
    this.apiKeys = new Map(); // keyId -> { id, userId, label, hash, createdAt, lastUsedAt }
  }

  // --- API keys (public API auth) -----------------------------------------
  // Only the SHA-256 hash of a key is stored; the plaintext is shown once at
  // creation and never persisted.

  async createApiKey(userId, label, hash) {
    const rec = { id: nextId('ak'), userId, label: label || 'API key', hash, createdAt: Date.now(), lastUsedAt: null };
    this.apiKeys.set(rec.id, rec);
    return { id: rec.id, label: rec.label, createdAt: rec.createdAt };
  }

  /** Resolve a key hash to its owner; bumps lastUsedAt. */
  async resolveApiKey(hash) {
    for (const rec of this.apiKeys.values()) {
      if (rec.hash === hash) {
        rec.lastUsedAt = Date.now();
        return { id: rec.id, userId: rec.userId };
      }
    }
    return null;
  }

  async listApiKeys(userId) {
    return [...this.apiKeys.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt }));
  }

  async revokeApiKey(userId, keyId) {
    const rec = this.apiKeys.get(keyId);
    if (!rec || rec.userId !== userId) return false;
    this.apiKeys.delete(keyId);
    return true;
  }

  // --- Accounts & sessions (email + password auth) ------------------------

  async createUser({ email, name, passwordHash, plan = 'free', role = 'user' }) {
    const key = String(email).trim().toLowerCase();
    if (this.usersByEmail.has(key)) throw new Error('An account with that email already exists.');
    const user = {
      id: nextId('user'),
      email: String(email).trim(),
      name: name || null,
      passwordHash,
      plan,
      role,
      stripeCustomerId: null,
      subscriptionStatus: null,
      topupUSD: 0,
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(key, user.id);
    return user;
  }

  async getUserByEmail(email) {
    const id = this.usersByEmail.get(String(email).trim().toLowerCase());
    return id ? this.users.get(id) : null;
  }

  async getUserById(id) {
    return this.users.get(id) || null;
  }

  async updateUser(id, patch) {
    const user = this.users.get(id);
    if (!user) return null;
    Object.assign(user, patch);
    return user;
  }

  async createSession(userId, token, expiresAt) {
    const session = { token, userId, expiresAt };
    this.sessions.set(token, session);
    return session;
  }

  async getSession(token) {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) return null;
    return { session, user };
  }

  async deleteSession(token) {
    return this.sessions.delete(token);
  }

  // --- Per-account usage metering (server-authoritative budgets) ----------

  async getUserUsage(userId, periodMs) {
    const u = this.users.get(userId);
    if (!u) return 0;
    const now = Date.now();
    if (!u.spendPeriodStart || now - u.spendPeriodStart >= periodMs) {
      u.spendPeriodStart = now;
      u.spentUSD = 0;
    }
    return u.spentUSD || 0;
  }

  async addUserUsage(userId, deltaUSD) {
    const u = this.users.get(userId);
    if (!u) return 0;
    u.spentUSD = (u.spentUSD || 0) + (deltaUSD || 0);
    return u.spentUSD;
  }

  // --- Top-up credit (purchased, rolls over across periods) ---------------

  async getUserCredit(userId) {
    const u = this.users.get(userId);
    return u ? u.topupUSD || 0 : 0;
  }

  async addUserCredit(userId, deltaUSD) {
    const u = this.users.get(userId);
    if (!u) return 0;
    u.topupUSD = Math.max(0, (u.topupUSD || 0) + (deltaUSD || 0));
    return u.topupUSD;
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

  // --- Durable per-user memory (personalization) --------------------------
  // Long-lived preferences/facts, injected into every turn's system prompt so
  // turn N+1 is smarter than turn 1. Separate from conversation transcripts.

  async addMemory(userId, text) {
    const list = this.memories.get(userId) || [];
    const mem = { id: nextId('mem'), text: String(text), createdAt: Date.now() };
    list.push(mem);
    this.memories.set(userId, list);
    return mem;
  }

  async listMemories(userId) {
    return [...(this.memories.get(userId) || [])];
  }

  async deleteMemory(userId, memoryId) {
    const list = this.memories.get(userId);
    if (!list) return false;
    const i = list.findIndex((m) => m.id === memoryId);
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  }

  // --- Quality feedback (flywheel labels) ---------------------------------
  // Attach a user signal ('up' | 'down') to a stored message's meta, alongside
  // the routing/escalation metadata already there. Returns true if applied.
  async recordFeedback(conversationId, messageId, signal) {
    const list = this.messages.get(conversationId);
    if (!list) return false;
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return false;
    msg.meta = { ...(msg.meta || {}), feedback: { signal, at: Date.now() } };
    return true;
  }
}
