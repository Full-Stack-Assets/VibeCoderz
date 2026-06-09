/**
 * @conductor/agent-memory — conversation memory for the agent runtime.
 *
 * A store interface with two interchangeable backends:
 *   - InMemoryStore : zero-config, in-process (default)
 *   - PrismaStore   : durable Postgres, selected when DATABASE_URL is set
 * Use `getStore()` / `createStore()` to get the right one for the environment.
 */

export { InMemoryStore } from './memory-store.js';
export { PrismaStore } from './prisma-store.js';
export { createStore, getStore } from './factory.js';

// Back-compat default singleton (in-memory) for callers that imported `memory`.
import { InMemoryStore } from './memory-store.js';
export const memory = new InMemoryStore();
