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
}
