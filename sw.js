/**
 * Lingua-Flow Service Worker (sw.js)
 * 职责：实现 Offline-First 离线优先缓存策略与防投毒降级保护
 * - 页面导航请求 (navigate / text/html)：Network-First（网络优先更新缓存，断网回退已缓存页面或 ./index.html，防止发版后滞留旧 HTML）
 * - App Shell 核心静态子资源 (CSS/JS/SVG)：Stale-While-Revalidate（支持 ignoreSearch，过滤 type === 'basic'，非导航请求严禁回退 HTML 防止 MIME 投毒）
 * - 生产语料切片与剧情包 (assets/data/**)：Cache-First + 断网未命中 503 结构化 JSON 降级
 */

const CACHE_VERSION = 'lingua-flow-v4.0.0';
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './deductive.html',
  './immersive.html',
  './strategic.html',
  './learn.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/icons/logo.svg',
  './assets/textures/deductive/badge.svg',
  './assets/textures/deductive/banner.svg',
  './assets/textures/deductive/mechanic_hud.svg',
  './assets/textures/immersive/badge.svg',
  './assets/textures/immersive/banner.svg',
  './assets/textures/immersive/mechanic_hud.svg',
  './assets/textures/strategic/badge.svg',
  './assets/textures/strategic/banner.svg',
  './assets/textures/strategic/mechanic_hud.svg',
  './assets/data/processed/manifest.json',
  './assets/data/processed/en_b1_grammar.json',
  './assets/data/processed/en_b1_lemma.json',
  './assets/data/processed/ja_n5_grammar.json',
  './assets/data/processed/ja_n5_lemma.json',
  './assets/data/processed/ja_n5_hanzi.json',
  './assets/data/processed/zh_hsk1_grammar.json',
  './assets/data/processed/zh_hsk1_lemma.json',
  './assets/data/processed/zh_hsk1_hanzi.json',
  './assets/data/episodes/deductive_ep01.json',
  './assets/data/episodes/immersive_ep01.json',
  './assets/data/episodes/strategic_ep01.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. 针对生产语料切片与剧情包采用 Cache-First + 断网 JSON 容灾降级
  if (url.pathname.includes('/assets/data/')) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === 'basic'
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() =>
            new Response(
              JSON.stringify({
                error: 'OFFLINE_SHARD_MISS',
                message: '当前处于离线状态且目标语料分片尚未缓存'
              }),
              {
                status: 503,
                statusText: 'Service Unavailable (Offline Shard Miss)',
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
              }
            )
          );
      })
    );
    return;
  }

  // 2. 针对 HTML 页面导航请求采用 Network-First（网络优先，断网或 5xx 故障回退缓存），并使用去参数规范化 URL 作为缓存键防止 Query 组合导致缓存膨胀
  const acceptHeader = request.headers.get('accept') || '';
  const isHtmlNavigation = request.mode === 'navigate' || acceptHeader.includes('text/html');
  if (isHtmlNavigation) {
    const canonicalPageUrl = `${url.origin}${url.pathname}`;
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(canonicalPageUrl, clone));
            return networkResponse;
          }
          if (networkResponse && networkResponse.status >= 500) {
            return caches
              .match(canonicalPageUrl, { ignoreSearch: true })
              .then((cached) => cached || networkResponse);
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .match(canonicalPageUrl, { ignoreSearch: true })
            .then((cached) => cached || caches.match('./index.html', { ignoreSearch: true }))
        )
    );
    return;
  }

  // 3. 针对 App Shell 静态子资源 (CSS/JS/SVG) 采用 Stale-While-Revalidate（非导航请求严禁回退 HTML 防止 MIME 投毒）
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cached) return cached;
          return new Response('Offline Resource Unavailable', {
            status: 504,
            statusText: 'Gateway Timeout (Offline)'
          });
        });

      return cached || fetchPromise;
    })
  );
});
