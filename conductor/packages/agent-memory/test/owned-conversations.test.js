import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/index.js';

const snap = (messages) => ({ messages, spentUSD: 0 });

test('upsert + list returns an owner’s conversations, newest first', async () => {
  const store = new InMemoryStore();
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'First', updatedAt: 100, snapshot: snap([]) });
  await store.upsertConversation({ id: 'b', ownerId: 'u1', title: 'Second', updatedAt: 200, snapshot: snap([]) });
  const list = await store.listConversations('u1');
  assert.deepEqual(list.map((c) => c.id), ['b', 'a']);
  assert.equal(list[0].title, 'Second');
});

test('conversations are isolated per owner', async () => {
  const store = new InMemoryStore();
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'Mine', updatedAt: 1, snapshot: snap([]) });
  await store.upsertConversation({ id: 'b', ownerId: 'u2', title: 'Theirs', updatedAt: 1, snapshot: snap([]) });
  assert.equal((await store.listConversations('u1')).length, 1);
  assert.equal(await store.getConversation('b', 'u1'), null, 'cannot read another owner’s conversation');
  assert.ok(await store.getConversation('b', 'u2'));
});

test('upsert overwrites the snapshot for the same id', async () => {
  const store = new InMemoryStore();
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'v1', updatedAt: 1, snapshot: snap([{ role: 'user', content: 'hi' }]) });
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'v2', updatedAt: 2, snapshot: snap([{ role: 'user', content: 'bye' }]) });
  const rec = await store.getConversation('a', 'u1');
  assert.equal(rec.title, 'v2');
  assert.equal(rec.snapshot.messages[0].content, 'bye');
  assert.equal((await store.listConversations('u1')).length, 1, 'no duplicate entry');
});

test('rename only succeeds for the owner', async () => {
  const store = new InMemoryStore();
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'old', updatedAt: 1, snapshot: snap([]) });
  assert.equal(await store.renameConversation('a', 'u2', 'hijack'), false);
  assert.equal(await store.renameConversation('a', 'u1', 'new'), true);
  assert.equal((await store.getConversation('a', 'u1')).title, 'new');
});

test('delete only succeeds for the owner', async () => {
  const store = new InMemoryStore();
  await store.upsertConversation({ id: 'a', ownerId: 'u1', title: 'x', updatedAt: 1, snapshot: snap([]) });
  assert.equal(await store.deleteConversation('a', 'u2'), false);
  assert.equal(await store.deleteConversation('a', 'u1'), true);
  assert.equal(await store.getConversation('a', 'u1'), null);
});

test('upsert requires id and ownerId', async () => {
  const store = new InMemoryStore();
  await assert.rejects(() => store.upsertConversation({ id: '', ownerId: 'u1' }));
  await assert.rejects(() => store.upsertConversation({ id: 'a', ownerId: '' }));
});
