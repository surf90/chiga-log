const CACHE_NAME = "chigalog-v8";
const BASE = self.location.pathname.replace(/sw\.js$/, "");
const ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "assets/css/style.min.css",
  BASE + "assets/js/app.min.js",
  BASE + "assets/vendor/chart.umd.min.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    !e.request.url.startsWith(self.location.origin)
  )
    return;
  const url = new URL(e.request.url);
  // データJSON(?t=, ?d= 等のキャッシュバスター付き)は Cache Storage 肥大化を避けるため put しない。
  const isDataJson = url.pathname.startsWith(BASE + "data/");
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (isDataJson) return res;
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(
        async () =>
          (await caches.match(e.request)) ||
          new Response("", { status: 504, statusText: "offline" }),
      ),
  );
});
