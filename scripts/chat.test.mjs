import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/chat.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URLSearchParams });
const chat = { members: [{ user: { _id: 'alice' } }, { user: { _id: 'bob' } }, { user: { _id: 'carol' } }] };
test('group ticks progress from single to double to blue only after every recipient acknowledges', () => {
  const message = { _id: 'message', sequence: 1, readBy: ['alice'], deliveredBy: ['alice'] };
  assert.equal(exports.messageStatus(message, chat, 'alice'), 'sent');
  message.deliveredBy.push('bob');
  assert.equal(exports.messageStatus(message, chat, 'alice'), 'sent');
  message.deliveredBy.push('carol');
  assert.equal(exports.messageStatus(message, chat, 'alice'), 'delivered');
  message.readBy.push('bob');
  assert.equal(exports.messageStatus(message, chat, 'alice'), 'delivered');
  message.readBy.push('carol');
  assert.equal(exports.messageStatus(message, chat, 'alice'), 'seen');
});
test('out-of-order message synchronization never regresses delivery or seen receipts', () => {
  const current = { _id: 'message', sequence: 1, readBy: ['alice', 'bob'], deliveredBy: ['alice', 'bob'] };
  const stale = { ...current, readBy: ['alice'], deliveredBy: undefined };
  const result = exports.mergeMessages([current], [stale]);
  assert.equal(result.length, 1);
  assert.ok(result[0].readBy.includes('bob'));
  assert.ok(result[0].deliveredBy.includes('bob'));
});

test('attachment batches accept 100 MB exactly and enforce the combined limit and count', () => {
  const limit = 100 * 1024 * 1024;
  assert.equal(exports.validateChatFiles([{ name: 'large.zip', size: limit }]), null);
  assert.equal(exports.validateChatFiles([{ name: 'one.txt', size: limit / 2 }, { name: 'two.mp4', size: limit / 2 }]), null);
  assert.match(exports.validateChatFiles([{ name: 'one.txt', size: limit }, { name: 'two.txt', size: 1 }]), /100 MB/);
  assert.match(exports.validateChatFiles(Array.from({ length: 21 }, () => ({ name: 'tiny.txt', size: 1 }))), /20 files/);
  assert.match(exports.validateChatFiles([{ name: 'script.html', size: 1 }]), /Use an image/);
});

test('legacy and multiple attachment metadata use the correct private download URL', () => {
  const legacy = { conversation: 'chat', _id: 'message', attachment: { name: 'old.txt' } };
  assert.deepEqual(Array.from(exports.messageAttachments(legacy), file => file.name), ['old.txt']);
  const multiple = { ...legacy, attachments: [{ name: 'one.txt' }, { name: 'two.png' }] };
  assert.deepEqual(Array.from(exports.messageAttachments(multiple), file => file.name), ['one.txt', 'two.png']);
  assert.equal(exports.attachmentPath(multiple, 1, true), '/chat/conversations/chat/messages/message/attachment?preview=1&index=1');
  assert.equal(exports.attachmentPath(legacy), '/chat/conversations/chat/messages/message/attachment');
});
