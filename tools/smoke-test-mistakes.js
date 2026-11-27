/* Browser test for the mistake notebook (Review > Mistakes) and tricky words (D7): a wrong answer on a Path stop is logged, can be asked about
 * and the AI's answer saved with it, "Got it" puts it away and "Clear them" removes it; a word forgotten 4+ times shows the tricky-word box on its
 * Review card, is listed as a tricky word, and "Practise" starts a Review session with it. The AI is faked with window.SHANLU_ASK_FAKE.
 * Usage: NODE_PATH="$(npm root -g)" node tools/smoke-test-mistakes.js */
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
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(() => {
    window.SHANLU_MUTE_SFX = true;
    window.SHANLU_ASK_FAKE = async () => JSON.stringify({ answer: 'They look alike, but the meanings differ.', examples: [{ zh: '你好！', en: 'Hello!' }], card_wrong: false, card_note: '' });
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(site); await page.waitForSelector('.app');
  await page.evaluate(() => window.shanlu.setState({ aiOn: true }));
  const person = () => page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs || {});

  // 1. a wrong answer on the first Path stop is logged
  await page.evaluate(() => window.shanlu.go('mistakes')); await page.waitForTimeout(120);
  check(await page.locator('.nb .res-h:has-text("No mistakes yet")').count() === 1, 'an empty notebook says so');
  check(await page.locator('.navsub .subl:has-text("Mistakes"), .subl:has-text("Mistakes")').count() >= 1, 'Mistakes is in the Review section');
  await page.evaluate(() => window.shanlu.go('path')); await page.waitForTimeout(150);
  await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);
  await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
  for (let g = 0; g < 20 && await page.locator('.pl-meet').count(); g++) { await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(30); }
  const step = await page.evaluate(() => { const pl = window.shanlu.state.pl; const s = pl.steps[pl.i]; return { zh: s.zh, opts: s.opts }; });
  const wrong = step.opts.findIndex(o => o !== step.zh);
  await page.locator('.q-card .opt').nth(wrong).click(); await page.waitForTimeout(80);
  let nb = (await person()).mistakes;
  check(nb && nb.v.e.length === 1 && nb.v.e[0].word === step.zh && nb.v.e[0].kind === 'path', 'the wrong Path answer is in the notebook');
  check(nb && nb.v.e[0].mix === step.opts[wrong], 'the word picked by mistake is kept as the mix-up');
  await page.evaluate(() => window.shanlu.go('mistakes')); await page.waitForTimeout(150);
  check(await page.locator('.nb-row').count() === 1, 'the Mistakes page lists it');
  check((await page.locator('.nb-row .nb-zh').first().textContent()).trim() === step.zh, 'with the word it was about');
  check(await page.locator('.nb-row .nb-mix').count() === 1, 'and the word it was mixed up with');

  // 2. ask about it later and save the AI's answer with it
  await page.locator('.nb-row .btn:has-text("Ask the AI")').click(); await page.waitForTimeout(120);
  check(await page.locator('.ask-wrap').count() === 1, '"Ask the AI" opens the help sheet');
  await page.locator('.ask-chip').first().click(); await page.waitForSelector('.ask-ai .ask-a'); await page.waitForTimeout(60);
  check(await page.locator('.ask-save').count() === 1, 'an answer about a mistake can be saved to the notebook');
  await page.locator('.ask-save').click(); await page.waitForTimeout(60);
  check((await page.locator('.ask-save').textContent()).includes('Saved'), 'the button says it was saved');
  await page.evaluate(() => window.shanlu.setState({ ask: null })); await page.waitForTimeout(100);
  check(await page.locator('.nb-row .nb-ai').count() === 1 && (await page.locator('.nb-row .nb-ai p').textContent()).includes('meanings differ'), 'the saved answer shows with the mistake');
  if (process.env.SHOTS) await page.locator('.nb').screenshot({ path: process.env.SHOTS + '/nb.png' });

  // 3. Got it, then Clear them
  await page.locator('.nb-gotit').first().click(); await page.waitForTimeout(100);
  check(await page.locator('.nb-row').count() === 0 && await page.locator('.nb-gotbar').count() === 1, '"Got it" puts the mistake away');
  await page.locator('.nb-gotbar .linkbtn').first().click(); await page.waitForTimeout(80);
  check(await page.locator('.nb-row.nb-got').count() === 1, 'the ones you have got can be shown again');
  await page.locator('.nb-gotbar .linkbtn:has-text("Clear")').click(); await page.waitForTimeout(80);
  nb = (await person()).mistakes;
  check(nb.v.e.length === 0 && nb.v.cut > 0, '"Clear them" removes them for good');

  // 4. tricky words: 好 forgotten 4 times before; once more in Review makes 5
  await page.evaluate(() => {
    const s = window.shanlu; const ws = Object.assign({}, s.state.ws); const w = ws['好'];
    ws['好'] = { see: { s: 3, t: Date.now() - 30 * 864e5, d: 6 }, hear: w.hear, prod: w.prod };
    const P = JSON.parse(localStorage.getItem('shanlu-person')); P.prefs.lapse = { v: { '好': 4 }, at: Date.now() }; localStorage.setItem('shanlu-person', JSON.stringify(P));
    s.setState({ ws });
  });
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate(() => window.shanlu.go('mistakes')); await page.waitForTimeout(150);
  check(await page.locator('.nb-trk-i:has-text("好")').count() === 1, 'a word forgotten 4 times is listed as a tricky word');
  check(await page.locator('.nb-go .btn').count() === 1, 'there is a button to practise the tricky words');
  await page.locator('.nb-go .btn').click(); await page.waitForTimeout(150);
  const rq = await page.evaluate(() => ({ screen: window.shanlu.state.screen, rq: window.shanlu.state.rq }));
  check(rq.screen === 'review' && rq.rq.some(x => /^好(#h)?$/.test(x)), 'Practise starts a Review session with it');
  await page.evaluate(() => window.shanlu.setState({ rq: ['好'], rflip: true })); await page.waitForTimeout(120);
  const kind = await page.evaluate(() => window.shanlu.rKind('好'));
  if (kind !== 'flip') { await page.evaluate(() => window.shanlu.setState({ qchecked: true, qcorrect: false })); await page.waitForTimeout(120); }
  check(await page.locator('.leech').count() === 1, 'its Review card shows the tricky-word box after the answer (' + kind + ')');
  if (process.env.SHOTS) { await page.locator('.leech').scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SHOTS + '/leech.png' }); }
  check(await page.locator('.leech-ex .zh, .leech-vs').count() >= 1, 'with a second example or the word it is mixed up with');
  await page.evaluate(() => window.shanlu.setState({ rflip: false, qchecked: false })); await page.waitForTimeout(80);
  check(await page.locator('.leech').count() === 0, 'but not before the answer');
  await page.evaluate(() => { window.shanlu.setState({ rq: ['好'], rflip: true }); window.shanlu.rate('again'); window.shanlu.setState({ rq: ['好'], rflip: true }); window.shanlu.rate('again'); });
  check(((await person()).lapse || {}).v['好'] === 5, 'Again on a learned word counts one lapse, once per session');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all mistake notebook checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
