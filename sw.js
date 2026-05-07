const CACHE_NAME = 'chigalog-v3';
const BASE = self.location.pathname.replace(/sw\.js$/, '');
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'assets/css/style.min.css',
  BASE + 'assets/js/app.min.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(async () =>
        (await caches.match(e.request)) ||
        new Response('', { status: 504, statusText: 'offline' })
      )
  );
});
