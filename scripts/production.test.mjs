import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicURLs } from './check-production-env.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('production URLs keep the API and protected downloads on the same secure backend', () => {
  validatePublicURLs({ NEXT_PUBLIC_API_URL: 'https://backend.neximet.com/api', NEXT_PUBLIC_BASE_URL: 'https://backend.neximet.com' });
  validatePublicURLs({ NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4052/api', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:4052' });
  for (const [api, base] of [['', ''], ['http://backend.neximet.com/api', 'http://backend.neximet.com'], ['https://backend.neximet.com', 'https://backend.neximet.com'], ['https://backend.neximet.com/api', 'https://portal.neximet.com'], ['https://backend.neximet.com/api?token=secret', 'https://backend.neximet.com']]) assert.throws(() => validatePublicURLs({ NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_BASE_URL: base }));
});

test('the production frontend listens only on loopback port 4051 through PM2', () => {
  const frontend = createRequire(import.meta.url)('../ecosystem.config.js').apps[0];
  assert.equal(frontend.env.PORT, '4051'); assert.ok(frontend.args.includes('127.0.0.1')); assert.equal(frontend.instances, 1);
});

function documentDownload({ token = 'private-token', status = 200 } = {}) {
  const calls = [], links = [], revoked = [], compiledModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/projectDocuments.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module: compiledModule, exports: compiledModule.exports,
    require: () => ({ BASE_URL: 'https://backend.neximet.com', getToken: () => token }),
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: status === 200, status, blob: async () => ({}) }; },
    URL: { createObjectURL: () => 'blob:private-document', revokeObjectURL: url => revoked.push(url) },
    document: { body: { appendChild: () => {} }, createElement: () => { const link = { click() { links.push({ href: this.href, download: this.download }); }, remove() {} }; return link; } },
    setTimeout: callback => callback(),
  });
  return { download: compiledModule.exports.downloadScopeDocument, calls, links, revoked };
}

test('private downloads send bearer authorization in headers and revoke their temporary URL', async () => {
  const state = documentDownload(); await state.download('/uploads/scopes/private.pdf', 'Scope.pdf');
  assert.equal(state.calls[0].url, 'https://backend.neximet.com/uploads/scopes/private.pdf');
  assert.equal(state.calls[0].options.headers.Authorization, 'Bearer private-token'); assert.equal(state.calls[0].options.cache, 'no-store');
  assert.equal(state.links[0].download, 'Scope.pdf'); assert.deepEqual(state.revoked, ['blob:private-document']);
});

test('download links cannot send a bearer token to another origin or traverse paths', async () => {
  const state = documentDownload();
  for (const path of ['https://evil.test/private.pdf', '//evil.test/private.pdf', '/uploads/scopes/../private.pdf', '/uploads/scopes/private.pdf?token=bad']) await assert.rejects(() => state.download(path, 'file'));
  assert.equal(state.calls.length, 0);
});

test('logged-out or unauthorized downloads never create a public link', async () => {
  for (const settings of [{ token: null }, { status: 401 }, { status: 404 }]) {
    const state = documentDownload(settings); await assert.rejects(() => state.download('/uploads/scopes/private.pdf', 'file'));
    assert.equal(state.links.length, 0);
  }
});
