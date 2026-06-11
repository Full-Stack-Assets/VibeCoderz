/**
 * PgStore — Postgres backend that provisions its OWN schema.
 *
 * Unlike the Prisma path (which needs `prisma generate` + `migrate` from a
 * terminal), this store runs `CREATE TABLE IF NOT EXISTS` on first use, so the
 * only operator step is setting DATABASE_URL — no CLI, no migration files. It
 * implements the same interface as InMemoryStore, so the factory swaps it in
 * transparently. The `pg` driver is lazy-imported (non-literal specifier) so the
 * package still builds and unit-tests with no `pg` dependency or database.
 */

import { randomUUID } from 'node:crypto';

const id = (p) => `${p}_${randomUUID()}`;

function sslConfig() {
  const url = process.env.DATABASE_URL || '';
  // Local databases usually don't use TLS; managed providers (Neon/Supabase/
  // Vercel) require it. Default to permissive TLS off-localhost.
  if (/@(localhost|127\.0\.0\.1)/.test(url) && !/sslmode=require/.test(url)) return false;
  return { rejectUnauthorized: false };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  password_hash text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  role text NOT NULL DEFAULT 'user',
  stripe_customer_id text,
  subscription_status text,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  owner_id text,
  title text NOT NULL DEFAULT 'New conversation',
  updated_at bigint NOT NULL DEFAULT 0,
  snapshot jsonb,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS conversations_owner_updated ON conversations (owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  meta jsonb,
  created_at bigint NOT NULL,
  seq bigserial
);
CREATE INDEX IF NOT EXISTS messages_conv_seq ON messages (conversation_id, seq);
CREATE TABLE IF NOT EXISTS tool_executions (
  id text PRIMARY KEY,
  conversation_id text NOT NULL,
  name text NOT NULL,
  input jsonb,
  output jsonb,
  created_at bigint NOT NULL,
  seq bigserial
);
`;

const mapUser = (r) =>
  r && {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    plan: r.plan,
    role: r.role,
    stripeCustomerId: r.stripe_customer_id,
    subscriptionStatus: r.subscription_status,
    createdAt: Number(r.created_at),
  };

// Whitelisted user columns for updateUser (camelCase → column).
const USER_COLS = {
  email: 'email',
  name: 'name',
  passwordHash: 'password_hash',
  plan: 'plan',
  role: 'role',
  stripeCustomerId: 'stripe_customer_id',
  subscriptionStatus: 'subscription_status',
};

export class PgStore {
  constructor(pool) {
    this.pool = pool;
  }

  /** Connect, ensure the schema exists, and return a ready store. */
  static async create() {
    const spec = ['p', 'g'].join(''); // defeat bundler static analysis
    const pg = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec);
    const { Pool } = pg.default ?? pg;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() });
    await pool.query(SCHEMA);
    return new PgStore(pool);
  }

  q(text, params) {
    return this.pool.query(text, params);
  }

  // --- Runtime conversation memory ----------------------------------------

  async createConversation(title = 'New conversation') {
    const cid = id('conv');
    const now = Date.now();
    await this.q(
      `INSERT INTO conversations (id, title, updated_at, created_at) VALUES ($1, $2, $3, $3)`,
      [cid, title, now]
    );
    return { id: cid, title, createdAt: now };
  }

  async addMessage(conversationId, role, content, meta = {}) {
    const now = Date.now();
    await this.q(
      `INSERT INTO conversations (id, title, updated_at, created_at)
       VALUES ($1, 'New conversation', $2, $2) ON CONFLICT (id) DO NOTHING`,
      [conversationId, now]
    );
    const mid = id('msg');
    await this.q(
      `INSERT INTO messages (id, conversation_id, role, content, meta, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [mid, conversationId, role, content, JSON.stringify(meta ?? {}), now]
    );
    return { id: mid, role, content, meta, createdAt: now };
  }

  async logToolExecution(conversationId, name, input, output) {
    const tid = id('tool');
    await this.q(
      `INSERT INTO tool_executions (id, conversation_id, name, input, output, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [tid, conversationId, name, JSON.stringify(input ?? null), JSON.stringify(output ?? null), Date.now()]
    );
    return { id: tid, name, input, output };
  }

  async getContext(conversationId, limit = 10) {
    const { rows } = await this.q(
      `SELECT role, content FROM messages
       WHERE conversation_id = $1 AND role IN ('user','assistant')
       ORDER BY seq DESC LIMIT $2`,
      [conversationId, limit]
    );
    return rows.reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  async getMessages(conversationId) {
    const { rows } = await this.q(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY seq ASC`,
      [conversationId]
    );
    return rows;
  }

  // --- Per-account conversation snapshots ---------------------------------

  async upsertConversation({ id: cid, ownerId, title, updatedAt, snapshot }) {
    if (!cid || !ownerId) throw new Error('id and ownerId are required');
    await this.q(
      `INSERT INTO conversations (id, owner_id, title, updated_at, snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (id) DO UPDATE SET owner_id = $2, title = $3, updated_at = $4, snapshot = $5::jsonb`,
      [cid, ownerId, title || 'New conversation', updatedAt || Date.now(), JSON.stringify(snapshot ?? null), Date.now()]
    );
    return { id: cid, ownerId, title, updatedAt, snapshot };
  }

  async listConversations(ownerId) {
    const { rows } = await this.q(
      `SELECT id, title, updated_at FROM conversations
       WHERE owner_id = $1 ORDER BY updated_at DESC`,
      [ownerId]
    );
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: Number(r.updated_at) }));
  }

  async getConversation(cid, ownerId) {
    const { rows } = await this.q(`SELECT * FROM conversations WHERE id = $1`, [cid]);
    const r = rows[0];
    if (!r || r.owner_id !== ownerId) return null;
    return { id: r.id, ownerId: r.owner_id, title: r.title, updatedAt: Number(r.updated_at), snapshot: r.snapshot };
  }

  async renameConversation(cid, ownerId, title) {
    const now = Date.now();
    const { rowCount } = await this.q(
      `UPDATE conversations SET title = $3, updated_at = $4,
         snapshot = CASE WHEN snapshot IS NULL THEN NULL
           ELSE jsonb_set(jsonb_set(snapshot, '{title}', to_jsonb($3::text)), '{updatedAt}', to_jsonb($4::bigint)) END
       WHERE id = $1 AND owner_id = $2`,
      [cid, ownerId, title, now]
    );
    return rowCount > 0;
  }

  async deleteConversation(cid, ownerId) {
    const { rowCount } = await this.q(`DELETE FROM conversations WHERE id = $1 AND owner_id = $2`, [cid, ownerId]);
    return rowCount > 0;
  }

  // --- Accounts & sessions ------------------------------------------------

  async createUser({ email, name, passwordHash, plan = 'free', role = 'user' }) {
    const uid = id('user');
    const { rows } = await this.q(
      `INSERT INTO users (id, email, name, password_hash, plan, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [uid, String(email).trim(), name || null, passwordHash, plan, role, Date.now()]
    );
    if (rows.length === 0) throw new Error('An account with that email already exists.');
    return mapUser(rows[0]);
  }

  async getUserByEmail(email) {
    const { rows } = await this.q(`SELECT * FROM users WHERE email = $1`, [String(email).trim()]);
    return mapUser(rows[0]) || null;
  }

  async getUserById(uid) {
    const { rows } = await this.q(`SELECT * FROM users WHERE id = $1`, [uid]);
    return mapUser(rows[0]) || null;
  }

  async updateUser(uid, patch) {
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      const col = USER_COLS[k];
      if (!col) continue;
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    }
    if (sets.length === 0) return this.getUserById(uid);
    vals.push(uid);
    const { rows } = await this.q(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    return mapUser(rows[0]) || null;
  }

  async createSession(userId, token, expiresAt) {
    await this.q(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $2, expires_at = $3`,
      [token, userId, expiresAt]
    );
    return { token, userId, expiresAt };
  }

  async getSession(token) {
    const { rows } = await this.q(
      `SELECT s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1`,
      [token]
    );
    const r = rows[0];
    if (!r) return null;
    if (Number(r.expires_at) < Date.now()) {
      await this.deleteSession(token);
      return null;
    }
    return { session: { token, userId: r.id, expiresAt: Number(r.expires_at) }, user: mapUser(r) };
  }

  async deleteSession(token) {
    await this.q(`DELETE FROM sessions WHERE token = $1`, [token]);
    return true;
  }
}
