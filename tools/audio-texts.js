#!/usr/bin/env node
/* Lists every text the site reads aloud, with the voice it uses, as JSON: [{text, voice, group}].
 *   voice: "f" (the woman's voice) or "m" (the man's voice: exam lines spoken by 男)
 *   group: words | examples | lab | exams | extra
 * Usage: node tools/audio-texts.js [--summary]       (tools/make-audio.py reads this)
 * The exam rules mirror app.js: a line spoken by 男 is the man's voice, 女 and lines with no speaker are the woman's. */
const path = require('path');
global.window = {};
const D = (f) => require(path.join(__dirname, '..', 'data', f));
[1, 2, 3].forEach((n) => ['words', 'webs', 'speak', 'listen', 'exam', 'grammar'].forEach((k) => { try { D('hsk' + n + '-' + k + '.js'); } catch (e) {} }));
const out = new Map();   // key voice|text -> entry
const add = (text, voice, group) => {
  text = String(text || '').trim();
  if (!text || !/[一-鿿]/.test(text)) return;
  const k = voice + '|' + text;
  if (!out.has(k)) out.set(k, { text, voice, group });
};
[1, 2, 3].forEach((n) => {
  const N = 'HSK' + n;
  (window[N + '_WORDS'] || []).forEach((w) => {
    add(w.zh, 'f', 'words');
    add(w.ex && w.ex.zh, 'f', 'examples');
    (w.more || []).forEach((e) => add(e.zh, 'f', 'examples'));
  });
  const WEBS = window[N + '_WEBS'];
  if (WEBS) {
    (WEBS.hubs || []).forEach((h) => (h.gaps || []).forEach((g) => add(String(g.zh || '').replace('___', g.ans), 'f', 'examples')));
    (WEBS.topics || []).forEach((t) => t.sentence && add(t.sentence.zh, 'f', 'examples'));
  }
  const SPEAK = window[N + '_SPEAK'];
  if (SPEAK) (SPEAK.phrases || []).forEach((e) => add(e.zh, 'f', 'examples'));
  const LISTEN = window[N + '_LISTEN'];
  if (LISTEN) (LISTEN.clips || []).forEach((c) => add(c.zh, 'f', 'lab'));
  if (SPEAK) (SPEAK.scenarios || []).forEach((s) => [].concat(s.ai || [], s.you || []).forEach((e) => add(e.zh, 'f', 'extra')));
  const G = window[N + '_GRAMMAR'];
  const walkG = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o.examples)) o.examples.forEach((e) => add(e.zh, 'f', 'extra')); Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === 'object') walkG(o[k]); }); };
  walkG(G);
  // exams: only the listening parts (L1..L4) are spoken
  const EX = window[N + '_EXAM'];
  if (EX) Object.keys(EX).filter((k) => /^L\d/.test(k)).forEach((part) => {
    const lineVoice = (s) => (s === '男' ? 'm' : 'f');
    const walk = (o, top) => {
      if (Array.isArray(o)) { o.forEach((x) => walk(x, top)); return; }
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o.say)) o.say.forEach((l) => add(l.zh, lineVoice(l.s), 'exams'));
      if (o.q && o.q.zh) add(o.q.zh, 'f', 'exams');
      if (!o.say && !o.opts && typeof o.zh === 'string' && o.ok !== undefined || (!o.say && typeof o.zh === 'string' && o.opts && Array.isArray(o.opts) && top)) add(o.zh, 'f', 'exams');
      if (o.items) walk(o.items, false);
    };
    walk(EX[part], true);
  });
});
const list = [...out.values()];
if (process.argv.includes('--summary')) {
  const cnt = (s) => [...s].filter((c) => /[一-鿿]/.test(c)).length;
  const by = {};
  list.forEach((e) => { const g = by[e.group] = by[e.group] || { lines: 0, chars: 0 }; g.lines++; g.chars += cnt(e.text); });
  let L = 0, C = 0;
  Object.keys(by).forEach((g) => { L += by[g].lines; C += by[g].chars; console.log(g.padEnd(9), String(by[g].lines).padStart(5), 'lines', String(by[g].chars).padStart(6), 'chars', '$' + (by[g].chars * 2 / 1e4 * 0.1).toFixed(3)); });
  console.log('total'.padEnd(9), String(L).padStart(5), 'lines', String(C).padStart(6), 'chars', '$' + (C * 2 / 1e4 * 0.1).toFixed(3), '(each Chinese character counted as 2 billed characters)');
} else console.log(JSON.stringify(list));
