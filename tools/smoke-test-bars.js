/* Browser test: on a phone every in-page pill bar (Path | Library, the HSK level pill, Words | Grammar | Test, Listening | Speaking, the Journey views)
 * is the same size: a 40px bar with 32px buttons.
 * Usage: node tools/smoke-test-bars.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const W of [390, 360]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url); await page.waitForSelector('.app');
    for (const sc of ['path', 'library', 'review', 'greview', 'testlobby', 'listen', 'speak', 'journey']) {
      await page.evaluate((s) => window.shanlu.go(s), sc); await page.waitForTimeout(250);
      const bars = await page.evaluate(() => [...document.querySelectorAll('.subnav, .jy-tabw')].filter(e => e.offsetParent).map(e => [Math.round(e.getBoundingClientRect().height), Math.round(e.querySelector('button').getBoundingClientRect().height)]));
      check(bars.length >= 1 && bars.every(b => b[0] === 40 && b[1] === 32), W + 'px ' + sc + ': pill bar is 40px with 32px buttons (' + JSON.stringify(bars) + ')');
    }
    await page.evaluate(() => window.shanlu.go('library')); await page.waitForTimeout(250);
    const sb = await page.evaluate(() => Math.round(document.querySelector('.lib-search').getBoundingClientRect().height));
    check(sb === 40, W + 'px: the Library search box is as tall as the pill bar next to it (' + sb + 'px)');
    // the HSK level pill appears once a second level is open; it must match too
    const lv = await page.evaluate(() => { window.shanlu.go('path'); const m = document.querySelector('main'); const d = document.createElement('div'); d.className = 'seg2 lvseg'; d.innerHTML = '<button>HSK 1</button><button class="on">HSK 2</button>'; m.insertBefore(d, m.firstChild); const r = [Math.round(d.getBoundingClientRect().height), Math.round(d.firstChild.getBoundingClientRect().height)]; d.remove(); return r; });
    check(lv[0] === 40 && lv[1] === 32, W + 'px: the HSK level pill is 40px with 32px buttons (' + JSON.stringify(lv) + ')');
    // the map filters (All, Must-see, Cities, ...) are a scrolling pill bar of the same size, with the same hint
    await page.route(/wikimedia\.org/, r => r.abort());
    await page.evaluate(() => { window.shanlu.setState({ xp: 999999 }); window.shanlu.go('journey'); }); await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => { const a = window.shanlu; a.jyTravel(); a.jyTripClose(); }); await page.waitForTimeout(80); }
    await page.evaluate(() => { window.shanlu.setState({ jyRv: null, jyOpen: null, jyTrip: '', jyPlay: '', jyDone: null, jyTab: 'map' }); }); await page.waitForTimeout(500);
    const fb = await page.evaluate(() => { const w = document.querySelector('.hs-wrap'); if (!w) return null; const t = w.firstElementChild; return { h: Math.round(w.getBoundingClientRect().height), b: Math.round(t.querySelector('button').getBoundingClientRect().height), more: w.classList.contains('has-r'), over: t.scrollWidth > t.clientWidth, doc: document.documentElement.scrollWidth <= innerWidth }; });
    check(fb && fb.h === 40 && fb.b === 32 && fb.more && fb.over && fb.doc, W + 'px: the map filters are a 40px scrolling pill with a more-to-the-right hint (' + JSON.stringify(fb) + ')');
    await page.evaluate(() => document.querySelector('.hs-wrap').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
    await page.locator('.hs-wrap .jy-tabarr.r').click(); await page.waitForFunction(() => document.querySelector('.hs-wrap').firstElementChild.scrollLeft > 50, null, { timeout: 4000 }).catch(() => {});
    check(await page.evaluate(() => document.querySelector('.hs-wrap').firstElementChild.scrollLeft > 50 && document.querySelector('.hs-wrap').classList.contains('has-l')), W + 'px: the filter arrow scrolls the pill and a left arrow appears');
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('pill bar size test passed');
})().catch(e => { console.log('crash', e); process.exit(1); });
