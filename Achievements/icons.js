// 達成率に応じたアイコン (オリジナルのピクセルアート。Minecraftのテクスチャそのものではありません)
//  100%: エンチャント付きネザライトブロック / 75%以上: ネザライトブロック
//  50%以上: ダイヤモンドブロック / それ以外: ダイヤモンド
(function (root) {
  function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const rect = (x, y, c, w, h) => `<rect x="${x}" y="${y}" width="${w || 1}" height="${h || 1}" fill="${c}"/>`;

  // ---- ダイヤモンド (アイテム) 16x16 ----
  const POLY = [[4, 2], [12, 2], [15, 6], [8, 14.5], [1, 6]];
  function inside(px, py) {
    let c = false;
    for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function diamondItem() {
    const OUT = '#14595a', W = '#e4fffc', L = '#85f5ea', M = '#34d3c6', D = '#1c9f98', DD = '#147d7b';
    const g = [];
    for (let y = 0; y < 16; y++) {
      g[y] = [];
      for (let x = 0; x < 16; x++) g[y][x] = inside(x + 0.5, y + 0.5);
    }
    let r = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!g[y][x]) continue;
        const edge = !(g[y - 1] && g[y - 1][x]) || !(g[y + 1] && g[y + 1][x]) || !g[y][x - 1] || !g[y][x + 1];
        let c;
        if (edge) c = OUT;
        else if (y <= 5) c = (x + y <= 9) ? L : (x >= 9 && y >= 4 ? M : L);   // 上面(クラウン)
        else if (y === 6) c = x < 8 ? M : D;
        else c = x < 8 ? M : D;   // 下側(パビリオン): 左が明るく右が暗い
        r += rect(x, y, c);
      }
    }
    // ハイライト
    r += rect(4, 3, W) + rect(5, 3, W) + rect(4, 4, W) + rect(7, 3, W) + rect(10, 5, L);
    return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  // ---- 石炭 (アイテム) 16x16 ----
  function coalItem() {
    const rows = [
      '................',
      '................',
      '.....######.....',
      '...##222233##...',
      '..#2223333444#..',
      '..#2233334444#..',
      '.#22233334444##.',
      '.#22333344444##.',
      '.#23333444455##.',
      '.#23334444555##.',
      '..#3334445555#..',
      '..#3344445555#..',
      '...##44455555#..',
      '.....#######....',
      '................',
      '................'];
    const OUT = '#0d0d10', C = { 1: '#3a3a40', 2: '#4a4a52', 3: '#34343a', 4: '#27272c', 5: '#1b1b20' };
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      r += rect(x, y, ch === '#' ? OUT : C[ch]);
    }));
    r += rect(5, 4, '#6b6b75') + rect(6, 4, '#55555e') + rect(5, 5, '#55555e') + rect(9, 7, '#4a4a53') + rect(10, 9, '#3f3f47') + rect(4, 8, '#6b6b75') + rect(8, 5, '#6b6b75') + rect(11, 6, '#5f5f69') + rect(7, 10, '#5f5f69') + rect(12, 10, '#4a4a53');
    return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  // ---- ブロック (アイソメトリック立方体) ----
  function texture(p, seed) {
    let r = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let c;
        const n = hash(x, y, seed);
        if (x === 0 || y === 0 || x === 7 || y === 7) c = p.edge[Math.floor(hash(x, y, seed + 9) * p.edge.length)];
        else if (p.pattern(x, y)) c = p.hi;
        else c = p.base[Math.floor(n * p.base.length)];
        r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
      }
    }
    return r;
  }
  const DIAMOND_BLOCK = {
    edge: ['#25a79c', '#2bb6aa'], hi: '#b9fff7', base: ['#3fdccf', '#35cfc2', '#4be6d9', '#2fc3b7'],
    pattern: (x, y) => (x + y === 6 || x + y === 8 || (x === 3 && y === 3) || (x === 4 && y === 4)),
  };
  const NETHERITE = {
    edge: ['#2a2427', '#312a2d'], hi: '#5f5559', base: ['#463e41', '#3f3639', '#4d4447', '#3a3235'],
    pattern: (x, y) => (x === 2 && y === 5) || (x === 5 && y === 2) || (x === 4 && y === 4) || (x === 3 && y === 3 && false),
  };

  function cube(p, seed, ench) {
    const top = '<g transform="matrix(0.875 -0.4375 0.875 0.4375 1 4.5)">' + texture(p, seed) + '</g>';
    const left = '<g transform="matrix(0.875 0.4375 0 0.875 1 4.5)">' + texture(p, seed + 1) + '</g>' +
      '<polygon points="1,4.5 8,8 8,15 1,11.5" fill="#000" opacity=".2"/>';
    const right = '<g transform="matrix(0.875 -0.4375 0 0.875 8 8)">' + texture(p, seed + 2) + '</g>' +
      '<polygon points="8,8 15,4.5 15,11.5 8,15" fill="#000" opacity=".38"/>';
    const hex = '8,1 15,4.5 15,11.5 8,15 1,11.5 1,4.5';
    const outline = `<polygon points="${hex}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".7" stroke-linejoin="round"/>`;
    let glint = '';
    if (ench) {
      glint = `<clipPath id="cubeclip"><polygon points="${hex}"/></clipPath>
        <g clip-path="url(#cubeclip)" class="glint"><g>
        <polygon points="-8,0 -5.5,0 4.5,16 2,16" fill="#c27bff" opacity=".5"/>
        <polygon points="-3,0 -2,0 8,16 7,16" fill="#ffb0ff" opacity=".4"/>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="26 0" dur="2.4s" repeatCount="indefinite"/></g>
        <rect x="0" y="0" width="16" height="16" fill="#8a3fd6" opacity=".16"/></g>`;
    }
    return `<svg viewBox="0 0 16 16" aria-hidden="true">${top}${left}${right}${glint}${outline}</svg>`;
  }

  const SVG = {
    coal: coalItem(),
    diamond: diamondItem(),
    diamondBlock: cube(DIAMOND_BLOCK, 3, false),
    netherite: cube(NETHERITE, 7, false),
    netheriteEnch: cube(NETHERITE, 7, true),
  };

  function kindFor(rate) {
    if (!(rate > 0)) return 'coal';   // 達成者0人 (達成率0%)
    if (rate >= 1) return 'netheriteEnch';
    if (rate >= 0.75) return 'netherite';
    if (rate >= 0.5) return 'diamondBlock';
    return 'diamond';
  }
  const LABEL = { coal: '石炭', netheriteEnch: 'エンチャント付きネザライトブロック', netherite: 'ネザライトブロック', diamondBlock: 'ダイヤモンドブロック', diamond: 'ダイヤモンド' };

  function rateIcon(rate) {
    const k = kindFor(rate);
    return `<span class="ricon${k === 'netheriteEnch' ? ' ench' : ''}" title="${LABEL[k]}">${SVG[k]}</span>`;
  }


  // ---- カテゴリ用アイコン (オリジナルのピクセルアート 16x16) ----
  const OUTC = '#1b1b1f';
  function grid() { return Array.from({ length: 16 }, () => Array(16).fill(null)); }
  function put(g, x, y, c) { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; }
  function fromRows(rows, pal) {
    const g = grid();
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(g, x, y, pal[ch]); }));
    return g;
  }
  function outline(g) {
    const o = g.map((r) => r.slice());
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (g[y][x]) continue;
      if ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || g[y][x - 1] || g[y][x + 1]) o[y][x] = OUTC;
    }
    return o;
  }
  function svgOf(g) {
    let r = '';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x]) r += rect(x, y, g[y][x]);
    return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  // ブロックの面 (全面を塗る)
  function blockFace(base, seed, deco) {
    const g = grid();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const n = hash(x, y, seed);
      let c = shade(base, 0.9 + n * 0.2);
      if (x === 0 || y === 0 || x === 15 || y === 15) c = shade(base, 0.62 + n * 0.1);
      g[y][x] = c;
    }
    if (deco) deco(g);
    return g;
  }
  const ps = (g, list, c) => list.forEach(([x, y]) => put(g, x, y, c));

  function commandBlock() {
    return blockFace('#c0803c', 11, (g) => {
      const a = '#f3cf8a', d = '#7d4a1d';
      ps(g, [[4, 4], [5, 5], [6, 6], [7, 7], [6, 8], [5, 9], [4, 10], [8, 4], [9, 5], [10, 6], [11, 7], [10, 8], [9, 9], [8, 10]], a);
      ps(g, [[3, 3], [3, 11], [12, 3], [12, 11]], d);
    });
  }
  function tnt() {
    return blockFace('#d6382c', 21, (g) => {
      for (let y = 5; y <= 11; y++) for (let x = 1; x <= 14; x++) g[y][x] = shade('#f2efe6', 0.95 + hash(x, y, 5) * 0.08);
      const k = '#2a2a2a';
      ps(g, [[2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9], [3, 10],
        [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10],
        [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9], [12, 10]], k);
    });
  }
  const limeConcrete = () => blockFace('#80c71f', 31);
    function redWool() {
    return blockFace('#a8282a', 51, (g) => {
      for (let y = 2; y < 15; y += 3) for (let x = 1 + (y % 2); x < 15; x += 4) { put(g, x, y, '#85191c'); put(g, x + 1, y, '#85191c'); }
      for (let y = 3; y < 15; y += 4) for (let x = 3; x < 15; x += 5) put(g, x, y, '#c63b3b');
    });
  }
  function cake() {
    return outline(fromRows([
      '................',
      '.......r........',
      '......rrr.......',
      '................',
      '..WWWWWWWWWWWW..',
      '.WWWWWWWWWWWWWW.',
      '.WWWpWWWWWWpWWW.',
      '.CCCCCCCCCCCCCC.',
      '.CCrrrCCCCCrrrC.',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWWWWWWWWWW.',
      '.DDDDDDDDDDDDDD.',
      '................',
      '................'], { W: '#f6f1ea', p: '#ee8fb0', C: '#e9d8b8', r: '#d83a4a', B: '#8a5530', D: '#d9cfc2' }));
  }
  function goldHelmet() {
    return outline(fromRows([
      '................',
      '....GGGGGGGG....',
      '...GLLLGGGGGG...',
      '..GLLGGGGGGGGG..',
      '..GLGGGGGGGGGG..',
      '..GGGGGGGGGGGD..',
      '..GGGGGGGGGGGD..',
      '..GGGGGGGGGGGD..',
      '..GGGD....DGGD..',
      '..GGD......DGD..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'], { G: '#f5c93a', L: '#fff1a0', D: '#c58a12' }));
  }
  function bow() {
    const g = grid();
    for (let y = 1; y <= 14; y++) {
      const x = Math.round(5 + Math.sqrt(Math.max(0, 49 - (y - 7.5) * (y - 7.5))));
      put(g, x, y, '#8a5a2b'); put(g, x - 1, y, '#a8743a');
    }
    for (let y = 2; y <= 13; y++) put(g, 5, y, '#e8e8e8');
    put(g, 5, 1, '#e8e8e8'); put(g, 5, 14, '#e8e8e8');
    return outline(g);
  }
  function sword(a, b, guard, handle) {
    const g = grid();
    for (let i = 0; i <= 9; i++) { put(g, 5 + i, 10 - i, a); put(g, 6 + i, 10 - i, b); }
    put(g, 15, 1, null);
    for (let k = -2; k <= 2; k++) { put(g, 5 + k, 11 + k, guard); put(g, 6 + k, 11 + k, shade(guard, 0.8)); }
    for (let j = 1; j <= 3; j++) { put(g, 5 - j, 11 + j, handle); put(g, 6 - j, 11 + j, shade(handle, 0.8)); }
    return outline(g);
  }
  const ironSword = () => sword('#f0f4f5', '#b9c4c9', '#6d4a2a', '#5a3b1f');
  const woodSword = () => sword('#b78a52', '#8f6a3a', '#5a3b1f', '#4a2f17');
  function diamondPickaxe() {
    const g = grid();
    for (let i = 0; i <= 10; i++) { put(g, 2 + i, 13 - i, '#8a5a2b'); put(g, 3 + i, 13 - i, '#6b4420'); }
    const D = '#3fe0d2', L = '#b8fff6', M = '#22a99e';
    [[6, 2], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 2], [13, 3], [14, 4], [14, 5]].forEach(([x, y]) => put(g, x, y, D));
    [[5, 3], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 3], [13, 4], [13, 5]].forEach(([x, y]) => put(g, x, y, M));
    [[7, 1], [8, 1], [6, 2], [7, 2]].forEach(([x, y]) => put(g, x, y, L));
    [[4, 4], [5, 4]].forEach(([x, y]) => put(g, x, y, M));
    return outline(g);
  }
  function diamondShovel() {
    const g = grid();
    for (let i = 0; i <= 9; i++) { put(g, 2 + i, 13 - i, '#8a5a2b'); put(g, 3 + i, 13 - i, '#6b4420'); }
    for (let y = 0; y < 8; y++) for (let x = 7; x < 16; x++) {
      if (Math.abs(x - 11.5) + Math.abs(y - 3.5) <= 3.6) put(g, x, y, (x + y) % 4 === 0 ? '#b8fff6' : (x > 11 ? '#22a99e' : '#3fe0d2'));
    }
    return outline(g);
  }
  function lightningRod() {
    const C = '#cf7142', L = '#f0a874', D = '#8f4429';
    return outline(fromRows([
      '................',
      '......LCCD......',
      '......LCCD......',
      '.......LD.......',
      '.......LD.......',
      '.......LD.......',
      '.......CD.......',
      '.......CD.......',
      '.......CD.......',
      '.......CD.......',
      '.......CD.......',
      '.......CD.......',
      '.......CD.......',
      '......LCCD......',
      '......LCCD......',
      '................'], { C, L, D }));
  }
  function stringIcon() {
    const g = grid();
    const W = '#f6f6f6', G = '#aebcbc', S = '#3d5658';
    const P = [
      // 上のカール
      [10, 1, W], [9, 2, W], [11, 2, W], [9, 3, W], [10, 3, W], [10, 4, W], [11, 5, W], [11, 6, W],
      // 左の糸の端
      [2, 4, W], [3, 4, W], [4, 5, W], [3, 6, W], [2, 6, W], [1, 7, W], [1, 8, G], [2, 9, W],
      // 中央の絡まった輪
      [6, 7, W], [7, 7, W], [8, 7, W], [9, 7, G], [10, 7, W], [5, 8, W], [10, 8, W], [11, 8, G],
      [4, 9, W], [5, 9, G], [7, 9, W], [8, 9, W], [9, 9, W], [11, 9, G], [12, 9, G],
      [3, 10, W], [4, 10, G], [6, 10, G], [9, 10, G], [10, 10, G], [12, 10, S], [13, 10, S],
      [3, 11, G], [4, 11, S], [5, 11, S], [6, 11, W], [7, 11, W], [8, 11, W], [9, 11, S], [10, 11, S], [11, 11, S], [12, 11, S],
      [4, 12, S], [5, 12, S], [6, 12, S], [7, 12, S], [8, 12, S], [9, 12, S], [10, 12, S],
    ];
    P.forEach(([x, y, c]) => put(g, x, y, c));
    return outline(g);
  }
  function rabbit() {
    return outline(fromRows([
      '................',
      '...EE......EE...',
      '...EP......PE...',
      '...EP......PE...',
      '...EP......PE...',
      '...EEHHHHHHEE...',
      '..HHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHH.',
      '.HHKKHHHHHHKKHH.',
      '.HHKKHHHHHHKKHH.',
      '.HHHHHHNNHHHHHH.',
      '.HHHHHHRRHHHHHH.',
      '.HHHHRRHHRRHHHH.',
      '..HHHHHHHHHHHH..',
      '...DDDDDDDDDD...',
      '................'], { E: '#a07a52', P: '#e9a0a8', H: '#c9a273', K: '#2a1a14', N: '#e0707a', R: '#b8332f', D: '#a07a52' }));
  }
  function fireCharge() {
    const g = grid();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 5.6) continue;
      const n = hash(x, y, 61);
      g[y][x] = n < 0.18 ? '#4a2a1a' : n < 0.45 ? '#c8421a' : n < 0.8 ? '#ff7a1a' : '#ffc83a';
    }
    return outline(g);
  }
  function feather() {
    const g = grid();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const u = x - y, v = x + y - 15;
      if (Math.abs(u) > 11) continue;
      const w = Math.round(3.2 * Math.sqrt(Math.max(0, 1 - (u / 12) * (u / 12))));
      if (v === 0) g[y][x] = '#b5b5bd';
      else if (Math.abs(v) <= w) g[y][x] = v < 0 ? '#ffffff' : '#dcdce4';
    }
    for (let i = 0; i < 3; i++) put(g, 1 + i, 14 - i + 1, '#b5b5bd');
    return outline(g);
  }
  function compass() {
    const g = grid();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.6) continue;
      g[y][x] = d > 5.3 ? (hash(x, y, 71) < 0.5 ? '#9a9aa2' : '#85858d') : '#3b3b44';
    }
    for (let i = 0; i <= 4; i++) { put(g, 8 + i - 1, 7 - i + 1, '#e23a3a'); put(g, 7 - i + 1, 8 + i - 1, '#e9e9ef'); }
    put(g, 7, 8, '#f4d03f'); put(g, 8, 7, '#f4d03f');
    return outline(g);
  }

  const CAT = {
    Test: commandBlock, Main: cake, Tag: tnt, Aurena: ironSword, King: goldHelmet, Yumikkoku: bow,
    BP: limeConcrete, Copy: diamondPickaxe, Dauso: lightningRod, BGA: stringIcon, Guess: rabbit,
    WW: redWool, Hunter: woodSword, Dodge: fireCharge, Auau: feather, Spleef: diamondShovel, Button: compass,
  };
  const CAT_LABEL = { Test: 'コマンドブロック', Main: 'ケーキ', Tag: 'TNT', Aurena: '鉄の剣', King: '金のヘルメット', Yumikkoku: '弓', BP: '黄緑色のコンクリート', Copy: 'ダイヤモンドのピッケル', Dauso: '避雷針', BGA: '糸', Guess: 'ウサギ', WW: '赤色の羊毛', Hunter: '木の剣', Dodge: 'ファイヤーチャージ', Auau: '羽', Spleef: 'ダイヤモンドのシャベル', Button: 'コンパス' };
  // プレイヤーのスキン(顔)をアイコンにするカテゴリ
  const CAT_SKIN = { Hagepin: 'ikoko1', Hages: 'ikoko1', Akinige: 'hijikaramorotofu' };
  const catCache = {};
  function catIcon(id) {
    if (!Object.prototype.hasOwnProperty.call(CAT, id)) return '';
    if (!catCache[id]) catCache[id] = `<span class="ricon cicon" title="${CAT_LABEL[id]}">${svgOf(CAT[id]())}</span>`;
    return catCache[id];
  }

  const api = { rateIcon, kindFor, SVG, catIcon, CAT_SKIN, CAT_IDS: Object.keys(CAT) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Icons = api;
})(typeof window !== 'undefined' ? window : globalThis);
