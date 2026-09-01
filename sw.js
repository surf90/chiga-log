const CACHE_NAME = "chigalog-v19";
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
  if (e.request.method !== "GET") return;
  // 前方一致で判定すると同一オリジンを接頭辞に持つ別ドメイン
  // (例: https://example.github.io.attacker.test/) まで自オリジン扱いに
  // なるため、URLを解析してオリジンを厳密比較する。
  let url;
  try {
    url = new URL(e.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // データJSON(?t=, ?d= 等のキャッシュバスター付き)はネットワーク優先。
  // 成功レスポンスはクエリを除いた正規URLへ1件だけ退避し、オフライン時に返す。
  // リクエストURLをそのままキーにすると、時間ごとに変わるキャッシュバスターの
  // 数だけエントリが増え続けるため、検索パラメータを保存キーに含めない。
  if (url.pathname.startsWith(BASE + "data/")) {
    const fallbackUrl = new URL(url.pathname, self.location.origin).href;
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            e.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(fallbackUrl, copy)),
            );
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(fallbackUrl)) ||
            new Response("", { status: 504, statusText: "offline" }),
        ),
    );
    return;
  }

  // ナビゲーション要求：オフライン時は App Shell(index.html) を返す。
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(
        async () =>
          (await caches.match(BASE + "index.html")) ||
          new Response("", { status: 504, statusText: "offline" }),
      ),
    );
    return;
  }

  // 静的アセット：Stale-While-Revalidate。
  // キャッシュがあれば即返して描画をブロックせず(原則2)、裏で再取得して次回に反映する。
  // Cache-First のままだと minify.yml が更新した style.min.css / app.min.js が
  // CACHE_NAME を手で上げるまで永久に古いまま配信され、修正が届かなかった。
  // index.html は URL 不変・クエリ無しで参照されるため、この経路以外に更新手段がない。
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(
          () => hit || new Response("", { status: 504, statusText: "offline" }),
        );
      return hit || network;
    }),
  );
});
