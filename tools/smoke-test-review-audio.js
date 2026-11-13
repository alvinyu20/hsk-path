/* Browser test: Review words plays the word by itself where there is something to hear (a new word, a listening card, a flip card once it is
 * turned over), stays silent on the front of a flip card, and the switch in Account turns it off.
 * Usage: node tools/smoke-test-review-audio.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(200);
  // record what would be said instead of making sound
  await page.evaluate(() => {
    const a = window.shanlu; window.__said = [];
    a.say = (t, k) => { window.__said.push(t + '|' + k); };
    const ws = JSON.parse(JSON.stringify(a.state.ws));
    Object.keys(ws).slice(0, 6).forEach(zh => { ws[zh].see = { s: 2, l: 2, t: Date.now() }; });
    a.setState({ ws, rq: [], rcomplete: false });
  });
  const said = () => page.evaluate(() => window.__said.slice());
  const clear = () => page.evaluate(() => { window.__said = []; });
  const kindOf = () => page.evaluate(() => window.shanlu.rKind(window.shanlu.state.rq[0]));

  await page.evaluate(() => { const a = window.shanlu; a.rKind = () => 'flip'; a.go('review'); a.practiceAnyway(); });
  await page.waitForTimeout(500);
  check(await kindOf() === 'flip' && await page.locator('button', { hasText: 'Show answer' }).count() === 1, 'a flip card is showing');
  check((await said()).length === 0, 'the front of a flip card is silent');
  await page.locator('button', { hasText: 'Show answer' }).click(); await page.waitForTimeout(500);
  const afterFlip = await said();
  check(afterFlip.length === 1 && /\|word$/.test(afterFlip[0]), 'turning it over plays the word once (' + afterFlip.join(',') + ')');
  check((await page.locator('.rates .rate').count()) === 4, 'the back shows four ratings');
  await clear();
  await page.locator('.rates .rate').nth(2).click(); await page.waitForTimeout(500);
  check((await said()).length === 0, 'the next card\'s front is silent again');

  // a listening card plays as it arrives
  await clear();
  await page.evaluate(() => { const a = window.shanlu; a.rKind = () => 'audio'; a.setState({ rstep: a.state.rstep + 1 }); });
  await page.waitForTimeout(500);
  const heard = await said();
  check(await page.locator('.listen').count() === 1 && heard.length === 1 && /\|q$/.test(heard[0]), 'a listening card plays its audio as it arrives (' + heard.join(',') + ')');

  // a new word plays as it is introduced
  await clear();
  await page.evaluate(() => { const a = window.shanlu; a.rKind = () => 'intro'; a.setState({ rstep: a.state.rstep + 1 }); });
  await page.waitForTimeout(500);
  const intro = await said();
  check(await page.locator('button', { hasText: 'Got it, ask me soon' }).count() === 1 && intro.length === 1 && /\|word$/.test(intro[0]), 'a new word plays as it is introduced (' + intro.join(',') + ')');

  // the switch in Account
  await page.locator('.side button.me').click(); await page.waitForTimeout(150);
  await page.locator('.acct-dev-h').click(); await page.waitForTimeout(80);
  check((await page.locator('.acct-set', { hasText: 'Review audio' }).innerText()).includes('by themselves'), 'Account says the words play by themselves');
  await page.locator('.acct-set', { hasText: 'Review audio' }).locator('button').click(); await page.waitForTimeout(100);
  check((await page.locator('.acct-set', { hasText: 'Review audio' }).innerText()).includes('wait for a tap'), 'and the switch turns it off');
  await clear();
  await page.evaluate(() => { const a = window.shanlu; a.rKind = () => 'flip'; a.go('review'); a.setState({ rflip: false, rstep: a.state.rstep + 1 }); });
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Show answer' }).click(); await page.waitForTimeout(500);
  check((await said()).length === 0, 'with it off nothing plays by itself');
  await page.locator('button', { hasText: 'Hear the word' }).click(); await page.waitForTimeout(200);
  check((await said()).length === 1, 'the Hear the word button still works');

  await browser.close(); server.close();
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('review audio test passed');
})().catch(e => { console.log('crashed', e); process.exit(1); });
