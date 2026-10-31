// Unit checks for ascent.js (the art and label positions of the home screen's ascent). Run: node tools/test-ascent.js
require('../ascent.js');
const A = globalThis.ShanluAscent;
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log('FAIL', what); } };
const L3 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n, i) => [n, ['300', '500', '1,000', '2,000', '3,600', '5,400', '', '', ''][i]]);
const L2 = L3.slice(0, 6);
check(A.nextMilestone(0, 297) === 10 && A.nextMilestone(10, 297) === 25 && A.nextMilestone(96, 297) === 100 && A.nextMilestone(250, 297) === 297 && A.nextMilestone(297, 297) === 297, 'next milestone');
check(JSON.stringify(A.spread(9)) === '[0,1,2,3,4,5,6,7,8]' && A.spread(6).length === 6 && A.spread(6)[0] === 0 && A.spread(6)[5] === 8, 'camp spots for 6 and 9 levels');
for (const dark of [false, true]) {
  for (const started of [0, 1, 96, 297]) {
    const t = A.trail({ started, total: 297, levels: L3, dark });
    check(t.src.startsWith('data:image/svg+xml') && decodeURIComponent(t.src.split(',')[1]).startsWith('<svg'), 'trail makes an svg');
    check(t.labels.length === 9 && t.labels[0].text.includes('HSK 1 exam') && t.labels[0].sub === (297 - started) + ' words to go', 'trail labels at ' + started);
    check(t.you.x >= 40 && t.you.x <= 330 && t.you.y > 200, 'climber on the first stretch at ' + started);
    const p = A.phoneTrail({ started, total: 297, levels: L2, dark });
    check(p.labels.length === 6 && p.you.x >= 8 && p.hideYou === (started / 297 > 0.6), 'phone trail at ' + started);
  }
}
const m = A.mist({ frac: 0.4, idx: 3, dark: false });
check(m.startsWith('data:image/svg+xml') && !m.includes('NaN') && !decodeURIComponent(m).includes('NaN'), 'mist art');
check(decodeURIComponent(A.trail({ started: 50, total: 297, levels: L3 }).src.split(',')[1]).indexOf('NaN') < 0, 'no NaN in the trail');
if (bad) { console.log(bad + ' check(s) failed'); process.exit(1); }
console.log('ascent checks passed');
