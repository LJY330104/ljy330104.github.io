/* ============================================================
   Service Worker：离线可访问 + 发布后能及时更新
   ------------------------------------------------------------
   策略
     · 页面导航（HTML） → network-first
         先向服务器要最新页面，离线时才回落到缓存。
         这样每次 push 到 GitHub Pages，老用户刷新就能看到新版。
     · 其它同源资源   → stale-while-revalidate
         立刻返回缓存（秒开），同时后台悄悄拉新版存起来。
     · 跨域请求       → 完全交给浏览器，不缓存、不拦截。

   ⚠️ 每次发布都要修改 CACHE_VERSION
      浏览器只有在 sw.js 内容发生变化时才会更新 Service Worker，
      不版本号 +1 的话，老访客会一直看着旧缓存。
   ============================================================ */

const CACHE_VERSION = 'v2.6.0';
const CACHE_PREFIX = 'yyy-cache-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/* 预缓存：只放首屏必需且体积友好的资源。
   以前把 148KB 的 icon.jpg 也塞进来，现在图标已换成小 PNG。 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './websrc/favicon-32.png',
  './websrc/favicon.ico',
  './websrc/apple-touch-icon.png',
  './websrc/avatar.webp',
  './websrc/avatar.jpeg',
  './websrc/avatar1.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 单个资源失败（例如暂时 404）不应让整次安装失败
    await Promise.all(
      PRECACHE.map((url) => cache.add(url).catch(() => {}))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只管 GET；跨域资源交给浏览器默认行为
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* ---------- 页面导航：network-first ---------- */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        // 统一用 index.html 作为键，避免 ?query / 各种路径把缓存撑大
        if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = (await cache.match('./index.html')) || (await cache.match('./'));
        return cached || new Response('离线，且没有可用缓存。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  /* ---------- 其它同源资源：stale-while-revalidate ---------- */
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const revalidate = fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) return cached;          // 命中缓存，立即返回

    const fresh = await revalidate;
    return fresh || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
