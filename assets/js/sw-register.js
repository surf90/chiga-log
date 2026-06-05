// Service Worker 登録 + controllerchange ベースの1回限り更新
(function () {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = document.currentScript?.dataset?.swUrl || "./sw.js";
  const scope = document.currentScript?.dataset?.scope || "./";
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl, { scope })
      .catch((err) => console.error("SW登録失敗:", err));
  });
})();
