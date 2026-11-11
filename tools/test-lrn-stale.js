/* A word that is already learned but is still listed as "learning" must not make Review say "Learn N new words" (the button could never serve it)
 * or use up the 12-word limit.   node tools/test-lrn-stale.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.SHANLU_AUTO_SHARE = 0; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url); await page.waitForTimeout(800);
  const learn = () => page.evaluate(() => (document.body.innerText.match(/Learn \d+ new words?/g) || []).length);
  // two words that are learned, but still listed as learning (as after marking a word known in another place), one that really is waiting
  const zs = await page.evaluate(() => {
    const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws));
    const fresh = Object.keys(ws).filter((z) => !(ws[z].see.s > 0)).slice(0, 3);
    [fresh[0], fresh[1]].forEach((z) => { ws[z] = { see: { s: 2, t: Date.now(), d: 5 }, hear: ws[z].hear, prod: { s: 1, t: Date.now(), d: 5 } }; });
    const lrn = {}; fresh.forEach((z) => { lrn[z] = { st: 0, m: 0, at: Date.now() }; });
    a.setState({ ws, lrn, rq: [], rcomplete: true, rtotal: 5, rdone: 5, screen: 'review' });
    return fresh;
  });
  await page.waitForTimeout(300);
  check((await page.evaluate(() => (document.body.innerText.match(/Learn (\d+) new word/) || [])[1])) === '1', 'only the word that is really waiting is offered ("Learn 1 new word", not 3)');
  check((await page.evaluate(() => window.shanlu.lrnRoom())) === 11, 'learned words do not use up the 12-word limit');
  // starting the lesson drops the stale entries and serves the real word
  await page.evaluate(() => window.shanlu.reviewMore());
  const st = await page.evaluate((z) => { const S = window.shanlu.state; return { lrn: Object.keys(S.lrn), rq: S.rq.slice() }; }, zs);
  check(st.lrn.length === 1 && st.lrn[0] === zs[2], 'the learned words are removed from the learning list');
  check(st.rq.length === 1 && st.rq[0] === zs[2] + '#l', 'the lesson contains just the one new word');
  // and when nothing is really waiting there is no "Learn new words" prompt at all
  await page.evaluate((z) => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); ws[z] = { see: { s: 2, t: Date.now(), d: 5 }, hear: ws[z].hear, prod: { s: 1, t: Date.now(), d: 5 } }; a.setState({ ws, lrn: { [z]: { st: 0, m: 0, at: Date.now() } }, rq: [], rcomplete: true, screen: 'review' }); }, zs[2]);
  await page.waitForTimeout(300);
  check((await learn()) === 0, 'no "Learn N new words" when only already-learned words are listed as learning');
  // a saved game with such entries is cleaned when it loads
  await page.evaluate(() => { window.shanlu.persistNow(); const k = Object.keys(localStorage).filter((x) => /^shanlu-progress/.test(x)).find((x) => { try { return JSON.parse(localStorage.getItem(x)).lrn; } catch (e) { return false; } }); const o = JSON.parse(localStorage.getItem(k)); const z = Object.keys(o.ws).find((w) => o.ws[w].see && o.ws[w].see.s > 0); o.lrn = Object.assign({}, o.lrn, { [z]: { st: 1, m: 0, at: Date.now() } }); localStorage.setItem(k, JSON.stringify(o)); window.__stale = z; });
  await page.reload(); await page.waitForTimeout(800);
  check(await page.evaluate(() => !(window.shanlu.state.lrn || {})[window.__stale]), 'a saved game with such an entry is cleaned when it loads');
  check(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close(); server.close();
  console.log(failures ? failures + ' failed' : 'learning-list tests passed');
  process.exit(failures ? 1 : 0);
})();
