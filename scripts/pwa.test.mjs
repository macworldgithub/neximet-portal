import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://neximet.test';

test('manifest launch scope and all declared PNG icon dimensions are valid', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url.startsWith(manifest.scope));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  }
});

function worker({ online = false, failInstall = false, failWrite = false } = {}) {
  const handlers = {};
  const stores = new Map();
  let claimed = false;
  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
    return {
      async addAll(urls) {
        if (failInstall) throw new Error('Offline page could not be fetched');
        for (const url of urls) store.set(key(url), new Response(url === '/offline.html' ? 'offline notice' : 'asset'));
      },
      async match(request) { return store.get(key(request))?.clone(); },
      async put(request, response) {
        if (failWrite) throw new Error('Quota exceeded');
        store.set(key(request), response);
      },
    };
  };
  vm.runInNewContext(source, {
    URL, Response,
    self: { location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => { claimed = true; } } },
    caches: { open: async (name) => cacheFor(name), keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name) },
    fetch: async () => {
      if (!online) throw new TypeError('Network unavailable');
      const response = new Response('network response');
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    },
  });
  return {
    stores,
    get claimed() { return claimed; },
    async lifecycle(name) {
      const work = [];
      handlers[name]({ waitUntil: (promise) => work.push(promise) });
      await Promise.all(work);
    },
    async request(path, { mode = 'cors', method = 'GET', headers = {} } = {}) {
      let result;
      const work = [];
      handlers.fetch({ request: { url: new URL(path, origin).href, mode, method, headers: new Headers(headers) }, respondWith: (promise) => { result = promise; }, waitUntil: (promise) => work.push(promise) });
      const response = await result;
      await Promise.all(work);
      return response;
    },
  };
}

test('offline navigation uses a complete offline document, even with old cached account HTML', async () => {
  const sw = worker();
  sw.stores.set('neximet-portal-v1', new Map([[`${origin}/dashboard`, new Response('stale account')]]));
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/dashboard', { mode: 'navigate' })).text(), 'offline notice');
  assert.equal(await (await sw.request('/projects/unvisited', { mode: 'navigate' })).text(), 'offline notice');
});

test('installation fails instead of activating without offline assets', async () => {
  await assert.rejects(worker({ failInstall: true }).lifecycle('install'));
});

test('activation removes only obsolete Neximet caches', async () => {
  const sw = worker();
  sw.stores.set('neximet-portal-v1', new Map());
  sw.stores.set('another-app', new Map());
  await sw.lifecycle('install');
  await sw.lifecycle('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), ['another-app', 'neximet-portal-v2']);
  assert.equal(sw.claimed, true);
});

test('API, mutations, RSC, authenticated assets, and similar external origins bypass caching', async () => {
  const sw = worker();
  assert.equal(await sw.request('/api/attendance'), undefined);
  assert.equal(await sw.request('/attendance', { method: 'POST' }), undefined);
  assert.equal(await sw.request('/dashboard?_rsc=abc', { headers: { RSC: '1' } }), undefined);
  assert.equal(await sw.request('/icons/private.png', { headers: { Authorization: 'Bearer test' } }), undefined);
  assert.equal(await sw.request(`${origin}.external.example/icons/icon.png`), undefined);
});

test('navigation works online without persisting private account HTML', async () => {
  const sw = worker({ online: true });
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/dashboard', { mode: 'navigate' })).text(), 'network response');
  assert.equal(sw.stores.get('neximet-portal-v2').has(`${origin}/dashboard`), false);
});

test('cached assets load offline; uncached assets return a valid error Response', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/icons/icon-192x192.png')).text(), 'asset');
  assert.equal((await sw.request('/_next/static/missing.js')).type, 'error');
});

test('static cache writes finish within event lifetime and quota errors do not break online assets', async () => {
  const sw = worker({ online: true });
  await sw.request('/_next/static/app.js');
  assert.equal(sw.stores.get('neximet-portal-v2').has(`${origin}/_next/static/app.js`), true);
  const full = worker({ online: true, failWrite: true });
  assert.equal(await (await full.request('/_next/static/app.js')).text(), 'network response');
});

test('missing offline cache produces a readable 503 response', async () => {
  const sw = worker();
  const response = await sw.request('/dashboard', { mode: 'navigate' });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /offline/i);
});
