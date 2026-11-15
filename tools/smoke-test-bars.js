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
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('pill bar size test passed');
})().catch(e => { console.log('crash', e); process.exit(1); });
