// 早押しクイズ 問題作成ページ
(() => {
  const CFG = window.TABUSABA;
  const Q = CFG.QUIZ;
  const API = (CFG.API_BASE || "").replace(/\/$/, "");
  const DEMO = !API;
  const $ = (id) => document.getElementById(id);
  const wk = window.wanakana;

  const state = {
    user: null,
    genres: [],
    tags: [],
    alts: [],               // [{display, reading}]
    manualAccepted: [],     // 自分で追加した受理表記
    removedAuto: new Set(), // 自動生成から消した受理表記
    editingId: null,        // 編集中の問題のID
    mine: []                // 自分が作った問題
  };

  const ERRORS = {
    invalid_genre: "ジャンルが正しくありません。ページを再読み込みしてから選び直してください。",
    invalid_question: `問題文は${Q.QUESTION_MAX}文字以内で入力してください。`,
    invalid_answer: "正解か読みを正しく入力してください。",
    invalid_reading: "読みはひらがなで入力してください。",
    invalid_tags: "タグの数か長さが多すぎます。",
    invalid_alternatives: "別解の入力が正しくありません。",
    invalid_accepted: "正解として受け付ける入力を確認してください。",
    too_many: "今日はこれ以上投稿できません(1日30問まで)。また明日投稿してください。",
    not_found: "この問題は見つかりませんでした。すでに削除されている可能性があります。"
  };

  // ---- 正規化(Skript側と同じルールにすること) ----
  // NFKCで全角英数→半角・半角カナ→全角、小文字化、空白と「・」を除去
  function normalize(s) {
    return (s || "").normalize("NFKC").toLowerCase().replace(/[\s・]/g, "");
  }

  // ---- ひらがな → ローマ字の表記ゆれ ----
  function romajiVariants(hira) {
    if (!hira) return [];
    const base = wk.toRomaji(hira).toLowerCase().replace(/-/g, "");
    const nForms = base.includes("'") ? [base.replace(/n'/g, "nn"), base.replace(/n'/g, "n")] : [base];
    const out = new Set();
    for (const n of nForms) {
      const clean = n.replace(/'/g, "");
      const reduced = clean.replace(/ou/g, "o").replace(/uu/g, "u").replace(/oo/g, "o");
      for (const v of [clean, reduced]) {
        out.add(v);
        out.add(v.replace(/shi/g, "si").replace(/chi/g, "ti").replace(/tsu/g, "tu")
                 .replace(/fu/g, "hu").replace(/ji/g, "zi").replace(/sh/g, "sy")
                 .replace(/ch/g, "ty").replace(/j/g, "zy"));
      }
    }
    return [...out];
  }

  function variantsFor(display, reading) {
    const list = [];
    if (display) list.push(normalize(display));
    if (reading) {
      list.push(normalize(reading), normalize(wk.toKatakana(reading)));
      list.push(...romajiVariants(reading));
    }
    return list.filter(Boolean);
  }

  function autoAccepted() {
    const all = [
      ...variantsFor($("ans-display").value.trim(), $("ans-reading").value.trim()),
      ...state.alts.flatMap((a) => variantsFor(a.display.trim(), a.reading.trim()))
    ];
    return [...new Set(all)];
  }

  function acceptedList() {
    const auto = autoAccepted().filter((v) => !state.removedAuto.has(v));
    return [...new Set([...auto, ...state.manualAccepted])];
  }

  // ---- ログイン ----
  // ログイン後、APIから #token=... 付きでこのページに戻ってくる
  const TOKEN_KEY = "tabusaba_token";
  const LOGIN_ERRORS = {
    not_linked: "このDiscordアカウントはまだマイクラと連携されていません。ゲーム内で /mclink してから、もう一度ログインしてください。",
    cancelled: "ログインがキャンセルされました。",
    expired: "ログインの有効期限が切れました。もう一度ログインしてください。",
    bad_state: "ログインに失敗しました。もう一度ログインしてください。",
    discord_error: "Discordとの通信に失敗しました。時間をおいてもう一度試してください。"
  };
  const storage = {
    get() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { /* 保存できない環境 */ } },
    clear() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 同上 */ } }
  };
  let loginError = "";
  (function readHash() {
    if (!location.hash) return;
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("token")) storage.set(h.get("token"));
    if (h.get("error")) loginError = LOGIN_ERRORS[h.get("error")] || LOGIN_ERRORS.bad_state;
    history.replaceState(null, "", location.pathname + location.search);  // トークンをURLから消す
  })();
  const authHeaders = () => (storage.get() ? { Authorization: `Bearer ${storage.get()}` } : {});
  const loginUrl = () => `${API}/auth/login?redirect=${encodeURIComponent(location.origin + location.pathname)}`;

  // APIを呼ぶ。401ならログアウト状態に戻す
  async function api(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...authHeaders(), ...(options.headers || {}) }
    });
    let body = null;
    try { body = await res.json(); } catch (e) { /* 本文なし */ }
    if (res.status === 401) {
      storage.clear(); state.user = null; renderLogin();
      throw new Error("ログインの有効期限が切れました。ログインし直してください。");
    }
    if (!res.ok) throw new Error(ERRORS[body?.error] || `うまくいきませんでした(エラー ${res.status})。時間をおいてもう一度試してください。`);
    return body;
  }

  async function loadUser() {
    if (DEMO) { renderLogin(); return; }
    $("login").textContent = "読み込み中…";
    if (storage.get()) {
      try { state.user = await api("/api/me"); } catch (e) { /* 未ログイン扱い */ }
    }
    renderLogin();
    if (state.user) loadMine();
  }

  function renderLogin() {
    const box = $("login");
    box.textContent = "";
    box.className = "card login";
    $("tabs").hidden = !state.user;
    if (DEMO) {
      box.className = "notice";
      box.textContent = "お試しモードです。config.js の API_BASE が未設定のため、投稿すると問題のデータ(JSON)が表示されるだけで保存はされません。";
      return;
    }
    if (state.user) {
      const me = document.createElement("div");
      me.className = "me";
      const img = document.createElement("img");
      img.src = `https://minotar.net/helm/${encodeURIComponent(state.user.minecraftName)}/80.png`;
      img.alt = ""; img.width = 40; img.height = 40; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.src = "../Main/icon.png"; }, { once: true });
      const t = document.createElement("div");
      t.innerHTML = `<strong></strong> としてログイン中<div class="hint"></div>`;
      t.querySelector("strong").textContent = state.user.minecraftName;
      t.querySelector(".hint").textContent = `Discord: ${state.user.discordName}`;
      me.append(img, t);
      const out = document.createElement("button");
      out.type = "button"; out.className = "btn small"; out.textContent = "ログアウト";
      out.addEventListener("click", async () => {
        try { await fetch(`${API}/auth/logout`, { method: "POST", headers: authHeaders() }); } catch (e) { /* 手元は消す */ }
        storage.clear(); state.user = null; state.mine = [];
        cancelEdit(); showView("create"); renderLogin();
      });
      box.append(me, out);
      $("submit-btn").disabled = false;
    } else {
      const t = document.createElement("div");
      t.innerHTML = `問題を投稿するにはログインしてください。<div class="hint">ゲーム内で /mclink したDiscordアカウントを使います。</div>`;
      if (loginError) {
        const e = document.createElement("div");
        e.className = "error"; e.textContent = loginError;
        t.appendChild(e);
      }
      const a = document.createElement("a");
      a.className = "btn primary"; a.textContent = "Discordでログイン"; a.href = loginUrl();
      box.append(t, a);
      $("submit-btn").disabled = true;
      showView("create");
    }
  }

  // ---- ジャンル(Main/genres.json) ----
  async function loadGenres() {
    const sel = $("genre");
    try {
      const res = await fetch("../Main/genres.json", { cache: "no-cache" });
      const data = await res.json();
      state.genres = Array.isArray(data.genres) ? data.genres : [];
    } catch (e) {
      state.genres = [];
      $("form-error").textContent = "ジャンルの一覧を読み込めませんでした。ページを再読み込みしてください。";
    }
    for (const g of state.genres) {
      const o = document.createElement("option");
      o.value = g; o.textContent = g;
      sel.appendChild(o);
    }
  }

  // ---- フォームの描画 ----
  function chip(text, onRemove, auto) {
    const el = document.createElement("span");
    el.className = "chip" + (auto ? " auto" : "");
    el.textContent = text;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "×";
    b.setAttribute("aria-label", `${text} を削除`);
    b.addEventListener("click", onRemove);
    el.appendChild(b);
    return el;
  }

  function renderAccepted() {
    const box = $("accepted");
    box.textContent = "";
    const autoSet = new Set(autoAccepted());
    const list = acceptedList();
    if (!list.length) {
      const p = document.createElement("span");
      p.className = "hint";
      p.style.margin = "0 6px";
      p.textContent = "正解か読みを入力すると、ここに表示されます。";
      box.appendChild(p);
      return;
    }
    for (const v of list) {
      const isAuto = autoSet.has(v) && !state.manualAccepted.includes(v);
      box.appendChild(chip(v, () => {
        if (isAuto) state.removedAuto.add(v);
        state.manualAccepted = state.manualAccepted.filter((x) => x !== v);
        renderAccepted();
      }, isAuto));
    }
  }

  function renderTags() {
    const box = $("tags");
    const input = $("tag-input");
    box.querySelectorAll(".chip").forEach((c) => c.remove());
    for (const t of state.tags) {
      box.insertBefore(chip(t, () => {
        state.tags = state.tags.filter((x) => x !== t);
        renderTags();
      }), input);
    }
    input.disabled = state.tags.length >= Q.TAGS_MAX;
    input.placeholder = input.disabled ? "これ以上追加できません" : "入力してEnter";
  }

  function renderAlts() {
    const box = $("alts");
    box.textContent = "";
    state.alts.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "alt-item";
      const d = document.createElement("input");
      d.type = "text"; d.placeholder = "別解(漢字など) 例: 東京都"; d.value = a.display;
      d.setAttribute("aria-label", `別解${i + 1} 漢字など`);
      d.addEventListener("input", () => { a.display = d.value; renderAccepted(); });
      const r = document.createElement("input");
      r.type = "text"; r.placeholder = "読み 例: とうきょうと"; r.value = a.reading;
      r.setAttribute("aria-label", `別解${i + 1} 読み`);
      wk.bind(r, { IMEMode: "toHiragana" });
      r.addEventListener("input", () => { a.reading = r.value; renderAccepted(); });
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn small"; del.textContent = "削除";
      del.addEventListener("click", () => { state.alts.splice(i, 1); renderAlts(); renderAccepted(); });
      row.append(d, r, del);
      box.appendChild(row);
    });
    $("add-alt").disabled = state.alts.length >= Q.ALT_MAX;
  }

  function renderCount() {
    const n = [...$("question").value].length;
    const el = $("q-count");
    el.textContent = `${n} / ${Q.QUESTION_MAX}`;
    el.style.color = n > Q.QUESTION_MAX ? "var(--danger)" : "";
  }

  // ---- 出題プレビュー(左から1文字ずつ) ----
  // ボタンを押したときだけ再生する。OSの「アニメーションを減らす」設定でも再生する
  let timer = null;
  function showPreviewText(text) {
    clearInterval(timer);
    $("preview").textContent = text || "問題文を入力して「プレビューを再生」を押すと、ここで確認できます。";
  }
  function playPreview() {
    clearInterval(timer);
    const chars = [...$("question").value.trim()];
    const screen = $("preview");
    if (!chars.length) { showPreviewText(""); return; }
    let i = 0;
    const draw = () => {
      screen.textContent = chars.slice(0, i).join("");
      if (i < chars.length) {
        const c = document.createElement("span");
        c.className = "cursor";
        screen.appendChild(c);
      }
    };
    draw();
    timer = setInterval(() => { i++; draw(); if (i >= chars.length) clearInterval(timer); }, Q.REVEAL_MS);
    $("preview-btn").textContent = "もう一度再生";
  }

  // ---- 入力チェック ----
  function validate() {
    const q = $("question").value.trim();
    const display = $("ans-display").value.trim();
    const reading = $("ans-reading").value.trim();
    if (!$("genre").value) return "ジャンルを選んでください。";
    if (!q) return "問題文を入力してください。";
    if ([...q].length > Q.QUESTION_MAX) return `問題文は${Q.QUESTION_MAX}文字以内にしてください。`;
    if (!display && !reading) return "正解か読みのどちらかを入力してください。";
    if (reading && !wk.isHiragana(reading)) return "読みはひらがなで入力してください。";
    for (const a of state.alts) {
      if (a.reading.trim() && !wk.isHiragana(a.reading.trim())) return "別解の読みはひらがなで入力してください。";
    }
    if (!acceptedList().length) return "正解として受け付ける入力が1つもありません。";
    return "";
  }

  function payload() {
    return {
      genre: $("genre").value,
      tags: state.tags,
      question: $("question").value.trim(),
      answer: { display: $("ans-display").value.trim(), reading: $("ans-reading").value.trim() },
      alternatives: state.alts
        .map((a) => ({ display: a.display.trim(), reading: a.reading.trim() }))
        .filter((a) => a.display || a.reading),
      accepted: acceptedList()
    };
  }

  function showResult(title, text, json) {
    $("quiz-form").hidden = true;
    $("edit-banner").hidden = true;
    $("result").hidden = false;
    $("result-title").textContent = title;
    $("result-text").textContent = text;
    const pre = $("result-json");
    pre.hidden = !json;
    if (json) pre.textContent = JSON.stringify(json, null, 2);
    $("to-mine-btn").hidden = !state.user;
    $("result").scrollIntoView({ block: "start" });
  }

  async function submit(e) {
    e.preventDefault();
    const err = validate();
    $("form-error").textContent = err;
    if (err) return;
    const data = payload();
    if (DEMO) {
      showResult("問題データを作りました", "お試しモードのため保存はされていません。", data);
      return;
    }
    const btn = $("submit-btn");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "送信中…";
    try {
      if (state.editingId) {
        await api(`/api/quizzes/${state.editingId}`, { method: "PUT", body: JSON.stringify(data) });
        state.editingId = null;
        showResult("変更を保存しました", "次の早押しクイズ大会から、変更後の内容で出題されます。");
      } else {
        await api("/api/quizzes", { method: "POST", body: JSON.stringify(data) });
        showResult("問題を投稿しました", "次の早押しクイズ大会から出題されるようになります。");
      }
      loadMine();
    } catch (ex) {
      $("form-error").textContent = ex.message || "サーバーに接続できませんでした。";
    } finally {
      btn.disabled = !state.user; btn.textContent = label;
    }
  }

  // ---- フォームを空にする / 問題を読み込む ----
  function clearForm() {
    // form.reset() は reset イベントを発生させるので使わず、直接空にする
    for (const id of ["genre", "question", "ans-display", "ans-reading", "tag-input", "accept-input"]) $(id).value = "";
    state.tags = []; state.alts = [];
    state.manualAccepted = []; state.removedAuto = new Set();
    $("form-error").textContent = "";
    renderTags(); renderAlts(); renderAccepted(); renderCount(); showPreviewText("");
    $("preview-btn").textContent = "プレビューを再生";
  }

  function fillForm(quiz) {
    clearForm();
    $("genre").value = state.genres.includes(quiz.genre) ? quiz.genre : "";
    $("question").value = quiz.question;
    $("ans-display").value = quiz.answer.display;
    $("ans-reading").value = quiz.answer.reading;
    state.tags = [...quiz.tags];
    state.alts = quiz.alternatives.map((a) => ({ display: a.display || "", reading: a.reading || "" }));
    // 保存されている受理表記を、自動生成分・手動追加分・消した自動生成分に振り分ける
    const auto = autoAccepted();
    state.manualAccepted = quiz.accepted.filter((v) => !auto.includes(v));
    state.removedAuto = new Set(auto.filter((v) => !quiz.accepted.includes(v)));
    renderTags(); renderAlts(); renderAccepted(); renderCount();
  }

  function startEdit(quiz) {
    state.editingId = quiz.id;
    fillForm(quiz);
    $("edit-text").textContent = `問題 #${quiz.id} を編集中`;
    $("edit-banner").hidden = false;
    $("submit-btn").textContent = "変更を保存";
    $("quiz-form").hidden = false;
    $("result").hidden = true;
    showView("create");
    window.scrollTo(0, 0);
  }

  function cancelEdit() {
    state.editingId = null;
    $("edit-banner").hidden = true;
    $("submit-btn").textContent = "問題を投稿";
    $("quiz-form").hidden = false;
    $("result").hidden = true;
    clearForm();
  }

  // ---- 作った問題 ----
  async function loadMine() {
    if (!state.user) return;
    try {
      const data = await api("/api/quizzes/mine");
      state.mine = data.quizzes || [];
    } catch (e) {
      $("mine-list").textContent = e.message;
      return;
    }
    renderMine();
  }

  function renderMine() {
    $("mine-count").textContent = state.mine.length ? `(${state.mine.length})` : "";
    const box = $("mine-list");
    box.textContent = "";
    if (!state.mine.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "まだ問題を作っていません。「問題を作る」から最初の1問を作ってみましょう。";
      box.appendChild(p);
      return;
    }
    for (const quiz of state.mine) {
      const el = document.createElement("article");
      el.className = "qitem";
      el.innerHTML = `
        <div class="meta"><span class="badge genre"></span><span class="tags"></span></div>
        <div class="q"></div>
        <div class="a"></div>
        <div class="meta stats"></div>
        <div class="ops">
          <button type="button" class="btn small edit">編集</button>
          <button type="button" class="btn small danger del">削除</button>
        </div>`;
      el.querySelector(".genre").textContent = quiz.genre;
      const tags = el.querySelector(".tags");
      for (const t of quiz.tags) {
        const b = document.createElement("span");
        b.className = "badge"; b.textContent = `#${t}`;
        tags.appendChild(b);
      }
      tags.style.display = "contents";
      el.querySelector(".q").textContent = quiz.question;
      const ans = quiz.answer.display && quiz.answer.reading
        ? `${quiz.answer.display}(${quiz.answer.reading})`
        : quiz.answer.display || quiz.answer.reading;
      el.querySelector(".a").textContent = `正解: ${ans}`;
      const stats = el.querySelector(".stats");
      const rate = quiz.playCount ? `正答率 ${Math.round((quiz.correctCount / quiz.playCount) * 100)}%` : "まだ出題されていません";
      for (const txt of [`#${quiz.id}`, quiz.playCount ? `出題 ${quiz.playCount}回` : null, rate,
                         `作成 ${formatDate(quiz.createdAt)}`, quiz.updatedAt ? `編集 ${formatDate(quiz.updatedAt)}` : null]) {
        if (!txt) continue;
        const b = document.createElement("span");
        b.className = "badge"; b.textContent = txt;
        stats.appendChild(b);
      }
      el.querySelector(".edit").addEventListener("click", () => startEdit(quiz));
      el.querySelector(".del").addEventListener("click", () => removeQuiz(quiz));
      box.appendChild(el);
    }
  }

  async function removeQuiz(quiz) {
    if (!confirm(`「${quiz.question}」を削除しますか？\n削除すると元に戻せません。`)) return;
    try {
      await api(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (state.editingId === quiz.id) cancelEdit();
      state.mine = state.mine.filter((x) => x.id !== quiz.id);
      renderMine();
    } catch (e) {
      alert(e.message);
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ---- 表示の切り替え ----
  function showView(name) {
    $("view-create").hidden = name !== "create";
    $("view-mine").hidden = name !== "mine";
    document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === name)));
  }

  // ---- 初期化 ----
  wk.bind($("ans-reading"), { IMEMode: "toHiragana" });
  ["ans-display", "ans-reading"].forEach((id) => $(id).addEventListener("input", renderAccepted));
  $("question").setAttribute("maxlength", Q.QUESTION_MAX);
  $("question").addEventListener("input", renderCount);
  $("preview-btn").addEventListener("click", playPreview);
  $("add-alt").addEventListener("click", () => { state.alts.push({ display: "", reading: "" }); renderAlts(); });
  document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => {
    showView(b.dataset.view);
    if (b.dataset.view === "mine") loadMine();
  }));

  // 日本語入力の変換確定のEnterでは追加しない(isComposing)
  $("tag-input").addEventListener("keydown", (e) => {
    const input = e.target;
    if (e.isComposing) return;
    if (e.key === "Enter" || e.key === "," || e.key === "、") {
      e.preventDefault();
      const v = input.value.trim().replace(/[,、]/g, "");
      if (v && !state.tags.includes(v) && [...v].length <= Q.TAG_LEN_MAX && state.tags.length < Q.TAGS_MAX) {
        state.tags.push(v); input.value = ""; renderTags(); input.focus();
      }
    } else if (e.key === "Backspace" && !input.value && state.tags.length) {
      state.tags.pop(); renderTags();
    }
  });
  $("accept-input").addEventListener("keydown", (e) => {
    if (e.isComposing || e.key !== "Enter") return;
    e.preventDefault();
    const v = normalize(e.target.value);
    if (v && !state.manualAccepted.includes(v)) {
      state.manualAccepted.push(v);
      state.removedAuto.delete(v);
    }
    e.target.value = "";
    renderAccepted();
  });

  $("quiz-form").addEventListener("submit", submit);
  $("quiz-form").addEventListener("reset", (e) => {
    e.preventDefault();
    if (state.editingId) cancelEdit(); else clearForm();
  });
  $("cancel-edit").addEventListener("click", cancelEdit);
  $("new-btn").addEventListener("click", () => { cancelEdit(); window.scrollTo(0, 0); });
  $("to-mine-btn").addEventListener("click", () => { cancelEdit(); showView("mine"); window.scrollTo(0, 0); });

  renderTags(); renderAlts(); renderAccepted(); renderCount(); showPreviewText("");
  loadGenres().then(loadUser);
})();
