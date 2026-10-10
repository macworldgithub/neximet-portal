const CACHE_NAME = 'neximet-portal-v1';

const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/attendance',
  '/projects',
  '/leaves',
  '/manifest.webmanifest',
  '/manifest.json',
  '/neximet-logo.avif',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
];

// Service Worker Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll with individual catch so failures don't block install
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-caching asset failed for: ${url}`, err);
          })
        )
      );
    })
  );
});

// Service Worker Activate (clean up obsolete caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event handler (Mandatory for PWA installation criteria)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and non-GET requests
  if (request.method !== 'GET' || !url.origin.startsWith(self.location.origin)) {
    return;
  }

  // API calls: Network-only (or network-first without caching sensitive responses)
  if (url.pathname.startsWith('/api') || url.port === '5000') {
    return;
  }

  // Static assets (images, icons, fonts): Cache-first with network fallback
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Navigation and document requests: Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en" class="dark">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Neximet Portal - Offline</title>
              <style>
                body { background-color: #0B0F19; color: #F3F4F6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .card { background: #111827; border: 1px solid #1F293D; padding: 32px; border-radius: 20px; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h1 { color: #5CC5FA; font-size: 20px; margin-bottom: 8px; }
                p { color: #9CA3AF; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
                button { background: #5470F4; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; }
              </style>
            </head>
            <body>
              <div class="card">
                <img src="/icons/icon-192x192.png" width="64" height="64" style="border-radius:14px;margin-bottom:16px;" alt="Neximet" />
                <h1>Working Offline</h1>
                <p>Neximet Portal requires an internet connection to sync real-time operations, attendance clocking, and Jira tasks.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
              </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
