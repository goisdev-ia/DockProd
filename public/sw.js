/* PickProd PWA Service Worker - network-first para navegação, cache para estáticos */
const CACHE_NAME = 'pickprod-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/backgroundpickprod2.png',
  '/pickprodlogo.png',
  '/AppImages/android/android-launchericon-192-192.png',
  '/AppImages/android/android-launchericon-512-512.png',
  '/AppImages/ios/180.png',
  '/AppImages/ios/512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => { });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  var isNav = request.mode === 'navigate' || request.destination === 'document';

  if (isNav) {
    event.respondWith(
      fetch(request).then(function (res) { return res; }).catch(function () {
        return caches.match(request).then(function (cached) { return cached || new Response('', { status: 503, statusText: 'Service Unavailable' }); });
      })
    );
    return;
  }

  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (res) {
          if (res.ok && res.type === 'basic') cache.put(request, res.clone());
          return res;
        });
      });
    })
  );
});
