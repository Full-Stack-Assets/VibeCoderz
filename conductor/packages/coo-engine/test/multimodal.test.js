import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTurn,
  routeTurn,
  visionModels,
  messagesHaveImages,
  contentToText,
  toOpenAIContent,
  toAnthropicContent,
} from '../src/index.js';

test('classifyTurn surfaces research / data / vision / general domains', () => {
  assert.equal(classifyTurn('search the web for the latest news').domain, 'research');
  assert.equal(classifyTurn('parse this csv dataset of rows and columns').domain, 'data');
  assert.equal(classifyTurn('just chatting').domain, 'general');
  const v = classifyTurn('what is this', { hasImages: true });
  assert.equal(v.domain, 'vision');
  assert.equal(v.requiresVision, true);
});

test('research and data turns still route on the analysis type', () => {
  assert.equal(classifyTurn('look up the latest news').type, 'analysis');
  assert.equal(classifyTurn('summarise this csv spreadsheet').type, 'analysis');
});

test('an image-bearing turn routes only to a multimodal model', () => {
  const r = routeTurn({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is in this picture?' },
          { type: 'image', dataUrl: 'data:image/png;base64,AAAA' },
        ],
      },
    ],
    hasImages: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.model.multimodal, true, 'routed model must accept images');
});

test('image + analysis turn avoids the text-only analysis specialist (Grok)', () => {
  const r = routeTurn({
    messages: [{ role: 'user', content: [{ type: 'text', text: 'analyze this chart' }, { type: 'image', dataUrl: 'data:image/png;base64,AAAA' }] }],
    hasImages: true,
  });
  assert.equal(r.ok, true);
  assert.notEqual(r.model.id, 'xai/grok-4.3-fast-reasoning');
  assert.equal(r.model.multimodal, true);
});

test('visionModels excludes the text-only model', () => {
  const ids = visionModels().map((m) => m.id);
  assert.ok(ids.includes('google/gemini-3-pro'));
  assert.ok(!ids.includes('xai/grok-4.3-fast-reasoning'));
});

test('content helpers convert multimodal blocks per provider', () => {
  const blocks = [
    { type: 'text', text: 'hello' },
    { type: 'image', dataUrl: 'data:image/png;base64,QUJD' },
  ];
  assert.ok(messagesHaveImages([{ role: 'user', content: blocks }]));
  assert.equal(contentToText(blocks), 'hello');

  const oai = toOpenAIContent(blocks);
  assert.equal(oai[1].type, 'image_url');
  assert.equal(oai[1].image_url.url, 'data:image/png;base64,QUJD');

  const ant = toAnthropicContent(blocks);
  assert.equal(ant[1].type, 'image');
  assert.equal(ant[1].source.type, 'base64');
  assert.equal(ant[1].source.media_type, 'image/png');
  assert.equal(ant[1].source.data, 'QUJD');

  // plain strings pass through untouched
  assert.equal(toOpenAIContent('hi'), 'hi');
  assert.equal(toAnthropicContent('hi'), 'hi');
});
