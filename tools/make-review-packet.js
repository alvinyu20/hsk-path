#!/usr/bin/env node
/* Builds a packet a Chinese teacher or native speaker can review quickly:
 *   review/HSK1-review-packet.md   questions, grammar lessons, scripts, word notes (read and mark up)
 *   review/HSK1-sentences.csv      every sentence once, with empty columns "ok?" and "correction" (open in a spreadsheet)
 * Usage: node tools/make-review-packet.js */
const fs = require('fs');
const path = require('path');
global.window = {};
const root = path.join(__dirname, '..');
['words', 'grammar', 'webs', 'speak', 'listen'].forEach(n => require(path.join(root, 'data', 'hsk1-' + n + '.js')));
const W = window.HSK1_WORDS, G = window.HSK1_GRAMMAR.lessons, V = window.HSK1_WEBS, S = window.HSK1_SPEAK, L = window.HSK1_LISTEN;
const out = [];
const md = (s) => out.push(s);

md('# HSK 1 review packet\n');
md('This packet holds all the Chinese on the Shanlu study site for HSK 1 (the 300-word list of the 2025 HSK 3.0 exam syllabus). It was written and checked by AI. **No human teacher has reviewed it.** Thank you for helping.\n');
md('## How to help\n');
md('- Skim for anything wrong, unnatural, or misleading for a learner. Natural-sounding matters as much as grammatical.');
md('- Pay most attention to **grammar explanations** and **example sentences**. A learner will trust these.');
md('- The spreadsheet `HSK1-sentences.csv` has one row per sentence. Put a mark in "ok?" and a fix in "correction" where needed.');
md('- Section 1 lists questions I could not settle myself.\n');

md('## 1. Questions only a native speaker can settle\n');
fs.readFileSync(path.join(root, 'content', 'ask-a-teacher.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).forEach((l, i) => {
  const p = l.split('\t'); md((i + 1) + '. **' + p[1] + '** (' + p[0] + '): ' + p[2]);
});

md('\n## 2. Grammar lessons (' + G.length + ')\n');
G.forEach((l, i) => {
  md('### ' + (i + 1) + '. ' + l.title + '\n');
  md('Pattern: ' + l.formula.map(f => f.t).join(' + ') + '\n');
  l.explain.forEach(t => md('- ' + t));
  if (l.mistakes.length) { md('\nCommon mistakes taught:'); l.mistakes.forEach(t => md('- ' + t)); }
  md('\nExamples:\n');
  l.examples.forEach(e => md('- ' + e.zh + '  ' + e.py + '  — ' + e.en));
  md('');
});

md('## 3. Speaking scripts\n');
S.scenarios.forEach(s => {
  md('### ' + s.title + '\n');
  s.ai.forEach((a, k) => { md('- Speaker: ' + a.zh + '  — ' + a.en); if (s.you[k]) md('- Learner: ' + s.you[k].zh + '  — ' + s.you[k].en); });
  md('');
});

md('## 4. Listening clips and what to listen for\n');
L.clips.forEach((c, i) => { md((i + 1) + '. ' + c.zh + '  ' + c.py + '  — ' + c.en); c.notes.forEach(n => md('   - ' + n)); });

md('\n## 5. Word webs\n');
md('### Shared-character groups (the small glosses under each word)\n');
V.hubs.forEach(h => { md('**' + h.hub + '** (' + h.py + ', ' + h.en + ')\n'); h.words.forEach(w => md('- ' + w.zh + ' = ' + w.parts[0][0] + ' (' + w.parts[0][1] + ') + ' + w.parts[1][0] + ' (' + w.parts[1][1] + ')')); md(''); });
md('### Opposite pairs and their notes\n');
V.opps.forEach(o => md('- ' + o.a + ' / ' + o.b + ': ' + o.note));
md('\n### Topic sentences\n');
V.topics.forEach(t => md('- ' + t.name + ': ' + t.sentence.zh + '  ' + t.sentence.py + '  — ' + t.sentence.en));

md('\n## 6. The 300 words: gloss and example\n');
md('| Word | Pinyin | Meaning shown | Example | Pinyin | English |');
md('|---|---|---|---|---|---|');
W.forEach(w => md('| ' + w.zh + ' | ' + w.py + ' | ' + w.en + ' | ' + w.ex.zh + ' | ' + w.ex.py + ' | ' + w.ex.en + ' |'));

fs.mkdirSync(path.join(root, 'review'), { recursive: true });
fs.writeFileSync(path.join(root, 'review', 'HSK1-review-packet.md'), out.join('\n') + '\n');

// csv: every distinct sentence once
const rows = []; const seen = new Set();
const add = (where, zh, py, en) => { const k = zh + '|' + en; if (!zh || !en || seen.has(k)) return; seen.add(k); rows.push([where, zh, py, en]); };
W.forEach(w => add('word ' + w.zh, w.ex.zh, w.ex.py, w.ex.en));
G.forEach(l => { l.examples.forEach(e => add('grammar: ' + l.title, e.zh, e.py, e.en)); l.q.forEach(q => add('grammar exercise: ' + l.title, q.sentence.zh, q.sentence.py, q.sentence.en)); });
V.hubs.forEach(h => h.gaps.forEach(g => add('word web gap: ' + h.hub, g.zh.replace('___', g.ans), '', g.en)));
V.topics.forEach(t => add('topic: ' + t.name, t.sentence.zh, t.sentence.py, t.sentence.en));
S.scenarios.forEach(s => s.ai.concat(s.you).forEach(e => add('script: ' + s.title, e.zh, e.py, e.en)));
S.phrases.forEach(e => add('survival phrase', e.zh, e.py, e.en));
L.clips.forEach(c => add('listening clip', c.zh, c.py, c.en));
const q = (x) => '"' + String(x).replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(root, 'review', 'HSK1-sentences.csv'), '﻿' + ['where,chinese,pinyin,english,"ok?",correction'].concat(rows.map(r => r.map(q).join(',') + ',,')).join('\n') + '\n');
console.log('wrote review/HSK1-review-packet.md and review/HSK1-sentences.csv (' + rows.length + ' distinct sentences)');
