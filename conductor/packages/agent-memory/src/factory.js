/**
 * Store factory — picks the persistence backend at runtime.
 *
 * DATABASE_URL set + @prisma/client available → PrismaStore (durable Postgres).
 * Otherwise → InMemoryStore (zero-config). If Postgres is requested but the
 * client/connection isn't available, it logs and falls back to in-memory rather
 * than crashing the app — memory is best-effort and never blocks a chat turn.
 */

import { InMemoryStore } from './memory-store.js';
import { PrismaStore } from './prisma-store.js';

let _singleton = null;

export async function createStore({ databaseUrl = process.env.DATABASE_URL } = {}) {
  if (databaseUrl) {
    try {
      return await PrismaStore.create();
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
