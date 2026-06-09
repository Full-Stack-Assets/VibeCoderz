import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, InMemoryStore } from '../src/index.js';

test('createStore returns in-memory when no DATABASE_URL', async () => {
  const store = await createStore({ databaseUrl: undefined });
  assert.ok(store instanceof InMemoryStore);
});

test('createStore falls back to in-memory when Prisma is unavailable', async () => {
  // DATABASE_URL set but @prisma/client not installed → graceful fallback,
  // never a crash.
  const store = await createStore({ databaseUrl: 'postgresql://localhost/none' });
  assert.ok(store instanceof InMemoryStore);
});

test('round-trips a conversation through the chosen store', async () => {
  const store = await createStore({});
  const conv = await store.createConversation('slice');
  await store.addMessage(conv.id, 'user', 'hi');
  await store.addMessage(conv.id, 'assistant', 'hello', { model: 'claude', costUSD: 0.001 });
  const ctx = await store.getContext(conv.id, 10);
  assert.equal(ctx.length, 2);
  assert.equal(ctx[1].content, 'hello');
});
