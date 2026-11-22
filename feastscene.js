/* Feast scene for the Food diary: a room, a table and a shelf for each province, with the dishes you have found drawn on them.
 * FEAST.scene(rid, items, page) lays the dishes out (items: stops with .zh .id .kind .sp) and returns SVG text, the page count and what is on show.
 * This file holds the drawing kit and the layout; the rooms themselves are in feastthemes*.js. No screen code here. */
(function (root) {
  const FE = (typeof module !== 'undefined' && module.exports) ? require('./feastart.js') : root.FEAST;
  const R = (x, y, w, h, f, x2) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const C = (x, y, r, f, x2) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const E = (x, y, rx, ry, f, x2) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const Pg = (d, f, x2) => '<path d="' + d + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const L = (d, s, w, x2) => '<path d="' + d + '" fill="none" stroke="' + s + '" stroke-width="' + (w || 2) + '" ' + (x2 || '') + '/>';
  const T = (x, y, t, o) => '<text x="' + x + '" y="' + y + '" ' + (o || '') + '>' + t + '</text>';
  const OL = '#3a2a22', N = 'stroke="none"';
  let uid = 0;
  const id = (p) => (p || 'f') + (++uid);
  const rep = (n, f) => { let s = ''; for (let i = 0; i < n; i++) s += f(i); return s; };

  // ---------- fabrics and floors (all return SVG with their own pattern) ----------
  function fab(kind, c1, c2, c3) {
    const i = id('fb'); let body;
    if (kind === 'check') body = '<pattern id="' + i + '" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="' + c1 + '"/><rect width="12" height="12" fill="' + c2 + '"/><rect x="12" y="12" width="12" height="12" fill="' + c2 + '"/></pattern>';
    else if (kind === 'stripe') body = '<pattern id="' + i + '" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="' + c1 + '"/><rect width="8" height="16" fill="' + c2 + '"/></pattern>';
    else if (kind === 'diamond') body = '<pattern id="' + i + '" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="' + c1 + '"/><path d="M13 2L24 13L13 24L2 13Z" fill="' + c2 + '"/><circle cx="13" cy="13" r="3" fill="' + (c3 || c1) + '"/></pattern>';
    else if (kind === 'dots') body = '<pattern id="' + i + '" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="' + c1 + '"/><circle cx="5" cy="5" r="3" fill="' + c2 + '"/><circle cx="15" cy="15" r="3" fill="' + (c3 || c2) + '"/></pattern>';
    else if (kind === 'mosaic') body = '<pattern id="' + i + '" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="' + c1 + '"/><rect x="2" y="2" width="12" height="12" fill="' + c2 + '"/><rect x="16" y="2" width="12" height="12" fill="' + (c3 || c2) + '"/><rect x="2" y="16" width="12" height="12" fill="' + (c3 || c2) + '"/><rect x="16" y="16" width="12" height="12" fill="' + c2 + '"/></pattern>';
    else if (kind === 'wave') body = '<pattern id="' + i + '" width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="' + c1 + '"/><path d="M0 8Q8 0 16 8T32 8V16H0Z" fill="' + c2 + '"/></pattern>';
    else if (kind === 'tile') body = '<pattern id="' + i + '" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="' + c1 + '"/><path d="M0 0H22V22" fill="none" stroke="' + c2 + '" stroke-width="1.4"/></pattern>';
    else if (kind === 'azulejo') body = '<pattern id="' + i + '" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="' + c1 + '"/><path d="M14 2C20 8 20 20 14 26C8 20 8 8 14 2Z" fill="none" stroke="' + c2 + '" stroke-width="2"/><circle cx="14" cy="14" r="3.5" fill="' + c2 + '"/><path d="M0 0L5 5M28 0L23 5M0 28L5 23M28 28L23 23" stroke="' + c2 + '" stroke-width="2"/></pattern>';
    else if (kind === 'brick') body = '<pattern id="' + i + '" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="' + c1 + '"/><path d="M0 10H40M20 0V10M0 10V20M40 10V20" stroke="' + c2 + '" stroke-width="2" fill="none"/></pattern>';
    else if (kind === 'plank') body = '<pattern id="' + i + '" width="60" height="22" patternUnits="userSpaceOnUse"><rect width="60" height="22" fill="' + c1 + '"/><path d="M0 21H60M30 0V21" stroke="' + c2 + '" stroke-width="1.6" fill="none"/></pattern>';
    else if (kind === 'weave') body = '<pattern id="' + i + '" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="' + c1 + '"/><path d="M0 7H14M7 0V14" stroke="' + c2 + '" stroke-width="2"/><path d="M0 0L14 14" stroke="' + (c3 || c2) + '" stroke-width=".8"/></pattern>';
    else body = '<pattern id="' + i + '" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="' + c1 + '"/></pattern>';
    return { id: i, defs: '<defs>' + body + '</defs>', fill: 'url(#' + i + ')' };
  }
  let floorY = null;   // where the floor starts in the room being drawn, so the shared lighting can follow it
  const floor = (y0, kind, c1, c2, c3) => { const f = fab(kind, c1, c2, c3); if (floorY == null) floorY = y0; return f.defs + R(0, y0, 680, 440 - y0, f.fill); };
  const wall = (y0, y1, kind, c1, c2, c3) => { const f = fab(kind, c1, c2, c3); return f.defs + R(0, y0, 680, y1 - y0, f.fill); };

  // ---------- views through a window or beyond a rail: (x, y, w, h) -> SVG ----------
  const V = {
    sky: (x, y, w, h, a, b) => { const g = id('sk'); return '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' + R(x, y, w, h, 'url(#' + g + ')'); },
    mount: (x, y, w, h, c1, c2, sky) => V.sky(x, y, w, h, sky || '#CFE6F0', '#F1F5EE') + Pg('M' + x + ' ' + (y + h) + 'L' + (x + w * .2) + ' ' + (y + h * .35) + 'L' + (x + w * .42) + ' ' + (y + h * .7) + 'L' + (x + w * .65) + ' ' + (y + h * .25) + 'L' + (x + w) + ' ' + (y + h * .65) + 'V' + (y + h) + 'Z', c1) + Pg('M' + x + ' ' + (y + h) + 'Q' + (x + w * .3) + ' ' + (y + h * .6) + ' ' + (x + w * .6) + ' ' + (y + h * .8) + 'T' + (x + w) + ' ' + (y + h * .75) + 'V' + (y + h) + 'Z', c2),
    karst: (x, y, w, h) => V.sky(x, y, w, h, '#D9ECE6', '#F3F6EC') + [.15, .4, .62, .85].map((f, i) => Pg('M' + (x + w * f - 22) + ' ' + (y + h) + 'Q' + (x + w * f - 14) + ' ' + (y + h * (.2 + i % 2 * .18)) + ' ' + (x + w * f) + ' ' + (y + h * (.12 + i % 2 * .2)) + 'Q' + (x + w * f + 14) + ' ' + (y + h * (.3 + i % 2 * .1)) + ' ' + (x + w * f + 24) + ' ' + (y + h) + 'Z', i % 2 ? '#7FA58A' : '#5E8F76')).join('') + R(x, y + h * .82, w, h * .18, '#A9CBD0') + L('M' + x + ' ' + (y + h * .9) + 'q10 -4 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0', '#fff', 1.4, 'opacity=".6"'),
    sea: (x, y, w, h, tone) => V.sky(x, y, w, h * .55, '#BFE3F2', '#E9F6F8') + R(x, y + h * .5, w, h * .5, tone || '#4FA8C8') + L('M' + x + ' ' + (y + h * .7) + 'q10 -5 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0', '#fff', 1.6, 'opacity=".6"') + C(x + w * .78, y + h * .22, h * .09, '#FFE9A8'),
    palms: (x, y, w, h) => V.sea(x, y, w, h) + [.2, .78].map((f, i) => L('M' + (x + w * f) + ' ' + (y + h) + 'Q' + (x + w * f + (i ? -8 : 8)) + ' ' + (y + h * .5) + ' ' + (x + w * f + (i ? -4 : 4)) + ' ' + (y + h * .25), '#6B4A2A', 3.4) + [-34, -14, 10, 30].map(a => Pg('M' + (x + w * f + (i ? -4 : 4)) + ' ' + (y + h * .25) + 'q' + a + ' -12 ' + (a * 1.4) + ' ' + (4 + Math.abs(a) * .2), 'none', 'stroke="#3E8A4A" stroke-width="3.4" stroke-linecap="round"')).join('')).join(''),
    dunes: (x, y, w, h) => V.sky(x, y, w, h, '#F6D9A8', '#FBE9C8') + C(x + w * .72, y + h * .3, h * .12, '#FFF4D0') + Pg('M' + x + ' ' + (y + h) + 'Q' + (x + w * .3) + ' ' + (y + h * .45) + ' ' + (x + w * .6) + ' ' + (y + h * .8) + 'T' + (x + w) + ' ' + (y + h * .6) + 'V' + (y + h) + 'Z', '#E3B070') + Pg('M' + x + ' ' + (y + h) + 'Q' + (x + w * .4) + ' ' + (y + h * .72) + ' ' + (x + w) + ' ' + (y + h * .9) + 'V' + (y + h) + 'Z', '#C98A45') + (h > 60 ? Pg('M' + (x + w * .5) + ' ' + (y + h * .68) + 'q3 -10 7 -2l3 -12q2 -3 4 0l-1 12q8 -2 8 4v8h-3v-6h-6v6h-3v-6h-6v6h-3Z', '#7A4A24') : ''),
    snow: (x, y, w, h) => V.sky(x, y, w, h, '#C9D8E6', '#EAF1F6') + [.1, .35, .6, .85].map((f, i) => Pg('M' + (x + w * f - 26) + ' ' + (y + h) + 'L' + (x + w * f) + ' ' + (y + h * (.25 + i % 2 * .2)) + 'L' + (x + w * f + 26) + ' ' + (y + h) + 'Z', '#F8FBFD')).join('') + R(x, y + h * .85, w, h * .15, '#fff') + rep(12, i => C(x + (i * 37) % w, y + (i * 23) % (h * .8), 1.6, '#fff', 'opacity=".9"')),
    skyline: (x, y, w, h, tone, night) => V.sky(x, y, w, h, night ? '#1F2A4A' : '#BFD8EA', night ? '#5A4A7A' : '#EAF2F6') + rep(9, i => { const bw = 18 + (i * 7) % 14, bh = h * (.3 + ((i * 37) % 50) / 100); return R(x + 4 + i * (w / 9), y + h - bh, bw, bh, tone || (night ? '#2A3A5A' : '#8FA8BC')) + (night ? rep(3, j => R(x + 8 + i * (w / 9), y + h - bh + 6 + j * 10, 4, 4, '#F6D878', 'stroke="none"')) : ''); }),
    garden: (x, y, w, h) => V.sky(x, y, w, h, '#DDEFE0', '#F2F6E8') + Pg('M' + x + ' ' + (y + h) + 'Q' + (x + w * .3) + ' ' + (y + h * .5) + ' ' + (x + w * .5) + ' ' + (y + h * .7) + 'T' + (x + w) + ' ' + (y + h * .55) + 'V' + (y + h) + 'Z', '#8FB87A') + L('M' + (x + w * .7) + ' ' + (y + h) + 'V' + (y + h * .4), '#6B4A2A', 4) + E(x + w * .7, y + h * .35, w * .22, h * .22, '#5E9A5A') + E(x + w * .62, y + h * .42, w * .14, h * .14, '#7FB06A') + Pg('M' + (x + w * .1) + ' ' + (y + h) + 'Q' + (x + w * .14) + ' ' + (y + h * .55) + ' ' + (x + w * .22) + ' ' + (y + h * .6) + 'Q' + (x + w * .26) + ' ' + (y + h * .8) + ' ' + (x + w * .3) + ' ' + (y + h) + 'Z', '#9AA6A0'),
    lake: (x, y, w, h) => V.mount(x, y, w, h * .6, '#7FA58A', '#9CC0A0') + R(x, y + h * .55, w, h * .45, '#7FBBC8') + L('M' + x + ' ' + (y + h * .75) + 'q12 -5 24 0t24 0t24 0t24 0t24 0t24 0', '#fff', 1.4, 'opacity=".55"') + Pg('M' + (x + w * .3) + ' ' + (y + h * .78) + 'h' + (w * .22) + 'l-5 7h-' + (w * .2) + 'Z', '#5A3A24') + R(x + w * .36, y + h * .66, 3, h * .12, '#5A3A24'),
    wallgreat: (x, y, w, h) => V.mount(x, y, w, h, '#8FA586', '#A8B896', '#C8DCEC') + Pg('M' + x + ' ' + (y + h * .7) + 'L' + (x + w * .3) + ' ' + (y + h * .45) + 'L' + (x + w * .6) + ' ' + (y + h * .5) + 'L' + (x + w) + ' ' + (y + h * .3) + 'V' + (y + h * .42) + 'L' + (x + w * .6) + ' ' + (y + h * .62) + 'L' + (x + w * .3) + ' ' + (y + h * .58) + 'L' + x + ' ' + (y + h * .82) + 'Z', '#B8A688') + rep(7, i => R(x + w * (.06 + i * .13), y + h * (.38 + (i % 3) * -.04 + .08 * (i > 3 ? -1.4 : 0)), 5, 5, '#B8A688', N)),
    terraces: (x, y, w, h) => V.sky(x, y, w, h * .5, '#D6EAF2', '#F4F6EE') + rep(5, i => Pg('M' + x + ' ' + (y + h * (.45 + i * .12)) + 'Q' + (x + w * .5) + ' ' + (y + h * (.32 + i * .12)) + ' ' + (x + w) + ' ' + (y + h * (.45 + i * .12)) + 'V' + (y + h) + 'H' + x + 'Z', i % 2 ? '#8FBB6A' : '#B8D07A')),
    field: (x, y, w, h, c1) => V.mount(x, y, w, h * .5, '#7A9AB8', '#9CB4C8') + R(x, y + h * .5, w, h * .5, c1 || '#F2C94A') + rep(6, i => L('M' + (x + i * w / 6) + ' ' + (y + h) + 'L' + (x + w * .5 + (i - 2.5) * 6) + ' ' + (y + h * .5), '#D9A82A', 1.4, 'opacity=".7"')),
    night: (x, y, w, h) => V.sky(x, y, w, h, '#14193A', '#3A2A5A') + rep(10, i => C(x + (i * 53) % w, y + (i * 31) % (h * .6), 1.4, '#FFF4C0')),
    plain: (x, y, w, h, c) => R(x, y, w, h, c || '#CFE6F0')
  };

  // ---------- windows and openings ----------
  // o: {shape:'rect'|'arch'|'round'|'moon'|'hex', frame, fw (frame width), view:(x,y,w,h)=>svg, lat:'grid'|'diamond'|'none', latc, n}
  let wins = [];   // the windows of the room being drawn, so daylight can fall through them
  function win(x, y, w, h, o) {
    o = o || {}; wins.push({ x, y, w, h }); const cid = id('cp'), fw = o.fw || 6, fr = o.frame || '#6B4423', sh = o.shape || 'rect';
    let clip, outline;
    if (sh === 'arch') { const r = w / 2; clip = 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z'; }
    else if (sh === 'round') { clip = 'M' + (x + w / 2) + ' ' + y + 'A' + (w / 2) + ' ' + (h / 2) + ' 0 1 1 ' + (x + w / 2) + ' ' + (y + h) + 'A' + (w / 2) + ' ' + (h / 2) + ' 0 1 1 ' + (x + w / 2) + ' ' + y + 'Z'; }
    else if (sh === 'hex') { const k = w * .28; clip = 'M' + (x + k) + ' ' + y + 'H' + (x + w - k) + 'L' + (x + w) + ' ' + (y + h / 2) + 'L' + (x + w - k) + ' ' + (y + h) + 'H' + (x + k) + 'L' + x + ' ' + (y + h / 2) + 'Z'; }
    else clip = 'M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z';
    let s = '<defs><clipPath id="' + cid + '"><path d="' + clip + '"/></clipPath></defs>';
    s += Pg(clip, fr, 'stroke="' + fr + '" stroke-width="' + (fw * 2) + '" stroke-linejoin="round"');
    s += '<g clip-path="url(#' + cid + ')">' + (o.view ? o.view(x, y, w, h) : V.plain(x, y, w, h, o.glass)) ;
    const lc = o.latc || fr, n = o.n || 5;
    if (o.lat === 'grid') { let g = ''; for (let i = 1; i < n; i++) g += L('M' + (x + i * w / n) + ' ' + y + 'V' + (y + h), lc, o.lw || 2.6); const m = Math.max(2, Math.round(n * h / w)); for (let j = 1; j < m; j++) g += L('M' + x + ' ' + (y + j * h / m) + 'H' + (x + w), lc, o.lw || 2.6); s += g; }
    if (o.lat === 'diamond') { let g = ''; const st = w / n; for (let i = -n; i < n * 2; i++) { g += L('M' + (x + i * st) + ' ' + y + 'l' + (h) + ' ' + h, lc, 2) + L('M' + (x + i * st) + ' ' + (y + h) + 'l' + (h) + ' ' + (-h), lc, 2); } s += g; }
    if (o.lat === 'cross') s += L('M' + (x + w / 2) + ' ' + y + 'V' + (y + h) + 'M' + x + ' ' + (y + h / 2) + 'H' + (x + w), lc, o.lw || 4);
    s += '</g>';
    s += Pg(clip, 'none', 'stroke="' + fr + '" stroke-width="' + fw + '" stroke-linejoin="round"');
    if (o.sill !== false && sh !== 'round') s += R(x - fw - 3, y + h + fw - 1, w + fw * 2 + 6, 6, o.sillc || fr);
    return s;
  }

  // ---------- hanging things and wall decor ----------
  const lantern = (x, y, r, col, gold, str) => E(x, y + r * 1.1, r * 3.4, r * 3.4, 'url(#fzglow)', 'opacity=".75" stroke="none"') + L('M' + x + ' 0V' + y, str || '#3b2a22', 1.5) + R(x - r * .45, y, r * .9, 5, gold) + E(x, y + r * 1.05 + 5, r, r * 1.1, col) + L('M' + x + ' ' + (y + 5) + 'V' + (y + r * 2.1 + 5), gold, 1, 'opacity=".6"') + E(x, y + r * 1.05 + 5, r * .5, r * 1.1, 'none', 'stroke="' + gold + '" stroke-width="1" opacity=".6"') + R(x - r * .35, y + r * 2.1 + 5, r * .7, 4, gold) + L('M' + x + ' ' + (y + r * 2.1 + 9) + 'v14', gold, 1.4) + C(x, y + r * 2.1 + 25, 2.2, gold);
  const chili = (x, y, n) => { let s = L('M' + x + ' 0V' + y, '#3b2a22', 1.5); for (let i = 0; i < n; i++) { const yy = y * .35 + i * ((y * .65) / n); s += E(x - 5, yy + 8, 4, 9, '#D2392B', 'transform="rotate(14 ' + (x - 5) + ' ' + (yy + 8) + ')"') + E(x + 5, yy + 14, 4, 9, '#B72A20', 'transform="rotate(-14 ' + (x + 5) + ' ' + (yy + 14) + ')"'); } return s; };
  const scroll = (x, y, w, h, bg, ink, kind) => R(x - 3, y - 6, w + 6, 8, '#3a2a22') + R(x, y, w, h, bg, 'stroke="#6B4423" stroke-width="1.2"') + R(x - 3, y + h - 2, w + 6, 8, '#3a2a22') + (kind === 'bamboo' ? L('M' + (x + w * .3) + ' ' + (y + h - 6) + 'V' + (y + 10) + 'M' + (x + w * .55) + ' ' + (y + h - 6) + 'V' + (y + 18) + 'M' + (x + w * .78) + ' ' + (y + h - 6) + 'V' + (y + 8), ink, 2.4) : kind === 'peak' ? Pg('M' + (x + 4) + ' ' + (y + h - 6) + 'L' + (x + w * .35) + ' ' + (y + h * .35) + 'L' + (x + w * .5) + ' ' + (y + h * .6) + 'L' + (x + w * .7) + ' ' + (y + h * .25) + 'L' + (x + w - 4) + ' ' + (y + h - 6) + 'Z', ink, 'opacity=".75"') : kind === 'char' ? L('M' + (x + w * .25) + ' ' + (y + h * .25) + 'h' + (w * .5) + 'M' + (x + w * .5) + ' ' + (y + h * .25) + 'V' + (y + h * .8) + 'M' + (x + w * .22) + ' ' + (y + h * .5) + 'h' + (w * .56) + 'M' + (x + w * .3) + ' ' + (y + h * .8) + 'h' + (w * .4), ink, 4, 'stroke-linecap="round"') : L('M' + (x + w * .3) + ' ' + (y + h * .8) + 'Q' + (x + w * .2) + ' ' + (y + h * .4) + ' ' + (x + w * .5) + ' ' + (y + h * .3) + 'T' + (x + w * .7) + ' ' + (y + h * .75), ink, 3.4, 'stroke-linecap="round"'));
  const pillar = (x, w, y0, y1, c, cap) => R(x, y0, w, y1 - y0, c) + R(x - 5, y0, w + 10, 12, cap || c) + R(x - 4, y1 - 14, w + 8, 14, 'rgba(0,0,0,.25)', N) + L('M' + (x + w * .22) + ' ' + (y0 + 14) + 'V' + (y1 - 14), 'rgba(255,255,255,.22)', 3);
  const beam = (y, h, c, c2) => R(0, y, 680, h, c) + rep(9, i => R(i * 80 + 8, y, 8, h, c2 || 'rgba(0,0,0,.2)', 'stroke="none"'));
  const jar = (x, y, s, c, lid) => Pg('M' + (x - 14 * s) + ' ' + y + 'Q' + (x - 20 * s) + ' ' + (y - 16 * s) + ' ' + (x - 12 * s) + ' ' + (y - 28 * s) + 'H' + (x + 12 * s) + 'Q' + (x + 20 * s) + ' ' + (y - 16 * s) + ' ' + (x + 14 * s) + ' ' + y + 'Z', c, 'stroke="rgba(0,0,0,.35)" stroke-width="1.4"') + R(x - 11 * s, y - 33 * s, 22 * s, 6 * s, lid || '#2a1a12') + R(x - 9 * s, y - 20 * s, 18 * s, 9 * s, 'rgba(244,235,216,.85)', N);
  const bottleRow = (x, y, n, cols) => rep(n, i => R(x + i * 12, y - 34, 8, 34, cols[i % cols.length], 'rx="2"') + R(x + i * 12 + 2, y - 44, 4, 11, cols[i % cols.length]));
  const prayerFlags = (x0, y0, x1, y1, n) => { let s = L('M' + x0 + ' ' + y0 + 'Q' + (x0 + x1) / 2 + ' ' + (Math.max(y0, y1) + 16) + ' ' + x1 + ' ' + y1, '#3b2a22', 1.4); const cols = ['#2F6FB5', '#F4F1EA', '#D2392B', '#3E9A5A', '#F2C23E']; for (let i = 0; i < n; i++) { const t = (i + .5) / n, px = x0 + (x1 - x0) * t, py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (Math.max(y0, y1) + 16) + t * t * y1; s += R(px - 5, py, 10, 12, cols[i % 5], 'stroke="rgba(0,0,0,.25)" stroke-width=".8"'); } return s; };
  const stringLights = (x0, y0, x1, y1, n, col) => { let s = L('M' + x0 + ' ' + y0 + 'Q' + (x0 + x1) / 2 + ' ' + (Math.max(y0, y1) + 18) + ' ' + x1 + ' ' + y1, '#2a2a2a', 1.4); for (let i = 0; i < n; i++) { const t = (i + .5) / n, px = x0 + (x1 - x0) * t, py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (Math.max(y0, y1) + 18) + t * t * y1; s += C(px, py + 5, 4, col || '#FFE08A', 'opacity=".95"') + C(px, py + 5, 8, col || '#FFE08A', 'opacity=".2" stroke="none"'); } return s; };
  const neon = (x, y, w, h, c, shape) => E(x + w / 2, y + h / 2, w * .95, h * 1.05, c, 'opacity=".22" stroke="none"') + E(x + w / 2, y + h / 2, w * .62, h * .7, c, 'opacity=".2" stroke="none"') + R(x, y, w, h, '#14141c', 'rx="4"') + (shape === 'bowl' ? L('M' + (x + w * .2) + ' ' + (y + h * .45) + 'Q' + (x + w * .5) + ' ' + (y + h * .95) + ' ' + (x + w * .8) + ' ' + (y + h * .45) + 'H' + (x + w * .2) + 'M' + (x + w * .4) + ' ' + (y + h * .3) + 'q4 -6 0 -12M' + (x + w * .6) + ' ' + (y + h * .3) + 'q4 -6 0 -12', c, 3, 'stroke-linecap="round"') : shape === 'cup' ? L('M' + (x + w * .3) + ' ' + (y + h * .2) + 'L' + (x + w * .36) + ' ' + (y + h * .85) + 'H' + (x + w * .64) + 'L' + (x + w * .7) + ' ' + (y + h * .2) + 'Z', c, 3) : L('M' + (x + w * .15) + ' ' + (y + h * .5) + 'H' + (x + w * .85) + 'M' + (x + w * .3) + ' ' + (y + h * .25) + 'H' + (x + w * .7) + 'M' + (x + w * .3) + ' ' + (y + h * .75) + 'H' + (x + w * .7), c, 3.2, 'stroke-linecap="round"')) + R(x, y, w, h, 'none', 'rx="4" stroke="' + c + '" stroke-width="1.6" opacity=".9"') + R(x - 4, y - 4, w + 8, h + 8, c, 'rx="8" opacity=".14" stroke="none"');
  const cageBird = (x, y) => L('M' + x + ' 0V' + (y - 4), '#3b2a22', 1.4) + E(x, y + 18, 15, 20, 'rgba(255,255,255,.12)', 'stroke="#8A5A2B" stroke-width="2"') + L('M' + (x - 6) + ' ' + (y + 2) + 'V' + (y + 36) + 'M' + x + ' ' + (y - 2) + 'V' + (y + 38) + 'M' + (x + 6) + ' ' + (y + 2) + 'V' + (y + 36), '#8A5A2B', 1.2) + Pg('M' + (x - 5) + ' ' + (y + 26) + 'q5 -9 10 0Z', '#E8B648');
  const fan = (x, y, c) => L('M' + x + ' 0V' + y, '#5A3A24', 3) + E(x, y, 10, 5, '#5A3A24') + Pg('M' + (x - 14) + ' ' + y + 'L' + (x - 70) + ' ' + (y + 16) + 'L' + (x - 70) + ' ' + (y + 6) + 'Z', c) + Pg('M' + (x + 14) + ' ' + y + 'L' + (x + 70) + ' ' + (y + 14) + 'L' + (x + 70) + ' ' + (y + 4) + 'Z', c);
  const shadow = (x, y, rx, ry, a) => E(x, y, rx, ry, '#000', 'opacity="' + (a || .22) + '" stroke="none"');
  const plantPot = (x, y, s, leaf) => Pg('M' + (x - 12 * s) + ' ' + y + 'L' + (x - 9 * s) + ' ' + (y - 16 * s) + 'H' + (x + 9 * s) + 'L' + (x + 12 * s) + ' ' + y + 'Z', '#B36A3C', 'stroke="rgba(0,0,0,.3)"') + [-30, -10, 12, 32].map(a => Pg('M' + x + ' ' + (y - 16 * s) + 'q' + (a * s) + ' ' + (-26 * s) + ' ' + (a * 1.2 * s) + ' ' + (-34 * s) + 'q-' + (4 * s) + ' ' + (22 * s) + ' ' + (-a * .2 * s) + ' ' + (34 * s) + 'Z', leaf || '#4E8F3A')).join('');
  const bamboo = (x, y0, y1, c) => R(x - 4, y0, 8, y1 - y0, c || '#7BA84E', 'stroke="rgba(0,0,0,.25)" stroke-width="1"') + rep(Math.round((y1 - y0) / 34), i => R(x - 5, y0 + 12 + i * 34, 10, 3, 'rgba(0,0,0,.3)', N)) + Pg('M' + x + ' ' + (y0 + 40) + 'q22 -6 34 8q-20 0 -34 -4Z', '#5E8F3E') + Pg('M' + x + ' ' + (y0 + 90) + 'q-24 -4 -36 10q22 -2 36 -6Z', '#6FAE4A');
  const drum = (x, y, r, c) => E(x, y + r, r, r * .35, '#6B4423') + R(x - r, y, r * 2, r, c || '#B8321F') + E(x, y, r, r * .35, '#F0D9A8') + L('M' + (x - r) + ' ' + (y + 6) + 'H' + (x + r), '#E8B648', 2);

  // ---------- seating ----------
  const chairB = (x, y, col, dk, w) => { w = w || 44; return E(x, y + 16, w * .9, 8, 'url(#fzsh)', 'stroke="none"') + R(x - w / 2, y - 90, w, 62, col, 'stroke="' + OL + '" stroke-width="1.5"') + R(x - w / 2 + 6, y - 84, w - 12, 46, dk, 'stroke="none" opacity=".55"') + R(x - w / 2 - 4, y - 28, w + 8, 10, col, 'stroke="' + OL + '" stroke-width="1.5"') + L('M' + (x - w / 2) + ' ' + (y - 18) + 'V' + (y + 16) + 'M' + (x + w / 2) + ' ' + (y - 18) + 'V' + (y + 16), OL, 4); };
  const chairF = (x, y, col, dk, w) => { w = w || 48; return E(x, y + 60, w * .9, 8, 'url(#fzsh)', 'stroke="none"') + Pg('M' + (x - w / 2) + ' ' + (y + 60) + 'V' + (y + 8) + 'Q' + (x - w / 2) + ' ' + y + ' ' + (x - w / 2 + 8) + ' ' + y + 'H' + (x + w / 2 - 8) + 'Q' + (x + w / 2) + ' ' + y + ' ' + (x + w / 2) + ' ' + (y + 8) + 'V' + (y + 60) + 'Z', col, 'stroke="' + OL + '" stroke-width="1.5"') + [1, 2, 3].map(i => L('M' + (x - w / 2 + i * w / 4) + ' ' + (y + 4) + 'V' + (y + 58), dk, 2.5, 'opacity=".7"')).join('') + L('M' + (x - w / 2) + ' ' + (y + 16) + 'H' + (x + w / 2), dk, 2, 'opacity=".6"'); };
  const stool = (x, y, col, leg) => E(x, y + 34, 38, 8, 'url(#fzsh)', 'stroke="none"') + L('M' + (x - 20) + ' ' + y + 'L' + (x - 26) + ' ' + (y + 34) + 'M' + (x + 20) + ' ' + y + 'L' + (x + 26) + ' ' + (y + 34) + 'M' + x + ' ' + y + 'V' + (y + 30), leg || '#8A6A30', 4) + E(x, y, 30, 9, col, 'stroke="rgba(0,0,0,.4)" stroke-width="2"');
  const cushion = (x, y, w, c1, c2) => E(x, y, w, w * .3, c1, 'stroke="rgba(0,0,0,.35)" stroke-width="1.6"') + E(x, y - 2, w * .62, w * .16, c2 || c1, 'opacity=".65" stroke="none"');
  const bench = (x0, x1, y, col, top) => E((x0 + x1) / 2, y + 42, (x1 - x0) * .5, 8, 'url(#fzsh)', 'stroke="none"') + R(x0, y, x1 - x0, 12, top || col, 'stroke="' + OL + '" stroke-width="1.5"') + R(x0 + 12, y + 12, 10, 30, col) + R(x1 - 22, y + 12, 10, 30, col);
  const benchBack = (x0, x1, y, col, top) => R(x0, y - 34, x1 - x0, 12, top || col, 'stroke="' + OL + '" stroke-width="1.5"') + R(x0, y - 22, x1 - x0, 24, col, 'opacity=".95"') + R(x0 + 12, y + 2, 10, 24, col) + R(x1 - 22, y + 2, 10, 24, col);
  const booth = (x0, x1, y, col, hi) => R(x0, y - 70, x1 - x0, 62, col, 'rx="12" stroke="' + OL + '" stroke-width="1.5"') + R(x0 + 8, y - 62, x1 - x0 - 16, 30, hi || 'rgba(255,255,255,.18)', 'rx="8" stroke="none"') + R(x0 - 6, y - 14, x1 - x0 + 12, 16, col, 'rx="6" stroke="' + OL + '" stroke-width="1.5"');

  // ---------- tables ----------
  // round: {cx, cy, rx, ry, top (fill), rim, side, thick}
  function roundTable(o) {
    const t = o.thick || 22; let s = shadow(o.cx, o.cy + t + 14, o.rx * 1.08, o.ry * .6, .28);
    if (o.leg) s += R(o.cx - 22, o.cy + o.ry * .4, 44, t + 40, o.leg);
    s += E(o.cx, o.cy + t, o.rx, o.ry, o.side || 'rgba(0,0,0,.55)') + R(o.cx - o.rx, o.cy, o.rx * 2, t, o.side || 'rgba(0,0,0,.55)') + E(o.cx, o.cy + t, o.rx, o.ry, o.side || 'rgba(0,0,0,.55)') + Pg('M' + (o.cx - o.rx) + ' ' + o.cy + 'V' + (o.cy + t) + 'A' + o.rx + ' ' + o.ry + ' 0 0 0 ' + (o.cx + o.rx) + ' ' + (o.cy + t) + 'V' + o.cy + 'Z', 'url(#fzside)', N) + E(o.cx, o.cy, o.rx, o.ry, o.rim || '#E8B648') + E(o.cx, o.cy, o.rx - 7, o.ry - 5, o.top) + E(o.cx, o.cy, o.rx - 7, o.ry - 5, 'url(#fzedge)', N) + E(o.cx - o.rx * .25, o.cy - o.ry * .38, o.rx * .38, o.ry * .1, '#fff', 'opacity=".1" stroke="none"');
    if (o.inner) s += E(o.cx, o.cy, o.rx * .66, o.ry * .6, 'none', 'stroke="' + o.inner + '" stroke-width="1.6" opacity=".5"');
    return s;
  }
  // rect: {x0, x1 (back edge), y0, X0, X1 (front edge), y1, top, rim, side, thick, runner:{c, w}}
  function rectTable(o) {
    const t = o.thick || 24; let s = shadow(340, o.y1 + t + 10, (o.X1 - o.X0) * .54, 20, .25);
    s += Pg('M' + o.X0 + ' ' + o.y1 + 'H' + o.X1 + 'V' + (o.y1 + t) + 'H' + o.X0 + 'Z', o.side || 'rgba(0,0,0,.5)', 'stroke="rgba(0,0,0,.3)"') + R(o.X0, o.y1, o.X1 - o.X0, t, 'url(#fzside)', N);
    s += rep(3, i => R(o.X0 + 24 + i * ((o.X1 - o.X0 - 80) / 2), o.y1 + t, 14, 34, o.leg || '#4A2A1A'));
    s += Pg('M' + o.x0 + ' ' + o.y0 + 'H' + o.x1 + 'L' + o.X1 + ' ' + o.y1 + 'H' + o.X0 + 'Z', o.top, 'stroke="' + (o.rim || '#E8B648') + '" stroke-width="3" stroke-linejoin="round"') + Pg('M' + o.x0 + ' ' + o.y0 + 'H' + o.x1 + 'L' + o.X1 + ' ' + o.y1 + 'H' + o.X0 + 'Z', 'url(#fzedge)', N);
    if (o.runner) { const r = o.runner, k = r.w / 2; s += Pg('M' + (340 - k * .7) + ' ' + o.y0 + 'H' + (340 + k * .7) + 'L' + (340 + k) + ' ' + o.y1 + 'H' + (340 - k) + 'Z', r.fill || r.c, 'opacity="' + (r.o || .95) + '" stroke="none"'); }
    return s;
  }
  // a low table seen from the front, sitting on a rug or floor
  function lowTable(o) {
    let s = shadow(340, o.y1 + 8, (o.X1 - o.X0) * .52, 16, .3);
    s += Pg('M' + o.X0 + ' ' + o.y1 + 'H' + o.X1 + 'V' + (o.y1 + (o.thick || 20)) + 'H' + o.X0 + 'Z', o.side) + Pg('M' + o.x0 + ' ' + o.y0 + 'H' + o.x1 + 'L' + o.X1 + ' ' + o.y1 + 'H' + o.X0 + 'Z', o.top, 'stroke="' + (o.rim || 'rgba(0,0,0,.3)') + '" stroke-width="2.4" stroke-linejoin="round"');
    return s;
  }

  const KIT = { R, C, E, Pg, L, T, OL, id, rep, fab, floor, wall, V, win, lantern, chili, scroll, pillar, beam, jar, bottleRow, prayerFlags, stringLights, neon, cageBird, fan, shadow, plantPot, bamboo, drum, chairB, chairF, stool, cushion, bench, benchBack, booth, roundTable, rectTable, lowTable };

  // ---------- light and table settings (shared by every room) ----------
  // The gradients have fixed ids: every picture on the page carries the same copy, so it does not matter which one is found first.
  const SIL = '<filter id="fzsil" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%"><feColorMatrix type="matrix" values="0 0 0 0 .16 0 0 0 0 .1 0 0 0 0 .08 0 0 0 1 0"/></filter>';
  const LIGHT_DEFS = '<defs>' + SIL +
    '<radialGradient id="fzaura"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".34"/><stop offset=".6" stop-color="#FFD27A" stop-opacity=".14"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="fzglow"><stop offset="0" stop-color="#FFEDB8" stop-opacity=".34"/><stop offset=".55" stop-color="#FFD98A" stop-opacity=".1"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="fzsh"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".55" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="fzvig" cx=".5" cy=".56" r=".78"><stop offset=".5" stop-color="#120804" stop-opacity="0"/><stop offset="1" stop-color="#120804" stop-opacity=".5"/></radialGradient>' +
    '<linearGradient id="fzside" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>' +
    '<linearGradient id="fzwallsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>' +
    '<linearGradient id="fzcontact" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="fzfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".06"/></linearGradient>' +
    '<pattern id="fzgrain" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".7" fill="#000" opacity=".1"/><circle cx="14" cy="9" r=".6" fill="#fff" opacity=".1"/><circle cx="8" cy="17" r=".7" fill="#000" opacity=".08"/><circle cx="19" cy="19" r=".6" fill="#fff" opacity=".08"/><circle cx="18" cy="3" r=".5" fill="#000" opacity=".08"/></pattern>' +
    '<radialGradient id="fzedge"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>' +
    '<linearGradient id="fzceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0503" stop-opacity=".4"/><stop offset="1" stop-color="#0a0503" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="fzbeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6D2" stop-opacity=".42"/><stop offset="1" stop-color="#FFF6D2" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="fzbeamf" gradientUnits="userSpaceOnUse" x1="0" y1="250" x2="0" y2="420"><stop offset="0" stop-color="#FFF1C0" stop-opacity=".34"/><stop offset="1" stop-color="#FFF1C0" stop-opacity=".1"/></linearGradient>' +
    '<linearGradient id="fzshelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9B8" stop-opacity=".26"/><stop offset=".5" stop-color="#FFE9B8" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>' +
    '<linearGradient id="fzsheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '</defs>';
  // a place at the table: a rice bowl with chopsticks resting beside it, and a small cup. ware = [bowl, pattern]
  const WARES = [['#F4F1EA', '#2F5F9E'], ['#DDEADB', '#5E8F6A'], ['#B8321F', '#E8B648'], ['#F4F1EA', '#C0392B'], ['#D8B98A', '#6B4423'], ['#33404F', '#E8B648']];
  const setting = (x, y, k, w, flip) => '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')" stroke="' + OL + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
    E(0, 3, 38, 7, 'url(#fzsh)', N) + '<g transform="scale(' + (flip ? -1 : 1) + ' 1)">' + L('M-30 -3L16 -10M-30 2L16 -4', '#8A5A2B', 2.2) +
    Pg('M-17 -23Q-16 -5 -9 -3H9Q16 -5 17 -23Z', w[0]) + E(0, -23, 17, 5, w[0]) + E(0, -23, 13.4, 3.4, '#F7EBCB', N) + L('M-16 -14H16', w[1], 1.6, 'opacity=".9"') + L('M-12 -9H12', w[1], 1, 'opacity=".6"') +
    Pg('M23 -17Q23 -5 28 -3H37Q42 -5 42 -17Z', w[0]) + E(32.5, -17, 9.5, 2.8, '#D9A441') + '</g></g>';
  const seats = (th, rid) => { const r = th.table.rows, wr = WARES[(th.ware != null ? th.ware : FE.hash(rid)) % WARES.length], out = [];
    const f = r[2][0] + 12, b = r[0][0] - 24;
    [[-150, f, .66, 0], [0, f + 2, .7, 1], [150, f, .66, 0]].forEach(a => out.push(setting(340 + a[0], a[1], a[2], wr, a[3])));
    [[-130, b, .5, 1], [130, b, .5, 0]].forEach(a => out.push(setting(340 + a[0], a[1], a[2], wr, a[3])));
    return out.join(''); };

  // ---------- layout ----------
  const SC = [.64, .78, .94], TABLE_CAP = 18, SHELF_CAP = 10;
  const gsc = (x, y, k, p) => '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')" stroke="' + OL + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' + p + '</g>';
  const hot = (it, inner, x, y, w, h) => '<g class="fz-hit' + (it.hid ? ' hid' : '') + '" data-id="' + it.id + '">' + inner + '<rect x="' + (x - w / 2) + '" y="' + (y - h) + '" width="' + w + '" height="' + (h + 8) + '" fill="rgba(0,0,0,0)"/></g>';
  // a dish found since the table was last opened joins it: its dark shape pops into colour (the shape fades, the dish drops in) and a puff of steam rises
  const puff = (it, x, y, k) => { let o = ''; for (let i = 0; i < 3; i++) o += '<circle class="fz-puff" style="--d:' + (+it.fd + .25 + i * .12).toFixed(2) + 's" cx="' + (x + (i - 1) * 15 * k) + '" cy="' + (y - 40 * k) + '" r="' + (5.5 * k) + '" fill="#FFF6E0"/>'; return '<g pointer-events="none">' + o + '</g>'; };
  const joined = (it, solid, silhouette, x, y, k) => it.fresh && !it.hid && it.fd != null ? '<g class="fz-new" style="--d:' + it.fd + 's">' + solid + '</g><g class="fz-sil" style="--d:' + it.fd + 's" pointer-events="none"><g filter="url(#fzsil)" opacity=".5">' + silhouette + '</g></g>' + puff(it, x, y, k) : solid;
  // a dish that has just been put on the table (from its stop page) stands in a pool of light; anything not looked at yet wears a little NEW tag
  const marks = (it, x, y, k, html, tagDy) => (it.focus && !it.hid ? '<g class="fz-spot" pointer-events="none">' + E(x, y - 8 * k, 92 * k, 40 * k, 'url(#fzaura)', N) + E(x, y - 4 * k, 66 * k, 22 * k, 'none', 'stroke="#FFD34D" stroke-width="2.5"') + '</g>' : '') + html +
    ((it.nw || it.focus) && !it.hid ? '<g class="fz-tag" pointer-events="none" transform="translate(' + x + ' ' + (y - tagDy) + ')"><rect x="-20" y="-10" width="40" height="18" rx="9" fill="#C2362B" stroke="#fff" stroke-width="1.5"/><text x="0" y="3.5" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="system-ui,sans-serif" letter-spacing=".08em">NEW</text></g>' : '');
  function layoutRows(n, rows, hasCentre) {
    // spread n dishes over the three rows in proportion to how many fit; the centre piece takes the middle of the middle row
    const cap = rows.map((r, i) => Math.max(2, Math.floor(2 * r[1] / (74 * SC[i]))));
    const tot = cap.reduce((a, b) => a + b, 0), cnt = cap.map(c => Math.floor(n * c / tot));
    let left = n - cnt.reduce((a, b) => a + b, 0), i = 1;
    while (left > 0) { cnt[i % 3]++; left--; i += 2; }
    const out = [];
    rows.forEach((r, ri) => {
      const k = cnt[ri]; if (!k) return;
      const half = r[1] - 56 * SC[ri];
      if (ri === 1 && hasCentre) {
        const l = Math.ceil(k / 2), rr = k - l;
        for (let j = 0; j < l; j++) out.push([340 - 70 - (l === 1 ? 0 : (j / (l - 1)) * (half - 70)) , r[0], ri]);
        for (let j = 0; j < rr; j++) out.push([340 + 70 + (rr === 1 ? 0 : (j / (rr - 1)) * (half - 70)), r[0], ri]);
      } else {
        for (let j = 0; j < k; j++) out.push([340 + ((j + .5) / k - .5) * 2 * half, r[0] + (j % 2 ? 2 : -2), ri]);
      }
    });
    return out;
  }
  // which course (page) of the table a dish is set on: the same split as scene() makes
  function pageOf(found, id) {
    const items = found.map(f => Object.assign({}, f, FE.classify(f, f.kind))); const pages = pagesFor(items); const it = items.find(x => x.id === id); if (!it) return 0;
    const zone = items.filter(x => x.zone === it.zone); const per = Math.ceil(zone.length / pages) || 1; return Math.max(0, Math.min(pages - 1, Math.floor(zone.indexOf(it) / per)));
  }
  function pagesFor(items) {
    const tb = items.filter(x => x.zone === 'table'), sh = items.filter(x => x.zone === 'shelf');
    return Math.max(1, Math.ceil(tb.length / TABLE_CAP), Math.ceil(sh.length / SHELF_CAP));
  }
  function scene(rid, found, page) {
    const th = FEAST_THEMES[rid] || FEAST_THEMES._default;

    const items = found.map(f => Object.assign({}, f, FE.classify(f, f.kind)));
    // dishes that share a drawing in this room are made to differ: the second gets one variant, the third another, and so on
    let fi = 0; items.forEach(it => { if (it.fresh && !it.hid) it.fd = Math.min(2.4, .25 + fi++ * .32).toFixed(2); });
    const seenDraw = {};
    items.forEach(it => { const key = FE.draw(it.arch, it.p); it.vn = seenDraw[key] = (seenDraw[key] == null ? -1 : seenDraw[key]) + 1; });
    const pages = pagesFor(items), pg = Math.max(0, Math.min(pages - 1, page || 0));
    const slice = (arr) => { const per = Math.ceil(arr.length / pages) || 1; return arr.slice(pg * per, pg * per + per); };
    const tb = slice(items.filter(x => x.zone === 'table')), sh = slice(items.filter(x => x.zone === 'shelf'));
    floorY = null; wins = [];
    let s = th.room(KIT);
    { const fy = floorY == null ? 250 : floorY; s += R(0, fy - 70, 680, 70, 'url(#fzwallsh)', N) + R(0, fy, 680, 26, 'url(#fzcontact)', N) + R(0, fy, 680, 440 - fy, 'url(#fzfloor)', N) + R(0, 0, 680, 440, 'url(#fzgrain)', N); }
    // shelf and what is on it
    const sf = th.shelf, shelfItems = [];
    s += shelfUnit(sf);
    sh.forEach((it, i) => { const row = i < 5 ? 0 : 1, col = i % 5, n = Math.min(5, sh.length - row * 5), x = sf.x + sf.w * ((col + .5) / 5), y = sf.y + row * 62 + 0; shelfItems.push(marks(it, x, y, .46, hot(it, E(x, y + 1, 19, 4.4, 'url(#fzsh)', N) + (it.hid ? '<g filter="url(#fzsil)" opacity=".5">' + gsc(x, y, .46, FE.drawVar(it, it.vn ? it.vn : null, true)) + '</g>' : joined(it, gsc(x, y, .46, FE.drawVar(it, it.vn ? it.vn : null)), gsc(x, y, .46, FE.drawVar(it, it.vn ? it.vn : null, true)), x, y, .46)), x, y, 36, 34), 44)); });
    s += shelfItems.join('');
    if (th.back) s += th.back(KIT);
    s += th.table.draw(KIT);
    // the table is lit: a warm pool of light, a soft sheen, light from the window, and a place laid at each seat
    { const r = th.table.rows, hw = r[1][1]; s += E(340, r[1][0] - 20, hw * .98, 62, 'url(#fzglow)', N) + E(340, r[0][0] - 2, hw * .7, 7, 'url(#fzsheen)', N) + seats(th, rid);
      // daylight falls through the windows onto the floor and the table (only below the floor line: on a pale wall a beam would just look grey)
      if (!th.nolight) { const fy = floorY == null ? 250 : floorY, lc = id('lb'); let lb = '';
        wins.filter(w => w.w >= 90).slice(0, 2).forEach((w, wi) => { const dir = w.x + w.w / 2 < 340 ? 1 : -1, dx = dir * (110 + wi * 40), x0 = w.x + 10, x1 = w.x + w.w - 10, y0 = w.y + w.h * .55;
          lb += Pg('M' + x0 + ' ' + y0 + 'H' + x1 + 'L' + (x1 + dx + 20) + ' 405H' + (x0 + dx - 20) + 'Z', 'url(#fzbeamf)', 'opacity=".5" stroke="none"');
          for (let i = 0; i < 7; i++) { const t = .35 + ((i * 37) % 60) / 100, u = ((i * 53 + 11) % 100) / 100; lb += C(x0 + (x1 - x0) * u + dx * t, y0 + (400 - y0) * t, 1.1 + (i % 3) * .4, '#fff', 'opacity=".55" stroke="none"'); } });
        if (lb) s += '<defs><clipPath id="' + lc + '"><rect y="' + fy + '" width="680" height="' + (440 - fy) + '"/></clipPath></defs><g clip-path="url(#' + lc + ')" pointer-events="none">' + lb + '</g>'; }
      (th.light || []).forEach(l => { s += Pg('M' + l[0] + ' ' + l[2] + 'H' + l[1] + 'L' + (l[1] + (l[3] || 90)) + ' ' + (l[4] || 400) + 'H' + (l[0] + (l[3] || 90) - 30) + 'Z', 'url(#fzbeam)', 'opacity="' + (l[5] || .7) + '" stroke="none"'); }); }
    // the centre piece: the first must-see on this page (a page without one features its first dish that is not a drink)
    const ci = tb.some(x => x.sp) ? tb.findIndex(x => x.sp) : tb.findIndex(x => !x.drink), centre = ci >= 0 ? tb[ci] : null, rest = tb.filter(x => x !== centre);
    const slots = layoutRows(rest.length, th.table.rows, !!centre), placed = [];
    if (centre) placed.push({ it: centre, x: 340, y: th.table.rows[1][0] + 6, k: 1.15 });
    rest.forEach((it, i) => { const sl = slots[i]; if (!sl) return; placed.push({ it, x: sl[0], y: sl[1], k: SC[sl[2]] * (it.drink ? .85 : 1) * (it.arch === 'hotpot' ? .9 : 1) }); });
    // the featured dish glows softly: a warm halo on the table behind it, and a few motes of light
    if (centre) { const ax = 340, ay = th.table.rows[1][0] - 4; s += '<g pointer-events="none" class="fz-aura">' + E(ax, ay, 132, 74, 'url(#fzaura)', N) + E(ax, ay + 2, 82, 44, 'url(#fzaura)', 'opacity=".9" stroke="none"') + [[-74, -52, 2.2], [66, -58, 1.8], [-96, -14, 1.6], [102, -22, 2], [-38, -70, 1.5], [30, -76, 1.7]].map(m => C(ax + m[0], ay + m[1], m[2], '#FFE9A8', 'opacity=".7" stroke="none"')).join('') + '</g>'; }
    placed.sort((a, b) => a.y - b.y).forEach(o => { const sh = '<ellipse cx="0" cy="2" rx="58" ry="12" fill="url(#fzsh)" stroke="none"/>'; s += marks(o.it, o.x, o.y, o.k, hot(o.it, o.it.hid ? '<g>' + gsc(o.x, o.y, o.k, sh) + '<g filter="url(#fzsil)" opacity=".5">' + gsc(o.x, o.y, o.k, FE.drawVar(o.it, o.it.vn ? o.it.vn : null, true)) + '</g></g>' : joined(o.it, '<g>' + gsc(o.x, o.y, o.k, sh + FE.drawVar(o.it, o.it.vn ? o.it.vn : null)) + '</g>', gsc(o.x, o.y, o.k, FE.drawVar(o.it, o.it.vn ? o.it.vn : null, true)), o.x, o.y, o.k), o.x, o.y, 80 * o.k, 70 * o.k), 84 * o.k); });
    if (th.front) s += th.front(KIT);
    s += '<g pointer-events="none">' + R(0, 0, 680, 440, 'url(#fzvig)', N) + R(0, 0, 680, 140, 'url(#fzceil)', N) + '</g>';
    return { svg: s,
 pages, page: pg, shown: tb.length + sh.length, total: items.length, looks: new Set(items.map(it => FE.drawVar(it, it.vn ? it.vn : null))).size };
  }
  function shelfUnit(sf) {
    const st = sf.style || {}, c = st.c || '#6B4423', c2 = st.c2 || '#8A5A2B', bk = st.bk || 'rgba(0,0,0,.35)';
    const x = sf.x, w = sf.w, y0 = sf.y - 48;
    let s = R(x - 8, y0, w + 16, 144, c, 'stroke="rgba(0,0,0,.4)" stroke-width="2" rx="' + (st.r || 3) + '"') + R(x - 2, y0 + 6, w + 4, 132, bk, 'stroke="none"') + R(x - 2, y0 + 6, w + 4, 132, 'url(#fzshelf)', N) + E(x + w / 2, y0 + 10, w * .46, 20, 'url(#fzglow)', 'opacity=".9" stroke="none"') + Pg('M' + (x + 26) + ' ' + (y0 + 6) + 'H' + (x + 52) + 'L' + (x + 14) + ' ' + (y0 + 138) + 'H' + (x - 12) + 'Z', '#fff', 'opacity=".06" stroke="none"') + Pg('M' + (x + 66) + ' ' + (y0 + 6) + 'H' + (x + 74) + 'L' + (x + 36) + ' ' + (y0 + 138) + 'H' + (x + 28) + 'Z', '#fff', 'opacity=".05" stroke="none"');
    s += R(x - 8, sf.y, w + 16, 7, c2, 'stroke="rgba(0,0,0,.35)" stroke-width="1"') + R(x - 8, sf.y + 62, w + 16, 7, c2, 'stroke="rgba(0,0,0,.35)" stroke-width="1"');
    if (st.top) s += st.top(x, y0, w);
    return s;
  }
  // one dish on its own, for the popup
  function portrait(stop, kind, sil) { const c = FE.classify(stop, kind), sh = '<ellipse cx="0" cy="1" rx="46" ry="8" fill="#000" opacity=".2" stroke="none"/>'; return '<svg viewBox="-62 -92 124 100" aria-hidden="true"><defs>' + SIL + '</defs>' + (sil ? gsc(0, 0, 1.25, sh) + '<g filter="url(#fzsil)" opacity=".5">' + gsc(0, 0, 1.25, FE.draw(c.arch, c.p).replace(/<g class="fz-stm"[\s\S]*?<\/g>/g, '')) + '</g>' : gsc(0, 0, 1.25, sh + FE.draw(c.arch, c.p))) + '</svg>'; }
  // the finished picture. land = the cropped landscape frame used when the table is opened full screen. id keeps the clip path unique on the page.
  function wrap(res, id, land) {
    const vb = land ? '0 112 680 328' : '0 0 680 440', c = 'fzc-' + id;
    return '<svg class="fz-svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true" overflow="hidden">'+FE.TINT_DEFS + LIGHT_DEFS + '<clipPath id="' + c + '"><rect y="' + (land ? 112 : 0) + '" width="680" height="' + (land ? 328 : 440) + '"/></clipPath><g clip-path="url(#' + c + ')">' + res.svg + '</g></svg>';
  }
  const FEAST_THEMES = {};
  const api = { scene, wrap, portrait, pagesFor, pageOf, KIT, THEMES: FEAST_THEMES, TABLE_CAP, SHELF_CAP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FEAST = Object.assign(root.FEAST || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
