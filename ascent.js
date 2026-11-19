/* Shanlu: the art for "The ascent" (the mountain trail and the mist mountains on the home screen).
 * Pure functions: they return SVG as a data address plus where to put the labels. No DOM, so they can be tested in node.
 * The scene is drawn in a fixed coordinate system and scaled by the page; label positions are returned in the same coordinates. */
(function (root) {
  const LIGHT = { sky:'#F8FAF7', far:'#C9DDD3', mid:'#8FBFAE', main:'#1D6B58', near:'#14504A', fog:'#F8FAF7', path:'#F8FAF7', sun:'#C2362B', walk:'#C2362B', stone:'#F8FAF7', stoneFar:'#9CB8AE', ring:'#C2362B', pole:'#F8FAF7', white:'#FFFFFF', ink:'#14504A', gold:'#E8A92B', wood:'#8A5A33', water:'#6FBEDB', leaf:'#2E9A62', red:'#C2362B', rock:'#7D9A92', snow:'#FFFFFF', blk:'#1F2A30', cab:'#3C5A56' };
  const DARK  = { sky:'#15252D', far:'#1F3A41', mid:'#2A5A55', main:'#2C7B69', near:'#143B36', fog:'#1C303A', path:'#E8EFEB', sun:'#E2574A', walk:'#E2574A', stone:'#E8EFEB', stoneFar:'#4A6A66', ring:'#E2574A', pole:'#E8EFEB', white:'#E8EFEB', ink:'#0C1A1F', gold:'#F5BF4A', wood:'#B9834F', water:'#6AB7D4', leaf:'#4DB583', red:'#E2574A', rock:'#7C9A92', snow:'#E8EFEB', blk:'#10191D', cab:'#B9CBC5' };

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

  // ---------------------------------------------------------------- camp scenes: one small picture beside each HSK camp
  // Drawn around (0,0) = the ground; up is negative. A level always gets the same scene, wherever its camp sits on the path:
  // 1 campfire · 2 footbridge · 3 panda in bamboo · 4 waterfall and rainbow · 5 pagoda · 6 cable car · 7 cranes over pines · 8 dragon in the clouds · 9 summit sunburst.
  // The little movements are CSS inside the SVG (the picture is shown in an <img>, so there is no script) and they stop when someone asks for reduced motion.
  const STYLE = '<style>' +
    '.fl{transform-box:fill-box;transform-origin:50% 100%;animation:fl .45s ease-in-out infinite alternate}@keyframes fl{to{transform:scale(.82,1.18)}}' +
    '.sp{animation:sp 1.6s ease-out infinite}.sp.b{animation-delay:-.8s}@keyframes sp{0%{opacity:0;transform:translateY(4px)}30%{opacity:1}100%{opacity:0;transform:translateY(-9px)}}' +
    '.rp{stroke-dasharray:4 5;animation:rp 1.6s linear infinite}@keyframes rp{to{stroke-dashoffset:-18}}' +
    '.sw{transform-box:fill-box;transform-origin:50% 100%;animation:sw 3s ease-in-out infinite alternate}.sw.b{animation-duration:3.7s;animation-delay:-1.4s}@keyframes sw{to{transform:rotate(4deg)}}' +
    '.fa{stroke-dasharray:6 5;animation:fa .7s linear infinite}@keyframes fa{to{stroke-dashoffset:-11}}' +
    '.pf{transform-box:fill-box;transform-origin:50% 50%;animation:pf 2.4s ease-in-out infinite alternate}@keyframes pf{to{transform:scale(1.12,1.3)}}' +
    '.tw{animation:tw 1.8s ease-in-out infinite alternate}.tw.b{animation-delay:-.6s}.tw.c{animation-delay:-1.2s}@keyframes tw{to{opacity:.2}}' +
    '.gd{animation:gd 7s ease-in-out infinite alternate}@keyframes gd{to{transform:translate(28px,-22px)}}' +
    '.wg{transform-box:fill-box;transform-origin:50% 100%;animation:wg .5s ease-in-out infinite alternate}@keyframes wg{to{transform:scaleY(.3)}}' +
    '.dr{animation:dr 6s ease-in-out infinite alternate}.dr.b{animation-delay:-2s}.dr.c{animation-delay:-4s}@keyframes dr{to{transform:translate(-9px,-3px)}}' +
    '.dg{animation:dg 3.4s ease-in-out infinite alternate}@keyframes dg{to{transform:translate(0,-3px)}}' +
    '.rot{transform-box:fill-box;transform-origin:50% 50%;animation:rot 24s linear infinite}@keyframes rot{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>';

  const LM = [
    // 1 · base camp: a red tent and a flickering fire
    (c) => `<path d="M-26 0 L-13 -23 L0 0Z" fill="${c.red}" stroke="${c.ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-13 -14 L-9 0 H-17Z" fill="${c.ink}" fill-opacity=".6"/>` +
      `<path d="M5 -1 L19 -4 M5 -4 L19 -1" stroke="${c.wood}" stroke-width="3" stroke-linecap="round"/>` +
      `<g class="fl"><path d="M12 -4 C4 -10 10 -15 11 -24 C17 -17 20 -10 12 -4Z" fill="${c.gold}" stroke="${c.ink}" stroke-width="1" stroke-linejoin="round"/><path d="M12 -4 C8 -7 11 -11 12 -14 C15 -11 16 -7 12 -4Z" fill="${c.red}"/></g>` +
      `<circle class="sp" cx="9" cy="-24" r="1.3" fill="${c.gold}"/><circle class="sp b" cx="16" cy="-27" r="1.1" fill="${c.gold}"/>`,
    // 2 · a wooden footbridge over a stream
    (c) => `<ellipse cx="0" cy="-1" rx="26" ry="4.5" fill="${c.water}"/><path class="rp" d="M-20 2 H-10 M6 2 H18" stroke="${c.snow}" stroke-width="1.3" stroke-linecap="round" fill="none"/>` +
      `<path d="M-22 -2 Q0 -24 22 -2" fill="none" stroke="${c.ink}" stroke-width="7" stroke-linecap="round"/><path d="M-22 -2 Q0 -24 22 -2" fill="none" stroke="${c.wood}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M-10 -10 V-15.5 M0 -13 V-19 M10 -10 V-15.5" stroke="${c.red}" stroke-width="1.6"/><path d="M-18 -7 Q0 -31 18 -7" fill="none" stroke="${c.red}" stroke-width="2.2" stroke-linecap="round"/>`,
    // 3 · a panda eating bamboo
    (c) => `<g class="sw"><path d="M-18 0 V-38" stroke="${c.leaf}" stroke-width="3.4" stroke-linecap="round"/><path d="M-20 -13 h4 M-20 -25 h4" stroke="${c.ink}" stroke-width="1.2"/><path d="M-18 -34 q-9 -1 -11 -9 q9 1 11 9Z M-18 -27 q8 -2 10 -9 q-9 2 -10 9Z" fill="${c.leaf}"/></g>` +
      `<g class="sw b"><path d="M23 0 V-30" stroke="${c.leaf}" stroke-width="3.2" stroke-linecap="round"/><path d="M21 -10 h4 M21 -20 h4" stroke="${c.ink}" stroke-width="1.2"/><path d="M23 -27 q9 -1 11 -9 q-9 1 -11 9Z" fill="${c.leaf}"/></g>` +
      `<circle cx="-2.5" cy="-29.5" r="3" fill="${c.blk}"/><circle cx="8.5" cy="-29.5" r="3" fill="${c.blk}"/>` +
      `<ellipse cx="3" cy="-9" rx="9" ry="9" fill="${c.snow}" stroke="${c.ink}" stroke-width="1.2"/>` +
      `<ellipse cx="-2" cy="-1.5" rx="4" ry="3" fill="${c.blk}"/><ellipse cx="8" cy="-1.5" rx="4" ry="3" fill="${c.blk}"/>` +
      `<path d="M-6 -7 L13 -12" stroke="${c.leaf}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="-4" cy="-8" rx="3" ry="5.5" transform="rotate(25 -4 -8)" fill="${c.blk}"/><ellipse cx="10" cy="-11" rx="3" ry="5.5" transform="rotate(-25 10 -11)" fill="${c.blk}"/>` +
      `<circle cx="3" cy="-23" r="7.5" fill="${c.snow}" stroke="${c.ink}" stroke-width="1.2"/>` +
      `<ellipse cx="0" cy="-23.5" rx="2" ry="2.8" transform="rotate(20 0 -23.5)" fill="${c.blk}"/><ellipse cx="6" cy="-23.5" rx="2" ry="2.8" transform="rotate(-20 6 -23.5)" fill="${c.blk}"/><circle cx="0" cy="-23.8" r=".8" fill="${c.snow}"/><circle cx="6" cy="-23.8" r=".8" fill="${c.snow}"/><ellipse cx="3" cy="-20.5" rx="1.6" ry="1.1" fill="${c.blk}"/>`,
    // 4 · a waterfall with a rainbow in the spray
    (c) => `<path d="M-22 0 L-21 -26 L-12 -38 L-4 -41 L10 -41 L18 -34 L24 -22 L24 0Z" fill="${c.rock}" stroke="${c.ink}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M-4 -40 H8 L10 0 H-6Z" fill="${c.water}"/><path class="fa" d="M-1 -38 V-2 M3 -39 V-2 M7 -37 V-2" stroke="${c.snow}" stroke-width="1.6" fill="none"/>` +
      `<ellipse class="pf" cx="2" cy="-1" rx="15" ry="5" fill="${c.snow}" fill-opacity=".92"/>` +
      `<g fill="none" stroke-width="2" opacity=".75"><path d="M-28 0 A30 30 0 0 1 32 0" stroke="${c.red}"/><path d="M-25 0 A27 27 0 0 1 29 0" stroke="${c.gold}"/><path d="M-22 0 A24 24 0 0 1 26 0" stroke="${c.leaf}"/></g>`,
    // 5 · a three-tier pagoda with glowing windows
    (c) => {
      const roof = (y, w) => `<path d="M${-w} ${y} Q${r1(-w * .55)} ${y + 1} ${r1(-w * .3)} ${y - 6} H${r1(w * .3)} Q${r1(w * .55)} ${y + 1} ${w} ${y} Q${r1(w * .5)} ${y + 4} 0 ${y + 4} Q${r1(-w * .5)} ${y + 4} ${-w} ${y}Z" fill="${c.ink}" stroke="${c.gold}" stroke-width="1" stroke-linejoin="round"/>`;
      const body = (w, y0, y1) => `<rect x="${-w}" y="${y1}" width="${2 * w}" height="${y0 - y1}" fill="${c.red}"/>`;
      return body(8, 0, -11) + roof(-11, 17) + body(6, -13, -22) + roof(-22, 13) + body(4, -24, -31) + roof(-31, 10) +
        `<path d="M0 -37 V-47" stroke="${c.gold}" stroke-width="1.6"/><circle cx="0" cy="-47" r="2" fill="${c.gold}"/>` +
        `<circle class="tw" cx="0" cy="-5.5" r="2.2" fill="${c.gold}"/><circle class="tw b" cx="0" cy="-17" r="1.8" fill="${c.gold}"/><circle class="tw c" cx="0" cy="-27.5" r="1.5" fill="${c.gold}"/>`;
    },
    // 6 · a cable car climbing its wire
    (c) => `<path d="M19 0 L24 -46 L29 0 M21 -22 H27" fill="none" stroke="${c.cab}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<rect x="-29" y="-9" width="10" height="9" fill="${c.wood}" stroke="${c.ink}" stroke-width="1.1"/>` +
      `<path d="M-24 -8 L24 -46" stroke="${c.cab}" stroke-width="1.6" fill="none"/>` +
      `<g class="gd"><path d="M-12 -17.5 V-14" stroke="${c.cab}" stroke-width="1.4"/><rect x="-17" y="-14" width="10" height="8" rx="1.6" fill="${c.red}" stroke="${c.ink}" stroke-width="1"/><rect x="-15" y="-12.5" width="6" height="3.4" fill="${c.snow}"/></g>`,
    // 7 · cranes flying over snowy pines
    (c) => {
      const pine = (x, s) => `<rect x="${r1(x - 1.2)}" y="-5" width="2.4" height="5" fill="${c.wood}"/>` +
        `<path d="M${x} ${r1(-20 * s)} L${r1(x - 10 * s)} -4 H${r1(x + 10 * s)}Z" fill="${c.leaf}" stroke="${c.ink}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="M${x} ${r1(-30 * s)} L${r1(x - 8 * s)} ${r1(-12 * s)} H${r1(x + 8 * s)}Z" fill="${c.leaf}" stroke="${c.ink}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="M${x} ${r1(-30 * s)} L${r1(x - 3.4 * s)} ${r1(-23.5 * s)} H${r1(x + 3.4 * s)}Z" fill="${c.snow}"/>`;
      const crane = (x, y, cls) => `<g transform="translate(${x} ${y})"><g class="dr ${cls}">` +
        `<path d="M-4 0 L-9 1.5" stroke="${c.blk}" stroke-width="2" stroke-linecap="round"/><g class="wg"><path d="M-1 -1 L-3 -10 L4 -1Z" fill="${c.snow}" stroke="${c.ink}" stroke-width=".8" stroke-linejoin="round"/></g>` +
        `<ellipse cx="0" cy="0" rx="4.6" ry="1.9" fill="${c.snow}" stroke="${c.ink}" stroke-width=".8"/><path d="M4 -.5 L8 -3" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M4 -.5 L8 -3" stroke="${c.snow}" stroke-width="1.2" stroke-linecap="round"/>` +
        `<circle cx="8.6" cy="-3.4" r="1.4" fill="${c.snow}" stroke="${c.ink}" stroke-width=".6"/><circle cx="8.9" cy="-4.4" r=".7" fill="${c.red}"/><path d="M9.8 -3.2 h2.6" stroke="${c.gold}" stroke-width="1" stroke-linecap="round"/></g></g>`;
      return pine(-12, 1) + pine(8, .8) + pine(20, .6) + crane(-14, -46, '') + crane(4, -54, 'b') + crane(-2, -38, 'c');
    },
    // 8 · a dragon riding the clouds
    (c) => `<ellipse cx="-4" cy="-3" rx="15" ry="4.5" fill="${c.snow}"/><ellipse cx="14" cy="-1.5" rx="10" ry="3.6" fill="${c.snow}"/>` +
      `<g class="dg"><path d="M-20 -8 Q-28 -8 -27 -16 Q-22 -13 -20 -8Z" fill="${c.gold}" stroke="${c.ink}" stroke-width="1" stroke-linejoin="round"/>` +
      `<path d="M-20 -8 C-12 -4 -13 -19 -4 -18 C5 -17 2 -31 12 -30 C19 -29 20 -37 17 -43" fill="none" stroke="${c.ink}" stroke-width="7.4" stroke-linecap="round"/>` +
      `<path d="M-20 -8 C-12 -4 -13 -19 -4 -18 C5 -17 2 -31 12 -30 C19 -29 20 -37 17 -43" fill="none" stroke="${c.red}" stroke-width="5.4" stroke-linecap="round"/>` +
      `<path d="M-20 -8 C-12 -4 -13 -19 -4 -18 C5 -17 2 -31 12 -30 C19 -29 20 -37 17 -43" fill="none" stroke="${c.gold}" stroke-width="2" stroke-linecap="round" stroke-dasharray=".1 4.6"/>` +
      `<path d="M17 -49 L14 -56 M21 -49 L23 -56" stroke="${c.gold}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M12 -43 Q13 -50 21 -49 Q28 -48 29 -44 Q24 -41 18 -41 Q13 -40 12 -43Z" fill="${c.red}" stroke="${c.ink}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<circle cx="20.5" cy="-46.3" r="1.6" fill="${c.snow}"/><circle cx="20.9" cy="-46.3" r=".8" fill="${c.ink}"/><circle cx="27" cy="-45" r=".6" fill="${c.ink}"/>` +
      `<path d="M28 -44 Q34 -44 36 -39 M27 -42 Q32 -40 33 -35" stroke="${c.gold}" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`,
    // 9 · the summit: a turning sunburst and twinkling stars behind the flag
    (c) => {
      let rays = '';
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, b1 = a - .13, b2 = a + .13;
        rays += 'M' + r1(Math.cos(b1) * 12) + ' ' + r1(Math.sin(b1) * 12) + ' L' + r1(Math.cos(a) * 38) + ' ' + r1(Math.sin(a) * 38) + ' L' + r1(Math.cos(b2) * 12) + ' ' + r1(Math.sin(b2) * 12) + 'Z';
      }
      const star = (x, y, cls, sc) => `<path class="tw ${cls}" transform="translate(${x} ${y}) scale(${sc})" d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z" fill="${c.snow}" stroke="${c.gold}" stroke-width=".6" stroke-linejoin="round"/>`;
      return `<g transform="translate(0 -26)"><g class="rot"><path d="${rays}" fill="${c.gold}" fill-opacity=".85"/></g><circle r="13" fill="${c.gold}"/><circle r="7" fill="${c.snow}" fill-opacity=".7"/></g>` +
        star(-32, -44, '', 1.2) + star(32, -46, 'b', 1) + star(-26, -12, 'c', .9) + star(34, -10, '', 1.1) + star(2, -62, 'b', 1.2);
    }
  ];
  // the scene for one camp, standing at (x, y) at scale sc; level 9 sits right behind its flag
  const scene = (lv, x, y, sc, c) => '<g transform="translate(' + r1(x) + ' ' + r1(y) + ') scale(' + sc + ')">' + LM[Math.max(0, Math.min(8, (+lv || 1) - 1))](c) + '</g>';

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
      } else if (+o.levels[i][0] === 9) s.push(flag(k.x, k.y, c.gold, c.ink, 1, 1.25, Object.assign({}, c, { pole:c.wood })));
      else s.push(flag(k.x, k.y, c.stone, c.stone, i >= 5 ? 0.35 : 0.55, 1.0, c));
    });
    [[850, 134, 120, 42, .8], [926, 96, 84, 32, .85], [792, 196, 92, 26, .75], [716, 254, 74, 20, .7], [990, 176, 72, 22, .7]].forEach(f => {
      s.push('<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="' + f[2] + '" ry="' + f[3] + '" fill="' + c.fog + '" fill-opacity="' + f[4] + '"/>');
    });
    // the camp scenes go on top of the mist, so every stop shows
    camps.forEach((k, i) => { const lv = +o.levels[i][0]; s.push(scene(lv, k.x + (lv === 9 ? 0 : -38), k.y, 1.15, c)); });
    s.push('<circle cx="' + you[0] + '" cy="' + you[1] + '" r="15" fill="' + c.walk + '" fill-opacity=".25"/><circle cx="' + you[0] + '" cy="' + you[1] + '" r="9" fill="' + c.walk + '" stroke="' + c.white + '" stroke-width="2.5"/>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1124" height="380" viewBox="0 0 1124 380">' + STYLE + s.join('') + '</svg>';
    const labels = camps.map((k, i) => {
      const lv = o.levels[i]; const off = D.off[k.a];
      return { soon:+lv[0] > (o.built || 9), x:k.x + off[0], y:k.y + off[1], center:i === 0, kind:i === 0 ? 'next' : (i <= 3 ? 'near' : 'far'), text:i === 0 ? 'Next camp · HSK ' + lv[0] + ' exam' : 'HSK ' + lv[0], sub:i === 0 ? (total - started) + ' words to go' : (off[2] ? (lv[1] ? lv[1] + ' words' : 'advanced') : '') };
    });
    return { src:uri(svg), w:1124, h:380, you:{ x:you[0], y:you[1] - 54 }, labels, stones, next:nm };
  };

  // ---------------------------------------------------------------- phone trail: 342 x 470
  const M = {
    w:342, h:470, p0:[70, 452],
    anchors:[[262, 414], [104, 364], [262, 316], [112, 268], [250, 222], [122, 178], [238, 134], [150, 92], [204, 50]],
    off:[[-112, -48, true], [26, -46, true], [-112, -44, true], [28, -42, false], [-106, -42, false], [26, -32, false], [-88, -34, false], [26, -30, false], [-74, -32, false]]
  };
  // ---------------------------------------------------------------- phone trail: 342 wide, as tall as the levels need
  // One camp per level, from this level's exam up to HSK 9 on the summit; the page shows it in a box that scrolls up (it opens at the bottom).
  // o.built: the highest level that is built; higher ones get a dashed "coming later" label.
  const phoneTrail = (o) => {
    const c = o.dark ? DARK : LIGHT;
    const total = o.total || 300, started = Math.max(0, Math.min(total, o.started || 0));
    const n = o.levels.length, STEP = 118, W = 342, H = 190 + n * STEP;
    const p0 = [64, H - 22];
    const camps = o.levels.map((lv, i) => (i === n - 1 && n > 1 ? { x:171, y:84, i, side:'top' } : { x:i % 2 ? 98 + (i % 4 === 3 ? 10 : 0) : 252 - (i % 4 === 2 ? 12 : 0), y:H - 96 - i * STEP, i, side:i % 2 ? 'left' : 'right' }));
    const L1 = camps[0];
    const frac = started / total;
    const you = [r1(p0[0] + frac * (L1.x - p0[0])), r1(p0[1] + frac * (L1.y - p0[1]))];
    const pts = [p0].concat(camps.map(k => [k.x, k.y]));
    const y = (f) => r1(H * f);
    const sh = [];
    sh.push('<rect width="' + W + '" height="' + H + '" fill="' + c.sky + '"/>');
    sh.push('<circle cx="284" cy="56" r="22" fill="' + c.sun + '" fill-opacity=".9"/>');
    // the big mountain: summit at the top, slopes all the way down
    sh.push('<path d="M0 ' + H + ' L0 ' + y(.34) + ' L64 ' + y(.22) + ' L171 64 L238 ' + y(.16) + ' L342 ' + y(.27) + ' L342 ' + H + 'Z" fill="' + c.far + '"/>');
    sh.push('<path d="M171 64 L150 ' + r1(64 + 46) + ' L166 ' + r1(64 + 38) + ' L180 ' + r1(64 + 50) + ' L196 ' + r1(64 + 36) + 'Z" fill="' + c.white + '" fill-opacity=".85"/>');
    sh.push('<path d="M0 ' + H + ' L0 ' + y(.58) + ' L74 ' + y(.5) + ' L150 ' + y(.6) + ' L246 ' + y(.44) + ' L342 ' + y(.53) + ' L342 ' + H + 'Z" fill="' + c.mid + '"/>');
    sh.push('<path d="M0 ' + H + ' L0 ' + y(.82) + ' L90 ' + y(.76) + ' L196 ' + y(.84) + ' L290 ' + y(.74) + ' L342 ' + y(.79) + ' L342 ' + H + 'Z" fill="' + c.mid + '" fill-opacity=".7"/>');
    sh.push('<path d="M0 ' + H + ' L0 ' + (H - 30) + ' Q 100 ' + (H - 60) + ' 200 ' + (H - 30) + ' Q 280 ' + (H - 10) + ' 342 ' + (H - 40) + ' L342 ' + H + 'Z" fill="' + c.near + '"/>');
    sh.push('<path d="' + curve(pts) + '" fill="none" stroke="' + c.path + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9" opacity=".95"/>');
    if (started > 0) sh.push('<path d="M' + p0[0] + ' ' + p0[1] + ' L' + you[0] + ' ' + you[1] + '" fill="none" stroke="' + c.walk + '" stroke-width="5" stroke-linecap="round"/>');
    // mist between the camps
    camps.slice(0, -1).forEach((k, i) => { const fy = k.y - STEP / 2; sh.push('<ellipse cx="' + (i % 2 ? 236 : 106) + '" cy="' + r1(fy) + '" rx="' + (96 + (i % 3) * 14) + '" ry="20" fill="' + c.fog + '" fill-opacity="' + (i < 2 ? .55 : .75) + '"/>'); });
    camps.forEach((k, i) => { const lv = +o.levels[i][0]; sh.push(scene(lv, lv === 9 ? k.x : Math.max(46, Math.min(296, k.x + (k.side === 'left' ? -44 : 44))), k.y, 1.2, c)); });
    camps.forEach((k, i) => {
      if (i === 0) { sh.push('<circle cx="' + k.x + '" cy="' + k.y + '" r="15" fill="none" stroke="' + c.ring + '" stroke-width="2" opacity=".55"/>'); sh.push(flag(k.x, k.y, c.ring, c.white, 1, 1.2, c)); }
      else if (+o.levels[i][0] === 9) sh.push(flag(k.x, k.y, c.gold, c.ink, 1, 1.3, Object.assign({}, c, { pole:c.wood })));
      else sh.push(flag(k.x, k.y, c.stone, c.stone, o.levels[i][0] > (o.built || 9) ? 0.45 : 0.8, i === n - 1 ? 1.1 : 0.9, c));
    });
    sh.push('<circle cx="' + you[0] + '" cy="' + you[1] + '" r="15" fill="' + c.walk + '" fill-opacity=".25"/><circle cx="' + you[0] + '" cy="' + you[1] + '" r="9" fill="' + c.walk + '" stroke="' + c.white + '" stroke-width="2.5"/>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + STYLE + sh.join('') + '</svg>';
    const labels = camps.map((k, i) => {
      const lv = o.levels[i]; const soon = +lv[0] > (o.built || 9);
      const off = k.side === 'top' ? [-46, -64] : k.side === 'left' ? [24, -48] : [-118, -50];
      return { x:k.x + off[0], y:k.y + off[1], center:false, soon, kind:i === 0 ? 'next' : (i <= 2 ? 'near' : 'far'), text:i === 0 ? 'HSK ' + lv[0] + ' exam' : 'HSK ' + lv[0],
        sub:i === 0 ? (total - started) + ' to go' : soon ? 'coming later' : (lv[1] ? lv[1] + ' words' : '') };
    });
    return { src:uri(svg), w:W, h:H, you:{ x:Math.max(8, you[0] - 96), y:you[1] - 46 }, hideYou:frac > 0.6, labels };
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
