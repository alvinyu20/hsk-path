/* Tests for the stamp drawings (stampart.js) against the real stop data.   node tools/test-stampart.js */
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'journey.js'));
const J = require(path.join(__dirname, '..', 'journey.js'));
const A = require(path.join(__dirname, '..', 'stampart.js'));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const W = J.build(window.JOURNEY);
const stops = Object.values(W.byStop), stars = stops.filter((s) => s.sp), cities = Object.values(W.byCity);
ok(stars.length >= 100, 'there are must-sees to draw: ' + stars.length);
// every kind of stop gets a drawing that exists, and the drawing is real SVG
const seen = {};
stops.forEach((s) => {
  const k = A.stopKey(s, W.byCity[s.cid]);
  ok(Array.isArray(k) && A.M[k[0]], 'a drawing exists for ' + s.id + ' (' + (k && k[0]) + ')');
  if (s.sp) seen[k[0] + '/' + (k[1] % 100)] = (seen[k[0] + '/' + (k[1] % 100)] || 0) + 1;
});
cities.forEach((c) => { const k = A.cityKey(c); ok(A.M[k[0]], 'a landmark exists for ' + c.id + ' (' + (k && k[0]) + ')'); });
const svg = A.svg('pagoda', 1, 200);
ok(/^<svg[^>]+viewBox="0 0 64 64"/.test(svg) && svg.indexOf('$') < 0 && (svg.match(/<[a-z]+/g) || []).length > 5, 'a drawing is a real SVG with the ink colour filled in');
ok(/^data:image\/svg\+xml/.test(A.url('mountain', 2, 120)) && A.url('mountain', 2, 120) === A.url('mountain', 2, 120), 'url() gives a cached data: image');
// the must-sees are told apart: nearly all have a look of their own, and no look is used more than 4 times
const looks = Object.keys(seen), most = Math.max.apply(null, looks.map((x) => seen[x]));
ok(looks.length >= stars.length * 0.8, 'the must-sees are drawn in ' + looks.length + ' different ways (of ' + stars.length + ')');
ok(most <= 4, 'no drawing is reused more than 4 times (' + most + ')');
// and really look different: only the same dish or temple found in two regions may share a picture
const pics = {}; stars.forEach((s) => { const k = A.stopKey(s); const x = A.svg(k[0], k[1], 0, '#000'); (pics[x] = pics[x] || {})[s.en] = 1; });
ok(Object.keys(pics).length >= stars.length - 3, 'the must-sees have ' + Object.keys(pics).length + ' different pictures (of ' + stars.length + ')');
Object.keys(pics).forEach((x) => ok(Object.keys(pics[x]).length === 1, 'different must-sees share a picture: ' + Object.keys(pics[x]).join(' = ')));
const cityPics = {}; cities.forEach((c) => { const k = A.cityKey(c); cityPics[A.svg(k[0], k[1], 0, '#000')] = 1; });
ok(Object.keys(cityPics).length >= 150, 'the cities have ' + Object.keys(cityPics).length + ' different landmark pictures');
// the big cities have a landmark of their own
const byEn = (n) => cities.find((c) => c.en === n);
[['Shanghai', 'tvtower'], ['Chengdu', 'panda'], ['Guilin', 'karst'], ['Hong Kong Island', 'skyline'], ['Lhasa', 'palace']].forEach(([n, k]) => ok(byEn(n) && A.cityKey(byEn(n))[0] === k, n + ' has its own landmark (' + k + ')'));
console.log(bad ? bad + ' check(s) failed' : 'stamp art tests passed (' + stars.length + ' must-sees in ' + looks.length + ' looks, ' + cities.length + ' cities)');
process.exit(bad ? 1 : 0);
