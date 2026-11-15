/* Browser test: on a phone nothing may be wider than the screen (no sideways scrolling anywhere), on every screen and in a Review session with a streak
 * pill showing. Also the Check button of a Review card must not sit under the card's layers.
 * Usage: node tools/smoke-test-no-hscroll.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const screens = ['home', 'path', 'review', 'greview', 'grammar', 'testlobby', 'listen', 'speak', 'journey', 'acct', 'voice', 'friends', 'words', 'library', 'ach', 'guide', 'pinyin', 'exam', 'web'];
  for (const [W, H] of [[390, 763], [360, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(300);
    await page.addStyleTag({ content: '.mstoast{display:none!important}' });
    await page.evaluate(() => { const a = window.shanlu; a.say = () => {}; const ws = JSON.parse(JSON.stringify(a.state.ws)); const keys = Object.keys(ws).slice(0, 12); keys.forEach(z => ['see', 'hear', 'prod'].forEach(k => { ws[z][k] = { s: 2, l: 2, t: Date.now() - 5 * 864e5 }; })); a.setState({ ws, xp: 5000, streak: 4 }); window.__keys = keys; });
    const wide = () => page.evaluate(() => {
      const vw = innerWidth, out = [];
      document.querySelectorAll('.app *').forEach(e => { if (e.closest('.jy-road, .jd-art, .jd-confetti, .jy-tabs, .hs-scroll')) return; /* clipped pictures: their shapes may reach past the frame; the Journey views bar and the map filter bar scroll on purpose (their wrappers, .jy-tabw and .hs-wrap, are still checked) */ const b = e.getBoundingClientRect(); if (b.width && b.height && (b.right > vw + 1 || b.left < -1)) out.push((e.tagName + '.' + String(e.className)).slice(0, 50)); });
      return { doc: document.documentElement.scrollWidth > vw, off: out.slice(0, 3) };
    });
    const bad = [];
    for (const s of screens) { await page.evaluate(s => window.shanlu.go(s), s); await page.waitForTimeout(150); const w = await wide(); if (w.doc || w.off.length) bad.push(s + ' ' + w.off.join(',')); }
    check(bad.length === 0, W + 'px: no screen is wider than the phone (' + bad.join('; ') + ')');
    await page.evaluate(() => { const a = window.shanlu; a.setState({ rq: window.__keys.map(z => z + '#h'), rtotal: 12, rdone: 3, rrun: 14, rcomplete: false }); a.go('review'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const o = document.querySelector('.opt'); if (o) o.click(); }); await page.waitForTimeout(300);
    const w = await wide(); check(!w.doc && w.off.length === 0, W + 'px: a Review card with a 14-in-a-row pill fits the width (' + w.off.join(',') + ')');
    const onTop = await page.evaluate(() => { const c = document.querySelector('.rev > .btn.pri.big'); if (!c) return false; const b = c.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return t === c || c.contains(t); });
    check(onTop, W + 'px: the Check button is not covered by the card');
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failures ? failures + ' failure(s)' : 'no-hscroll test passed'); process.exit(failures ? 1 : 0);
})();
