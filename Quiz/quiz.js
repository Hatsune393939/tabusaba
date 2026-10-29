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
    tags: [],
    alts: [],              // [{display, reading}]
    manualAccepted: [],    // 自分で追加した受理表記
    removedAuto: new Set() // 自動生成から消した受理表記
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

  // ---- 描画 ----
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
  let timer = null;
  function playPreview() {
    clearInterval(timer);
    const chars = [...$("question").value.trim()];
    const screen = $("preview");
    if (!chars.length) { screen.textContent = "問題文を入力するとここで確認できます。"; return; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = reduce ? chars.length : 0;
    const draw = () => {
      screen.textContent = chars.slice(0, i).join("");
      if (i < chars.length) {
        const c = document.createElement("span");
        c.className = "cursor";
        screen.appendChild(c);
      }
    };
    draw();
    if (reduce) return;
    timer = setInterval(() => { i++; draw(); if (i >= chars.length) clearInterval(timer); }, Q.REVEAL_MS);
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

  async function loadUser() {
    const box = $("login");
    if (DEMO) {
      box.className = "notice";
      box.textContent = "お試しモードです。config.js の API_BASE が未設定のため、投稿すると問題のデータ(JSON)が表示されるだけで保存はされません。";
      return;
    }
    box.textContent = "読み込み中…";
    if (storage.get()) {
      try {
        const res = await fetch(`${API}/api/me`, { headers: authHeaders() });
        if (res.ok) state.user = await res.json();
        else if (res.status === 401) storage.clear();
      } catch (e) { /* 通信エラーは未ログイン扱い */ }
    }
    box.textContent = "";
    if (state.user) {
      const t = document.createElement("div");
      t.innerHTML = `<strong></strong> としてログイン中<div class="hint"></div>`;
      t.querySelector("strong").textContent = state.user.minecraftName;
      t.querySelector(".hint").textContent = `Discord: ${state.user.discordName}`;
      const out = document.createElement("button");
      out.type = "button"; out.className = "btn small"; out.textContent = "ログアウト";
      out.addEventListener("click", async () => {
        try { await fetch(`${API}/auth/logout`, { method: "POST", headers: authHeaders() }); } catch (e) { /* 失敗しても手元は消す */ }
        storage.clear(); state.user = null; loadUser();
      });
      box.append(t, out);
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
    }
  }

  // ---- 入力チェックと投稿 ----
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
    $("result").hidden = false;
    $("result-title").textContent = title;
    $("result-text").textContent = text;
    const pre = $("result-json");
    pre.hidden = !json;
    if (json) pre.textContent = JSON.stringify(json, null, 2);
    $("result").scrollIntoView({ block: "start" });
  }

  async function submit(e) {
    e.preventDefault();
    const err = validate();
    $("form-error").textContent = err;
    if (err) return;
    const data = payload();
    if (DEMO) {
      showResult("問題データを作りました", "お試しモードのため保存はされていません。APIを用意したら、このデータがそのまま送信されます。", data);
      return;
    }
    const btn = $("submit-btn");
    btn.disabled = true; btn.textContent = "投稿中…";
    try {
      const res = await fetch(`${API}/api/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data)
      });
      if (res.status === 401) { storage.clear(); state.user = null; loadUser(); throw new Error("ログインの有効期限が切れました。ログインし直してください。"); }
      if (res.status === 429) throw new Error("今日はこれ以上投稿できません(1日30問まで)。また明日投稿してください。");
      if (!res.ok) throw new Error(`投稿できませんでした(エラー ${res.status})。時間をおいてもう一度試してください。`);
      showResult("問題を投稿しました", "次の早押しクイズ大会から出題されるようになります。");
    } catch (ex) {
      $("form-error").textContent = ex.message || "サーバーに接続できませんでした。";
    } finally {
      btn.disabled = false; btn.textContent = "問題を投稿";
    }
  }

  function resetAll() {
    state.tags = []; state.alts = [];
    state.manualAccepted = []; state.removedAuto.clear();
    $("form-error").textContent = "";
    setTimeout(() => { renderTags(); renderAlts(); renderAccepted(); renderCount(); playPreview(); });
  }

  // ---- 初期化 ----
  const sel = $("genre");
  for (const g of CFG.GENRES) {
    const o = document.createElement("option");
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  }

  wk.bind($("ans-reading"), { IMEMode: "toHiragana" });
  ["ans-display", "ans-reading"].forEach((id) => $(id).addEventListener("input", renderAccepted));
  $("question").addEventListener("input", renderCount);
  $("question").setAttribute("maxlength", Q.QUESTION_MAX);
  $("question").addEventListener("change", playPreview);
  $("preview-btn").addEventListener("click", playPreview);
  $("add-alt").addEventListener("click", () => { state.alts.push({ display: "", reading: "" }); renderAlts(); });

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
  $("quiz-form").addEventListener("reset", resetAll);
  $("new-btn").addEventListener("click", () => {
    $("quiz-form").reset();
    $("quiz-form").hidden = false;
    $("result").hidden = true;
    window.scrollTo(0, 0);
  });

  renderTags(); renderAlts(); renderAccepted(); renderCount(); playPreview();
  loadUser();
})();
