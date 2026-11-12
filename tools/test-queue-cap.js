/* Review: typing ("Say it") cards are capped at a third of the recognition cards due, but never below 10, so finishing the recognition
 * cards does not leave 2 typing cards at a time.   node tools/test-queue-cap.js */
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
  // 40 words: recognition not due (far ahead), typing due (a long time ago); then 60 words with recognition due
  const queue = (nSeeDue, nProdDue) => page.evaluate(([nSeeDue, nProdDue]) => {
    const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); const keys = Object.keys(ws); const now = Date.now(); const old = now - 400 * 864e5;
    keys.forEach((z, i) => {
      ws[z].see = i < nSeeDue ? { s:3, l:0, t:old } : { s:900, l:0, t:now };
      ws[z].prod = i >= nSeeDue && i < nSeeDue + nProdDue ? { s:3, l:0, t:old } : { s:900, l:0, t:now };
      ws[z].hear = { s:0, l:0, t:0 };
    });
    a.setState({ ws, lrn:{}, rq:[], rcomplete:false }); a.reviewMore();
    const rq = a.state.rq; return { n:rq.length, prod:rq.filter(x => /#p$/.test(x)).length, see:rq.filter(x => !/#/.test(x)).length };
  }, [nSeeDue, nProdDue]);
  let r = await queue(0, 40);
  check(r.see === 0 && r.prod === 10, 'no recognition cards due, 40 typing cards due: 10 typing cards come (not 2): ' + JSON.stringify(r));
  r = await queue(0, 6);
  check(r.prod === 6, 'only 6 typing cards due: all 6 come: ' + JSON.stringify(r));
  r = await queue(60, 0);
  check(r.see === 60, '60 recognition cards due, none typing: all 60 come: ' + JSON.stringify(r));
  check(errs.length === 0, 'no script errors ' + errs.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
