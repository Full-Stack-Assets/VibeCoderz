import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStorage } from './_shim.ts'
import {
  saveConversation,
  listConversations,
  loadConversation,
  deleteConversation,
  renameConversation,
  conversationToMarkdown,
  titleFrom,
  setHistoryNamespace,
  type StoredConversation,
} from '../lib/history.ts'

const conv = (over: Partial<StoredConversation> = {}): StoredConversation => ({
  id: 'c1',
  title: 'Test',
  updatedAt: 1,
  spentUSD: 0,
  messages: [
    { id: 'm1', role: 'user', content: 'Hello' },
    { id: 'm2', role: 'assistant', content: 'Hi there' },
  ],
  ...over,
})

beforeEach(() => {
  installBrowserStorage()
  setHistoryNamespace(null)
})

test('history is isolated per account namespace', () => {
  setHistoryNamespace('u1')
  saveConversation(conv({ id: 'a' }))
  setHistoryNamespace('u2')
  assert.equal(listConversations().length, 0, 'u2 sees none of u1’s history')
  saveConversation(conv({ id: 'b' }))
  assert.equal(listConversations().length, 1)
  setHistoryNamespace('u1')
  assert.deepEqual(
    listConversations().map((c) => c.id),
    ['a']
  )
})

test('saveConversation strips heavy base64 image data but keeps the file chip', () => {
  saveConversation(
    conv({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'see this',
          attachments: [{ id: 'i1', kind: 'image', name: 'pic.png', mediaType: 'image/png', size: 8, dataUrl: 'data:image/png;base64,AAAABBBB' }],
        },
      ],
    })
  )
  const loaded = loadConversation('c1')!
  const att = loaded.messages[0].attachments![0]
  assert.equal(att.dataUrl, undefined, 'base64 payload dropped')
  assert.equal(att.name, 'pic.png', 'attachment metadata preserved')
})

test('pending messages are not persisted', () => {
  saveConversation(
    conv({ messages: [{ id: 'm1', role: 'assistant', content: '', pending: true }] })
  )
  assert.equal(loadConversation('c1')!.messages.length, 0)
})

test('rename updates the title; delete removes the conversation', () => {
  saveConversation(conv({ id: 'x', title: 'Old' }))
  renameConversation('x', 'New name')
  assert.equal(loadConversation('x')!.title, 'New name')
  deleteConversation('x')
  assert.ok(!loadConversation('x'), 'deleted conversation is gone')
})

test('listConversations returns newest first', () => {
  saveConversation(conv({ id: 'old', updatedAt: 100 }))
  saveConversation(conv({ id: 'new', updatedAt: 200 }))
  assert.deepEqual(
    listConversations().map((c) => c.id),
    ['new', 'old']
  )
})

test('conversationToMarkdown renders roles and content', () => {
  const md = conversationToMarkdown(conv({ title: 'Chat' }))
  assert.match(md, /^# Chat/)
  assert.match(md, /\*\*You:\*\*/)
  assert.match(md, /Hello/)
  assert.match(md, /Hi there/)
})

test('titleFrom uses the first user message and truncates', () => {
  assert.equal(titleFrom([{ id: '1', role: 'assistant', content: 'x' }, { id: '2', role: 'user', content: 'Find the bug' }]), 'Find the bug')
  const long = 'a'.repeat(80)
  assert.ok(titleFrom([{ id: '1', role: 'user', content: long }]).length <= 49)
})
