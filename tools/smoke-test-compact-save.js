/* Regression test: saved and synced progress keeps only the skills that were started, so a word can be saved without a "see" part. A word like that that
 * was also on the "learning" list stopped the whole app from starting (15 Nov 2026, HSK 2). The app must start with it, at HSK 1 and HSK 2.
 * Usage: node tools/smoke-test-compact-save.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const lv of ['1', '2']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 763 }, isMobile: true });
    await ctx.addInitScript((lv) => {
      window.SHANLU_MUTE_SFX = true;
      try {
        if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); localStorage.setItem('shanlu-level', lv); }
        const sd = sessionStorage.getItem('seedData'); if (sd) { const o = JSON.parse(sd); localStorage.setItem(o.key, o.val); sessionStorage.removeItem('seedData'); }
      } catch (e) {}
    }, lv);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await page.goto(url); await page.waitForSelector('.app');
    await page.evaluate((lv) => {
      const w = window['HSK' + lv + '_WORDS'][3].zh; const key = lv === '1' ? 'shanlu-progress-v1' : 'shanlu-progress-v1-l' + lv;
      const st = JSON.parse(localStorage.getItem(key) || '{}');
      st.ws = { [w]: { hear: { s: 2, l: 1, t: Date.now() } } }; st.lrn = { [w]: { at: Date.now() } };   // started by hearing only, and on the learning list
      sessionStorage.setItem('seedData', JSON.stringify({ key, val: JSON.stringify(st) }));
    }, lv);
    await page.reload(); await page.waitForTimeout(1500);
    check(await page.locator('.app').count() === 1 && errs.length === 0, 'HSK ' + lv + ': the app starts with a saved word that has no "see" part (' + errs.join('; ') + ')');
    const full = await page.evaluate(() => { const ws = window.shanlu.state.ws; return Object.keys(ws).every(z => ws[z].see && ws[z].hear && ws[z].prod); });
    check(full, 'HSK ' + lv + ': every word has all three skills once loaded');
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failures ? failures + ' failure(s)' : 'compact save test passed'); process.exit(failures ? 1 : 0);
})();
