// サイト共通: バージョン・最終更新日・サーバー情報を config.js から表示する
(() => {
  const C = window.TABUSABA || {};
  const fill = (key, text) => document.querySelectorAll(`[data-site="${key}"]`).forEach((el) => { el.textContent = text; });
  if (C.SITE_VERSION) fill("version", `ver ${C.SITE_VERSION}`);
  if (C.SITE_UPDATED) fill("updated", C.SITE_UPDATED.replace(/-/g, "/"));
  if (C.SERVER_IP) fill("ip", C.SERVER_IP);
  if (C.SERVER_VERSIONS) fill("versions", C.SERVER_VERSIONS);

  const btn = document.getElementById("copy-ip");
  if (btn && C.SERVER_IP) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(C.SERVER_IP);
        btn.textContent = "コピーしました";
      } catch (e) {
        btn.textContent = "コピーできませんでした";
      }
      setTimeout(() => { btn.textContent = "コピー"; }, 2000);
    });
  }
})();
