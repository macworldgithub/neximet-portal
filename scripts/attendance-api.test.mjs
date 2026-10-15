import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup(storage, fetcher) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, process: { env: {} }, window: {}, localStorage: storage, fetch: fetcher, console: { error() {} } });
  return module.exports;
}

test('an attendance API call returns a failure result when browser token storage becomes unavailable', async () => {
  const api = setup({ getItem() { throw new Error('Storage access denied'); } }, () => { throw new Error('Request must not be sent'); });
  const result = await api.apiFetch('/attendance/check-in', { method: 'POST' });
  assert.equal(result.success, false);
  assert.match(result.message, /Storage access denied/);
});

test('a failed HTTP attendance response cannot be treated as success because of its JSON flag', async () => {
  const api = setup({ getItem: () => 'token' }, async () => ({ ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ success: true, message: 'Unexpected server response' }) }));
  assert.equal((await api.apiFetch('/attendance/check-out', { method: 'POST' })).success, false);
});
