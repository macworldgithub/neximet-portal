const CACHE_PREFIX = 'neximet-portal-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/neximet-logo.avif',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Only activate when the self-contained offline page is available.
  // Existing sessions keep their current worker until all tabs close.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      request.headers.has('Authorization') || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Account HTML may have missing scripts or stale data; never cache it.
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_URL) || new Response('You are offline. Reconnect and reload Neximet Portal.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }));
    return;
  }

  const isStatic = STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/icons/') || url.pathname.startsWith('/_next/static/');
  if (!isStatic) return; // API data and Next.js RSC requests stay network-only.

  let cacheWrite = Promise.resolve();
  const response = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const result = await fetch(request);
      if (result.ok && result.type === 'basic') {
        cacheWrite = cache.put(request, result.clone()).catch(() => {});
      }
      return result;
    } catch {
      return Response.error();
    }
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => cacheWrite));
});
