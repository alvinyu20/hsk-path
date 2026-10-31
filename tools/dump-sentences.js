#!/usr/bin/env node
/* Collects every Chinese sentence the learner will see, with its pinyin and English, into one JSON list.
 * tools/check-content.py reads this list, so all content goes through the same checks, wherever it lives.
 *
 * Usage: node tools/dump-sentences.js [level] [--plain] > /tmp/sentences.json   (--plain: with the 儿 endings switched off, see erhua.js)
 * To add a new kind of content, add a few lines below. Every item needs: where, zh, py, en.
 */
const fs = require('fs');
const path = require('path');
global.window = {};
const level = process.argv.slice(2).find(x => /^\d+$/.test(x)) || '1';
const plain = process.argv.includes('--plain');   // dump what the learner sees with the 儿 endings switched off
const dir = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(dir).filter(f => new RegExp('^hsk' + level + '(-.*)?\\.js$').test(f));
files.forEach(f => require(path.join(dir, f)));

if (plain) { const E = require(path.join(__dirname, '..', 'erhua.js')); E.make(window.HSK1_ERHUA).apply(window); }

const N = 'HSK' + level;
const H = window[N] || {};
const WORDS = window[N + '_WORDS'] || [];
const GRAM = window[N + '_GRAMMAR'] || null;
const out = [];
const add = (where, zh, py, en, extra) => { if (zh) out.push(Object.assign({ where, zh, py: py || '', en: en || '' }, extra || {})); };

WORDS.forEach(w => add('word:' + w.zh, w.ex.zh, w.ex.py, w.ex.en, { word: w.zh }));
WORDS.forEach(w => add('wordform:' + w.zh, w.zh, w.py, '', { levelOnly: false }));
WORDS.forEach(w => (w.note ? (w.note.match(/[\u4e00-\u9fff]+/g) || []) : []).forEach((t, j) => add('word-note:' + w.zh + '.' + j, t, '', '', { levelOnly: true })));
const WEBS = window[N + '_WEBS'] || null;
const SPEAK = window[N + '_SPEAK'] || null;
const LISTEN = window[N + '_LISTEN'] || null;
const cjkRunsAll = (txt) => (txt || '').match(/[\u4e00-\u9fff]+/g) || [];
if (WEBS) {
  WEBS.hubs.forEach(h => h.gaps.forEach((g, i) => add('hub-gap:' + h.hub + ':' + i, g.zh.replace('___', g.ans), '', g.en)));
  WEBS.topics.forEach(t => add('topic-sentence:' + t.name, t.sentence.zh, t.sentence.py, t.sentence.en));
  WEBS.opps.forEach((o, i) => cjkRunsAll(o.note).forEach((t, j) => add('opposites:' + o.a + '/' + o.b + ':note' + j, t, '', '', { levelOnly: true })));
}
if (SPEAK) {
  SPEAK.scenarios.forEach(s => {
    s.ai.forEach((e, i) => add('scenario:' + s.id + ':ai' + i, e.zh, e.py, e.en));
    s.you.forEach((e, i) => add('scenario:' + s.id + ':you' + i, e.zh, e.py, e.en));
  });
  SPEAK.phrases.forEach((e, i) => add('phrase:' + i, e.zh, e.py, e.en));
}
if (LISTEN) {
  LISTEN.clips.forEach((c, i) => {
    add('clip:' + i, c.zh, c.py, c.en);
    c.notes.forEach((n, j) => cjkRunsAll(n).forEach((t, k) => add('clip:' + i + ':note' + j + '.' + k, t, '', '', { levelOnly: true })));
  });
}
if (GRAM) {
  const cjkRuns = (txt) => (txt || '').match(/[\u4e00-\u9fff]+/g) || [];
  GRAM.lessons.forEach(L => {
    (L.examples || []).forEach((e, i) => add('lesson:' + L.id + ':example' + i, e.zh, e.py, e.en));
    (L.q || []).forEach((q, i) => {
      add('lesson:' + L.id + ':exercise' + (i + 1), q.sentence.zh, q.sentence.py, q.sentence.en);
      (q.levelOnly || []).forEach((t, j) => add('lesson:' + L.id + ':exercise' + (i + 1) + ':wrong' + j, t, '', '', { levelOnly: true }));
      cjkRuns(q.explain).forEach((t, j) => add('lesson:' + L.id + ':exercise' + (i + 1) + ':explain' + j, t, '', '', { levelOnly: true }));
    });
    (L.explain || []).concat(L.mistakes || []).forEach((txt, i) => cjkRuns(txt).forEach((t, j) => add('lesson:' + L.id + ':text' + i + '.' + j, t, '', '', { levelOnly: true })));
    cjkRuns(L.title).forEach((t, j) => add('lesson:' + L.id + ':title' + j, t, '', '', { levelOnly: true }));
  });
}
process.stdout.write(JSON.stringify(out, null, 1));
