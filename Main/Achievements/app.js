(function () {
  const $ = (id) => document.getElementById(id);
  const { mcToHtml, stripCodes } = window.MC;
  const { rateIcon, catIcon, CAT_SKIN } = window.Icons;

  let all = [], data = null, hasPlayers = false;
  let totalPlayers = 0;
  let players = new Map();   // name -> {name, ids:Set, points, count}
  let byId = new Map();   // Map を使い、'__proto__' や 'constructor' のような名前の実績でも安全にする
  let cats = [];
  const catIdx = new Map();   // カテゴリの並び順 = achievements.yml の順番

  // ---------- 共通 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const pct = (r) => (Math.round(r * 1000) / 10).toFixed(1).replace(/\.0$/, '') + '%';
  const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#6b6f7b"/><rect x="2" y="2" width="1" height="1" fill="#fff"/><rect x="5" y="2" width="1" height="1" fill="#fff"/><rect x="2" y="5" width="4" height="1" fill="#fff"/></svg>');
  const VALID_NAME = /^[A-Za-z0-9_]{1,32}$/;
  function avatar(name, size) {
    // 統合版(Floodgate)の ".name" は先頭の . を外す。Minecraftのユーザー名として不正な文字列は外部に送らない
    const n = String(name).replace(/^\./, '');
    if (!VALID_NAME.test(n)) return `<img class="av" src="${FALLBACK}" alt="">`;
    return `<img class="av" src="https://minotar.net/helm/${encodeURIComponent(n)}/${Number(size) || 64}.png" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  // 画像の読み込み失敗時は代替アイコンにする (インラインの onerror を使わない = CSP対応)
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('av') && t.src !== FALLBACK) t.src = FALLBACK;
  }, true);
  const bar = (r) => `<div class="bar"><i style="width:${Math.min(100, r * 100)}%"></i></div>`;

  // ---------- 状態 (URLのハッシュに保存) ----------
  let st = { v: 'ach', q: '', cat: '', sort: 'number', msg: false, p: '', rk: 'points', pl: 'done', a: '', b: '', cm: 'both', hl: '', pf: false, nw: false, fx: false };

  function parseHash() {
    const u = new URLSearchParams(location.hash.slice(1));
    st = {
      v: ['ach', 'rank', 'player', 'compare'].includes(u.get('v')) ? u.get('v') : 'ach',
      q: u.get('q') || '', cat: u.get('cat') || '',
      sort: ['number', 'points-desc', 'rare', 'common'].includes(u.get('sort')) ? u.get('sort') : 'number', msg: u.get('msg') === '1',
      p: u.get('p') || '', rk: ['points', 'count', 'rate'].includes(u.get('rk')) ? u.get('rk') : 'points',
      pl: u.get('pl') === 'todo' ? 'todo' : 'done',
      a: u.get('a') || '', b: u.get('b') || '',
      hl: u.get('hl') || '', pf: u.get('pf') === '1', nw: u.get('nw') === '1', fx: u.get('fx') === '1',
      cm: ['both', 'a', 'b', 'none'].includes(u.get('cm')) ? u.get('cm') : 'both',
    };
  }
  function writeHash(push) {
    const u = new URLSearchParams();
    if (st.v !== 'ach') u.set('v', st.v);
    if (st.q) u.set('q', st.q);
    if (st.cat) u.set('cat', st.cat);
    if (st.sort !== 'number') u.set('sort', st.sort);
    if (st.msg) u.set('msg', '1');
    if (st.p) u.set('p', st.p);
    if (st.rk !== 'points') u.set('rk', st.rk);
    if (st.pl !== 'done') u.set('pl', st.pl);
    if (st.a) u.set('a', st.a);
    if (st.hl) u.set('hl', st.hl);
    if (st.pf) u.set('pf', '1');
    if (st.nw) u.set('nw', '1');
    if (st.fx) u.set('fx', '1');
    if (st.b) u.set('b', st.b);
    if (st.cm !== 'both') u.set('cm', st.cm);
    const h = u.toString() ? '#' + u.toString() : location.pathname + location.search;
    try { (push ? history.pushState : history.replaceState).call(history, null, '', h); } catch (e) { /* file:// など */ }
  }
  function go(patch, push) {
    Object.assign(st, patch);
    writeHash(push !== false);
    renderAll();
  }

  // ---------- データ準備 ----------
  function prepare(d) {
    data = d;
    hasPlayers = true;
    cats = d.categories;
    catIdx.clear(); cats.forEach((c, i) => catIdx.set(c.id, i));
    const names = d.players || [];
    cats.forEach((c) => c.achievements.forEach((a) => {
      a.category = c.id;
      a.prefixes = a.prefixes || [];
      a.flavorTexts = a.flavorTexts || [];
      a.messages = a.messages || [];
      // 軽量化: 達成者は番号で保存されているので名前に戻す (旧形式の achievedPlayers も読める)
      a.achievedPlayers = a.p ? a.p.map((i) => names[i]) : (a.achievedPlayers || []);
      a.achievedCount = a.achievedPlayers.length;
      delete a.p;
    }));
    all = d.categories.flatMap((c) => c.achievements);
    byId = new Map(all.map((a) => [a.id, a]));
    all.forEach((a) => { a._h = haystack(a); });
    players = new Map();
    if (hasPlayers) {
      all.forEach((a) => (a.achievedPlayers || []).forEach((n) => {
        if (!players.has(n)) players.set(n, { name: n, ids: new Set(), points: 0, count: 0 });
        const p = players.get(n);
        p.ids.add(a.id); p.points += Number(a.points) || 0; p.count += 1;
      }));
    }
    totalPlayers = players.size;
    plower = new Map([...players.values()].map((p) => [p.name.toLowerCase(), p]));
  }
  let plower = new Map();
  const getP = (n) => plower.get(String(n || '').trim().toLowerCase());
  const cardRate = (a) => (totalPlayers ? (a.achievedPlayers ? a.achievedPlayers.length : a.achievedCount) / totalPlayers : 0);

  function haystack(a) {
    return [stripCodes(a.name), (a.conditions || []).map(stripCodes).join(' '),
      a.flavorTexts.join(' '), a.messages.map((m) => m.text + ' ' + m.author).join(' '),
      a.category, a.number].join(' ').toLowerCase();
  }

  // ---------- 実績ビュー ----------
  // ---------- NEW / FIXED ----------
  const NEW_DAYS = 30;
  function ageDays(s) {
    if (!s) return Infinity;
    const t = Date.parse(s + 'T00:00:00');
    return Number.isNaN(t) ? Infinity : Math.floor((Date.now() - t) / 86400000);
  }
  function flagKind(a) {   // NEW を優先
    if (ageDays(a.add) < NEW_DAYS) return 'new';
    if (ageDays(a.fix) < NEW_DAYS) return 'fixed';
    return '';
  }
  function flagOf(a) {
    const k = flagKind(a);
    if (k === 'new') return '<span class="flag new" title="最近追加された実績">NEW</span>';
    if (k === 'fixed') return '<span class="flag fixed" title="最近内容が修正された実績">FIXED</span>';
    return '';
  }

  function parts(a) {
    const prefixes = a.prefixes.map((p) => `<span class="badge prefix">称号 ${mcToHtml(p)}</span>`).join('');
    const cond = a.conditions && a.conditions.length
      ? `<div class="cond-wrap"><ul>${a.conditions.map((c) => `<li>${mcToHtml(c)}</li>`).join('')}</ul></div>` : '';
    const flavor = a.flavorTexts.length ? `<p class="flavor">${a.flavorTexts.map(esc).join('<br>')}</p>` : '';
    const msgs = a.messages.length
      ? `<div class="msgs">${a.messages.map((m) =>
        `<div class="msg">${mcToHtml(m.text)}${m.author ? `<span class="by">— ${esc(m.author)}</span>` : ''}</div>`).join('')}</div>` : '';
    return { prefixes, cond, flavor, msgs };
  }

  // カテゴリのアイコン (専用アイコン → スキン顔 → 達成率アイコン の順)
  function catMark(id, rate) {
    if (Object.prototype.hasOwnProperty.call(CAT_SKIN, id)) return `<span class="ricon cicon skin" title="${esc(CAT_SKIN[id])}">${avatar(CAT_SKIN[id], 32)}</span>`;
    return catIcon(id) || rateIcon(rate);
  }

  let hlP = null;   // 強調表示するプレイヤー
  function card(a) {
    const { prefixes, cond, flavor, msgs } = parts(a);
    const rate = cardRate(a);
    const ratebadge = hasPlayers ? `<span class="badge">達成率 ${pct(rate)}</span>` : '';
    const mine = hlP && hlP.ids.has(a.id);
    return `<article class="card${mine ? ' mine' : ''}" data-id="${esc(a.id)}" tabindex="0">
      <div class="head"><h2>${hasPlayers ? rateIcon(rate) : ''}<span class="mc-title">${mcToHtml(a.name)}</span>${flagOf(a)}</h2><span class="num">${esc(a.category)} ${esc(a.number)}</span></div>
      <div class="badges"><span class="badge pt">${num(a.points)} pt</span><span class="badge">達成者 ${a.achievedCount}人</span>${ratebadge}${mine ? '<span class="badge mine-b">✓ 達成済み</span>' : ''}${prefixes}</div>
      ${cond}${flavor}${msgs}
    </article>`;
  }

  function numKey(a) { return a.number.split('-').map((n) => parseInt(n, 10) || 0); }
  function cmpNum(a, b) {
    if (a.category !== b.category) return (catIdx.get(a.category) || 0) - (catIdx.get(b.category) || 0);
    const x = numKey(a), y = numKey(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function renderStats() {
    let html = `<div class="stat"><b>${num(all.length)}</b><span>実績数</span></div>`;
    let bars = '';
    if (hasPlayers) {
      const sum = all.reduce((s, a) => s + (a.achievedPlayers || []).length, 0);
      const avg = totalPlayers && all.length ? sum / (totalPlayers * all.length) : 0;
      html += `<div class="stat"><b>${totalPlayers}</b><span>総プレイヤー数</span></div>
        <div class="stat"><b>${pct(avg)}</b><span>平均達成率</span></div>`;
      let open = false;
      try { open = localStorage.getItem('catOpen') === '1'; } catch (e) { /* noop */ }
      bars = `<details class="catdet" id="catDet"${open ? ' open' : ''}><summary>カテゴリごとの達成率 <small class="muted">(全プレイヤーの平均)</small></summary>` + cats.map((c) => {
        const n = c.achievements.length;
        const s = c.achievements.reduce((t, a) => t + (a.achievedPlayers || []).length, 0);
        const r = totalPlayers && n ? s / (totalPlayers * n) : 0;
        return `<button class="catrow" data-cat="${esc(c.id)}">${catMark(c.id, r)}<span class="cn">${esc(c.id)}</span>${bar(r)}<span class="cp">${pct(r)}</span><span class="muted cc">${n}件</span></button>`;
      }).join('') + '</details>';
    }
    $('stats').innerHTML = html;
    $('catbars').innerHTML = bars;
    const det = $('catDet');
    if (det) det.addEventListener('toggle', () => { try { localStorage.setItem('catOpen', det.open ? '1' : '0'); } catch (e) { /* noop */ } });
  }

  function renderAch() {
    const q = st.q.trim().toLowerCase();
    const list = all.filter((a) => (!st.cat || a.category === st.cat) && (!st.msg || a.messages.length) && (!st.pf || a.prefixes.length) &&
      (!(st.nw || st.fx) || (st.nw && flagKind(a) === 'new') || (st.fx && flagKind(a) === 'fixed')) &&
      (!q || a._h.includes(q)));
    const sorters = {
      number: cmpNum,
      'points-desc': (a, b) => b.points - a.points || cmpNum(a, b),
      rare: (a, b) => a.achievedCount - b.achievedCount || cmpNum(a, b),
      common: (a, b) => b.achievedCount - a.achievedCount || cmpNum(a, b),
    };
    list.sort(Object.prototype.hasOwnProperty.call(sorters, st.sort) ? sorters[st.sort] : cmpNum);
    hlP = st.hl ? getP(st.hl) : null;
    cur = list; shown = 0;
    $('list').innerHTML = list.length ? '' : '<p class="empty">該当する実績がありません</p>';
    appendMore();
    $('summary').textContent = `${list.length} / ${all.length} 件の実績`;
  }

  // 軽量化: 実績カードは60件ずつ、スクロールに合わせて追加で描画する
  const BATCH = 60;
  let cur = [], shown = 0, io = null;
  function appendMore() {
    const more = $('more');
    do {
      if (shown >= cur.length) break;
      const next = cur.slice(shown, shown + BATCH);
      $('list').insertAdjacentHTML('beforeend', next.map(card).join(''));
      shown += next.length;
    } while (!io && shown < cur.length);                       // IntersectionObserver 非対応なら全件描画
    while (io && shown < cur.length && more.getBoundingClientRect().top < window.innerHeight + 600) {
      const next = cur.slice(shown, shown + BATCH);
      $('list').insertAdjacentHTML('beforeend', next.map(card).join(''));
      shown += next.length;
    }
  }

  function syncControls() {
    if ($('q').value !== st.q) $('q').value = st.q;
    $('cat').value = st.cat;
    $('sort').value = st.sort;
    $('onlyMsg').setAttribute('aria-checked', String(st.msg));
    $('onlyMsg').classList.toggle('on', st.msg);
    $('onlyPrefix').setAttribute('aria-checked', String(st.pf));
    $('onlyPrefix').classList.toggle('on', st.pf);
    $('onlyNew').setAttribute('aria-checked', String(st.nw));
    $('onlyNew').classList.toggle('on', st.nw);
    $('onlyFixed').setAttribute('aria-checked', String(st.fx));
    $('onlyFixed').classList.toggle('on', st.fx);
    if ($('hl').value !== st.hl) $('hl').value = st.hl;
  }

  // ---------- ダイアログ ----------
  function openDialog(a) {
    $('dlg-title').innerHTML = mcToHtml(a.name);
    const { prefixes, cond, flavor, msgs } = parts(a);
    const info = `<div class="badges">${flagOf(a)}<span class="badge pt">${num(a.points)} pt</span><span class="badge">${esc(a.category)} ${esc(a.number)}</span>${prefixes}</div>${cond}${flavor}${msgs}`;
    let body;
    if (!a.achievedPlayers.length) {
      body = info + '<p class="muted">まだ誰も達成していません</p>';
    } else {
      body = info + `<p class="muted">達成者 ${a.achievedPlayers.length}人 (名前を押すとプレイヤーページへ)</p><ul class="plist">` +
        a.achievedPlayers.map((p) =>
          `<li><button class="plink" data-p="${esc(p)}">${avatar(p)}<span title="${esc(p)}">${esc(p)}</span></button></li>`).join('') + '</ul>';
    }
    $('dlg-body').innerHTML = body;
    $('dlg').showModal();
  }

  // ---------- ランキング ----------
  function renderRank() {
    document.querySelectorAll('#rankMode button').forEach((b) => b.classList.toggle('on', b.dataset.rk === st.rk));
    if (!hasPlayers) { $('rank').innerHTML = '<p class="empty">達成者名が公開設定に含まれていないため、ランキングを表示できません。</p>'; return; }
    const key = { points: 'points', count: 'count', rate: 'count' }[st.rk];
    const arr = [...players.values()].sort((a, b) =>
      b[key] - a[key] || (st.rk === 'points' ? b.count - a.count : b.points - a.points) || a.name.localeCompare(b.name));
    let rank = 0, prev = null;
    const rows = arr.slice(0, 200).map((p, i) => {
      if (prev === null || p[key] !== prev) rank = i + 1;
      prev = p[key];
      const r = all.length ? p.count / all.length : 0;
      const medal = rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
      return `<button class="rrow" data-p="${esc(p.name)}"><span class="rk${medal}">${rank}</span>${avatar(p.name, 40)}
        <span class="rn">${esc(p.name)}</span>${rateIcon(r)}
        <span class="rv"><b>${num(p.points)}</b> pt</span><span class="rv">${p.count}/${all.length}件 (${pct(r)})</span></button>`;
    });
    $('rank').innerHTML = rows.join('') || '<p class="empty">まだ達成者がいません</p>';
  }

  // ---------- プレイヤー ----------
  function renderPlayer() {
    if (!hasPlayers) { $('pview').innerHTML = '<p class="empty">達成者名が公開設定に含まれていないため、表示できません。</p>'; return; }
    if ($('pq').value !== st.p) $('pq').value = st.p;
    const found = [...players.values()].find((x) => x.name.toLowerCase() === st.p.trim().toLowerCase());
    if (!st.p.trim()) { $('pview').innerHTML = '<p class="empty">プレイヤー名を入力するか、ランキングから選んでください</p>'; return; }
    if (!found) { $('pview').innerHTML = '<p class="empty">そのプレイヤーの達成記録はありません</p>'; return; }
    const r = all.length ? found.count / all.length : 0;
    const catRows = cats.map((c) => {
      const n = c.achievements.length;
      const got = c.achievements.filter((a) => found.ids.has(a.id)).length;
      const cr = n ? got / n : 0;
      return `<div class="catrow static">${catMark(c.id, cr)}<span class="cn">${esc(c.id)}</span>${bar(cr)}<span class="cp">${pct(cr)}</span><span class="muted cc">${got}/${n}</span></div>`;
    }).join('');
    const todo = st.pl === 'todo';
    const items = all.filter((a) => found.ids.has(a.id) !== todo).sort(cmpNum).map((a) =>
      `<button class="chip" data-id="${esc(a.id)}"><span class="mc-title">${mcToHtml(a.name)}</span><span class="badge pt">${num(a.points)} pt</span></button>`).join('');
    $('pview').innerHTML = `
      <div class="pcard">
        <div class="phead">${avatar(found.name, 96)}<div><h2>${esc(found.name)}</h2><button class="cmpbtn" data-cmp="${esc(found.name)}">他のプレイヤーと比較</button>
          <div class="pstat"><span><b>${num(found.points)}</b> pt</span><span><b>${found.count}</b>/${all.length}件</span><span>${rateIcon(r)} 達成率 <b>${pct(r)}</b></span></div></div></div>
        <h3 class="h3">カテゴリ別</h3>${catRows}
        <div class="seg" id="plMode"><button data-pl="done" class="${todo ? '' : 'on'}">達成済み</button><button data-pl="todo" class="${todo ? 'on' : ''}">未達成</button></div>
        <div class="chips">${items || '<p class="empty">なし</p>'}</div>
      </div>`;
  }

  // ---------- プレイヤーの比較 ----------
  function renderCompare() {
    if ($('ca').value !== st.a) $('ca').value = st.a;
    if ($('cb').value !== st.b) $('cb').value = st.b;
    const out = $('cview');
    if (!st.a.trim() || !st.b.trim()) { out.innerHTML = '<p class="empty">比較する2人のプレイヤー名を入力してください</p>'; return; }
    const A = getP(st.a), B = getP(st.b);
    const miss = [!A && st.a, !B && st.b].filter(Boolean);
    if (miss.length) { out.innerHTML = `<p class="empty">達成記録がありません: ${miss.map(esc).join('、')}</p>`; return; }

    const sets = { both: [], a: [], b: [], none: [] };
    all.forEach((x) => {
      const i = A.ids.has(x.id), k = B.ids.has(x.id);
      sets[i && k ? 'both' : i ? 'a' : k ? 'b' : 'none'].push(x);
    });
    const union = sets.both.length + sets.a.length + sets.b.length;
    const same = union ? sets.both.length / union : 0;
    const rateOf = (p) => (all.length ? p.count / all.length : 0);

    const head = (p, side) => `<button class="cmphead ${side}" data-p="${esc(p.name)}">${avatar(p.name, 64)}<span class="cmpname">${esc(p.name)}</span>${rateIcon(rateOf(p))}</button>`;
    const row = (label, va, vb, fmt) =>
      `<div class="cmprow"><span class="cv l${va > vb ? ' win' : ''}">${fmt(va)}</span><span class="cl">${label}</span><span class="cv r${vb > va ? ' win' : ''}">${fmt(vb)}</span></div>`;
    const catRows = cats.map((c) => {
      const n = c.achievements.length;
      const ga = c.achievements.filter((x) => A.ids.has(x.id)).length;
      const gb = c.achievements.filter((x) => B.ids.has(x.id)).length;
      const ra = n ? ga / n : 0, rb = n ? gb / n : 0;
      return `<div class="cmpcat"><span class="cv l${ra > rb ? ' win' : ''}">${pct(ra)}</span><div class="bar rev"><i style="width:${ra * 100}%"></i></div><span class="cn">${esc(c.id)}</span><div class="bar"><i style="width:${rb * 100}%"></i></div><span class="cv r${rb > ra ? ' win' : ''}">${pct(rb)}</span></div>`;
    }).join('');

    const modes = [['both', '共通で達成'], ['a', `${esc(A.name)}のみ`], ['b', `${esc(B.name)}のみ`], ['none', 'どちらも未達成']];
    const seg = modes.map(([k, l]) => `<button data-cm="${k}" class="${st.cm === k ? 'on' : ''}">${l} (${sets[k].length})</button>`).join('');
    const items = sets[st.cm].slice().sort(cmpNum).map((x) =>
      `<button class="chip" data-id="${esc(x.id)}"><span class="mc-title">${mcToHtml(x.name)}</span><span class="badge pt">${num(x.points)} pt</span></button>`).join('');

    out.innerHTML = `<div class="pcard">
      <div class="cmpheads">${head(A, 'l')}<span class="vs">VS</span>${head(B, 'r')}</div>
      ${row('ポイント', A.points, B.points, num)}${row('達成数', A.count, B.count, num)}${row('達成率', rateOf(A), rateOf(B), pct)}
      <p class="muted cmpsame">達成の一致率 <b>${pct(same)}</b> <small>(共通 ${sets.both.length} ÷ どちらかが達成 ${union})</small></p>
      <h3 class="h3">カテゴリ別の達成率</h3>${catRows}
      <div class="seg" id="cmMode">${seg}</div>
      <div class="chips">${items || '<p class="empty">なし</p>'}</div>
    </div>`;
  }

  // ---------- 全体の描画 ----------
  function renderAll() {
    document.querySelectorAll('#tabs button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === st.v);
      b.setAttribute('aria-selected', String(b.dataset.v === st.v));
    });
    ['ach', 'rank', 'player', 'compare'].forEach((v) => { $('view-' + v).hidden = st.v !== v; });
    if (st.v === 'ach') { syncControls(); renderAch(); }
    else if (st.v === 'rank') { $('summary').textContent = `${totalPlayers} 人のプレイヤー`; renderRank(); }
    else if (st.v === 'compare') { $('summary').textContent = 'プレイヤーの比較'; renderCompare(); }
    else { $('summary').textContent = 'プレイヤー検索'; renderPlayer(); }
  }

  // ---------- 起動 ----------
  const toTop = $('toTop');
  const onScroll = () => toTop.classList.toggle('show', window.scrollY > 300);
  window.addEventListener('scroll', onScroll, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();

  // ---------- データの読み込み (失敗時はエラー画面と「再読み込み」ボタン) ----------
  class LoadError extends Error {}
  async function loadData() {
    if (navigator.onLine === false) throw new LoadError('インターネットに接続されていません。接続を確認してから「再読み込み」を押してください。');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    let r;
    try {
      r = await fetch('data/achievements.json', { cache: 'no-cache', signal: ctl.signal });
    } catch (e) {
      throw new LoadError(e && e.name === 'AbortError' ? '読み込みがタイムアウトしました (15秒)。時間をおいて再読み込みしてください。' : '通信に失敗しました。ネットワークを確認してください。');
    } finally { clearTimeout(timer); }
    if (!r.ok) throw new LoadError(`データファイルを取得できませんでした (HTTP ${r.status})。公開直後は数分かかることがあります。`);
    let d;
    try { d = await r.json(); } catch (e) { throw new LoadError('データファイルが壊れていて読み込めません (JSONの形式エラー)。管理者に連絡してください。'); }
    if (!d || !Array.isArray(d.categories) || d.categories.some((c) => !c || !Array.isArray(c.achievements))) {
      throw new LoadError('データの構造が想定と違います。管理者に連絡してください。');
    }
    return d;
  }

  function showError(msg) {
    ['ach', 'rank', 'player', 'compare'].forEach((v) => { $('view-' + v).hidden = true; });
    $('tabs').hidden = true;
    $('errMsg').textContent = msg;
    $('err').hidden = false;
    $('summary').textContent = '読み込みに失敗しました';
  }

  let bound = false;
  function init(d) {
    prepare(d);
    $('cat').innerHTML = '<option value="">すべてのカテゴリ</option>' +
      cats.map((c) => `<option value="${esc(c.id)}">${esc(c.id)} (${c.achievements.length})</option>`).join('');
    $('plist').innerHTML = [...players.keys()].sort().map((n) => `<option value="${esc(n)}">`).join('');
    let upd = '-';
    try { upd = new Date(d.updated).toLocaleString('ja-JP'); } catch (e) { /* noop */ }
    $('updated').textContent = upd; $('updatedTop').textContent = upd;

    parseHash();
    renderStats();
    if (!bound) { bound = true; bindEvents(); }
    renderAll();
  }

  async function start() {
    $('err').hidden = true;
    $('tabs').hidden = false;
    $('summary').textContent = '読み込み中…';
    let d;
    try { d = await loadData(); } catch (e) {
      showError(e instanceof LoadError ? e.message : '予期しないエラーが発生しました: ' + (e && e.message));
      return;
    }
    try { init(d); } catch (e) {
      showError('表示の準備中にエラーが発生しました: ' + (e && e.message));
    }
  }

  function bindEvents() {
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go({ v: b.dataset.v }); });
    let qt = null;   // 軽量化: 入力が止まってから検索する
    $('q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => go({ q: $('q').value }, false), 150); });
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) appendMore(); }, { rootMargin: '600px' });
      io.observe($('more'));
    }
    $('cat').addEventListener('input', () => go({ cat: $('cat').value }, false));
    $('sort').addEventListener('input', () => go({ sort: $('sort').value }, false));
    $('onlyMsg').addEventListener('click', () => go({ msg: !st.msg }, false));
    $('onlyPrefix').addEventListener('click', () => go({ pf: !st.pf }, false));
    $('onlyNew').addEventListener('click', () => go({ nw: !st.nw }, false));
    $('onlyFixed').addEventListener('click', () => go({ fx: !st.fx }, false));
    let ht = null;
    $('hl').addEventListener('input', () => { clearTimeout(ht); ht = setTimeout(() => go({ hl: $('hl').value.trim() }, false), 200); });
    $('catbars').addEventListener('click', (e) => { const b = e.target.closest('.catrow'); if (b) go({ cat: b.dataset.cat }, false); });
    $('rankMode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go({ rk: b.dataset.rk }, false); });
    $('pq').addEventListener('change', () => go({ p: $('pq').value.trim() }, false));
    $('pq').addEventListener('keydown', (e) => { if (e.key === 'Enter') go({ p: $('pq').value.trim() }, false); });
    const cmpSet = () => go({ a: $('ca').value.trim(), b: $('cb').value.trim() }, false);
    ['ca', 'cb'].forEach((id) => { $(id).addEventListener('change', cmpSet); $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') cmpSet(); }); });
    $('swap').addEventListener('click', () => go({ a: st.b, b: st.a }, false));
    $('cview').addEventListener('click', (e) => {
      const m = e.target.closest('[data-cm]'); if (m) return go({ cm: m.dataset.cm }, false);
      const h = e.target.closest('.cmphead'); if (h) return go({ v: 'player', p: h.dataset.p });
      const c = e.target.closest('.chip'); if (c && byId.has(c.dataset.id)) openDialog(byId.get(c.dataset.id));
    });
    $('pview').addEventListener('click', (e) => {
      const cb = e.target.closest('[data-cmp]'); if (cb) return go({ v: 'compare', a: cb.dataset.cmp, b: '' });
      const m = e.target.closest('[data-pl]'); if (m) return go({ pl: m.dataset.pl }, false);
      const c = e.target.closest('.chip'); if (c && byId.has(c.dataset.id)) openDialog(byId.get(c.dataset.id));
    });
    $('rank').addEventListener('click', (e) => { const r = e.target.closest('.rrow'); if (r) go({ v: 'player', p: r.dataset.p }); });
    const open = (e) => { const c = e.target.closest('.card'); if (c && byId.has(c.dataset.id)) openDialog(byId.get(c.dataset.id)); };
    $('list').addEventListener('click', open);
    $('list').addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    $('dlg-body').addEventListener('click', (e) => {
      const l = e.target.closest('.plink');
      if (l) { $('dlg').close(); go({ v: 'player', p: l.dataset.p }); window.scrollTo(0, 0); }
    });
    $('dlg-close').addEventListener('click', () => $('dlg').close());
    $('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) $('dlg').close(); });
    window.addEventListener('popstate', () => { parseHash(); renderAll(); });
    window.addEventListener('hashchange', () => { parseHash(); renderAll(); });
  }

  $('retry').addEventListener('click', start);
  start();
})();
