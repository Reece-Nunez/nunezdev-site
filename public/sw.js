const CACHE_VERSION = 'v2';
const CACHE_NAME = `nunezdev-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/offline',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo.png',
  '/site.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Never cache the portal — it's an actively-developed app surface and stale
  // JS here has caused real user-facing bugs (silent upload failures).
  if (url.pathname.startsWith('/portal') || url.pathname.startsWith('/dashboard')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // Scripts/styles: network-first so new deploys land immediately; fall back
  // to cache only when offline. Images/fonts can stay cache-first since they
  // change rarely and don't carry application logic.
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504 })))
    );
    return;
  }

  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
