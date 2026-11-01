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

if (plain) { require(path.join(dir, 'hsk1-erhua.js')); const E = require(path.join(__dirname, '..', 'erhua.js')); E.make(window.HSK1_ERHUA).apply(window); }

const N = 'HSK' + level;
const H = window[N] || {};
const WORDS = window[N + '_WORDS'] || [];
const GRAM = window[N + '_GRAMMAR'] || null;
const out = [];
const add = (where, zh, py, en, extra) => { if (zh) out.push(Object.assign({ where, zh, py: py || '', en: en || '' }, extra || {})); };

WORDS.forEach(w => add('word:' + w.zh, w.ex.zh, w.ex.py, w.ex.en, { word: w.zh }));
WORDS.forEach(w => (w.more || []).forEach((e, i) => add('word-extra:' + w.zh + ':' + (i + 1), e.zh, e.py, e.en, { word: w.zh })));
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
const EXAM = window[N + '_EXAM'] || null;
if (EXAM && level === '2') {
  // HSK 2 layout: L1 picture + sentence (true/false), L2 dialogue sets, L3/L4 dialogue + question + options, R1 sentence sets, R2 blanks, R3 sentence pairs, R4 question/answer sets
  EXAM.L1.forEach((e, i) => add('exam:L1:' + i, e.zh, e.py, e.en));
  EXAM.L2.forEach((st, a) => st.items.forEach((it, i) => it.say.forEach((l, k) => add('exam:L2:' + a + '.' + i + '.' + k, l.zh, l.py, l.en))));
  ['L3', 'L4'].forEach(p => EXAM[p].forEach((e, i) => { e.say.forEach((l, k) => add('exam:' + p + ':' + i + '.' + k, l.zh, l.py, l.en)); add('exam:' + p + ':' + i + ':question', e.q.zh, e.q.py, e.q.en); e.opts.forEach((o, k) => add('exam:' + p + ':' + i + ':option' + k, o.zh, o.py, '', { levelOnly: true })); }));
  EXAM.R1.forEach((st, a) => st.items.forEach((it, i) => add('exam:R1:' + a + '.' + i, it.zh, it.py, it.en)));
  EXAM.R2.forEach((st, a) => st.items.forEach((it, i) => add('exam:R2:' + a + '.' + i, it.full, it.py, it.en)));
  EXAM.R3.forEach((e, i) => { add('exam:R3:' + i + ':first', e.a.zh, e.a.py, e.a.en); add('exam:R3:' + i + ':second', e.b.zh, e.b.py, e.b.en); });
  EXAM.R4.forEach((st, a) => st.items.forEach((it, i) => { add('exam:R4:' + a + '.' + i + ':question', it.zh, it.py, it.en); add('exam:R4:' + a + '.' + i + ':answer', st.opts[it.ans].zh, st.opts[it.ans].py, st.opts[it.ans].en); }));
}
if (EXAM && level === '1') {
  ['L1', 'R1'].forEach(p => EXAM[p].forEach((e, i) => add('exam:' + p + ':' + i, e.zh, e.py, e.en, { fragment: true })));
  EXAM.L2.forEach((e, i) => add('exam:L2:' + i, e.zh, e.py, e.en));
  EXAM.L3.forEach((s, a) => s.items.forEach((it, i) => it.say.forEach((l, k) => add('exam:L3:' + a + '.' + i + '.' + k, l.zh, l.py, l.en))));
  EXAM.L4.forEach((e, i) => { e.say.forEach((l, k) => add('exam:L4:' + i + '.' + k, l.zh, l.py, l.en)); add('exam:L4:' + i + ':question', e.q.zh, e.q.py, e.q.en); e.opts.forEach((o, k) => add('exam:L4:' + i + ':option' + k, o.zh, o.py, '', { levelOnly: true })); });
  EXAM.R2.forEach((s, a) => s.items.forEach((it, i) => add('exam:R2:' + a + '.' + i, it.zh, it.py, it.en)));
  EXAM.R3.forEach((s, a) => s.items.forEach((it, i) => { add('exam:R3:' + a + '.' + i + ':question', it.zh, it.py, it.en); add('exam:R3:' + a + '.' + i + ':answer', s.opts[it.ans].zh, s.opts[it.ans].py, s.opts[it.ans].en); }));
  EXAM.R4.forEach((s, a) => s.items.forEach((it, i) => add('exam:R4:' + a + '.' + i, it.full, it.py, it.en)));
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
