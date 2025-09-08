/*
  Yura Learning App - Service Worker
  - Cache static assets for offline use
  - Keep network for API calls
*/

const CACHE_NAME = 'yura-pwa-v1';
const APP_SHELL = [
  './yura-desktop-view.html',
  './yura-save-system.js',
  './roopy_fail.png',
  './roopy_succ.jpeg',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))).then(
      () => self.clients.claim()
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bypass non-GET or external API POSTs
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache Gemini API requests
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // Handle navigation requests with network-first then fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./yura-desktop-view.html', clone).catch(() => {}));
          return response;
        })
        .catch(() => caches.match('./yura-desktop-view.html'))
    );
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {}));
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Third-party assets (CDN Tailwind, Google Fonts): stale-while-revalidate
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {}));
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
