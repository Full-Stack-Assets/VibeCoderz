/**
 * PgStore — Postgres backend that provisions its OWN schema.
 *
 * Unlike the Prisma path (which needs `prisma generate` + `migrate` from a
 * terminal), this store runs `CREATE TABLE IF NOT EXISTS` on first use, so the
 * only operator step is setting DATABASE_URL — no CLI, no migration files. It
 * implements the same interface as InMemoryStore, so the factory swaps it in
 * transparently. The `pg` driver is imported lazily (only when DATABASE_URL is
 * set) so unit tests run without a database; the specifier stays literal so
 * bundlers and Vercel's file tracing include the driver in server bundles.
 */

import { randomUUID } from 'node:crypto';

const id = (p) => `${p}_${randomUUID()}`;

/**
 * Connection config with sane, quiet TLS:
 * - `sslmode=prefer|require|verify-ca` in the URL are normalized to
 *   `verify-full` — that's what pg treats them as today anyway, and naming it
 *   explicitly pins the stronger semantics AND silences pg's per-connection
 *   "SECURITY WARNING" deprecation notice about the aliases.
 * - No sslmode + localhost → plain TCP; no sslmode + remote → verified TLS.
 * - Self-signed providers can opt out explicitly with PG_SSL_INSECURE=1.
 */
function connectionConfig() {
  let connectionString = process.env.DATABASE_URL || '';
  if (process.env.PG_SSL_INSECURE === '1') {
    return { connectionString, ssl: { rejectUnauthorized: false } };
  }
  connectionString = connectionString.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/,
    '$1sslmode=verify-full'
  );
  if (/[?&]sslmode=/.test(connectionString)) return { connectionString };
  if (/@(localhost|127\.0\.0\.1)/.test(connectionString)) return { connectionString, ssl: false };
  return { connectionString, ssl: true };
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
  spent_usd double precision NOT NULL DEFAULT 0,
  spend_period_start bigint NOT NULL DEFAULT 0,
  topup_credit_usd double precision NOT NULL DEFAULT 0,
  saved_usd double precision NOT NULL DEFAULT 0,
  referral_code text,
  referred_by text,
  created_at bigint NOT NULL
);
-- Backfill columns on databases created before usage metering existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS spent_usd double precision NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spend_period_start bigint NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS topup_credit_usd double precision NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_usd double precision NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by text;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code ON users (referral_code);
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
CREATE TABLE IF NOT EXISTS user_memories (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS user_memories_user ON user_memories (user_id, created_at);
CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'API key',
  hash text NOT NULL UNIQUE,
  created_at bigint NOT NULL,
  last_used_at bigint,
  requests bigint NOT NULL DEFAULT 0,
  cost_usd double precision NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS api_keys_hash ON api_keys (hash);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS requests bigint NOT NULL DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS cost_usd double precision NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS processed_events (
  id text PRIMARY KEY,
  created_at bigint NOT NULL
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
    topupUSD: Number(r.topup_credit_usd) || 0,
    savedUSD: Number(r.saved_usd) || 0,
    referralCode: r.referral_code || null,
    referredBy: r.referred_by || null,
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
    // Literal specifier on purpose: `pg` is a declared dependency, and the
    // import must stay statically analyzable so Vercel's file tracing bundles
    // the driver into each serverless function. (An obfuscated specifier made
    // tracing miss it → import failed at runtime → silent in-memory fallback →
    // sessions/users differed per lambda instance.)
    const pg = await import('pg');
    const { Pool } = pg.default ?? pg;
    const pool = new Pool(connectionConfig());
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

  // --- Webhook idempotency -------------------------------------------------

  async markEventProcessed(eventId) {
    const { rowCount } = await this.q(
      `INSERT INTO processed_events (id, created_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [eventId, Date.now()]
    );
    return rowCount > 0;
  }

  async releaseEvent(eventId) {
    await this.q(`DELETE FROM processed_events WHERE id = $1`, [eventId]);
  }

  // --- API keys (public API auth) -----------------------------------------

  async createApiKey(userId, label, hash) {
    const kid = id('ak');
    const now = Date.now();
    await this.q(
      `INSERT INTO api_keys (id, user_id, label, hash, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [kid, userId, label || 'API key', hash, now]
    );
    return { id: kid, label: label || 'API key', createdAt: now };
  }

  async resolveApiKey(hash) {
    const { rows } = await this.q(`SELECT id, user_id FROM api_keys WHERE hash = $1`, [hash]);
    if (!rows[0]) return null;
    await this.q(`UPDATE api_keys SET last_used_at = $2 WHERE id = $1`, [rows[0].id, Date.now()]);
    return { id: rows[0].id, userId: rows[0].user_id };
  }

  async listApiKeys(userId) {
    const { rows } = await this.q(
      `SELECT id, label, created_at, last_used_at, requests, cost_usd FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      createdAt: Number(r.created_at),
      lastUsedAt: r.last_used_at == null ? null : Number(r.last_used_at),
      requests: Number(r.requests) || 0,
      costUSD: Number(r.cost_usd) || 0,
    }));
  }

  async bumpApiKeyUsage(keyId, costUSD) {
    await this.q(
      `UPDATE api_keys SET requests = requests + 1, cost_usd = cost_usd + $2 WHERE id = $1`,
      [keyId, costUSD || 0]
    );
  }

  async revokeApiKey(userId, keyId) {
    const { rowCount } = await this.q(`DELETE FROM api_keys WHERE id = $1 AND user_id = $2`, [keyId, userId]);
    return rowCount > 0;
  }

  // --- Durable per-user memory (personalization) --------------------------

  async addMemory(userId, text) {
    const mid = id('mem');
    const now = Date.now();
    await this.q(
      `INSERT INTO user_memories (id, user_id, text, created_at) VALUES ($1, $2, $3, $4)`,
      [mid, userId, String(text), now]
    );
    return { id: mid, text: String(text), createdAt: now };
  }

  async listMemories(userId) {
    const { rows } = await this.q(
      `SELECT id, text, created_at FROM user_memories WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map((r) => ({ id: r.id, text: r.text, createdAt: Number(r.created_at) }));
  }

  async deleteMemory(userId, memoryId) {
    const { rowCount } = await this.q(
      `DELETE FROM user_memories WHERE id = $1 AND user_id = $2`,
      [memoryId, userId]
    );
    return rowCount > 0;
  }

  // Merge a quality-feedback signal into a message's meta (jsonb || merge).
  async recordFeedback(conversationId, messageId, signal) {
    const fb = JSON.stringify({ feedback: { signal, at: Date.now() } });
    const { rowCount } = await this.q(
      `UPDATE messages SET meta = coalesce(meta, '{}'::jsonb) || $3::jsonb
       WHERE id = $1 AND conversation_id = $2`,
      [messageId, conversationId, fb]
    );
    return rowCount > 0;
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

  async createUser({ email, name, passwordHash, plan = 'free', role = 'user', referredBy = null }) {
    const uid = id('user');
    const referralCode = randomUUID().replace(/-/g, '').slice(0, 8);
    const { rows } = await this.q(
      `INSERT INTO users (id, email, name, password_hash, plan, role, referral_code, referred_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [uid, String(email).trim(), name || null, passwordHash, plan, role, referralCode, referredBy || null, Date.now()]
    );
    if (rows.length === 0) throw new Error('An account with that email already exists.');
    return mapUser(rows[0]);
  }

  async getUserByEmail(email) {
    const { rows } = await this.q(`SELECT * FROM users WHERE email = $1`, [String(email).trim()]);
    return mapUser(rows[0]) || null;
  }

  async getUserByReferralCode(code) {
    const { rows } = await this.q(`SELECT * FROM users WHERE referral_code = $1`, [String(code || '').trim()]);
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

  // --- Per-account usage metering -----------------------------------------

  async getUserUsage(userId, periodMs) {
    const { rows } = await this.q(
      `SELECT spent_usd, spend_period_start FROM users WHERE id = $1`,
      [userId]
    );
    const r = rows[0];
    if (!r) return 0;
    const now = Date.now();
    if (!Number(r.spend_period_start) || now - Number(r.spend_period_start) >= periodMs) {
      await this.q(`UPDATE users SET spent_usd = 0, spend_period_start = $2 WHERE id = $1`, [userId, now]);
      return 0;
    }
    return Number(r.spent_usd) || 0;
  }

  async addUserUsage(userId, deltaUSD) {
    const { rows } = await this.q(
      `UPDATE users SET spent_usd = spent_usd + $2 WHERE id = $1 RETURNING spent_usd`,
      [userId, deltaUSD || 0]
    );
    return rows[0] ? Number(rows[0].spent_usd) : 0;
  }

  // --- Top-up credit (purchased, rolls over across periods) ---------------

  async getUserCredit(userId) {
    const { rows } = await this.q(`SELECT topup_credit_usd FROM users WHERE id = $1`, [userId]);
    return rows[0] ? Number(rows[0].topup_credit_usd) || 0 : 0;
  }

  async addUserCredit(userId, deltaUSD) {
    const { rows } = await this.q(
      `UPDATE users SET topup_credit_usd = GREATEST(0, topup_credit_usd + $2) WHERE id = $1 RETURNING topup_credit_usd`,
      [userId, deltaUSD || 0]
    );
    return rows[0] ? Number(rows[0].topup_credit_usd) : 0;
  }

  async getUserSavings(userId) {
    const { rows } = await this.q(`SELECT saved_usd FROM users WHERE id = $1`, [userId]);
    return rows[0] ? Number(rows[0].saved_usd) || 0 : 0;
  }

  async addUserSavings(userId, deltaUSD) {
    const { rows } = await this.q(
      `UPDATE users SET saved_usd = GREATEST(0, saved_usd + $2) WHERE id = $1 RETURNING saved_usd`,
      [userId, deltaUSD || 0]
    );
    return rows[0] ? Number(rows[0].saved_usd) : 0;
  }
}
