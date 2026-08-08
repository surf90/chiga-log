// Service Worker 登録 + controllerchange ベースの1回限り更新
(function () {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = document.currentScript?.dataset?.swUrl || "./sw.js";
  const scope = document.currentScript?.dataset?.scope || "./";
  // 初回登録時も skipWaiting()+claim() で controllerchange が発火する。
  // そこで reload すると新規訪問者が必ず二重読み込みになり、初期表示が遅れ、
  // データ取得も2回走る（原則2・3に反する）。既存 SW の置き換え時だけ再読み込みする。
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl, { scope })
      .catch((err) => console.error("SW登録失敗:", err));
  });
})();
