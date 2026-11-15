/* Rooms for the Food diary feast tables, part 1: Sichuan, Guangdong, Hebei, Shaanxi, Jiangsu, Zhejiang, Anhui, Fujian, Jiangxi, Hunan, Hubei, Henan, Shandong, Shanxi, Liaoning, Jilin.
 * Each room is a function that draws the walls, light and decor; the table, seats and the shelf for specialties are described beside it.
 * Table rows are [y of the dishes' feet, half width] for the back, middle and front row. No screen code here. */
(function (root) {
  const F = (typeof module !== 'undefined' && module.exports) ? require('./feastscene.js') : root.FEAST;
  const TH = F.THEMES;
  const RND = [[322, 231], [360, 286], [404, 248]];     // rows of a round table (cx 340, cy 366, rx 292, ry 72)
  const RCT = [[324, 250], [364, 268], [410, 292]];     // rows of a rectangular table
  const round = (K, o) => K.roundTable(Object.assign({ cx: 340, cy: 366, rx: 292, ry: 72 }, o));
  const rect = (K, o) => K.rectTable(Object.assign({ x0: 110, x1: 570, y0: 296, X0: 40, X1: 640, y1: 430 }, o));
  const SL = (c, c2, bk) => ({ c, c2, bk: bk || 'rgba(0,0,0,.4)' });

  // ---- Sichuan: a red lacquer teahouse, bamboo stools, chili strings, pickle jars, a gingham hot-pot table
  TH.sichuan = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#2a1410', '#6B3A1A', 'rgba(0,0,0,.5)') },
    room: (K) => K.wall(0, 250, 'brick', '#7A2218', 'rgba(0,0,0,.18)') + K.R(0, 0, 680, 44, '#4A1410') + K.R(0, 236, 680, 14, '#E8B648') + K.R(0, 250, 680, 8, '#3A1812') +
      K.floor(258, 'plank', '#3A2420', '#2A1814') + K.win(34, 62, 168, 134, { frame: '#4A1410', fw: 7, lat: 'grid', latc: '#5A2218', n: 7, view: (x, y, w, h) => K.V.plain(x, y, w, h, '#F2E2B8') + K.bamboo(x + 40, y, y + h, '#6FAE4A') + K.bamboo(x + 120, y + 20, y + h, '#5E9A3E') }) +
      K.lantern(250, 0, 20, '#D8342A', '#E8B648') + K.lantern(346, 6, 28, '#E24A38', '#E8B648') + K.lantern(412, 0, 18, '#D8342A', '#E8B648') + K.chili(224, 150, 7) + K.chili(444, 160, 6) +
      [60, 100, 140, 178].map((x, i) => K.jar(x, 252, .95 + (i % 2) * .08, i % 2 ? '#8E4A1E' : '#A8571F')).join(''),
    back: (K) => [[150, 296], [340, 286], [530, 296]].map(a => K.stool(a[0], a[1], '#C9A24F')).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('check', '#A8261D', '#C83A2E'); return f.defs + round(K, { top: f.fill, rim: '#E8B648', side: '#4A1410', inner: '#fff' }); } },
    front: (K) => [[130, 420], [550, 420]].map(a => K.stool(a[0], a[1], '#C9A24F')).join('')
  };

  // ---- Guangdong: a jade dim-sum hall with a moon window, ceiling fans and a bird cage
  TH.guangdong = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#7A2A1A', '#B8864A', 'rgba(20,50,40,.55)') },
    room: (K) => K.R(0, 0, 680, 250, '#CDE6DA') + K.R(0, 190, 680, 60, '#1F6E5B') + K.R(0, 188, 680, 5, '#C9A24F') + K.rep(14, i => K.R(i * 50 + 6, 196, 38, 48, 'none', 'stroke="#4E9E88" stroke-width="2"')) +
      K.floor(250, 'check', '#EBE1C8', '#C9BEA0') + K.win(48, 46, 146, 146, { shape: 'round', frame: '#8A5A2B', fw: 8, lat: 'cross', latc: '#8A5A2B', view: (x, y, w, h) => K.V.garden(x, y, w, h) }) +
      K.fan(230, 40, '#B88B4A') + K.fan(380, 30, '#B88B4A') + K.cageBird(300, 70) + K.lantern(250, 10, 14, '#D8342A', '#E8B648') + K.lantern(420, 0, 12, '#D8342A', '#E8B648') +
      K.R(214, 210, 74, 6, '#8A5A2B') + K.R(220, 160, 62, 50, '#7A5A3A') + [0, 1, 2].map(i => K.E(250 + i * 14, 160 - i * 4, 22, 7, '#F1DDA8', 'stroke="#8A5A2B" stroke-width="1.4"')).join('') + K.R(222, 216, 4, 34, '#5A3A24') + K.R(274, 216, 4, 34, '#5A3A24'),
    back: (K) => [[170, 300], [340, 292], [510, 300]].map(a => K.chairB(a[0], a[1], '#8A3A22', '#C9A24F')).join(''),
    table: { rows: RND, draw: (K) => K.roundTable({ cx: 340, cy: 366, rx: 292, ry: 72, top: '#EEF4EE', rim: '#1F6E5B', side: '#0B4B3B', inner: '#C9A24F', leg: '#0B4B3B' }) },
    front: (K) => [[170, 414], [510, 414]].map(a => K.chairF(a[0], a[1], '#8A3A22', '#C9A24F')).join('')
  };

  // ---- Hebei (with Beijing and Tianjin): an imperial banquet hall, red pillars, the Great Wall through the lattice
  TH.hebei = {
    shelf: { x: 456, w: 202, y: 176, style: SL('#5A1A12', '#E8B648', 'rgba(60,20,10,.5)') },
    room: (K) => K.R(0, 0, 680, 250, '#8B2A1F') + K.rep(34, i => K.R(i * 20, 0, 20, 40, i % 2 ? '#E8B648' : (i % 4 ? '#1F6E5B' : '#D8342A'), 'stroke="none"')) + K.R(0, 40, 680, 8, '#E8B648') +
      K.floor(250, 'brick', '#8A8780', 'rgba(0,0,0,.25)') + K.win(70, 72, 230, 150, { frame: '#5A1A12', fw: 7, lat: 'grid', latc: '#8B2A1F', n: 8, lw: 3, view: (x, y, w, h) => K.V.wallgreat(x, y, w, h) }) +
      K.pillar(20, 34, 48, 250, '#B8321F', '#E8B648') + K.pillar(330, 34, 48, 250, '#B8321F', '#E8B648') + K.pillar(630, 34, 48, 250, '#B8321F', '#E8B648') +
      K.lantern(190, 48, 22, '#D8342A', '#E8B648') + K.lantern(420, 48, 22, '#D8342A', '#E8B648') + K.jar(380, 250, 1.4, '#1F6E5B', '#E8B648'),
    back: (K) => [[200, 308], [480, 308]].map(a => K.chairB(a[0], a[1], '#6F1F16', '#E8B648', 50)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#9A1B12', rim: '#E8B648', side: '#4A100C', runner: { c: '#E8B648', w: 150, o: .9 } }) },
    front: (K) => [[200, 420], [480, 420]].map(a => K.chairF(a[0], a[1], '#6F1F16', '#E8B648', 52)).join('')
  };

  // ---- Shaanxi: a loess cave house, arched lattice windows, a shadow-puppet screen, chili and a drum
  TH.shaanxi = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#6B4423', '#8A5A2B', 'rgba(60,30,10,.5)') },
    room: (K) => K.R(0, 0, 680, 250, '#C98B4A') + K.rep(30, i => K.C((i * 97) % 680, (i * 53) % 230, 1.6, '#A8703A', 'stroke="none"')) + K.R(0, 0, 680, 34, '#6B4423') + K.rep(4, i => K.R(60 + i * 180, 0, 26, 34, '#8A5A2B', 'stroke="none"')) +
      K.floor(250, 'brick', '#7A766E', 'rgba(0,0,0,.28)') + K.win(34, 66, 120, 164, { shape: 'arch', frame: '#5A3A1A', fw: 7, lat: 'grid', latc: '#8A5A2B', n: 5, glass: '#F2E2B8' }) +
      K.R(196, 76, 208, 124, '#F2E6CC', 'stroke="#5A3A1A" stroke-width="7"') + K.Pg('M290 190Q286 150 296 132Q292 118 302 112Q312 118 308 132Q320 152 318 190Z', '#5A1A12') + K.Pg('M334 190Q338 160 352 156Q366 150 372 170L366 190Z', '#5A1A12') + K.L('M196 150H404', '#C9B590', 1.4) +
      K.chili(176, 160, 6) + K.chili(424, 150, 6) + K.lantern(300, 0, 12, '#D8342A', '#E8B648') + K.drum(110, 226, 22, '#B8321F'),
    back: (K) => K.bench(50, 630, 268, '#6B4423', '#8A5A2B'),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#B07A44', rim: '#6B4423', side: '#5A3A1A', runner: { c: '#2F5F9E', w: 130, o: .9 } }) },
    front: (K) => K.bench(40, 640, 418, '#6B4423', '#8A5A2B')
  };

  // ---- Jiangsu: a Suzhou garden pavilion, whitewashed wall under grey roof tiles, a moon gate onto the garden
  TH.jiangsu = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#3A2418', '#6B4423', 'rgba(255,255,255,.1)') },
    room: (K) => K.R(0, 0, 680, 250, '#F1EEE4') + K.wall(0, 46, 'wave', '#4A4A4A', '#5A5A5A') + K.R(0, 46, 680, 6, '#2A2A2A') + K.floor(250, 'brick', '#B7B2A6', 'rgba(0,0,0,.2)') +
      K.win(172, 78, 170, 170, { shape: 'round', frame: '#2A2A2A', fw: 7, view: (x, y, w, h) => K.V.garden(x, y, w, h) }) + K.win(40, 90, 90, 120, { shape: 'hex', frame: '#3A2418', fw: 5, lat: 'diamond', latc: '#3A2418', n: 4, view: (x, y, w, h) => K.V.plain(x, y, w, h, '#DDEFE0') }) +
      K.lantern(380, 52, 14, '#B93A2A', '#C9A24F') + K.lantern(130, 52, 14, '#B93A2A', '#C9A24F') + K.plantPot(400, 250, 1.3, '#3E7A3A') + K.R(388, 214, 24, 6, '#3A2418'),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#4A2A1A', '#8A5A2B', 46)).join(''),
    table: { rows: RND, draw: (K) => K.roundTable({ cx: 340, cy: 366, rx: 292, ry: 72, top: '#6B4A32', rim: '#C9A24F', side: '#3A2418', inner: '#C9A24F' }) },
    front: (K) => [[200, 416], [480, 416]].map(a => K.chairF(a[0], a[1], '#4A2A1A', '#8A5A2B', 50)).join('')
  };

  // ---- Zhejiang: a boat house on West Lake, willow, a black-awning boat roof and tea hills
  TH.zhejiang = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#B8A060', '#D9C27A', 'rgba(60,50,20,.45)') },
    room: (K) => K.wall(0, 250, 'plank', '#8B6B4A', 'rgba(0,0,0,.2)') + K.win(36, 56, 380, 184, { frame: '#5A3A24', fw: 8, lat: 'none', view: (x, y, w, h) => K.V.lake(x, y, w, h) }) + K.R(24, 200, 404, 10, '#5A3A24') + K.rep(10, i => K.R(34 + i * 40, 160, 6, 50, '#5A3A24')) +
      K.floor(250, 'plank', '#9A7A52', '#7A5A38') + K.R(0, 0, 680, 40, '#2A2A2A') + K.rep(34, i => K.L('M' + (i * 20) + ' 0V40', '#4A4A4A', 2)) +
      K.rep(9, i => K.L('M' + (60 + i * 40) + ' 40q' + (i % 2 ? -8 : 8) + ' 40 ' + (i % 2 ? -4 : 4) + ' 90', '#7BA84E', 2.4, 'opacity=".9"')) + K.lantern(150, 40, 14, '#E8674A', '#E8B648') + K.lantern(320, 40, 14, '#E8674A', '#E8B648'),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#A58A52', '#7A6A3A', 44)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#C9A878', rim: '#7A5A38', side: '#6B4A28', leg: '#6B4A28', runner: { c: '#F4F1EA', w: 120, o: .95 } }) },
    front: (K) => [[200, 418], [480, 418]].map(a => K.chairF(a[0], a[1], '#A58A52', '#7A6A3A', 48)).join('')
  };

  // ---- Anhui: a Huizhou house, white wall with stepped horse-head gables, carved lattice and an ink landscape
  TH.anhui = {
    shelf: { x: 20, w: 206, y: 176, style: SL('#3A2A22', '#6B4A32', 'rgba(255,255,255,.08)') },
    room: (K) => K.R(0, 0, 680, 250, '#F4F1EA') + K.Pg('M0 0H680V34H650V50H630V34H50V50H30V34H0Z', '#2A2A2A') + K.Pg('M0 34V66H20V50H0Z', '#2A2A2A') + K.R(0, 240, 680, 10, '#8A8780') + K.floor(250, 'brick', '#8A8780', 'rgba(0,0,0,.3)') +
      K.scroll(262, 62, 140, 150, '#F2E8CF', '#3a3a3a', 'peak') + K.L('M276 190Q320 170 396 188', '#3a3a3a', 2, 'opacity=".5"') + K.win(450, 76, 190, 140, { frame: '#3A2418', fw: 7, lat: 'diamond', latc: '#3A2418', n: 8, view: (x, y, w, h) => K.V.mount(x, y, w, h, '#5A6A5A', '#7A8A7A', '#E8EEEA') }) +
      K.lantern(250, 52, 14, '#B93A2A', '#C9A24F') + K.lantern(430, 52, 14, '#B93A2A', '#C9A24F'),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#4A2A1A', '#8A5A2B', 46)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#5A3A2A', rim: '#8A5A2B', side: '#3A2418', runner: { c: '#2F5F9E', w: 120, o: .9 } }) },
    front: (K) => [[200, 418], [480, 418]].map(a => K.chairF(a[0], a[1], '#4A2A1A', '#8A5A2B', 50)).join('')
  };

  // ---- Fujian: a Hakka earth-building courtyard, a gongfu tea table, red lanterns
  TH.fujian = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#6B4A2A', '#8A6A3A', 'rgba(40,20,10,.5)') },
    room: (K) => K.R(0, 0, 680, 250, '#B98A5A') + K.rep(24, i => K.R((i * 61) % 680, (i * 37) % 230, 26, 3, '#9A6E44', 'stroke="none"')) + K.R(0, 0, 680, 30, '#6B4423') + K.floor(250, 'brick', '#8A7A62', 'rgba(0,0,0,.25)') +
      K.win(60, 60, 220, 170, { shape: 'round', frame: '#6B4423', fw: 9, view: (x, y, w, h) => K.V.sky(x, y, w, h, '#CFE6F0', '#EAF2EA') + K.E(x + w / 2, y + h * .68, w * .34, h * .16, '#B98A5A', 'stroke="#6B4423" stroke-width="2"') + K.E(x + w / 2, y + h * .66, w * .2, h * .08, '#E8D2A8') + K.R(x, y + h * .78, w, h * .22, '#6FAE4A') }) +
      K.lantern(330, 30, 18, '#D8342A', '#E8B648') + K.lantern(400, 30, 14, '#D8342A', '#E8B648') + K.R(290, 214, 84, 8, '#4A2A1A') + K.R(298, 222, 6, 28, '#4A2A1A') + K.R(360, 222, 6, 28, '#4A2A1A') + K.E(330, 206, 14, 8, '#B36A3C', 'stroke="#3a2a22" stroke-width="1.4"'),
    back: (K) => [[170, 296], [340, 288], [510, 296]].map(a => K.stool(a[0], a[1], '#6B4423', '#4A2A1A')).join(''),
    table: { rows: RND, draw: (K) => K.roundTable({ cx: 340, cy: 366, rx: 292, ry: 72, top: '#4A2A1A', rim: '#C9A24F', side: '#2A140C', inner: '#D8342A' }) },
    front: (K) => [[130, 420], [550, 420]].map(a => K.stool(a[0], a[1], '#6B4423', '#4A2A1A')).join('')
  };

  // ---- Jiangxi: Jingdezhen, blue-and-white porcelain plates on the wall, a kiln glow, a big vase
  TH.jiangxi = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#8A6A4A', '#B8946A', 'rgba(255,255,255,.1)') },
    room: (K) => K.R(0, 0, 680, 250, '#EFE9DA') + K.R(0, 0, 680, 30, '#2F5F9E') + K.rep(34, i => K.C(i * 20 + 10, 15, 5, '#EFE9DA', 'stroke="none"')) + K.floor(250, 'brick', '#B8A890', 'rgba(0,0,0,.2)') +
      [0, 1, 2].map(r => [0, 1, 2].map(c => { const x = 60 + c * 84, y = 66 + r * 62; return K.C(x, y, 26, '#F8F5EC', 'stroke="#2F5F9E" stroke-width="2.4"') + K.C(x, y, 17, 'none', 'stroke="#2F5F9E" stroke-width="1.4"') + K.Pg('M' + (x - 10) + ' ' + (y + 4) + 'q5 -16 10 -4t10 4', 'none', 'stroke="#2F5F9E" stroke-width="2"') + K.C(x, y - 3, 3, '#2F5F9E', 'stroke="none"'); }).join('')).join('') +
      K.win(310, 70, 120, 150, { shape: 'arch', frame: '#6B3A24', fw: 8, view: (x, y, w, h) => K.V.plain(x, y, w, h, '#3A1A10') + K.E(x + w / 2, y + h * .9, w * .4, h * .35, '#E8672B', 'opacity=".9" stroke="none"') + K.E(x + w / 2, y + h * .92, w * .22, h * .2, '#F6C23E', 'stroke="none"') }) +
      '<g stroke="#3a2a22" stroke-width="1.5">' + K.Pg('M400 252Q372 220 392 190V176H416V190Q436 220 408 252Z', '#F8F5EC') + K.L('M386 226Q404 232 422 226M390 208Q404 214 418 208', '#2F5F9E', 2.4) + '</g>',
    back: (K) => [[170, 298], [340, 290], [510, 298]].map(a => K.stool(a[0], a[1], '#F8F5EC', '#2F5F9E')).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('dots', '#F8F5EC', '#2F5F9E', '#6B8FC8'); return f.defs + round(K, { top: f.fill, rim: '#2F5F9E', side: '#1F3F6E', inner: '#2F5F9E' }); } },
    front: (K) => [[130, 420], [550, 420]].map(a => K.stool(a[0], a[1], '#F8F5EC', '#2F5F9E')).join('')
  };

  // ---- Hunan: a Xiangxi stilt-house tavern, chili garlands, Tujia brocade, a misty river view
  TH.hunan = {
    shelf: { x: 20, w: 206, y: 176, style: SL('#4A2A1A', '#7A4A2A', 'rgba(0,0,0,.5)') },
    room: (K) => K.wall(0, 250, 'plank', '#5A3A24', 'rgba(0,0,0,.28)') + K.floor(250, 'plank', '#3E2818', '#2A1A10') + K.win(262, 60, 170, 130, { frame: '#2A1A10', fw: 8, lat: 'cross', latc: '#2A1A10', view: (x, y, w, h) => K.V.mount(x, y, w, h, '#5A7A6A', '#7A9A8A', '#DDE8E4') + K.R(x, y + h * .78, w, h * .22, '#8FB0B0') }) +
      K.R(456, 54, 90, 150, '#2A1A10') + K.rep(6, i => K.R(462, 62 + i * 24, 78, 16, i % 2 ? '#D2392B' : '#1A1A1A') + K.R(470, 66 + i * 24, 62, 8, '#F2C23E', 'opacity=".85"')) + K.chili(250, 160, 8) + K.chili(444, 150, 7) + K.chili(560, 140, 7) + K.chili(620, 170, 8) + K.lantern(350, 0, 18, '#D8342A', '#E8B648') + K.lantern(580, 0, 14, '#D8342A', '#E8B648'),
    back: (K) => [[180, 296], [340, 288], [500, 296]].map(a => K.stool(a[0], a[1], '#7A4A2A', '#4A2A1A')).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#8A5A2B', rim: '#4A2A1A', side: '#3A2418', runner: { c: '#B8321F', w: 140, o: .92 } }) },
    front: (K) => [[170, 424], [510, 424]].map(a => K.stool(a[0], a[1], '#7A4A2A', '#4A2A1A')).join('')
  };

  // ---- Hubei: a Chu-style hall in red and black lacquer, bronze chime bells, the Yellow Crane Tower over the river
  TH.hubei = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#2A1A1A', '#B8321F', 'rgba(255,255,255,.06)') },
    room: (K) => K.R(0, 0, 680, 250, '#2A1A1A') + K.R(0, 0, 680, 30, '#B8321F') + K.R(0, 222, 680, 28, '#B8321F') + K.floor(250, 'plank', '#3A2424', '#2A1818') + K.rep(8, i => K.Pg('M' + (i * 90 + 10) + ' 30l16 14l16 -14', 'none', 'stroke="#E8B648" stroke-width="2"')) +
      K.win(40, 70, 170, 120, { frame: '#B8321F', fw: 7, lat: 'grid', latc: '#3A1010', n: 5, view: (x, y, w, h) => K.V.sky(x, y, w, h, '#E8C898', '#F6E6C8') + K.R(x, y + h * .75, w, h * .25, '#7FA8B0') + K.R(x + w * .5, y + h * .3, 40, 46, '#B8321F') + K.Pg('M' + (x + w * .5 - 8) + ' ' + (y + h * .32) + 'H' + (x + w * .5 + 48) + 'L' + (x + w * .5 + 40) + ' ' + (y + h * .22) + 'H' + (x + w * .5) + 'Z', '#2A2A2A') }) +
      K.R(244, 64, 150, 8, '#B8321F') + K.R(244, 64, 8, 150, '#B8321F') + K.R(386, 64, 8, 150, '#B8321F') + [0, 1, 2, 3, 4].map(i => K.L('M' + (264 + i * 28) + ' 72V90', '#C9A24F', 2) + K.Pg('M' + (254 + i * 28) + ' 124Q' + (254 + i * 28) + ' 90 ' + (264 + i * 28) + ' 90Q' + (284 + i * 28 - 10) + ' 90 ' + (274 + i * 28) + ' 124Z', '#B8864A', 'stroke="#3a2a22" stroke-width="1.2"')).join('') + [0, 1, 2].map(i => K.Pg('M' + (258 + i * 40) + ' 190Q' + (258 + i * 40) + ' 150 ' + (270 + i * 40) + ' 150Q' + (294 + i * 40 - 12) + ' 150 ' + (282 + i * 40) + ' 190Z', '#B8864A', 'stroke="#3a2a22" stroke-width="1.2"') + K.L('M' + (270 + i * 40) + ' 142V150', '#C9A24F', 2)).join('') + K.lantern(420, 30, 14, '#D8342A', '#E8B648'),
    back: (K) => [[200, 308], [480, 308]].map(a => K.chairB(a[0], a[1], '#1A1010', '#B8321F', 48)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#1A1010', rim: '#B8321F', side: '#0A0606', runner: { c: '#B8321F', w: 130, o: .9 } }) },
    front: (K) => [[200, 420], [480, 420]].map(a => K.chairF(a[0], a[1], '#1A1010', '#B8321F', 50)).join('')
  };

  // ---- Henan: Luoyang peonies and a Longmen cave niche, Song-style red pillars
  TH.henan = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#5A3A24', '#C9A24F', 'rgba(60,30,20,.4)') },
    room: (K) => K.R(0, 0, 680, 250, '#F4E3C8') + K.R(0, 0, 680, 30, '#B8321F') + K.floor(250, 'brick', '#A8A096', 'rgba(0,0,0,.22)') +
      K.win(40, 62, 130, 170, { shape: 'arch', frame: '#6B6A66', fw: 8, view: (x, y, w, h) => K.V.plain(x, y, w, h, '#8A8A84') + K.C(x + w / 2, y + h * .38, 22, '#B8B4A8', 'stroke="none"') + K.Pg('M' + (x + 14) + ' ' + (y + h) + 'Q' + (x + 16) + ' ' + (y + h * .58) + ' ' + (x + w / 2) + ' ' + (y + h * .56) + 'Q' + (x + w - 16) + ' ' + (y + h * .58) + ' ' + (x + w - 14) + ' ' + (y + h) + 'Z', '#B8B4A8') + K.C(x + w / 2, y + h * .38, 34, 'none', 'stroke="#D8D4C8" stroke-width="3"') }) +
      [[230, 100, 34, '#D8607A'], [310, 150, 28, '#E88AA0'], [380, 96, 30, '#B8321F']].map(p => K.rep(6, i => K.E(p[0] + Math.cos(i * 1.05) * p[2] * .55, p[1] + Math.sin(i * 1.05) * p[2] * .55, p[2] * .55, p[2] * .5, p[3], 'opacity=".92" stroke="rgba(0,0,0,.25)" stroke-width="1"')) + K.C(p[0], p[1], p[2] * .3, '#F2C23E', 'stroke="none"')).join('') + K.L('M230 134Q232 190 240 250M310 178Q312 214 318 250M380 126Q384 190 372 250', '#4E8F3A', 3) +
      K.pillar(200, 26, 30, 250, '#B8321F', '#E8B648') + K.pillar(420, 26, 30, 250, '#B8321F', '#E8B648') + K.lantern(310, 30, 16, '#D8342A', '#E8B648'),
    back: (K) => [[190, 304], [490, 304]].map(a => K.chairB(a[0], a[1], '#7A4A2A', '#C9A24F', 46)).join(''),
    table: { rows: RND, draw: (K) => K.roundTable({ cx: 340, cy: 366, rx: 292, ry: 72, top: '#E8A8B8', rim: '#B8321F', side: '#5A1A22', inner: '#fff' }) },
    front: (K) => [[190, 416], [490, 416]].map(a => K.chairF(a[0], a[1], '#7A4A2A', '#C9A24F', 50)).join('')
  };

  // ---- Shandong: a Confucian study hall, bamboo-slip screens, a ginkgo in gold, big red doors
  TH.shandong = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#3A2418', '#7A4A2A', 'rgba(0,0,0,.45)') },
    room: (K) => K.R(0, 0, 680, 250, '#B8A078') + K.R(0, 0, 680, 34, '#6B1F18') + K.floor(250, 'brick', '#8A8478', 'rgba(0,0,0,.25)') +
      K.win(50, 60, 170, 160, { shape: 'arch', frame: '#6B1F18', fw: 8, view: (x, y, w, h) => K.V.sky(x, y, w, h, '#CFE0EC', '#F1F1E4') + K.L('M' + (x + w / 2) + ' ' + (y + h) + 'V' + (y + h * .5), '#5A3A24', 8) + K.E(x + w / 2, y + h * .4, w * .38, h * .3, '#E8B648', 'stroke="none"') + K.E(x + w * .35, y + h * .5, w * .2, h * .16, '#D9A12A', 'stroke="none"') + K.R(x, y + h * .88, w, h * .12, '#E8D8A8') }) +
      K.rep(9, i => K.R(246 + i * 18, 70, 14, 130, '#D9C28A', 'stroke="#8A6A3A" stroke-width="1.4"') + K.L('M' + (253 + i * 18) + ' 80V190', '#8A6A3A', 1, 'opacity=".7"')) + K.R(240, 62, 170, 8, '#3A2418') + K.R(240, 200, 170, 8, '#3A2418') + K.lantern(330, 34, 16, '#B93A2A', '#C9A24F') + K.pillar(424, 24, 34, 250, '#8B2A1F', '#C9A24F') + K.pillar(22, 24, 34, 250, '#8B2A1F', '#C9A24F'),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#4A2A1A', '#8A5A2B', 48)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#3A2418', rim: '#8A5A2B', side: '#2A140C', runner: { c: '#F4F1EA', w: 110, o: .95 } }) },
    front: (K) => [[200, 420], [480, 420]].map(a => K.chairF(a[0], a[1], '#4A2A1A', '#8A5A2B', 52)).join('')
  };

  // ---- Shanxi: a Pingyao merchant courtyard, grey brick, red lantern lines, paper-cut windows and vinegar jars
  TH.shanxi = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#3A2A22', '#6B4A32', 'rgba(0,0,0,.45)') },
    room: (K) => K.wall(0, 250, 'brick', '#8A8780', 'rgba(0,0,0,.3)') + K.R(0, 0, 680, 36, '#4A4A48') + K.rep(34, i => K.Pg('M' + (i * 20) + ' 36Q' + (i * 20 + 10) + ' 52 ' + (i * 20 + 20) + ' 36Z', '#4A4A48')) + K.floor(250, 'brick', '#6E6A64', 'rgba(0,0,0,.3)') +
      [40, 150].map(x => K.R(x, 74, 90, 118, '#5A3A24') + K.R(x + 8, 82, 74, 102, '#F6EEDC') + K.rep(3, i => K.rep(3, j => K.R(x + 12 + i * 22, 86 + j * 32, 14, 24, '#C8321F', 'rx="3" opacity=".85"')))).join('') +
      K.stringLights(0, 40, 340, 60, 8, '#E8472B') + K.stringLights(340, 60, 680, 40, 8, '#E8472B') + K.lantern(260, 44, 20, '#D8342A', '#E8B648') + K.lantern(400, 44, 18, '#D8342A', '#E8B648') + [270, 310, 350, 390].map((x, i) => K.jar(x, 250, 1.1, i % 2 ? '#3A2A22' : '#5A3A2A', '#B8321F')).join(''),
    back: (K) => [[200, 304], [480, 304]].map(a => K.chairB(a[0], a[1], '#5A3A24', '#8A5A2B', 46)).join(''),
    table: { rows: RCT, draw: (K) => rect(K, { top: '#6B4423', rim: '#3A2418', side: '#3A2418', runner: { c: '#C8321F', w: 130, o: .92 } }) },
    front: (K) => [[200, 420], [480, 420]].map(a => K.chairF(a[0], a[1], '#5A3A24', '#8A5A2B', 50)).join('')
  };

  // ---- Liaoning: a Northeast kang room, big-flower print quilts, Shenyang palace roofs outside, sea nets
  TH.liaoning = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#6B3A24', '#B8643A', 'rgba(60,20,10,.4)') },
    room: (K) => K.R(0, 0, 680, 250, '#EADFC8') + K.R(0, 0, 680, 28, '#C8321F') + K.floor(250, 'plank', '#9A6A44', '#7A4A2A') +
      K.win(250, 62, 170, 130, { frame: '#C8321F', fw: 7, lat: 'cross', latc: '#C8321F', view: (x, y, w, h) => K.V.sky(x, y, w, h, '#CFE0EC', '#F6EEDC') + K.Pg('M' + x + ' ' + (y + h * .6) + 'Q' + (x + w * .5) + ' ' + (y + h * .25) + ' ' + (x + w) + ' ' + (y + h * .6) + 'V' + (y + h) + 'H' + x + 'Z', '#E8B820') + K.R(x, y + h * .6, w, h * .4, '#B8321F') }) +
      K.R(30, 150, 200, 80, '#C8321F', 'rx="10" stroke="#8A1F18" stroke-width="2"') + [0, 1, 2, 3, 4].map(i => K.C(60 + i * 36, 190, 14, '#F4B8C8', 'stroke="none"') + K.C(60 + i * 36, 190, 6, '#F2C23E', 'stroke="none"') + K.E(60 + i * 36 + 18, 170, 9, 5, '#4E8F3A', 'stroke="none"')).join('') + K.R(30, 134, 200, 18, '#F4F1EA', 'rx="8"') +
      K.L('M440 20Q460 100 440 160M470 20Q490 110 470 170', '#9AA6A0', 2) + K.rep(7, i => K.L('M' + (436 + i * 8) + ' 60V150', '#9AA6A0', 1)) + K.lantern(336, 28, 14, '#D8342A', '#E8B648'),
    back: (K) => [[180, 298], [340, 290], [500, 298]].map(a => K.stool(a[0], a[1], '#C8321F', '#6B3A24')).join(''),
    table: { rows: RND, draw: (K) => { const f = K.fab('dots', '#F6EEDC', '#D8607A', '#4E8F3A'); return f.defs + round(K, { top: f.fill, rim: '#C8321F', side: '#8A1F18', inner: '#fff' }); } },
    front: (K) => [[130, 420], [550, 420]].map(a => K.stool(a[0], a[1], '#C8321F', '#6B3A24')).join('')
  };

  // ---- Jilin: a Korean-Chinese (Yanbian) floor-table room, paper sliding doors, snow and rime-ice trees outside
  TH.jilin = {
    shelf: { x: 452, w: 206, y: 176, style: SL('#5A3A24', '#9A6A44', 'rgba(255,255,255,.12)') },
    room: (K) => K.R(0, 0, 680, 250, '#F1E8D4') + K.R(0, 0, 680, 22, '#5A3A24') + K.floor(250, 'plank', '#E8C77A', '#D9B25A') +
      K.win(30, 54, 380, 186, { frame: '#5A3A24', fw: 8, lat: 'grid', latc: '#8A5A2B', n: 8, lw: 2.2, glass: '#fff', view: (x, y, w, h) => K.V.snow(x, y, w, h) + K.rep(6, i => K.L('M' + (x + 30 + i * 60) + ' ' + (y + h) + 'V' + (y + h * .45), '#fff', 5, 'opacity=".95"') + K.E(x + 30 + i * 60, y + h * .4, 16, 12, '#fff', 'opacity=".9" stroke="none"')) }) +
      K.rep(3, i => K.C(150 + i * 120, 14, 16, '#F6F0E0', 'stroke="#C9B590" stroke-width="1.4"')) + K.L('M460 40Q500 130 560 70Q600 20 640 90', '#C8321F', 4, 'opacity=".9"') + K.Pg('M452 214Q480 196 508 214V250H452Z', '#4A8FD8') + K.Pg('M508 214Q530 200 552 214V250H508Z', '#E8645A'),
    back: (K) => [[170, 292], [340, 288], [510, 292]].map(a => K.cushion(a[0], a[1], 40, '#C8321F', '#F2C23E')).join(''),
    table: { rows: RCT, draw: (K) => K.lowTable({ x0: 110, x1: 570, y0: 298, X0: 50, X1: 630, y1: 428, top: '#6B2A22', side: '#3A1410', rim: '#E8B648' }) },
    front: (K) => [[150, 428], [340, 434], [530, 428]].map(a => K.cushion(a[0], a[1], 46, '#2F6FB5', '#E8E0CC')).join('')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TH;
})(typeof window !== 'undefined' ? window : globalThis);
