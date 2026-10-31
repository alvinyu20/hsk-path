/* Shanlu: the art for "The ascent" (the mountain trail and the mist mountains on the home screen).
 * Pure functions: they return SVG as a data address plus where to put the labels. No DOM, so they can be tested in node.
 * The scene is drawn in a fixed coordinate system and scaled by the page; label positions are returned in the same coordinates. */
(function (root) {
  const LIGHT = { sky:'#F8FAF7', far:'#C9DDD3', mid:'#8FBFAE', main:'#1D6B58', near:'#14504A', fog:'#F8FAF7', path:'#F8FAF7', sun:'#C2362B', walk:'#C2362B', stone:'#F8FAF7', stoneFar:'#9CB8AE', ring:'#C2362B', pole:'#F8FAF7', white:'#FFFFFF' };
  const DARK  = { sky:'#15252D', far:'#1F3A41', mid:'#2A5A55', main:'#2C7B69', near:'#143B36', fog:'#1C303A', path:'#E8EFEB', sun:'#E2574A', walk:'#E2574A', stone:'#E8EFEB', stoneFar:'#4A6A66', ring:'#E2574A', pole:'#E8EFEB', white:'#E8EFEB' };

  const uri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const r1 = (n) => Math.round(n * 10) / 10;

  // smooth curve through points (Catmull-Rom turned into cubic curves)
  const curve = (pts) => {
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + r1(c1[0]) + ' ' + r1(c1[1]) + ' ' + r1(c2[0]) + ' ' + r1(c2[1]) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  };

  const flag = (x, y, fill, stroke, fillOp, size, c) => {
    const h = Math.round(30 * size), w = Math.round(18 * size), t = Math.round(5 * size), k = Math.round(6 * size);
    return '<path d="M' + x + ' ' + y + ' v-' + h + '" stroke="' + c.pole + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M' + x + ' ' + (y - h) + ' h' + w + ' l-' + t + ' ' + k + ' l' + t + ' ' + k + ' h-' + w + ' z" fill="' + fill + '" fill-opacity="' + fillOp + '" stroke="' + stroke + '" stroke-width="1.6" stroke-linejoin="round"/>';
  };
  const cairn = (x, y, col) =>
    '<ellipse cx="' + x + '" cy="' + r1(y) + '" rx="7" ry="3.4" fill="' + col + '"/><ellipse cx="' + x + '" cy="' + r1(y - 5) + '" rx="5" ry="2.8" fill="' + col + '"/><ellipse cx="' + x + '" cy="' + r1(y - 9.5) + '" rx="3.2" ry="2.2" fill="' + col + '"/>';

  // which of the nine drawn camp spots a level system uses (6 levels spread over the same path)
  const spread = (n) => (n >= 9 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : n === 6 ? [0, 2, 3, 5, 6, 8] : Array.from({ length:n }, (_, i) => Math.round(i * 8 / Math.max(1, n - 1))));
  const MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300];
  const nextMilestone = (started, total) => { const m = MILESTONES.filter(x => x <= total).find(x => x > started); return m || total; };

  // ---------------------------------------------------------------- desktop trail: 1124 x 380
  const D = {
    w:1124, h:380, p0:[48, 358],
    anchors:[[320, 344], [440, 330], [545, 306], [640, 276], [722, 244], [790, 208], [846, 168], [888, 124], [918, 72]],
    // label offsets from each camp spot: [dx, dy, withSub]
    off:[[0, -112, true], [14, -46, true], [14, -46, true], [14, -34, false], [14, -34, false], [14, -34, false], [14, -34, false], [14, -34, false], [14, -34, false]]
  };
  const trail = (o) => {
    const c = o.dark ? DARK : LIGHT;
    const total = o.total || 300, started = Math.max(0, Math.min(total, o.started || 0));
    const idx = spread(o.levels.length);
    const camps = idx.map((a, i) => ({ x:D.anchors[a][0], y:D.anchors[a][1], i, a }));
    const L1 = camps[0];
    const frac = started / total;
    const lineAt = (f) => [r1(D.p0[0] + f * (L1.x - D.p0[0])), r1(D.p0[1] + f * (L1.y - D.p0[1]))];
    const you = lineAt(frac);
    const pts = [D.p0].concat(camps.map(k => [k.x, k.y]));
    const nm = nextMilestone(started, total);
    const s = [];
    s.push('<rect width="1124" height="380" fill="' + c.sky + '"/>');
    s.push('<circle cx="1062" cy="74" r="28" fill="' + c.sun + '" fill-opacity=".92"/>');
    s.push('<path d="M0 250 L90 205 L170 235 L270 170 L380 232 L470 190 L560 240 L650 160 L740 215 L840 120 L940 200 L1030 140 L1124 190 L1124 380 L0 380Z" fill="' + c.far + '"/>');
    s.push('<path d="M0 300 L120 255 L230 290 L340 240 L450 285 L560 235 L690 290 L800 205 L930 270 L1050 215 L1124 250 L1124 380 L0 380Z" fill="' + c.mid + '"/>');
    s.push('<path d="M420 380 L560 300 L650 250 L730 205 L800 150 L862 96 L905 50 L950 100 L1010 160 L1070 230 L1124 270 L1124 380Z" fill="' + c.main + '"/>');
    s.push('<path d="M0 380 L0 336 Q 120 306 250 338 Q 340 360 440 352 L540 380Z" fill="' + c.near + '"/>');
    s.push('<path d="' + curve(pts) + '" fill="none" stroke="' + c.path + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9" opacity=".95"/>');
    if (started > 0) s.push('<path d="M' + D.p0[0] + ' ' + D.p0[1] + ' L' + you[0] + ' ' + you[1] + '" fill="none" stroke="' + c.walk + '" stroke-width="5" stroke-linecap="round"/>');
    const stones = [];
    MILESTONES.filter(m => m < total).forEach(m => {
      const p = lineAt(m / total); const done = started >= m; const isNext = m === nm;
      if (isNext) s.push('<circle cx="' + p[0] + '" cy="' + r1(p[1] - 4) + '" r="12" fill="none" stroke="' + c.ring + '" stroke-width="2" opacity=".7"/>');
      s.push(cairn(p[0], p[1], done ? c.stone : c.stoneFar));
      stones.push({ m, x:p[0], y:p[1], done, next:isNext });
    });
    camps.forEach((k, i) => {
      if (i === 0) {
        s.push('<circle cx="' + k.x + '" cy="' + k.y + '" r="15" fill="none" stroke="' + c.ring + '" stroke-width="2" opacity=".55"/><circle cx="' + k.x + '" cy="' + k.y + '" r="24" fill="none" stroke="' + c.ring + '" stroke-width="1.5" opacity=".3"/>');
        s.push(flag(k.x, k.y, c.ring, c.white, 1, 1.25, c));
      } else s.push(flag(k.x, k.y, c.stone, c.stone, i >= 5 ? 0.35 : 0.55, 1.0, c));
    });
    [[850, 134, 120, 42, .8], [926, 96, 84, 32, .85], [792, 196, 92, 26, .75], [716, 254, 74, 20, .7], [990, 176, 72, 22, .7]].forEach(f => {
      s.push('<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="' + f[2] + '" ry="' + f[3] + '" fill="' + c.fog + '" fill-opacity="' + f[4] + '"/>');
    });
    s.push('<circle cx="' + you[0] + '" cy="' + you[1] + '" r="15" fill="' + c.walk + '" fill-opacity=".25"/><circle cx="' + you[0] + '" cy="' + you[1] + '" r="9" fill="' + c.walk + '" stroke="' + c.white + '" stroke-width="2.5"/>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1124" height="380" viewBox="0 0 1124 380">' + s.join('') + '</svg>';
    const labels = camps.map((k, i) => {
      const lv = o.levels[i]; const off = D.off[k.a];
      return { x:k.x + off[0], y:k.y + off[1], center:i === 0, kind:i === 0 ? 'next' : (i <= 3 ? 'near' : 'far'), text:i === 0 ? 'Next camp · HSK ' + lv[0] + ' exam' : 'HSK ' + lv[0], sub:i === 0 ? (total - started) + ' words to go' : (off[2] ? (lv[1] ? lv[1] + ' words' : 'advanced') : '') };
    });
    return { src:uri(svg), w:1124, h:380, you:{ x:you[0], y:you[1] - 54 }, labels, stones, next:nm };
  };

  // ---------------------------------------------------------------- phone trail: 342 x 470
  const M = {
    w:342, h:470, p0:[70, 452],
    anchors:[[262, 414], [104, 364], [262, 316], [112, 268], [250, 222], [122, 178], [238, 134], [150, 92], [204, 50]],
    off:[[-112, -48, true], [26, -46, true], [-112, -44, true], [28, -42, false], [-106, -42, false], [26, -32, false], [-88, -34, false], [26, -30, false], [-74, -32, false]]
  };
  const phoneTrail = (o) => {
    const c = o.dark ? DARK : LIGHT;
    const total = o.total || 300, started = Math.max(0, Math.min(total, o.started || 0));
    const idx = spread(o.levels.length);
    const camps = idx.map((a, i) => ({ x:M.anchors[a][0], y:M.anchors[a][1], i, a }));
    const L1 = camps[0];
    const frac = started / total;
    const lineAt = (f) => [r1(M.p0[0] + f * (L1.x - M.p0[0])), r1(M.p0[1] + f * (L1.y - M.p0[1]))];
    const you = lineAt(frac);
    const pts = [M.p0].concat(camps.map(k => [k.x, k.y]));
    const s = [];
    s.push('<rect width="342" height="470" fill="' + c.sky + '"/>');
    s.push('<circle cx="300" cy="50" r="22" fill="' + c.sun + '" fill-opacity=".9"/>');
    s.push('<path d="M0 470 L0 300 L70 230 L120 260 L200 120 L260 170 L330 60 L342 80 L342 470Z" fill="' + c.far + '"/>');
    s.push('<path d="M0 470 L0 380 L60 330 L130 372 L220 250 L300 320 L342 280 L342 470Z" fill="' + c.mid + '"/>');
    s.push('<path d="M0 470 L0 440 Q 100 410 200 440 Q 280 460 342 430 L342 470Z" fill="' + c.near + '"/>');
    s.push('<path d="' + curve(pts) + '" fill="none" stroke="' + c.path + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9" opacity=".95"/>');
    if (started > 0) s.push('<path d="M' + M.p0[0] + ' ' + M.p0[1] + ' L' + you[0] + ' ' + you[1] + '" fill="none" stroke="' + c.walk + '" stroke-width="5" stroke-linecap="round"/>');
    camps.forEach((k, i) => {
      if (i === 0) { s.push('<circle cx="' + k.x + '" cy="' + k.y + '" r="15" fill="none" stroke="' + c.ring + '" stroke-width="2" opacity=".55"/>'); s.push(flag(k.x, k.y, c.ring, c.white, 1, 1.2, c)); }
      else s.push(flag(k.x, k.y, c.stone, c.stone, i >= 4 ? 0.4 : 0.7, 0.9, c));
    });
    [[120, 120, 110, 30, .85], [230, 70, 100, 28, .85], [170, 190, 120, 26, .8], [250, 250, 90, 22, .75]].forEach(f => {
      s.push('<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="' + f[2] + '" ry="' + f[3] + '" fill="' + c.fog + '" fill-opacity="' + f[4] + '"/>');
    });
    s.push('<circle cx="' + you[0] + '" cy="' + you[1] + '" r="15" fill="' + c.walk + '" fill-opacity=".25"/><circle cx="' + you[0] + '" cy="' + you[1] + '" r="9" fill="' + c.walk + '" stroke="' + c.white + '" stroke-width="2.5"/>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="470" viewBox="0 0 342 470">' + s.join('') + '</svg>';
    const labels = camps.map((k, i) => {
      const lv = o.levels[i]; const off = M.off[k.a];
      return { x:k.x + off[0], y:k.y + off[1], center:false, kind:i === 0 ? 'next' : (i <= 2 ? 'near' : 'far'), text:i === 0 ? 'HSK ' + lv[0] + ' exam' : 'HSK ' + lv[0], sub:i === 0 ? (total - started) + ' to go' : (off[2] ? (lv[1] ? lv[1] + ' words' : 'advanced') : '') };
    });
    return { src:uri(svg), w:342, h:470, you:{ x:Math.max(8, you[0] - 96), y:you[1] - 46 }, hideYou:frac > 0.6, labels };
  };

  // ---------------------------------------------------------------- mist mountains (one tile): w x h
  const mix = (a, b, t) => {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return '#' + pa.map((v, i) => ('0' + Math.round(v + (pb[i] - v) * t).toString(16)).slice(-2)).join('');
  };
  const mist = (o) => {
    const dark = !!o.dark, w = o.w || 212, h = o.h || 84, t = Math.max(0, Math.min(1, o.frac || 0)), idx = o.idx || 0;
    const sky = dark ? '#15252D' : '#F8FAF7';
    const far = dark ? mix('#1E3037', '#245246', t) : mix('#D5DDD8', '#B9D9CE', t);
    const mid = dark ? mix('#243B42', '#2E7B68', t) : mix('#B3C2BB', '#6AAE9A', t);
    const near = dark ? mix('#1B2F36', '#1F6B58', t) : mix('#8FA39B', '#1D6B58', t);
    const mistCol = dark ? '#1C303A' : '#F8FAF7';
    const shift = (idx * 37) % 60;
    const s = ['<rect width="' + w + '" height="' + h + '" fill="' + sky + '"/>'];
    if (t >= 1) s.push('<circle cx="34" cy="26" r="13" fill="' + (dark ? '#E2574A' : '#C2362B') + '" fill-opacity=".92"/>');
    const P = (x, y) => Math.round(x) + ' ' + Math.round(y);
    s.push('<path d="M0 ' + P(0, h * .62).split(' ')[1] + ' L' + P(w * .18, h * .34) + ' L' + P(w * .34, h * .58) + ' L' + P(w * .55, h * .24) + ' L' + P(w * .78, h * .56) + ' L' + P(w, h * .4) + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="' + far + '"/>');
    s.push('<path d="M0 ' + Math.round(h * .78) + ' L' + P(w * .22, h * .5) + ' L' + P(w * .42, h * .74) + ' L' + P(w * .64, h * .42) + ' L' + P(w * .86, h * .7) + ' L' + P(w, h * .6) + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="' + mid + '"/>');
    s.push('<path d="M0 ' + h + ' L0 ' + Math.round(h * .86) + ' Q ' + P(w * .3, h * .66) + ' ' + P(w * .55, h * .84) + ' Q ' + P(w * .8, h * .96) + ' ' + P(w, h * .8) + ' L' + w + ' ' + h + 'Z" fill="' + near + '"/>');
    const mo = 0.9 * (1 - t);
    if (mo > 0.02) {
      [[.3, .34, .42, .2], [.72, .5, .46, .2], [.45, .72, .55, .22], [.2, .6, .35, .16]].forEach((e, k) => {
        s.push('<ellipse cx="' + Math.round(e[0] * w + shift * .2) + '" cy="' + Math.round(e[1] * h) + '" rx="' + Math.round(e[2] * w) + '" ry="' + Math.round(e[3] * h) + '" fill="' + mistCol + '" fill-opacity="' + Math.min(0.92, mo + 0.05 * k).toFixed(2) + '"/>');
      });
    }
    return uri('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice">' + s.join('') + '</svg>');
  };

  root.ShanluAscent = { trail, phoneTrail, mist, nextMilestone, MILESTONES, spread };
})(typeof window !== 'undefined' ? window : globalThis);
