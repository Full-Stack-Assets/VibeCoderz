import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/index.js';

test('createUser stores a user and rejects duplicate emails', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 'me@example.com', name: 'Me', passwordHash: 'h' });
  assert.ok(u.id);
  assert.equal(u.plan, 'free');
  assert.equal(u.role, 'user');
  await assert.rejects(() => store.createUser({ email: 'me@example.com', passwordHash: 'h2' }));
});

test('lookup by email and id', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 'a@b.com', passwordHash: 'h', role: 'admin', plan: 'max' });
  assert.equal((await store.getUserByEmail('a@b.com')).id, u.id);
  assert.equal((await store.getUserById(u.id)).role, 'admin');
  assert.equal(await store.getUserByEmail('missing@b.com'), null);
});

test('updateUser patches fields (e.g. plan after checkout)', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 'p@b.com', passwordHash: 'h' });
  const updated = await store.updateUser(u.id, { plan: 'pro', stripeCustomerId: 'cus_1', subscriptionStatus: 'active' });
  assert.equal(updated.plan, 'pro');
  assert.equal(updated.stripeCustomerId, 'cus_1');
});

test('sessions resolve to their user and expire', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 's@b.com', passwordHash: 'h' });
  await store.createSession(u.id, 'tok-1', Date.now() + 10000);
  const live = await store.getSession('tok-1');
  assert.equal(live.user.id, u.id);

  await store.createSession(u.id, 'tok-old', Date.now() - 1000);
  assert.equal(await store.getSession('tok-old'), null, 'expired session rejected');

  await store.deleteSession('tok-1');
  assert.equal(await store.getSession('tok-1'), null);
});

test('usage metering accrues within a period and resets when it elapses', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 'meter@b.com', passwordHash: 'h' });
  assert.equal(await store.getUserUsage(u.id, 100000), 0);
  await store.addUserUsage(u.id, 0.5);
  await store.addUserUsage(u.id, 0.25);
  assert.equal(await store.getUserUsage(u.id, 100000), 0.75);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await store.getUserUsage(u.id, 1), 0, 'elapsed period resets spend');
});
