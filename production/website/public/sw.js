/* 伊娃东方舞 PWA Service Worker
 * 原则：只缓存公开页面与静态资源；登录、学习进度、视频和 API 始终走网络。
 */
const VERSION = 'swod-pwa-v12-content-ui-20261016';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/pwa/icon-192-20261006.png',
  '/icons/pwa/icon-512-20261006.png',
  '/icons/pwa/apple-touch-icon-20261006.png',
  '/install'
];
const PRIVATE_PATHS = [
  '/api/', '/courses', '/dashboard', '/profile', '/my-courses', '/login', '/register'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(async () => {
        await self.clients.claim();
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => undefined)));
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function isPrivate(url) {
  return PRIVATE_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(path));
}

function mayStore(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const cacheControl = response.headers.get('cache-control') || '';
  return !/private|no-store/i.test(cacheControl);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivate(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (mayStore(response)) {
            const copy = response.clone();
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(request, copy);
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (['style', 'script', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const updateCache = fetch(request)
          .then((response) => {
            if (mayStore(response)) {
              const copy = response.clone();
              return caches.open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy))
                .then(() => response);
            }
            return response;
          })
          .catch(() => cached);
        if (cached) {
          event.waitUntil(updateCache);
          return cached;
        }
        return updateCache;
      })
    );
  }
});

// 推送能力预留：后端接入 Web Push 后无需更改展示逻辑。
self.addEventListener('push', (event) => {
  const payload = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(payload.title || '伊娃东方舞', {
    body: payload.body || '您有新的学习消息',
    icon: '/icons/pwa/icon-192-20261006.png',
    badge: '/icons/pwa/icon-192-20261006.png',
    data: { url: payload.url || '/my-courses' },
    tag: payload.tag || 'swod-learning',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/my-courses', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === target);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
