const CACHE_NAME = 'eva-admin-shell-v3-black-pwa-20261005b';
const STATIC_ASSETS = [
  '/favicon-20261005.png',
  '/apple-touch-icon-pwa-20261005.png',
  '/pwa-icon-192-20261005.png',
  '/pwa-icon-512-20261005.png',
  '/pwa-icon-maskable-512-20261005.png',
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
