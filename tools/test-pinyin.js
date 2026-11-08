#!/usr/bin/env node
/* Unit test for pinyin.js (tone numbers -> tone marks) and a spot check of the course data against it:
 * every syllable of every course example must come out the same when written with tone numbers and run through toMarks. */
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const ctx = { window: {} }; vm.createContext(ctx);
['pinyin.js', 'data/pinyin-course.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
const T = ctx.window.ShanluPinyin.toMarks;
const cases = [
  ['ni3 hao3', 'nǐ hǎo'], ['ni3hao3', 'nǐhǎo'], ['NI3 HAO3', 'NǏ HǍO'], ['Zhong1guo2', 'Zhōngguó'], ['nv3', 'nǚ'], ['nu:3', 'nǚ'], ['lv4', 'lǜ'], ['lüe4', 'lüè'],
  ['liu4', 'liù'], ['dui4', 'duì'], ['gui4', 'guì'], ['hui2', 'huí'], ['jiu3', 'jiǔ'], ['xie3', 'xiě'], ['gei3', 'gěi'], ['dou1', 'dōu'], ['shuo1', 'shuō'], ['yue4', 'yuè'], ['yi1', 'yī'],
  ['ma5', 'ma'], ['ma0', 'ma'], ['ma1ma', 'māma'], ['ma', 'ma'], ['hello', 'hello'], ['nv', 'nv'], ['', ''], ['xian1 Xi1an1', 'xiān Xīān'],
  ['er4', 'èr'], ['ao2', 'áo'], ['ai4', 'ài'], ['zhuang4', 'zhuàng'], ['hen3 hao3 !', 'hěn hǎo !'], ['你好 ni3', '你好 nǐ'], ['ba4 ba5', 'bà ba']
];
cases.forEach(([a, b]) => assert.strictEqual(T(a), b, 'toMarks(' + JSON.stringify(a) + ') = ' + JSON.stringify(T(a)) + ', wanted ' + JSON.stringify(b)));
assert.strictEqual(T(null), ''); assert.strictEqual(T(undefined), '');

// tone numbers of a marked syllable
const NUM = { 'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4], 'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4], 'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4], 'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4], 'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4] };
const toNumbers = (py) => String(py).toLowerCase().replace(/[’']/g, '').split(/\s+/).map(w => {
  // walk the word; a mark gives the tone for the syllable it sits in; syllables are split after the marked vowel's syllable end
  let plain = '', digits = [];
  for (const ch of w) { if (NUM[ch]) { plain += NUM[ch][0]; digits.push([plain.length, NUM[ch][1]]); } else plain += ch; }
  return { plain, digits };
});
let checked = 0;
ctx.window.SHANLU_PYCOURSE.lessons.forEach(les => les.blocks.forEach(b => {
  const items = b.t === 'say' ? b.items : b.t === 'groups' ? [].concat(...b.items.map(g => g.cells)) : [];
  items.forEach(it => {
    if (/[ ’]/.test(it.py) || /[A-Z]/.test(it.py)) return;           // only single words: syllable boundaries are what the test needs
    const words = toNumbers(it.py);
    // rebuild the word from its marks: put each digit after the end of its syllable (the vowel group + any n/ng/r that follows)
    const w = words[0]; if (!w || !w.digits.length) return;
    let out = '', last = 0;
    w.digits.forEach(([pos, tone]) => {
      let end = pos; while (end < w.plain.length && /[aeiouü]/.test(w.plain[end])) end++;
      // a following n/ng/r belongs to this syllable unless a vowel comes right after it
      const rest = w.plain.slice(end);
      const m = /^(ng|n|r)(?![aeiouü])/.exec(rest) || /^(ng|n)(?=g?[^aeiouü]|$)/.exec(rest);
      if (m && !/^(ng|n)[aeiouü]/.test(rest)) end += m[0].length;
      out += w.plain.slice(last, end) + tone; last = end;
    });
    out += w.plain.slice(last);
    assert.strictEqual(T(out), it.py.toLowerCase().replace(/[’']/g, ''), 'course example ' + it.zh + ': ' + out + ' -> ' + T(out) + ' but the course says ' + it.py);
    checked++;
  });
}));
console.log('test-pinyin: ' + cases.length + ' conversions and ' + checked + ' course examples OK');
