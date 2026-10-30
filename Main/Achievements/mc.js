// Minecraft のカラーコード (&a, §a, <#rrggbb>, &#rrggbb, §x§r§r§g§g§b§b) を HTML に変換する
(function (root) {
  const COLORS = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
    '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
    'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
  };

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mcToHtml(input) {
    if (input == null) return '';
    let s = String(input).replace(/§/g, '&');
    // &x&r&r&g&g&b&b → <#rrggbb>
    s = s.replace(/&x((?:&[0-9a-fA-F]){6})/gi, (_, m) => '<#' + m.replace(/&/g, '') + '>');
    s = s.replace(/&#([0-9a-fA-F]{6})/g, '<#$1>');

    const tokens = [];
    const re = /<#([0-9a-fA-F]{6})>|&([0-9a-fk-orA-FK-OR])/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) tokens.push({ t: 'text', v: s.slice(last, m.index) });
      if (m[1]) tokens.push({ t: 'color', v: '#' + m[1] });
      else tokens.push({ t: 'code', v: m[2].toLowerCase() });
      last = re.lastIndex;
    }
    if (last < s.length) tokens.push({ t: 'text', v: s.slice(last) });

    let color = null, fmt = {};
    let out = '';
    for (const tk of tokens) {
      if (tk.t === 'color') { color = tk.v; fmt = {}; continue; }
      if (tk.t === 'code') {
        const c = tk.v;
        if (COLORS[c]) { color = COLORS[c]; fmt = {}; }
        else if (c === 'r') { color = null; fmt = {}; }
        else fmt[c] = true;
        continue;
      }
      if (!tk.v) continue;
      const cls = [];
      if (fmt.l) cls.push('mc-b');
      if (fmt.o) cls.push('mc-i');
      if (fmt.n) cls.push('mc-u');
      if (fmt.m) cls.push('mc-s');
      if (fmt.k) cls.push('mc-k');
      const style = color ? ` style="color:${color}"` : '';
      const text = esc(tk.v).replace(/\n/g, '<br>');
      out += (style || cls.length)
        ? `<span${cls.length ? ` class="${cls.join(' ')}"` : ''}${style}>${text}</span>`
        : text;
    }
    return out;
  }

  // 検索用に色コードを取り除く
  function stripCodes(input) {
    return String(input == null ? '' : input).replace(/§/g, '&')
      .replace(/&x(?:&[0-9a-fA-F]){6}/gi, '')
      .replace(/&#[0-9a-fA-F]{6}|<#[0-9a-fA-F]{6}>|&[0-9a-fk-orA-FK-OR]/g, '');
  }

  const api = { mcToHtml, stripCodes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MC = api;
})(typeof window !== 'undefined' ? window : globalThis);
