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

test('api keys: create stores only a hash, resolve finds the owner, list hides the secret, revoke is scoped', async () => {
  const store = new InMemoryStore();
  const rec = await store.createApiKey('user_a', 'CI key', 'hash_aaa');
  assert.ok(rec.id && rec.label === 'CI key');
  assert.equal(rec.hash, undefined, 'create never returns the hash/secret');

  // Resolve by hash → owner; an unknown hash → null.
  const resolved = await store.resolveApiKey('hash_aaa');
  assert.equal(resolved.userId, 'user_a');
  assert.equal(await store.resolveApiKey('nope'), null);

  // List is scoped and carries no secret material.
  await store.createApiKey('user_b', 'other', 'hash_bbb');
  const list = await store.listApiKeys('user_a');
  assert.equal(list.length, 1);
  assert.equal(list[0].hash, undefined);
  assert.ok('lastUsedAt' in list[0]);

  // Revoke only works for the owner.
  assert.equal(await store.revokeApiKey('user_b', rec.id), false, "can't revoke another user's key");
  assert.equal(await store.revokeApiKey('user_a', rec.id), true);
  assert.equal(await store.resolveApiKey('hash_aaa'), null);
});

test('user savings accrue cumulatively and floor at zero', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 's@x.com', passwordHash: 'h' });
  assert.equal(await store.getUserSavings(u.id), 0);
  assert.equal(await store.addUserSavings(u.id, 0.0123), 0.0123);
  const total = await store.addUserSavings(u.id, 0.05);
  assert.ok(Math.abs(total - 0.0623) < 1e-9, 'savings sum');
  assert.equal(await store.getUserSavings(u.id), total);
  // Unknown user → 0, no throw.
  assert.equal(await store.getUserSavings('nope'), 0);
})

test('api key usage counters accrue and surface in the listing', async () => {
  const store = new InMemoryStore();
  const k = await store.createApiKey('u1', 'ci', 'hash_k');
  await store.bumpApiKeyUsage(k.id, 0.01);
  await store.bumpApiKeyUsage(k.id, 0.02);
  const [listed] = await store.listApiKeys('u1');
  assert.equal(listed.requests, 2);
  assert.ok(Math.abs(listed.costUSD - 0.03) < 1e-9, 'cost accrues');
})

test('referral codes are unique, resolvable, and recorded on the referee', async () => {
  const store = new InMemoryStore();
  const ref = await store.createUser({ email: 'ref@x.com', passwordHash: 'h' });
  assert.ok(ref.referralCode && ref.referralCode.length >= 6);
  assert.equal((await store.getUserByReferralCode(ref.referralCode)).id, ref.id);
  const referee = await store.createUser({ email: 'new@x.com', passwordHash: 'h', referredBy: ref.id });
  assert.equal(referee.referredBy, ref.id);
  assert.notEqual(referee.referralCode, ref.referralCode);
  assert.equal(await store.getUserByReferralCode('nope'), null);
})

test('referral reward is one-shot per referee, capped per referrer, and only for the referred', async () => {
  const store = new InMemoryStore();
  const ref = await store.createUser({ email: 'r@x.com', passwordHash: 'h' });
  const a = await store.createUser({ email: 'a@x.com', passwordHash: 'h', referredBy: ref.id });

  // First paid action pays out once, returning the referrer to credit.
  assert.equal(await store.claimReferralReward(a.id), ref.id);
  // A second paid action by the same referee never pays again (one-shot).
  assert.equal(await store.claimReferralReward(a.id), null, 'no double payout per referee');

  // A user who wasn't referred yields nothing.
  const solo = await store.createUser({ email: 'solo@x.com', passwordHash: 'h' });
  assert.equal(await store.claimReferralReward(solo.id), null);

  // Per-referrer cap: with the referrer already at the cap, the referee is
  // still consumed (one-shot) but no payout is returned.
  const b = await store.createUser({ email: 'b@x.com', passwordHash: 'h', referredBy: ref.id });
  assert.equal(await store.claimReferralReward(b.id, 1), null, 'cap blocks payout');
  assert.equal(await store.claimReferralReward(b.id, 99), null, 'referee already consumed even when blocked');
})

test('auto-recharge prefs persist and the recharge claim is single-shot + clearable', async () => {
  const store = new InMemoryStore();
  const u = await store.createUser({ email: 'ar@x.com', passwordHash: 'h' });
  // Defaults: disabled.
  assert.equal((await store.getAutoRecharge(u.id)).enabled, false);
  const s = await store.setAutoRecharge(u.id, { enabled: true, thresholdUSD: 3, packId: 'p25' });
  assert.deepEqual([s.enabled, s.thresholdUSD, s.packId], [true, 3, 'p25']);
  // Atomic claim: first wins, a concurrent claim is refused until cleared.
  assert.equal(await store.claimRecharge(u.id), true);
  assert.equal(await store.claimRecharge(u.id), false, 'no double-charge while in flight');
  await store.clearRecharge(u.id);
  assert.equal(await store.claimRecharge(u.id), true, 'reclaimable after clear');
})

test('webhook idempotency: an event is claimed once, releasable for retry', async () => {
  const store = new InMemoryStore();
  // First delivery claims it; a duplicate delivery is rejected (skip side effects).
  assert.equal(await store.markEventProcessed('evt_1'), true);
  assert.equal(await store.markEventProcessed('evt_1'), false, 'duplicate is not re-claimed');
  // Releasing (after a failed handler) lets a retry re-claim it.
  await store.releaseEvent('evt_1');
  assert.equal(await store.markEventProcessed('evt_1'), true, 'retry re-claims after release');
  // Distinct events are independent.
  assert.equal(await store.markEventProcessed('evt_2'), true);
})

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
