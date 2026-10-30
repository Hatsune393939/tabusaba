// サイト共通: バージョン・最終更新日時・サーバー情報を site.json から表示する
// site.json は毎回サーバーに確認して読み込むので、ブラウザのキャッシュで古いまま、にならない
(async () => {
  const base = document.currentScript ? new URL(".", document.currentScript.src) : new URL("../Main/", location.href);
  let S = {};
  try {
    const res = await fetch(new URL("site.json", base), { cache: "no-cache" });
    if (res.ok) S = await res.json();
  } catch (e) { /* 読めなければ表示しないだけ */ }

  const fill = (key, text) => document.querySelectorAll(`[data-site="${key}"]`).forEach((el) => { el.textContent = text; });
  if (S.version) fill("version", `ver ${S.version}`);
  // "2026-10-29 16:47:15" → "2026/10/29 16:47:15"(時刻を省いた場合は日付だけ表示)
  if (S.updated) fill("updated", String(S.updated).trim().replace(/-/g, "/").replace("T", " "));
  if (S.serverIP) fill("ip", S.serverIP);
  if (S.serverVersions) fill("versions", S.serverVersions);

  const btn = document.getElementById("copy-ip");
  if (btn && S.serverIP) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(S.serverIP);
        btn.textContent = "コピーしました";
      } catch (e) {
        btn.textContent = "コピーできませんでした";
      }
      setTimeout(() => { btn.textContent = "コピー"; }, 2000);
    });
  }
})();
