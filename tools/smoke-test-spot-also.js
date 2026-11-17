/* Browser test: a "spot the extra word" question with a second correct answer (`also`) marks both words right, and any other word wrong.
 * Uses the real HSK 1 item 这个包子很有点儿贵。 (有点 in the default style without 儿) (the extra word is 很; without 有点儿 it is also correct: 这个包子很贵。).
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-spot-also.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(400);
  const q = await page.evaluate(() => { let f = null; window.HSK1_GRAMMAR.lessons.forEach(l => (l.qx || []).forEach(x => { if (x.type === 'spot' && /^这个包子很有点儿?贵$/.test(x.tokens.join(''))) f = x; })); return f; });
  check(q && q.also && q.also.length === 1 && /^有点儿?$/.test(q.tokens[q.also[0]]) && q.tokens[q.spot] === '很', 'the built item lists 有点儿 as a second right answer');
  const tryPick = (word) => page.evaluate(([q, word]) => new Promise((res) => {
    const a = window.shanlu; a.quizQs = [Object.assign({ kicker:'Spot the mistake', prompt:'Tap the word that does not belong', reveal:'这个包子很贵。', explain:'' }, q)];
    a.setState({ screen:'quiz', qi:0, qchecked:false, qchoice:q.tokens.indexOf(word), qfeed:'', qres:[], qscore:0 });
    setTimeout(() => { a.check(); setTimeout(() => res({ ok:a.state.qcorrect, feed:a.state.qfeed }), 50); }, 50);
  }), [q, word]);
  const r1 = await tryPick('很'), r2 = await tryPick(q.tokens[q.also[0]]), r3 = await tryPick('包子');
  check(r1.ok === true && !r1.feed, 'the model answer (很) is right');
  check(r2.ok === true && /Also right/.test(r2.feed) && /有点/.test(r2.feed), 'the second answer (有点儿) is right too, with a note: ' + r2.feed);
  check(r3.ok === false, 'any other word is wrong');
  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' failed' : 'spot also tests passed');
  process.exit(failures ? 1 : 0);
})();
