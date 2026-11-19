#!/usr/bin/env node
/* "Fill it" gaps where another word may be typed (content/cloze-alts.tsv):
 * an "also" word is marked right with its teaching note, a "wrong" word (a classic mix-up) gets its note and counts as a miss,
 * an "also" word with a wrong tone is close, the expected word is still right, and the Path's multiple-choice gaps never
 * offer an "also" word as a wrong answer. In plain style (the default) the 儿 words in the list are plain too.
 * Run: node tools/smoke-test-cloze-alts.js (needs playwright) */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site); await page.waitForSelector('.app');
  const r = await page.evaluate(() => {
    const T = window.shanlu.testApi;
    const W = window.HSK1_WORDS;
    const exs = [];
    W.forEach((w) => [w.ex].concat(w.more || []).forEach((e) => { if (e.cl) exs.push({ w, e }); }));
    const q = (x) => ({ type: 'cloze', exp: { zh: x.w.zh, py: x.w.py }, accepts: [], cl: x.e.cl });
    const alsoX = exs.find((x) => x.e.cl.some((c) => c.v === 'also'));
    const wrongX = exs.find((x) => x.e.cl.some((c) => c.v === 'wrong'));
    const also = alsoX.e.cl.find((c) => c.v === 'also');
    const wrong = wrongX.e.cl.find((c) => c.v === 'wrong');
    const strip = (py) => py.normalize('NFD').replace(/[̀-ͯ]/g, '');
    // a wrong tone on the "also" word: move every syllable to tone 1 (unless it already is; then tone 4)
    const badTone = (py) => py.normalize('NFD').replace(/[̀-ͯ]/g, (m) => (m === '̄' ? '̀' : '̄')).normalize('NFC');
    const plainYidian = exs.some((x) => x.e.cl.some((c) => c.w === '一点')) && !exs.some((x) => x.e.cl.some((c) => c.w === '一点儿'));
    const avoidOk = (() => {
      const pool = Object.keys(window.shanlu.state.ws).concat([also.w]);
      for (let i = 0; i < 40; i++) {
        const opts = T.plChoices(alsoX.w.zh, 'cloze', pool, 4, [also.w]);
        if (opts.indexOf(also.w) >= 0) return false;
      }
      return true;
    })();
    return {
      count: exs.length,
      sentence: alsoX.e.zh, word: alsoX.w.zh, also: also.w,
      alsoHanzi: T.checkTyped(q(alsoX), also.w),
      alsoPinyin: T.checkTyped(q(alsoX), also.py),
      alsoTone: T.checkTyped(q(alsoX), badTone(also.py)),
      expected: T.checkTyped(q(alsoX), alsoX.w.zh),
      wsentence: wrongX.e.zh, wword: wrongX.w.zh, wrong: wrong.w,
      wrongHanzi: T.checkTyped(q(wrongX), wrong.w),
      plainYidian, avoidOk, strip: strip(also.py),
    };
  });
  check(r.count > 50, 'HSK 1 example sentences carry their listed gap words (' + r.count + ')');
  check(r.alsoHanzi.ok && /^Also right/.test(r.alsoHanzi.note), r.sentence + ': typing ' + r.also + ' for ' + r.word + ' is right, with a note (' + r.alsoHanzi.note + ')');
  check(r.alsoPinyin.ok, '... and so is its pinyin');
  check(!r.alsoTone.ok && r.alsoTone.grade === 'hard' && /check the tone/.test(r.alsoTone.note), '... with a wrong tone it is close, not right (' + r.alsoTone.note + ')');
  check(r.expected.ok, '... and the word the sentence used is still right');
  check(!r.wrongHanzi.ok && r.wrongHanzi.grade === 'again' && /^Not here/.test(r.wrongHanzi.note), r.wsentence + ': typing ' + r.wrong + ' for ' + r.wword + ' is a miss with the teaching note (' + r.wrongHanzi.note + ')');
  check(r.plainYidian, 'in plain style the listed 儿 words are plain too (一点, not 一点儿)');
  check(r.avoidOk, 'the Path\'s multiple-choice gaps never offer an "also" word as a wrong answer');
  check(!errors.length, 'no page errors (' + errors.join('; ') + ')');
  await browser.close(); server.close();
  console.log(fails ? fails + ' FAILED' : 'all cloze-alts checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
