import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTurn, detectSensitive, routeTurn, getModel } from '../src/index.js';

const CHEAPEST = 'xai/grok-4.1-fast-reasoning'; // capability 0.89

test('detectSensitive flags high-stakes domains and ignores benign turns', () => {
  assert.equal(detectSensitive('What dosage of medication should I take for these symptoms?').category, 'medical');
  assert.equal(detectSensitive('Can I sue my landlord? Is it legal to withhold rent?').category, 'legal');
  assert.equal(detectSensitive('Should I invest in this stock for my retirement plan?').category, 'financial');
  assert.equal(detectSensitive('I want to die and might hurt myself').category, 'crisis');
  assert.equal(detectSensitive('Write a function that reverses a string'), null);
  assert.equal(detectSensitive('Draft a friendly release note'), null);
});

test('crisis outranks other categories (highest floor wins)', () => {
  const hit = detectSensitive('legal advice: I want to kill myself over this lawsuit');
  assert.equal(hit.category, 'crisis');
  assert.equal(hit.floor, 0.95);
});

test('classifyTurn raises minQuality to the safety floor for sensitive turns', () => {
  const c = classifyTurn('What medication dosage treats these symptoms?');
  assert.equal(c.sensitive, 'medical');
  assert.ok(c.minQuality >= 0.92, `minQuality ${c.minQuality} >= 0.92`);
  // A benign easy turn is unaffected and stays below the safety floor.
  const benign = classifyTurn('Write a one-line release note');
  assert.equal(benign.sensitive, null);
  assert.ok(benign.minQuality < 0.92);
});

test('the safety floor only raises the bar, never lowers a stricter user floor', () => {
  const c = classifyTurn('Should I invest in this stock?', { qualityFloor: 0.99 });
  assert.ok(c.minQuality >= 0.95, 'a stricter caller floor is preserved'); // capped at 0.98
});

test('routeTurn never sends a high-stakes turn to the cheapest (below-bar) model', () => {
  const decision = routeTurn({
    messages: [{ role: 'user', content: 'What dosage of this medication should I take for my symptoms?' }],
    budgetUSD: 1e6,
    spentUSD: 0,
  });
  assert.ok(decision.ok && decision.model, 'a qualified model is still routed');
  const chosen = getModel(decision.model.id);
  assert.ok(chosen.capability >= 0.92, `routed to a >=0.92 model (got ${chosen.id} @ ${chosen.capability})`);
  assert.notEqual(decision.model.id, CHEAPEST);
  assert.equal(decision.classification.sensitive, 'medical');
});
