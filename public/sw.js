// PlayLog Service Worker
// Кэширует статику и обеспечивает offline-режим

// Версию нужно менять при каждом изменении логики кеша: старые кеши удаляются при активации
const CACHE_NAME = 'playlog-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// В режиме разработки (localhost) service worker ничего не кеширует:
// иначе браузер отдаёт устаревший JS и появляются ошибки гидратации
const IS_DEV =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

// Установка — кэшируем статические ресурсы
self.addEventListener('install', (event) => {
  if (!IS_DEV) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.log('[SW] Cache addAll failed:', err);
        });
      })
    );
  }
  self.skipWaiting();
});

// Активация — удаляем старые кэши (в dev — вообще все)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => IS_DEV || name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // В dev и для не-GET запросов service worker не вмешивается
  if (IS_DEV || request.method !== 'GET') return;

  const url = new URL(request.url);

  // Чужие домены не трогаем
  if (url.origin !== self.location.origin) return;

  // API запросы — network only (не кэшируем динамические данные)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Навигационные запросы — network first с offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Статические ассеты — cache first
  // (в продакшене файлы /_next/static/ имеют хеш в имени, поэтому это безопасно)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|avif|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Всё остальное — network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
