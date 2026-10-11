import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/chat.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
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
