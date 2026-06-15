import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemories, looksLikePreference, parseMemoryList } from '../src/memory-extract.js';

test('looksLikePreference gates on durable first-person statements', () => {
  assert.equal(looksLikePreference('I prefer TypeScript and concise answers'), true);
  assert.equal(looksLikePreference("I'm building a Next.js app"), true);
  assert.equal(looksLikePreference('my name is Sam'), true);
  assert.equal(looksLikePreference('from now on use Python'), true);
  // Ordinary task questions don't trigger an extraction call.
  assert.equal(looksLikePreference('How do I reverse a string in JS?'), false);
  assert.equal(looksLikePreference('What is the capital of France?'), false);
});

test('parseMemoryList extracts the JSON array, drops blanks/overlong, dedups', () => {
  assert.deepEqual(parseMemoryList('["prefers TypeScript", "based in Berlin"]'), ['prefers TypeScript', 'based in Berlin']);
  // Tolerates prose around the array.
  assert.deepEqual(parseMemoryList('Here you go:\n["likes concise answers"]\nthanks'), ['likes concise answers']);
  // Dedups (case-insensitive) against existing memories, caps at 3.
  assert.deepEqual(parseMemoryList('["Prefers TypeScript", "new fact"]', ['prefers typescript']), ['new fact']);
  assert.deepEqual(parseMemoryList('["a","b","c","d"]'), ['a', 'b', 'c']);
  // Malformed / non-array → [].
  assert.deepEqual(parseMemoryList('not json'), []);
  assert.deepEqual(parseMemoryList('{"x":1}'), []);
});

test('extractMemories skips the LLM call entirely for non-preference turns', async () => {
  let called = 0;
  const complete = async () => {
    called++;
    return { text: '["should not happen"]', simulated: false };
  };
  const out = await extractMemories({ text: 'What is 2 + 2?', complete });
  assert.deepEqual(out, []);
  assert.equal(called, 0, 'no extraction call on a non-preference turn');
});

test('extractMemories returns new facts and respects existing on a preference turn', async () => {
  const complete = async (model, opts) => {
    // The prompt should carry the user message and the known list.
    assert.match(opts.messages[0].content, /prefer TypeScript/);
    return { text: '["prefers TypeScript", "wants concise answers"]', simulated: false };
  };
  const out = await extractMemories({ text: 'I prefer TypeScript', existing: ['prefers typescript'], complete });
  assert.deepEqual(out, ['wants concise answers']); // dedups the already-known one
});

test('a simulated completion yields no memories', async () => {
  const complete = async () => ({ text: '["x"]', simulated: true });
  assert.deepEqual(await extractMemories({ text: 'I prefer dark mode', complete }), []);
});
