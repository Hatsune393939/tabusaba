// サイト共通: バージョン・サーバー情報を site.json から、最終更新日時を GitHub から表示する
(async () => {
  const base = document.currentScript ? new URL(".", document.currentScript.src) : new URL("../Main/", location.href);
  const fill = (key, text) => document.querySelectorAll(`[data-site="${key}"]`).forEach((el) => { el.textContent = text; });

  // site.json は毎回サーバーに確認して読み込む(ブラウザのキャッシュで古いまま、にならない)
  let S = {}, lastModified = null;
  try {
    const res = await fetch(new URL("site.json", base), { cache: "no-cache" });
    if (res.ok) { S = await res.json(); lastModified = res.headers.get("Last-Modified"); }
  } catch (e) { /* 読めなければ表示しないだけ */ }

  if (S.version) fill("version", `ver ${S.version}`);
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

  // ---- 最終更新日時 = そのページのフォルダに最後に push した時刻 ----
  // data-paths="Quiz,Main" のように書いたフォルダのうち、一番新しいコミットの時刻を表示する
  const pad = (n) => String(n).padStart(2, "0");
  const format = (date) => {
    // 見る人の場所に関係なく日本時間で表示する
    const p = Object.fromEntries(new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return `${p.year}/${pad(p.month)}/${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  };

  async function lastCommit(path) {
    // GitHub API は1時間に60回までなので、5分間は結果を使い回す
    const key = `tabusaba_commit_${path}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.date;
    } catch (e) { /* 使えない環境 */ }
    const url = `https://api.github.com/repos/${S.repo}/commits?per_page=1&path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(res.status);
    const [c] = await res.json();
    const date = c ? c.commit.committer.date : null;
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), date })); } catch (e) { /* 同上 */ }
    return date;
  }

  for (const el of document.querySelectorAll('[data-site="updated"]')) {
    const paths = (el.dataset.paths || "Main").split(",").map((p) => p.trim()).filter(Boolean);
    let newest = null;
    try {
      if (!S.repo) throw new Error("no repo");
      const dates = (await Promise.all(paths.map(lastCommit))).filter(Boolean).map((d) => new Date(d));
      if (dates.length) newest = new Date(Math.max(...dates));
    } catch (e) {
      // GitHub に聞けなかったときは、サイトが公開された時刻(site.json の更新時刻)を使う
      if (lastModified) newest = new Date(lastModified);
    }
    if (newest && !isNaN(newest)) el.textContent = format(newest);
  }
})();
