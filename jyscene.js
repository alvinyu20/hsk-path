/* The Journey card's picture: a landscape for each of the 31 regions, with the road ahead drawn on top of it.
 *   JYSCENE.svg(rid, model)  -> a full <svg> (viewBox 360 x 210) holding the region's scene and the road
 *   JYSCENE.scene(rid)       -> just the landscape (inner markup)
 *   JYSCENE.road(model)      -> just the road, its stops and their labels (inner markup)
 *   JYSCENE.IDS              -> the regions that have a scene of their own
 * model: { done:0-2 (stops behind you), me:'', avatar:url|'', next:{ kind:'D'|'A'|'C'|'T'|'P'|'F', label }, mid:0|1, goal:{ kind:'city'|'region'|'none', zh, label }, pct:0-1 (coins toward the next stop), ready:bool, home:bool }
 * Everything here is drawn from shapes, no pictures. The ground always starts above y = 108 so the road never floats in the sky. */
(function (root) {
  const f = (n) => Math.round(n * 10) / 10;
  const R = (x, y, w, h, fill, ex) => '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>';
  const C = (x, y, r, fill, ex) => '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>';
  const E = (x, y, rx, ry, fill, ex) => '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>';
  const P = (d, fill, ex) => '<path d="' + d + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>';
  const L = (d, stroke, w, ex) => '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (ex ? ' ' + ex : '') + '/>';
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rnd = (seed) => { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ---- small parts ----
  const tri = (cx, by, w, h, fill) => P('M' + f(cx - w / 2) + ' ' + by + 'L' + f(cx) + ' ' + f(by - h) + 'L' + f(cx + w / 2) + ' ' + by + 'Z', fill);
  // a mountain with a snow cap (cap = fraction of the height)
  const peak = (cx, by, w, h, fill, snow, cap) => { let s = tri(cx, by, w, h, fill); if (snow) { const c = cap || .3, y = by - h * (1 - c), hw = w / 2 * c; s += P('M' + f(cx - hw) + ' ' + f(y) + 'L' + f(cx) + ' ' + f(by - h) + 'L' + f(cx + hw) + ' ' + f(y) + 'L' + f(cx + hw * .45) + ' ' + f(y + 4) + 'L' + f(cx) + ' ' + f(y - 1) + 'L' + f(cx - hw * .5) + ' ' + f(y + 5) + 'Z', snow); } return s; };
  const ridge = (pts, base, fill) => P('M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + 'L' + f(pts[pts.length - 1][0]) + ' ' + base + 'L' + f(pts[0][0]) + ' ' + base + 'Z', fill);
  const hills = (y, amp, fill, seed, n) => { const r = rnd(seed || 7); const k = n || 6, pts = []; for (let i = 0; i <= k; i++) pts.push([i * 360 / k, y - r() * amp]); let d = 'M0 ' + f(pts[0][1]); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2; d += 'Q' + f(a[0] + (b[0] - a[0]) * .5) + ' ' + f(a[1]) + ' ' + f(mx) + ' ' + f((a[1] + b[1]) / 2); d += 'T' + f(b[0]) + ' ' + f(b[1]); } return P(d + 'V210H0Z', fill); };
  const pine = (x, y, h, c, c2) => { const w = h * .42; return R(x - h * .035, y - h * .16, h * .07, h * .2, c2 || '#4a3322') + P('M' + f(x - w / 2) + ' ' + f(y - h * .12) + 'L' + f(x) + ' ' + f(y - h * .55) + 'L' + f(x + w / 2) + ' ' + f(y - h * .12) + 'Z', c) + P('M' + f(x - w * .42) + ' ' + f(y - h * .4) + 'L' + f(x) + ' ' + f(y - h * .8) + 'L' + f(x + w * .42) + ' ' + f(y - h * .4) + 'Z', c) + P('M' + f(x - w * .3) + ' ' + f(y - h * .65) + 'L' + f(x) + ' ' + f(y - h) + 'L' + f(x + w * .3) + ' ' + f(y - h * .65) + 'Z', c); };
  // the moving parts carry a js-* class (styles.css animates them: clouds drift, glow breathes, waves flow, flags and lanterns sway, plants lean, stars twinkle)
  const cloud = (x, y, s, c, o) => '<g class="js-cl k' + (Math.round(x) % 3) + '" opacity="' + (o == null ? .9 : o) + '">' + E(x, y, 22 * s, 6 * s, c) + C(x - 9 * s, y - 5 * s, 8 * s, c) + C(x + 4 * s, y - 8 * s, 10 * s, c) + C(x + 15 * s, y - 3 * s, 7 * s, c) + '</g>';
  const sun = (x, y, r, c, glow) => C(x, y, r * 2.2, glow || c, 'class="js-glow" opacity=".22"') + C(x, y, r * 1.5, glow || c, 'class="js-glow g2" opacity=".3"') + C(x, y, r, c);
  const lantern = (x, y, s, c) => '<g class="js-ln k' + (Math.round(x) % 2) + '">' + L('M' + x + ' ' + (y - 8 * s) + 'V' + f(y - 3 * s), '#3a2a22', 1) + E(x, y + 3 * s, 4.6 * s, 5.6 * s, c || '#C2362B') + R(x - 2.4 * s, y - 3 * s, 4.8 * s, 1.6 * s, '#E0A526') + R(x - 2.4 * s, y + 7.4 * s, 4.8 * s, 1.4 * s, '#E0A526') + L('M' + x + ' ' + f(y + 8.8 * s) + 'v' + f(4 * s), '#E0A526', 1) + '</g>';
  const pagoda = (x, by, s, tiers, wall, roof, trim) => { let o = '', y = by; for (let i = 0; i < tiers; i++) { const w = (22 - i * 3) * s, h = 9 * s; o += R(x - w * .36, y - h, w * .72, h, wall) + P('M' + f(x - w * .62) + ' ' + f(y - h + 1) + 'Q' + f(x - w * .3) + ' ' + f(y - h - 1.5 * s) + ' ' + f(x) + ' ' + f(y - h - 4.5 * s) + 'Q' + f(x + w * .3) + ' ' + f(y - h - 1.5 * s) + ' ' + f(x + w * .62) + ' ' + f(y - h + 1) + 'Z', roof) + (trim ? R(x - w * .62, y - h + 1, w * 1.24, 1.4 * s, trim) : ''); y -= h + 3 * s; } return o + L('M' + x + ' ' + f(y + 1) + 'v' + f(-7 * s), roof, 1.4 * s) + C(x, y - 8 * s, 1.6 * s, trim || '#E0A526'); };
  const palm = (x, y, h, lean) => { const tx = x + lean, ty = y - h; let o = '<g class="js-sw k' + (Math.round(x) % 2) + '">' + L('M' + x + ' ' + y + 'Q' + f(x + lean * .2) + ' ' + f(y - h * .6) + ' ' + f(tx) + ' ' + f(ty), '#7a5a3a', 2.4); [[-26, -4], [-20, -14], [-6, -20], [10, -18], [24, -8], [18, 2]].forEach((a) => { o += L('M' + f(tx) + ' ' + f(ty) + 'Q' + f(tx + a[0] * .6) + ' ' + f(ty + a[1] - 6) + ' ' + f(tx + a[0]) + ' ' + f(ty + a[1] + 6), '#2F7D3A', 3.2); }); return o + C(tx - 1, ty + 2, 2.4, '#5a3a1a') + '</g>'; };
  const bamboo = (x, y, h, c) => { let o = '<g class="js-sw k' + (Math.round(x) % 2) + '">' + R(x - 1.6, y - h, 3.2, h, c); for (let k = 1; k < 5; k++) o += R(x - 2.2, y - h * k / 5, 4.4, 1.2, 'rgba(0,0,0,.28)'); o += P('M' + x + ' ' + f(y - h * .7) + 'q10 -4 16 2q-8 0 -16 -2Z', c) + P('M' + x + ' ' + f(y - h * .45) + 'q-10 -4 -16 2q8 0 16 -2Z', c) + P('M' + x + ' ' + f(y - h * .95) + 'q10 -6 16 0q-8 1 -16 0Z', c); return o + '</g>'; };
  const yurt = (x, y, s) => P('M' + f(x - 15 * s) + ' ' + y + 'V' + f(y - 9 * s) + 'Q' + f(x) + ' ' + f(y - 26 * s) + ' ' + f(x + 15 * s) + ' ' + f(y - 9 * s) + 'V' + y + 'Z', '#F7F2E6') + P('M' + f(x - 15 * s) + ' ' + f(y - 9 * s) + 'Q' + f(x) + ' ' + f(y - 26 * s) + ' ' + f(x + 15 * s) + ' ' + f(y - 9 * s) + 'Z', '#EDE4D0') + R(x - 3.5 * s, y - 9 * s, 7 * s, 9 * s, '#C2362B') + L('M' + f(x - 15 * s) + ' ' + f(y - 9 * s) + 'H' + f(x + 15 * s), '#2F5F9E', 1.4 * s) + C(x, y - 20.5 * s, 1.8 * s, '#C2362B');
  const house = (x, y, w, h, wall, roof) => R(x, y - h, w, h, wall) + P('M' + f(x - 3) + ' ' + f(y - h) + 'L' + f(x + w / 2) + ' ' + f(y - h - w * .32) + 'L' + f(x + w + 3) + ' ' + f(y - h) + 'Z', roof);
  const flags = (x1, y1, x2, y2, n) => { let o = '<g class="js-fl">' + L('M' + x1 + ' ' + y1 + 'Q' + f((x1 + x2) / 2) + ' ' + f(Math.max(y1, y2) + 8) + ' ' + x2 + ' ' + y2, '#3a2a22', 1); const cs = ['#2F5F9E', '#F4F1E6', '#C2362B', '#3E9B4F', '#E0A526']; for (let i = 0; i < n; i++) { const t = (i + .5) / n, x = x1 + (x2 - x1) * t, y = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * (Math.max(y1, y2) + 8) + t * t * y2; o += P('M' + f(x - 3) + ' ' + f(y) + 'h6v7h-6Z', cs[i % 5]); } return o + '</g>'; };
  const star = (x, y, r, c) => P('M' + x + ' ' + (y - r) + 'L' + f(x + r * .3) + ' ' + f(y - r * .3) + 'L' + (x + r) + ' ' + y + 'L' + f(x + r * .3) + ' ' + f(y + r * .3) + 'L' + x + ' ' + (y + r) + 'L' + f(x - r * .3) + ' ' + f(y + r * .3) + 'L' + (x - r) + ' ' + y + 'L' + f(x - r * .3) + ' ' + f(y - r * .3) + 'Z', c);
  const stars = (n, seed, ymax, c) => { const r = rnd(seed); let o = ''; for (let i = 0; i < n; i++) o += C(r() * 360, 6 + r() * ymax, .6 + r() * .9, c || '#fff', 'class="js-tw t' + (i % 3) + '" opacity="' + f(.5 + r() * .5) + '"'); return o; };
  const win = (x, y, w, h, c, seed, p) => { const r = rnd(seed); let o = ''; for (let yy = y; yy < y + h - 2; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (r() < (p || .5)) o += R(xx, yy, 1.8, 2, c); return o; };
  const reeds = (x, y, n, c) => { let o = ''; for (let i = 0; i < n; i++) o += L('M' + (x + i * 4) + ' ' + y + 'q' + (i % 2 ? 2 : -2) + ' -9 ' + (i % 3 - 1) * 2 + ' -16', c, 1.2); return o; };
  const waves = (y0, y1, c, o) => { let s = ''; for (let y = y0, i = 0; y < y1; y += 7, i++) { const sh = (i % 2) * 14; let d = 'M' + (-10 + sh) + ' ' + y; for (let x = -10 + sh; x < 400; x += 28) d += 'q7 -3 14 0t14 0'; s += L(d, c, 1.1, 'class="js-wv' + (i % 2 ? ' r' : '') + '" opacity="' + (o || .5) + '"'); } return s; };
  const grad = (id, stops) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>').join('') + '</linearGradient>';
  // the near ground: two soft bands from y = gy down
  const ground = (gy, c1, c2, c3) => P('M0 ' + (gy + 3) + 'Q90 ' + (gy - 4) + ' 180 ' + (gy + 2) + 'T360 ' + (gy - 2) + 'V210H0Z', c1) + P('M0 ' + (gy + 38) + 'Q100 ' + (gy + 28) + ' 200 ' + (gy + 36) + 'T360 ' + (gy + 30) + 'V210H0Z', c2) + (c3 ? P('M0 ' + (gy + 76) + 'Q120 ' + (gy + 68) + ' 240 ' + (gy + 74) + 'T360 ' + (gy + 70) + 'V210H0Z', c3) : '');

  // ---- the 31 landscapes. sky: [top, bottom], draw(): everything between the sky and the ground, ground: [near colours], fore(): small things at the very bottom ----
  const S = {};
  S.anhui = { sky: ['#9CC7E8', '#F8E6D0'], gy: 106, ground: ['#7C9C74', '#6C8C66'],
    draw: () => cloud(60, 52, 1.1, '#fff', .8) + peak(80, 112, 84, 70, '#7E94A8') + peak(150, 112, 70, 92, '#6A8298') + peak(232, 112, 92, 74, '#7E94A8') + pine(150, 52, 18, '#2E5A3A') + pine(232, 54, 15, '#2E5A3A') +
      P('M0 100Q40 88 80 98T170 96T260 100T360 94V112H0Z', '#fff', 'opacity=".86"') + P('M0 108Q60 98 120 106T240 104T360 106V114H0Z', '#EAF2F7') +
      R(280, 82, 42, 18, '#F4F0E6') + P('M276 82h8v-4h8v-4h8v-4h8v-4h8v4h8v4h8v4h8v4Z', '#2a2a30') + R(296, 90, 6, 6, '#3a3a40') + R(308, 90, 6, 6, '#3a3a40') },
  S.fujian = { sky: ['#8ED1D6', '#F3EFD6'], gy: 108, ground: ['#7DAE5C', '#6B9C4E'],
    draw: () => hills(100, 26, '#5E9A6E', 3, 5) + hills(106, 14, '#4E8A5E', 9, 4) +
      [[104, 96, 1.1], [236, 98, 1.45]].map((t) => { const x = t[0], y = t[1], s = t[2]; return R(x - 26 * s, y - 16 * s, 52 * s, 20 * s, '#B87A4A') + E(x, y - 16 * s, 26 * s, 8 * s, '#9A6238') + E(x, y - 16 * s, 17 * s, 4.6 * s, '#5a4030') + E(x, y - 17 * s, 11 * s, 2.6 * s, '#7a8c5a') + [-20, -10, 0, 10, 20].map((k) => R(x + k * s - 1.5 * s, y - 11 * s, 3 * s, 4 * s, '#3a2a22') + R(x + k * s - 1.5 * s, y - 2 * s, 3 * s, 4 * s, '#3a2a22')).join(''); }).join('') + sun(300, 36, 11, '#FFF3C0') },
  S.gansu = { sky: ['#3B3B78', '#F0A06A'], gy: 104, ground: ['#D9A55B', '#C4903F'],
    draw: () => stars(26, 11, 60) + P('M262 30a14 14 0 1 0 10 25a11 11 0 1 1 -10 -25Z', '#FBE9A8') + star(292, 32, 3, '#FBE9A8') +
      P('M0 104Q50 70 110 92T230 86T360 96V112H0Z', '#E0B168') + P('M0 112Q80 88 170 106T360 102V118H0Z', '#CF9A4E') + P('M30 108q10 -6 20 0q-10 2 -20 0Z', '#B07A30') +
      [[196, 100], [214, 100], [232, 101]].map((c, i) => L('M' + c[0] + ' ' + c[1] + 'v-7q-2 -4 1 -6l3 -3m-2 9q4 -3 8 0m-7 -3v10m8 -10v10', '#3a2a22', 1.5)).join('') + P('M190 96q20 -12 56 -2', 'none', 'stroke="#3a2a22" stroke-width=".7" opacity=".4"') },
  S.guangdong = { sky: ['#F5B7A0', '#FDE6CF'], gy: 112, ground: ['#8A8F9A', '#767B88'],
    draw: () => R(30, 66, 18, 46, '#7A6A8A') + R(52, 54, 14, 58, '#6A5A7A') + R(300, 62, 20, 50, '#7A6A8A') + R(326, 76, 16, 36, '#6A5A7A') + win(30, 66, 18, 46, '#FFE9A8', 5, .35) + win(52, 54, 14, 58, '#FFE9A8', 6, .3) +
      L('M246 112Q258 92 250 78Q244 64 250 56Q256 64 250 78Q242 92 254 112', '#2F4A5C', 2.2) + L('M247 106l14 -2M246 96l16 -3M246 88l10 -2M250 78l8 0M248 70l10 -2', '#2F4A5C', 1.1) + L('M250 56v-14', '#2F4A5C', 1.6) + C(250, 40, 2, '#C2362B') +
      R(0, 108, 360, 8, '#5E8FA8') + waves(108, 116, '#fff', .35) + R(238, 108, 24, 6, '#2F4A5C', 'opacity=".25"') + P('M96 108l30 0l-6 -8l-18 0Z', '#7a3a2a') + L('M110 100v-14', '#3a2a22', 1.2) + P('M110 86l12 8h-12Z', '#C2362B'),
    fore: () => lantern(30, 184, 1.1) + lantern(54, 190, .9) },
  S.guangxi = { sky: ['#C9E6E0', '#F3F7EC'], gy: 110, ground: ['#7FB36A', '#6AA256'],
    draw: () => [[60, 112, 38, 62], [112, 112, 30, 48], [176, 112, 46, 74], [246, 112, 34, 52], [304, 112, 40, 66]].map((m, i) => P('M' + f(m[0] - m[2] / 2) + ' 112Q' + f(m[0] - m[2] * .4) + ' ' + f(112 - m[3] * .6) + ' ' + f(m[0] - m[2] * .12) + ' ' + f(112 - m[3]) + 'Q' + f(m[0] + m[2] * .1) + ' ' + f(112 - m[3] - 3) + ' ' + f(m[0] + m[2] * .16) + ' ' + f(112 - m[3] * .9) + 'Q' + f(m[0] + m[2] * .42) + ' ' + f(112 - m[3] * .5) + ' ' + f(m[0] + m[2] / 2) + ' 112Z', i % 2 ? '#5E9A7A' : '#4E8A6A') + P('M' + f(m[0] - m[2] * .1) + ' ' + f(112 - m[3] + 2) + 'q8 -4 10 4q-8 0 -10 -4Z', '#3E7A4A')).join('') +
      P('M0 100Q90 94 180 100T360 98V112H0Z', '#fff', 'opacity=".55"') + R(0, 108, 360, 8, '#8FD0D0') + L('M150 112q10 -3 20 0', '#fff', 1, 'opacity=".7"') +
      R(204, 106, 20, 2.6, '#C9A66B') + R(206, 104, 4, 2, '#3a2a22') + L('M214 105l4 -8', '#3a2a22', 1.2) + C(218, 96, 2, '#3a2a22'),
    fore: () => bamboo(18, 210, 52, '#4E8A3E') + bamboo(334, 210, 44, '#5E9A4E') },
  S.guizhou = { sky: ['#BFE3D0', '#EEF6E4'], gy: 108, ground: ['#5F9F4E', '#4E8A3E'],
    draw: () => cloud(300, 26, 1, '#fff', .85) + hills(94, 24, '#6FAE7A', 4, 5) + R(118, 38, 124, 70, '#4C6B58') + P('M118 38h124l-6 10H124Z', '#3E5C4A') + [138, 154, 176, 196, 214].map((x, i) => R(x, 44, 3 + (i % 2) * 2, 64, '#FFFFFF', 'class="js-fall t' + (i % 3) + '" opacity=".88"')).join('') + R(128, 38, 104, 6, '#63806A') +
      E(180, 108, 52, 10, '#fff', 'class="js-mist" opacity=".62"') + E(180, 102, 32, 6, '#fff', 'class="js-mist m2" opacity=".6"') + L('M270 104l20 0M274 100l12 0', '#8a6a3a', 1.4) + P('M268 104l14 -10l14 10Z', '#7a5a3a') + R(272, 104, 20, 10, '#B8884A') + R(282, 108, 4, 6, '#3a2a22'),
    fore: () => hills(196, 6, '#3E7A32', 5, 7) },
  S.hainan = { sky: ['#6EC1E4', '#FFE7B5'], gy: 116, ground: ['#F1DDB0', '#E6CD98'],
    draw: () => sun(292, 90, 13, '#FFD36A', '#FFB36A') + R(0, 92, 360, 24, '#3FB0C8') + R(0, 92, 360, 4, '#7ADAE6') + waves(98, 114, '#fff', .45) + P('M268 88a14 14 0 0 1 28 0Z', '#FF9F5A', 'opacity=".0"') +
      palm(40, 118, 52, 10) + palm(318, 120, 60, -12) + palm(70, 120, 36, -6) + P('M120 108q10 -22 22 -22q8 0 14 8q-14 -4 -36 14Z', '#8EDBE0', 'opacity=".0"') + cloud(150, 36, 1, '#fff', .85) + cloud(250, 52, .7, '#fff', .75),
    fore: () => C(40, 200, 5, '#8a5a2a') + C(300, 196, 4, '#8a5a2a') },
  S.hebei = { sky: ['#7FB3E0', '#F6E3C4'], gy: 110, ground: ['#C8844E', '#B3703E'],
    draw: () => cloud(80, 40, 1, '#fff', .9) + cloud(260, 34, .8, '#fff', .85) + hills(84, 30, '#C98A56', 8, 5) + hills(98, 18, '#A8673C', 2, 4) + hills(96, 12, '#8A8F4E', 12, 6) +
      L('M0 86L50 82L96 66L150 72L210 52L262 64L320 44L360 50', '#8a7a68', 9) + L('M0 86L50 82L96 66L150 72L210 52L262 64L320 44L360 50', '#D9C7A6', 6) +
      [[96, 66], [210, 52], [320, 44]].map((t) => R(t[0] - 9, t[1] - 20, 18, 22, '#D9C7A6', 'stroke="#8a7a68" stroke-width="1"') + P('M' + (t[0] - 12) + ' ' + (t[1] - 20) + 'h24l-3 -6h-18Z', '#7a4a3a') + R(t[0] - 3, t[1] - 13, 6, 8, '#4a3a30')).join('') +
      '<g opacity=".7">' + L('M0 84h360', '#8a7a68', 1, 'stroke-dasharray="3 3"') + '</g>' },
  S.heilongjiang = { sky: ['#0E1B3C', '#2B3B6E'], gy: 108, ground: ['#E4EEF6', '#D0DEEA'],
    draw: () => stars(36, 3, 70) + P('M0 72Q60 20 130 56T250 40T360 70V96Q290 60 240 82T120 74T0 96Z', '#3EE0A8', 'opacity=".34"') + P('M30 80Q80 36 150 64T290 52T360 62V76Q300 60 250 70T140 80T30 96Z', '#B07AF0', 'opacity=".26"') + C(312, 34, 9, '#F4F1E6') + C(316, 32, 8, '#16264A') +
      hills(100, 10, '#9DB4CC', 6, 5) + [20, 52, 300, 336].map((x, i) => pine(x, 110, 34 - (i % 2) * 6, '#2F5A4A', '#3a2a22') + P('M' + (x - 10) + ' 98q10 -8 20 0q-10 2 -20 0Z', '#fff')).join('') +
      [[120, 24, 40, '#7FE0F0'], [150, 30, 46, '#A8F0FF'], [180, 22, 34, '#F0A8E0'], [206, 28, 44, '#7FE0F0']].map((b) => R(b[0], 108 - b[2], b[1], b[2], b[3], 'opacity=".9"') + R(b[0] + 3, 108 - b[2] + 4, b[1] - 6, b[2] - 8, '#fff', 'opacity=".28"')).join('') + P('M146 70l14 -12l14 12Z', '#A8F0FF', 'opacity=".9"') },
  S.henan = { sky: ['#F0D9A0', '#FBF1D6'], gy: 108, ground: ['#C9A25E', '#B58E4A'],
    draw: () => cloud(300, 30, 1.1, '#fff', .8) + peak(60, 108, 90, 56, '#A8946A') + peak(150, 108, 100, 70, '#9A8458') + peak(290, 108, 110, 62, '#A8946A') + P('M0 98Q60 90 120 98T240 96T360 98V112H0Z', '#8A9C5A') +
      [[196, 5.2], [212, 7.2], [230, 5.8], [244, 6.6], [262, 4.4]].map((p, i) => { const h = p[1] * 4, x = p[0]; let o = R(x - 5, 104 - h, 10, h, '#C9B48A', 'stroke="#7a6a4a" stroke-width="1"'); for (let k = 0; k < Math.round(p[1]); k++) o += R(x - 6.4, 104 - h + 4 + k * 4.6, 12.8, 2.2, '#9A8458'); return o + P('M' + (x - 5) + ' ' + (104 - h) + 'L' + x + ' ' + (104 - h - 6) + 'L' + (x + 5) + ' ' + (104 - h) + 'Z', '#7a6a4a'); }).join('') + R(70, 84, 56, 20, '#B8402E') + P('M66 84l32 -14l32 14Z', '#4a3a30') + R(90, 92, 10, 12, '#3a2a22') },
  S.hubei = { sky: ['#AEC9E6', '#FBF2DC'], gy: 112, ground: ['#7FA46E', '#6A9058'],
    draw: () => hills(92, 20, '#8AAE9C', 3, 5) + R(0, 104, 360, 12, '#7FA6C8') + waves(104, 116, '#fff', .4) + P('M0 108Q70 94 140 100T260 92T360 96V108H0Z', '#6A9058') +
      (() => { let o = R(192, 88, 40, 20, '#B8402E') + R(198, 94, 28, 14, '#8A2E22'); [[212, 70, 1], [212, 54, .8], [212, 40, .6]].forEach((t, i) => { const w = 54 * t[2]; o += P('M' + f(212 - w / 2 - 2) + ' ' + (t[1] + 18) + 'Q' + f(212 - w * .3) + ' ' + (t[1] + 11) + ' 212 ' + (t[1] + 3) + 'Q' + f(212 + w * .3) + ' ' + (t[1] + 11) + ' ' + f(212 + w / 2 + 2) + ' ' + (t[1] + 18) + 'Z', '#E0A526') + R(212 - w * .32, t[1] + 18, w * .64, 14, i ? '#C94A3A' : '#B8402E'); }); return o + L('M212 36v-8', '#E0A526', 1.6) + C(212, 26, 2.4, '#E0A526'); })() +
      P('M76 106l26 0l-5 -7l-16 0Z', '#5a3a2a') + L('M89 99v-10', '#3a2a22', 1.2) + P('M89 89l10 7h-10Z', '#fff') },
  S.hunan = { sky: ['#A8D7D2', '#F2F5E2'], gy: 108, ground: ['#5E9A5E', '#4E8A50'],
    draw: () => [[40, 70, 16], [84, 92, 20], [124, 62, 14], [164, 100, 22], [210, 74, 16], [250, 96, 20], [292, 66, 15], [330, 84, 18]].map((p, i) => { const x = p[0], h = p[1], w = p[2], c = i % 2 ? '#8A7E6E' : '#9A8E7C'; return P('M' + (x - w / 2) + ' 112L' + (x - w * .42) + ' ' + (112 - h) + 'L' + (x + w * .4) + ' ' + (112 - h) + 'L' + (x + w / 2) + ' 112Z', c) + P('M' + (x - w * .46) + ' ' + (112 - h) + 'Q' + x + ' ' + (112 - h - 9) + ' ' + (x + w * .44) + ' ' + (112 - h) + 'Z', '#4E8A50') + P('M' + (x - w * .1) + ' ' + (112 - h + 2) + 'v' + (h * .6), 'none', 'stroke="rgba(0,0,0,.18)" stroke-width="1.4"'); }).join('') + P('M0 96Q50 84 100 94T220 92T360 90V114H0Z', '#fff', 'opacity=".66"') + P('M0 106Q80 98 170 106T360 102V116H0Z', '#fff', 'opacity=".5"') + cloud(300, 28, .9, '#fff', .8) },
  S.neimenggu = { sky: ['#5CA8E8', '#D6EEFA'], gy: 102, ground: ['#7CC056', '#68AE46'],
    draw: () => cloud(70, 38, 1.4, '#fff', .95) + cloud(190, 28, 1.1, '#fff', .85) + cloud(290, 50, 1.3, '#fff', .9) + hills(98, 12, '#8BC864', 5, 5) + yurt(96, 112, .9) + yurt(128, 108, .65) + yurt(262, 110, .8) + yurt(300, 108, .55) +
      '<g fill="#3a2a22">' + [[200, 106], [212, 104], [224, 106]].map((h) => P('M' + h[0] + ' ' + h[1] + 'h9l1 -5l3 -1l-1 -3l-3 0l-2 3h-7Zm1 0v5m6 -5v5', '#5a3a22', 'class="js-hz"')).join('') + '</g>',
    fore: () => '' },
  S.jiangsu = { sky: ['#D3E3EC', '#F6F4EA'], gy: 112, ground: ['#9AA4A6', '#868F92'],
    draw: () => R(0, 66, 360, 46, '#F6F3EA') + P('M0 66h360v-4H0Z', '#2a2a30') + P('M0 62Q30 54 60 62T120 62T180 62T240 62T300 62T360 62V66H0Z', '#3a3a42') + R(0, 108, 360, 4, '#cfcfc8') +
      C(180, 90, 22, '#8FB88A') + C(180, 90, 22, 'none', 'stroke="#3a3a42" stroke-width="3"') + P('M162 90q8 -10 18 -12q10 2 18 12v6H162Z', '#5E9A5E') + L('M170 100l4 -14M182 100l1 -18M192 100l-3 -12', '#2E6A3E', 1.6) +
      [30, 76, 276, 330].map((x, i) => L('M' + x + ' 30V' + (50 + i % 2 * 10), '#6A5A3A', 2) + '<g class="js-fl k' + (i % 2) + '">' + L('M' + x + ' 34q-6 14 -2 32M' + x + ' 34q6 14 2 32M' + x + ' 36q-12 10 -10 26M' + x + ' 36q12 10 10 26', '#7CBC5A', 1.4) + '</g>').join('') +
      P('M0 112q50 -2 90 -22l8 8q-40 20 -98 18Z', '#B8C0C0', 'opacity="0"') },
  S.jiangxi = { sky: ['#F7B58A', '#FDE5BF'], gy: 112, ground: ['#7C9C5A', '#6A8A4A'],
    draw: () => sun(70, 70, 14, '#FFE08A', '#FFC070') + peak(40, 108, 100, 50, '#8F82A0') + peak(310, 108, 120, 58, '#8F82A0') + R(0, 102, 360, 14, '#7FA6C0') + waves(102, 116, '#fff', .35) +
      (() => { let o = R(160, 98, 90, 12, '#B8886A') + R(150, 92, 110, 8, '#9A6A4A') + R(172, 66, 66, 28, '#C94A3A') + R(184, 72, 12, 22, '#7a2a1e') + R(204, 72, 12, 22, '#7a2a1e') + R(224, 72, 8, 22, '#7a2a1e'); o += P('M160 66Q205 56 250 66L240 56Q205 46 170 56Z', '#E0A526') + P('M170 56Q205 40 240 56L228 44Q205 32 182 44Z', '#E0A526') + R(194, 28, 22, 18, '#C94A3A') + P('M184 28Q205 18 226 28L216 20Q205 12 194 20Z', '#E0A526') + L('M205 12v-8', '#E0A526', 1.6); return o; })() },
  S.jilin = { sky: ['#9CC8EE', '#EAF4FA'], gy: 108, ground: ['#F2F6FA', '#DDE6EE'],
    draw: () => cloud(66, 30, 1.1, '#fff', .9) + cloud(280, 22, .9, '#fff', .8) + peak(80, 108, 120, 54, '#8CA0B8', '#fff', .35) + P('M130 108L166 52Q190 44 214 52L250 108Z', '#7E92AA') + P('M152 66Q190 56 228 66Q190 76 152 66Z', '#fff') + E(190, 68, 34, 8, '#2F78C4') + E(190, 67, 26, 5, '#5AA4E8') + peak(310, 108, 110, 50, '#8CA0B8', '#fff', .3) +
      [24, 54, 108, 270, 338].map((x, i) => pine(x, 112, 26 + (i % 3) * 6, '#3E6E4E', '#3a2a22')).join('') + [40, 300, 320].map((x) => L('M' + x + ' 112v-16', '#F2F6FA', 2) + C(x, 92, 7, '#F2A030') + C(x - 5, 96, 5, '#E58A22')).join('') },
  S.liaoning = { sky: ['#8EC6EA', '#FCE3D4'], gy: 104, ground: ['#D9503F', '#C43E34'],
    draw: () => cloud(90, 40, 1, '#fff', .9) + cloud(250, 30, .8, '#fff', .85) + R(0, 92, 360, 14, '#6FB4D8') + waves(92, 106, '#fff', .35) + sun(300, 60, 10, '#FFF0C0') +
      [[96, 136], [150, 142], [232, 134]].map((c, i) => { const x = c[0], y = c[1]; return L('M' + x + ' ' + y + 'v-24', '#2a2a30', 1.4) + E(x, y - 36, 5, 11, '#fff', 'transform="rotate(8 ' + x + ' ' + (y - 36) + ')"') + P('M' + (x - 4) + ' ' + (y - 42) + 'q-8 -2 -10 6q6 -2 10 -2Z', '#2a2a30') + C(x - 4, y - 49, 3.2, '#fff') + P('M' + (x - 6) + ' ' + (y - 52) + 'l-5 1l5 2Z', '#d8a030') + C(x - 4.6, y - 52, 1.2, '#C2362B') + L('M' + x + ' ' + (y - 26) + 'v18', '#2a2a30', 1.2); }).join('') + L('M0 112q40 -4 80 0t80 0t80 0t80 0t80 0', '#8A2A2A', 1.4, 'opacity=".4"') },
  S.ningxia = { sky: ['#F4C28A', '#FDE9C8'], gy: 108, ground: ['#D8B070', '#C79C58'],
    draw: () => sun(60, 60, 12, '#FFF0C0', '#FFD08A') + ridge([[0, 92], [40, 70], [90, 84], [140, 62], [200, 80], [250, 60], [310, 82], [360, 68]], 112, '#8E7A9A') + ridge([[0, 100], [60, 88], [120, 98], [190, 90], [270, 98], [360, 90]], 112, '#B08A6A') +
      [[102, 20, 1], [200, 16, .8], [268, 26, 1.2]].map((m) => P('M' + (m[0] - 26 * m[2]) + ' 112Q' + (m[0] - 8 * m[2]) + ' ' + (112 - 10 * m[2]) + ' ' + (m[0] - 5 * m[2]) + ' ' + (112 - 30 * m[2]) + 'Q' + m[0] + ' ' + (112 - 34 * m[2]) + ' ' + (m[0] + 5 * m[2]) + ' ' + (112 - 30 * m[2]) + 'Q' + (m[0] + 8 * m[2]) + ' ' + (112 - 10 * m[2]) + ' ' + (m[0] + 26 * m[2]) + ' 112Z', '#B8884E') + P('M' + (m[0] - 5 * m[2]) + ' ' + (112 - 30 * m[2]) + 'Q' + m[0] + ' ' + (112 - 34 * m[2]) + ' ' + (m[0] + 5 * m[2]) + ' ' + (112 - 30 * m[2]) + 'L' + (m[0] + 8 * m[2]) + ' ' + (112 - 18 * m[2]) + 'H' + (m[0] - 8 * m[2]) + ' Z', '#9A6E3A', 'opacity=".5"')).join(''),
    fore: () => [[22, 190], [44, 196], [330, 192]].map((w) => L('M' + w[0] + ' ' + w[1] + 'q6 -10 14 -8', '#7A5A30', 1.4) + C(w[0] + 14, w[1] - 8, 2.6, '#D63A2F') + C(w[0] + 8, w[1] - 7, 2.4, '#D63A2F')).join('') },
  S.qinghai = { sky: ['#4E9AE0', '#CFE8F8'], gy: 112, ground: ['#F2C833', '#E2B41E'],
    draw: () => cloud(80, 34, 1.2, '#fff', .9) + cloud(260, 44, 1, '#fff', .85) + peak(60, 98, 110, 56, '#7C8CA4', '#fff', .4) + peak(300, 98, 120, 62, '#7C8CA4', '#fff', .4) + peak(190, 98, 90, 36, '#8E9CB4', '#fff', .35) + R(0, 94, 360, 20, '#3FC0C0') + R(0, 94, 360, 4, '#7FE0E0') + P('M0 100q40 -4 80 0t80 0t80 0t80 0t40 0V114H0Z', '#2FA8B4', 'opacity=".4"') + flags(120, 74, 240, 80, 8) + L('M120 74v36M240 80v32', '#3a2a22', 1.4),
    fore: () => '' },
  S.shaanxi = { sky: ['#D9A070', '#F8E2BA'], gy: 108, ground: ['#B58A58', '#9E7544'],
    draw: () => sun(300, 48, 12, '#FFF0C0', '#FFD08A') + (() => { let o = R(260, 54, 32, 52, '#B8986A', 'stroke="#6a5030" stroke-width="1"'); for (let k = 0; k < 6; k++) o += R(256, 58 + k * 8.4, 40, 2.6, '#8A6A3E') + R(268, 62 + k * 8.4, 6, 4, '#4a3a2a') + R(280, 62 + k * 8.4, 6, 4, '#4a3a2a'); return o + P('M262 54L276 40L290 54Z', '#8A6A3E'); })() +
      R(0, 94, 252, 18, '#8A6A44') + [0, 1, 2].map((r) => { let o = ''; for (let i = 0; i < 17; i++) { const x = 10 + i * 14 + (r % 2) * 6, y = 96 + r * 6, h = 7.5; o += R(x - 2.6, y - h, 5.2, h, '#B07A50') + C(x, y - h - 2.4, 2.4, '#B07A50') + R(x - 3.2, y - h * .6, 6.4, 1.6, '#8A5A3A'); } return o; }).join('') },
  S.shandong = { sky: ['#F7A27A', '#FDE7C2'], gy: 112, ground: ['#8A9A7C', '#7A8A6C'],
    draw: () => sun(180, 74, 16, '#FFF0B0', '#FFC070') + P('M0 100Q60 88 120 98T240 94T360 98V114H0Z', '#fff', 'opacity=".72"') + P('M60 112L150 44Q166 34 182 44L270 112Z', '#7A7A8E') + P('M150 44Q166 34 182 44L196 58H136Z', '#8E8EA2', 'opacity=".8"') + L('M120 112q20 -12 36 -22t30 -22q10 -10 20 -16', '#F4F1E6', 3, 'stroke-dasharray="4 2"') +
      [64, 90, 262, 294].map((x, i) => pine(x, 112, 24 + i % 2 * 8, '#3E6E4E', '#3a2a22')).join('') + R(176, 28, 10, 6, '#C2362B') + P('M172 28h18l-3 -5h-12Z', '#4a3a30') },
  S.shanxi = { sky: ['#2B2A5A', '#E08A6A'], gy: 112, ground: ['#9A7A58', '#85663F'],
    draw: () => stars(18, 5, 36) + hills(84, 14, '#8A5A48', 4, 5) + R(0, 78, 360, 34, '#B88A5E') + (() => { let o = ''; for (let x = 0; x < 360; x += 12) o += R(x, 74, 7, 6, '#B88A5E'); o += R(0, 78, 360, 2, '#8A6A44'); o += R(138, 34, 84, 44, '#A8784A') + R(152, 48, 56, 30, '#7E5A38') + R(168, 56, 24, 22, '#2a1a12') + P('M130 34Q180 14 230 34L218 26Q180 12 142 26Z', '#4a3a30') + P('M142 48Q180 34 218 48L208 42Q180 30 152 42Z', '#4a3a30'); return o + L('M138 34h84', '#3a2a22', 1); })() +
      [[24, 92], [52, 100], [86, 94], [262, 94], [296, 100], [332, 92]].map((l) => lantern(l[0], l[1], 1.1) + C(l[0], l[1] + 3, 9, '#FFB060', 'opacity=".18"')).join('') + R(20, 84, 320, 1.6, '#3a2a22', 'opacity=".0"') },
  S.sichuan = { sky: ['#B8DCCB', '#EEF4E0'], gy: 108, ground: ['#6FA05A', '#5C8E4A'],
    draw: () => peak(70, 110, 110, 66, '#8FB0A8') + peak(150, 110, 100, 86, '#7EA096') + peak(290, 110, 120, 70, '#8FB0A8') + P('M0 94Q60 84 130 96T250 90T360 94V112H0Z', '#fff', 'opacity=".7"') + cloud(210, 40, 1, '#fff', .7) +
      (() => { let o = E(262, 108, 22, 4, 'rgba(0,0,0,.18)') + E(262, 96, 17, 15, '#F8F8F4') + C(262, 78, 11, '#F8F8F4') + C(254, 70, 4.4, '#2a2a30') + C(270, 70, 4.4, '#2a2a30') + E(257, 78, 3.2, 4, '#2a2a30', 'transform="rotate(-14 257 78)"') + E(267, 78, 3.2, 4, '#2a2a30', 'transform="rotate(14 267 78)"') + C(257, 78, 1, '#fff') + C(267, 78, 1, '#fff') + E(262, 84, 3, 2, '#2a2a30') + E(246, 100, 5, 10, '#2a2a30', 'transform="rotate(20 246 100)"') + E(278, 100, 5, 10, '#2a2a30', 'transform="rotate(-20 278 100)"') + E(252, 108, 5, 4, '#2a2a30') + E(272, 108, 5, 4, '#2a2a30'); return o + L('M232 100q10 -6 16 -2M276 98q8 -4 14 0', '#4E8A3E', 3); })(),
    fore: () => bamboo(24, 212, 80, '#5E9A4E') + bamboo(46, 212, 62, '#4E8A3E') + bamboo(332, 212, 76, '#5E9A4E') + bamboo(346, 212, 56, '#4E8A3E') },
  S.xinjiang = { sky: ['#5AA8E8', '#DDEEFA'], gy: 108, ground: ['#C9B070', '#B49A5A'],
    draw: () => cloud(60, 36, 1, '#fff', .9) + peak(100, 100, 140, 74, '#7C8CB4', '#fff', .45) + peak(250, 100, 160, 86, '#6E7EA8', '#fff', .45) + peak(340, 100, 90, 44, '#8C9CC0', '#fff', .35) + R(0, 96, 360, 16, '#3FB0D0') + R(0, 96, 360, 3, '#8FE0F0') +
      [22, 56, 300, 330].map((x, i) => R(x - 1.4, 94, 2.8, 22 + i % 2 * 6, '#6A5030') + E(x, 84 + i % 2 * 4, 7, 15, '#E8A526') + E(x - 3, 90 + i % 2 * 4, 5, 10, '#F4C040')).join('') + yurt(170, 112, .6),
    fore: () => L('M0 176h360', '#6A5030', 3) + [[30, 6], [70, 4], [120, 8], [170, 5], [220, 7], [270, 4], [320, 6]].map((g, i) => L('M' + g[0] + ' 176v8', '#4E8A3E', 1) + C(g[0], 188 + g[1] % 3, 3.2, '#7A3A9E') + C(g[0] + 5, 186 + g[1] % 3, 3, '#8E4AB4') + C(g[0] - 4, 187, 2.8, '#6A2A8E')).join('') },
  S.xizang = { sky: ['#2F7FE0', '#BFE0FA'], gy: 108, ground: ['#C8B98A', '#B4A474'],
    draw: () => cloud(260, 34, 1.1, '#fff', .95) + cloud(70, 50, .9, '#fff', .9) + peak(60, 106, 110, 60, '#9AA8C4', '#fff', .45) + peak(310, 106, 130, 70, '#8E9CB8', '#fff', .45) + hills(100, 8, '#B4A474', 3, 5) + R(130, 86, 100, 22, '#F4F1E6') + P('M126 108l8 -22h92l8 22Z', '#EDE6D4') + R(150, 56, 60, 32, '#B8362E') + R(158, 38, 44, 20, '#B8362E') + R(168, 30, 24, 10, '#E0A526') + P('M146 56h68l-6 -6h-56Z', '#E0A526') + P('M154 38h52l-5 -5h-42Z', '#E0A526') + P('M162 30h36l-4 -5h-28Z', '#E0A526') + [160, 174, 188, 198].map((x) => R(x, 64, 5, 7, '#4a1a16')).join('') + R(136, 94, 10, 12, '#4a3a30') + R(214, 94, 10, 12, '#4a3a30') + flags(30, 60, 140, 90, 7) + flags(350, 54, 232, 88, 7),
    fore: () => '' },
  S.yunnan = { sky: ['#6FB8E8', '#EAF4F4'], gy: 110, ground: ['#7CB058', '#68A046'],
    draw: () => cloud(80, 36, 1, '#fff', .9) + peak(180, 100, 190, 80, '#7E92B4', '#fff', .55) + peak(70, 100, 100, 44, '#8EA2C0', '#fff', .3) + peak(300, 100, 90, 40, '#8EA2C0', '#fff', .3) + hills(100, 14, '#4E8A5E', 7, 5) +
      [[40, 8], [74, 6], [110, 9], [250, 7], [290, 9], [328, 6]].map((h, i) => R(h[0], 108 - h[1] * 1.2, 22, h[1] * 1.2 + 2, '#E8DFC8') + P('M' + (h[0] - 3) + ' ' + (108 - h[1] * 1.2) + 'L' + (h[0] + 11) + ' ' + (108 - h[1] * 1.2 - 8) + 'L' + (h[0] + 25) + ' ' + (108 - h[1] * 1.2) + 'Z', '#5a5a64') + R(h[0] + 8, 100, 6, 8, '#6a4a30')).join('') + pine(150, 112, 30, '#2E6A3E', '#3a2a22') + pine(210, 112, 26, '#2E6A3E', '#3a2a22'),
    fore: () => P('M0 190Q60 178 120 188T240 184T360 186V210H0Z', '#5E9A3E') + L('M0 196q40 -8 90 -2M120 200q60 -10 120 -2M250 198q50 -8 110 -4', '#86C05E', 1.6) },
  S.zhejiang = { sky: ['#C9DDE8', '#F4F2E6'], gy: 112, ground: ['#7CAE6A', '#68A058'],
    draw: () => hills(80, 22, '#9DBEA0', 6, 5) + hills(92, 14, '#7CA484', 3, 4) + P('M236 96l10 -34h26l10 34Z', '#9A6A48') + (() => { let o = ''; for (let i = 0; i < 4; i++) { const y = 62 - i * 10, w = 22 - i * 3; o += R(259 - w / 2 + 2, y - 8, w - 4, 8, '#C99A68') + P('M' + (259 - w / 2 - 2) + ' ' + y + 'L259 ' + (y - 9) + 'L' + (259 + w / 2 + 2) + ' ' + y + 'Z', '#5a3a2a'); } return o + L('M259 20v-8', '#E0A526', 1.4); })() +
      R(0, 102, 360, 14, '#8EC0CC') + waves(102, 116, '#fff', .4) + P('M70 108q30 -18 60 0', 'none', 'stroke="#9A8A7A" stroke-width="4"') + P('M70 108q30 -18 60 0', 'none', 'stroke="#D8C8B0" stroke-width="2"') +
      [[28, 80], [330, 76], [310, 84]].map((w) => L('M' + w[0] + ' ' + w[1] + 'v36', '#6A5030', 2.4) + L('M' + w[0] + ' ' + (w[1] + 2) + 'q-14 8 -16 38M' + w[0] + ' ' + (w[1] + 2) + 'q14 8 16 38M' + w[0] + ' ' + (w[1] + 6) + 'q-6 10 -6 30M' + w[0] + ' ' + (w[1] + 6) + 'q6 10 6 30', '#8CC864', 1.6)).join('') },
  S.taiwan = { sky: ['#2F5A8E', '#F4A86A'], gy: 112, ground: ['#5C6A78', '#4C5A68'],
    draw: () => stars(14, 4, 36) + ridge([[0, 98], [50, 74], [110, 90], [170, 70], [230, 92], [300, 76], [360, 90]], 112, '#3E5A6E') + ridge([[0, 106], [80, 94], [160, 104], [240, 96], [360, 104]], 112, '#2F4A5C') +
      (() => { let o = '', x = 196; o += R(x - 5, 44, 10, 62, '#3E9AA8'); [[0, 7, 22], [1, 8, 24], [2, 9, 26]].forEach(() => {}); for (let i = 0; i < 8; i++) { const y = 106 - (i + 1) * 7.4; o += P('M' + (x - 9) + ' ' + (y + 7.4) + 'L' + (x - 6) + ' ' + y + 'H' + (x + 6) + 'L' + (x + 9) + ' ' + (y + 7.4) + 'Z', i % 2 ? '#52B0BC' : '#3E9AA8') + R(x - 5.6, y + 2, 11.2, 1.2, '#FFE9A8', 'opacity=".7"'); } o += R(x - 4, 36, 8, 10, '#3E9AA8') + R(x - 2.6, 24, 5.2, 12, '#52B0BC') + L('M' + x + ' 24v-12', '#8FD0D8', 1.6); return o; })() +
      [[60, 52, 1], [112, 36, .8], [268, 46, 1.1], [318, 30, .8], [28, 26, .7]].map((l) => R(l[0] - 5 * l[2], l[1] - 7 * l[2], 10 * l[2], 14 * l[2], '#FFD88A') + C(l[0], l[1], 14 * l[2], '#FFB060', 'opacity=".22"') + R(l[0] - 5 * l[2], l[1] + 6 * l[2], 10 * l[2], 1.6, '#C2362B')).join('') },
  S.hongkong = { sky: ['#0A1230', '#3A2A5E'], gy: 114, ground: ['#4C5568', '#3E4658'],
    draw: () => stars(18, 9, 34) + C(310, 28, 8, '#F4F1E6') + ridge([[0, 80], [40, 60], [90, 74], [150, 90], [360, 90]], 112, '#1A2240') +
      [[40, 70, 16, 40], [64, 56, 12, 54], [84, 78, 18, 32], [244, 60, 14, 52], [264, 48, 18, 64], [290, 70, 16, 42], [312, 58, 12, 54], [332, 74, 18, 36], [120, 84, 20, 26], [210, 78, 16, 32]].map((b, i) => R(b[0], 112 - b[3], b[2], b[3], i % 3 ? '#232C52' : '#2C3560') + win(b[0], 112 - b[3], b[2], b[3], '#FFD98A', 20 + i, .42)).join('') + R(176, 40, 14, 72, '#2C3560') + P('M176 40l7 -10l7 10Z', '#2C3560') + L('M183 30v-12', '#8FD0F0', 1.4) + win(176, 40, 14, 72, '#8FD0F0', 41, .5) +
      R(0, 108, 360, 10, '#1A2A58') + [[30, '#FF4A8A'], [90, '#4AE0FF'], [200, '#FFD94A'], [290, '#FF4A8A']].map((n) => R(n[0], 111, 22, 2, n[1], 'opacity=".7"')).join('') + P('M122 108l26 0l-4 -8l-18 0Z', '#C2362B') + L('M135 100v-14', '#e8d8b0', 1.2) + P('M135 86l12 10h-12Z', '#C2362B', 'opacity=".9"') },
  S.macau = { sky: ['#7EC8D8', '#F7ECD0'], gy: 108, ground: ['#E8E4D8', '#D8D4C8'],
    draw: () => cloud(60, 38, 1, '#fff', .9) + cloud(290, 30, .8, '#fff', .85) + R(300, 20, 5, 70, '#E8E4D8') + E(302, 34, 12, 6, '#D8D4C8') + R(298, 90, 9, 20, '#D8D4C8') + (() => { let o = P('M110 108V52L180 36L250 52V108Z', '#C8C0AC'); o += P('M110 52L180 36L250 52L180 30Z', '#A8A090'); o += P('M150 44L180 20L210 44Z', '#B8B09C') + C(180, 36, 4, '#8A8270'); o += R(124, 56, 112, 3, '#8A8270') + R(124, 76, 112, 3, '#8A8270'); [[124, 64], [152, 64], [180, 64], [208, 64]].forEach((c) => o += R(c[0], c[1], 20, 12, '#8A8270') + P('M' + c[0] + ' ' + c[1] + 'q10 -8 20 0Z', '#8A8270')); [136, 164, 200, 224].forEach((x) => o += R(x, 82, 12, 26, '#6A6254') + P('M' + x + ' 82q6 -8 12 0Z', '#6A6254')); o += P('M158 108V90q22 -22 44 0V108Z', '#4a4234') + [126, 170, 196, 232].map((x) => R(x, 58, 6, 6, '#E0DCCC')).join(''); return o; })(),
    fore: () => '' },
  S.singapore = { sky: ['#2A2F78', '#F59AA0'], gy: 114, ground: ['#5A6C7C', '#4A5C6C'],
    draw: () => stars(14, 6, 40) + R(0, 104, 360, 14, '#2F6A9E') + waves(104, 118, '#fff', .28) + (() => { let o = ''; [118, 156, 194].forEach((x) => { o += P('M' + x + ' 108l8 -62l8 62Z', '#C8D0DA') + P('M' + (x + 8) + ' 46l8 62h-8Z', '#9AA4B4'); }); o += P('M104 44h112q4 -6 -2 -8H108q-6 2 -4 8Z', '#E8EEF2') + E(184, 38, 28, 3, '#9AD0E0', 'opacity=".8"') + P('M162 32h42l4 6h-48Z', '#D8E0EA'); return o + win(118, 60, 16, 46, '#FFE9A8', 30, .3); })() +
      [[40, 70], [64, 58], [88, 76], [262, 66], [288, 52], [314, 72]].map((t, i) => L('M' + t[0] + ' 108V' + t[1] + 20, '#5a4a6a', 3) + P('M' + (t[0] - 13) + ' ' + (t[1] + 6) + 'Q' + t[0] + ' ' + (t[1] - 12) + ' ' + (t[0] + 13) + ' ' + (t[1] + 6) + 'Q' + t[0] + ' ' + (t[1] + 14) + ' ' + (t[0] - 13) + ' ' + (t[1] + 6) + 'Z', i % 2 ? '#E04AA0' : '#B044D0') + L('M' + (t[0] - 10) + ' ' + (t[1] + 8) + 'L' + t[0] + ' ' + (t[1] + 20) + 'L' + (t[0] + 10) + ' ' + (t[1] + 8), '#5E9A5E', 2)).join('') },
  // a plain pair of hills for a region that has no scene yet
  S._default = { sky: ['#9CC8EE', '#EAF4FA'], gy: 108, ground: ['#7CAE6A', '#68A058'], draw: () => cloud(80, 40, 1, '#fff') + hills(96, 24, '#8FBF86', 3, 5) + hills(104, 12, '#7CAE6A', 5, 4) };

  // ---- the road ----
  // positions of the stops along the road (x, y, size)
  const NODE = { d0: [28, 156, 8.4], d1: [88, 144, 9], me: [152, 152, 17], nx: [236, 128, 16], md: [290, 138, 7.6], gl: [334, 118, 13] };
  const curve = (pts) => { if (pts.length < 2) return ''; let d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; d += 'Q' + f(a[0] + (b[0] - a[0]) * .25) + ' ' + f(a[1]) + ' ' + f(mx) + ' ' + f(my); if (i === pts.length - 1) d += 'T' + f(b[0]) + ' ' + f(b[1]); } return d; };
  const pill = (x, y, text, bold) => { const w = Math.round(text.length * 5.9 + 12); x = Math.max(6 + w / 2, Math.min(354 - w / 2, x)); return '<g class="jr-lab"><rect x="' + f(x - w / 2) + '" y="' + f(y - 10) + '" width="' + w + '" height="15" rx="7.5" fill="rgba(248,250,247,.92)"/><text x="' + f(x) + '" y="' + f(y + .5) + '" text-anchor="middle" font-size="10.5" font-weight="' + (bold ? 700 : 600) + '" fill="#14212A">' + String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text></g>'; };
  // the picture on the mystery stop: what kind of place it is, never which one
  const kindIcon = (k, x, y) => {
    const g = (inner) => '<g transform="translate(' + x + ' ' + y + ')" fill="none" stroke="#F8FAF7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>';
    if (k === 'D') return g('<path d="M-10 0h20a10 9 0 0 1 -20 0Z"/><path d="M-4 9.6h8"/><path d="M-3 -2l9 -9M1 -2l9 -8"/>');
    if (k === 'A') return g('<path d="M-10 8L-3 -6L2 1L5 -3L10 8Z"/><path d="M-3 -6l2 3"/>');
    if (k === 'C') return g('<path d="M0 -10v3"/><ellipse cx="0" cy="0" rx="6" ry="7.4"/><path d="M-6 -2h12M-6 2h12"/><path d="M0 7.4v4"/>');
    if (k === 'T') return g('<path d="M-10 9V-1h6v10M-4 9V-8h7v17M3 9V0h7v9M-10 9h20"/><path d="M-1 -4h1M-1 0h1"/>');
    if (k === 'F') return g('<path d="M-10 2l8 -2l6 -9l3 1l-3 8l7 -1l2 2l-7 3l-7 4l-2 -2l2 -4l-6 2Z"/>');
    return g('<path d="M-6 -4a6 6 0 1 1 8 5c-2 1.4 -2 2 -2 4"/><path d="M0 9h.1"/>');
  };
  const roadSvg = (m) => {
    m = m || {};
    const pts = [], dn = Math.max(0, Math.min(2, m.done == null ? 2 : m.done));
    if (dn >= 2) pts.push(NODE.d0); if (dn >= 1) pts.push(NODE.d1); pts.push(NODE.me); pts.push(NODE.nx); if (m.mid) pts.push(NODE.md); pts.push(NODE.gl);
    const idx = pts.indexOf(NODE.me), behind = pts.slice(0, idx + 1), after = pts.slice(idx);
    const pct = Math.max(0, Math.min(1, m.ready ? 1 : (m.pct || 0)));
    const toNext = [NODE.me, NODE.nx];
    const full = curve(behind), seg = curve(toNext), rest = curve(pts.slice(idx + 1));
    let o = '';
    // the whole road: a dark edge, then a pale surface; the part behind you is green, the part toward the next stop fills gold with your coins
    o += L(curve(pts), 'rgba(20,33,42,.34)', 11) + L(curve(pts), 'rgba(250,248,240,.96)', 7.6);
    if (behind.length > 1) o += L(full, '#4E8A22', 5.6);
    o += '<path class="jr-gold" d="' + seg + '" fill="none" stroke="#E0A526" stroke-width="5.6" stroke-linecap="round" pathLength="100" stroke-dasharray="' + f(pct * 100) + ' 100"/>';
    o += '<path d="' + curve(pts.slice(idx + 1)) + '" fill="none" stroke="#4A5C65" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1.5 7" opacity=".0"/>';
    // stops behind you
    behind.slice(0, -1).forEach((p) => { o += C(p[0], p[1], p[2], '#4E8A22', 'stroke="#F8FAF7" stroke-width="3"') + L('M' + f(p[0] - 3.4) + ' ' + p[1] + 'l2.6 2.8l4.6 -5.6', '#fff', 2); });
    // the stop after the next one
    if (m.mid) o += C(NODE.md[0], NODE.md[1], NODE.md[2], '#F8FAF7', 'stroke="#4A5C65" stroke-width="2.6"') + '<text x="' + NODE.md[0] + '" y="' + (NODE.md[1] + 3.4) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#4A5C65">?</text>';
    // the goal: a city stamp, the region seal, or nothing
    const gl = m.goal || { kind: 'none' };
    if (gl.kind !== 'none') { const g = NODE.gl, rr = g[2]; o += C(g[0], g[1], rr, '#F8FAF7', 'stroke="#B93227" stroke-width="2.6" stroke-dasharray="3 3"') + '<text x="' + g[0] + '" y="' + (g[1] + (gl.kind === 'region' ? 4.2 : 5.6)) + '" text-anchor="middle" font-family="\'Noto Serif SC\',serif" font-size="' + (gl.kind === 'region' ? 11 : 15) + '" font-weight="700" fill="#B93227">' + (gl.zh || '') + '</text>'; }
    // the next stop: a dark disc with the kind of place on it, pulsing gently
    const n = NODE.nx;
    o += '<circle class="' + (m.ready ? 'jr-ping' : 'jr-still') + '" cx="' + n[0] + '" cy="' + n[1] + '" r="' + (n[2] + 3) + '" fill="none" stroke="#E0A526" stroke-width="2"/>';
    o += C(n[0], n[1], n[2], '#14212A', 'stroke="#F8FAF7" stroke-width="2.4"') + kindIcon((m.next || {}).kind || 'D', n[0], n[1] + 1) + C(n[0] + n[2] * .74, n[1] - n[2] * .74, 5.6, '#E0A526', 'stroke="#F8FAF7" stroke-width="1.6"') + '<text x="' + f(n[0] + n[2] * .74) + '" y="' + f(n[1] - n[2] * .74 + 3.4) + '" text-anchor="middle" font-size="9.4" font-weight="800" fill="#14212A">?</text>';
    // you
    const me = NODE.me;
    if (m.avatar) o += '<g class="jr-me"><circle cx="' + me[0] + '" cy="' + me[1] + '" r="' + (me[2] + 2) + '" fill="#F8FAF7" stroke="rgba(20,33,42,.35)" stroke-width="1"/><image href="' + m.avatar + '" x="' + (me[0] - me[2] + 2) + '" y="' + (me[1] - me[2] + 2) + '" width="' + (me[2] * 2 - 4) + '" height="' + (me[2] * 2 - 4) + '"/></g>';
    else o += '<g class="jr-me"><circle cx="' + me[0] + '" cy="' + me[1] + '" r="' + me[2] + '" fill="#B93227" stroke="#F8FAF7" stroke-width="3"/><text x="' + me[0] + '" y="' + (me[1] + 6) + '" text-anchor="middle" font-family="\'Noto Serif SC\',serif" font-size="16" font-weight="700" fill="#fff">' + (m.home ? '家' : '我') + '</text></g>';
    // the labels
    o += pill(me[0], me[1] + me[2] + 14, m.meLabel || (m.home ? 'You, at home' : 'You are here'), true);
    o += pill(n[0], n[1] + n[2] + 14, (m.next && m.next.label) || 'Next stop', true);
    // X2, the trip happening on the road (styles.css "travel on the road"): you walk to the next stop, a train takes you there, or you lift off for a flight
    if (m.go) {
      if (m.go !== 'fly') o = o.replace('<g class="jr-me">', '<path class="jr-walked" d="' + seg + '" fill="none" stroke="#4E8A22" stroke-width="5.6" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="100"/><g class="jr-me">');
      if (m.go === 'leg') o += '<g transform="translate(' + me[0] + ' ' + me[1] + ')" aria-hidden="true"><g class="jr-train"><g transform="translate(0 -7)">' +
        ['-1', '1.3', '2.1'].map((d, i) => '<circle class="jr-puff" style="animation-delay:' + (0.25 + i * 0.45) + 's" cx="17" cy="-15" r="' + (3 + i * 0.4) + '" fill="#fff"/>').join('') +
        '<rect x="-23" y="-9" width="26" height="15" rx="3" fill="#2F6B4F" stroke="#F8FAF7" stroke-width="1.6"/><rect x="-20" y="-6" width="8" height="6" rx="1.4" fill="#FBF6E9"/><rect x="-10" y="-6" width="8" height="6" rx="1.4" fill="#FBF6E9"/>' +
        '<rect x="4" y="-12" width="19" height="18" rx="3.4" fill="#B93227" stroke="#F8FAF7" stroke-width="1.6"/><rect x="14" y="-17" width="5" height="6" rx="1" fill="#14212A"/>' +
        '<text x="13.5" y="2" text-anchor="middle" font-family="\'Noto Serif SC\',serif" font-size="11" font-weight="700" fill="#fff">我</text>' +
        [-17, -4, 9, 18].map((x) => '<circle cx="' + x + '" cy="7.5" r="3" fill="#14212A" stroke="#F8FAF7" stroke-width="1"/>').join('') + '</g></g></g>';
      o = '<g class="jr-go jr-go-' + m.go + '">' + o + '</g>';
    }
    return o;
  };

  const sceneSvg = (rid) => {
    const S0 = S[rid] || S._default, gy = S0.gy || 108, g = S0.ground || ['#7CAE6A', '#68A058'];
    const gid = 'jys-' + (rid || 'x'), body = S0.draw();
    // two birds cross the sky now and then (day scenes only: a night sky has stars)
    const birds = body.indexOf('js-tw') >= 0 ? '' : '<g class="js-birds">' + [[0, 0, 1], [9, 4, .8]].map((b) => '<path class="js-bd" d="M' + b[0] + ' ' + f(46 + b[1]) + 'q' + f(3 * b[2]) + ' ' + f(-3 * b[2]) + ' ' + f(6 * b[2]) + ' 0q' + f(3 * b[2]) + ' ' + f(-3 * b[2]) + ' ' + f(6 * b[2]) + ' 0" fill="none" stroke="#33424B" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>').join('') + '</g>';
    return '<defs>' + grad(gid, [[0, S0.sky[0]], [1, S0.sky[1]]]) + '</defs>' + R(0, 0, 360, 210, 'url(#' + gid + ')') + body + birds + ground(gy, g[0], g[1], g[2]) + (S0.fore ? S0.fore() : '');
  };
  const svg = (rid, model, label) => '<svg class="jr-svg" viewBox="0 0 360 210" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + String(label || 'Your road ahead').replace(/"/g, '&quot;') + '">' + sceneSvg(rid) + roadSvg(model) + '</svg>';
  const kindSvg = (k, stroke) => '<svg viewBox="-14 -14 28 28" aria-hidden="true">' + kindIcon(k, 0, 0).replace(/#F8FAF7/g, stroke || '#F8FAF7') + '</svg>';
  const api = { svg, kindSvg, scene: sceneSvg, road: roadSvg, IDS: Object.keys(S).filter((k) => k !== '_default'), NODE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JYSCENE = api;
})(typeof window !== 'undefined' ? window : globalThis);
