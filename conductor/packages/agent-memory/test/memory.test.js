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

test('logs tool executions', async () => {
  const store = new InMemoryStore();
  const conv = await store.createConversation();
  const rec = await store.logToolExecution(conv.id, 'run-command', { cmd: 'ls' }, { ok: true });
  assert.equal(rec.name, 'run-command');
});
