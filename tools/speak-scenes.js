/* Draws the backdrops of the Speak scenarios (one scene per scenario id, plus one for free chat) as 480x520 SVG pictures and writes them to
 * data/speak-scenes.js (window.SHANLU_SPEAK_SCENES = { id: { u: data URI, c: colour of the floor/counter at the foot of the picture } }).
 * The partner (Mingming) is drawn big, with a dark outline, a light halo and clothes that stand out from the wall. No text is drawn inside the pictures.
 *   node tools/speak-scenes.js          (--sheet writes /tmp/speak-*.svg for a look)
 * Only the top ~330 units are always visible (wide screens crop the rest), so people and key props live above that line. */
const fs = require('fs');
const path = require('path');
const INK = '#14212A';
const R = (x, y, w, h, f, x2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${x2}/>`;
const RR = (x, y, w, h, r, f, x2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${x2}/>`;
const C = (x, y, r, f, x2 = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${x2}/>`;
const E = (x, y, rx, ry, f, x2 = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${x2}/>`;
const P = (d, f, x2 = '') => `<path d="${d}" fill="${f}" ${x2}/>`;
const L = (d, s, w = 3, x2 = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x2}/>`;
const G = (t, inner, op) => `<g transform="${t}"${op ? ` opacity="${op}"` : ''}>${inner}</g>`;
const svg = (inner, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 520" width="480" height="520" preserveAspectRatio="xMidYMin slice">${defs ? '<defs>' + defs + '</defs>' : ''}${inner}</svg>`;
const lg = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// ---- the partner: big, outlined, haloed. x,y = centre of the head. acc: extra clothing drawn over the shirt (apron, coat, vest, scarf) or on the head
const person = (x, y, shirt, acc = '', o = {}) => {
  const hair = o.hair || INK, skin = o.skin || '#F2C9A0';
  let s = '';
  s += C(x, y + 70, 150, '#fff', 'opacity=".34"') + C(x, y + 70, 112, '#fff', 'opacity=".26"');                                   // halo
  s += P(`M${x - 104} ${y + 200}Q${x - 104} ${y + 92} ${x} ${y + 84}Q${x + 104} ${y + 92} ${x + 104} ${y + 200}z`, shirt, `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`);
  s += acc;
  s += R(x - 15, y + 36, 30, 52, skin, `stroke="${INK}" stroke-width="4"`) + P(`M${x - 26} ${y + 84}Q${x} ${y + 112} ${x + 26} ${y + 84}z`, skin, `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`);
  s += P(`M${x - 54} ${y - 4}Q${x - 58} ${y - 62} ${x} ${y - 62}Q${x + 58} ${y - 62} ${x + 54} ${y - 4}Q${x + 60} ${y + 44} ${x + 46} ${y + 58}L${x - 46} ${y + 58}Q${x - 60} ${y + 44} ${x - 54} ${y - 4}z`, hair, `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`);   // hair behind
  s += C(x, y, 46, skin, `stroke="${INK}" stroke-width="4.5"`);
  s += P(`M${x - 48} ${y - 6}Q${x - 44} ${y - 52} ${x} ${y - 52}Q${x + 44} ${y - 52} ${x + 48} ${y - 6}Q${x + 26} ${y - 30} ${x - 4} ${y - 26}Q${x - 30} ${y - 24} ${x - 48} ${y - 6}z`, hair);        // fringe
  s += C(x - 16, y + 6, 4.6, INK) + C(x + 16, y + 6, 4.6, INK) + C(x - 14.5, y + 4.6, 1.5, '#fff') + C(x + 17.5, y + 4.6, 1.5, '#fff');
  s += E(x - 28, y + 20, 8, 5, '#F29C94', 'opacity=".6"') + E(x + 28, y + 20, 8, 5, '#F29C94', 'opacity=".6"');
  s += L(`M${x - 12} ${y + 22}Q${x} ${y + 32} ${x + 12} ${y + 22}`, INK, 3.6);
  if (o.glasses) s += `<g fill="none" stroke="${INK}" stroke-width="3.4"><circle cx="${x - 16}" cy="${y + 6}" r="12"/><circle cx="${x + 16}" cy="${y + 6}" r="12"/><path d="M${x - 4} ${y + 6}h8"/></g>`;
  if (o.hat) s += o.hat;
  return s;
};
const coat = (x, y, c = '#FFFFFF') => P(`M${x - 104} ${y + 200}Q${x - 104} ${y + 92} ${x - 22} ${y + 86}L${x} ${y + 200}z`, c, `stroke="${INK}" stroke-width="4"`) + P(`M${x + 104} ${y + 200}Q${x + 104} ${y + 92} ${x + 22} ${y + 86}L${x} ${y + 200}z`, c, `stroke="${INK}" stroke-width="4"`);
const apron = (x, y, c = '#F8FAF7') => P(`M${x - 62} ${y + 120}h124v90h-124z`, c, `stroke="${INK}" stroke-width="4"`) + L(`M${x - 62} ${y + 124}Q${x} ${y + 150} ${x + 62} ${y + 124}`, INK, 3);
const scarf = (x, y, c) => P(`M${x - 40} ${y + 84}Q${x} ${y + 120} ${x + 40} ${y + 84}L${x + 34} ${y + 118}Q${x} ${y + 140} ${x - 34} ${y + 118}z`, c, `stroke="${INK}" stroke-width="4"`);
const vest = (x, y, c) => P(`M${x - 98} ${y + 200}Q${x - 98} ${y + 100} ${x - 30} ${y + 92}L${x - 30} ${y + 200}z`, c, `stroke="${INK}" stroke-width="4"`) + P(`M${x + 98} ${y + 200}Q${x + 98} ${y + 100} ${x + 30} ${y + 92}L${x + 30} ${y + 200}z`, c, `stroke="${INK}" stroke-width="4"`);

// ---- shared props
const cloud = (x, y, s = 1, c = '#fff') => G(`translate(${x} ${y}) scale(${s})`, E(0, 4, 34, 11, c) + E(-15, -4, 18, 12, c) + E(12, -7, 20, 13, c), '.92');
const tree = (x, y, s, c = '#4D9A82') => G(`translate(${x} ${y}) scale(${s})`, R(-5, 10, 10, 60, '#8A6A4F') + C(0, -10, 38, c) + C(-16, -22, 14, '#fff', 'opacity=".14"'));
const plant = (x, y, s = 1) => G(`translate(${x} ${y}) scale(${s})`, P('M-16 0h32l-6 36h-20z', '#C2362B') + P('M0 0Q-34-30-18-52Q-6-30 0 0M0 0Q30-34 20-58Q4-30 0 0M0 0Q-4-46 4-64Q12-30 0 0', '#3C8670'));
const lamp = (x, y, c = '#F9D78A') => G(`translate(${x} ${y})`, R(-3, 0, 6, 70, '#6F8793') + P('M-30 0h60l-12-44h-36z', c, `stroke="${INK}" stroke-width="3"`) + E(0, 74, 22, 6, '#6F8793'));
const lantern = (x, y, c = '#C2362B', s = 1) => G(`translate(${x} ${y}) scale(${s})`, L('M0 -40V-18', INK, 2) + E(0, 0, 20, 24, c, `stroke="${INK}" stroke-width="2.5"`) + R(-9, -26, 18, 5, '#E9B44C') + R(-9, 20, 18, 5, '#E9B44C') + L('M-8 -18Q-14 0 -8 20M8 -18Q14 0 8 20', '#8E1F18', 1.6));
const window_ = (x, y, w, h, sky = '#A9D4EA') => RR(x, y, w, h, 8, sky, `stroke="#6B4E3A" stroke-width="8"`) + L(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, '#6B4E3A', 6);
const frame = (x, y, w, h, f) => RR(x, y, w, h, 4, '#fff', 'stroke="#6B4E3A" stroke-width="6"') + R(x + 8, y + 8, w - 16, h - 16, f);
const shelf = (x, y, w) => R(x, y, w, 9, '#8A5A3B', `stroke="${INK}" stroke-width="2"`);
const counter = (y, top, body, h = 520) => R(0, y, 480, h - y, body) + R(0, y - 4, 480, 22, top, `stroke="${INK}" stroke-width="3"`) + R(0, y + 18, 480, 5, INK, 'opacity=".18"');
const bowl = (x, y, s = 1) => G(`translate(${x} ${y}) scale(${s})`, P('M-26 0h52q-4 26-26 26T-26 0z', '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-12-8Q-18-20-10-30M2-8Q-4-20 4-32M16-8Q10-20 18-30', '#fff', 4, 'opacity=".95"'));
const cup = (x, y, s = 1) => G(`translate(${x} ${y}) scale(${s})`, P('M-16 0h30q-2 28-15 28T-16 0z', '#fff', `stroke="${INK}" stroke-width="3"`) + L('M14 4Q28 4 28 14T14 24', INK, 3) + L('M-5-8Q-10-18-4-28M5-8Q0-18 6-28', '#fff', 3.4));
const bird = (x, y) => L(`M${x} ${y}q9-12 18 0 9-12 18 0`, INK, 3);
const bld = (x, y, w, h, c, win = '#fff') => R(x, y, w, h, c) + Array.from({ length: Math.floor(h / 34) }, (_, r) => Array.from({ length: Math.floor(w / 28) }, (_, k) => R(x + 8 + k * 28, y + 10 + r * 34, 14, 18, win, 'opacity=".6"')).join('')).join('');

const S = {}, BASE = {};
const add = (id, base, inner, defs) => { S[id] = svg(inner, defs); BASE[id] = base; };

// ===== HSK 1 =====
add('cafe', '#9A6642',
  R(0, 0, 480, 520, '#F3D6AE') + window_(26, 54, 150, 170, '#9FD0E6') + bld(34, 120, 40, 100, '#6E9FB8') + C(142, 96, 15, '#F9DC7C') +
  RR(300, 44, 150, 100, 8, '#23453B', `stroke="#6B4E3A" stroke-width="8"`) + G('translate(375 94)', L('M-34 -10h54q-4 26-27 26T-34 -10z', '#F8FAF7', 4) + L('M20 -6q16 0 16 10t-16 10M-14 -22q-6-10 0-18M0 -22q-6-10 0-18', '#F8FAF7', 4)) +
  [[200, '#C2362B'], [70, '#E9A24B'], [420, '#C2362B']].map(([x, c]) => L(`M${x} 0V30`, '#6B4E3A', 2) + P(`M${x - 22} 52q22-30 44 0z`, c, `stroke="${INK}" stroke-width="2.5"`)).join('') +
  person(268, 168, '#1D6B58', apron(268, 168)) + counter(352, '#B97D54', '#8A5A3B') +
  G('translate(110 352)', P('M-30 0h60q-4-36-30-36T-30 0z', '#fff', `stroke="${INK}" stroke-width="3"`) + L('M30-14q18 0 18 14t-18 12', INK, 3.5) + R(-7 , -46, 14, 9, '#fff', `stroke="${INK}" stroke-width="2.5"`) + L('M-8-56q-8-12 0-22t0-16M8-56q-8-12 0-22t0-16', '#fff', 4)) +
  G('translate(400 352)', R(-30, -12, 60, 12, '#D8B089', `stroke="${INK}" stroke-width="2.5"`) + P('M-24-12v-14q24-24 48 0v14z', '#F4C7D2', `stroke="${INK}" stroke-width="3"`) + C(0, -36, 4.5, '#C2362B')));

add('intro', '#CFE0D6',
  R(0, 0, 480, 520, '#DCEBE3') + RR(40, 40, 400, 128, 12, '#fff', `stroke="#6F8793" stroke-width="7"`) + G('translate(240 104)', [-120, -40, 40, 120].map((x, i) => C(x, 0, 24, ['#C2362B', '#E9A24B', '#1D6B58', '#6A8FB5'][i], `stroke="${INK}" stroke-width="3"`) + L(`M${x - 12} 6Q${x} 16 ${x + 12} 6`, '#fff', 3)).join('')) +
  tree(46, 210, 1.1, '#6FB06A') + tree(434, 214, 1.1, '#6FB06A') +
  person(250, 176, '#C2362B', scarf(250, 176, '#F8FAF7')) + counter(356, '#B97D54', '#7A4F34') +
  RR(150, 372, 100, 40, 5, '#fff', `stroke="#C2362B" stroke-width="3"`) + L('M162 384h50M162 398h34', INK, 3, 'opacity=".55"') + G('translate(360 356)', RR(-26, -28, 52, 28, 4, '#F8E4CB', `stroke="${INK}" stroke-width="2.5"`) + L('M-14-14h28', INK, 3, 'opacity=".5"')));

add('shop', '#9A6642',
  R(0, 0, 480, 520, '#F4E4C8') + [78, 168, 258].map((y, r) => shelf(14, y + 50, 452) + Array.from({ length: 9 }, (_, i) => C(42 + i * 49, y + 30, 18, ['#C2362B', '#E9A24B', '#7DB56C', '#F7D054'][(i + r) % 4], `stroke="${INK}" stroke-width="2"`) + C(36 + i * 49, y + 23, 5, '#fff', 'opacity=".35"')).join('') + Array.from({ length: 5 }, (_, i) => RR(28 + i * 96, y + 60, 34, 16, 3, '#fff', `stroke="${INK}" stroke-width="1.6"`)).join('')).join('') +
  person(300, 176, '#3D6FA3', vest(300, 176, '#E9A24B')) + counter(352, '#B97D54', '#8A5A3B') +
  G('translate(104 352)', R(-40, -10, 80, 10, '#6F8793') + C(0, -38, 26, '#fff', `stroke="#6F8793" stroke-width="4"`) + L('M0-38l12-14', '#C2362B', 3.4)) + G('translate(400 352)', RR(-30, -34, 60, 34, 5, '#F8E4CB', `stroke="${INK}" stroke-width="3"`) + L('M-16-18h32', '#C2362B', 4)));

add('where', '#5F6B73',
  R(0, 0, 480, 520, '#C2E3F1') + C(404, 62, 28, '#F7D054') + cloud(90, 64, 1.1) + [[0, 150, '#E8C9A0', '#1D6B58'], [160, 160, '#F0D9B5', '#C2362B'], [320, 160, '#E6D3B8', '#E9A24B']].map(([x, w, c, a]) => R(x, 116, w, 250, c) + RR(x + 14, 128, w - 28, 40, 5, '#23453B') + C(x + w / 2, 148, 11, '#F8FAF7') + P(`M${x} 214h${w}l-10-34h-${w - 20}z`, a, `stroke="${INK}" stroke-width="2.5"`) + RR(x + 18, 238, w - 36, 100, 6, '#F8FAF7', 'opacity=".6"')).join('') +
  person(236, 190, '#C2362B', '') + R(0, 366, 480, 154, '#5F6B73') + R(0, 352, 480, 30, '#CDBB9B', `stroke="${INK}" stroke-width="3"`) + [0, 1, 2, 3, 4, 5, 6].map(i => R(14 + i * 70, 420, 42, 100, '#fff', 'opacity=".85"')).join('') +
  G('translate(60 300)', R(-4, -60, 8, 130, '#6F8793') + C(0, -70, 26, '#1D6B58', `stroke="${INK}" stroke-width="3"`) + L('M-12-70h24M6-80l8 10-8 10', '#fff', 4)));

add('family', '#C9A47C',
  R(0, 0, 480, 520, '#F3E3D0') + [[30, 40, '#9FD0E6'], [128, 30, '#F0C9A0'], [226, 44, '#F7B6C6'], [330, 32, '#B9D9CE']].map(([x, y, c]) => frame(x, y, 84, 100, c) + C(x + 42, y + 46, 18, '#F2C9A0') + P(`M${x + 14} ${y + 92}q28-44 56 0z`, '#6A8FB5')).join('') +
  lamp(432, 214) + RR(20, 276, 260, 100, 26, '#6A8FB5', `stroke="${INK}" stroke-width="4"`) + RR(10, 238, 280, 62, 26, '#5B7FA3', `stroke="${INK}" stroke-width="4"`) +
  person(180, 196, '#C2362B') + R(0, 380, 480, 140, '#C9A47C') + RR(60, 390, 150, 46, 10, '#8A5A3B', `stroke="${INK}" stroke-width="3"`) + cup(110, 388, .9) + cup(160, 388, .9) + plant(430, 372, 1.1) +
  G('translate(300 226)', R(-6, 50, 12, 70, '#8A6A4F') + P('M-40 120q0-60 40-60t40 60z', '#E9A24B', `stroke="${INK}" stroke-width="4"`) + C(0, 36, 26, '#F2C9A0', `stroke="${INK}" stroke-width="4"`) + P('M-26 30Q-24 6 0 6T26 30Q10 16 0 18T-26 30z', '#6B4E3A')));

add('plan', '#CDBB9B',
  R(0, 0, 480, 520, '#BFE3F0') + C(396, 70, 30, '#F9DC7C') + cloud(100, 78, 1.2) + P('M0 250Q110 200 230 236T480 220V520H0z', '#9CCDB2') + tree(70, 210, 1.7) + tree(410, 224, 1.5) + tree(226, 238, 1.0, '#6FB06A') +
  person(250, 176, '#C2362B', '') + R(0, 380, 480, 140, '#CDBB9B') + G('translate(240 372)', R(-150, -30, 300, 12, '#8A5A3B', `stroke="${INK}" stroke-width="3"`) + R(-150, -78, 300, 12, '#8A5A3B', `stroke="${INK}" stroke-width="3"`) + L('M-130-18V30M130-18V30M-130-78V-30M130-78V-30', '#6B4E3A', 8)) + bird(70, 120) + bird(380, 130));

add('phone', '#3B2F2A',
  R(0, 0, 480, 520, '#2A3350') + RR(300, 46, 140, 170, 8, '#16243A', `stroke="#6F8793" stroke-width="8"`) + C(370, 100, 24, '#F8E4CB') + C(382, 92, 21, '#16243A') + [[330, 70], [418, 150], [326, 176], [396, 192]].map(([x, y]) => C(x, y, 2.4, '#fff')).join('') +
  G('translate(60 70)', R(-4, 0, 8, 90, '#6F8793') + C(0, 100, 36, '#F9D78A', 'opacity=".25"') + C(0, 100, 20, '#F9D78A')) +
  person(220, 190, '#E9A24B', '', { hat: '' }) + R(0, 380, 480, 140, '#3B2F2A') + RR(10, 330, 330, 120, 18, '#6A8FB5', `stroke="${INK}" stroke-width="4"`) + RR(10, 296, 70, 150, 18, '#8FB0D0', `stroke="${INK}" stroke-width="4"`) +
  G('translate(330 250) rotate(-12)', RR(-34, -58, 68, 116, 12, INK, 'stroke="#B9D9CE" stroke-width="4"') + RR(-28, -50, 56, 100, 8, '#6AAE9A') + C(0, 34, 7, '#fff', 'opacity=".85"') + L('M-30-70q30-26 60 0M-46-86q46-40 92 0', '#B9D9CE', 3.4, 'opacity=".75"')));

add('weather', '#8A6A4F',
  R(0, 0, 480, 520, '#E6D9C8') + RR(44, 44, 392, 240, 8, '#9FB4C4', `stroke="#6B4E3A" stroke-width="10"`) + L('M240 44V284M44 164H436', '#6B4E3A', 6) + P('M54 284V210h60v-34h56v60h50v-90h66v70h46v-50h80v118z', '#5D7384', 'opacity=".85"') +
  Array.from({ length: 26 }, (_, i) => L(`M${58 + (i * 41) % 370} ${58 + (i * 59) % 210}l-7 20`, '#EAF5FA', 2.8, 'opacity=".9"')).join('') +
  person(130, 196, '#C2362B', scarf(130, 196, '#E9A24B')) + R(0, 380, 480, 140, '#8A6A4F') + R(0, 366, 480, 22, '#A87A55', `stroke="${INK}" stroke-width="3"`) + cup(250, 366, 1.1) +
  G('translate(400 380)', P('M0-110Q-52-104-60-48H60Q52-104 0-110z', '#C2362B', `stroke="${INK}" stroke-width="4"`) + L('M0-48V30Q0 46 -14 46', INK, 5)));

// ===== HSK 2 =====
add('way', '#5F6B73',
  R(0, 0, 480, 520, '#BEE2F1') + cloud(380, 60, 1.2) + bld(10, 90, 110, 270, '#D9B88F') + bld(130, 120, 90, 240, '#B7C8B0') + bld(330, 80, 140, 280, '#E5C9A6') +
  person(248, 176, '#3D6FA3', '', { glasses: false }) + R(0, 366, 480, 154, '#5F6B73') + R(0, 352, 480, 30, '#CDBB9B', `stroke="${INK}" stroke-width="3"`) + R(190, 400, 100, 120, '#F8FAF7', 'opacity=".25"') + [0, 1, 2, 3, 4, 5].map(i => R(20 + i * 78, 430, 44, 90, '#fff', 'opacity=".8"')).join('') +
  G('translate(60 300)', R(-4, -90, 8, 160, '#6F8793') + [[-70, '#C2362B', 1], [-40, '#1D6B58', -1]].map(([y, c, d]) => P(`M${d > 0 ? -2 : 2} ${y - 12}h${d * 56}l${d * 14} 12-${d * 14} 12h-${d * 56}z`, c, `stroke="${INK}" stroke-width="2.5"`)).join('')));

add('cafe2', '#7A4F34',
  R(0, 0, 480, 520, '#F2DDBE') + [60, 160, 260, 360, 440].map((x, i) => lantern(x, 50 + (i % 2) * 14, i % 2 ? '#E9A24B' : '#C2362B', 1)).join('') + L('M0 24Q240 56 480 24', INK, 2.5) +
  RR(30, 130, 120, 110, 8, '#23453B', `stroke="#6B4E3A" stroke-width="7"`) + G('translate(90 186)', bowl(0, -12, 1.3)) +
  person(300, 178, '#C2362B', apron(300, 178, '#F4E7CF')) + counter(352, '#B97D54', '#7A4F34') + bowl(110, 352, 1.3) + bowl(190, 352, 1.3) + G('translate(410 352)', R(-28, -42, 56, 42, '#6F8793', `stroke="${INK}" stroke-width="3"`) + L('M-12-48q-6-12 0-22M6-48q-6-12 0-22', '#fff', 4)));

add('pharmacy', '#9CB6AA',
  R(0, 0, 480, 520, '#E4F1EA') + [92, 176, 260].map((y, r) => shelf(14, y + 44, 190) + shelf(276, y + 44, 190) + Array.from({ length: 5 }, (_, i) => RR(24 + i * 36, y + 4 + (i % 2) * 6, 24, 40 - (i % 2) * 6, 4, ['#6AAE9A', '#E9A24B', '#fff', '#6A8FB5', '#C2362B'][(i + r) % 5], `stroke="${INK}" stroke-width="2"`) + RR(286 + i * 36, y + 8 + (i % 2) * 4, 24, 36 - (i % 2) * 4, 4, ['#E9A24B', '#fff', '#6AAE9A', '#C2362B', '#6A8FB5'][(i + r) % 5], `stroke="${INK}" stroke-width="2"`)).join('')).join('') +
  G('translate(240 56)', RR(-44, -36, 88, 72, 12, '#1D6B58', `stroke="${INK}" stroke-width="4"`) + R(-8, -26, 16, 52, '#fff') + R(-26, -8, 52, 16, '#fff')) +
  person(240, 196, '#E9A24B', coat(240, 196) + '') + counter(366, '#E8F0EA', '#9CB6AA') + G('translate(110 366)', RR(-26, -44, 52, 44, 6, '#fff', `stroke="${INK}" stroke-width="3"`) + R(-5, -34, 10, 24, '#C2362B') + R(-12, -27, 24, 10, '#C2362B')) + G('translate(380 366)', RR(-22, -50, 44, 50, 6, '#6AAE9A', `stroke="${INK}" stroke-width="3"`) + C(0, -26, 9, '#fff')));

add('hobby', '#C79A64',
  R(0, 0, 480, 520, '#C7E6F0') + R(0, 250, 480, 270, '#D7A06A') + R(0, 250, 480, 8, '#fff', 'opacity=".7"') + L('M0 330H480M240 250V520', '#fff', 5, 'opacity=".75"') +
  G('translate(80 130)', R(-5, 0, 10, 130, '#6F8793') + RR(-46, -62, 92, 64, 6, '#fff', `stroke="${INK}" stroke-width="4"`) + L('M-26-18h52', '#C2362B', 4) + L('M-26 0Q0 36 26 0', INK, 3)) +
  person(300, 178, '#C2362B', P('M-0 0', 'none')) + G('translate(300 300)', R(-110, 0, 220, 14, '#1D6B58', `stroke="${INK}" stroke-width="3"`)) + R(0, 380, 480, 140, '#B98050') +
  G('translate(400 372)', C(0, -34, 34, '#E9863B', `stroke="${INK}" stroke-width="4"`) + L('M-34-34h68M0-68V0M-24-58Q-10-34-24-10M24-58Q10-34 24-10', INK, 3)) + G('translate(150 380)', E(0, 0, 40, 8, INK, 'opacity=".2"') + R(-26, -30, 52, 30, '#6A8FB5', `stroke="${INK}" stroke-width="3"`)));

add('airport', '#5F6B73',
  R(0, 0, 480, 520, '#BFE0F0') + R(0, 90, 480, 230, '#E6EDF1') + R(0, 90, 480, 14, '#C2362B') + [0, 1, 2, 3, 4].map(i => RR(20 + i * 92, 130, 80, 150, 4, '#A9D4EA', `stroke="#6F8793" stroke-width="4"`)).join('') +
  G('translate(60 70)', P('M-30 0l60-16 18 6-18 10-4 18-8-14-34 6z', '#6F8793')) + G('translate(400 60)', P('M-30 0l60-16 18 6-18 10-4 18-8-14-34 6z', '#C2362B')) +
  G('translate(100 330)', RR(-70, -40, 140, 60, 18, '#E9B44C', `stroke="${INK}" stroke-width="4"`) + P('M-40-40l16-30h52l16 30z', '#F8E4CB', `stroke="${INK}" stroke-width="4"`) + C(-40, 24, 14, INK) + C(40, 24, 14, INK) + RR(-18, -82, 36, 14, 4, '#1D6B58')) +
  person(318, 186, '#1D6B58', vest(318, 186, '#E9A24B')) + R(0, 366, 480, 154, '#5F6B73') + R(0, 352, 480, 28, '#CDBB9B', `stroke="${INK}" stroke-width="3"`) + G('translate(420 352)', RR(-30, -64, 60, 64, 6, '#C2362B', `stroke="${INK}" stroke-width="3"`) + L('M-12-64V-82h24V-64', INK, 4)));

add('birthday', '#B07A5A',
  R(0, 0, 480, 520, '#F9E1E6') + [[60, 90, '#C2362B'], [120, 60, '#E9A24B'], [380, 70, '#6A8FB5'], [430, 110, '#1D6B58'], [330, 40, '#C2362B']].map(([x, y, c]) => L(`M${x} ${y + 30}Q${x - 8} ${y + 80} ${x + 6} ${y + 130}`, INK, 1.8) + E(x, y, 26, 32, c, `stroke="${INK}" stroke-width="3"`) + E(x - 8, y - 10, 6, 9, '#fff', 'opacity=".4"')).join('') + L('M0 20Q120 70 240 24T480 28', '#C2362B', 3) +
  [40, 100, 160, 220, 280, 340, 400, 450].map((x, i) => P(`M${x} ${30 + (i % 2) * 8}l14 4-8 18z`, ['#E9A24B', '#1D6B58', '#6A8FB5', '#C2362B'][i % 4])).join('') +
  person(300, 188, '#1D6B58', scarf(300, 188, '#F9D78A')) + R(0, 380, 480, 140, '#B07A5A') + R(0, 362, 480, 26, '#E9D3B8', `stroke="${INK}" stroke-width="3"`) +
  G('translate(130 362)', R(-62, -26, 124, 26, '#F4C7D2', `stroke="${INK}" stroke-width="3"`) + R(-46, -54, 92, 28, '#fff', `stroke="${INK}" stroke-width="3"`) + [-28, 0, 28].map(x => R(x - 3, -78, 6, 24, '#6A8FB5') + P(`M${x} -92q8 10 0 16-8-6 0-16z`, '#F7D054')).join('') + C(0, -60, 5, '#C2362B')));

add('exam', '#B98050',
  R(0, 0, 480, 520, '#E3EBDD') + RR(40, 44, 400, 160, 8, '#23453B', `stroke="#8A5A3B" stroke-width="10"`) + L('M70 90h120M70 120h200M70 150h90M300 80l30 30 50-50', '#F0F4EE', 4, 'opacity=".75"') + R(60, 206, 360, 8, '#8A5A3B') + R(120, 192, 30, 12, '#fff') + R(160, 192, 20, 12, '#E9A24B') +
  G('translate(404 270)', C(0, 0, 40, '#fff', `stroke="${INK}" stroke-width="4"`) + L('M0 0V-26M0 0l18 10', INK, 4)) + person(190, 196, '#C2362B', vest(190, 196, '#E9A24B'), { glasses: true }) +
  R(0, 372, 480, 148, '#C79A64') + RR(70, 358, 340, 34, 8, '#E9D3B8', `stroke="${INK}" stroke-width="3"`) + G('translate(150 358)', RR(-40, -36, 80, 38, 3, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-26-22h52M-26-10h34', '#C2362B', 3)) + G('translate(300 358)', R(-8, -34, 16, 34, '#E9A24B', `stroke="${INK}" stroke-width="3"`)));

add('trousers', '#9A7A5C',
  R(0, 0, 480, 520, '#F0E8F6') + L('M20 96H460', '#6F8793', 6) + [[50, '#3D6FA3'], [112, '#6A8FB5'], [354, '#1D6B58'], [416, '#3C3C44']].map(([x, c]) => L(`M${x} 96v-14`, '#6F8793', 4) + P(`M${x - 24} 100h48l-4 120h-16l-4-70-4 70h-16z`, c, `stroke="${INK}" stroke-width="3"`)).join('') +
  person(234, 190, '#C2362B', scarf(234, 190, '#F9D78A')) + counter(366, '#E8D8C0', '#9A7A5C') + G('translate(90 366)', R(-40, -14, 80, 14, '#6A8FB5', `stroke="${INK}" stroke-width="3"`) + R(-40, -28, 80, 14, '#3D6FA3', `stroke="${INK}" stroke-width="3"`)) + G('translate(390 366)', RR(-34, -58, 68, 58, 6, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-20-40h40M-20-26h26', '#C2362B', 3.4)));

// ===== HSK 3 =====
add('hotel', '#7A4F34',
  R(0, 0, 480, 520, '#F2E3CB') + RR(36, 50, 120, 150, 6, '#6B4E3A') + [0, 1, 2, 3].map(r => [0, 1, 2].map(c => RR(46 + c * 34, 62 + r * 34, 26, 26, 3, '#F9D78A', `stroke="${INK}" stroke-width="2"`) + L(`M${59 + c * 34} ${88 + r * 34}v8`, '#E9B44C', 3)).join('')).join('') +
  G('translate(400 80)', C(0, 0, 40, '#fff', `stroke="${INK}" stroke-width="4"`) + L('M0 0V-24M0 0l18 8', INK, 4)) + G('translate(400 160)', C(0, 0, 34, '#fff', `stroke="${INK}" stroke-width="4"`) + L('M0 0V-20M0 0l14 6', INK, 4)) +
  person(260, 190, '#1D6B58', vest(260, 190, '#C2362B') + '') + counter(360, '#B97D54', '#7A4F34') + G('translate(110 360)', E(0, 0, 36, 10, '#E9B44C', `stroke="${INK}" stroke-width="3"`) + P('M-26 0Q0-34 26 0z', '#E9B44C', `stroke="${INK}" stroke-width="3"`) + C(0, -30, 5, '#E9B44C', `stroke="${INK}" stroke-width="2.5"`)) + G('translate(400 360)', RR(-30, -44, 60, 44, 5, '#F8E4CB', `stroke="${INK}" stroke-width="3"`) + C(0, -22, 8, '#E9B44C')));

add('doctor', '#B8D3CF',
  R(0, 0, 480, 520, '#E3F1F0') + G('translate(76 90)', RR(-44, -44, 88, 88, 14, '#fff', `stroke="${INK}" stroke-width="4"`) + R(-9, -30, 18, 60, '#C2362B') + R(-30, -9, 60, 18, '#C2362B')) +
  RR(330, 50, 120, 150, 8, '#fff', `stroke="#6F8793" stroke-width="6"`) + L('M350 90h80M350 114h60M350 138h72M350 162h40', '#6AAE9A', 5) + G('translate(60 220)', plant(0, 0, 1.1)) +
  person(230, 190, '#6A8FB5', coat(230, 190), { glasses: true }) + G('translate(230 330)', P('M-60 0Q0 56 60 0', 'none', `stroke="${INK}" stroke-width="6"`) + C(-60, 0, 8, '#6F8793') + C(60, 0, 8, '#6F8793')) + counter(372, '#E8F0EA', '#B8D3CF') + G('translate(110 372)', RR(-30, -22, 60, 22, 5, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-18-11h36', '#C2362B', 4)) + G('translate(390 372)', RR(-24, -50, 48, 50, 6, '#6AAE9A', `stroke="${INK}" stroke-width="3"`) + C(0, -26, 9, '#fff')));

add('weekend', '#C9A47C',
  R(0, 0, 480, 520, '#F3E3D0') + RR(36, 50, 190, 160, 8, '#fff', `stroke="#6B4E3A" stroke-width="7"`) + R(36, 50, 190, 36, '#C2362B') + [0, 1, 2, 3, 4, 5, 6].map(i => [0, 1, 2].map(r => C(54 + i * 24, 108 + r * 30, 7, (i === 5 || i === 6) && r === 1 ? '#E9A24B' : '#DDE5DF')).join('')).join('') +
  RR(270, 54, 170, 130, 8, '#BCDDEB', `stroke="#6B4E3A" stroke-width="7"`) + P('M276 184l40-60 30 34 30-48 54 74z', '#7DB56C') + C(400, 94, 14, '#F7D054') +
  person(300, 214, '#1D6B58', '', {}) + R(0, 386, 480, 134, '#C9A47C') + RR(14, 346, 300, 80, 24, '#6A8FB5', `stroke="${INK}" stroke-width="4"`) + RR(330, 330, 130, 76, 10, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M344 350h100M344 366h70M344 382h86', '#6AAE9A', 4));

add('moving', '#B79A78',
  R(0, 0, 480, 520, '#EFE6D8') + window_(300, 54, 140, 160, '#A9D4EA') + R(0, 380, 480, 140, '#C9AE86') + L('M0 396H480', '#B79A78', 3) +
  person(180, 204, '#C2362B', P('M0 0', 'none')) + [[330, 330, 100, 90, '#C98B4A'], [400, 270, 70, 70, '#D9A464'], [60, 350, 120, 80, '#D9A464']].map(([x, y, w, h, c]) => RR(x, y, w, h, 4, c, `stroke="${INK}" stroke-width="4"`) + R(x + w / 2 - 14, y, 28, 14, '#F2E3CB', `stroke="${INK}" stroke-width="2.5"`)).join('') +
  G('translate(250 354)', RR(-70, -40, 140, 40, 6, '#D9A464', `stroke="${INK}" stroke-width="4"`) + R(-14, -40, 28, 12, '#F2E3CB', `stroke="${INK}" stroke-width="2.5"`)) + plant(450, 370, 1.1) + G('translate(60 240)', R(-3, 0, 6, 100, '#8A6A4F') + L('M-30 0h60', '#8A6A4F', 6) + C(0, 20, 6, '#E9A24B')));

add('train', '#6F7B83',
  R(0, 0, 480, 520, '#BFE0F0') + cloud(90, 50, 1.2) + cloud(380, 74, .9) + P('M0 240Q100 180 220 226T480 200V520H0z', '#9CCDB2') +
  G('translate(0 130)', P('M0 0h390q60 0 90 70v40H0z', '#F8FAF7', `stroke="${INK}" stroke-width="4"`) + R(0, 70, 480, 12, '#C2362B') + [0, 1, 2, 3].map(i => RR(24 + i * 90, 20, 70, 34, 6, '#A9CBE8', `stroke="${INK}" stroke-width="3"`)).join('') + P('M392 14q50 6 70 40H392z', '#A9CBE8', `stroke="${INK}" stroke-width="3"`)) +
  person(190, 218, '#3D6FA3', vest(190, 218, '#E9A24B'), { hat: P('M-52-34h104q-6-34-52-34t-52 34z', '#3D6FA3', `transform="translate(190 218)" stroke="${INK}" stroke-width="4"`) }) +
  R(0, 380, 480, 140, '#6F7B83') + R(0, 366, 480, 22, '#CDBB9B', `stroke="${INK}" stroke-width="3"`) + R(0, 396, 480, 8, '#E9B44C') + G('translate(400 366)', RR(-28, -56, 56, 56, 6, '#C2362B', `stroke="${INK}" stroke-width="3"`) + L('M-12-56V-72h24V-56', INK, 4)));

add('school', '#C79A64',
  R(0, 0, 480, 520, '#C7E6F0') + C(410, 66, 28, '#F9DC7C') + cloud(110, 70, 1.1) + R(40, 110, 400, 180, '#EBDCC0') + R(24, 96, 432, 22, '#C2362B') + P('M10 98l36-44h388l36 44z', '#8E1F18') + [0, 1, 2, 3].map(i => RR(66 + i * 92, 150, 56, 70, 4, '#A9CBE8', `stroke="${INK}" stroke-width="3"`)).join('') +
  tree(36, 250, 1.3) + tree(446, 254, 1.3) + person(240, 222, '#C2362B', '') + R(0, 390, 480, 130, '#CDBB9B') + R(0, 376, 480, 24, '#E4D8C2', `stroke="${INK}" stroke-width="3"`) + G('translate(110 376)', RR(-40, -44, 80, 44, 4, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-24-26h48M-24-14h30', '#6A8FB5', 4)) + G('translate(380 376)', RR(-26, -40, 52, 40, 3, '#6A8FB5', `stroke="${INK}" stroke-width="3"`) + L('M-14-20h28', '#fff', 4)));

add('exchange', '#9A7A5C',
  R(0, 0, 480, 520, '#E9F0F6') + L('M20 90H460', '#6F8793', 6) + [[56, '#6A8FB5'], [128, '#C2362B'], [350, '#1D6B58'], [422, '#E9A24B']].map(([x, c]) => L(`M${x} 90v-12`, '#6F8793', 4) + P(`M${x - 38} 100l16-10h44l16 10-8 18-12-8v78h-36v-78l-12 8z`, c, `stroke="${INK}" stroke-width="3"`)).join('') +
  person(240, 194, '#3D6FA3', vest(240, 194, '#F9D78A')) + counter(366, '#E8D8C0', '#9A7A5C') + G('translate(110 366)', RR(-34, -52, 68, 52, 5, '#fff', `stroke="${INK}" stroke-width="3"`) + L('M-20-36h40M-20-22h28', '#C2362B', 3.5)) + G('translate(390 366)', P('M-34 0v-46l16-10h36l16 10v46z', '#C2362B', `stroke="${INK}" stroke-width="3"`)));

add('abroad', '#3B3560',
  R(0, 0, 480, 520, '#3A3660') + [[40, 40], [110, 90], [160, 30], [380, 36], [440, 100], [300, 80], [60, 150], [430, 170]].map(([x, y]) => C(x, y, 2.6, '#fff')).join('') +
  G('translate(400 90)', C(0, 0, 50, '#6AAE9A', `stroke="${INK}" stroke-width="4"`) + P('M-30-14q16-10 26 6t-10 22q-16-6-16-28M10-30q20 0 24 20-8 10-24 0z', '#7DB56C') + L('M-50 0H50', '#fff', 2, 'opacity=".5"')) +
  person(180, 196, '#E9A24B', scarf(180, 196, '#C2362B')) + R(0, 380, 480, 140, '#4A4378') + R(0, 366, 480, 22, '#6B5FA0', `stroke="${INK}" stroke-width="3"`) +
  G('translate(340 366)', RR(-86, -140, 172, 120, 10, INK, 'stroke="#B9D9CE" stroke-width="5"') + RR(-78, -132, 156, 104, 6, '#6AAE9A') + C(0, -92, 20, '#F2C9A0', `stroke="${INK}" stroke-width="3"`) + P('M-30-30q30-52 60 0z', '#C2362B', `stroke="${INK}" stroke-width="3"`) + R(-92, -20, 184, 14, '#6F8793', `stroke="${INK}" stroke-width="3"`)) + cup(80, 366, 1));

// ===== free chat =====
add('free', '#8A5A3B',
  R(0, 0, 480, 520, '#F3DDC2') + window_(30, 56, 150, 160, '#9FD0E6') + frame(300, 54, 120, 90, '#B9D9CE') + lamp(446, 200) + plant(60, 300, 1.2) +
  person(250, 190, '#3D6FA3', scarf(250, 190, '#F9D78A')) + counter(366, '#B97D54', '#8A5A3B') + cup(110, 366, 1.1) + cup(390, 366, 1.1));

const out = {};
Object.keys(S).forEach(k => { out[k] = { u: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(S[k]), c: BASE[k] }; });
const text = '/* Backdrops of the Speak scenarios (one per scenario id, and "free" for free chat). GENERATED by tools/speak-scenes.js. Do not edit by hand. */\nwindow.SHANLU_SPEAK_SCENES = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'data', 'speak-scenes.js'), text);
if (process.argv.includes('--sheet')) Object.keys(S).forEach(k => fs.writeFileSync('/tmp/speak-' + k + '.svg', S[k]));
console.log('wrote data/speak-scenes.js (' + Object.keys(S).length + ' scenes, ' + Math.round(text.length / 1024) + ' KB)');
