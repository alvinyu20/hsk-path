/* Browser test for the listening ladder: speed rungs on Listening lab clips (Dictation) and shadowing with a recording played back after the clip.
 * The microphone is Chromium's fake device (a steady tone), so the recording always "hears" something.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-ladder.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const tap = async (loc) => { await loc.evaluate(e => e.scrollIntoView({ block: 'center' })); await loc.click(); };
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const waitFor = async (page, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(150); } return false; };
(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  for (const vp of [{ width: 1200, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp, permissions: ['microphone'] });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_MEAN_MIX = 0; window.SHANLU_SH_RAW = true; localStorage.setItem('shanlu-progress-v1', JSON.stringify({ xp: 0, dayXp: 0 })); });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(400);
    const tag = vp.width < 600 ? ' (phone)' : ' (desktop)';
    await page.evaluate(() => { window.shanlu.go('listen'); window.shanlu.setState({ lmode: 'dict' }); });
    await page.waitForSelector('.dict');
    // the speed ladder: 0.6× as a helper, then the four rungs
    const lad = await page.locator('.dict .ladder .lad').allInnerTexts();
    check(lad.join(' ') === '0.6× 0.8× 1× 1.25× 1.5×', 'the Dictation speed ladder goes up to 1.5× (' + lad.join(' ') + ')' + tag);
    check(await page.locator('.dict .rung').count() === 4 && /Next rung: 0\.8×/.test(await page.locator('.dict .rung-t').innerText()), 'a new clip shows four rungs, 0.8× next' + tag);
    // all words right, heard only at 1.25×: rungs up to 1.25× and +3 coins on top of a coin a word
    const keys = () => window.shanlu.state && (window.HSK1_LISTEN.clips[window.shanlu.state.dclip].words.map(w => w.key).join(' '));
    await tap(page.locator('.dict .ladder .lad', { hasText: '1.25×' }));
    await tap(page.locator('.dict button[aria-label="Play the clip"]'));
    check(await page.evaluate(() => window.shanlu.state.dmin === 1.25) && /counts for the 1\.25× rung \(\+3 coins\)/.test(await page.locator('.dict .rung-t').innerText()), 'playing at 1.25× makes this try count for the 1.25× rung' + tag);
    const n = await page.evaluate(() => window.HSK1_LISTEN.clips[window.shanlu.state.dclip].words.length);
    const zh = await page.evaluate(() => window.HSK1_LISTEN.clips[window.shanlu.state.dclip].zh);
    await page.fill('#dict-input', await page.evaluate(keys));
    const xp0 = await page.evaluate(() => window.shanlu.state.xp);
    await tap(page.locator('.dict .btn', { hasText: 'Check' }));
    const xp1 = await page.evaluate(() => window.shanlu.state.xp);
    check(xp1 - xp0 === n + 3, 'every word right at 1.25× pays a coin a word plus 3 for the rung (' + (xp1 - xp0) + ', ' + n + ' words)' + tag);
    check(/New speed rung: 1\.25× \(\+3 coins\)/.test(await page.locator('.lfb').first().innerText()), 'the result says which rung was cleared' + tag);
    const cr = await page.evaluate((z) => { const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs['cr.' + z]; return p && p.v; }, zh);
    check(cr === 1.25, 'the rung is saved with the person (' + cr + ')' + tag);
    check(await page.evaluate(() => window.shanlu.achMetrics().rung125 === 1), 'the Quick ear achievement counts the clip' + tag);
    // the same clip again: peeking means the try does not count
    await page.evaluate(() => window.shanlu.setState({ dchecked: false, dtyped: '', dmarks: [], dreveal: 0, dplays: 0, dmin: 0, drung: null }));
    await tap(page.locator('.dict .ladder .lad', { hasText: '1.5×' }));
    await tap(page.locator('.dict button[aria-label="Play the clip"]'));
    await page.evaluate(() => window.shanlu.setState({ dreveal: 1 }));
    check(/You peeked/.test(await page.locator('.dict .rung-t').innerText()), 'after a peek the ladder says this try does not count' + tag);
    await page.fill('#dict-input', await page.evaluate(keys));
    const xp2 = await page.evaluate(() => window.shanlu.state.xp);
    await tap(page.locator('.dict .btn', { hasText: 'Check' }));
    check(await page.evaluate(() => window.shanlu.state.xp) - xp2 === n && !(await page.evaluate(() => window.shanlu.state.drung)), 'a peeked try pays only the words, no rung' + tag);
    // now 1.5× without peeking: +5, and the 1.5× club
    await page.evaluate(() => window.shanlu.setState({ dchecked: false, dtyped: '', dmarks: [], dreveal: 0, dplays: 0, dmin: 0, drung: null }));
    await tap(page.locator('.dict button[aria-label="Play the clip"]'));
    await page.fill('#dict-input', await page.evaluate(keys));
    const xp3 = await page.evaluate(() => window.shanlu.state.xp);
    await tap(page.locator('.dict .btn', { hasText: 'Check' }));
    check(await page.evaluate(() => window.shanlu.state.xp) - xp3 === n + 5 && /1\.5× club/.test(await page.locator('.lfb').first().innerText()), 'every word right at 1.5× pays +5 and welcomes you to the 1.5× club' + tag);
    check(await page.evaluate(() => window.shanlu.achMetrics().rung15 === 1), 'the 1.5× club counts the clip' + tag);

    // shadowing: hear it, then say it; the try is recorded and played after the clip
    await page.evaluate(() => { window.shanlu.setState({ lmode: 'shadow' }); window.shanlu.shadowNext(); });
    await page.waitForSelector('.dict .btn', { hasText: 'Hear it, then say it' });
    check(await page.locator('.dict .ladder .lad').count() === 5, 'shadowing has the speed ladder too' + tag);
    await tap(page.locator('.dict .btn', { hasText: 'Hear it, then say it' }));
    // the clip plays first; in a headless browser the end of the clip may not come, so start the recording by hand if it has not started
    if (!(await waitFor(page, () => window.shanlu.state.shrec === 'rec', 6000))) {
      await page.evaluate(() => { const S = window.shanlu.state; window.shanlu.shRecord(window.HSK1_LISTEN.clips[S.dclip]); });
    }
    check(await waitFor(page, () => window.shanlu.state.shrec === 'rec', 4000) && /Recording: say it now/.test(await page.locator('.sh-rec').innerText()), 'right after the clip it records, and says so' + tag);
    await page.waitForTimeout(800);
    await tap(page.locator('.sh-rec .btn', { hasText: 'Done' }));
    check(await waitFor(page, () => /^data:audio\/wav;base64,/.test(window.shanlu.state.shurl || ''), 3000), 'Done keeps the try as a sound in the tab' + tag + ' ' + await page.evaluate(() => window.shanlu.state.shrec + ' ' + window.shanlu.state.shnote));
    check(await page.locator('.sh-cmp .btn', { hasText: 'Hear both again' }).count() === 1 && await page.locator('.sh-cmp .btn', { hasText: 'Just me' }).count() === 1, 'the clip and the try can be heard back to back, or the try alone' + tag);
    check(await page.locator('.dict .btn', { hasText: 'Next round' }).count() === 1 && await page.locator('.dict .btn', { hasText: 'Try it again' }).count() === 1, 'after a try: Next round, or Try it again' + tag);
    const xp4 = await page.evaluate(() => window.shanlu.state.xp);
    await tap(page.locator('.dict .btn', { hasText: 'Next round' }));
    check(await page.evaluate(() => window.shanlu.state.shround === 1 && !window.shanlu.state.shurl), 'the next round starts clean (the try is dropped)' + tag);
    await tap(page.locator('.dict .btn', { hasText: 'I said it' }));
    await tap(page.locator('.dict .btn', { hasText: 'I said it' }));
    check(await page.evaluate(() => window.shanlu.state.xp) - xp4 === 6 && await page.locator('.dict .btn', { hasText: 'Next clip' }).count() === 1, 'three rounds still pay 6, and recording is optional' + tag);
    check(errors.length === 0, 'no page errors' + tag + ' ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('all ladder checks passed');
})().catch(e => { console.error(e); process.exit(1); });
