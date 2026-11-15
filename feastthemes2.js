/* Rooms for the Food diary feast tables, part 2: Heilongjiang, Inner Mongolia, Xinjiang, Tibet, Qinghai, Gansu, Ningxia, Yunnan, Guizhou, Guangxi, Hainan, Taiwan, Hong Kong, Macau, Singapore.
 * Same shape as feastthemes.js. No screen code here. */
(function (root) {
  const F = (typeof module !== 'undefined' && module.exports) ? require('./feastscene.js') : root.FEAST;
  const TH = F.THEMES;
  const RND = [[322, 231], [360, 286], [404, 248]];
  const RCT = [[324, 250], [364, 268], [410, 292]];
  const round = (K, o) => K.roundTable(Object.assign({ cx: 340, cy: 366, rx: 292, ry: 72 }, o));
  const rect = (K, o) => K.rectTable(Object.assign({ x0: 110, x1: 570, y0: 296, X0: 40, X1: 640, y1: 430 }, o));
  const low = (K, o) => K.lowTable(Object.assign({ x0: 110, x1: 570, y0: 298, X0: 50, X1: 630, y1: 428 }, o));
  const SL = (c, c2, bk) => ({ c, c2, bk: bk || 'rgba(0,0,0,.4)' });
  const cush2 = (K, ys, cols) => ys.map((a, i) => K.cushion(a[0], a[1], a[2] || 44, cols[i % cols.length][0], cols[i % cols.length][1])).join('');

  // ---- Heilongjiang: a Harbin winter hall, frosted window onto onion domes in the snow, glowing ice lanterns
  TH.heilongjiang = {
    nolight: true,
    shelf: { x: 452, w: 206, y: 176, style: SL('#2A4A6A', '#6A8AAA', 'rgba(10,20,40,.55)') },
    room: (K) => K.R(0, 0, 680, 250, '#233A5A') + K.R(0, 0, 680, 30, '#16263E') + K.floor(250, 'plank', '#4A3A2A', '#352818') +
      K.win(34, 52, 330, 178, { frame: '#16263E', fw: 8, lat: 'grid', latc: '#16263E', n: 4, lw: 3, view: (x, y, w, h) => K.V.night(x, y, w, h) + K.R(x, y + h * .82, w, h * .18, '#E8F0F6') + [[.3, .5, 18], [.6, .44, 24], [.82, .56, 14]].map(d => K.R(x + w * d[0] - d[2] * .6, y + h * d[1], d[2] * 1.2, h * .4, '#C9D4DE') + K.E(x + w * d[0], y + h * d[1], d[2] * .8, d[2] * 1.1, '#E8B648', 'stroke="none"') + K.L('M' + (x + w * d[0]) + ' ' + (y + h * d[1] - d[2]) + 'v-8', '#E8B648', 2)).join('') + K.rep(16, i => K.C(x + (i * 41) % w, y + (i * 29) % h, 1.6, '#fff', 'stroke="none"')) }) +
      [[390, 230, 38], [430, 236, 26]].map(c => K.R(c[0], c[1] - c[2], c[2], c[2], 'rgba(170,220,250,.8)', 'stroke="#DFF2FF" stroke-width="2"') + K.R(c[0] + 5, c[1] - c[2] + 5, c[2] - 10, c[2] - 10, 'rgba(255,255,255,.6)', 'stroke="none"') + K.E(c[0] + c[2] / 2, c[1] - c[2] / 2, c[2] * 1.2, c[2] * 1.2, 'rgba(170,220,250,.18)', 'stroke="none"')).join('') +
      K.stringLights(0, 20, 340, 40, 9, '#FFE08A') + K.stringLights(340, 40, 680, 20, 9, '#9AD8FF'),
    back: (K) => [[200, 306], [480, 306]].map(a => K.chairB(a[0], a[1], '#6B4A2A', '#B8864A', 46)).join(''),
    table: { rows: RCT, draw: (K) => { const f = K.fab('check', '#F4F1EA', '#C8321F'); return f.defs + rect(K, { top: f.fill, rim: '#8A5A2B', side: '#4A2A1A' }); } },
    front: (K) => [[200, 420], [480, 420]].map(a => K.chairF(a[0], a[1], '#6B4A2A', '#B8864A', 50)).join('')
  };

  // ---- Inner Mongolia: a yurt, orange roof poles round a skylight, lattice walls, felt, horse-head fiddle
  TH.neimenggu = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#E8672B', '#2F6FB5', 'rgba(60,20,10,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#F2E2C0') + K.rep(17, i => K.L('M340 18L' + (i * 42 - 10) + ' 108', '#E8672B', 5) + K.L('M340 18L' + (i * 42 - 10) + ' 108', '#F6C23E', 1.4, 'opacity=".7"')) + K.R(0, 106, 680, 8, '#E8672B') + K.R(0, 114, 680, 140, '#EAD6A8') +
      K.rep(16, i => K.L('M' + (i * 44 - 20) + ' 114l44 140M' + (i * 44 + 24) + ' 114l-44 140', '#8A5A2B', 3)) + K.E(340, 22, 56, 22, '#CFE6F0', 'stroke="#E8672B" stroke-width="6"') + K.L('M284 22H396M340 0V44', '#E8672B', 3) +
      K.floor(250, 'diamond', '#8A2A22', '#C9A24F', '#2F6FB5') + K.R(36, 80, 18, 150, '#2F6FB5', 'rx="8" opacity=".85"') + K.L('M60 120L110 170', '#8A5A2B', 6) + K.E(120, 182, 16, 10, '#8A5A2B') + K.L('M120 180L112 120', '#8A5A2B', 3) + K.Pg('M104 112L124 112L128 124L100 124Z', '#C9A24F') + K.L('M110 124V176M118 124V176', '#F4F1EA', 1.4) +
      K.rep(4, i => K.Pg('M' + (160 + i * 18) + ' 110Q' + (160 + i * 18 + 8) + ' 150 ' + (160 + i * 18) + ' 190Q' + (160 + i * 18 - 8) + ' 150 ' + (160 + i * 18) + ' 110Z', '#F4F1EA', 'opacity=".85" stroke="#2F6FB5" stroke-width="1.2"')),
    back: (K) => [[130, 300], [340, 298], [550, 300]].map((a, i) => K.cushion(a[0], a[1], 42, i % 2 ? '#2F6FB5' : '#C8321F', '#F2C23E')).join(''),
    table: { rows: RCT, draw: (K) => low(K, { top: '#E8672B', side: '#B8481F', rim: '#2F6FB5' }) + K.L('M130 330H550M150 346H530', '#2F6FB5', 2.6, 'opacity=".6"') },
    front: (K) => cush2(K, [[150, 434, 46], [340, 438, 46], [530, 434, 46]], [['#C8321F', '#F2C23E'], ['#2F6FB5', '#F4F1EA']])
  };

  // ---- Xinjiang: a Uyghur hall, turquoise carved arches, a hanging carpet, a raised carpeted platform
  TH.xinjiang = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#1F7A8C', '#C9A24F', 'rgba(10,40,50,.5)') },
    room: (K) => K.R(0, 0, 680, 250, '#F4EAD8') + K.wall(150, 250, 'diamond', '#1F7A8C', '#F4EAD8', '#C9A24F') + K.R(0, 148, 680, 6, '#C9A24F') + K.floor(250, 'diamond', '#8A2A3A', '#C9A24F', '#1F7A8C') + K.R(0, 0, 680, 22, '#1F7A8C') + K.rep(17, i => K.Pg('M' + (i * 40) + ' 22l20 10l20 -10Z', '#C9A24F')) +
      [20, 160].map(x => K.win(x, 56, 106, 176, { shape: 'arch', frame: '#C9A24F', fw: 6, lat: 'diamond', latc: '#F4EAD8', n: 4, lw: 1.6, glass: '#1F7A8C', view: (x1, y1, w1, h1) => K.V.sky(x1, y1, w1, h1, '#79C4D8', '#C9E8F0') })).join('') +
      K.R(296, 62, 124, 150, '#8A1F2A', 'stroke="#C9A24F" stroke-width="3"') + K.rep(3, i => K.Pg('M358 ' + (80 + i * 42) + 'L388 ' + (101 + i * 42) + 'L358 ' + (122 + i * 42) + 'L328 ' + (101 + i * 42) + 'Z', i % 2 ? '#F4EAD8' : '#1F7A8C', 'stroke="#C9A24F" stroke-width="1.6"')) + K.rep(7, i => K.L('M' + (300 + i * 17.6) + ' 212v14', '#C9A24F', 2)) +
      K.lantern(250, 22, 12, '#1F7A8C', '#C9A24F') + K.lantern(432, 22, 12, '#B8321F', '#C9A24F'),
    back: (K) => cush2(K, [[130, 300, 42], [340, 298, 42], [550, 300, 42]], [['#B8321F', '#F2C23E'], ['#1F7A8C', '#F4F1EA']]),
    table: { rows: RCT, draw: (K) => low(K, { top: '#F4EAD8', side: '#8A2A3A', rim: '#1F7A8C' }) + K.L('M120 330H560M110 350H570', '#C9A24F', 2.4, 'opacity=".7"') },
    front: (K) => cush2(K, [[150, 434, 46], [340, 438, 46], [530, 434, 46]], [['#1F7A8C', '#F4F1EA'], ['#B8321F', '#F2C23E']])
  };

  // ---- Tibet: a Tibetan hall, a thangka, prayer flags, butter lamps and a painted low table
  TH.xizang = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#B8321F', '#E8B648', 'rgba(60,10,10,.5)') },
    room: (K) => K.R(0, 0, 680, 250, '#F4F1EA') + K.R(0, 0, 680, 40, '#7A1F18') + K.R(0, 40, 680, 8, '#E8B648') + K.rep(17, i => K.R(i * 40 + 6, 12, 28, 18, 'none', 'stroke="#E8B648" stroke-width="1.6"')) + K.floor(250, 'diamond', '#7A1F18', '#E8B648', '#2F6FB5') +
      K.win(34, 80, 130, 130, { frame: '#1A1A1A', fw: 8, view: (x, y, w, h) => K.V.snow(x, y, w, h) + K.Pg('M' + (x + w * .3) + ' ' + (y + h) + 'V' + (y + h * .6) + 'H' + (x + w * .7) + 'V' + (y + h) + 'Z', '#F4F1EA', 'stroke="#C9B590" stroke-width="1"') + K.R(x + w * .38, y + h * .45, w * .24, h * .15, '#B8321F') }) + K.Pg('M30 78L168 78L158 66H40Z', '#1A1A1A') +
      K.R(240, 62, 150, 158, '#2F6FB5', 'stroke="#E8B648" stroke-width="5"') + K.R(256, 78, 118, 126, '#E8B648', 'opacity=".25"') + K.C(315, 118, 22, '#F4D878', 'stroke="#B8321F" stroke-width="2"') + K.C(315, 118, 12, '#E8A8A0', 'stroke="none"') + K.Pg('M285 200L315 140L345 200Z', '#B8321F') + K.C(274, 100, 7, '#3E9A5A', 'stroke="none"') + K.C(356, 100, 7, '#D2392B', 'stroke="none"') + K.R(240, 220, 150, 8, '#7A1F18') +
      K.prayerFlags(0, 52, 340, 80, 10) + K.prayerFlags(340, 80, 680, 50, 10) + [[190, 220], [215, 220], [420, 220]].map(p => K.R(p[0] - 7, p[1] - 6, 14, 6, '#E8B648') + K.Pg('M' + p[0] + ' ' + (p[1] - 7) + 'q-5 -8 0 -14q5 6 0 14Z', '#FFB02E', 'stroke="none"')).join(''),
    back: (K) => cush2(K, [[130, 300, 42], [340, 298, 42], [550, 300, 42]], [['#B8321F', '#E8B648'], ['#2F6FB5', '#F4F1EA']]),
    table: { rows: RCT, draw: (K) => low(K, { top: '#C8321F', side: '#7A1F18', rim: '#E8B648' }) + K.rep(6, i => K.C(150 + i * 76, 346, 9, 'none', 'stroke="#E8B648" stroke-width="2"')) },
    front: (K) => cush2(K, [[150, 434, 46], [340, 438, 46], [530, 434, 46]], [['#E8B648', '#C8321F'], ['#2F6FB5', '#F4F1EA']])
  };

  // ---- Qinghai: a black yak-hair tent opening onto the lake and golden rapeseed fields, prayer flags
  TH.qinghai = {
    shelf: { x: 20, w: 206, y: 176, style: SL('#3A2418', '#8A5A2B', 'rgba(0,0,0,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#2A1E18') + K.rep(14, i => K.L('M' + (i * 50) + ' 0L' + (i * 50 + 10) + ' 250', '#3A2A22', 3)) + K.Pg('M0 0H680L600 90H80Z', '#1A1210') + K.floor(250, 'diamond', '#7A2A22', '#E8B648', '#2F6FB5') +
      K.win(250, 62, 400, 178, { frame: '#1A1210', fw: 8, view: (x, y, w, h) => K.V.mount(x, y, w, h * .55, '#7A9AB8', '#9CB4C8', '#CFE6F5') + K.R(x, y + h * .5, w, h * .22, '#3F90C8') + K.R(x, y + h * .72, w, h * .28, '#F2C94A') + K.rep(10, i => K.L('M' + (x + i * w / 10 + 10) + ' ' + (y + h) + 'L' + (x + w * .5 + (i - 5) * 8) + ' ' + (y + h * .72), '#D9A82A', 1.6, 'opacity=".7"')) }) +
      K.prayerFlags(220, 40, 680, 58, 12) + K.prayerFlags(0, 40, 220, 30, 5) + K.R(240, 74, 8, 160, '#6B4423') + K.R(654, 74, 8, 160, '#6B4423'),
    back: (K) => cush2(K, [[150, 300, 42], [340, 298, 42], [530, 300, 42]], [['#C8321F', '#E8B648'], ['#2F6FB5', '#F4F1EA']]),
    table: { rows: RCT, draw: (K) => low(K, { top: '#8A3A22', side: '#4A1E10', rim: '#E8B648' }) + K.L('M130 334H550', '#E8B648', 3, 'opacity=".6"') },
    front: (K) => cush2(K, [[150, 434, 46], [340, 438, 46], [530, 434, 46]], [['#2F6FB5', '#F4F1EA'], ['#C8321F', '#E8B648']])
  };

  // ---- Gansu: a Dunhuang cave wall with flying apsaras, a desert arch with a camel, Lanzhou stools
  TH.gansu = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#8A4A2A', '#C98A4A', 'rgba(60,20,10,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#C98A4A') + K.rep(40, i => K.C((i * 83) % 680, (i * 47) % 240, 1.6, '#A8703A', 'stroke="none"')) + K.R(0, 0, 680, 30, '#8A3A22') + K.rep(17, i => K.Pg('M' + (i * 40) + ' 30l20 12l20 -12Z', '#3E8A7A')) +
      K.floor(250, 'brick', '#C9A878', 'rgba(0,0,0,.2)') + K.win(36, 66, 150, 174, { shape: 'arch', frame: '#8A3A22', fw: 8, view: (x, y, w, h) => K.V.dunes(x, y, w, h) }) +
      K.C(310, 120, 38, '#3E8A7A', 'stroke="#8A3A22" stroke-width="3"') + K.C(310, 120, 22, '#F4D878', 'stroke="#8A3A22" stroke-width="2"') + K.rep(8, i => K.Pg('M310 120L' + (310 + Math.cos(i * .785) * 30) + ' ' + (120 + Math.sin(i * .785) * 30) + 'L' + (310 + Math.cos(i * .785 + .4) * 30) + ' ' + (120 + Math.sin(i * .785 + .4) * 30) + 'Z', '#C8321F', 'opacity=".85" stroke="none"')) +
      K.Pg('M370 168Q400 130 430 160Q410 150 395 180Q380 170 370 168Z', '#F4F1EA', 'stroke="#8A3A22" stroke-width="1.6"') + K.L('M262 190Q290 170 320 196T380 192', '#3E8A7A', 4) + K.L('M240 80Q270 100 250 130', '#C8321F', 4) + K.L('M400 74Q420 96 440 84', '#3E8A7A', 4) +
      K.lantern(224, 30, 12, '#C8321F', '#E8B648'),
    back: (K) => [[180, 298], [340, 290], [500, 298]].map(a => K.stool(a[0], a[1], '#2F6FB5', '#1F3F6E')).join(''),
    table: { rows: RCT, draw: (K) => { const f = K.fab('stripe', '#E8C48A', '#C98A4A'); return f.defs + rect(K, { top: f.fill, rim: '#8A3A22', side: '#5A2A18' }); } },
    front: (K) => [[170, 424], [510, 424]].map(a => K.stool(a[0], a[1], '#2F6FB5', '#1F3F6E')).join('')
  };

  // ---- Ningxia: a Hui tea house, green-and-white geometric tiles, an arch onto a green dome and the Helan mountains, goji strings
  TH.ningxia = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#1F7A5A', '#E8E0C8', 'rgba(10,50,30,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#F4F1EA') + K.wall(160, 250, 'diamond', '#1F7A5A', '#F4F1EA', '#C9A24F') + K.R(0, 156, 680, 6, '#C9A24F') + K.floor(250, 'diamond', '#2F8F6A', '#F4F1EA', '#C9A24F') + K.R(0, 0, 680, 24, '#1F7A5A') + K.rep(17, i => K.Pg('M' + (i * 40) + ' 24l20 10l20 -10Z', '#C9A24F')) +
      K.win(40, 58, 150, 178, { shape: 'arch', frame: '#1F7A5A', fw: 8, lat: 'diamond', latc: '#C9A24F', n: 5, lw: 1.4, view: (x, y, w, h) => K.V.mount(x, y, w, h * .7, '#9AA6A0', '#B8C0B8', '#CFE6F0') + K.R(x, y + h * .7, w, h * .3, '#E8D8A8') + K.E(x + w * .5, y + h * .62, w * .26, w * .24, '#2F8F6A', 'stroke="#1F5F44" stroke-width="2"') + K.R(x + w * .24, y + h * .62, w * .52, h * .2, '#F4F1EA') + K.L('M' + (x + w * .5) + ' ' + (y + h * .36) + 'v-10', '#C9A24F', 2) + K.C(x + w * .5, y + h * .3, 4, 'none', 'stroke="#C9A24F" stroke-width="1.6"') }) +
      K.rep(3, i => K.L('M' + (240 + i * 60) + ' 26Q' + (270 + i * 60) + ' 70 ' + (300 + i * 60) + ' 26', '#3a2a22', 1.2) + K.rep(9, j => K.C(240 + i * 60 + j * 7, 26 + Math.sin(j / 8 * 3.14) * 22 + 2, 3.4, '#D2392B', 'stroke="#8A1F18" stroke-width=".8"'))) +
      K.R(260, 206, 110, 6, '#8A5A2B') + K.R(268, 212, 6, 38, '#8A5A2B') + K.R(356, 212, 6, 38, '#8A5A2B') + [[290, 206], [330, 206]].map(p => K.Pg('M' + (p[0] - 14) + ' ' + p[1] + 'Q' + p[0] + ' ' + (p[1] - 28) + ' ' + (p[0] + 14) + ' ' + p[1] + 'Z', '#F4F1EA', 'stroke="#3a2a22" stroke-width="1.4"') + K.C(p[0], p[1] - 20, 3, '#1F7A5A', 'stroke="none"')).join(''),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#5A3A24', '#1F7A5A', 46)).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('diamond', '#F4F1EA', '#2F8F6A', '#C9A24F'); return f.defs + round(K, { top: f.fill, rim: '#1F7A5A', side: '#0F4F3A', inner: '#C9A24F' }); } },
    front: (K) => [[200, 416], [480, 416]].map(a => K.chairF(a[0], a[1], '#5A3A24', '#1F7A5A', 50)).join('')
  };

  // ---- Yunnan: a Dali Bai courtyard room, painted eaves, carved lattice onto Erhai and a snow peak, indigo batik, tea cakes
  TH.yunnan = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#6B3A24', '#B8643A', 'rgba(40,20,10,.4)') },
    room: (K) => K.R(0, 0, 680, 250, '#F8F6EE') + K.R(0, 0, 680, 50, '#2A5A7A') + K.rep(17, i => K.C(i * 40 + 20, 24, 12, i % 2 ? '#E8674A' : '#F2C23E', 'stroke="none"') + K.C(i * 40 + 20, 24, 5, '#fff', 'stroke="none"')) + K.R(0, 50, 680, 6, '#3A2418') + K.floor(250, 'brick', '#A8A096', 'rgba(0,0,0,.2)') +
      K.win(40, 76, 270, 160, { frame: '#5A3A24', fw: 8, lat: 'grid', latc: '#5A3A24', n: 6, lw: 2.4, view: (x, y, w, h) => K.V.snow(x, y, w, h * .6) + K.R(x, y + h * .56, w, h * .44, '#5FB0D0') + K.L('M' + x + ' ' + (y + h * .8) + 'q12 -5 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0', '#fff', 1.4, 'opacity=".5"') }) +
      K.R(340, 76, 90, 150, '#1F3F7A', 'stroke="#3A2418" stroke-width="3"') + K.rep(4, i => K.rep(3, j => K.C(358 + j * 28, 98 + i * 34, 7, 'none', 'stroke="#F4F1EA" stroke-width="2.2"') + K.C(358 + j * 28, 98 + i * 34, 2, '#F4F1EA', 'stroke="none"'))) +
      K.plantPot(318, 250, 1.1, '#3E8A4A') + K.rep(3, i => K.C(318 + (i - 1) * 8, 202 - i * 3, 5, ['#E8674A', '#F2A8C0', '#F2C23E'][i], 'stroke="none"')) + K.lantern(250, 56, 12, '#E8674A', '#F2C23E') + K.lantern(450, 56, 12, '#E8674A', '#F2C23E'),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#8A5A2B', '#E8D8B0', 46)).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('dots', '#2A4A8A', '#F4F1EA'); return f.defs + round(K, { top: f.fill, rim: '#F4F1EA', side: '#1A2A5A', inner: '#F4F1EA' }); } },
    front: (K) => [[200, 416], [480, 416]].map(a => K.chairF(a[0], a[1], '#8A5A2B', '#E8D8B0', 50)).join('')
  };

  // ---- Guizhou: a Miao and Dong hall, a silver crown, a drum tower over rice terraces, indigo batik, lusheng pipes
  TH.guizhou = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#3A2A22', '#8A6A4A', 'rgba(0,0,0,.5)') },
    room: (K) => K.wall(0, 250, 'plank', '#4A3224', 'rgba(0,0,0,.3)') + K.R(0, 0, 680, 26, '#2A1A10') + K.floor(250, 'plank', '#6B4A32', '#4A3220') +
      K.win(36, 64, 190, 150, { frame: '#2A1A10', fw: 8, view: (x, y, w, h) => K.V.terraces(x, y, w, h) + K.rep(4, i => K.Pg('M' + (x + w * .55 - 20 + i * 4) + ' ' + (y + h * .6 - i * 14) + 'h' + (40 - i * 8) + 'l-4 -12h-' + (32 - i * 8) + 'Z', '#5A3A24', 'stroke="none"')) + K.R(x + w * .55 - 4, y + h * .4, 8, h * .5, '#5A3A24') }) +
      K.rep(15, i => K.C(250 + i * 12, 100 - Math.sin(i / 14 * 3.14) * 40 + 40, 10, '#E8E8F0', 'stroke="#8A8A9A" stroke-width="1.4"') + K.L('M' + (250 + i * 12) + ' ' + (110 - Math.sin(i / 14 * 3.14) * 40 + 40) + 'v' + (14 + (i % 3) * 5), '#E8E8F0', 1.8)) + K.rep(2, i => K.C(300 + i * 44, 160, 14, '#E8E8F0', 'stroke="#8A8A9A" stroke-width="1.4"')) +
      K.R(300, 176, 80, 40, '#1F3F7A', 'stroke="#E8E8F0" stroke-width="2"') + K.rep(5, i => K.C(318 + i * 12, 196, 3, '#F4F1EA', 'stroke="none"')) + [0, 1, 2, 3, 4].map(i => K.R(404 + i * 9, 70 + (i % 2) * 6, 6, 110 - (i % 2) * 6, '#C9B070', 'rx="3" stroke="#6B5A2A" stroke-width="1"')).join('') + K.lantern(300, 26, 12, '#B8321F', '#E8B648'),
    back: (K) => K.bench(40, 640, 268, '#6B4A32', '#8A6A4A'),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#8A6A4A', rim: '#4A3220', side: '#3A2A22', runner: { c: '#1F3F7A', w: 130, o: .92 } }) },
    front: (K) => K.bench(40, 640, 418, '#6B4A32', '#8A6A4A')
  };

  // ---- Guangxi: Guilin karst hills through a wide window with a bamboo raft, a bronze drum, Zhuang brocade and a woven ball
  TH.guangxi = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#7A9A4A', '#B8C88A', 'rgba(20,50,20,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#E8EFD8') + K.R(0, 0, 680, 28, '#3E8A6A') + K.floor(250, 'weave', '#D9C27A', '#B8A050', '#8A7A3A') +
      K.win(30, 52, 380, 186, { frame: '#6B4A2A', fw: 8, view: (x, y, w, h) => K.V.karst(x, y, w, h) + K.L('M' + (x + w * .62) + ' ' + (y + h * .84) + 'h60M' + (x + w * .62) + ' ' + (y + h * .88) + 'h60', '#C9A24F', 4) + K.L('M' + (x + w * .74) + ' ' + (y + h * .84) + 'v-26', '#6B4A2A', 2.4) }) +
      K.R(440, 60, 60, 160, '#fff', 'opacity="0"') + K.R(424, 70, 70, 140, '#C8321F', 'stroke="#3a2a22" stroke-width="1.2"') + K.rep(5, i => K.R(424, 78 + i * 26, 70, 12, ['#F2C23E', '#2F6FB5', '#3E9A5A', '#F4F1EA', '#E8674A'][i])) +
      K.C(540, 106, 18, '#C8321F', 'stroke="#3a2a22" stroke-width="1.4"') + K.rep(6, i => K.E(540 + Math.cos(i * 1.05) * 18, 106 + Math.sin(i * 1.05) * 18, 6, 4, '#F2C23E', 'stroke="none"')) + K.L('M540 70V88M540 124v26', '#F2C23E', 2) + K.L('M530 150q10 20 20 0', '#F2C23E', 2) + K.lantern(250, 28, 12, '#3E8A6A', '#E8B648'),
    back: (K) => [[180, 298], [340, 290], [500, 298]].map(a => K.stool(a[0], a[1], '#C9A878', '#8A6A3A')).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('stripe', '#F4F1EA', '#D2392B'); return f.defs + round(K, { top: f.fill, rim: '#8A6A3A', side: '#6B4A2A', inner: '#2F6FB5' }); } },
    front: (K) => [[130, 420], [550, 420]].map(a => K.stool(a[0], a[1], '#C9A878', '#8A6A3A')).join('')
  };

  // ---- Hainan: an open beach shack, a thatch roof, palms and sea beyond the posts, rattan chairs and coconut lamps
  TH.hainan = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#B8864A', '#D9B070', 'rgba(60,40,10,.4)') },
    room: (K) => K.V.palms(0, 0, 680, 250) + K.R(0, 0, 680, 56, '#C9A84A') + K.rep(68, i => K.L('M' + (i * 10) + ' 40v' + (22 + (i % 3) * 6), '#A8883A', 3)) + K.R(0, 34, 680, 8, '#8A6A2A') + K.R(28, 40, 16, 214, '#8A6A3A') + K.R(436, 40, 16, 214, '#8A6A3A') + K.R(630, 40, 16, 214, '#8A6A3A') +
      K.floor(250, 'plank', '#E8D7A8', '#C9B882') + [[130, 66], [260, 70], [380, 62]].map(p => K.L('M' + p[0] + ' 40V' + p[1], '#3b2a22', 1.4) + K.C(p[0], p[1] + 16, 16, '#8A5A2B', 'stroke="#3a2a22" stroke-width="1.4"') + K.C(p[0] - 4, p[1] + 12, 4, '#C9A070', 'stroke="none"')).join('') +
      K.rep(6, i => K.Pg('M' + (86 + i * 28) + ' 250q4 -26 ' + (6 + (i % 2) * 4) + ' ' + (-40 - (i % 3) * 10), 'none', 'stroke="#3E8A4A" stroke-width="5" stroke-linecap="round"')) + [[100, 190], [160, 176], [220, 198]].map(p => K.C(p[0], p[1], 8, '#E8403A', 'stroke="none"') + K.C(p[0], p[1], 3, '#F2C23E', 'stroke="none"')).join(''),
    back: (K) => [[200, 306], [480, 306]].map(a => K.chairB(a[0], a[1], '#C9985A', '#8A6A3A', 50)).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('weave', '#E8D7A8', '#C9A878', '#B8864A'); return f.defs + round(K, { top: f.fill, rim: '#B8864A', side: '#8A6A3A', inner: '#3E8A4A' }); } },
    front: (K) => [[200, 418], [480, 418]].map(a => K.chairF(a[0], a[1], '#C9985A', '#8A6A3A', 52)).join('')
  };

  // ---- Taiwan: a night-market stall, neon signs, string lights, Taipei 101 in the dark, red plastic stools
  TH.taiwan = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#2A2A3A', '#5A5A7A', 'rgba(255,255,255,.08)') },
    room: (K) => K.V.night(0, 0, 680, 250) + K.rep(7, i => K.R(i * 100, 190, 60 + (i * 13) % 30, 60, '#1A1A2A', 'stroke="none"')) + [0, 1, 2, 3, 4, 5, 6, 7].map(i => K.R(300 + i * 4 - 0, 0, 0, 0, 'none')).join('') +
      '<g transform="translate(40 0)">' + K.Pg('M230 200L236 110L240 70L242 30L246 70L250 110L256 200Z', '#2A2A4A', 'stroke="none"') + K.rep(7, i => K.Pg('M' + (238 - i * 0) + ' ' + (60 + i * 18) + 'h16l-2 10h-12Z', '#4A4A7A', 'stroke="none"')) + K.L('M246 30V16', '#E8B648', 2) + '</g>' + K.floor(250, 'plank', '#2E2E3A', '#22222C') +
      K.Pg('M0 0H680V44L640 56L600 44L560 56L520 44L480 56L440 44L400 56L360 44L320 56L280 44L240 56L200 44L160 56L120 44L80 56L40 44L0 56Z', '#C8321F') + K.rep(17, i => K.R(i * 40, 0, 20, 44, '#F4F1EA', 'opacity=".9" stroke="none"')) +
      K.neon(60, 84, 110, 60, '#FF4A6A', 'bowl') + K.neon(190, 96, 70, 50, '#4AE0FF', 'cup') + K.neon(300, 84, 120, 52, '#FFD04A', 'x') + K.stringLights(0, 56, 340, 70, 10, '#FFE08A') + K.stringLights(340, 70, 680, 56, 10, '#FF9AB0') + K.lantern(440, 56, 14, '#D8342A', '#E8B648') + K.lantern(210, 56, 12, '#D8342A', '#E8B648'),
    back: (K) => [[180, 298], [340, 290], [500, 298]].map(a => K.stool(a[0], a[1], '#E8403A', '#8A8A8A')).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#C8321F', rim: '#8A8A8A', side: '#7A1A12', leg: '#8A8A8A', runner: { c: '#F4F1EA', w: 150, o: .9 } }) },
    front: (K) => [[170, 424], [510, 424]].map(a => K.stool(a[0], a[1], '#E8403A', '#8A8A8A')).join('')
  };

  // ---- Hong Kong: a cha chaan teng, green tile walls, red leatherette booths, ceiling fans, neon and a night skyline
  TH.hongkong = {
    nolight: true,
    shelf: { x: 452, w: 206, y: 176, style: SL('#2E6A56', '#E8E0C8', 'rgba(10,40,30,.4)') },
    room: (K) => K.wall(0, 250, 'tile', '#CFE3D6', '#9ABBA8') + K.R(0, 150, 680, 100, '#2E6A56') + K.R(0, 146, 680, 6, '#E8E0C8') + K.rep(17, i => K.R(i * 40 + 3, 156, 34, 90, 'none', 'stroke="#4E8A76" stroke-width="1.4"')) + K.floor(250, 'check', '#EDEBE4', '#2A2A2A') +
      K.win(40, 50, 260, 120, { frame: '#E8E0C8', fw: 6, lat: 'cross', latc: '#E8E0C8', lw: 3, view: (x, y, w, h) => K.V.skyline(x, y, w, h, null, true) + K.rep(6, i => K.R(x + 10 + i * 40, y + 20 + (i % 3) * 18, 14, 5, ['#FF4A6A', '#4AE0FF', '#FFD04A'][i % 3], 'stroke="none"')) }) +
      K.neon(330, 60, 70, 56, '#FF4A6A', 'cup') + K.neon(420, 60, 56, 56, '#FFD04A', 'x') + K.fan(120, 24, '#C9B890') + K.fan(560, 24, '#C9B890') + K.R(0, 0, 680, 8, '#E8E0C8') + K.rep(5, i => K.R(60 + i * 130, 10, 80, 6, '#fff', 'rx="3" opacity=".9"')),
    back: (K) => K.booth(70, 250, 300, '#B8321F') + K.booth(430, 610, 300, '#B8321F') + K.booth(262, 418, 296, '#B8321F'),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#EDEBE4', rim: '#9AA6A0', side: '#8A9690', leg: '#8A9690' }) + K.R(0, 0, 0, 0, 'none') },
    front: (K) => [[170, 424], [510, 424]].map(a => K.stool(a[0], a[1], '#B8321F', '#9AA6A0')).join('')
  };

  // ---- Macau: Portuguese-Chinese, yellow plaster over blue azulejo, green shutters, a stone church facade, wave-pattern pavement
  TH.macau = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#2F5F9E', '#F4F1EA', 'rgba(10,20,50,.4)') },
    room: (K) => K.R(0, 0, 680, 250, '#F2C94A') + K.wall(150, 250, 'azulejo', '#F4F1EA', '#2F5F9E') + K.R(0, 146, 680, 6, '#2F5F9E') + K.floor(250, 'wave', '#EDEBE4', '#2A2A2A') +
      [30, 280].map(x => K.R(x, 52, 90, 160, '#3E7A4A', 'stroke="#2A4A2A" stroke-width="3"') + K.rep(8, i => K.R(x + 6, 60 + i * 18, 78, 10, '#5A9A62', 'stroke="none"')) + K.R(x - 6, 212, 102, 8, '#EDEBE4')).join('') +
      K.win(150, 60, 100, 140, { shape: 'arch', frame: '#EDEBE4', fw: 6, view: (x, y, w, h) => K.V.plain(x, y, w, h, '#D9CFB8') + K.Pg('M' + x + ' ' + (y + h) + 'V' + (y + h * .3) + 'L' + (x + w / 2) + ' ' + (y + h * .08) + 'L' + (x + w) + ' ' + (y + h * .3) + 'V' + (y + h) + 'Z', '#B8AE96') + K.rep(3, i => K.R(x + 16 + i * 26, y + h * .42, 12, h * .24, '#8A8272')) + K.Pg('M' + (x + w / 2 - 14) + ' ' + (y + h) + 'V' + (y + h * .74) + 'Q' + (x + w / 2) + ' ' + (y + h * .62) + ' ' + (x + w / 2 + 14) + ' ' + (y + h * .74) + 'V' + (y + h) + 'Z', '#6B6454') }) +
      [[380, 40], [440, 52], [500, 40]].map(p => K.L('M' + p[0] + ' 0V' + p[1], '#3b2a22', 1.4) + K.C(p[0], p[1] + 14, 14, 'rgba(255,248,220,.9)', 'stroke="#C9A24F" stroke-width="2"') + K.C(p[0], p[1] + 14, 22, 'rgba(255,230,150,.18)', 'stroke="none"')).join(''),
    back: (K) => [[200, 306], [480, 306]].map(a => K.chairB(a[0], a[1], '#3A2418', '#8A5A2B', 44)).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('azulejo', '#F4F1EA', '#2F5F9E'); return f.defs + round(K, { top: f.fill, rim: '#2F5F9E', side: '#1F3F6E', inner: '#2F5F9E' }); } },
    front: (K) => [[200, 418], [480, 418]].map(a => K.chairF(a[0], a[1], '#3A2418', '#8A5A2B', 48)).join('')
  };

  // ---- Singapore: a hawker centre, retro tile walls and mosaic table tops, strip lights, orange stools, Supertrees outside
  TH.singapore = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#8A9690', '#C9D4CE', 'rgba(20,40,30,.35)') },
    room: (K) => K.R(0, 0, 680, 250, '#E8E0C8') + K.wall(110, 250, 'tile', '#3E9A8A', '#2E7A6A') + K.R(0, 106, 680, 6, '#F4F1EA') + K.floor(250, 'check', '#EDE6D2', '#D9CFB0') + K.R(0, 0, 680, 22, '#8A9690') + K.rep(4, i => K.R(50 + i * 150, 24, 110, 7, '#fff', 'rx="3"') + K.R(46 + i * 150, 22, 118, 3, '#C9D4CE')) +
      K.win(30, 52, 260, 160, { frame: '#5A6A64', fw: 6, lat: 'none', view: (x, y, w, h) => K.V.night(x, y, w, h) + [[.25, .9], [.7, .84]].map(t => K.R(x + w * t[0] - 3, y + h * .35, 6, h * .65, '#4A3A5A') + K.E(x + w * t[0], y + h * .3, 38, 20, '#E85AA0', 'opacity=".9" stroke="none"') + K.E(x + w * t[0], y + h * .26, 24, 12, '#5AE8A0', 'opacity=".9" stroke="none"')).join('') }) +
      K.rep(3, i => K.R(320 + i * 90, 44, 76, 40, ['#E8403A', '#F2C23E', '#2F6FB5'][i], 'rx="3" stroke="#fff" stroke-width="2"') + K.L('M' + (336 + i * 90) + ' 64h44', '#fff', 3, 'opacity=".9"')) + K.fan(380, 24, '#C9D4CE') + K.fan(120, 24, '#C9D4CE'),
    back: (K) => [[170, 298], [340, 290], [510, 298]].map(a => K.stool(a[0], a[1], '#E8872B', '#8A8A8A')).join(''),
    table: { rows: RCT, draw: (K) => { const f = K.fab('mosaic', '#F4F1EA', '#2F8F8A', '#E8872B'); return f.defs + rect(K, { top: f.fill, rim: '#8A9690', side: '#6A7670', leg: '#6A7670' }); } },
    front: (K) => [[170, 424], [510, 424]].map(a => K.stool(a[0], a[1], '#E8872B', '#8A8A8A')).join('')
  };
  if (!F.THEMES._default) F.THEMES._default = F.THEMES.sichuan || TH.sichuan;
  if (typeof module !== 'undefined' && module.exports) module.exports = TH;
})(typeof window !== 'undefined' ? window : globalThis);
