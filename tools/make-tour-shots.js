/* Retakes the five preview pictures of the first-visit tour (tour/*.jpg) from the running site, on a phone-sized screen with test progress.
 * Needs Playwright, Python with Pillow, and "cd worker && npm install" (the Friends picture uses the test server, with made-up friends).
 * Usage: NODE_PATH=$(npm root -g) node tools/make-tour-shots.js
 * Journey regions and souvenirs are random each time. Look at the pictures before you commit them. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tour-'));
const ymd = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port, site = 'http://127.0.0.1:' + port + '/';
  const { makeWorker } = await import(path.join(root, 'worker', 'test.mjs'));
  const mf = await makeWorker({ ALLOWED_ORIGINS: 'http://127.0.0.1:' + port });
  const api = String(await mf.ready).replace(/\/$/, '');
  const browser = await chromium.launch();
  const init = (u) => { window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; window.SHANLU_FRIENDS_URL = u; const st = document.createElement('style'); st.textContent = '.mstoast{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); };
  const shot = async (page, name) => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(tmp, name + '.png') }); console.log('shot', name); };

  // two made-up friends
  const friend = async (name, mins) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.addInitScript(init, api);
    const p = await ctx.newPage(); await p.goto(site); await p.waitForSelector('.app');
    await p.locator('.navyou .ylink', { hasText: 'Friends' }).click(); await p.waitForSelector('.frjoin');
    await p.fill('#fr-name', name); await p.locator('button', { hasText: 'Join group' }).click(); await p.waitForSelector('.frow');
    await p.evaluate((m) => { const ymd = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; const o = {}; m.forEach((v, i) => { o[ymd(i)] = v; }); window.shanlu.setState({ minLog: o, activity: Object.fromEntries(Object.keys(o).map((k) => [k, true])) }); window.shanlu.persistNow(); }, mins);
    await p.evaluate(() => window.shanlu.friendsPush({}));
  };
  await friend('Mia', [25, 30, 15, 20, 10, 25, 20]);
  await friend('Ben', [10, 0, 15, 10, 0, 20, 5]);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/wikimedia\.org/, (r) => r.abort());
  await ctx.addInitScript(init, api);
  const page = await ctx.newPage(); await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(800);
  // test progress: the units around "Doing things" done up to the speaking stops, greetings words due for review, a week of study
  await page.evaluate(() => {
    const now = Date.now(), DAY = 864e5; const S = window.shanlu.state; const P = window.SHANLU_PATH[1];
    const ws = {}, gres = {}, sres = {};
    ['你好', '您', '再见', '谢谢', '不客气', '对不起', '没关系', '请', '请问', '喂', '没事', '我', '你', '他', '她', '它', '我们'].forEach((z, i) => { ws[z] = { see: { s: 1.5 + (i % 4), t: now - (3 + (i % 3)) * DAY, d: 4 } }; });
    P.units.forEach((u, ui) => u.stops.forEach((s, si) => { if ((ui >= 9 && ui <= 10) || (ui === 11 && si < 5)) { if (s.k === 'w') s.w.forEach((z, i) => { ws[z] = { see: { s: 2 + (i % 3), t: now - 3 * DAY, d: 4 } }; }); if (s.k === 'g') gres[s.g] = 90; if (s.k === 's') sres[s.s] = 1; } }));
    const minLog = {}, act = {}; const ymd = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    [14, 12, 20, 9, 18, 15, 11].forEach((v, i) => { minLog[ymd(i)] = v; act[ymd(i)] = true; });
    window.shanlu.setState({ ws: Object.assign({}, S.ws, ws), gres, sres, xp: 5000000, dayMin: 14, minLog, activity: act, streak: 7, lastActive: ymd(0) });
    window.shanlu.persistNow();
  });
  await page.reload(); await page.waitForSelector('.app'); await page.waitForTimeout(800);

  // 1. the winding Path
  await page.evaluate(() => window.shanlu.go('path')); await page.waitForTimeout(900);
  await page.evaluate(() => { const h = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /^Doing things$/.test(e.textContent.trim())); if (h) { let n = h; for (let i = 0; i < 6 && n; i++, n = n.parentElement) { const b = n.querySelector('button, .linkbtn'); if (b && /Show|Hide/.test(b.textContent)) { if (/Show/.test(b.textContent)) b.click(); break; } } } });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Ask where something is/.test(e.textContent)); if (el) el.scrollIntoView({ block: 'center' }); });
  await shot(page, 'trail');
  // 2. a Review card with its answer showing
  await page.setViewportSize({ width: 390, height: 660 });
  await page.evaluate(() => { window.scrollTo(0, 0); window.shanlu.go('review'); }); await page.waitForTimeout(900);
  await page.locator('button', { hasText: /^Review \d+ words?$/ }).first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('button', { hasText: /^Show answer$/ }).first().click().catch(() => {}); await shot(page, 'review');
  // 3. Home
  await page.setViewportSize({ width: 390, height: 1500 });
  await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(900);
  await page.locator('button', { hasText: 'Not now' }).first().click().catch(() => {}); await shot(page, 'home');
  // 4. the Friends board
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => window.shanlu.go('friends')); await page.waitForTimeout(600);
  await page.fill('#fr-name', 'You'); await page.locator('button', { hasText: 'Join group' }).click(); await page.waitForSelector('.frow');
  await page.evaluate(() => window.shanlu.friendsPush({})); await page.locator('button', { hasText: 'Refresh' }).click().catch(() => {}); await shot(page, 'friends');
  // 5. the Journey: many stops taken, then the map, the Passport and the Shelf
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => window.shanlu.go('journey')); await page.waitForTimeout(900);
  for (let n = 0; n < 700; n++) { await page.evaluate(() => window.shanlu.jyTravel()); await page.waitForTimeout(5); }
  // pictures are cut out by the position of the tabs row, so they do not depend on the page's exact scroll
  const atTabs = async () => page.evaluate(() => { window.scrollTo(0, 0); const b = [...document.querySelectorAll('button, .chip, [role=tab]')].find((e) => /^Map$/.test(e.textContent.trim())); b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); return b.parentElement.getBoundingClientRect().bottom; });
  const clip = async (name, bottom, x, w, h, dy) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(tmp, name + '.png'), clip: { x, y: Math.round(bottom) + 10 + (dy || 0), width: w, height: h } }); console.log('shot', name); };
  await page.evaluate(() => { window.shanlu.setState({ jyRv: null, jyPlay: '', jyTab: 'map', jyReg: null }); }); await page.waitForTimeout(700);
  let bottom = await atTabs(); await clip('jymap', bottom, 10, 370, 285);
  await page.locator('button, .chip, [role=tab]', { hasText: /^Passport$/ }).first().click({ force: true }); bottom = await atTabs(); await clip('jypassport', bottom, 30, 330, 235, 92);
  await page.locator('button, .chip, [role=tab]', { hasText: /^Shelf$/ }).first().click({ force: true }); await page.waitForTimeout(500);
  await page.locator('button, .chip', { hasText: /^Found/ }).first().click({ force: true }).catch(() => {}); bottom = await atTabs(); await clip('jyshelf', bottom, 30, 330, 235, 176);

  await browser.close(); server.close();
  execFileSync('python3', [path.join(__dirname, 'crop-tour-shots.py'), tmp, path.join(root, 'tour')], { stdio: 'inherit' });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
