const CACHE_PREFIX = 'neximet-portal-';
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/neximet-logo.avif',
  '/icons/icon-192x192.png',
  '/icons/notification-badge-96x96.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Only activate when the self-contained offline page is available.
  // Existing sessions keep their current worker until all tabs close.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

// This cache holds only the account ID and public API URL, never credentials or
// message history. Persist it so account checks also work after worker restarts.
const PUSH_SETTINGS = 'neximet-push-settings';
const PUSH_ACCOUNT = '/__push_account';
async function pushAccount() {
  try { return await (await (await caches.open(PUSH_SETTINGS)).match(PUSH_ACCOUNT))?.json(); }
  catch { return null; }
}
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type === 'PUSH_ACCOUNT') event.waitUntil((async () => {
    const { userId, apiUrl } = event.data;
    try {
      const url = new URL(apiUrl);
      if (!/^[a-f\d]{24}$/i.test(userId) || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return;
      await (await caches.open(PUSH_SETTINGS)).put(PUSH_ACCOUNT, new Response(JSON.stringify({ userId, apiUrl: apiUrl.replace(/\/$/, '') })));
    } catch { /* Invalid account bindings are ignored. */ }
  })());
  if (event.data?.type === 'CLEAR_PUSH_ACCOUNT') event.waitUntil((async () => {
    await caches.delete(PUSH_SETTINGS);
    const notifications = await self.registration.getNotifications();
    notifications.forEach((notification) => notification.close());
  })());
});
function chatUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && url.pathname === '/chat' ? url.href : `${self.location.origin}/chat`;
  } catch { return `${self.location.origin}/chat`; }
}
self.addEventListener('push', (event) => event.waitUntil((async () => {
  let payload;
  try { payload = event.data?.json(); } catch { /* Show a safe generic notification. */ }
  const account = await pushAccount();
  const belongsToAccount = account && payload?.userId === account.userId;
  await self.registration.showNotification(belongsToAccount ? String(payload.title || 'Neximet Chat').slice(0, 120) : 'Neximet Portal', {
    body: belongsToAccount ? String(payload.body || 'You have a new message').slice(0, 200) : 'Open the app to check your messages.',
    icon: '/icons/icon-192x192.png',
    // The small Android status-bar icon must be an alpha-only logo silhouette.
    // An opaque app-icon background turns into a solid square when masked.
    badge: '/icons/notification-badge-96x96.png',
    tag: belongsToAccount ? `chat-${payload.conversationId}` : 'neximet-chat',
    data: { url: belongsToAccount ? chatUrl(payload.url) : `${self.location.origin}/chat`, userId: belongsToAccount ? account.userId : null },
  });
  // A push-service acceptance is not delivery. Acknowledge only when the device
  // received and displayed it, using a token restricted to this one receipt.
  if (belongsToAccount && typeof payload.receiptToken === 'string') {
    try { await fetch(`${account.apiUrl}/chat/push/delivered`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiptToken: payload.receiptToken }) }); }
    catch { /* The authenticated app catches up delivery receipts on reconnect. */ }
  }
})()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const account = await pushAccount();
    const data = event.notification.data;
    const url = chatUrl(account && account.userId === data?.userId ? data.url : '/chat');
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((window) => new URL(window.url).origin === self.location.origin);
    if (client) { await client.navigate(url); await client.focus(); }
    else await self.clients.openWindow(url);
  })());
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
