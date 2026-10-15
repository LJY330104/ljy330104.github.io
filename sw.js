/* 简单 Service Worker：缓存核心资源，离线可访问 */
const CACHE_NAME = 'yyy-cache-v2.4.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './websrc/icon.jpg',
  './websrc/avatar.jpeg',
  './websrc/avatar1.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        // 只缓存同源资源
        if (res.ok && new URL(event.request.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});