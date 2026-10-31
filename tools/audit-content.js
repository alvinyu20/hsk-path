/* Content audit: checks data/hsk1.js against a community HSK dataset.
 *   git clone --depth 1 https://github.com/drkameleon/complete-hsk-vocabulary ../hsk-dataset
 *   node tools/audit-content.js ../hsk-dataset/complete.json [level]
 * Reports: word pinyin that differs from the dataset, and any word in an example sentence that is above
 * the chosen level (default 1) in the 2025 syllabus tags ("newest"). It cannot judge grammar or naturalness. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dsPath = process.argv[2];
const level = Number(process.argv[3] || 1);
if (!dsPath) { console.log('usage: node tools/audit-content.js <complete.json> [level]'); process.exit(2); }

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'hsk' + level + '.js'), 'utf8'), sandbox);
const H = sandbox.window['HSK' + level];

const data = JSON.parse(fs.readFileSync(dsPath, 'utf8'));
const map = {};
data.forEach(e => { (map[e.simplified] = map[e.simplified] || []).push(e); });
const lv = (e, pfx) => { const a = e.level.filter(l => l.startsWith(pfx + '-')).map(l => +l.split('-')[1]); return a.length ? Math.min(...a) : null; };
const strip = s => s.toLowerCase().replace(/[\s·]/g, '');

let problems = 0;
const bad = (m) => { problems++; console.log('PROBLEM', m); };

const words = {};
const add = (zh, py, en) => { if (!words[zh]) words[zh] = { zh, py, en }; };
H.HUBS.forEach(h => h.words.forEach(w => add(w.zh, w.py, w.en)));
H.OPPS.forEach(o => { add(o.a.zh, o.a.py, o.a.en); add(o.b.zh, o.b.py, o.b.en); });
H.TOPICS.forEach(t => t.words.forEach(w => add(w.zh, w.py, w.en)));
H.EXTRA_WORDS.forEach(w => add(w.zh, w.py, w.en));

console.log('words:', Object.keys(words).length);
Object.keys(words).forEach(zh => {
  const es = map[zh];
  if (!es) { bad(zh + ' is not in the dataset'); return; }
  const pys = es.flatMap(e => e.forms.map(f => f.transcriptions.pinyin));
  if (!pys.some(p => strip(p) === strip(words[zh].py))) bad(zh + ': pinyin ' + words[zh].py + ' vs dataset ' + pys.join(' / '));
  const n = lv(es[0], 'newest');
  if (n === null || n > level) bad(zh + ' is level ' + n + ' in the 2025 list, above level ' + level);
  if (!H.EX[zh]) bad(zh + ' has no example sentence');
});

const sentences = [];
Object.keys(H.EX).forEach(zh => sentences.push(['EX ' + zh, H.EX[zh].zh]));
H.GRAM_EX.forEach((x, i) => sentences.push(['GRAM_EX ' + i, x.zh]));
H.CLIPS.forEach((c, i) => sentences.push(['CLIP ' + i, c.zh]));
H.AI.forEach((a, i) => sentences.push(['AI ' + i, a.zh]));
H.YOU.forEach((a, i) => sentences.push(['YOU ' + i, a.zh]));
H.HUBS.forEach((h, i) => h.gaps.forEach((g, j) => sentences.push(['GAP ' + i + '.' + j, g.zh.replace('___', g.ans)])));
H.TOPICS.forEach((t, i) => sentences.push(['TOPIC ' + i, t.sentence.zh]));
H.GRAM_Q.forEach((q, i) => sentences.push(['GRAM_Q ' + i, q.reveal]));
const segment = (s) => {
  const out = []; let i = 0;
  while (i < s.length) {
    if (!/[一-鿿]/.test(s[i])) { i++; continue; }
    let found = null;
    for (let L = Math.min(4, s.length - i); L >= 1; L--) { const t = s.slice(i, i + L); if (map[t]) { found = t; break; } }
    if (found) { out.push(found); i += found.length; } else { out.push('?' + s[i]); i++; }
  }
  return out;
};
sentences.forEach(([src, sen]) => {
  segment(sen).forEach(t => {
    if (t[0] === '?') { bad(src + ' "' + sen + '": ' + t.slice(1) + ' not found in the dataset'); return; }
    const n = lv(map[t][0], 'newest');
    if (n === null || n > level) console.log('NOTE    ' + src + ' "' + sen + '": ' + t + ' is level ' + n + ' (above ' + level + ')');
  });
});
console.log(problems ? problems + ' problem(s)' : 'no problems found');
process.exit(problems ? 1 : 0);
