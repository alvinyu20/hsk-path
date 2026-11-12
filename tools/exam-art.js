#!/usr/bin/env node
/* Pictures for the mock exams and tests: small flat drawings that stand in for the emoji (all drawn here from simple shapes).
 *   node tools/exam-art.js     writes data/exam-art.js   (window.SHANLU_EXAM_ART = { "🍎": { a: "an apple", u: "data:image/svg+xml;..." }, ... })
 * The key is the emoji the exam data uses (without the variation selector). Pictures of 2 or 3 of the same thing (🍎🍎🍎) are made from the single one.
 * Style: 64 x 64, one dark outline, soft flat fills; the same look as the souvenirs.
 */
const fs = require('fs');
const path = require('path');
const { C, rect, circ, ell, path_, poly, line, dot, blob, txt, ring, grp, tr } = require('./art-kit.js');

const ART = {};
const BASE = {};
const add = (key, alt, parts) => { BASE[key] = parts.join(''); ART[key] = { a: alt, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + parts.join('') + '</svg>' }; };
const same = (key, from) => { ART[key] = ART[from]; BASE[key] = BASE[from]; };
const clock = (key, alt, h, m) => {
  const ang = (a, r) => [32 + r * Math.sin(a), 32 - r * Math.cos(a)].map((v) => v.toFixed(1));
  const ha = ((h % 12) + m / 60) * Math.PI / 6, ma = m * Math.PI / 30;
  const hp = ang(ha, 13), mp = ang(ma, 19);
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => { const a = i * Math.PI / 6, p = ang(a, 22), q = ang(a, i % 3 ? 24 : 26); return line('M' + p[0] + ' ' + p[1] + ' L' + q[0] + ' ' + q[1], C.ink, i % 3 ? 1.4 : 2.4); }).join('');
  add(key, alt, [circ(32, 32, 28, C.white), circ(32, 32, 28, 'none').replace('fill="none"', 'fill="none"'), ticks, line('M32 32 L' + hp[0] + ' ' + hp[1], C.ink, 4.2), line('M32 32 L' + mp[0] + ' ' + mp[1], C.red, 2.6), dot(32, 32, 2.6, C.ink)]);
};

add('📞', 'a telephone handset', [
  line('M18 20 Q18 46 46 46', C.ink, 15), line('M18 20 Q18 46 46 46', C.dgrey, 10),
  rect(8, 10, 20, 13, C.red, 5), rect(36, 40, 20, 13, C.red, 5),
  line('M44 12 q7 3 8 11', C.blue, 2.4), line('M40 6 q12 5 14 19', C.blue, 2.4)]);
add('🍚', 'a bowl of rice', [
  line('M38 4 L53 26', C.brown, 3.4), line('M45 2 L59 22', C.brown, 3.4),
  path_('M11 30 Q12 10 32 9 Q52 10 53 30 Z', C.white),
  line('M22 20 l3 2 M32 15 l3 2 M40 23 l3 2 M26 27 l3 1 M44 29 l2 0', C.grey, 1.8),
  path_('M7 30 H57 Q57 54 32 57 Q7 54 7 30 Z', C.blue), line('M12 38 Q32 46 52 38', C.sky, 2), rect(23, 54, 18, 5, C.dgrey, 2)]);
add('🌧️', 'a rain cloud', [
  path_('M16 38 Q5 38 7 28 Q9 20 19 22 Q21 8 34 9 Q47 9 48 22 Q59 22 58 31 Q58 38 50 38 Z', C.grey),
  line('M18 44 l-3 8 M30 44 l-3 8 M42 44 l-3 8 M24 54 l-2 6 M36 54 l-2 6 M48 54 l-2 6', C.blue, 3.2)]);
add('📖', 'an open book', [
  path_('M32 16 Q18 9 5 13 V52 Q18 48 32 54 Q46 48 59 52 V13 Q46 9 32 16 Z', C.white),
  line('M32 16 V54', C.ink, 2), line('M11 22 Q19 20 26 23 M11 30 Q19 28 26 31 M11 38 Q19 36 26 39', C.grey, 2), line('M38 23 Q45 20 53 22 M38 31 Q45 28 53 30 M38 39 Q45 36 53 38', C.grey, 2),
  line('M5 52 Q18 56 32 58 Q46 56 59 52', C.red, 3)]);
add('🚗', 'a car', [
  path_('M4 44 V38 Q4 33 10 32 L15 23 Q17 20 21 20 H42 Q46 20 49 23 L55 32 Q60 33 60 39 V44 Z', C.red),
  path_('M18 24 H30 V32 H13 Z', C.sky), path_('M33 24 H42 Q44 24 46 27 L50 32 H33 Z', C.sky),
  line('M32 24 V44', C.dred, 1.6), rect(54, 36, 5, 4, C.yellow, 1.5), rect(4, 38, 4, 4, C.orange, 1.5),
  circ(17, 46, 7, C.black), circ(17, 46, 3, C.grey), circ(47, 46, 7, C.black), circ(47, 46, 3, C.grey)]);
add('😴', 'a sleeping face', [
  circ(28, 38, 21, C.yellow), line('M15 35 q5 4 10 0 M31 35 q5 4 10 0', C.ink, 2.2), ell(27, 48, 3, 2.4, C.ink),
  ell(14, 42, 3.4, 2.2, C.pink), ell(41, 42, 3.4, 2.2, C.pink),
  txt(50, 16, 'Z', 13, C.blue), txt(42, 28, 'z', 10, C.blue), txt(57, 28, 'z', 8, C.blue)]);
add('📺', 'a television', [
  line('M32 16 L21 4 M32 16 L43 4', C.ink, 2.2), rect(5, 15, 54, 36, C.dgrey, 6), rect(10, 20, 36, 26, C.sky, 3), line('M14 25 l8 -2', C.white, 2),
  circ(53, 28, 2.6, C.red), circ(53, 37, 2.6, C.gold), rect(19, 51, 26, 6, C.black, 2)]);
add('✈️', 'an airplane', [grp(45, [
  path_('M32 3 Q37 8 37 24 L59 40 V46 L37 38 V52 L45 58 V62 L32 59 L19 62 V58 L27 52 V38 L5 46 V40 L27 24 Q27 8 32 3 Z', C.white),
  line('M32 12 V30', C.sky, 3), dot(32, 16, 1.4, C.blue), line('M10 42 L27 36 M54 42 L37 36', C.blue, 2.2)])]);
add('🍞', 'a loaf of bread', [
  path_('M7 30 Q4 11 20 11 Q26 6 32 11 Q38 6 44 11 Q60 11 57 30 V51 Q57 55 53 55 H11 Q7 55 7 51 Z', '#c98a4b'),
  path_('M13 28 Q13 18 22 17 L42 17 Q51 18 51 28 V49 H13 Z', C.pale),
  line('M20 26 q3 -2 6 0 M30 34 q3 -2 6 0 M38 25 q3 -2 6 0 M22 41 q3 -2 6 0 M38 43 q3 -2 6 0', C.tan, 1.6)]);
add('🐶', 'a dog', [
  ell(13, 27, 7, 13, C.brown, 12), ell(51, 27, 7, 13, C.brown, -12),
  ell(32, 36, 18, 19, C.tan), circ(24, 31, 5.4, C.brown), ell(32, 46, 11, 8.4, C.cream),
  dot(24, 31, 2.1), dot(40, 31, 2.1), ell(32, 41, 4.8, 3.4, C.ink), line('M32 44 V48 M27 49 Q32 53 37 49', C.ink, 1.8),
  path_('M29 50.5 Q32 59 35 50.5 Z', C.pink)]);
add('🏥', 'a hospital', [
  rect(6, 11, 52, 7, C.grey, 2), rect(8, 17, 48, 40, C.white, 3),
  rect(28, 21, 8, 20, C.red, 1), rect(22, 27, 20, 8, C.red, 1),
  rect(12, 44, 9, 9, C.sky, 1.5), rect(43, 44, 9, 9, C.sky, 1.5), rect(27, 44, 10, 13, C.blue, 2), line('M4 58 H60', C.dgrey, 2)]);
add('🎤', 'a microphone', [grp(30, [
  path_('M25 30 H39 L36 58 H28 Z', C.dgrey), rect(23, 27, 18, 6, C.red, 2),
  ell(32, 16, 12, 14, C.grey), line('M21 12 Q32 16 43 12 M20 18 H44 M22 24 Q32 27 42 24', C.dgrey, 1.6)])]);
add('☀️', 'the sun', [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4, p = [32 + 20 * Math.sin(a), 32 - 20 * Math.cos(a)], q = [32 + 29 * Math.sin(a), 32 - 29 * Math.cos(a)]; return line('M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1), C.orange, 4.4); }),
  circ(32, 32, 15, C.yellow), line('M24 28 q8 -8 16 0', '#fff6c2', 2.4)]);
same('🌞', '☀️');
add('🚆', 'a train', [
  line('M16 62 L23 52 M48 62 L41 52', C.dgrey, 3.2),
  path_('M14 52 V20 Q14 7 32 7 Q50 7 50 20 V52 Z', C.blue), rect(19, 14, 26, 16, C.sky, 3), line('M32 14 V30', C.blue, 1.6),
  rect(22, 33, 20, 4, C.white, 2), circ(21, 43, 3.4, C.yellow), circ(43, 43, 3.4, C.yellow), rect(16, 49, 32, 5, C.dgrey, 2)]);
add('🍎', 'an apple', [
  path_('M32 17 Q20 9 10 21 Q3 36 13 50 Q22 61 32 55 Q42 61 51 50 Q61 36 54 21 Q44 9 32 17 Z', C.red),
  line('M32 17 Q32 9 36 4', C.brown, 3.2), path_('M36 10 Q46 3 52 9 Q44 16 36 10 Z', C.green), line('M17 25 Q13 34 17 42', '#f7a9a0', 2.6)]);
add('💧', 'a drop of water', [
  path_('M32 4 Q51 28 51 40 Q51 58 32 58 Q13 58 13 40 Q13 28 32 4 Z', '#4aa3df'), line('M22 42 Q22 50 29 53', C.white, 2.8)]);
add('🏫', 'a school', [
  line('M32 11 V2', C.ink, 2), poly('32,2 41,4.6 32,7.4', C.red),
  poly('4,25 32,10 60,25', C.dred), rect(8, 24, 48, 33, '#d9815b', 2),
  circ(32, 31, 5.4, C.white), line('M32 31 V28 M32 31 H35', C.ink, 1.6),
  rect(12, 38, 9, 9, C.sky, 1.5), rect(43, 38, 9, 9, C.sky, 1.5), rect(26, 41, 12, 16, C.brown, 2), line('M4 58 H60', C.dgrey, 2)]);
add('📱', 'a mobile phone', [
  rect(17, 5, 30, 54, C.dgrey, 6), rect(21, 11, 22, 40, C.sky, 2),
  rect(23.5, 14, 7, 7, C.red, 2), rect(33, 14, 7, 7, C.green, 2), rect(23.5, 24, 7, 7, C.yellow, 2), rect(33, 24, 7, 7, C.purple, 2), dot(32, 55, 1.7, C.grey)]);
add('🥛', 'a glass of milk', [
  path_('M13 9 H51 L46 56 Q46 59 43 59 H21 Q18 59 18 56 Z', '#e3f1f8'), path_('M15 22 H49 L46 55 Q46 57 43 57 H21 Q18 57 18 55 Z', C.white),
  line('M20 14 L23 50', '#ffffff', 2.4), line('M15 22 H49', C.ink, 1.6)]);
add('👕', 'a T-shirt', [
  path_('M22 7 Q32 17 42 7 L59 16 L52 31 L46 28 V57 H18 V28 L12 31 L5 16 Z', C.blue), path_('M22 7 Q32 17 42 7 Q32 11 22 7 Z', C.navy),
  line('M18 36 H46', C.pale, 2)]);

add('🍵', 'a cup of tea', [
  line('M50 24 Q61 24 59 34 Q57 42 48 41', C.ink, 6), line('M50 24 Q61 24 59 34 Q57 42 48 41', C.white, 2.6),
  path_('M7 21 H51 Q51 52 29 53 Q7 52 7 21 Z', C.white), ell(29, 21, 22, 4.4, C.lime), line('M14 31 Q29 38 44 31', C.green, 2.2),
  path_('M14 53 H44 L42 58 H16 Z', C.grey), line('M22 10 q-4 -4 0 -8 M32 10 q-4 -4 0 -8 M42 10 q-4 -4 0 -8', C.grey, 2)]);
add('🐱', 'a cat', [
  poly('12,8 25,17 11,29', C.orange), poly('52,8 39,17 53,29', C.orange), poly('15,12 21,17 14,23', C.pink), poly('49,12 43,17 50,23', C.pink),
  ell(32, 36, 22, 19, C.orange), line('M32 18 V25 M26 19 l2 5 M38 19 l-2 5', C.dred, 2),
  ell(23, 35, 3.4, 4.4, C.green), ell(41, 35, 3.4, 4.4, C.green), line('M23 32.6 V37.4 M41 32.6 V37.4', C.ink, 2),
  poly('29,43 35,43 32,47', C.pink), line('M32 47 Q27 52 24 49 M32 47 Q37 52 40 49', C.ink, 1.8),
  line('M4 40 L16 42 M4 47 L16 46 M60 40 L48 42 M60 47 L48 46', C.ink, 1.6)]);
add('🏪', 'a shop', [
  rect(8, 22, 48, 35, C.cream, 2),
  path_('M5 22 L10 8 H54 L59 22 Z', C.red), ...[0, 1, 2, 3].map((i) => path_('M' + (10 + i * 11) + ' 22 L' + (13 + i * 11) + ' 8 H' + (21 + i * 11) + ' L' + (21 + i * 11 - 3 + 3) + ' 22 Z', i % 2 ? C.red : C.white).replace(/stroke-width="2"/, 'stroke-width="1.4"')),
  rect(13, 32, 20, 14, C.sky, 2), rect(39, 32, 12, 25, C.brown, 2), dot(47, 45, 1.3, C.gold), rect(13, 49, 20, 8, C.yellow, 1.5), line('M4 58 H60', C.dgrey, 2)]);
add('💻', 'a laptop', [
  rect(11, 10, 42, 30, C.dgrey, 4), rect(15, 14, 34, 22, C.sky, 2), line('M20 20 H36 M20 26 H42', C.white, 2),
  path_('M5 42 H59 L55 52 Q54 54 52 54 H12 Q10 54 9 52 Z', C.grey), rect(24, 44, 16, 4, C.dgrey, 2)]);
add('🥶', 'a freezing face', [
  circ(32, 33, 23, '#9fd0ee'), line('M17 26 q4 -4 9 0 M38 26 q4 -4 9 0', C.ink, 2.2),
  circ(23, 31, 3.4, C.white), circ(41, 31, 3.4, C.white), dot(23, 31, 1.5), dot(41, 31, 1.5),
  path_('M21 44 L25 40 L29 45 L33 40 L37 45 L41 40 L43 44 Q32 52 21 44 Z', C.white),
  line('M7 12 L14 18 M10 8 V18 M5 15 H15', C.sky, 1.8), line('M54 8 l6 6 M57 5 V14 M52 11 H61', C.sky, 1.8)]);
clock('🕘', 'a clock showing nine o’clock', 9, 0);
clock('🕛', 'a clock showing twelve o’clock', 12, 0);
clock('🕔', 'a clock showing five o’clock', 5, 0);
clock('🕐', 'a clock showing one o’clock', 1, 0);
add('❄️', 'a snowflake', [
  ...[0, 1, 2].map((i) => grp(i * 60, [line('M32 6 V58', C.sky, 5.2), line('M32 6 V58', C.white, 2.4), line('M24 14 L32 20 L40 14 M24 50 L32 44 L40 50', C.sky, 3)].map((x) => x))),
  circ(32, 32, 4.4, C.white)]);
add('🍳', 'a fried egg', [
  path_('M32 8 Q44 6 50 14 Q60 18 56 30 Q60 42 48 48 Q40 56 28 52 Q12 54 8 42 Q2 30 10 22 Q10 12 22 12 Q26 8 32 8 Z', C.white),
  circ(31, 30, 11, C.yellow), line('M25 26 q3 -4 7 -3', '#fff6c2', 2.4)]);
add('🎬', 'a film clapperboard', [
  rect(7, 24, 50, 33, C.black, 3), rect(7, 24, 50, 7, C.white, 1.5),
  path_('M7 12 L51 6 L53 16 L9 22 Z', C.black),
  ...[0, 1, 2, 3].map((i) => poly((10 + i * 12) + ',22 ' + (15 + i * 12) + ',21.4 ' + (20 + i * 12) + ',12 ' + (15 + i * 12) + ',12.6', C.white)),
  line('M14 40 H50 M14 48 H40', C.white, 2.6)]);
add('🚕', 'a taxi', [
  rect(26, 10, 12, 7, C.yellow, 2), txt(32, 16, 'TAXI', 5, C.ink),
  path_('M4 45 V39 Q4 34 10 33 L15 24 Q17 21 21 21 H43 Q47 21 49 24 L55 33 Q60 34 60 40 V45 Z', C.yellow),
  path_('M18 25 H30 V33 H13 Z', C.sky), path_('M33 25 H42 Q44 25 46 28 L50 33 H33 Z', C.sky),
  rect(4, 38, 56, 3, C.black, 0), circ(17, 47, 7, C.black), circ(17, 47, 3, C.grey), circ(47, 47, 7, C.black), circ(47, 47, 3, C.grey)]);
add('🥟', 'a dumpling', [
  ell(32, 52, 29, 6, C.sky),
  path_('M5 45 Q6 20 32 16 Q58 20 59 45 Q32 55 5 45 Z', C.white),
  line('M13 30 q3 4 2 10 M20 24 q3 5 2 13 M27 20 q2 7 1 15 M36 20 q-1 8 -2 15 M43 24 q-2 8 -4 13 M51 30 q-2 6 -5 10', C.grey, 2.2)]);
add('🏊', 'a swimmer', [
  path_('M2 50 Q9 44 16 50 T30 50 T44 50 T58 50 V62 H2 Z', C.blue), line('M2 50 Q9 44 16 50 T30 50 T44 50 T58 50', C.sky, 2),
  circ(24, 29, 7, C.skin), path_('M17 28 Q24 17 31 27 Q24 24 17 28 Z', C.black),
  path_('M30 33 Q40 30 56 38 L53 45 Q40 40 29 41 Z', C.skin), line('M32 25 Q42 14 52 22', C.skin, 5), line('M32 25 Q42 14 52 22', C.ink, 1.2),
  path_('M26 41 Q27 49 36 48', 'none'), line('M2 44 q5 -4 10 0', C.sky, 2.4)]);
add('⚽', 'a football', [
  circ(32, 32, 27, C.white), poly('32,20 42,27 38,39 26,39 22,27', C.black),
  line('M32 20 V6 M42 27 L55 22 M38 39 L46 51 M26 39 L18 51 M22 27 L9 22', C.ink, 2.2),
  poly('32,5 40,8 36,14 28,14 24,8', C.black).replace(/<polygon[^>]*>/, ''),
  poly('50,23 57,30 54,40 48,34', C.black), poly('14,23 7,30 10,40 16,34', C.black), poly('40,52 48,48 44,57 36,58', C.black), poly('24,52 16,48 20,57 28,58', C.black)]);
add('🚇', 'a subway train', [
  line('M14 62 L20 54 M50 62 L44 54', C.dgrey, 3),
  rect(11, 7, 42, 46, C.grey, 8), rect(16, 13, 32, 18, C.sky, 3), line('M32 13 V31', C.grey, 2),
  rect(16, 35, 32, 4, C.red, 2), circ(21, 45, 3.2, C.yellow), circ(43, 45, 3.2, C.yellow), rect(19, 50, 26, 4, C.dgrey, 1.6)]);
add('🐟', 'a fish', [
  poly('48,32 62,18 62,46', C.orange), path_('M3 32 Q14 14 34 15 Q48 17 52 32 Q48 47 34 49 Q14 50 3 32 Z', C.orange),
  line('M20 20 Q25 32 20 44 M30 17 Q36 32 30 47', C.dred, 1.8), circ(14, 29, 3.2, C.white), dot(14, 29, 1.5), line('M5 35 Q8 38 11 36', C.ink, 1.6)]);
add('💃', 'a dancer', [
  path_('M36 34 Q18 40 8 60 Q32 54 58 60 Q48 40 36 34 Z', C.red), path_('M36 34 L30 28 L38 26 Q42 30 40 34 Z', C.red),
  circ(34, 17, 7.4, C.skin), path_('M26.4 16 Q28 5 38 7 Q43 12 41 18 Q38 12 30 14 Z', C.black), path_('M26 17 Q22 26 27 32 Q27 24 29 18 Z', C.black),
  line('M36 27 L50 16', C.skin, 4.6), line('M36 27 L50 16', C.ink, 1), line('M30 29 L20 36', C.skin, 4.4), line('M30 29 L20 36', C.ink, 1),
  line('M17 56 q6 -3 12 0', C.dred, 1.6)]);
add('💊', 'a pill', [grp(-35, [
  path_('M10 24 H32 V40 H10 Q2 40 2 32 Q2 24 10 24 Z', C.red), path_('M32 24 H54 Q62 24 62 32 Q62 40 54 40 H32 Z', C.white), line('M8 29 H16', C.pink, 2.4)])]);
add('🎂', 'a birthday cake', [
  line('M20 12 V20 M32 10 V19 M44 12 V20', C.ink, 3), ...[20, 32, 44].map((x, i) => path_('M' + x + ' ' + (i === 1 ? 4 : 6) + ' Q' + (x - 3) + ' ' + (i === 1 ? 9 : 11) + ' ' + x + ' ' + (i === 1 ? 12 : 14) + ' Q' + (x + 3) + ' ' + (i === 1 ? 9 : 11) + ' ' + x + ' ' + (i === 1 ? 4 : 6) + ' Z', C.orange)),
  rect(10, 20, 44, 14, C.pink, 5), path_('M10 28 Q14 34 18 28 Q22 36 27 28 Q31 34 36 28 Q40 36 45 28 Q49 34 54 28 V24 H10 Z', C.white),
  rect(7, 34, 50, 22, C.tan, 4), line('M8 46 H56', C.brown, 2), rect(4, 56, 56, 4, C.grey, 2)]);
add('🍜', 'a bowl of noodles', [
  line('M42 3 L30 30', C.brown, 3.2), line('M48 5 L35 31', C.brown, 3.2),
  path_('M6 30 H58 Q58 54 32 57 Q6 54 6 30 Z', C.red), line('M10 38 H54', C.pale, 2),
  path_('M10 30 Q16 24 20 30 Q24 22 28 30 Q32 22 36 30 Q40 22 44 30 Q48 24 54 30', 'none').replace('fill="none"', 'fill="#f3dd9a"'),
  ell(32, 30, 26, 4.6, C.pale), line('M14 29 q5 -3 10 0 t10 0 t10 0', C.tan, 1.8), circ(24, 28, 3, C.white), circ(40, 29, 3, C.green), rect(21, 54, 22, 5, C.dgrey, 2)]);
add('🛒', 'a shopping cart', [
  line('M3 10 H12 L19 40 H50', C.ink, 6), line('M3 10 H12 L19 40 H50', C.grey, 2.6),
  path_('M14 16 H58 L52 36 H20 Z', C.grey), line('M24 16 L26 36 M34 16 V36 M44 16 L42 36 M16 26 H56', C.dgrey, 1.8),
  circ(24, 51, 5, C.dgrey), circ(46, 51, 5, C.dgrey)]);
add('🚌', 'a bus', [
  rect(5, 10, 54, 40, C.orange, 7), rect(10, 15, 44, 14, C.sky, 3), line('M24 15 V29 M39 15 V29', C.orange, 2.4),
  rect(10, 36, 44, 4, C.white, 1.5), circ(15, 44, 3.2, C.yellow), circ(49, 44, 3.2, C.yellow),
  circ(16, 52, 6.4, C.black), circ(16, 52, 2.8, C.grey), circ(48, 52, 6.4, C.black), circ(48, 52, 2.8, C.grey)]);
add('📚', 'a pile of books', [
  rect(8, 40, 48, 15, C.blue, 3), rect(8, 40, 48, 4, C.sky, 1.5), line('M14 48 H34', C.pale, 2.2),
  rect(13, 25, 42, 15, C.red, 3), line('M19 33 H40', C.pale, 2.2), rect(13, 25, 6, 15, C.dred, 2),
  rect(19, 10, 36, 15, C.green, 3), line('M26 18 H44', C.pale, 2.2), rect(19, 10, 6, 15, '#2c6a40', 2)]);
add('👖', 'a pair of jeans', [
  path_('M16 6 H48 L52 58 H35 L32 28 L29 58 H12 Z', C.blue), rect(16, 6, 32, 6, C.navy, 1.6),
  line('M32 12 V28', C.navy, 1.8), line('M20 14 Q24 22 22 26 M44 14 Q40 22 42 26', C.sky, 1.8), line('M14 52 H29 M35 52 H50', C.sky, 1.6), dot(32, 9, 1.3, C.gold)]);
add('🛏️', 'a bed', [
  rect(5, 12, 8, 44, C.brown, 2), rect(51, 28, 8, 28, C.brown, 2),
  rect(9, 34, 46, 14, C.white, 3), rect(9, 40, 46, 9, C.blue, 3), ell(20, 32, 9, 5, C.pale),
  rect(9, 48, 46, 5, C.brown, 2), line('M16 56 V60 M48 56 V60', C.ink, 3)]);
add('🧳', 'a suitcase', [
  path_('M24 14 V9 Q24 6 27 6 H37 Q40 6 40 9 V14', 'none'), line('M24 15 V9 Q24 6 27 6 H37 Q40 6 40 9 V15', C.ink, 3),
  rect(7, 14, 50, 42, C.red, 6), rect(7, 14, 50, 42, 'none', 6), line('M20 14 V56 M44 14 V56', C.dred, 3), rect(28, 30, 8, 6, C.gold, 1.5), circ(15, 60, 2.2, C.ink), circ(49, 60, 2.2, C.ink)]);
add('☂️', 'an umbrella', [
  line('M32 28 V52 Q32 58 38 58 Q42 58 42 53', C.ink, 5), line('M32 28 V52 Q32 58 38 58 Q42 58 42 53', C.brown, 2.4),
  path_('M4 32 Q8 8 32 6 Q56 8 60 32 Q53 26 46 32 Q39 26 32 32 Q25 26 18 32 Q11 26 4 32 Z', C.blue),
  line('M32 6 L18 30 M32 6 V30 M32 6 L46 30', C.navy, 1.6), dot(32, 5, 1.8, C.ink)]);
add('🚲', 'a bicycle', [
  circ(14, 44, 12, 'none'), '<circle cx="14" cy="44" r="11" fill="none" stroke="' + C.ink + '" stroke-width="3"/>', '<circle cx="50" cy="44" r="11" fill="none" stroke="' + C.ink + '" stroke-width="3"/>',
  line('M14 44 L26 24 H42 L50 44 M26 24 L32 44 H14 M32 44 L42 24', C.red, 3), line('M26 24 L24 18 H18 M42 24 L40 14 H46', C.ink, 3), dot(14, 44, 2.4), dot(50, 44, 2.4), dot(32, 44, 3, C.dgrey)]);
add('🎵', 'a musical note', [
  path_('M24 8 L54 4 V40 H48 V16 L30 19 V50 H24 Z', C.black), ell(17, 50, 10, 7.4, C.black, -20), ell(41, 40, 10, 7.4, C.black, -20),
  line('M24 14 L54 10', C.black, 2)]);
add('🌸', 'a cherry blossom', [
  ...[0, 1, 2, 3, 4].map((i) => grp(i * 72, [path_('M32 30 Q22 22 25 12 Q28 7 32 11 Q36 7 39 12 Q42 22 32 30 Z', C.pink)])),
  circ(32, 32, 5, C.yellow), ...[0, 1, 2, 3, 4].map((i) => dot((32 + 11 * Math.sin(i * 1.2566 + 0.6)).toFixed(1), (32 - 11 * Math.cos(i * 1.2566 + 0.6)).toFixed(1), 1.3, C.dred))]);
add('👟', 'a sports shoe', [
  path_('M5 40 Q6 22 14 20 L26 22 Q30 30 42 32 Q58 34 60 42 V47 H5 Z', C.white),
  path_('M5 44 H60 V51 Q60 54 57 54 H8 Q5 54 5 51 Z', C.red), line('M14 20 L12 40', C.grey, 2),
  line('M26 25 l4 -3 M30 29 l4 -3 M34 32 l4 -3', C.ink, 2), path_('M18 40 Q32 30 54 38 Q40 44 18 40 Z', C.blue)]);
add('🌙', 'a crescent moon', [
  path_('M44 6 Q16 8 14 34 Q14 56 40 58 Q22 52 22 32 Q22 14 44 6 Z', C.yellow), dot(50, 20, 1.8, C.gold), dot(54, 38, 2.2, C.gold), line('M50 46 l5 0 M52.5 43.5 v5', C.gold, 1.8)]);
add('📷', 'a camera', [
  path_('M20 14 L25 8 H39 L44 14 Z', C.dgrey), rect(5, 14, 54, 38, C.dgrey, 6), rect(5, 22, 54, 5, C.black, 0),
  circ(32, 36, 14, C.grey), circ(32, 36, 9.4, C.navy), circ(32, 36, 4, C.sky), rect(10, 17, 8, 4, C.red, 1.5), dot(50, 31, 2, C.yellow)]);
add('💰', 'a bag of money', [
  path_('M24 10 L28 18 H36 L40 10 Q32 6 24 10 Z', C.tan), path_('M26 18 Q8 28 8 44 Q8 58 32 58 Q56 58 56 44 Q56 28 38 18 Z', C.tan),
  line('M26 19 H38', C.brown, 3), txt(32, 50, '¥', 22, C.brown)]);
add('⏰', 'an alarm clock', [
  circ(15, 14, 8, C.red), circ(49, 14, 8, C.red), line('M32 4 V10', C.ink, 3),
  circ(32, 36, 22, C.white), circ(32, 36, 22, 'none'), line('M32 36 V24 M32 36 L41 41', C.ink, 3.2), dot(32, 36, 2.4),
  ...[0, 3, 6, 9].map((i) => dot((32 + 17 * Math.sin(i * Math.PI / 6)).toFixed(1), (36 - 17 * Math.cos(i * Math.PI / 6)).toFixed(1), 1.4)),
  line('M16 57 L12 61 M48 57 L52 61', C.ink, 3)]);

// pictures of several of the same thing: the single picture, repeated
const multi = (key, from, n, alt) => {
  const pos = n === 2 ? [[1, 17, 30], [33, 17, 30]] : [[1, 2, 30], [33, 2, 30], [17, 33, 30]];
  ART[key] = { a: alt, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + pos.map((p) => '<svg x="' + p[0] + '" y="' + p[1] + '" width="' + p[2] + '" height="' + p[2] + '" viewBox="0 0 64 64">' + BASE[from] + '</svg>').join('') + '</svg>' };
};
multi('🍎🍎🍎', '🍎', 3, 'three apples'); multi('🍎🍎', '🍎', 2, 'two apples'); multi('🐱🐱', '🐱', 2, 'two cats');

if (require.main === module) {
  const out = {};
  Object.keys(ART).forEach((k) => { out[k.replace(/\uFE0F/g, '')] = { a: ART[k].a, u: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART[k].svg) }; });
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'exam-art.js'), '/* Generated by tools/exam-art.js. Do not edit. */\nwindow.SHANLU_EXAM_ART = ' + JSON.stringify(out) + ';\n');
  console.log('wrote ' + Object.keys(out).length + ' pictures to data/exam-art.js');
}
module.exports = { ART };
