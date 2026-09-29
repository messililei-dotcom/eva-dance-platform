const CACHE_NAME = 'eva-admin-shell-v1';
const STATIC_ASSETS = [
  '/favicon.png',
  '/apple-touch-icon-pwa.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isVersionedStaticAsset = url.pathname.startsWith('/_next/static/');
  const isPublicPwaAsset = STATIC_ASSETS.includes(url.pathname);
  if (!isVersionedStaticAsset && !isPublicPwaAsset) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
