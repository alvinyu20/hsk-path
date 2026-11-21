/* Unit test for numbers.js (Games: Quick-fire numbers): how numbers, prices, times, dates and phone numbers are said, and the answers offered.
 * Usage: node tools/test-numbers.js */
const N = require('../numbers.js');
let fails = 0;
const eq = (a, b, msg) => { if (a !== b) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } };
// whole numbers
[[0, '零'], [4, '四'], [10, '十'], [14, '十四'], [40, '四十'], [44, '四十四'], [99, '九十九'], [100, '一百'], [105, '一百零五'], [110, '一百一十'],
 [1005, '一千零五'], [1050, '一千零五十'], [2000, '两千'], [2008, '两千零八'], [10010, '一万零一十'], [20500, '两万零五百'], [23000, '两万三千'], [12000, '一万两千']]
  .forEach(([n, z]) => eq(N.zh(n), z, 'zh(' + n + ')'));
eq(N.zh(200, { two100: true }), '两百', 'two100'); eq(N.zh(200), '二百', 'two100 off');
[[120, '一百二'], [1500, '一千五'], [23000, '两万三'], [105, null], [1000, null]].forEach(([n, z]) => eq(N.shortZh(n), z, 'shortZh(' + n + ')'));
// pinyin
[['十四', 'shísì'], ['四十二', "sìshí'èr"], ['一百零五', 'yìbǎi língwǔ'], ['两万三千', 'liǎngwàn sānqiān'], ['一万', 'yíwàn'], ['二十八块五', "èrshíbā kuài wǔ"], ['三点一刻', 'sān diǎn yí kè'],
 ['差五分四点', 'chà wǔ fēn sì diǎn'], ['五月二十号', "wǔ yuè èrshí hào"], ['两块', 'liǎng kuài']].forEach(([z, p]) => eq(N.py(z), p, 'py(' + z + ')'));
// cards: every step, many seeds: four different answers, the right one among them, Chinese text present
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
N.STEPS.forEach(st => [1, 3, 5].forEach(lv => {
  for (let i = 0; i < 300; i++) {
    const c = N.card(st.id, lv, rnd);
    if (c.opts.length !== 4 || new Set(c.opts).size !== 4 || c.opts.indexOf(c.label) < 0 || !c.zh || !c.py) { fails++; console.log('FAIL card', st.id, lv, JSON.stringify(c)); break; }
    if (lv < 3 && /[刻差毛]/.test(c.zh)) { fails++; console.log('FAIL HSK 3 word at HSK', lv, c.zh); break; }
    if (lv < 2 && /万/.test(c.zh)) { fails++; console.log('FAIL 万 at HSK 1', c.zh); break; }
  }
}));
// a few checks of what the readings mean
seed = 7;
for (let i = 0; i < 500; i++) {
  const c = N.card('time', 3, rnd);
  const m = /^差(.+)分(.+)点$/.exec(c.zh);
  if (m) { const [h, mm] = c.label.split(':').map(Number); if (mm < 50) { fails++; console.log('FAIL 差 time', c.zh, c.label); } }
  if (/一刻$/.test(c.zh) && !/:15$/.test(c.label)) { fails++; console.log('FAIL 一刻', c.zh, c.label); }
  const p = N.card('price', 1, rnd);
  if (/块[一二三四五六七八九]$/.test(p.zh) && !/\.[1-9]0$/.test(p.label)) { fails++; console.log('FAIL price', p.zh, p.label); }
}
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('test-numbers: all passed');
