/* Souvenirs: the data (every one hides in a real, different stop; pictures are valid and script-free), the Shelf tab, and the "You found a souvenir!" card.
 *   node tools/test-souvenirs.js */
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
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; });
  await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url); await page.waitForSelector('.app');

  // ---- the data ----
  const d = await page.evaluate(() => {
    const SV = window.SOUVENIRS || []; const w = window.ShanluJourney.build(window.JOURNEY);
    const bad = []; const seenStop = {}; const seenId = {}; const parser = new DOMParser();
    SV.forEach((s) => {
      const st = w.byStop[s.stop];
      if (!st) bad.push(s.id + ': no such stop ' + s.stop);
      else if (st.kind === 'City' || st.kind === 'Airport') bad.push(s.id + ': hides in a city or airport stop');
      if (seenStop[s.stop]) bad.push(s.id + ': stop already has a souvenir'); seenStop[s.stop] = 1;
      if (seenId[s.id]) bad.push(s.id + ': duplicate id'); seenId[s.id] = 1;
      if (!s.zh || !/^[一-鿿]+$/.test(s.zh)) bad.push(s.id + ': Chinese name must be characters only');
      if (!s.py || !s.en || !s.story) bad.push(s.id + ': needs pinyin, English and a story');
      if (s.story.length > 260) bad.push(s.id + ': story too long');
      const doc = parser.parseFromString(s.svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) bad.push(s.id + ': picture does not parse');
      if (/<script|onload|onclick|href=|<image|<foreignObject/i.test(s.svg)) bad.push(s.id + ': picture has something it should not');
    });
    const regions = {}; SV.forEach((s) => { regions[s.rid] = (regions[s.rid] || 0) + 1; });
    return { n: SV.length, bad, regions: Object.keys(regions).length };
  });
  check(d.n >= 50 && d.n <= 100, 'between 50 and 100 souvenirs (' + d.n + ')');
  check(d.bad.length === 0, 'souvenir data is clean' + (d.bad.length ? ': ' + d.bad.slice(0, 5).join(' | ') : ''));
  check(d.regions >= 25, 'souvenirs are spread over many regions (' + d.regions + ')');

  // ---- the Shelf tab (a journey with a few forced finds) ----
  const exp = await page.evaluate(() => {
    const JY = window.ShanluJourney; const w = JY.build(window.JOURNEY); let st = JY.ensure(w, null, Math.random); st.sd = 'abc';
    const rng = JY.rngFor(st); for (let i = 0; i < 40; i++) { const r = JY.step(w, st, rng, '2026-11-12'); if (!r.stop) break; st = r.st; }
    ['sichuan.a-giant-panda-breeding-base', 'hebei.c-peking-opera'].forEach((id) => { if (st.seen.indexOf(id) < 0) st.seen.push(id); });
    const got = window.SOUVENIRS.filter((s) => st.seen.indexOf(s.stop) >= 0).length;
    const per = JSON.parse(localStorage.getItem('shanlu-person') || '{}'); per.prefs = per.prefs || {}; per.prefs.jy = { v: st, at: Date.now() }; localStorage.setItem('shanlu-person', JSON.stringify(per));
    return { got, total: window.SOUVENIRS.length };
  });
  await page.reload(); await page.waitForSelector('.app');
  await page.locator('.pill.xpp').click(); await page.waitForTimeout(300);
  const tabs = await page.locator('.jy-tabs button').allInnerTexts();
  check(tabs.indexOf('Shelf') >= 0, 'Journey has a Shelf tab (' + tabs.join(', ') + ')');
  const tabBox = await page.evaluate(() => { const t = document.querySelector('.jy-tabs'); return { sw: t.scrollWidth, cw: t.clientWidth }; });
  check(tabBox.sw <= tabBox.cw + 2, 'all tabs fit on a phone without scrolling (' + tabBox.sw + ' in ' + tabBox.cw + ')');
  await page.locator('.jy-tabs button', { hasText: 'Shelf' }).click(); await page.waitForTimeout(300);
  check((await page.locator('.sv-cell').count()) === exp.total, 'the shelf shows every souvenir (' + exp.total + ')');
  check((await page.locator('.sv-cell.got').count()) === exp.got && exp.got >= 2, 'found souvenirs are shown in colour (' + exp.got + ')');
  check((await page.locator('.sv-cell.hid').count()) === exp.total - exp.got, 'the rest stay hidden');
  const hidTxt = await page.evaluate(() => { const c = document.querySelector('.sv-cell.hid'); const s = window.SOUVENIRS.find((x) => c.getAttribute('aria-label').indexOf(x.en) >= 0 || c.innerText.indexOf(x.en) >= 0); return { name: c.querySelector('.sv-name').textContent, leak: !!s }; });
  check(/hidden/i.test(hidTxt.name) && !hidTxt.leak, 'a hidden souvenir does not give its name away (' + hidTxt.name + ')');
  await page.locator('.sv-cell.got').first().click(); await page.waitForTimeout(500);
  check((await page.locator('.sv-detail').count()) === 1 && /[一-鿿]/.test(await page.locator('.sv-detail .zh').innerText()), 'tapping a found souvenir opens its card');
  await page.locator('.sv-cell.hid').first().click(); await page.waitForTimeout(400);
  const hidDetail = await page.evaluate(() => (document.querySelector('.sv-detail') || { innerText: '' }).innerText);
  check(!/[一-鿿]/.test(hidDetail.replace(/[?？]/g, '')), 'tapping a hidden one shows no Chinese or English name');
  await page.locator('.jy-chip', { hasText: 'Found' }).click(); await page.waitForTimeout(300);
  check((await page.locator('.sv-cell').count()) === exp.got && (await page.locator('.sv-cell.hid').count()) === 0, 'the Found filter lists only found souvenirs');

  // ---- arriving at a souvenir stop ----
  await page.evaluate(() => window.shanlu.setState({ jyTab: 'map', jySvSel: null, jyOpen: null, jyRv: { id: 'sichuan.a-giant-panda-breeding-base', ev: ['walk'], region: null, next: null, from: null, k: 0 } }));
  await page.waitForTimeout(600);
  check((await page.locator('.sv-found.new').count()) === 1 && /You found a souvenir/i.test(await page.locator('.sv-found').innerText()), 'arriving at the panda base shows "You found a souvenir!"');
  await page.evaluate(() => window.shanlu.setState({ jyRv: null, jyOpen: 'sichuan.a-giant-panda-breeding-base' })); await page.waitForTimeout(500);
  check((await page.locator('.sv-found').count()) === 1 && !(await page.locator('.sv-found.new').count()), 'opening it again later shows the souvenir without "new"');
  // a stop with no souvenir shows nothing extra
  const plain = await page.evaluate(() => { const w = window.ShanluJourney.build(window.JOURNEY); const have = {}; window.SOUVENIRS.forEach((s) => { have[s.stop] = 1; }); return Object.keys(w.byStop).find((id) => !have[id] && w.byStop[id].kind !== 'City' && w.byStop[id].kind !== 'Airport'); });
  await page.evaluate((id) => { const st = window.shanlu.state; window.shanlu.setState({ jyOpen: id }); }, plain); await page.waitForTimeout(400);
  check((await page.locator('.sv-found').count()) === 0, 'a stop without a souvenir has no souvenir block');

  check(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})();
