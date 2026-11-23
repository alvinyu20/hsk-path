/* Browser test for the 14 Nov 2026 changes: Grammar review covers only what is due, the Practice Script plays Mingming's lines by itself,
 * the picture in Account can be a found souvenir, Today > Continue glides to the stop, and the phone layouts of the quiz / Listening lab fit the screen.
 * Usage: node tools/smoke-test-polish.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 763 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(300);

  // ---- Grammar review: due points only ----
  const prep = (mode) => page.evaluate((mode) => {
    const a = window.shanlu; a.say = () => {};
    const g = {}; (window.HSK1_GRAMMAR.lessons || []).forEach(l => { g[l.id] = 90; });
    const gpt = {}; const ids = Object.keys(window.HSK1_GRAMMAR.points ? Object.fromEntries(window.HSK1_GRAMMAR.points.map(p => [p.id, 1])) : {});
    if (mode === 'none') ids.forEach(id => { gpt[id] = { r: { s: 40, t: Date.now() }, rn: 1, rok: 1 }; });                       // all reviewed just now: nothing due
    if (mode === 'two') ids.forEach((id, i) => { gpt[id] = i < 2 ? { r: { s: 1, t: Date.now() - 20 * 864e5 }, rn: 1, rok: 1 } : { r: { s: 40, t: Date.now() }, rn: 1, rok: 1 }; });   // two overdue
    a.setState({ gres: g, gpt });
    a.go('greview'); a.startGrammarReview(true);
    return { n: a.quizQs.length, total: ids.length };
  }, mode);
  const two = await prep('two');
  check(two.n === 2, 'Grammar review covers only the 2 due points, not a fixed 8 (got ' + two.n + ' of ' + two.total + ' points)');
  const none = await prep('none');
  check(none.n > 0 && none.n <= 8, 'with nothing due a short practice set is offered instead (got ' + none.n + ')');
  await page.evaluate(() => window.shanlu.go('greview')); await page.waitForTimeout(300);
  const lab = await page.evaluate(() => ({ scr: window.shanlu.state.screen, h: (document.querySelector('.res-h') || {}).textContent, btn: [...document.querySelectorAll('.res-act .btn')].map(b => b.textContent.trim()) }));
  check(lab.scr === 'greview' && /all caught up/.test(lab.h) && lab.btn.some(b => /Practise points anyway/.test(b)) && lab.btn.some(b => /grammar points/.test(b)), 'with nothing due, Grammar review shows the all-caught-up page, not a lobby (' + JSON.stringify(lab) + ')');
  await page.evaluate(() => window.shanlu.startGrammarReview(true)); await page.waitForTimeout(300);
  check(/No tones needed/.test(await page.locator('.tone-note').innerText()), 'Grammar review says tones are not needed');
  const fit = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight, am: document.querySelector('.app').classList.contains('am') }));
  check(fit.am && fit.doc <= fit.vh + 1, 'the Grammar review session fits the phone screen without page scrolling (' + fit.doc + ' of ' + fit.vh + ')');
  // lantern progress like the word Review
  const lan0 = await page.evaluate(() => ({ n: document.querySelectorAll('.q-lants .lan').length, lit: document.querySelectorAll('.q-lants .lan.lit').length, segs: document.querySelectorAll('.q-top .segs').length, txt: (document.querySelector('.q-lants .rev-n') || {}).textContent }));
  check(lan0.n === 10 && lan0.lit === 0 && lan0.segs === 0, 'Grammar review shows ten lanterns, none lit at the start, and no segment bar (' + JSON.stringify(lan0) + ')');
  const lanHalf = await page.evaluate(() => { const a = window.shanlu; const n = a.quizQs.length; const half = Math.floor(n / 2); a.setState({ qres: Array.from({ length: half }, () => true) }); return new Promise(r => setTimeout(() => r({ n, half, lit: document.querySelectorAll('.q-lants .lan.lit').length, txt: document.querySelector('.q-lants .rev-n').textContent, w: document.documentElement.scrollWidth, vw: innerWidth }), 200)); });
  check(lanHalf.lit === Math.floor(lanHalf.half / lanHalf.n * 10) && lanHalf.lit > 0 && lanHalf.txt.indexOf(lanHalf.half + ' of ' + lanHalf.n) === 0 && lanHalf.w <= lanHalf.vw, 'lanterns light as questions are answered (' + JSON.stringify(lanHalf) + ')');
  await page.screenshot({ path: '/tmp/lay/grv-lanterns.png' });
  await page.evaluate(() => window.shanlu.go('gtrack')); await page.waitForTimeout(300);
  const gt = await page.evaluate(() => ({ cells: document.querySelectorAll('.gtrack .gcell').length, rows: document.querySelectorAll('.gtrack .grv-pt').length, crumb: !!document.querySelector('.crumb') && getComputedStyle(document.querySelector('.crumb')).display !== 'none', side: document.documentElement.scrollWidth <= innerWidth + 1 }));
  check(gt.cells === 5 && gt.rows > 10 && gt.crumb && gt.side, 'the Library has a Grammar points garden with the five stages and a row per point (' + JSON.stringify(gt) + ')');
  await page.locator('.gtrack .gcell').nth(4).click(); await page.waitForTimeout(150);
  check(await page.evaluate(() => [...document.querySelectorAll('.gtrack .grv-pt')].every(r => r.classList.contains('mastered'))), 'tapping a stage in the garden filters the points');
  await page.evaluate(() => window.shanlu.go('library')); await page.waitForTimeout(200);
  check(await page.locator('.lib-tile.lt-gpoints').count() === 1, 'the Library lists Grammar points beside Words');
  // the page title sits in the top bar on phones, with no picture banner above the page
  await page.evaluate(() => window.shanlu.go('library')); await page.waitForTimeout(250);
  const hd = await page.evaluate(() => { const m = document.querySelector('.m-title'); const s = document.querySelector('.side').getBoundingClientRect(); const first = document.querySelector('.main').firstElementChild; return { title: m && m.textContent.trim(), vis: !!m && getComputedStyle(m).display !== 'none', topH: Math.round(s.height), art: [...document.querySelectorAll('.top-art')].some(a => a.getBoundingClientRect().height > 0), firstTop: Math.round(first.getBoundingClientRect().top) }; });
  check(hd.title === 'Library' && hd.vis && hd.topH <= 70 && !hd.art && hd.firstTop < 100, 'on a phone the page title is in the top bar and there is no picture banner (' + JSON.stringify(hd) + ')');
  await page.evaluate(() => window.shanlu.go('friends')); await page.waitForTimeout(250);
  check(await page.evaluate(() => document.querySelector('.side').getBoundingClientRect().height <= 70), 'a short page does not stretch the top bar');
  // Talk with AI on a phone: Free chat has a picture, and a Situation bar opens a list to pick from
  await page.evaluate(() => { const a = window.shanlu; a.aiAsk = async () => {}; a.say = () => {}; a.setState({ aiOn: true, aiMode: true, aiScn: -1, aim: [{ who: 'ai', zh: '你好', en: 'Hello', py: 'nǐ hǎo', outside: [], pv: [] }] }); a.go('speak'); });
  await page.waitForTimeout(400);
  const sit = await page.evaluate(() => ({ bar: !!document.querySelector('.sit-bar') && getComputedStyle(document.querySelector('.sit-bar')).display !== 'none', label: (document.querySelector('.sit-l b') || {}).textContent, staged: document.querySelector('.chat').classList.contains('staged') }));
  check(sit.bar && sit.label === 'Free chat' && sit.staged, 'Talk with AI: Free chat has a picture and a Situation bar is on the phone screen (' + JSON.stringify(sit) + ')');
  await page.locator('.sit-bar').click(); await page.waitForTimeout(250);
  const rows = await page.evaluate(() => ({ n: document.querySelectorAll('.sit-sheet .scn').length, thumbs: document.querySelectorAll('.sit-sheet .scn-th').length }));
  check(rows.n > 5 && rows.thumbs === rows.n, 'the Situation list opens with a picture for each row (' + JSON.stringify(rows) + ')');
  await page.locator('.sit-sheet .scn').nth(2).click(); await page.waitForTimeout(250);
  const picked = await page.evaluate(() => ({ scn: window.shanlu.state.aiScn, open: !!document.querySelector('.sit-sheet') }));
  check(picked.scn === 1 && !picked.open, 'picking a situation starts it and closes the list (' + JSON.stringify(picked) + ')');
  await page.evaluate(() => window.shanlu.go('home'));

  // ---- Practice Script: Mingming's lines play by themselves ----
  await page.evaluate(() => { const a = window.shanlu; window.__said = []; a.say = (t, k) => { window.__said.push(k); }; a.go('speak'); a.pickScenario(0); });
  await page.waitForTimeout(200);
  let said = await page.evaluate(() => window.__said.slice());
  check(said.includes('ai0'), 'opening a practice script plays the first line by itself (' + said.join(',') + ')');
  await page.evaluate(() => window.shanlu.sayIt()); await page.waitForTimeout(100);
  said = await page.evaluate(() => window.__said.slice());
  check(said.includes('ai1'), 'after you say your line the next line plays by itself even with the text showing');

  // ---- the picture: a souvenir you have found ----
  await page.evaluate(() => { const a = window.shanlu; a.setState({ xp: 99999 }); a.go('journey'); a.jyTravel(); a.jyTripClose(); });
  await page.evaluate(() => { const P = JSON.parse(localStorage.getItem('shanlu-person')); const st0 = window.shanlu.testApi.jyRead(); const v0 = Object.assign({}, st0, { seen: st0.seen.concat(window.SOUVENIRS.slice(0, 2).map(s => s.stop)) }); delete v0.dates; P.prefs.jy.v = v0; /* (an older, unpacked save: still read) */ P.prefs.jy.at = Date.now() + 1000; localStorage.setItem('shanlu-person', JSON.stringify(P)); });
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate(() => window.shanlu.go('acct')); await page.waitForTimeout(200);
  await page.locator('text=Change picture').click();
  check(await page.locator('.av-it').count() === 3, 'the picker offers the initial and the 2 souvenirs found, not the other souvenirs: ' + await page.locator('.av-it').count());
  await page.locator('.av-it').nth(1).click(); await page.waitForTimeout(200);
  check(await page.locator('.acct-av img').count() === 1 && await page.locator('.acct-mini img').count() === 1, 'the chosen souvenir replaces the initial');
  await page.reload(); await page.waitForSelector('.app'); await page.evaluate(() => window.shanlu.go('acct')); await page.waitForTimeout(200);
  check(await page.locator('.acct-av img').count() === 1, 'the picture is still there after a reload');

  // ---- Listening lab fits and keeps its padding ----
  await page.evaluate(() => window.shanlu.go('listen')); await page.waitForTimeout(300);
  const tile = await page.evaluate(() => { const b = document.querySelector('.labtiles button'); const s = getComputedStyle(b); const h = b.querySelector('b').getBoundingClientRect(), r = b.getBoundingClientRect(); return { pad: parseFloat(s.paddingTop), gap: r.bottom - h.bottom, h: r.height }; });
  check(tile.pad >= 5 && tile.gap >= 4 && tile.h <= 80, 'the Listening mode cards keep their padding on a phone (top ' + tile.pad + ', below the text ' + tile.gap.toFixed(1) + ')');

  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('polish browser tests passed');
})();
