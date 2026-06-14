/**
 * PrismaStore — Postgres-backed implementation of the memory store interface.
 *
 * Implements exactly the same five methods as InMemoryStore, so it is a drop-in
 * replacement selected by the factory when DATABASE_URL is configured. The
 * Prisma client is lazy-imported (like the COO engine's provider SDKs) so this
 * module — and the whole package — loads and unit-tests with no Prisma
 * dependency or database present.
 */

export class PrismaStore {
  /** @param {import('@prisma/client').PrismaClient} client */
  constructor(client) {
    this.db = client;
  }

  /** Lazily construct a PrismaStore; throws if @prisma/client isn't installed. */
  static async create() {
    // Non-literal specifier so bundlers (Turbopack/webpack) don't try to resolve
    // this optional dependency at build time — it stays a true runtime import.
    const spec = ['@prisma', 'client'].join('/');
    const { PrismaClient } = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ spec);
    return new PrismaStore(new PrismaClient());
  }

  async createConversation(title = 'New conversation') {
    return this.db.conversation.create({ data: { title } });
  }

  async addMessage(conversationId, role, content, meta = {}) {
    return this.db.message.create({
      data: { conversationId, role, content, meta },
    });
  }

  async logToolExecution(conversationId, name, input, output) {
    return this.db.toolExecution.create({
      data: { conversationId, name, input, output },
    });
  }

  async getContext(conversationId, limit = 10) {
    const rows = await this.db.message.findMany({
      where: { conversationId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  async getMessages(conversationId) {
    return this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --- Durable per-user memory (personalization) --------------------------

  async addMemory(userId, text) {
    return this.db.userMemory.create({ data: { userId, text: String(text) } });
  }

  async listMemories(userId) {
    return this.db.userMemory.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async deleteMemory(userId, memoryId) {
    const r = await this.db.userMemory.deleteMany({ where: { id: memoryId, userId } });
    return r.count > 0;
  }

  // Merge a quality-feedback signal into a message's meta (read-merge-write,
  // since Prisma has no deep-merge for a Json column).
  async recordFeedback(conversationId, messageId, signal) {
    const m = await this.db.message.findFirst({ where: { id: messageId, conversationId } });
    if (!m) return false;
    await this.db.message.update({
      where: { id: messageId },
      data: { meta: { ...(m.meta || {}), feedback: { signal, at: Date.now() } } },
    });
    return true;
  }

  // --- Per-account conversation snapshots ---------------------------------

  async upsertConversation({ id, ownerId, title, updatedAt, snapshot }) {
    if (!id || !ownerId) throw new Error('id and ownerId are required');
    const data = {
      ownerId,
      title: title || 'New conversation',
      updatedAt: new Date(updatedAt || Date.now()),
      snapshot: snapshot ?? null,
    };
    return this.db.conversation.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  async listConversations(ownerId) {
    const rows = await this.db.conversation.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });
    return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.getTime() }));
  }

  async getConversation(id, ownerId) {
    const rec = await this.db.conversation.findUnique({ where: { id } });
    if (!rec || rec.ownerId !== ownerId) return null;
    return { ...rec, updatedAt: rec.updatedAt.getTime() };
  }

  async renameConversation(id, ownerId, title) {
    const rec = await this.db.conversation.findUnique({ where: { id } });
    if (!rec || rec.ownerId !== ownerId) return false;
    const now = new Date();
    // Keep the client snapshot's title/updatedAt in sync with the record.
    const snapshot =
      rec.snapshot && typeof rec.snapshot === 'object'
        ? { ...rec.snapshot, title, updatedAt: now.getTime() }
        : rec.snapshot;
    await this.db.conversation.update({ where: { id }, data: { title, updatedAt: now, snapshot } });
    return true;
  }

  async deleteConversation(id, ownerId) {
    const rec = await this.db.conversation.findUnique({ where: { id } });
    if (!rec || rec.ownerId !== ownerId) return false;
    await this.db.conversation.delete({ where: { id } });
    return true;
  }

  // --- Accounts & sessions ------------------------------------------------

  async createUser({ email, name, passwordHash, plan = 'free', role = 'user' }) {
    return this.db.user.create({
      data: { email: String(email).trim(), name: name || null, passwordHash, plan, role },
    });
  }

  async getUserByEmail(email) {
    return this.db.user.findUnique({ where: { email: String(email).trim() } });
  }

  async getUserById(id) {
    return this.db.user.findUnique({ where: { id } });
  }

  async updateUser(id, patch) {
    return this.db.user.update({ where: { id }, data: patch });
  }

  async createSession(userId, token, expiresAt) {
    return this.db.session.create({ data: { token, userId, expiresAt: new Date(expiresAt) } });
  }

  async getSession(token) {
    const session = await this.db.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return null;
    if (session.expiresAt && Date.now() > session.expiresAt.getTime()) {
      await this.db.session.delete({ where: { token } }).catch(() => {});
      return null;
    }
    return { session, user: session.user };
  }

  async deleteSession(token) {
    await this.db.session.delete({ where: { token } }).catch(() => {});
    return true;
  }
}
