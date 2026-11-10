/* A word whose meaning names another reading, like 过 "as a verb (guò)", must list that reading in its pinyin ("guo / guò"),
 * because the typed-pinyin check accepts every reading listed there.   node tools/test-readings.js */
const path = require('path');
global.window = {};
[1, 2, 3].forEach((n) => require(path.join(__dirname, '..', 'data', 'hsk' + n + '-words.js')));
const re = /\(([a-zü]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][a-zü]*)\)/gi;
let bad = 0;
[1, 2, 3].forEach((n) => window['HSK' + n + '_WORDS'].forEach((w) => {
  [...w.en.matchAll(re)].forEach((m) => {
    if (w.py.split('/').map((x) => x.trim()).indexOf(m[1]) < 0) { bad++; console.log('FAIL HSK ' + n + ' ' + w.zh + ': the meaning names ' + m[1] + ' but the pinyin is "' + w.py + '"'); }
  });
}));
const g = window.HSK2_WORDS.find((w) => w.zh === '过');
if (!g || g.py !== 'guo / guò') { bad++; console.log('FAIL 过 should be "guo / guò", got ' + (g && g.py)); }
if (bad) process.exit(1);
console.log('reading tests passed');
