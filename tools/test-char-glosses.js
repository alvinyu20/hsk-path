/* Every character inside a multi-character HSK 1-4 word must have a meaning to show in "Built from":
 * either a word of its own at that level or an earlier one (the app's own rule), or an entry in content/char-glosses.tsv.   node tools/test-char-glosses.js */
const path = require('path');
global.window = {};
[1, 2, 3, 4].forEach((n) => require(path.join(__dirname, '..', 'data', 'hsk' + n + '-words.js')));
require(path.join(__dirname, '..', 'data', 'char-glosses.js'));
const G = window.CHAR_GLOSSES;
const first = {};
[1, 2, 3, 4].forEach((n) => window['HSK' + n + '_WORDS'].forEach((w) => { if (!(w.zh in first)) first[w.zh] = n; }));
const bad = {}; let extra = 0;
const used = new Set();
[1, 2, 3, 4].forEach((n) => window['HSK' + n + '_WORDS'].forEach((w) => {
  if ([...w.zh].length < 2) return;
  [...w.zh].forEach((ch) => {
    if (!/[一-鿿]/.test(ch)) return;
    used.add(ch);
    if (!(first[ch] <= n) && !G[ch]) (bad[ch] = bad[ch] || []).push(w.zh);
  });
}));
Object.keys(G).forEach((c) => { if (!used.has(c)) { extra++; console.log('FAIL ' + c + ' has a gloss but is in no HSK 1-4 word'); } });
Object.keys(G).forEach((c) => { if (G[c].length > 30) { extra++; console.log('FAIL gloss for ' + c + ' is too long for a chip: ' + G[c]); } });
// the extra members of character groups (webs.json "extends") must have a group of that character at a lower level to join
[2, 3, 4].forEach((n) => { require(path.join(__dirname, '..', 'data', 'hsk' + n + '-webs.js')); });
require(path.join(__dirname, '..', 'data', 'hsk1-webs.js'));
[2, 3, 4].forEach((n) => ((window['HSK' + n + '_WEBS'].extends) || []).forEach((e) => {
  const hosts = [1, 2, 3, 4].filter((m) => m < n && window['HSK' + m + '_WEBS'].hubs.some((h) => h.hub === e.hub));
  if (!hosts.length) { extra++; console.log('FAIL HSK ' + n + ' extends the group ' + e.hub + ' but no lower level has it'); }
  e.words.forEach((w) => { if (w.zh.indexOf(e.hub) < 0) { extra++; console.log('FAIL ' + w.zh + ' is not in the group ' + e.hub); } });
}));
const keys = Object.keys(bad);
keys.forEach((c) => console.log('FAIL ' + c + ' (in ' + bad[c].slice(0, 3).join(' ') + ') has no meaning for "Built from"'));
if (keys.length || extra) process.exit(1);
console.log('char gloss tests passed (' + Object.keys(G).length + ' glosses)');
