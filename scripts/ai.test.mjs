import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/ai.ts', import.meta.url), 'utf8');
function client(fetchImpl) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: () => ({ API_URL: 'https://portal.test/api', getToken: () => 'neximet-auth-token' }), fetch: fetchImpl, TextDecoder, Error, JSON,
  });
  return exports;
}
function response(events, newline = '\r\n') {
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}${newline}${newline}`).join(''));
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
test('stream client decodes UTF-8 deltas, completion, and errors and passes authentication/abort signal', async () => {
  let request;
  const events = [{ type: 'start', title: 'test' }, { type: 'delta', text: 'Hello 🌎' }, { type: 'error', message: 'partial reply' }, { type: 'done', message: { content: 'Hello 🌎', status: 'error' } }];
  const ai = client(async (url, options) => { request = { url, options }; return response(events); });
  const received = [], abort = new AbortController();
  await ai.streamAI('ab'.repeat(12), 'question', 'request-id', abort.signal, event => received.push(event));
  assert.equal(JSON.stringify(received), JSON.stringify(events));
  assert.equal(request.options.signal, abort.signal); assert.equal(request.options.headers.Authorization, 'Bearer neximet-auth-token');
  assert.equal(JSON.parse(request.options.body).text, 'question'); assert.equal(request.options.cache, 'no-store');
});
test('a truncated stream cannot be mistaken for a saved successful reply', async () => {
  const ai = client(async () => response([{ type: 'delta', text: 'partial' }]));
  await assert.rejects(ai.streamAI('id', 'hello', 'request', new AbortController().signal, () => {}), /before the reply was confirmed/);
});
test('HTTP errors use actionable messages and non-SSE HTML is rejected', async () => {
  const failed = client(async () => Response.json({ message: 'Connect your provider first.' }, { status: 409 }));
  await assert.rejects(failed.streamAI('id', 'hi', 'request', new AbortController().signal, () => {}), /Connect your provider first/);
  const html = client(async () => new Response('<html>Error</html>'));
  await assert.rejects(html.streamAI('id', 'hi', 'request', new AbortController().signal, () => {}), /could not open/);
});
test('user abort is not automatically retried', async () => {
  let calls = 0;
  const abort = new AbortController();
  const ai = client(async (url, options) => { calls++; return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })); });
  const pending = ai.streamAI('id', 'hi', 'request', abort.signal, () => {}); abort.abort();
  await assert.rejects(pending, /Aborted/); assert.equal(calls, 1);
});
