/**
 * Store factory — picks the persistence backend at runtime.
 *
 * DATABASE_URL set → PgStore (durable Postgres that provisions its own schema on
 * first use — no Prisma CLI / migrations needed). If Postgres is requested but
 * the `pg` driver/connection isn't available, it logs and falls back to the
 * in-memory store rather than crashing — memory is best-effort and never blocks
 * a chat turn. (PrismaStore remains available for teams that prefer Prisma.)
 */

import { InMemoryStore } from './memory-store.js';
import { PgStore } from './pg-store.js';

let _singleton = null;

export async function createStore({ databaseUrl = process.env.DATABASE_URL } = {}) {
  if (databaseUrl) {
    try {
      return await PgStore.create();
    } catch (err) {
      console.warn(
        `[agent-memory] DATABASE_URL set but Postgres store unavailable ` +
          `(${err?.message || err}); falling back to in-memory store.`
      );
    }
  }
  return new InMemoryStore();
}

/** Process-wide singleton store, created lazily on first use. */
export async function getStore(opts) {
  if (!_singleton) _singleton = await createStore(opts);
  return _singleton;
}
