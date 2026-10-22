// FältKoll Service Worker - Network First with Resilient Cache & Subpath Support
const CACHE_NAME = 'falthjalp-cache-v7';

// On cloud dev environments (Google Cloud Run / AI Studio preview) or localhost,
// NEVER intercept requests or cache files: immediately unregister and clear all caches.
const isDevOrPreview =
  self.location.hostname.includes('run.app') ||
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

if (isDevOrPreview) {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  });
} else {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

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
      })
    );
    self.clients.claim();
  });
}

self.addEventListener('fetch', (event) => {
  if (isDevOrPreview) {
    return;
  }
  const url = event.request.url;

  // Never intercept cross-origin requests (e.g. Firebase, Google APIs), non-GET, API, Vite dev, or dynamic modules
  if (
    !url.startsWith(self.location.origin) ||
    event.request.method !== 'GET' ||
    url.includes('/api/') ||
    url.includes('/@') ||
    url.includes('/src/') ||
    url.includes('node_modules') ||
    url.includes('hot-update') ||
    url.includes('?')
  ) {
    return;
  }

  // Network-first strategy with safe fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const contentType = response.headers.get('content-type') || '';
          // Avoid caching 404 HTML fallbacks as JavaScript or CSS
          const isScriptOrStyle = url.endsWith('.js') || url.endsWith('.css');
          if (isScriptOrStyle && contentType.includes('text/html')) {
            return response;
          }

          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        // 1. Try exact cached resource
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // 2. Safe navigation fallback for single-page apps (supports subpaths & GitHub Pages)
        if (event.request.mode === 'navigate') {
          const navMatch =
            (await caches.match('./index.html')) ||
            (await caches.match('index.html')) ||
            (await caches.match(self.registration.scope)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (navMatch) return navMatch;
        }

        // Return a clean offline response instead of throwing unhandled reject
        return new Response('Offlineläge - anslut till internet för att ladda denna resurs.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        });
      })
  );
});
