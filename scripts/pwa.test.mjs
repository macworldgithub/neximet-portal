import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';

const source = readFileSync(new URL('../pwa/service-worker.js', import.meta.url), 'utf8').replaceAll('__NEXIMET_BUILD__', 'v4');
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

test('Android notification badge is a white logo mask with transparent padding and gaps', async () => {
  const { data, info } = await sharp(fileURLToPath(new URL('../public/icons/notification-badge-96x96.png', import.meta.url)))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 96);
  assert.equal(info.height, 96);
  assert.equal(info.channels, 4);
  let visible = 0, transparent = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const index = (y * 96 + x) * 4;
    const alpha = data[index + 3];
    if (x < 8 || x >= 88 || y < 8 || y >= 88) assert.equal(alpha, 0, 'badge must have transparent padding');
    if (alpha > 0) { visible++; assert.deepEqual([...data.subarray(index, index + 3)], [255, 255, 255]); }
    else transparent++;
  }
  assert.ok(visible > 1000, 'the logo should be legible at small sizes');
  assert.ok(transparent > 5000, 'the backdrop and spaces between logo strokes must stay transparent');
});

function worker({ online = false, failInstall = false, failWrite = false, stores = new Map() } = {}) {
  const handlers = {};
  const notifications = [], fetched = [], opened = [];
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
    self: {
      location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {},
      registration: { showNotification: async (title, options) => notifications.push({ title, ...options }), getNotifications: async () => notifications.map((item) => ({ close: () => { item.closed = true; } })) },
      clients: { claim: async () => { claimed = true; }, matchAll: async () => [], openWindow: async (url) => { opened.push(url); } },
    },
    caches: { open: async (name) => cacheFor(name), keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name) },
    fetch: async (url, options) => {
      fetched.push({ url, options });
      if (!online) throw new TypeError('Network unavailable');
      const response = new Response('network response');
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    },
  });
  return {
    stores,
    notifications, fetched, opened,
    get claimed() { return claimed; },
    async lifecycle(name) {
      const work = [];
      handlers[name]({ waitUntil: (promise) => work.push(promise) });
      await Promise.all(work);
    },
    async dispatch(name, data) {
      const work = [];
      handlers[name]({ ...data, waitUntil: (promise) => work.push(promise) });
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
  assert.deepEqual([...sw.stores.keys()].sort(), ['another-app', 'neximet-portal-v4']);
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
  assert.equal(sw.stores.get('neximet-portal-v4').has(`${origin}/dashboard`), false);
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
  assert.equal(sw.stores.get('neximet-portal-v4').has(`${origin}/_next/static/app.js`), true);
  const full = worker({ online: true, failWrite: true });
  assert.equal(await (await full.request('/_next/static/app.js')).text(), 'network response');
});

test('missing offline cache produces a readable 503 response', async () => {
  const sw = worker();
  const response = await sw.request('/dashboard', { mode: 'navigate' });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /offline/i);
});

const userId = '000000000000000000000001';
const conversationId = '000000000000000000000002';
const payload = { userId, conversationId, title: 'Sam Rivera', body: 'New team message', url: `/chat?conversation=${conversationId}`, receiptToken: 'scoped-delivery-receipt' };
test('push displays an account-bound notification and acknowledges only delivery, even after worker restart', async () => {
  const original = worker({ online: true });
  await original.dispatch('message', { data: { type: 'PUSH_ACCOUNT', userId, apiUrl: 'https://api.neximet.test/api' } });
  const sw = worker({ online: true, stores: original.stores });
  await sw.dispatch('push', { data: { json: () => payload } });
  assert.equal(sw.notifications[0].title, payload.title);
  assert.equal(sw.notifications[0].body, payload.body);
  assert.equal(sw.notifications[0].badge, '/icons/notification-badge-96x96.png');
  assert.equal(sw.notifications[0].icon, '/icons/icon-192x192.png');
  assert.equal(sw.notifications[0].data.url, `${origin}${payload.url}`);
  assert.equal(sw.fetched.length, 1);
  assert.equal(sw.fetched[0].url, 'https://api.neximet.test/api/chat/push/delivered');
  assert.equal(sw.fetched[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(sw.fetched[0].options.body), { receiptToken: payload.receiptToken });
  assert.equal(JSON.stringify([...sw.stores.values()].flatMap((store) => [...store.keys()])).includes(payload.receiptToken), false);
});

test('logout closes notifications and hides private previews from late pushes or other accounts', async () => {
  const sw = worker({ online: true });
  await sw.dispatch('message', { data: { type: 'PUSH_ACCOUNT', userId, apiUrl: 'https://api.neximet.test/api' } });
  await sw.dispatch('push', { data: { json: () => payload } });
  await sw.dispatch('message', { data: { type: 'CLEAR_PUSH_ACCOUNT' } });
  assert.equal(sw.notifications[0].closed, true);
  await sw.dispatch('push', { data: { json: () => payload } });
  assert.equal(sw.notifications[1].title, 'Neximet Portal');
  assert.equal(sw.notifications[1].body.includes(payload.body), false);
  assert.equal(sw.fetched.length, 1);
  await sw.dispatch('message', { data: { type: 'PUSH_ACCOUNT', userId: '000000000000000000000003', apiUrl: 'https://api.neximet.test/api' } });
  await sw.dispatch('push', { data: { json: () => payload } });
  assert.equal(sw.notifications[2].title, 'Neximet Portal');
  assert.equal(sw.fetched.length, 1);
});

test('notification click opens the correct chat and rejects external URLs', async () => {
  const sw = worker();
  await sw.dispatch('message', { data: { type: 'PUSH_ACCOUNT', userId, apiUrl: 'https://api.neximet.test/api' } });
  let closed = false;
  await sw.dispatch('notificationclick', { notification: { close: () => { closed = true; }, data: { userId, url: payload.url } } });
  assert.equal(closed, true);
  assert.equal(sw.opened[0], `${origin}${payload.url}`);
  await sw.dispatch('notificationclick', { notification: { close() {}, data: { userId, url: 'https://evil.example/steal' } } });
  assert.equal(sw.opened[1], `${origin}/chat`);
});

test('malformed push payloads show a safe generic notification without crashing', async () => {
  const sw = worker();
  await sw.dispatch('push', { data: { json: () => { throw new Error('Bad JSON'); } } });
  assert.equal(sw.notifications[0].title, 'Neximet Portal');
  assert.equal(sw.fetched.length, 0);
});
