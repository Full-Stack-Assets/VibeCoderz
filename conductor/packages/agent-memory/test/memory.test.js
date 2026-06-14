import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/index.js';

test('stores messages and replays a capped context window', async () => {
  const store = new InMemoryStore();
  const conv = await store.createConversation('demo');
  for (let i = 0; i < 15; i++) {
    await store.addMessage(conv.id, i % 2 === 0 ? 'user' : 'assistant', `m${i}`);
  }
  const ctx = await store.getContext(conv.id, 10);
  assert.equal(ctx.length, 10);
  assert.equal(ctx.at(-1).content, 'm14');
  assert.ok(ctx.every((m) => m.role === 'user' || m.role === 'assistant'));
});

test('persists routing metadata alongside the message', async () => {
  const store = new InMemoryStore();
  const conv = await store.createConversation();
  const msg = await store.addMessage(conv.id, 'assistant', 'hi', { model: 'x', costUSD: 0.01 });
  assert.equal(msg.meta.model, 'x');
  const all = await store.getMessages(conv.id);
  assert.equal(all.length, 1);
});

test('per-user memories: add, list (scoped per user), and delete', async () => {
  const store = new InMemoryStore();
  const a = await store.addMemory('user_a', 'prefers TypeScript');
  await store.addMemory('user_a', 'likes concise answers');
  await store.addMemory('user_b', 'works in Go');

  const aList = await store.listMemories('user_a');
  assert.equal(aList.length, 2, 'memories are scoped per user');
  assert.equal((await store.listMemories('user_b')).length, 1);
  assert.ok(aList.every((m) => m.id && m.text && m.createdAt));

  assert.equal(await store.deleteMemory('user_a', a.id), true);
  assert.equal((await store.listMemories('user_a')).length, 1);
  // Deleting a non-existent memory, or one owned by another user, is a no-op.
  assert.equal(await store.deleteMemory('user_a', 'nope'), false);
  assert.equal(await store.deleteMemory('user_b', a.id), false);
});

test('recordFeedback merges a quality label into the message meta', async () => {
  const store = new InMemoryStore();
  const conv = await store.createConversation();
  const msg = await store.addMessage(conv.id, 'assistant', 'hi', { model: 'x' });

  const ok = await store.recordFeedback(conv.id, msg.id, 'up');
  assert.equal(ok, true);
  const [stored] = await store.getMessages(conv.id);
  assert.equal(stored.meta.feedback.signal, 'up');
  assert.equal(stored.meta.model, 'x', 'existing meta is preserved');

  // Unknown message / conversation → false, no throw.
  assert.equal(await store.recordFeedback(conv.id, 'nope', 'down'), false);
  assert.equal(await store.recordFeedback('nope', msg.id, 'down'), false);
});

test('logs tool executions', async () => {
  const store = new InMemoryStore();
  const conv = await store.createConversation();
  const rec = await store.logToolExecution(conv.id, 'run-command', { cmd: 'ls' }, { ok: true });
  assert.equal(rec.name, 'run-command');
});
