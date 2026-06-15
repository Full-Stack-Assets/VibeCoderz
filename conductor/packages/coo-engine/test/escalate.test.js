import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeWithEscalation, judgeAnswer, topModelId, parseScore, defaultJudgeModelId } from '../src/escalate.js';

// A scriptable `complete` stub: returns a queued reply per model id, recording
// every call. Lets us drive the escalate loop deterministically with no keys.
function makeStub(byModel) {
  const calls = [];
  const complete = async (modelId, opts) => {
    calls.push({ modelId, opts });
    const r = byModel[modelId];
    if (typeof r === 'function') return r(opts);
    return { text: '', costUSD: 0, simulated: false, ...r };
  };
  return { complete, calls };
}

const CHEAP = 'xai/grok-4.1-fast-reasoning'; // capability 0.89 (below top)
const TOP = topModelId(); // strongest catalog model

test('parseScore maps 0-100 verdicts to 0..1 and clamps', () => {
  assert.equal(parseScore('85'), 0.85);
  assert.equal(parseScore('score: 60 / 100'), 0.6);
  assert.equal(parseScore('150'), 1);
  assert.equal(parseScore('nope'), null);
});

test('topModelId returns the highest-capability model and can exclude one', () => {
  assert.ok(TOP);
  assert.notEqual(topModelId(TOP), TOP); // excluding the top yields a different model
});

test('defaultJudgeModelId is a cheaper mid-tier model, and is overridable', () => {
  // Default judge is NOT the premium model (that would erode the savings).
  assert.notEqual(defaultJudgeModelId({}), TOP);
  // A valid override wins; an unknown id is ignored (falls back).
  assert.equal(defaultJudgeModelId({ CONDUCTOR_JUDGE_MODEL: 'xai/grok-4.1-fast-reasoning' }), 'xai/grok-4.1-fast-reasoning');
  assert.notEqual(defaultJudgeModelId({ CONDUCTOR_JUDGE_MODEL: 'not/a-real-model' }), 'not/a-real-model');
});

test('a passing answer is NOT escalated (one judge call, no second model)', async () => {
  const { complete, calls } = makeStub({
    [CHEAP]: { text: 'good answer', costUSD: 0.001 },
    [TOP]: { text: 'premium', costUSD: 0.02 },
  });
  // Judge (TOP) returns 90 → above the 0.6 bar.
  const byModel = {
    [CHEAP]: { text: 'good answer', costUSD: 0.001 },
    [TOP]: (opts) =>
      /Score \(0-100\)/.test(opts.messages.at(-1).content)
        ? { text: '90', costUSD: 0.0001 }
        : { text: 'premium', costUSD: 0.02 },
  };
  const stub = makeStub(byModel);
  // Pin TOP as the judge so the stub's combined TOP handler grades the answer.
  const out = await completeWithEscalation(CHEAP, { messages: [{ role: 'user', content: 'hi' }] }, { complete: stub.complete, judgeModelId: TOP });
  assert.equal(out.escalation.escalated, false);
  assert.equal(out.escalation.score, 0.9);
  assert.equal(out.text, 'good answer');
  // cheap answer + judge only — never called TOP for a real answer.
  const topAnswerCalls = stub.calls.filter((c) => c.modelId === TOP && !/Score/.test(c.opts.messages.at(-1).content));
  assert.equal(topAnswerCalls.length, 0);
});

test('a failing answer IS escalated to the top model, costs summed', async () => {
  const byModel = {
    [CHEAP]: { text: 'weak answer', costUSD: 0.001 },
    [TOP]: (opts) =>
      /Score \(0-100\)/.test(opts.messages.at(-1).content)
        ? { text: '20', costUSD: 0.0002 } // judge: below bar
        : { text: 'expert answer', costUSD: 0.02 }, // escalated answer
  };
  const stub = makeStub(byModel);
  const out = await completeWithEscalation(CHEAP, { messages: [{ role: 'user', content: 'hard q' }] }, { complete: stub.complete, judgeModelId: TOP });
  assert.equal(out.escalation.escalated, true);
  assert.equal(out.escalation.firstModel, CHEAP);
  assert.equal(out.escalation.finalModel, TOP);
  assert.equal(out.text, 'expert answer');
  assert.equal(out.costUSD, Number((0.001 + 0.0002 + 0.02).toFixed(6)));
});

test('a simulated first answer is never judged or escalated', async () => {
  const stub = makeStub({ [CHEAP]: { text: '[sim]', costUSD: 0, simulated: true } });
  const out = await completeWithEscalation(CHEAP, { messages: [{ role: 'user', content: 'hi' }] }, { complete: stub.complete });
  assert.equal(out.escalation.evaluated, false);
  assert.equal(stub.calls.length, 1); // only the first completion, no judge
});

test('judgeAnswer returns null score for a simulated verdict', async () => {
  const { complete } = makeStub({ [TOP]: { text: '99', simulated: true } });
  const r = await judgeAnswer({ prompt: 'q', answer: 'a', judgeModel: TOP, complete });
  assert.equal(r.score, null);
  assert.equal(r.simulated, true);
});
