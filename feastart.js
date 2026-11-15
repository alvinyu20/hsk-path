/* Feast art for the Food diary: small flat drawings of dishes in their own bowl, plate, steamer, glass or pot, drawn with one ink outline.
 * FEAST.classify(stop) picks a drawing and a colour variant for every dish, drink, specialty and craft stop from its name.
 * FEAST.draw(arch, p) gives the SVG (base of the dish at 0,0, about 90 wide); FEAST.ARCH lists every drawing.
 * No screen code here. */
(function (root) {
  const OL = '#3a2a22', WH = '#F4F1EA', BL = '#2F5F9E', N = 'stroke="none"';
  const R = (x, y, w, h, f, x2) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const C = (x, y, r, f, x2) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const E = (x, y, rx, ry, f, x2) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const Pg = (d, f, x2) => '<path d="' + d + '" fill="' + f + '" ' + (x2 || '') + '/>';
  const L = (d, s, w, x2) => '<path d="' + d + '" fill="none" stroke="' + s + '" stroke-width="' + (w || 2) + '" ' + (x2 || '') + '/>';
  const pick = (a, h, s) => a[((h >>> (s || 0)) & 0xffff) % a.length];
  const stm = (x, y) => '<g class="fz-stm" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.2" stroke-linecap="round"><path d="M' + (x - 9) + ' ' + y + 'q-5 -8 0 -14t0 -12"/><path d="M' + x + ' ' + (y - 3) + 'q-5 -8 0 -14t0 -12"/><path d="M' + (x + 9) + ' ' + y + 'q-5 -8 0 -14t0 -12"/></g>';
  const dots = (a, col, r) => a.map(q => C(q[0], q[1], r || 2, col, N)).join('');
  const chop = (x, y) => L('M' + x + ' ' + y + 'L' + (x + 22) + ' ' + (y - 30) + 'M' + (x + 6) + ' ' + y + 'L' + (x + 28) + ' ' + (y - 28), '#8A5A2B', 2.2);
  const GR = '#4E8F3A';
  const bowl = (w, h, liq, body) => { body = body || WH; return Pg('M' + (-w) + ' ' + (-h) + 'Q' + (-w + 4) + ' -2 ' + (-w * .4) + ' 0H' + (w * .4) + 'Q' + (w - 4) + ' -2 ' + w + ' ' + (-h) + 'Z', body) + L('M' + (-w + 3) + ' ' + (-h * .4) + 'Q0 ' + (-h * .4 + w * .22) + ' ' + (w - 3) + ' ' + (-h * .4), body === WH ? BL : '#fff', 2, 'opacity=".7" stroke-linecap="round"') + E(0, -h, w, w * .27, body) + E(0, -h + 1, w - 3, w * .22, liq); };
  const plate = (w, body) => E(0, -3, w, w * .27, body || WH) + E(0, -4, w * .72, w * .19, 'none', 'stroke-opacity=".3"');
  const board = (w) => Pg('M' + (-w) + ' -4L' + (-w + 8) + ' -14H' + (w + 4) + 'L' + (w - 6) + ' -4Z', '#C79A5A') + R(-w, -4, w * 2 - 6, 4, '#9B7330');
  const steamer = (inside) => R(-32, -26, 64, 26, '#D9B26A') + L('M-32 -17H32M-32 -9H32', '#9B7330', 1.5) + E(0, -26, 32, 9, '#E8C98A') + E(0, -26, 27, 7, '#B98E48') + inside + L('M-32 -26V0M32 -26V0', '#9B7330', 2);
  const sauce = (w) => E(w || 34, -5, 8, 3, WH) + E(w || 34, -7, 5.5, 2, '#5a2a14', N);
  const Pcol = (p, a, s) => pick(a, p.h, s);

  // colour sets chosen by what the name says
  const RED = ['#B3261E', '#C0392B', '#A8261D'], GOLD = ['#E9B974', '#E6C27A', '#D9A441'], MILK = ['#F1E3BE', '#EFE6CF', '#E7DCC0'], SOY = ['#6E4B2A', '#7A4A24', '#5F4126'], CLEAR = ['#D8C58A', '#CDBB7E', '#E3D29A'];
  const broth = (p, red, milk) => red ? Pcol(p, RED) : milk ? Pcol(p, MILK) : Pcol(p, GOLD.concat(SOY, CLEAR));

  const A = {
    noodle: (p) => bowl(36, 26, broth(p, p.red, p.milk)) + Pg('M-24 -27q6 -8 12 0t12 0t12 0', 'none', 'stroke="#F7E3A8" stroke-width="3.5"') + Pg('M-22 -23q6 -8 12 0t12 0t12 0', 'none', 'stroke="#F7E3A8" stroke-width="3.5"') + (p.h % 2 ? E(-8, -29, 9, 4.5, '#FBF6EA') + C(-8, -29, 2.6, '#E9A92B', N) : E(-6, -29, 10, 4, '#7A3A1A')) + dots([[8, -30], [14, -27], [0, -33]], GR, 1.8) + (p.h % 3 ? chop(8, -30) : '') + stm(-6, -38),
    ricenoodle: (p) => bowl(36, 26, broth(p, p.red, true)) + [-20, -10, 0, 10, 20].map((x, i) => L('M' + x + ' -28q' + (i % 2 ? 6 : -6) + ' -6 ' + (i % 2 ? -4 : 4) + ' -12', '#fff', 2.2)).join('') + E(0, -28, 22, 4, '#FBF6EA', 'opacity=".9" stroke="none"') + dots([[-10, -30], [8, -29], [16, -31], [-18, -27]], p.red ? '#C0392B' : '#7BA84E', 2.1) + E(2, -31, 8, 3, '#7A3A1A') + stm(0, -38),
    drynoodle: (p) => plate(44) + Pg('M-24 -8q8 -16 16 -6t16 -4t16 4q-8 10 -24 8t-24 -2Z', Pcol(p, ['#F2DCA4', '#EBCB86', '#F4E6B8'])) + Pg('M-20 -12q8 -4 14 0t14 -2', 'none', 'stroke="#E0BE70" stroke-width="3"') + E(2, -16, 12, 5, p.red ? '#C0392B' : '#6B3A1A') + dots([[-8, -18], [10, -17], [-14, -12], [14, -11]], GR, 1.9) + stm(0, -22),
    coldnoodle: (p) => plate(42) + [0, 1, 2, 3, 4, 5].map(i => R(-24 + i * 7, -17 - (i % 2), 5, 14, Pcol(p, ['#F6EBC8', '#EFE7D1', '#F3E3B5']), 'rx="2" transform="rotate(' + (i * 4 - 10) + ' ' + (-22 + i * 7) + ' -10)" stroke-width="1"')).join('') + E(0, -14, 12, 4, '#C0392B', 'opacity=".85"') + dots([[-10, -18], [8, -19], [16, -14]], GR, 2) + dots([[-4, -20], [4, -16]], '#6e150d', 1.6),
    soup: (p) => bowl(34, 24, broth(p, p.red, p.milk)) + [[-12, -23, 10], [0, -25, -8], [12, -22, 14]].map((c, i) => R(c[0] - 5, c[1] - 5, 10, 10, pick(['#F6EFD8', '#C99A6B', '#E9C27A'], p.h, i), 'transform="rotate(' + c[2] + ' ' + c[0] + ' ' + c[1] + ')" rx="2"')).join('') + dots([[-16, -18], [8, -17], [16, -26], [-8, -28]], GR, 1.8) + stm(0, -30),
    porridge: (p) => bowl(32, 22, Pcol(p, ['#F3EBD3', '#EADFC0', '#EFE0B8'])) + E(0, -24, 20, 5, '#fff', 'opacity=".5" stroke="none"') + dots([[-8, -24], [4, -25], [10, -22], [-14, -21]], pick(['#7BA84E', '#C0392B', '#8A5A2B'], p.h), 2.3) + E(2, -26, 7, 3, '#E8B64A') + stm(0, -32),
    hotpot: (p) => R(-28, -8, 56, 8, '#454545') + Pg('M-40 -34Q-38 -12 -28 -8H28Q38 -12 40 -34Z', '#B8672A') + E(-43, -32, 4, 6, '#D4894A') + E(43, -32, 4, 6, '#D4894A') + E(0, -34, 40, 11, '#D4894A') + E(0, -34, 35, 9, p.red ? '#C9301F' : '#E9C86B') + (p.red ? Pg('M0 -43A35 9 0 0 1 0 -25Z', '#E9C86B', N) + L('M0 -43V-25', '#E8D8B8', 2.5) : '') + dots([[-22, -35], [-14, -31], [-24, -30], [-8, -36]], p.red ? '#6e150d' : '#F6EFD8', 2.2) + dots([[14, -34], [24, -33]], GR, 2) + stm(0, -46),
    claypot: (p) => E(0, -2, 34, 7, '#7A4A2A') + Pg('M-34 -28Q-32 -4 -18 -2H18Q32 -4 34 -28Z', pick(['#B36A3C', '#9B5A30', '#7A4A2A'], p.h)) + E(-36, -24, 5, 7, '#8E5230') + E(36, -24, 5, 7, '#8E5230') + Pg('M-36 -28Q0 -58 36 -28Q0 -22 -36 -28Z', '#C7824F') + C(0, -46, 5, '#8E5230') + stm(0, -52),
    ricebowl: (p) => bowl(32, 24, '#FBF6EA') + E(0, -28, 24, 8, '#FBF6EA') + E(0, -31, 18, 6, pick(['#7A3A1A', '#C0392B', '#8E5A2A', '#E8B64A'], p.h)) + dots([[-6, -33], [6, -31], [10, -34]], GR, 1.8) + E(14, -30, 6, 3.5, '#FBF6EA') + C(14, -30, 2, '#E9A92B', N) + stm(-4, -38),
    pilaf: (p) => plate(48) + E(0, -13, 32, 13, '#E8B04A') + E(-6, -20, 20, 7, '#F0C468', 'opacity=".9" stroke="none"') + dots([[-14, -18], [-4, -22], [6, -16], [16, -20], [-20, -12], [10, -26]], '#E8672B', 2.4) + dots([[-10, -14], [14, -14], [2, -24]], '#7A2A55', 2) + E(0, -26, 9, 4.5, '#8E4A1A') + stm(0, -32),
    bun: (p) => steamer([[-14, -27], [0, -29], [14, -27]].map(q => E(q[0], q[1] - 2, 10, 8, '#FBF6EA') + L('M' + (q[0] - 4) + ' ' + (q[1] - 6) + 'q4 4 8 0', '#D9B7A0', 1.5)).join('') + stm(0, -34)),
    xlb: (p) => steamer([[-14, -27], [0, -29], [14, -27]].map(q => Pg('M' + (q[0] - 9) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] - 14) + ' ' + (q[0] + 9) + ' ' + q[1] + 'Z', '#F4E9D2') + L('M' + (q[0] - 4) + ' ' + (q[1] - 6) + 'l2 3M' + q[0] + ' ' + (q[1] - 8) + 'v3M' + (q[0] + 4) + ' ' + (q[1] - 6) + 'l-2 3', '#C9B79A', 1.2)).join('') + stm(0, -34)),
    shrimp: (p) => steamer([[-14, -27], [0, -29], [14, -27]].map(q => Pg('M' + (q[0] - 10) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] - 14) + ' ' + (q[0] + 10) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] + 3) + ' ' + (q[0] - 10) + ' ' + q[1] + 'Z', '#F6D7D0')).join('') + dots([[-14, -30], [0, -32], [14, -30]], '#E8837A', 2)),
    siumai: (p) => steamer([[-14, -27], [0, -29], [14, -27]].map(q => E(q[0], q[1], 9, 6, '#F5D48A') + E(q[0], q[1] - 3, 4, 2.5, '#E88B2B', N)).join('')),
    dumplings: (p) => plate(42) + [[-20, -10], [-4, -14], [12, -10], [0, -6]].map(q => Pg('M' + (q[0] - 11) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] - 16) + ' ' + (q[0] + 11) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] + 4) + ' ' + (q[0] - 11) + ' ' + q[1] + 'Z', '#FBF6EA') + L('M' + (q[0] - 6) + ' ' + (q[1] - 6) + 'l2 4M' + q[0] + ' ' + (q[1] - 8) + 'v4M' + (q[0] + 6) + ' ' + (q[1] - 6) + 'l-2 4', '#C9B79A', 1.2)).join('') + sauce(34) + stm(0, -22),
    wonton: (p) => bowl(38, 16, p.red ? '#C0392B' : Pcol(p, CLEAR)) + [[-16, -18], [0, -16], [16, -18]].map(q => Pg('M' + (q[0] - 8) + ' ' + q[1] + 'q8 -12 16 0q-8 5 -16 0Z', '#F3E2C0') + L('M' + (q[0] + 8) + ' ' + q[1] + 'q6 -3 7 -8', '#F3E2C0', 2.5)).join('') + dots([[-6, -22], [10, -23], [-22, -14]], GR, 1.8) + stm(0, -24),
    flatbread: (p) => board(40) + E(0, -16, 32, 11, pick(['#D9A15A', '#C98A3E', '#E0B070'], p.h)) + E(0, -21, 30, 8, pick(['#E8B878', '#D9A15A', '#EBC48A'], p.h)) + dots([[-12, -22], [-2, -24], [10, -21], [16, -23], [-18, -19], [4, -18]], '#F6E8C8', 1.5) + L('M-26 -16Q0 -9 26 -16', '#8E5A2A', 1.2),
    roujiamo: (p) => R(-30, -8, 60, 8, '#C79A5A') + Pg('M-28 -8Q-26 -34 0 -34Q26 -34 28 -8Z', '#D9A15A') + Pg('M-28 -8H28Q26 -18 0 -18Q-26 -18 -28 -8Z', '#F1D9A8') + Pg('M-24 -12Q0 -24 24 -12Q0 -16 -24 -12Z', '#7A3A1A') + dots([[-8, -14], [6, -14], [14, -13]], GR, 1.8) + L('M-28 -8H28', '#8E5A2A', 1.5),
    rolls: (p) => plate(44) + [-18, 0, 18].map((x, i) => R(x - 9, -20 + (i % 2) * 2, 18, 15, Pcol(p, ['#F6F0E0', '#EFE3C3', '#E9D2A0']), 'rx="7"') + L('M' + (x - 5) + ' -14Q' + x + ' -10 ' + (x + 5) + ' -14', '#D9C9A8', 1.3)).join('') + E(0, -22, 26, 3, '#7A3A1A', 'opacity=".55" stroke="none"') + dots([[-12, -22], [10, -23]], '#4E8F3A', 1.8),
    bread: (p) => board(42) + Pg('M-30 -14Q-30 -34 0 -34Q30 -34 30 -14Q30 -8 24 -8H-24Q-30 -8 -30 -14Z', pick(['#C98A3E', '#B97A30', '#D9A15A'], p.h)) + L('M-14 -30l6 12M0 -32l6 12M14 -30l6 12', '#F0D9A8', 2.4) + (p.h % 2 ? E(38, -10, 6, 3, '#F4E3B8') : ''),
    roastbird: (p) => E(0, -3, 50, 13, WH) + E(0, -4, 40, 10, 'none', 'stroke-opacity=".3"') + Pg('M-26 -10Q-30 -34 -6 -36Q22 -38 30 -24Q34 -12 14 -8Q-8 -4 -26 -10Z', pick(['#A8501B', '#B8601F', '#9B4A1A'], p.h)) + Pg('M-18 -26Q0 -32 20 -26', 'none', 'stroke="#E0903E" stroke-width="3" opacity=".8"') + (p.h % 2 ? Pg('M26 -26Q40 -34 40 -42Q34 -42 28 -34', '#8E4217') : Pg('M28 -22Q40 -22 42 -14Q36 -12 28 -14', '#8E4217')) + Pg('M-26 -14L-38 -8L-30 -4Z', '#8E4217') + dots([[-36, -6], [40, -8]], GR, 2.2),
    meatplate: (p) => plate(42) + E(0, -12, 28, 12, pick(['#A25416', '#7A2A1A', '#8E3320', '#6B3A1A'], p.h)) + [[-14, -14], [-4, -20], [8, -16], [16, -12], [-2, -12], [-18, -9], [0, -26]].map(q => R(q[0] - 4, q[1] - 4, 8, 8, pick(['#B5651D', '#9A3A22', '#8A4A22'], p.h, 3), 'rx="2"')).join('') + dots([[-8, -16], [12, -20], [4, -10], [-14, -18]], pick(['#E3B766', '#4E8F3A', '#C0392B'], p.h, 5), 2.2) + stm(0, -26),
    slices: (p) => plate(44) + [[-24, -10], [-12, -14], [0, -16], [12, -14], [24, -10]].map((q, i) => E(q[0], q[1], 10, 5, i % 2 ? '#7A2A1A' : '#8E3320', 'transform="rotate(' + (i * 14 - 28) + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + E(0, -12, 26, 7, p.red ? '#C0392B' : '#E3B766', 'opacity=".5" stroke="none"') + dots([[-6, -18], [8, -16], [-16, -14]], '#F3E8C8', 1.6) + dots([[0, -22], [16, -20]], GR, 2.2),
    braised: (p) => bowl(34, 24, pick(SOY, p.h)) + [[-14, -26, 8], [2, -28, -6], [14, -25, 12]].map(q => R(q[0] - 6, q[1] - 5, 12, 10, '#D9B27A', 'rx="3" transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + E(-2, -24, 8, 5, '#9B6A3A') + dots([[8, -22], [-8, -31]], GR, 2) + stm(0, -34),
    skewers: (p) => R(-38, -14, 76, 14, '#3a3a3a') + E(0, -14, 38, 6, '#2a2a2a') + E(0, -14, 32, 4.5, '#E8672B') + E(0, -14, 22, 2.8, '#F6B93B', N) + [-6, -1, 4].map((y, i) => L('M-44 ' + (y - 14) + 'L44 ' + (y - 18 + i * 2), '#8A8A8A', 2) + [-26, -8, 10, 28].map(x => R(x - 5, y - 22 + i * 2 + (x > 0 ? 1 : 0), 10, 9, pick(['#A04A2A', '#8E3A1E', '#B5651D'], p.h, i), 'rx="2" ' + N)).join('')).join('') + stm(0, -24),
    lamb: (p) => board(44) + [[-22, -18, -10], [0, -22, 6], [22, -17, 14]].map(q => Pg('M' + (q[0] - 12) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] - 16) + ' ' + (q[0] + 12) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] + 6) + ' ' + (q[0] - 12) + ' ' + q[1] + 'Z', pick(['#B5651D', '#A0522D', '#C8762A'], p.h), 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"') + E(q[0] + 12, q[1] - 2, 4, 3, '#F4EBD8')).join('') + dots([[-8, -24], [12, -24]], GR, 2) + stm(0, -34),
    hock: (p) => plate(46) + Pg('M-24 -8Q-28 -30 -4 -34Q22 -36 26 -18Q26 -6 6 -6Q-14 -4 -24 -8Z', pick(['#8E4A1E', '#7A3A1A', '#9B5522'], p.h)) + Pg('M-18 -26Q0 -34 20 -26', 'none', 'stroke="#D98A45" stroke-width="3" opacity=".7"') + E(28, -16, 5, 4, '#F4EBD8') + dots([[-30, -6], [34, -5]], GR, 2.2) + stm(0, -38),
    sausage: (p) => plate(44) + Pg('M-28 -8Q-30 -26 -8 -26Q14 -26 14 -14Q14 -6 -4 -6Q-14 -12 -2 -16', 'none', 'stroke="' + pick(['#A8261D', '#8E3320', '#B8501F'], p.h) + '" stroke-width="9" stroke-linecap="round"') + [[22, -8], [30, -12]].map(q => E(q[0], q[1], 7, 4, '#C0553A')).join('') + dots([[-14, -28]], GR, 2),
    fish: (p) => Pg('M-46 -22Q-46 -2 -26 -1H26Q46 -2 46 -22Z', WH) + E(0, -22, 46, 14, WH) + E(0, -22, 40, 11, p.red ? '#C0392B' : p.milk ? '#F1E3BE' : '#C9A24F') + [[-18, -24, -14], [0, -22, 6], [16, -25, 16]].map(q => E(q[0], q[1], 12, 4.5, '#F6EAD0', 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + dots(p.red ? [[-28, -22], [-24, -17], [26, -18], [30, -24], [6, -17]] : [[-28, -22], [28, -20]], p.red ? '#6e150d' : GR, 2) + dots([[-4, -25], [22, -22]], GR, 2) + stm(0, -34),
    wholefish: (p) => E(0, -4, 48, 12, WH) + E(0, -5, 40, 9, 'none', 'stroke-opacity=".3"') + Pg('M-32 -12Q-12 -34 22 -22L38 -30L36 -12L38 2L22 -6Q-12 0 -32 -12Z', pick(['#C9A24F', '#B8601F', '#D9B26A'], p.h)) + L('M-8 -24Q-2 -14 -8 -6M6 -24Q12 -14 6 -6', '#8E5A2A', 1.3) + C(-24, -14, 2, OL, N) + dots([[-6, -18], [4, -14], [12, -18]], GR, 1.8) + stm(0, -30),
    crab: (p) => plate(48) + E(0, -14, 22, 13, '#D2402B') + Pg('M-20 -16L-36 -30Q-40 -42 -30 -40L-24 -28', '#D2402B') + Pg('M20 -16L36 -30Q40 -42 30 -40L24 -28', '#D2402B') + L('M-20 -10L-38 -8M-18 -6L-34 0M20 -10L38 -8M18 -6L34 0', '#B03020', 2.4) + dots([[-7, -22], [7, -22]], OL, 2) + L('M-8 -12Q0 -8 8 -12', '#8E2418', 1.5),
    prawns: (p) => plate(48) + [[-22, -10, -10], [-4, -14, 8], [14, -10, -4], [28, -8, 14]].map(q => Pg('M' + (q[0] - 12) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] - 22) + ' ' + (q[0] + 10) + ' ' + (q[1] - 4) + 'L' + (q[0] + 14) + ' ' + (q[1] + 2) + 'L' + (q[0] + 8) + ' ' + (q[1] + 1) + 'Q' + q[0] + ' ' + (q[1] - 10) + ' ' + (q[0] - 12) + ' ' + (q[1] + 4) + 'Z', pick(['#E8674A', '#EF8A5C', '#D9532F'], p.h), 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + E(-30, -6, 6, 4, '#F2E26E') + stm(0, -28),
    oyster: (p) => plate(46) + [[-20, -8], [0, -12], [20, -8]].map(q => Pg('M' + (q[0] - 12) + ' ' + q[1] + 'Q' + (q[0] - 14) + ' ' + (q[1] - 12) + ' ' + q[0] + ' ' + (q[1] - 12) + 'Q' + (q[0] + 14) + ' ' + (q[1] - 12) + ' ' + (q[0] + 12) + ' ' + q[1] + 'Q' + q[0] + ' ' + (q[1] + 5) + ' ' + (q[0] - 12) + ' ' + q[1] + 'Z', '#8A8A7E') + E(q[0], q[1] - 6, 8, 3.5, '#EFE6CF')).join('') + dots([[-2, -20], [14, -18]], '#E8C14A', 2) + dots([[-34, -6]], '#E8C14A', 4),
    tofu: (p) => plate(42) + [[-14, -11, 4], [2, -14, -6], [16, -10, 8], [-4, -7, 0], [-20, -5, -4]].map(q => R(q[0] - 7, q[1] - 7, 14, 12, p.fried ? '#E3B24A' : '#F8F2DE', 'rx="3" transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + dots(p.red ? [[-10, -16], [8, -18], [14, -12]] : [[-8, -17], [10, -16]], p.red ? '#C0392B' : GR, 2.2) + stm(0, -24),
    veg: (p) => plate(42) + [[-18, -8, -30], [-6, -14, 10], [8, -10, -10], [18, -8, 30], [0, -6, 0]].map(q => E(q[0], q[1], 12, 5, pick(['#4E8F3A', '#6FAE4A', '#3E7A30'], p.h, q[0] & 7), 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + dots([[-8, -16], [10, -14]], '#E8B64A', 2) + dots([[2, -18]], '#C0392B', 2) + stm(0, -22),
    cake: (p) => plate(42) + (p.h % 2 ? [[-16, -9], [2, -12], [18, -9]].map(q => R(q[0] - 9, q[1] - 7, 18, 12, pick(['#D9A441', '#E3B766', '#C98A3E'], p.h), 'rx="3"') + R(q[0] - 9, q[1] - 7, 18, 4, '#F3DDA0', 'rx="2" ' + N)).join('') : [[-14, -9], [6, -13], [20, -8]].map(q => E(q[0], q[1], 11, 6, pick(['#D9A441', '#E3B766', '#E8A8A0', '#F2EAD0'], p.h, 2)) + E(q[0], q[1] - 2, 7, 3, '#F6E6B0', 'opacity=".8" stroke="none"')).join('')),
    tart: (p) => plate(40) + [[-18, -9], [0, -12], [18, -9]].map(q => Pg('M' + (q[0] - 10) + ' ' + q[1] + 'L' + (q[0] - 7) + ' ' + (q[1] + 8) + 'H' + (q[0] + 7) + 'L' + (q[0] + 10) + ' ' + q[1] + 'Z', '#D9A441') + E(q[0], q[1], 10, 4, '#F6D860')).join(''),
    tangyuan: (p) => bowl(32, 22, Pcol(p, ['#E9D9A8', '#EBCB86', '#F1E3BE'])) + [[-12, -25], [2, -27], [14, -24], [-2, -21]].map(q => C(q[0], q[1], 7.5, '#FBF6EA')).join('') + dots([[-12, -27], [4, -29]], '#6B4A2A', 1.4) + stm(0, -32),
    zongzi: (p) => plate(44) + [[-14, -9], [14, -9]].map((q, i) => Pg('M' + (q[0] - 14) + ' ' + q[1] + 'L' + q[0] + ' ' + (q[1] - 26) + 'L' + (q[0] + 14) + ' ' + q[1] + 'Z', pick(['#6FA04A', '#5E8F3E', '#7FAE56'], p.h, i))).join('') + L('M-26 -14L-2 -14M2 -14L26 -14', '#D9C29A', 2) + L('M-14 -34L-14 -16M14 -34L14 -16', '#C9A24F', 1.2),
    shavedice: (p) => Pg('M-26 -34L-18 0H18L26 -34Z', 'rgba(220,240,250,.55)') + E(0, -34, 26, 7, 'rgba(220,240,250,.8)') + Pg('M-24 -36Q0 -64 24 -36Q0 -28 -24 -36Z', '#F4F8FA') + dots([[-8, -42], [6, -46], [12, -38], [-14, -37]], pick(['#E8674A', '#F2C23E', '#7BA84E'], p.h), 3) + R(-2, -66, 3, 14, '#C0392B', 'transform="rotate(18 0 -50)"'),
    tanghulu: (p) => R(-26, -6, 52, 6, '#F4EBD8') + [-12, 12].map((x, i) => L('M' + x + ' -4L' + (x + 4) + ' -58', '#C79A5A', 2.4) + [0, 1, 2, 3].map(j => C(x + 0.8 + j * 0.9, -14 - j * 11, 6.5, pick(['#C0392B', '#D9532F', '#B3261E'], p.h, i), 'stroke-width="1.2"') + C(x - 1 + j, -16 - j * 11, 1.6, '#fff', 'opacity=".6" stroke="none"')).join('')).join(''),
    friedcone: (p) => Pg('M-18 -42L18 -42L10 0H-10Z', '#F6EFE0') + L('M-14 -30H14M-12 -18H12', '#C0392B', 3, 'opacity=".8"') + [[-10, -46], [2, -50], [12, -45], [-2, -43], [8, -54], [-8, -54]].map((q, i) => R(q[0] - 5, q[1] - 4, 10, 8, pick(['#D9A441', '#C98A3E', '#E3B24A'], p.h, i), 'rx="3" transform="rotate(' + (i * 25) + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + dots([[-4, -48], [10, -48]], '#8E3320', 1.4),
    // drinks
    gaiwan: (p) => E(0, -3, 30, 8, WH) + Pg('M-20 -26Q-18 -4 -8 -3H8Q18 -4 20 -26Z', WH) + L('M-18 -14Q0 -9 18 -14', BL, 2, 'opacity=".75"') + Pg('M-22 -26Q0 -50 22 -26Q0 -20 -22 -26Z', '#EDE7D8') + E(0, -40, 3.5, 3, BL) + stm(0, -44),
    teapot: (p) => E(0, -3, 32, 8, WH) + E(0, -20, 22, 17, pick([WH, '#B36A3C', '#8E5A3A'], p.h)) + Pg('M20 -22Q38 -34 40 -42Q30 -38 22 -30Z', pick([WH, '#B36A3C', '#8E5A3A'], p.h)) + Pg('M-20 -26Q-36 -24 -32 -12Q-28 -8 -20 -12', 'none', 'stroke-width="3"') + L('M-14 -14Q0 -9 14 -14', BL, 2, 'opacity=".75"') + E(0, -36, 10, 4, WH) + C(0, -40, 3, BL) + E(-40, -4, 8, 3, WH) + Pg('M-46 -4V-10H-34V-4Z', WH) + stm(2, -44),
    teaglass: (p) => Pg('M-14 -52L-11 -2Q0 3 11 -2L14 -52Z', 'rgba(235,245,250,.55)') + Pg('M-13 -40L-11 -2Q0 3 11 -2L13 -40Z', pick(['#C9A24F', '#B8601F', '#9BB35A', '#E8C86E', '#7A3A1A'], p.h)) + dots([[-4, -30], [3, -22], [-2, -14], [5, -34]], p.green ? '#4E8F3A' : '#5A3A1A', 2.4) + E(0, -52, 14, 3, 'rgba(235,245,250,.8)') + stm(0, -58),
    milktea: (p) => Pg('M-15 -50L-12 -2Q0 4 12 -2L15 -50Z', 'rgba(250,244,230,.6)') + Pg('M-14 -42L-12 -2Q0 4 12 -2L14 -42Z', pick(['#D9B88A', '#C9A27A', '#E8D4B0'], p.h)) + dots([[-6, -6], [0, -4], [6, -7], [-3, -9], [4, -11]], '#3a2a22', 2.6) + E(0, -50, 15, 3.5, '#fff') + R(-17, -54, 34, 5, '#D8C9A8', 'rx="2"') + L('M5 -52L12 -78', '#E8672B', 3.5),
    butterTea: (p) => Pg('M-18 -44Q-22 -20 -14 -4H14Q22 -20 18 -44Z', '#C9A24F') + E(0, -44, 18, 5, '#E8D8B0') + L('M-18 -38H18M-17 -24H17', '#8E6A2A', 1.6) + Pg('M18 -38Q34 -34 30 -18Q28 -12 18 -14', 'none', 'stroke="#8E6A2A" stroke-width="3.2"') + bowlAt(-38, 6.5) + stm(0, -52),
    beer: (p) => Pg('M-16 -46L-14 -2Q0 3 14 -2L16 -46Z', 'rgba(250,240,200,.5)') + Pg('M-15 -40L-14 -2Q0 3 14 -2L15 -40Z', pick(['#E8B64A', '#D9A12A', '#B8601F'], p.h)) + Pg('M-17 -46Q-18 -58 -6 -54Q0 -62 8 -54Q18 -58 17 -46Z', '#fff') + Pg('M16 -38Q30 -38 30 -26Q30 -14 15 -14', 'none', 'stroke-width="3.5"') + dots([[-5, -20], [3, -28], [6, -12]], '#F6E3A0', 1.5),
    liquor: (p) => Pg('M-9 -2Q-11 -34 -4 -46V-62H4V-46Q11 -34 9 -2Z', pick(['#E8E4D4', '#C9A24F', '#3A5A4A', '#B8601F'], p.h)) + R(-9, -30, 18, 14, pick(['#C0392B', '#F6E3B0', '#2F5F9E'], p.h, 2), 'rx="2" ' + N) + R(-5, -66, 10, 5, '#B22', 'rx="1"') + cupAt(22, 5) + cupAt(36, 5),
    wine: (p) => Pg('M-8 -2Q-10 -26 -4 -40V-58H4V-40Q10 -26 8 -2Z', '#3a1a2a') + R(-4, -58, 8, 6, '#C9A24F') + R(-8, -24, 16, 12, '#F0E3C0', 'rx="1" ' + N) + Pg('M22 -34Q18 -16 30 -14V-4H24V-2H44V-4H38V-14Q50 -16 46 -34Z', 'rgba(240,245,250,.6)') + Pg('M23 -26Q22 -16 30 -14H38Q46 -16 45 -26Z', '#7A1F3A'),
    coffee: (p) => E(0, -3, 32, 8, WH) + Pg('M-18 -24Q-17 -4 -8 -3H8Q17 -4 18 -24Z', WH) + E(0, -24, 18, 5, '#5A3A1A') + Pg('M18 -20Q30 -20 28 -12Q26 -8 17 -8', 'none', 'stroke-width="3"') + stm(0, -30),
    yogurt: (p) => bowl(26, 24, '#FBF6EA', pick(['#E8D4B0', WH, '#C9A27A'], p.h)) + dots([[-6, -27], [6, -26]], '#7A2A55', 2.4) + E(0, -27, 10, 2.5, '#fff', 'opacity=".8" stroke="none"'),
    soupdrink: (p) => bowl(28, 20, broth(p, false, p.milk)) + stm(0, -26),
    cocktail: (p) => Pg('M-22 -44L0 -16L22 -44Z', 'rgba(240,245,250,.6)') + Pg('M-18 -42L0 -18L18 -42Z', '#E87A9A') + R(-1.5, -18, 3, 14, 'rgba(235,240,245,.9)') + E(0, -3, 12, 3, 'rgba(235,240,245,.9)') + C(18, -50, 5, '#E8B64A') + L('M10 -46L20 -58', '#8A5A2B', 2),
    bottle: (p) => Pg('M-14 -2Q-16 -40 -6 -46V-62H4V-46Q14 -40 12 -2Z', pick(['#E0801B', '#9BC4D8', '#7BA84E'], p.h)) + R(-12, -30, 22, 14, '#F6E3B0', 'rx="2" ' + N) + R(-6, -64, 12, 4, '#8A8A8A'),
    // specialties
    fruit: (p) => Pg('M-30 -22Q-28 -2 -14 -2H14Q28 -2 30 -22Z', '#C79A5A') + L('M-28 -14H28M-24 -8H24', '#8E6A2A', 1.4) + E(0, -22, 30, 7, '#B8864A') + [[-18, -26], [-4, -30], [10, -27], [20, -24], [-10, -22], [4, -23]].map((q, i) => C(q[0], q[1], 9, pick(p.cols || ['#E8821E', '#D9532F', '#E8B64A'], p.h, i % 3)) + C(q[0] - 3, q[1] - 3, 2, '#fff', 'opacity=".5" stroke="none"')).join('') + (p.leaf ? dots([[-6, -38], [8, -36]], GR, 3) : ''),
    mango: (p) => Pg('M-30 -22Q-28 -2 -14 -2H14Q28 -2 30 -22Z', '#C79A5A') + E(0, -22, 30, 7, '#B8864A') + [[-14, -28, -20], [4, -32, 10], [16, -26, 30]].map((q, i) => E(q[0], q[1], 12, 8, pick(['#F2B63A', '#E8821E', '#9BB35A'], p.h, i), 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join(''),
    grapes: (p) => Pg('M-30 -14Q-28 -2 -14 -2H14Q28 -2 30 -14Z', '#C79A5A') + E(0, -14, 30, 6, '#B8864A') + [[0, -20], [-8, -26], [8, -26], [-14, -20], [14, -20], [-4, -32], [4, -32], [0, -38], [-10, -14], [10, -14], [0, -28]].map((q, i) => C(q[0], q[1], 6, pick(p.cols || ['#7A3A8A', '#9BB35A', '#5A2A6A'], p.h, 0))).join('') + L('M0 -44L4 -52', '#5E8F3E', 2.4),
    melon: (p) => E(0, -3, 34, 8, '#E8E0CC') + Pg('M-30 -6Q-30 -36 0 -36Q30 -36 30 -6Z', '#9BB35A') + Pg('M-24 -8Q-24 -30 0 -30Q24 -30 24 -8Z', pick(['#F2A24A', '#E85A4A', '#E8D07A'], p.h)) + dots([[-8, -16], [0, -22], [8, -14], [-12, -22], [14, -22]], '#3a2a22', 1.4),
    coconut: (p) => [[-14, -8], [14, -8], [0, -20]].map(q => C(q[0], q[1], 14, '#8A5A2B') + L('M' + (q[0] - 8) + ' ' + (q[1] - 4) + 'q8 -6 16 0', '#6B4423', 1.3)).join('') + Pg('M-2 -34Q10 -38 14 -28Q4 -30 -2 -34Z', '#F4F1EA'),
    durian: (p) => E(0, -3, 34, 8, '#E8E0CC') + E(0, -22, 26, 20, '#9BB35A') + [[-14, -30], [0, -40], [14, -30], [-20, -18], [0, -24], [20, -18], [-8, -12], [10, -12]].map(q => Pg('M' + (q[0] - 4) + ' ' + q[1] + 'L' + q[0] + ' ' + (q[1] - 8) + 'L' + (q[0] + 4) + ' ' + q[1] + 'Z', '#7A8F3A')).join(''),
    sack: (p) => Pg('M-26 -2Q-30 -30 -18 -44L-10 -50H10L18 -44Q30 -30 26 -2Z', pick(['#D9C29A', '#C9B07A', '#E3D3AE'], p.h)) + L('M-14 -48Q0 -42 14 -48', '#8E6A2A', 2.4) + R(-12, -28, 24, 14, '#F4EBD8', 'rx="2" ' + N) + dots([[-4, -20], [4, -22], [0, -17]], '#8E6A2A', 1.8) + E(0, -50, 10, 3, pick(['#E8D07A', '#F4EBD8', '#E8B64A'], p.h)),
    jar: (p) => Pg('M-18 -2Q-24 -20 -16 -34L-10 -40H10L16 -34Q24 -20 18 -2Z', pick(['#8E5230', '#B36A3C', '#6B5A3A', '#E8E0CC'], p.h)) + E(0, -42, 12, 4, '#D9C29A') + R(-14, -26, 28, 12, pick(['#F6E3B0', '#C0392B', '#F4EBD8'], p.h, 3), 'rx="2" ' + N) + L('M-8 -20h16', '#3a2a22', 1.5),
    nuts: (p) => bowl(32, 18, pick(['#B8864A', '#C0392B', '#A0522D', '#E8B64A'], p.h)) + dots([[-12, -22], [-4, -24], [6, -22], [14, -20], [0, -19], [-16, -18], [10, -26]], pick(['#8A5A2B', '#B5651D', '#C0392B', '#D9A441'], p.h), 4),
    roots: (p) => R(-30, -22, 60, 22, '#C79A5A') + L('M-30 -14H30M-30 -7H30', '#8E6A2A', 1.4) + [[-18, -28, -14], [-2, -30, 6], [14, -28, 20]].map((q, i) => Pg('M' + q[0] + ' ' + q[1] + 'q8 -4 14 6l-4 6q-10 2 -12 -4Z', pick(['#E8E0CC', '#E8C48A', '#B97A30', '#F2EAD0'], p.h, i), 'transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"')).join('') + dots([[-10, -34], [8, -36]], GR, 3),
    herbs: (p) => R(-30, -18, 60, 18, '#B8864A') + R(-30, -22, 60, 5, '#C99A5A') + Pg('M-14 -22Q-18 -34 -8 -44Q-2 -38 -4 -30Q2 -38 10 -34Q6 -28 8 -22Z', '#E8D4A0') + L('M-8 -44Q-12 -50 -18 -50M-2 -34Q4 -44 12 -42', '#C9B27A', 2) + dots([[16, -26], [22, -24], [14, -22]], '#C0392B', 3),
    cured: (p) => L('M-26 -60H26', '#8A5A2B', 3) + [[-14, -58], [8, -58]].map((q, i) => L('M' + q[0] + ' ' + q[1] + 'V-52', '#8A5A2B', 2) + Pg('M' + (q[0] - 10) + ' -52Q' + q[0] + ' -56 ' + (q[0] + 10) + ' -52Q' + (q[0] + 14) + ' -26 ' + (q[0] + 4) + ' -8Q' + q[0] + ' -4 ' + (q[0] - 4) + ' -8Q' + (q[0] - 14) + ' -26 ' + (q[0] - 10) + ' -52Z', pick(['#8E3320', '#A0522D', '#7A2A1A'], p.h, i))).join('') + L('M-20 -40H-6M2 -40H16', '#F0D9B0', 2.2, 'opacity=".7"'),
    dried: (p) => plate(42) + [[-18, -9], [-2, -12], [14, -9], [4, -5]].map((q, i) => E(q[0], q[1], 11, 4.5, pick(['#2A3A2A', '#5A3A1A', '#7A5A3A'], p.h, i), 'transform="rotate(' + (i * 22 - 20) + ' ' + q[0] + ' ' + q[1] + ')"')).join(''),
    // crafts
    vase: (p) => Pg('M-12 -2Q-26 -24 -10 -46V-58H10V-46Q26 -24 12 -2Z', WH) + L('M-18 -30Q0 -24 18 -30M-14 -14Q0 -9 14 -14', BL, 2.2) + dots([[0, -38]], BL, 3) + E(0, -58, 10, 3, WH),
    jadecup: (p) => E(0, -3, 22, 6, '#E8E0CC') + Pg('M-20 -34Q-18 -6 -8 -4H8Q18 -6 20 -34Z', '#7FBF9A') + E(0, -34, 20, 5, '#A9D9BA') + L('M-12 -24Q0 -20 12 -24', '#fff', 2, 'opacity=".6"'),
    pearl: (p) => Pg('M-26 -4Q-30 -26 0 -34Q30 -26 26 -4Q0 6 -26 -4Z', '#E8D8D0') + L('M-18 -8Q0 -22 18 -8M-12 -4Q0 -14 12 -4', '#C9B0A8', 1.5) + C(0, -16, 9, '#FBF6F0') + C(-3, -19, 2.4, '#fff', 'stroke="none"'),
    flowerpot: (p) => Pg('M-18 -2L-22 -24H22L18 -2Z', '#B36A3C') + R(-24, -28, 48, 6, '#C7824F') + [[-12, -34, -20], [0, -44, 0], [12, -34, 20]].map(q => L('M' + (q[0] * 0.3) + ' -28L' + q[0] + ' ' + q[1], '#4E8F3A', 2.4) + C(q[0], q[1] - 4, 8, pick(['#E8A8C0', '#F4F1EA', '#E8674A', '#F2C23E'], p.h, q[2] & 3)) + C(q[0], q[1] - 4, 3, '#F2C23E', N)).join(''),
    cloth: (p) => Pg('M-30 -4L-26 -30H26L30 -4Z', pick(['#2F5F9E', '#2A4A7A', '#9B2A4A'], p.h)) + Pg('M-26 -30L-22 -36H30L26 -30Z', '#E8E0CC') + dots([[-16, -20], [-4, -14], [8, -20], [18, -12], [0, -26]], '#F4F1EA', 3) + L('M-24 -10H24', '#F4F1EA', 1.4),
    brush: (p) => E(0, -3, 34, 8, '#2a2a2a') + E(0, -5, 28, 5.5, '#555') + L('M-30 -22L26 -36', '#C79A5A', 4) + Pg('M26 -36L36 -39L32 -31Z', '#3a2a22') + R(-16, -16, 14, 6, '#8E3320', N),
    figurine: (p) => R(-18, -8, 36, 8, '#8A5A2B') + Pg('M-12 -8Q-14 -30 0 -34Q14 -30 12 -8Z', pick(['#C0392B', '#2F5F9E', '#E8B64A', '#7FBF9A'], p.h)) + C(0, -42, 8, pick(['#E8D0B0', '#F4F1EA'], p.h)) + dots([[-3, -43], [3, -43]], OL, 1.2),
    crane: (p) => R(-18, -6, 36, 6, '#8A5A2B') + Pg('M-8 -6Q-14 -26 -2 -36Q-2 -44 4 -48L10 -46L4 -42Q6 -34 6 -24L10 -6Z', '#F4F1EA') + Pg('M-6 -22Q-24 -20 -22 -10Q-10 -14 -4 -12Z', '#EDE7D8') + L('M4 -48L12 -48', '#C0392B', 2.4) + C(2, -46, 1.4, OL, N) + L('M0 -6V0M6 -6V0', '#8A5A2B', 2),
    lacquer: (p) => R(-26, -24, 52, 22, '#7A1F18') + R(-26, -30, 52, 8, '#8E2A1F') + L('M-22 -14h44', '#E8B648', 2.2) + dots([[-14, -26], [0, -26], [14, -26]], '#E8B648', 2.2) + C(0, -18, 4, '#E8B648'),
    framed: (p) => R(-26, -40, 52, 38, '#8A5A2B') + R(-21, -35, 42, 28, '#F4EBD8', N) + L('M-12 -12Q-6 -30 0 -18T14 -26', '#3a2a22', 2.6) + L('M-16 -12H18', '#3a2a22', 1.6) + R(-16, -2, 32, 2, '#6B4423'),
    sign: (p) => L('M0 -2V-36', '#6B4423', 3) + R(-24, -62, 48, 28, '#C0392B') + R(-20, -58, 40, 20, 'none', 'stroke="#E8B648" stroke-width="2"') + dots([[-10, -48], [0, -48], [10, -48]], '#E8B648', 3) + L('M-8 -34v8M8 -34v8', '#E8B648', 2)
  };
  function bowlAt(x, w) { return '<g transform="translate(' + x + ' 0) scale(.9)">' + bowl(w * 2.4, 12, '#F1E3BE') + '</g>'; }
  function cupAt(x, w) { return '<g transform="translate(' + x + ' 0)">' + Pg('M-6 -14Q-5 -2 0 -1Q5 -2 6 -14Z', WH) + E(0, -14, 6, 2, '#E8E4D4') + '</g>'; }

  const T = (re, s) => re.test(s);
  // dishes whose names say nothing about what they look like
  const OVER = { '糌粑':'porridge', '早茶':'xlb', '泰州早茶':'xlb', '秦淮小吃':'xlb', '沙县小吃':'dumplings', '均安蒸猪':'hock', '巴马香猪':'hock', '藏香猪':'hock', '烧腊':'roastbird', '玉林牛巴':'slices', '盐池滩羊':'lamb', '南阳黄牛':'lamb', '狗浇尿':'cake', '夫妻肺片':'slices', '冷吃兔':'slices', '毛血旺':'soup', '叻沙':'noodle', '加东叻沙':'noodle', '肉骨茶':'soup', '沙爹':'skewers', '棺材板':'bread', '片儿川':'noodle', '茴香豆':'nuts', '无锡排骨':'braised', '林蛙':'meatplate', '焖子':'coldnoodle', '马介休':'fish', '艾窝窝':'tangyuan', '土笋冻':'cake', '灰豆子':'soup', '呱呱':'coldnoodle', '山海关八大碗':'claypot', '洛阳水席':'claypot', '潍坊朝天锅':'hotpot', '汉中热米皮':'coldnoodle', '狮子头':'wonton' };
  // what each dish looks like: [archetype, props]. Rules run in order and the first that matches wins
  function dishArch(zh) {
    if (OVER[zh]) return [OVER[zh], { red: /毛血旺|冷吃/.test(zh), milk: false }];
    const red = /辣|红油|麻|毛血旺|酸辣|剁椒|红烧|钵钵|串串|冷吃|口味|辣子/.test(zh), milk = /牛肉|羊肉|骨|白汤|奶|豆花|鱼汤|白肉|酸汤/.test(zh), o = { red, milk };
    if (T(/火锅|涮|锅子|一品锅|铜火锅|石锅鸡|汽锅/, zh)) return ['hotpot', { red: red || /重庆|潮汕牛肉|毛血/.test(zh) }];
    if (T(/佛跳墙|煲仔|煲|砂锅|瓦罐|焖锅|大救驾|椰子鸡|石锅/, zh)) return ['claypot', o];
    if (T(/虾饺/, zh)) return ['shrimp', o];
    if (T(/小笼|灌汤包|汤包|三丁包|生煎|烧卖|烧麦/, zh)) return [/烧卖|烧麦/.test(zh) ? 'siumai' : 'xlb', o];
    if (T(/肉夹馍|火烧|驴肉火烧/, zh)) return ['roujiamo', o];
    if (T(/包子|包$|馒头|大救驾|猪扒包|平安包|菠萝包|花卷|糍饭团/, zh)) return ['bun', o];
    if (T(/馄饨|云吞|抄手|扁食|肉燕|鱼丸|贡丸|牛肉丸|鱼蛋|米饺|丸/, zh)) return ['wonton', o];
    if (T(/汤圆|麻糬|糍|圆子|碗托|驴打滚/, zh)) return [/碗托|驴打滚/.test(zh) ? 'cake' : 'tangyuan', o];
    if (T(/水饺|饺子|钟水饺|锅贴|海鲜饺|老边饺/, zh)) return ['dumplings', o];
    if (T(/肠粉|卷馍|春卷|蛋烘糕|煎饼|薄饼|裹卷|丝娃娃|荞饼|烙饼|凉卷/, zh)) return ['rolls', o];
    if (T(/凉皮|酿皮|凉粉|冷面|凉面|冷粉|蒸凉面|荞凉粉|甜醅/, zh)) return [/甜醅/.test(zh) ? 'cake' : 'coldnoodle', o];
    if (T(/米粉|粉丝|米线|粿条|螺蛳粉|线面|抱罗粉|酸粉|河粉|粉汤|扁粉|老友粉|面线糊|糊汤粉|格拉条|牛肉粉|鱼粉|羊肉粉|鸡肉粉|米烂|桂林米粉|生榨米粉|车仔面|线$/, zh)) return [/面线糊|糊汤粉|米烂/.test(zh) ? 'soup' : 'ricenoodle', o];
    if (T(/拌面|拌粉|燃面|炒面|炒粉|炒粿条|油泼|臊子|炸酱|葱油|卤面|烩面|烙面|擀面|搓鱼面|撒面|河南蒸面|蒸面|黄面|干拌|拉条|刀削|苏式面|拉面|肠旺面|甜水面|重庆小面|小面/, zh)) return ['drynoodle', o];
    if (T(/面$|面条|粉$|面条/, zh)) return ['noodle', o];
    if (T(/抓饭|手抓饭/, zh)) return ['pilaf', o];
    if (T(/粽/, zh)) return ['zongzi', o];
    if (T(/糖葫芦/, zh)) return ['tanghulu', o];
    if (T(/冰|糖水|清补凉|龟苓|双皮奶|姜撞奶|布丁|木糠|豆沙/, zh)) return ['shavedice', o];
    if (T(/挞/, zh)) return ['tart', o];
    if (T(/馕|烧饼|锅盔|大饼|火烧|烤饼|饼$|馍馍|大列巴|列巴|油饼|青稞饼|黄馍馍|烤包子|搓馍|油旋|莜面栲栳栳|麻花/, zh)) return [/麻花|油旋/.test(zh) ? 'cake' : /列巴/.test(zh) ? 'bread' : 'flatbread', o];
    if (T(/面包|吐司|三明治|俄式面包/, zh)) return ['bread', o];
    if (T(/炸|鸡排|盐酥鸡|锅巴|天妇罗|油条/, zh)) return ['friedcone', o];
    if (T(/糕|酥|月饼|凤梨酥|太阳饼|桂花|糖|点心|瓦酥|麻糕|年糕|糖油粑粑|打糕|茶馓|牡丹饼|柿子饼|粑粑|乳扇|乳饼|奶豆腐|贡糖/, zh)) return [/乳饼|奶豆腐/.test(zh) ? 'tofu' : 'cake', o];
    if (T(/烤全羊|手抓|手把|羊杂|羊羔|羊腿|羊排|烤羊|羊肉$|牦牛肉|驴肉黄面/, zh)) return [T(/杂碎|羊杂/, zh) ? 'soup' : 'lamb', o];
    if (T(/串|烧烤|烤肉|馕坑肉|烤冷面|烤乌鱼子|烤鱿鱼|四平烧烤/, zh)) return [T(/冷面/, zh) ? 'drynoodle' : 'skewers', o];
    if (T(/肘子|猪脚|猪蹄|扒肘/, zh)) return ['hock', o];
    if (T(/红肠|香肠|大厂香肠|腊肠|肉脯/, zh)) return ['sausage', o];
    if (T(/红烧肉|东坡肉|扣肉|卤煮|三下锅|毛氏|肉$|黑猪肉|血粑鸭|血鸭|九转|大肠|杀猪菜|酸菜白肉|白肉|李庄|驴肉/, zh)) return [/酸菜|杀猪/.test(zh) ? 'soup' : 'braised', o];
    if (T(/鸭|鹅|鸡|鸽|烧鸡|扒鸡|乳鸽/, zh)) return [/辣子鸡|辣炒|大盘|石锅|冷吃|棒棒|钵钵|歌乐山|炒鸡|火锅鸡|叫花/.test(zh) ? 'meatplate' : 'roastbird', o];
    if (T(/蟹|螃蟹|大闸蟹|河蟹/, zh)) return ['crab', o];
    if (T(/虾|龙虾|海鲜|鲍|沙虫|鱿鱼|海参|海蜇|黄蚬|蛤|辣炒蛤蜊|蛏|螺/, zh)) return [/蛤|蚬|蛏|螺|沙虫/.test(zh) ? 'oyster' : 'prawns', o];
    if (T(/蚝|蚵|海蛎|煎蚝|生蚝|大蚝/, zh)) return ['oyster', o];
    if (T(/鱼|鲤|鳜|鳝|带鱼|鲩|鲅|银鱼|雅鱼|裸鲤|黄鳝|鱼头/, zh)) return [/鱼生|鱼糕|鱼饼/.test(zh) ? 'slices' : /糖醋|松鼠|醋鱼|烤鱼|大黄鱼|大马哈|全鱼|冷水鱼|采石矶|淮河|武昌|鳜鱼|臭鳜/.test(zh) ? 'wholefish' : 'fish', o];
    if (T(/豆腐|豆皮|豆花|腐|豆腐果|干子/, zh)) return ['tofu', { red, fried: /果|烧|臭|毛豆腐/.test(zh) }];
    if (T(/饭|米饭|饭团|盖饭|锅饭|红米|拌饭|椰浆|饭包|糯米/, zh)) return ['ricebowl', o];
    if (T(/粥|糊|羹|汤|脑|瓦罐|不翻|牛肉汤|羊肉汤|杂烩|泡馍|大锅炖|炖|酸汤/, zh)) return [/粥/.test(zh) ? 'porridge' : 'soup', o];
    if (T(/菜|炒|拌|素斋|黄花|擦擦|洋芋|土豆|豆角|辣白菜|滁州|本帮|淮扬|海州/, zh)) return ['veg', o];
    if (T(/茶餐厅|小贩/, zh)) return ['sign', o];
    return [null, o];
  }
  const FALLBACK = ['meatplate', 'veg', 'soup', 'ricebowl', 'tofu', 'noodle', 'braised', 'slices'];
  function drinkArch(zh) {
    if (T(/珍珠奶茶|奶茶|甜茶|酥油茶/, zh)) return [/酥油茶/.test(zh) ? 'butterTea' : 'milktea', {}];
    if (T(/啤酒/, zh)) return ['beer', {}];
    if (T(/葡萄酒|红酒/, zh)) return ['wine', {}];
    if (T(/司令/, zh)) return ['cocktail', {}];
    if (T(/酒|大曲|窖|老白干|汾|潞|青稞酒|黄酒|高粱|山兰/, zh)) return ['liquor', {}];
    if (T(/咖啡/, zh)) return ['coffee', {}];
    if (T(/酸奶|牛奶|奶$|马奶|骆驼奶|豆汁|杏仁露|木瓜牛奶/, zh)) return [/木瓜牛奶/.test(zh) ? 'milktea' : 'yogurt', {}];
    if (T(/矿泉水/, zh)) return ['bottle', {}];
    if (T(/八宝茶|三道茶|油茶/, zh)) return ['gaiwan', {}];
    if (T(/茶|毛尖|毛峰|瓜片|黄芽|银针|龙井|普洱|岩茶|小种/, zh)) return [/绿|毛尖|毛峰|瓜片|黄芽|银针|龙井|茶$/.test(zh) && /绿|毛尖|毛峰|瓜片|黄芽|龙井|银针/.test(zh) ? 'teaglass' : 'teapot', { green: /绿|毛尖|毛峰|瓜片|黄芽|龙井|银针/.test(zh) }];
    if (T(/汤|粥|糖水|糖粥|脑|沫|胡辣|瓦罐|藕汤|花生汤|火麻|牛肉汤|艇仔/, zh)) return ['soupdrink', { milk: /牛肉|花生|火麻/.test(zh) }];
    return ['teaglass', {}];
  }
  function buyArch(zh) {
    if (T(/椰子/, zh)) return ['coconut', {}];
    if (T(/榴莲/, zh)) return ['durian', {}];
    if (T(/葡萄|葡萄干/, zh)) return ['grapes', { cols: /干/.test(zh) ? ['#6B3A2A'] : ['#7A3A8A', '#9BB35A'] }];
    if (T(/哈密瓜|蜜瓜|瓜|甜瓜/, zh)) return ['melon', {}];
    if (T(/芒果|芒/, zh)) return ['mango', {}];
    if (T(/橙|桔|柑|橘|柚|杏|桃|李|荔|枣|苹果|梨|莓|猕猴桃|莲雾|释迦|柿|蜜柚|菱/, zh)) return ['fruit', { cols: /苹果/.test(zh) ? ['#C0392B', '#D9532F'] : /梨/.test(zh) ? ['#D9C85A', '#C9B84A'] : /橙|桔|橘|柑|杏|柚/.test(zh) ? ['#E8821E', '#F2A23E'] : /莓/.test(zh) ? ['#C0392B', '#7A1F3A'] : /猕猴桃/.test(zh) ? ['#7A9A3A'] : /枣/.test(zh) ? ['#9B3A2A', '#B8501F'] : /李|莲雾|桃|荔/.test(zh) ? ['#C0392B', '#D9667A'] : ['#E8821E', '#9BB35A'], leaf: true }];
    if (T(/腊肉|火腿|肉干|肉脯|腊/, zh)) return ['cured', {}];
    if (T(/海参|紫菜|海蜇|虾酱|鱼皮/, zh)) return ['dried', {}];
    if (T(/核桃|栗|榛|松子|花生|枣|瓜子|杏仁/, zh)) return ['nuts', {}];
    if (T(/米|麦|粟|黍|荞|豆|小米|黄米|大米/, zh)) return ['sack', {}];
    if (T(/参|虫草|枸杞|黄精|药材|肉苁蓉|三七|松茸|百合|陈皮|姜糖|白姜|生姜|山药|花椒|辣椒/, zh)) return ['herbs', {}];
    if (T(/萝卜|笋|菜干|芋|藕|土豆|薯|葱|榨菜|榨|山药|蒜|姜/, zh)) return ['roots', {}];
    if (T(/醋|酱|豆腐乳|豆豉|蜜|盐|糖|油|腌|橄榄/, zh)) return ['jar', {}];
    return ['jar', {}];
  }
  function askArch(zh) {
    if (T(/瓷|青花/, zh)) return ['vase', {}];
    if (T(/夜光杯|杯|玉/, zh)) return ['jadecup', {}];
    if (T(/珍珠|玛瑙|煤精/, zh)) return ['pearl', {}];
    if (T(/水仙|牡丹|花/, zh)) return ['flowerpot', {}];
    if (T(/布|绣|盘绣/, zh)) return ['cloth', {}];
    if (T(/笔|梳篦/, zh)) return ['brush', {}];
    if (T(/漆/, zh)) return ['lacquer', {}];
    if (T(/铁画|酥油花|雕刻/, zh)) return ['framed', {}];
    if (T(/鹤|驯鹿|赛马|裸鲤|鱼皮/, zh)) return ['crane', {}];
    return ['figurine', {}];
  }
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  // zone: where the dish stands. 'table' for dishes and drinks, 'shelf' for specialties and crafts
  function classify(stop, kind) {
    const zh = stop.zh, h = hash(zh + (stop.id || ''));
    let r;
    if (kind === 'drink') r = drinkArch(zh); else if (kind === 'buy') r = buyArch(zh); else if (kind === 'ask') r = askArch(zh); else if (kind === 'near') r = ['sign', {}];
    else { r = dishArch(zh); if (!r[0]) r = [FALLBACK[h % FALLBACK.length], r[1]]; }
    const p = Object.assign({ h }, r[1]);
    return { arch: r[0], p, zone: (kind === 'buy' || kind === 'ask') ? 'shelf' : 'table', drink: kind === 'drink' };
  }
  function draw(arch, p) { const f = A[arch] || A.soup; return f(p || { h: 0 }); }

  // ---- a look of its own for every dish: two dishes that share a drawing still differ by a flip, a tilt, a size, a tint and a small extra on the table.
  // `n` (optional) forces the variant so that dishes with the same drawing in one room are guaranteed to differ.
  const TINTS = ['', '<feColorMatrix type="hueRotate" values="-18"/>', '<feColorMatrix type="hueRotate" values="18"/>', '<feColorMatrix type="saturate" values="1.4"/>', '<feColorMatrix type="saturate" values=".68"/><feComponentTransfer><feFuncR type="linear" slope="1.07"/><feFuncG type="linear" slope="1.07"/><feFuncB type="linear" slope="1.07"/></feComponentTransfer>', '<feColorMatrix type="hueRotate" values="-34"/>'];
  const TINT_DEFS = '<defs>' + TINTS.map((f, i) => f ? '<filter id="fzt' + i + '" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">' + f + '</filter>' : '').join('') + '</defs>';
  const EXTRA = {
    table: [
      '',
      E(34, -2, 10, 3.5, WH) + E(34, -3.5, 7, 2, '#7a2f1a', N),
      L('M24 -1l22 -4M24 3l22 -3', '#8A5A2B', 2),
      E(-34, -3, 8, 3.5, WH) + L('M-27 -3L-11 -7', '#E8E0CC', 3.4),
      Pg('M28 -1a9 9 0 0 1 18 0Z', '#9BC53D') + Pg('M31 -1a6 6 0 0 1 12 0Z', '#D8EC8A', N),
      Pg('M-44 -2q8 -9 20 -4q-10 1 -20 4Z', '#C0392B') + Pg('M-32 -1q8 -8 18 -5q-9 1 -18 5Z', '#D6502E'),
      E(-34, -2, 10, 3.5, WH) + dots([[-38, -4], [-34, -5], [-30, -4], [-36, -3], [-32, -3]], '#6FA84A', 2)
    ],
    drink: ['', Pg('M28 -1a9 9 0 0 1 18 0Z', '#9BC53D') + Pg('M31 -1a6 6 0 0 1 12 0Z', '#D8EC8A', N), E(-34, -2, 10, 3.5, WH) + dots([[-38, -4], [-34, -5], [-30, -4]], '#B8782E', 2.4), Pg('M24 0L46 0L35 -9Z', '#E9DFC8'), E(34, -2, 9, 3, '#C79A5A')],
    shelf: ['', C(28, -6, 5, '#C0392B') + L('M28 -11l-4 -9', '#8A5A2B', 1.4), C(28, -6, 5, '#2F5F9E') + L('M28 -11l-4 -9', '#8A5A2B', 1.4), C(28, -6, 5, '#D9A441') + L('M28 -11l-4 -9', '#8A5A2B', 1.4), R(-30, -9, 60, 5, 'rgba(192,57,43,.9)', 'stroke="none"')]
  };
  function drawVar(it, n) {
    const forced = n != null, h = hash((it.id || it.zh || '') + 'v'), k = it.zone === 'shelf' ? 'shelf' : it.drink ? 'drink' : 'table', ex = EXTRA[k];
    const fl = forced ? (n % 2) : (h & 1), tilt = forced ? [0, -3, 3, -5, 5, 2][n % 6] : ((h >>> 1) % 9) - 4, sc = forced ? [1, .96, 1.04, .94, 1.06, .98][n % 6] : .95 + ((h >>> 5) % 11) / 100;
    const gi = forced ? n % ex.length : (h >>> 9) % (ex.length + 1) % ex.length, ti = forced ? (n * 2 + (h % 2)) % TINTS.length : (h >>> 13) % (k === 'shelf' ? 4 : TINTS.length);
    let g = draw(it.arch, it.p);
    g = '<g transform="rotate(' + tilt + ') scale(' + (fl ? -sc : sc) + ' ' + sc + ')">' + g + '</g>';
    if (ti) g = '<g filter="url(#fzt' + ti + ')">' + g + '</g>';
    const e = ex[gi] || '';
    return (k === 'drink' && gi === 4 ? '' : '') + g + (e ? '<g transform="scale(' + (fl ? -1 : 1) + ' 1)">' + e + '</g>' : '');
  }
  const api = { ARCH: Object.keys(A), draw, drawVar, TINT_DEFS, classify, dishArch, drinkArch, buyArch, askArch, hash, OL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FEAST = Object.assign(root.FEAST || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
