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
    a.go('greview'); a.startGrammarReview();
    return { n: a.quizQs.length, total: ids.length };
  }, mode);
  const two = await prep('two');
  check(two.n === 2, 'Grammar review covers only the 2 due points, not a fixed 8 (got ' + two.n + ' of ' + two.total + ' points)');
  const none = await prep('none');
  check(none.n > 0 && none.n <= 8, 'with nothing due a short practice set is offered instead (got ' + none.n + ')');
  await page.evaluate(() => window.shanlu.go('greview')); await page.waitForTimeout(300);
  const lab = await page.evaluate(() => { return document.querySelector('.grv-go .btn.pri') ? document.querySelector('.grv-go .btn.pri').textContent : ''; });
  check(/Nothing due/.test(lab), 'the Grammar review button says nothing is due: ' + lab);
  await page.evaluate(() => window.shanlu.startGrammarReview()); await page.waitForTimeout(300);
  const fit = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight, am: document.querySelector('.app').classList.contains('am') }));
  check(fit.am && fit.doc <= fit.vh + 1, 'the Grammar review session fits the phone screen without page scrolling (' + fit.doc + ' of ' + fit.vh + ')');

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
  await page.evaluate(() => { const P = JSON.parse(localStorage.getItem('shanlu-person')); P.prefs.jy.v.seen = P.prefs.jy.v.seen.concat(window.SOUVENIRS.slice(0, 2).map(s => s.stop)); P.prefs.jy.at = Date.now() + 1000; localStorage.setItem('shanlu-person', JSON.stringify(P)); });
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate(() => window.shanlu.go('acct')); await page.waitForTimeout(200);
  await page.locator('text=Change my picture').click();
  check(await page.locator('.av-it').count() === 3, 'the picker offers the initial and the 2 souvenirs found, not the other souvenirs: ' + await page.locator('.av-it').count());
  await page.locator('.av-it').nth(1).click(); await page.waitForTimeout(200);
  check(await page.locator('.acct-av img').count() === 1 && await page.locator('.acct-mini img').count() === 1, 'the chosen souvenir replaces the initial');
  await page.reload(); await page.waitForSelector('.app'); await page.evaluate(() => window.shanlu.go('acct')); await page.waitForTimeout(200);
  check(await page.locator('.acct-av img').count() === 1, 'the picture is still there after a reload');

  // ---- Listening lab fits and keeps its padding ----
  await page.evaluate(() => window.shanlu.go('listen')); await page.waitForTimeout(300);
  const tile = await page.evaluate(() => { const b = document.querySelector('.labtiles button'); const s = getComputedStyle(b); const h = b.querySelector('.lt-d').getBoundingClientRect(), r = b.getBoundingClientRect(); return { pad: parseFloat(s.paddingTop), gap: r.bottom - h.bottom }; });
  check(tile.pad >= 10 && tile.gap >= 10, 'the Listening mode cards keep their padding on a phone (top ' + tile.pad + ', below the text ' + tile.gap.toFixed(1) + ')');

  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('polish browser tests passed');
})();
