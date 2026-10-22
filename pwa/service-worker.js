const CACHE_PREFIX = 'neximet-portal-';
// Replaced by the build script so every deployment is detected as an update.
const CACHE_NAME = `${CACHE_PREFIX}__NEXIMET_BUILD__`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/neximet-logo.avif',
  '/icons/icon-192x192.png',
  '/icons/notification-badge-96x96.png',
  '/icons/call-192x192.png',
  '/icons/call-badge-96x96.png',
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
const CLOSED_CALLS = '/__closed_calls';
async function pushAccount() {
  try { return await (await (await caches.open(PUSH_SETTINGS)).match(PUSH_ACCOUNT))?.json(); }
  catch { return null; }
}
async function closedCalls() {
  try { return await (await (await caches.open(PUSH_SETTINGS)).match(CLOSED_CALLS))?.json() || []; } catch { return []; }
}
async function rememberClosedCall(callId, userId) {
  const entries = (await closedCalls()).filter(item => item.until > Date.now() && !(item.callId === callId && item.userId === userId));
  entries.push({ callId, userId, until: Date.now() + 300000 });
  await (await caches.open(PUSH_SETTINGS)).put(CLOSED_CALLS, new Response(JSON.stringify(entries.slice(-30))));
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
  if (event.data?.type === 'CLOSE_CALL_NOTIFICATION' && typeof event.data.callId === 'string') event.waitUntil((async () => {
    const account = await pushAccount();
    if (account) await rememberClosedCall(event.data.callId, account.userId);
    const notifications = await self.registration.getNotifications({ tag: `call-${event.data.callId}` });
    notifications.filter(notification => notification.tag === `call-${event.data.callId}`).forEach(notification => notification.close());
  })());
});
function appUrl(value, fallback = '/chat') {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && (['/chat', '/meet', '/announcements', '/notifications', '/mail', '/projects', '/leaves', '/attendance', '/deduction-settings', '/dashboard', '/employees'].includes(url.pathname) || /^\/projects\/[a-f\d]{24}$/i.test(url.pathname)) ? url.href : `${self.location.origin}${fallback}`;
  } catch { return `${self.location.origin}${fallback}`; }
}
self.addEventListener('push', (event) => event.waitUntil((async () => {
  let payload;
  try { payload = event.data?.json(); } catch { /* Show a safe generic notification. */ }
  const account = await pushAccount();
  const belongsToAccount = account && payload?.userId === account.userId;
  const meeting = belongsToAccount && ['incoming_call', 'call_ended', 'meeting_invitation', 'meeting_updated', 'meeting_cancelled', 'meeting_reminder', 'meeting_starting'].includes(payload.kind);
  const platform = belongsToAccount && payload.kind === 'platform_notification';
  const call = meeting && ['incoming_call', 'call_ended'].includes(payload.kind);
  const terminal = call && (payload.kind === 'call_ended' || (await closedCalls()).some(item => item.callId === payload.callId && item.userId === account.userId && item.until > Date.now()));
  if (call && payload.kind === 'call_ended') await rememberClosedCall(payload.callId, account.userId);
  const expired = meeting && (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now());
  const ringing = call && payload.kind === 'incoming_call' && !expired && !terminal;
  const fallback = meeting ? '/meet' : platform ? '/notifications' : '/chat';
  const title = belongsToAccount ? terminal && payload.kind === 'incoming_call' ? 'Call ended' : expired ? call ? 'Missed call' : 'Meeting update' : String(payload.title || 'Neximet Chat').slice(0, 120) : 'Neximet Portal';
  const options = {
    body: belongsToAccount ? expired || terminal && payload.kind === 'incoming_call' ? 'Open Meetings to check the latest details.' : String(payload.body || 'You have a new message').slice(0, 200) : 'Open the app to check your messages.',
    icon: call ? '/icons/call-192x192.png' : '/icons/icon-192x192.png',
    // The small Android status-bar icon must be an alpha-only logo silhouette.
    // An opaque app-icon background turns into a solid square when masked.
    badge: call ? '/icons/call-badge-96x96.png' : '/icons/notification-badge-96x96.png',
    tag: call ? `call-${payload.callId}` : meeting ? `meeting-${payload.meetingId}` : platform ? `platform-${payload.notificationId}` : belongsToAccount ? `chat-${payload.conversationId}` : 'neximet-chat',
    data: { url: belongsToAccount ? appUrl(expired || terminal ? '/meet?view=history' : payload.kind === 'meeting_cancelled' ? '/meet?view=calendar' : payload.url, fallback) : `${self.location.origin}/chat`, userId: belongsToAccount ? account.userId : null,
      kind: platform ? 'platform_notification' : meeting ? payload.kind : 'chat', notificationId: platform ? payload.notificationId : undefined, callId: call ? payload.callId : undefined, expiresAt: call ? payload.expiresAt : undefined },
  };
  if (platform) Object.assign(options, { actions: [{ action: 'open', title: 'Open' }], silent: false });
  if (meeting) Object.assign(options, { renotify: !expired && !terminal, requireInteraction: ringing, silent: expired || terminal,
    actions: ringing ? [{ action: 'answer', title: 'Answer' }, { action: 'dismiss', title: 'Dismiss' }] : [{ action: 'open', title: call ? 'View history' : 'Open meeting' }] });
  if (meeting && !options.silent) options.vibrate = ringing ? [300, 150, 300, 150, 600] : [200, 100, 200];
  await self.registration.showNotification(title, options);
  // A push-service acceptance is not delivery. Acknowledge only when the device
  // received and displayed it, using a token restricted to this one receipt.
  if (belongsToAccount && !meeting && !platform && typeof payload.receiptToken === 'string') {
    try { await fetch(`${account.apiUrl}/chat/push/delivered`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiptToken: payload.receiptToken }) }); }
    catch { /* The authenticated app catches up delivery receipts on reconnect. */ }
  }
})()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const account = await pushAccount();
    const data = event.notification.data;
    const matches = account && account.userId === data?.userId;
    const isPlatform = matches && data.kind === 'platform_notification';
    const isMeeting = matches && !isPlatform && data.kind !== 'chat' && typeof data.kind === 'string';
    if (matches && data.callId) await rememberClosedCall(data.callId, account.userId);
    const url = appUrl(matches ? data.kind === 'incoming_call' && data.expiresAt <= Date.now() ? '/meet?view=history' : data.url : '/chat', isMeeting ? '/meet' : isPlatform ? '/notifications' : '/chat');
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (event.action === 'dismiss') {
      if (matches && data.callId) windows.forEach(client => client.postMessage({ type: 'DISMISS_CALL_NOTIFICATION', callId: data.callId }));
      return;
    }
    const client = windows.find((window) => new URL(window.url).origin === self.location.origin);
    // Keep active call media alive by using client-side navigation in an open app.
    if (client && isPlatform && client.postMessage) { client.postMessage({ type: 'OPEN_PLATFORM_NOTIFICATION', userId: account.userId, notificationId: data.notificationId, url }); await client.focus(); }
    else if (client && isMeeting && client.postMessage) { client.postMessage({ type: 'OPEN_MEETING_NOTIFICATION', userId: account.userId, callId: data.callId, url }); await client.focus(); }
    else if (client) { await client.navigate(url); await client.focus(); }
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
