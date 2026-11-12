#!/usr/bin/env node
/* Souvenir icons: small flat pictures, all drawn here from simple shapes (nothing copied from anywhere).
 *   node tools/souvenir-art.js      writes content/souvenir-art.json  (id -> svg)
 * then   python3 tools/build-souvenirs.py   builds data/souvenirs.js
 * One picture per souvenir id in content/souvenirs.tsv. Style: 64 x 64, one dark outline, soft flat fills.
 * Pictures are shown as images (a data address), so they cannot touch the page, and have no scripts.
 */
const fs = require('fs');
const path = require('path');

const C = { ink:'#2b3a42', red:'#c8372d', dred:'#8f2220', gold:'#e2a93b', pale:'#f3dd9a', jade:'#4aa085', blue:'#3d6fa5', sky:'#a9cbe8', cream:'#f7efd9',
  brown:'#8d5b3a', tan:'#d2a773', pink:'#eaa5a5', lime:'#8fc47a', green:'#3f8a56', grey:'#aab4ba', dgrey:'#66737b', white:'#ffffff', black:'#33383d',
  purple:'#7b5ea7', orange:'#e8873a', yellow:'#f2d04e', skin:'#f1c9a0', bronze:'#b8a266', teal:'#2f8f95', navy:'#2c4a73' };
const A = (o) => Object.keys(o).map((k) => k + '="' + o[k] + '"').join(' ');
const sty = (f, w) => A({ fill:f, stroke:C.ink, 'stroke-width':w || 2, 'stroke-linejoin':'round', 'stroke-linecap':'round' });
const rot = (r, x, y) => (r ? ' transform="rotate(' + r + ' ' + x + ' ' + y + ')"' : '');
const rect = (x, y, w, h, f, rx, r) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx == null ? 3 : rx) + '" ' + sty(f) + rot(r, x + w / 2, y + h / 2) + '/>';
const circ = (x, y, r, f) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" ' + sty(f) + '/>';
const ell = (x, y, rx, ry, f, r) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" ' + sty(f) + rot(r, x, y) + '/>';
const path_ = (d, f) => '<path d="' + d + '" ' + sty(f) + '/>';
const poly = (p, f) => '<polygon points="' + p + '" ' + sty(f) + '/>';
const line = (d, col, w) => '<path d="' + d + '" fill="none" stroke="' + (col || C.ink) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
const dot = (x, y, r, f) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.6) + '" fill="' + (f || C.ink) + '"/>';
const blob = (d, f) => '<path d="' + d + '" fill="' + f + '"/>';                // fill only, no outline
const txt = (x, y, s, size, f) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="700" text-anchor="middle" fill="' + (f || C.ink) + '" font-family="\'Noto Serif SC\',\'Songti SC\',\'SimSun\',serif">' + s + '</text>';

const ART = {};
const add = (id, parts) => { ART[id] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + parts.join('') + '</svg>'; };

// ---------- Sichuan ----------
add('panda-plush', [
  ell(17, 43, 5, 9, C.black, 18), ell(47, 43, 5, 9, C.black, -18),
  circ(20, 11, 5.5, C.black), circ(44, 11, 5.5, C.black),
  ell(32, 43, 15, 14, C.white), ell(24, 56, 6, 4, C.black), ell(40, 56, 6, 4, C.black),
  circ(32, 24, 14.5, C.white),
  ell(25.5, 23, 3.8, 5.2, C.black, 18), ell(38.5, 23, 3.8, 5.2, C.black, -18),
  dot(26.2, 22.5, 1.5, C.white), dot(37.8, 22.5, 1.5, C.white),
  ell(32, 29, 2.8, 2, C.black), line('M29.5 32.5 Q32 35 34.5 32.5')]);
add('gaiwan', [
  ell(32, 51, 25, 6, C.cream),
  path_('M13 29 L51 29 Q51 47 32 48 Q13 47 13 29 Z', C.white),
  line('M19 36 Q32 41 45 36', C.blue, 2.4), blob('M26 42 q6 2 12 0 l-1 2 q-5 1.5 -10 0z', C.blue),
  path_('M10 29 Q32 8 54 29 Z', C.sky), circ(32, 17.5, 3.2, C.gold),
  line('M20 26 Q32 15 44 26', C.blue, 1.6)]);
add('face-mask-sichuan', [
  path_('M32 5 C17 5 11 19 13 33 C15 48 23 59 32 59 C41 59 49 48 51 33 C53 19 47 5 32 5 Z', C.red),
  poly('32,8 37,15 32,23 27,15', C.gold),
  line('M16 25 Q23 16 30 26', C.ink, 4), line('M48 25 Q41 16 34 26', C.ink, 4),
  ell(24, 31, 4.6, 3.2, C.white), ell(40, 31, 4.6, 3.2, C.white), dot(24, 31, 2), dot(40, 31, 2),
  line('M32 32 L30 41 L34 41', C.dred, 2), path_('M22 46 Q32 55 42 46 Q32 49 22 46 Z', C.gold),
  line('M16 40 q3 -3 6 -1 M48 40 q-3 -3 -6 -1', C.gold, 1.8)]);
add('hotpot-base', [
  rect(8, 17, 48, 33, C.red, 5),
  rect(8, 17, 48, 7, C.dred, 4),
  rect(16, 26, 32, 20, C.cream, 3), txt(32, 43, '辣', 17, C.red),
  path_('M12 15 Q23 8 26 19 Q17 20 12 15 Z', C.dred), line('M26 19 q3 -4 6 -5', C.green, 2),
  dot(44, 12, 2.4, C.green), dot(49, 14.5, 2.2, C.green), dot(39.5, 14.5, 2, C.green),
  line('M13 55 h38', C.grey, 2)]);
add('sanxingdui-mask', [
  path_('M5 21 Q1 28 5 36 L10 34 L10 22 Z', C.bronze), path_('M59 21 Q63 28 59 36 L54 34 L54 22 Z', C.bronze),
  path_('M9 18 Q32 10 55 18 L55 42 Q55 55 45 55 L19 55 Q9 55 9 42 Z', C.bronze),
  rect(12, 25, 16, 9, C.pale, 4.5), rect(36, 25, 16, 9, C.pale, 4.5),
  dot(23.5, 29.5, 2.8), dot(40.5, 29.5, 2.8),
  line('M32 29 L32 41', C.ink, 2), line('M20 46 H44', C.ink, 3.4),
  path_('M26 17 Q32 3 38 17', C.gold), line('M32 5 V15', C.ink, 1.6)]);

// ---------- Hebei: Beijing and Tianjin ----------
add('peking-opera-face', [
  path_('M14 17 Q32 -1 50 17 L46 22 Q32 15 18 22 Z', C.gold), circ(32, 8, 4.2, C.red), circ(20, 14, 2.2, C.red), circ(44, 14, 2.2, C.red),
  ell(32, 36, 18, 22, C.cream),
  path_('M32 20 L37 31 L32 35 L27 31 Z', C.red),
  path_('M14 31 Q22 22 30 33 Q21 31 14 31 Z', C.ink), path_('M50 31 Q42 22 34 33 Q43 31 50 31 Z', C.ink),
  ell(22, 44, 5.5, 4.5, C.red), ell(42, 44, 5.5, 4.5, C.red), ell(32, 40, 3, 2.6, C.red),
  line('M25 51 Q32 56 39 51', C.ink, 2.4)]);
add('rabbit-lord', [
  ell(24, 13, 4.4, 11.5, C.white, -12), ell(40, 13, 4.4, 11.5, C.white, 12), ell(24, 14, 1.8, 7.5, C.pink, -12), ell(40, 14, 1.8, 7.5, C.pink, 12),
  path_('M19 61 L21 41 Q32 36 43 41 L45 61 Z', C.red),
  path_('M26 41 Q32 46 38 41 L40 53 Q32 57 24 53 Z', C.gold), line('M32 45 V55', C.ink, 1.4),
  circ(32, 30, 11, C.white), path_('M21 28 Q32 16 43 28 Q32 24 21 28 Z', C.gold), poly('32,15 35,22 29,22', C.gold),
  dot(27.5, 31, 1.6), dot(36.5, 31, 1.6), ell(32, 35, 2.2, 1.6, C.pink), line('M32 36.5 v2 M29.5 39 q2.5 1.8 5 0', C.ink, 1.4),
  rect(16, 58, 32, 4, C.brown, 2)]);
add('cloisonne', [
  rect(23, 5, 18, 5, C.gold, 2),
  path_('M26 10 H38 L37 17 Q52 24 52 41 Q52 59 32 59 Q12 59 12 41 Q12 24 27 17 Z', C.blue),
  circ(32, 40, 8, C.gold), circ(32, 40, 4, C.red), circ(32, 29.5, 2.4, C.pale), circ(32, 50.5, 2.4, C.pale), circ(21.5, 40, 2.4, C.pale), circ(42.5, 40, 2.4, C.pale),
  line('M16 30 q16 -8 32 0', C.pale, 1.8), line('M15 51 q17 8 34 0', C.pale, 1.8),
  rect(23, 56, 18, 4, C.gold, 2)]);
add('yangliuqing', [
  rect(7, 5, 50, 54, C.red, 3), rect(11, 9, 42, 46, C.cream, 2),
  circ(32, 24, 9, C.skin), path_('M23 20 Q32 9 41 20 Q32 16 23 20 Z', C.ink),
  dot(28.5, 25, 1.5), dot(35.5, 25, 1.5), ell(26, 29, 2.4, 1.6, C.pink), ell(38, 29, 2.4, 1.6, C.pink), line('M29.5 30 q2.5 2 5 0', C.ink, 1.4),
  path_('M22 53 Q22 35 32 33 Q42 35 42 53 Z', C.red),
  path_('M36 47 Q46 40 53 46 Q47 52 36 47 Z', C.orange), poly('53,46 59,41 59,52', C.orange), dot(41, 45.5, 1.2),
  line('M13 12 h6 M45 12 h6', C.gold, 2)]);
add('clay-zhang', [
  rect(12, 55, 40, 6, C.brown, 2),
  path_('M20 56 Q18 36 32 33 Q46 36 44 56 Z', C.teal),
  line('M23 46 H41', C.gold, 3),
  ell(18.5, 44, 3.6, 6, C.teal, 20), ell(45.5, 44, 3.6, 6, C.teal, -20),
  circ(32, 24, 9, C.skin), dot(28.5, 25, 1.5), dot(35.5, 25, 1.5), line('M29.5 30 q2.5 2 5 0', C.ink, 1.4), ell(25.5, 28.5, 2, 1.4, C.pink), ell(38.5, 28.5, 2, 1.4, C.pink),
  path_('M22 21 Q22 9 32 9 Q42 9 42 21 Q32 15 22 21 Z', C.black), rect(29.5, 5, 5, 5, C.black, 2)]);

const ring = (x, y, r, col, w) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + (col || C.white) + '" stroke-width="' + (w || 1.8) + '"/>';
const grp = (r, parts) => '<g transform="rotate(' + r + ' 32 32)">' + parts.join('') + '</g>';

// ---------- Jiangsu ----------
add('zisha-teapot', [
  line('M46 29 Q60 27 57 40 Q55 47 45 46', C.ink, 7), line('M46 29 Q60 27 57 40 Q55 47 45 46', C.brown, 3.4),
  path_('M17 37 L5 25 L10 22 L22 30 Z', C.brown),
  path_('M13 38 Q13 26 32 26 Q51 26 51 38 Q51 55 32 55 Q13 55 13 38 Z', C.brown),
  ell(32, 26, 10, 3.2, C.tan), circ(32, 20.5, 3.2, C.tan),
  line('M19 37 Q20 46 27 50', C.tan, 2), rect(22, 54, 20, 4, C.brown, 2)]);
add('ah-fu', [
  ell(32, 47, 16, 13, C.red), circ(32, 49, 5.5, C.gold), line('M28 49 H36 M32 45 V53', C.red, 1.4),
  ell(24, 59, 6, 3, C.blue), ell(40, 59, 6, 3, C.blue),
  circ(18, 13, 4.6, C.black), circ(46, 13, 4.6, C.black),
  circ(32, 26, 15, C.skin), dot(32, 17, 1.9, C.red),
  dot(26, 25, 1.6), dot(38, 25, 1.6), ell(21.5, 31, 3.2, 2.2, C.pink), ell(42.5, 31, 3.2, 2.2, C.pink), line('M28.5 31 q3.5 3 7 0', C.ink, 1.6)]);
add('suzhou-embroidery', [
  rect(29, 4, 6, 6, C.gold, 1.5), circ(32, 34, 25, C.brown), circ(32, 34, 21, C.cream),
  ell(21, 43, 8.5, 3.6, C.green, -25), ell(43, 43, 8.5, 3.6, C.green, 25),
  ell(32, 22, 5, 8, C.pink), ell(23.5, 28, 5, 8, C.pink, -62), ell(40.5, 28, 5, 8, C.pink, 62),
  ell(26, 36, 5, 7, C.pink, -25), ell(38, 36, 5, 7, C.pink, 25), circ(32, 31, 4.2, C.gold)]);
add('yunjin', [
  ell(53, 35, 6, 17, C.dred), ell(53, 35, 2.5, 7.5, C.gold),
  rect(6, 18, 47, 34, C.red, 2),
  line('M12 28 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0', C.gold, 2.2), line('M12 36 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0', C.pale, 2.2), line('M12 44 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0', C.gold, 2.2)]);

// ---------- Guangdong ----------
add('qipao', [
  path_('M26 8 H38 L40 14 L50 19 L46 28 L42 26 L46 58 H18 L22 26 L18 28 L14 19 L24 14 Z', C.red),
  rect(27, 5, 10, 8, C.dred, 2), line('M32 13 L41 23', C.gold, 2), dot(35, 17, 1.4, C.gold), dot(39, 21.5, 1.4, C.gold),
  line('M19 55 H45', C.gold, 2.4), circ(28, 40, 4, C.pale), circ(28, 40, 1.6, C.gold), circ(36, 33, 2.6, C.pale),
  line('M33 44 L34 58', C.dred, 1.6)]);
add('guangcai-plate', [
  circ(32, 32, 27, C.white), circ(32, 32, 20, C.pale), ring(32, 32, 24, C.gold, 2.4),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => dot((32 + 23.5 * Math.cos(i * Math.PI / 6)).toFixed(1), (32 + 23.5 * Math.sin(i * Math.PI / 6)).toFixed(1), 1.8, i % 2 ? C.blue : C.red)),
  ell(21, 40, 8, 3, C.green, -30), ell(43, 40, 8, 3, C.green, 30), ell(32, 21, 3, 8, C.green),
  circ(32, 32, 11, C.red), circ(32, 32, 6.4, C.pink), circ(32, 32, 2.6, C.gold)]);
add('paper-cut', [
  rect(14, 14, 36, 36, C.red, 2, 45),
  txt(32, 40, '福', 20, C.cream),
  dot(32, 11, 2.2, C.cream), dot(32, 53, 2.2, C.cream), dot(10, 32, 2.2, C.cream), dot(54, 32, 2.2, C.cream),
  line('M32 57 V63', C.gold, 2)]);
add('duan-inkstone', [
  rect(8, 12, 48, 42, C.dgrey, 6), rect(12, 16, 40, 34, '#7c8791', 4),
  ell(27, 35, 14, 10, C.ink), ell(27, 33, 9, 5.4, C.black), ell(45, 24, 4.6, 3.8, C.ink),
  line('M16 20 q6 -2 14 0', C.dgrey, 1.6),
  rect(38, 42, 22, 8, C.black, 1.8, -14), line('M43 41 l12 -3', C.gold, 2)]);
add('wooden-dummy', [
  rect(18, 56, 28, 6, C.brown, 2),
  rect(26, 5, 12, 53, C.tan, 5),
  rect(6, 14, 22, 5, C.brown, 2), rect(6, 22, 22, 5, C.brown, 2), rect(36, 31, 22, 5, C.brown, 2),
  path_('M34 44 L44 46 L52 57 L47 60 L38 52 Z', C.brown),
  line('M29 12 V50 M34 10 V48', C.brown, 1.1), circ(32, 8, 0.1, C.brown)]);

// ---------- Taiwan ----------
add('pineapple-cake-box', [
  rect(8, 25, 48, 31, C.pale, 3), rect(6, 16, 52, 11, C.gold, 3),
  poly('32,34 26,23 30,27 32,19 34,27 38,23', C.green),
  ell(32, 43, 8.5, 10.5, C.orange), line('M26 38 L38 49 M26 46 L36 36 M27 50 L37 41', C.dred, 1.3),
  line('M13 52 H22 M42 52 H51', C.gold, 2)]);
add('glove-puppet', [
  ell(13, 42, 4.4, 9, C.blue, 14), ell(51, 42, 4.4, 9, C.blue, -14), circ(11.5, 51, 3.4, C.skin), circ(52.5, 51, 3.4, C.skin),
  path_('M16 59 Q16 35 24 31 H40 Q48 35 48 59 Z', C.blue), path_('M26 31 L32 40 L38 31', C.gold), line('M17 53 H47', C.gold, 2.4),
  circ(32, 21, 10.5, C.skin), dot(28, 21, 1.5), dot(36, 21, 1.5), line('M29 27 Q32 29 35 27', C.ink, 1.5), line('M26 18 q2 -2 4 0 M34 18 q2 -2 4 0', C.ink, 1.3),
  path_('M19.5 17 Q32 -2 44.5 17 Q32 12 19.5 17 Z', C.red), circ(32, 6.5, 2.6, C.gold)]);
add('sky-lantern', [
  path_('M20 9 H44 L52 46 H12 Z', C.pale), line('M26 9 L22 46 M32 9 V46 M38 9 L42 46', C.orange, 1.4),
  rect(12, 46, 40, 5, C.brown, 2), ell(32, 9, 12, 3, C.orange),
  txt(32, 36, '愿', 15, C.red),
  path_('M32 61 Q25 54 32 45 Q39 54 32 61 Z', C.orange), path_('M32 59 Q29 55 32 51 Q35 55 32 59 Z', C.yellow)]);
add('alishan-tea-tin', [
  rect(12, 7, 40, 9, C.gold, 3), rect(14, 15, 36, 43, C.green, 3),
  rect(18, 23, 28, 25, C.cream, 3), poly('20,45 28,31 33,39 38,33 44,45', C.jade), circ(39, 28, 2.6, C.orange),
  line('M20 52 H44', C.pale, 2.2), ell(32, 58, 18, 2, C.dgrey)]);

// ---------- Zhejiang ----------
add('oilpaper-umbrella', [
  path_('M5 36 Q32 -8 59 36 Q52 30 45.5 36 Q39 30 32 36 Q25 30 18.5 36 Q12 30 5 36 Z', C.orange),
  line('M32 11 L18.5 34 M32 11 L32 35 M32 11 L45.5 34', C.dred, 1.4), circ(32, 20, 3, C.pale),
  line('M32 35 V54 Q32 60 38 58', C.ink, 5), line('M32 35 V54 Q32 60 38 58', C.brown, 2.6), dot(32, 9, 1.8, C.ink)]);
add('celadon-cup', [
  ell(32, 59, 18, 3, C.pale),
  rect(24, 51, 16, 6, '#9cc7b0', 2),
  path_('M9 21 H55 Q55 49 32 52 Q9 49 9 21 Z', '#b8dcc8'),
  ell(32, 21, 23, 4, '#cfe8da'),
  line('M17 28 Q21 41 32 45 Q43 41 47 28', '#6fa68a', 1.8), line('M25 28 Q28 37 32 40 Q36 37 39 28', '#6fa68a', 1.8),
  line('M13 30 Q15 40 22 46', '#e8f5ee', 2)]);
add('huzhou-brush', [grp(32, [
  rect(29, 6, 6, 34, C.tan, 2), circ(32, 5, 3, C.red), rect(28, 38, 8, 5, C.gold, 1),
  path_('M29 43 H35 Q39 53 32 62 Q25 53 29 43 Z', C.white), path_('M30 54 Q32 63 34 54 Z', C.ink)]),
  blob('M8 50 q6 -5 12 -1 q4 5 -2 9 q-9 3 -10 -8z', C.ink)]);
add('tie-dye-cloth', [
  rect(8, 10, 48, 42, C.blue, 3),
  line('M13 52 V60 M20 52 V59 M27 52 V60 M34 52 V59 M41 52 V60 M48 52 V59', C.blue, 2.2),
  ring(22, 22, 6, C.white), ring(22, 22, 2.4, C.white), ring(43, 22, 6, C.white), ring(43, 22, 2.4, C.white),
  ring(32, 38, 6, C.white), ring(32, 38, 2.4, C.white), ring(16, 43, 3.6, C.white), ring(49, 43, 3.6, C.white),
  dot(32, 17, 1.4, C.white), dot(32, 47, 1.4, C.white)]);

const tr = (x, y, parts) => '<g transform="translate(' + x + ' ' + y + ')">' + parts.join('') + '</g>';

// ---------- Yunnan ----------
add('puer-cake', [
  ell(32, 46, 25, 10, '#4f3322'), rect(7, 38, 50, 8, '#4f3322', 0), ell(32, 38, 25, 10, C.brown),
  ell(32, 38, 20, 7, '#6e4730'),
  dot(18, 37, 1.6, C.tan), dot(26, 42, 1.6, C.tan), dot(40, 41, 1.6, C.tan), dot(46, 36, 1.6, C.tan), dot(33, 33, 1.6, C.tan), dot(24, 34, 1.4, C.tan),
  rect(22, 33, 20, 11, C.cream, 1.5, -6), txt(32, 42, '普洱', 8.5, C.red)]);
add('dongba-sign', [
  line('M20 14 V5 M44 14 V5', C.brown, 2),
  rect(9, 12, 46, 42, C.tan, 4), rect(13, 16, 38, 34, '#e5c89a', 2),
  ring(22, 25, 4, '#5a3a26', 2), line('M22 17 v-1.5 M22 33 v1.5 M14 25 h-1.5 M30 25 h1.5', '#5a3a26', 1.8),
  circ(41, 22, 2.8, '#5a3a26'), line('M41 25 V34 M41 28 L36 31 M41 28 L46 31 M41 34 L37 40 M41 34 L45 40', '#5a3a26', 2),
  line('M17 42 q3 -4 6 0 t6 0 t6 0', '#5a3a26', 2), path_('M38 45 Q45 41 50 44 Q45 47 38 45 Z', '#5a3a26')]);

// ---------- Xizang ----------
add('prayer-wheel', [
  rect(29, 38, 6, 22, C.brown, 2),
  path_('M23 14 L32 4 L41 14 Z', C.gold),
  rect(16, 14, 32, 26, C.gold, 5), rect(16, 22, 32, 10, C.red, 0), dot(23, 27, 1.8, C.gold), dot(32, 27, 1.8, C.gold), dot(41, 27, 1.8, C.gold),
  line('M48 28 Q58 28 57 36', C.ink, 1.8), circ(57, 40, 3.4, C.gold)]);
add('khata', [
  rect(8, 10, 10, 42, C.white, 1.5), rect(46, 10, 10, 42, C.white, 1.5),
  line('M10 52 v6 M13 52 v6 M16 52 v6 M48 52 v6 M51 52 v6 M54 52 v6', C.ink, 1.5),
  poly('13,22 16,27 13,32 10,27', C.gold), poly('51,22 54,27 51,32 48,27', C.gold),
  path_('M8 10 Q32 40 56 10 L56 21 Q32 51 8 21 Z', C.white), line('M14 18 Q32 38 50 18', C.sky, 2.2)]);
add('tibetan-bowl', [
  rect(22, 52, 20, 7, C.grey, 2),
  path_('M7 26 H57 Q57 51 32 53 Q7 51 7 26 Z', C.brown), line('M8 33 Q32 40 56 33', C.grey, 2.6),
  ell(32, 26, 25, 6, C.tan), ell(32, 25, 18, 3.4, C.cream), path_('M17 25 Q32 8 47 25 Q32 28 17 25 Z', C.pale)]);

// ---------- Xinjiang ----------
add('atlas-scarf', [
  rect(10, 6, 44, 46, C.navy, 2),
  ...[[20, 16, C.red], [44, 16, C.yellow], [32, 28, C.teal], [20, 40, C.yellow], [44, 40, C.red]].map((d) => poly((d[0]) + ',' + (d[1] - 7) + ' ' + (d[0] + 7) + ',' + d[1] + ' ' + d[0] + ',' + (d[1] + 7) + ' ' + (d[0] - 7) + ',' + d[1], d[2])),
  line('M10 49 H54', C.pale, 1.6),
  line('M13 52 v8 M18 52 v8 M23 52 v8 M28 52 v8 M33 52 v8 M38 52 v8 M43 52 v8 M48 52 v8', C.ink, 1.6)]);
add('doppa', [
  path_('M9 42 Q8 12 32 10 Q56 12 55 42 Z', C.black),
  ring(32, 27, 7, C.white, 1.8), ring(32, 27, 2.6, C.gold, 1.8), line('M14 36 Q18 22 26 22 M50 36 Q46 22 38 22', C.white, 1.6),
  dot(32, 15, 1.6, C.pale), dot(21, 18, 1.4, C.pale), dot(43, 18, 1.4, C.pale),
  rect(7, 40, 50, 14, C.red, 3), dot(14, 47, 2, C.gold), dot(23, 47, 2, C.gold), dot(32, 47, 2, C.gold), dot(41, 47, 2, C.gold), dot(50, 47, 2, C.gold)]);
add('rawap', [grp(22, [
  rect(30, 3, 4, 34, C.tan, 1.5), path_('M29 8 Q22 3 22 10 Q22 16 29 14 Z', C.brown),
  line('M30.5 12 V46 M33.5 12 V46', C.ink, 0.9),
  ell(32, 47, 13, 13, C.brown), circ(32, 47, 8.4, C.cream), dot(27.5, 45, 1.3), dot(36.5, 45, 1.3), dot(32, 41.5, 1.3), dot(32, 52.5, 1.3),
  rect(27, 49, 10, 2.4, C.tan, 1)])]);

// ---------- Shaanxi ----------
add('terracotta-warrior', [
  rect(17, 57, 30, 5, '#8a6445', 2), rect(23, 44, 18, 14, '#c28f64', 3),
  ell(15.5, 37, 4, 10, '#c28f64', 14), ell(48.5, 33, 4, 10, '#c28f64', -22),
  rect(19, 25, 26, 22, '#c28f64', 4),
  ...[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => dot(24.5 + c * 5, 31 + r * 5.5, 1.5, '#8a6445'))).flat(),
  circ(32, 17, 8.5, '#d19c72'), circ(32, 8.4, 3.8, '#8a6445'), path_('M23.5 15 Q32 7 40.5 15 Q32 12 23.5 15 Z', '#8a6445'),
  line('M27 18 h3 M34 18 h3', C.ink, 1.6), line('M28 23 Q32 21 36 23', C.ink, 1.8)]);
add('shadow-puppet', [
  line('M32 40 V62', C.brown, 2), line('M20 34 L8 22', C.brown, 1.6),
  path_('M19 56 Q17 31 32 25 Q47 31 45 56 Z', '#e8a06a'),
  circ(27, 38, 3, C.cream), circ(37, 38, 3, C.cream), circ(32, 47, 3.4, C.cream), line('M21 53 H43', C.red, 2.4),
  path_('M25 15 Q32 3 41 14 L41 19 H25 Z', '#e8a06a'), path_('M22 14 Q32 -1 43 12 Q32 9 22 14 Z', C.red), circ(32, 6.5, 2.3, C.gold),
  path_('M26 20 H40 L43 24 L40 27 Q33 30 27 26 Z', '#e8a06a'), dot(35, 22.5, 1.3), line('M36 26 q2 1 4 0', C.ink, 1.2)]);
add('wild-goose-pagoda', [
  rect(8, 56, 48, 5, '#7a5638', 1.5),
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const w = 34 - i * 3.6, y = 50 - i * 6.6; return rect(32 - w / 2, y, w, 7, '#b9825a', 1) + line('M' + (32 - w / 2 - 1.6) + ' ' + (y + 0.4) + ' H' + (32 + w / 2 + 1.6), '#7a5638', 2.4); }),
  path_('M28 56 V47.5 Q32 43 36 47.5 V56 Z', C.ink),
  poly('32,1 29,8 35,8', C.gold)]);

// ---------- Hong Kong ----------
add('rwb-bag', [
  line('M20 18 Q20 4 32 4 Q44 4 44 18', C.ink, 3),
  '<defs><clipPath id="rwbc"><rect x="8" y="16" width="48" height="40" rx="4"/></clipPath></defs>',
  rect(8, 16, 48, 40, C.white, 4),
  '<g clip-path="url(#rwbc)">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => poly((k * 9 - 12) + ',16 ' + (k * 9 - 6) + ',16 ' + (k * 9 + 14) + ',56 ' + (k * 9 + 8) + ',56', k % 3 === 0 ? C.red : (k % 3 === 1 ? C.white : C.blue)).replace(/ stroke="[^"]*" stroke-width="[^"]*"/, ' stroke="none"')).join('') + '</g>',
  '<rect x="8" y="16" width="48" height="40" rx="4" fill="none" stroke="' + C.ink + '" stroke-width="2"/>']);
add('tram', [
  line('M32 9 L42 2', C.ink, 2), line('M3 61 H61', C.dgrey, 2),
  rect(10, 8, 44, 5, C.dgrey, 2), rect(12, 12, 40, 18, C.green, 3), rect(8, 28, 48, 25, C.green, 3),
  ...[0, 1, 2, 3].map((i) => rect(15.5 + i * 9.5, 15.5, 7, 9, C.sky, 1.5) + rect(13.5 + i * 10.5, 33, 8, 11, C.sky, 1.5)),
  line('M9 30 H55', C.pale, 2.4), rect(26, 46, 12, 3, C.pale, 1), circ(19, 56, 4.4, C.dgrey), circ(45, 56, 4.4, C.dgrey)]);
add('bird-cage', [
  line('M32 1 V9', C.ink, 2),
  path_('M12 52 Q8 14 32 11 Q56 14 52 52 Z', C.cream),
  ell(32, 40, 8, 5.4, C.yellow), circ(39.5, 34.5, 4, C.yellow), poly('43.4,34 47,35.6 43.4,37', C.orange), dot(40.6, 33.6, 1.1),
  poly('24.6,39 17,41 24,44', C.orange),
  line('M32 11 V52 M32 11 Q22 24 22 52 M32 11 Q42 24 42 52 M32 11 Q15 26 15 52 M32 11 Q49 26 49 52', C.brown, 2),
  rect(9, 50, 46, 7, C.brown, 2), circ(32, 9, 3, C.gold)]);

// ---------- Fujian ----------
add('tulou', [
  path_('M5 33 V48 Q5 59 32 59 Q59 59 59 48 V33 Z', '#b57b4d'),
  ell(32, 33, 27, 12, C.dred), ell(32, 34, 17, 6.4, C.pale), ell(32, 34.5, 7, 2.8, '#b57b4d'), ell(32, 33, 10, 4, C.dred),
  ...[[12, 44], [20, 49], [44, 49], [52, 44], [12, 51], [52, 51]].map((p) => rect(p[0] - 1.6, p[1] - 1.6, 3.2, 3.8, C.ink, 0.6)),
  path_('M27 59 V50 Q32 45 37 50 V59 Z', C.ink)]);
add('shoushan-seal', [
  rect(18, 24, 28, 24, '#d9a066', 3), line('M21 30 Q30 26 43 32 M21 38 Q32 33 43 41', '#f1c88f', 2), line('M24 45 Q34 40 43 46', '#b8783e', 1.6),
  path_('M23 24 Q23 7 32 7 Q41 7 41 24 Z', '#e8b27a'), dot(28.5, 15, 1.5), dot(35.5, 15, 1.5), line('M29 20 q3 2 6 0', C.ink, 1.4),
  rect(20, 49, 24, 12, C.red, 1.5), txt(32, 59.4, '印', 10, C.cream)]);
add('gongfu-tea', [
  rect(5, 51, 54, 7, C.brown, 3),
  line('M10 40 Q3 42 9 49', C.ink, 6), line('M10 40 Q3 42 9 49', '#a4533e', 2.8),
  path_('M30 40 L38 32 L40 35 L31 45 Z', '#a4533e'),
  ell(20, 42, 11, 9, '#a4533e'), ell(20, 34, 6, 2.6, '#8c4331'), circ(20, 30.5, 2, '#a4533e'),
  path_('M39 41 H51 Q51 50 45 51 Q39 50 39 41 Z', C.white), line('M40 45 H50', C.blue, 1.6),
  path_('M51 45 H60 Q60 51 55.5 51.6 Q51 51 51 45 Z', C.white)]);

// ---------- Shandong ----------
add('bamboo-slips', [
  ...[0, 1, 2, 3, 4, 5].map((i) => rect(8 + i * 8, 7, 7.4, 50, '#d8b878', 2.4) + line('M' + (11.7 + i * 8) + ' 14 v2 M' + (11.7 + i * 8) + ' 19 v3 M' + (11.7 + i * 8) + ' 27 v2.4 M' + (11.7 + i * 8) + ' 33 v3 M' + (11.7 + i * 8) + ' 42 v2.4 M' + (11.7 + i * 8) + ' 48 v3', C.brown, 1.5)),
  line('M6 22 H58', C.dred, 2.6), line('M6 43 H58', C.dred, 2.6)]);
add('kite', [
  poly('32,3 53,24 32,46 11,24', C.red),
  poly('32,3 53,24 32,24', C.yellow), poly('11,24 32,24 32,46', C.blue),
  poly('32,3 53,24 32,46 11,24', 'none'),
  line('M32 3 V46 M11 24 H53', C.ink, 1.6), circ(32, 24, 3.6, C.white),
  line('M32 46 q-7 4 0 8 q7 4 0 8', C.dgrey, 1.8), dot(27, 50, 2.6, C.orange), dot(37, 56, 2.6, C.jade), dot(28, 60, 2.2, C.pink)]);

// ---------- Macau ----------
add('st-pauls-facade', [
  rect(9, 28, 46, 31, '#cfc8b8', 2), poly('7,28 32,5 57,28', '#cfc8b8'),
  ring(32, 20, 5, C.ink, 2), dot(32, 20, 1.6),
  ...[14, 24, 40, 50].map((x) => rect(x - 1.3, 30, 2.6, 28, '#b3ab97', 0.6)),
  ...[17, 32, 47].map((x) => path_('M' + (x - 3.4) + ' 40 V35 Q' + x + ' 30 ' + (x + 3.4) + ' 35 V40 Z', C.ink)),
  path_('M27 59 V50 Q32 43.4 37 50 V59 Z', C.ink), path_('M12.6 59 V51 Q16 46 19.4 51 V59 Z', C.ink), path_('M44.6 59 V51 Q48 46 51.4 51 V59 Z', C.ink),
  line('M32 5 V1.5 M30 3.2 H34', C.ink, 1.6), rect(6, 59, 52, 3.4, '#9d9684', 1)]);
add('almond-cookie-tin', [
  rect(10, 19, 44, 37, C.red, 4), rect(8, 12, 48, 9, C.dred, 3), line('M12 52 H52', C.gold, 2),
  circ(32, 36, 11, C.pale), ell(32, 36, 3.4, 5, C.tan), line('M25 31 l4 3 M39 31 l-4 3 M25 42 l4 -3 M39 42 l-4 -3', C.brown, 1.4),
  dot(15, 26, 1.6, C.gold), dot(49, 26, 1.6, C.gold)]);

// ---------- Singapore ----------
add('orchid-brooch', [
  ell(32, 15, 7, 11, '#d97fb0'), ell(18, 27, 11, 7, '#d97fb0', -18), ell(46, 27, 11, 7, '#d97fb0', 18),
  ell(23, 42, 7.4, 11, '#e59cc4', 24), ell(41, 42, 7.4, 11, '#e59cc4', -24),
  ell(32, 33, 6.4, 8, C.purple), circ(32, 27, 3, C.yellow), line('M32 38 V41', C.pale, 1.8),
  dot(18, 27, 1.2, C.purple), dot(46, 27, 1.2, C.purple), dot(32, 13, 1.2, C.purple),
  rect(26, 55, 12, 4, C.gold, 2)]);
const slipper = () => [
  path_('M4 50 Q3 31 16 26 L26 26 Q30 40 28 54 Q14 57 4 50 Z', C.pink),
  path_('M9 44 Q10 33 17 31 L24 31 Q27 40 26 50 Q16 51 9 44 Z', C.cream),
  dot(15, 38, 2.2, C.red), dot(21, 36, 2.2, C.blue), dot(20, 43, 2.2, C.green), dot(14, 45, 1.8, C.yellow), dot(25, 44, 1.6, C.purple), dot(18, 31, 1.6, C.green)];
add('nyonya-slippers', [tr(2, 6, slipper()), tr(29, 2, slipper())]);

// ---------- Shaanxi / Henan / Hunan ----------
add('tang-sancai', [
  rect(8, 56, 48, 5, C.cream, 2),
  path_('M12 33 Q8 40 12 47 L16 45 Q18 40 17 36 Z', C.green),
  rect(16, 43, 5, 14, C.pale, 1.6), rect(24, 44, 5, 13, C.cream, 1.6), rect(37, 44, 5, 13, C.cream, 1.6), rect(45, 42, 5, 15, C.pale, 1.6),
  ell(32, 36, 19, 9.5, C.orange),
  path_('M43 33 L47 13 L55 11 L58 18 L53 22 L52 36 Z', C.orange),
  path_('M47 13 L52 5 L53 12 Z', C.orange), line('M47 14 Q43 22 41 32', C.green, 3.4),
  path_('M54 11 L61 16 L61 23 L53 22 Z', C.pale), dot(54.4, 15.5, 1.3),
  rect(25, 28, 13, 12, C.green, 3), line('M25 34 H38', C.pale, 1.8)]);
add('oracle-bone', [
  path_('M15 8 Q40 3 52 15 Q60 36 47 55 Q26 61 12 48 Q5 28 15 8 Z', '#e8d7a8'),
  path_('M15 8 Q40 3 52 15', 'none'),
  line('M32 12 V52 M32 26 L44 20 M32 38 L22 34', C.brown, 2.2),
  line('M20 18 v8 M16.4 22 h7.2', C.brown, 2), line('M42 36 h8 M46 31 v10', C.brown, 2), line('M17 44 l6 -3 M20 40 l0 8', C.brown, 2), line('M42 48 q4 -4 8 0', C.brown, 2)]);
add('chili-string', [
  line('M7 8 Q32 0 57 8', C.ink, 2.4),
  ...[[10, 9.4, 14], [19, 6.8, 6], [28, 5.4, 0], [37, 5.4, -4], [46, 6.8, -8], [54, 8.6, -16]].map((c, i) => ell(c[0] + 2, c[1] + 17 - (i % 2) * 2, 4.2, 14 - (i % 2) * 2, C.red, c[2] * 0.6) + rect(c[0] - 1.4, c[1] - 1, 4.4, 5, C.green, 1.4)),
  line('M12 24 q1 4 0 8 M30 22 q1 4 0 9 M48 24 q1 4 -1 8', C.pink, 1.5)]);

// ---------- Hunan / Guizhou / Guangxi ----------
add('yuelu-scroll', [
  line('M20 6 Q32 -3 44 6', C.ink, 2),
  rect(10, 7, 44, 50, C.red, 1.5), rect(15, 13, 34, 38, C.cream, 1),
  rect(6, 4, 52, 6, C.brown, 3), rect(6, 54, 52, 6, C.brown, 3),
  txt(32, 40, '书', 26, C.ink), line('M20 22 Q26 18 32 22', C.ink, 1.8)]);
add('miao-silver', [
  '<ellipse cx="32" cy="26" rx="23" ry="16" fill="none" stroke="' + C.ink + '" stroke-width="12"/>',
  '<ellipse cx="32" cy="26" rx="23" ry="16" fill="none" stroke="#d3dadf" stroke-width="8"/>',
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => dot((32 + 23 * Math.cos(i * Math.PI / 6)).toFixed(1), (26 + 16 * Math.sin(i * Math.PI / 6)).toFixed(1), 1.5, C.dgrey)),
  line('M20 45 V51 M32 48 V54 M44 45 V51', C.ink, 1.6), circ(20, 54, 3.6, C.grey), circ(32, 57.5, 3.6, C.grey), circ(44, 54, 3.6, C.grey)]);
add('lusheng', [
  path_('M11 47 H53 L46 58 H18 Z', C.brown), rect(29, 57, 6, 6, C.tan, 2),
  ...[[10, 28], [18, 17], [26, 7], [34, 17], [42, 28], [50, 38]].map((p) => rect(p[0], p[1], 6.4, 47 - p[1], '#d8b878', 3)),
  line('M8 42 H58', C.red, 2.6), line('M8 37 H58', C.dred, 1.4)]);
add('zhuang-ball', [
  line('M32 11 V5', C.ink, 2), circ(32, 4, 2.6, C.gold),
  line('M24 44 L22 60', C.red, 2.6), line('M28 46 L28 62', C.yellow, 2.6), line('M32 46 V62', C.blue, 2.6), line('M36 46 L36 62', C.green, 2.6), line('M40 44 L42 60', C.pink, 2.6),
  circ(32, 28, 18, C.red), ring(32, 28, 11, C.gold, 2), ring(32, 28, 4.6, C.gold, 2),
  line('M32 10 V46 M14 28 H50', C.gold, 1.6),
  ...[[22.5, 18.5, C.blue], [41.5, 18.5, C.green], [22.5, 37.5, C.yellow], [41.5, 37.5, C.pink]].map((d) => circ(d[0], d[1], 3, d[2]))]);
add('luosifen-pack', [
  rect(10, 8, 44, 50, '#e9a15a', 3), rect(10, 8, 44, 6, '#d98a3a', 1.5), rect(10, 52, 44, 6, '#d98a3a', 1.5),
  line('M14 8.5 v5 M19 8.5 v5 M24 8.5 v5 M29 8.5 v5 M34 8.5 v5 M39 8.5 v5 M44 8.5 v5 M49 8.5 v5', '#b86a22', 1.2),
  txt(32, 28, '螺蛳粉', 10, C.red),
  path_('M17 35 H47 Q47 47 32 48.5 Q17 47 17 35 Z', C.white), ell(32, 35, 15, 3.4, C.red), dot(25, 34.6, 1.5, C.green), dot(33, 35.4, 1.5, C.yellow), dot(39, 34.4, 1.5, C.brown)]);

// ---------- Gansu / Jiangxi / Hubei ----------
add('luminous-cup', [
  ell(32, 54, 15, 4.6, '#7fcf9d'), rect(29.4, 33, 5.2, 21, '#7fcf9d', 2),
  path_('M13 10 H51 Q51 34 32 36 Q13 34 13 10 Z', '#7fcf9d'),
  ell(32, 10, 19, 3.6, '#c4efd5'), line('M18 16 Q19 26 26 31', '#e6fbef', 2.2),
  line('M56 6 v7 M52.5 9.5 h7', C.gold, 2), line('M8 20 v5 M5.5 22.5 h5', C.gold, 1.6)]);
add('flying-apsara', [
  line('M6 46 Q18 58 30 44 T58 42', C.ink, 7.4), line('M6 46 Q18 58 30 44 T58 42', C.teal, 4.4),
  line('M8 12 Q22 2 33 14 T59 16', C.ink, 7.4), line('M8 12 Q22 2 33 14 T59 16', C.red, 4.4),
  path_('M30 33 Q43 29 57 38 Q46 50 31 44 Z', C.orange),
  line('M26 30 L12 38', C.skin, 5.2), ell(29, 31, 7.4, 8.4, C.skin, -22),
  circ(22, 21, 6.6, C.skin), path_('M15 20 Q22 9 29.4 17 Q22 14 15 20 Z', C.black), circ(22, 11.5, 3.2, C.black),
  dot(24, 22, 1.1), line('M20.5 26 q2 1.4 4 0', C.ink, 1.2)]);
add('blue-white-vase', [
  path_('M25 5 H39 V11 Q55 15 55 33 Q55 47 45 58 H19 Q9 47 9 33 Q9 15 25 11 Z', C.white),
  ell(32, 5, 7, 1.8, C.cream), line('M10.5 28 Q32 35 53.5 28', C.blue, 2.6), line('M12 47 Q32 54 52 47', C.blue, 2.6),
  circ(32, 20, 4.4, C.blue), circ(32, 20, 1.6, C.white), circ(22, 24, 2.6, C.blue), circ(42, 24, 2.6, C.blue),
  line('M14 38 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0', C.blue, 1.8)]);
add('shaiqiu', [
  rect(6, 9, 52, 52, C.cream, 2), line('M6 37 H58', C.brown, 4),
  circ(20, 21, 12.4, '#d9a85b'), circ(20, 21, 9.6, C.red), dot(15, 18, 1.5, C.dred), dot(22, 16, 1.5, C.dred), dot(24, 24, 1.5, C.dred), dot(16, 26, 1.5, C.dred),
  circ(44, 21, 12.4, '#d9a85b'), circ(44, 21, 9.6, C.yellow), dot(40, 17, 1.5, C.orange), dot(47, 19, 1.5, C.orange), dot(43, 26, 1.5, C.orange), dot(49, 25, 1.5, C.orange),
  line('M17 38 V43 M31 38 V44 M45 38 V43', C.ink, 1.6),
  ell(17, 49, 3.8, 6.6, C.yellow), ell(31, 50, 3.8, 6.6, C.orange), ell(45, 49, 3.8, 6.6, C.yellow)]);
add('bianzhong', [
  rect(3, 56, 58, 5, C.brown, 2), rect(4, 8, 5, 50, C.dred, 2), rect(55, 8, 5, 50, C.dred, 2), rect(4, 8, 56, 6, C.dred, 2.4),
  ...[[16, 1], [28, 0.88], [39, 0.76], [49, 0.64]].map((b) => line('M' + b[0] + ' 14 V17', C.ink, 1.6) + '<g transform="translate(' + b[0] + ' 17) scale(' + b[1] + ')">' + path_('M-3 0 H3 L4 3 Q8 11 8 20 Q4 23 0 23 Q-4 23 -8 20 Q-8 11 -4 3 Z', C.bronze) + line('M-6.4 14 Q0 17 6.4 14', C.ink, 1.4) + '</g>')]);

// ---------- Inner Mongolia / Shanxi / Liaoning ----------
add('morin-khuur', ['<g transform="translate(4 6) scale(0.9)">', grp(10, [
  poly('19,33 45,33 50,61 14,61', C.brown), poly('22,36 42,36 46,58 18,58', C.tan),
  rect(29.4, 14, 5.2, 22, C.brown, 1.6),
  path_('M28 16 Q24 9 25 4 Q27 -1 34 1 L41 5 L37 9 Q35 7.4 33.6 9.4 L34.6 16 Z', C.brown), poly('27,3 26,-2 31,1', C.brown), dot(32, 4.4, 1.3, C.cream), line('M25 5 Q20 10 23 16', C.tan, 2.6),
  line('M31 36 V58 M33.4 36 V58', C.ink, 1), rect(26, 47, 12, 2.6, C.brown, 1), line('M26 41 q2 2 0 5 M38 41 q-2 2 0 5', C.brown, 1.6)]), '</g>']);
add('yurt', [
  path_('M5 35 Q32 2 59 35 Z', C.white), line('M32 8 L13 34 M32 8 L51 34 M32 8 V34', C.grey, 1.4),
  rect(8, 34, 48, 21, C.white, 2), line('M8 38 H56', C.blue, 3), line('M8 53 H56', C.blue, 3),
  rect(26, 40, 12, 15, C.orange, 2), line('M32 40 V55', C.dred, 1.4), dot(30, 48, 1, C.dred), dot(34, 48, 1, C.dred),
  ell(32, 9, 6, 2.2, C.dgrey), line('M3 59 H61', C.green, 3)]);
add('vinegar-bottle', [
  path_('M26 5 H38 V12 Q50 18 50 32 V57 Q50 61 46 61 H18 Q14 61 14 57 V32 Q14 18 26 12 Z', '#5a3a30'),
  rect(25, 2, 14, 6, C.red, 2), rect(18, 31, 28, 20, C.cream, 2), txt(32, 47, '醋', 16, C.red),
  line('M19 22 Q19 17 24 15', '#a37a68', 2)]);
add('lacquer-box', [
  rect(8, 28, 48, 28, C.red, 4), rect(6, 14, 52, 16, C.dred, 4),
  circ(32, 22, 4.6, C.gold), line('M10 22 H24 M40 22 H54', C.gold, 2), line('M10 18 q4 -3 8 0 M46 18 q4 -3 8 0', C.gold, 1.6),
  circ(32, 33, 3, C.gold), line('M12 44 q5 -5 10 0 t10 0 t10 0 t10 0', C.gold, 2)]);
const jadePath = (cx, cy, R, r) => 'M' + (cx - R) + ' ' + cy + ' a' + R + ' ' + R + ' 0 1 0 ' + (2 * R) + ' 0 a' + R + ' ' + R + ' 0 1 0 ' + (-2 * R) + ' 0 Z M' + (cx - r) + ' ' + cy + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 Z';
add('xiuyan-jade', [
  line('M32 18 V9 Q32 3 26.5 3 M32 9 Q32 3 37.5 3', C.red, 2.4), line('M32 55 V62', C.red, 2.6),
  '<path d="' + jadePath(32, 37, 20, 6.4) + '" fill-rule="evenodd" ' + sty('#8fd0a8') + '/>',
  line('M16 32 Q19 24 27 21', '#d6f2e0', 2.4), line('M45 46 Q41 52 36 54', '#5fa57c', 1.8), line('M40 26 Q47 31 48 38', '#5fa57c', 1.4)]);

// ---------- Jilin / Heilongjiang / Hainan / Anhui / Ningxia / Qinghai ----------
add('red-handkerchief', [grp(18, [
  rect(11, 11, 42, 42, C.red, 3), '<rect x="16" y="16" width="32" height="32" fill="none" stroke="' + C.gold + '" stroke-width="2" stroke-dasharray="3 3"/>',
  circ(32, 32, 6, C.gold), circ(32, 22, 3, C.pink), circ(32, 42, 3, C.pink), circ(22, 32, 3, C.pink), circ(42, 32, 3, C.pink), circ(32, 32, 2.4, C.red)])]);
add('ice-lantern', [
  path_('M13 57 L15 22 Q32 8 49 22 L51 57 Z', '#cfeaf7'),
  path_('M23 53 V30 Q32 22 41 30 V53 Z', '#f4fbff'),
  path_('M32 49 Q26 41 32 31 Q38 41 32 49 Z', C.orange), path_('M32 47 Q29 42 32 37 Q35 42 32 47 Z', C.yellow),
  line('M18 26 L17 44', C.white, 2.4), rect(9, 55, 46, 6, '#a9cbe8', 2),
  line('M55 8 v6 M52 11 h6', C.sky, 2), dot(9, 14, 1.6, C.sky)]);
const doll = () => [
  path_('M32 3 Q46 3 46 22 Q56 40 48 57 Q32 62 16 57 Q8 40 18 22 Q18 3 32 3 Z', C.red),
  circ(32, 23, 10, C.skin), path_('M21.4 22 Q22 9 32 9 Q42 9 42.6 22 Q38 15 32 15 Q26 15 21.4 22 Z', C.yellow),
  dot(28, 24, 1.8), dot(36, 24, 1.8), ell(24.5, 29, 2.6, 1.8, C.pink), ell(39.5, 29, 2.6, 1.8, C.pink), line('M29.5 30 q2.5 2 5 0', C.ink, 1.5),
  ell(32, 47, 11, 10, C.cream), circ(32, 45, 4, C.blue), circ(32, 45, 1.6, C.yellow), circ(26, 49, 2.2, C.green), circ(38, 49, 2.2, C.green)];
add('matryoshka', [
  '<g transform="translate(-4 2) scale(0.9)">' + doll().join('') + '</g>',
  '<g transform="translate(38 28) scale(0.48)">' + doll().join('') + '</g>']);
add('coconut-carving', [
  circ(32, 34, 24, '#7b4a2e'),
  line('M12 22 l3 3 M16 14 l2 4 M50 18 l-2 4 M54 30 l-4 1 M12 40 l4 0 M18 52 l3 -3 M46 52 l-3 -3 M52 42 l-4 -1', '#5c3520', 1.6),
  ell(32, 34, 14, 17, C.tan),
  line('M30 51 Q33 40 34 30', C.brown, 2.2),
  line('M34 30 q-8 -2 -12 5 M34 30 q8 -2 12 5 M34 30 q-5 -7 -11 -5 M34 30 q5 -7 11 -5', C.brown, 2),
  circ(37.5, 41, 2, C.cream)]);
add('li-brocade', [
  line('M12 48 v11 M18 48 v11 M24 48 v11 M30 48 v11 M36 48 v11 M42 48 v11 M48 48 v11', C.ink, 1.6),
  rect(6, 10, 52, 40, C.dred, 2), rect(6, 10, 52, 6, C.black, 1.5), rect(6, 44, 52, 6, C.black, 1.5),
  line('M8 29 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6 l5 -6', C.gold, 2.2),
  ...[13, 26, 39, 51].map((x) => poly(x + ',33 ' + (x + 4.4) + ',37.4 ' + x + ',41.8 ' + (x - 4.4) + ',37.4', C.pale))]);
add('hui-ink', [
  rect(15, 6, 34, 52, C.black, 3), '<rect x="19" y="10" width="26" height="44" fill="none" stroke="' + C.gold + '" stroke-width="1.6"/>',
  txt(32, 29, '徽', 13, C.gold), txt(32, 47, '墨', 13, C.gold), line('M20 14 v8', '#6a7680', 2)]);
add('iron-painting', [
  rect(8, 5, 48, 54, C.brown, 2), rect(12, 9, 40, 46, C.cream, 1),
  line('M16 50 Q25 38 33 34 Q42 30 47 15', C.ink, 3.6), line('M33 34 Q36 44 44 47 M38 28 Q33 22 29 22 M42 21 Q47 25 50 24', C.ink, 2.4),
  circ(29, 22, 2.8, C.pink), circ(44, 47, 2.8, C.pink), circ(50, 24, 2.8, C.pink), circ(47, 15, 2.8, C.pink), circ(25, 41, 2.6, C.pink)]);
add('ginseng', [
  ell(32, 10, 3, 6, C.green), ell(24, 13, 3, 6, C.green, -38), ell(40, 13, 3, 6, C.green, 38), dot(32, 4, 2.2, C.red),
  line('M32 14 V22', C.green, 2),
  line('M27 28 Q17 29 12 39', C.ink, 6.4), line('M27 28 Q17 29 12 39', '#e8cf9a', 4),
  line('M37 28 Q47 29 51 37', C.ink, 6.4), line('M37 28 Q47 29 51 37', '#e8cf9a', 4),
  line('M29 40 Q26 50 21 60', C.ink, 6.4), line('M29 40 Q26 50 21 60', '#e8cf9a', 4),
  line('M35 40 Q38 50 44 60', C.ink, 6.4), line('M35 40 Q38 50 44 60', '#e8cf9a', 4),
  ell(32, 31, 8, 12.4, '#e8cf9a'),
  line('M26.4 24 h11 M25.8 29 h12 M26.4 34 h11', '#b99a58', 1.4), line('M12 39 l-3 3 M21 60 l-3 2 M44 60 l3 2', C.brown, 1.4)]);
add('goji-pouch', [
  ell(23, 19, 3.2, 5.4, C.red, 30), ell(31, 15, 3.2, 5.4, C.red, -10), ell(39, 18, 3.2, 5.4, C.red, 20), ell(28, 21, 3.2, 5.4, C.red, 80), ell(36, 22, 3.2, 5.4, C.red, -40),
  path_('M18 24 Q8 42 13 55 Q32 62 51 55 Q56 42 46 24 Z', '#d8b878'),
  rect(20, 21, 24, 6, C.gold, 3), line('M44 24 Q54 22 55 30', C.gold, 2.2), circ(55, 33, 2.4, C.red),
  circ(32, 42, 8, C.red), txt(32, 46, '杞', 11, C.cream)]);
add('salt-crystal', [
  ell(32, 58, 25, 3.6, C.grey),
  poly('9,57 9,36 16,26 24,36 24,57', '#e8f4fa'), poly('40,57 40,38 48,27 55,38 55,57', '#e8f4fa'),
  poly('21,57 21,24 32,7 43,24 43,57', C.white),
  line('M32 7 V57 M21 24 L32 30 L43 24', C.sky, 1.8), line('M16 26 V57', C.sky, 1.4), line('M48 27 V57', C.sky, 1.4), line('M27 18 L26 46', '#c4e0ef', 2.2)]);

// END OF ICONS

const out = path.join(__dirname, '..', 'content', 'souvenir-art.json');
if (require.main === module) {
  fs.writeFileSync(out, JSON.stringify(ART, null, 1) + '\n');
  console.log('wrote ' + Object.keys(ART).length + ' icons to content/souvenir-art.json');
}
module.exports = { ART };
