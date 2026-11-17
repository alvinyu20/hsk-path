/* Browser test for listening passages (Path stops of kind "l"): placement on the Path, the listen / answer / transcript flow, coins, and the stop
 * turning done. Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-passages.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
// on a phone the tab bar is fixed at the bottom: bring a button to the middle of the screen before tapping it (a person scrolls the same way)
const tap = async (loc) => { await loc.evaluate(e => e.scrollIntoView({ block: 'center' })); await loc.click(); };
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const vp of [{ width: 1200, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; localStorage.setItem('shanlu-progress-v1', JSON.stringify({ xp: 0, dayXp: 0 })); });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(400);
    const tag = vp.width < 600 ? ' (phone)' : ' (desktop)';
    // placement: every passage of HSK 1 and 2 is a stop, after the stop that teaches its last word
    const place = await page.evaluate(() => {
      const P = window.SHANLU_PATH, ps = window.SHANLU_PASSAGES, out = { n: 0, bad: [] };
      ['1', '2'].forEach(L => {
        const flat = []; P[L].units.forEach(u => u.stops.forEach(s => flat.push(s)));
        (ps[L] || []).forEach(p => {
          const at = flat.findIndex(s => s.k === 'l' && s.l === p.id); if (at < 0) { out.bad.push(p.id + ' missing'); return; }
          out.n++;
          p.words.forEach(w => { const wi = flat.findIndex(s => s.k === 'w' && s.w.indexOf(w) >= 0); if (wi > at) out.bad.push(p.id + ' comes before ' + w); });
        });
      });
      return out;
    });
    check(place.n >= 24 && place.bad.length === 0, 'every HSK 1 and 2 passage is on the Path after all of its words' + tag + ' (' + place.n + ')' + (place.bad.length ? ': ' + place.bad.slice(0, 3).join('; ') : ''));
    // open one from the Path code (the same call the stop's button makes)
    await page.evaluate(() => window.shanlu.pathStart('h1.l.p1-family'));
    await page.waitForSelector('.psg-card');
    let t = await page.locator('.psg-card').innerText();
    check(/A family photo/.test(t) && /Listen first/.test(t) && await page.locator('.psg-play .btn.pri[disabled]').count() === 1, 'the passage opens on its scene, and Answer waits until it has been played' + tag);
    check(!/小明，这是你家人吗/.test(t), 'no text of the conversation is shown before the questions' + tag);
    await tap(page.locator('.psg-play .btn', { hasText: 'Play the conversation' }));
    await tap(page.locator('.psg-play .btn', { hasText: 'Answer the questions' }));
    // answer: right, wrong, right
    const plan = [true, false, true];
    for (let i = 0; i < plan.length; i++) {
      await page.waitForSelector('.psg-qzh');
      const k = await page.evaluate((want) => { const g = window.shanlu.state.psg; const o = g.ord[g.qi]; return want ? o.indexOf(0) : o.findIndex(x => x !== 0); }, plan[i]);
      await tap(page.locator('.psg-opts .opt').nth(k));
      const a = await page.locator('.psg-ans').innerText();
      check(plan[i] ? /^Right/.test(a) : /^Not quite/.test(a), 'question ' + (i + 1) + ' is marked ' + (plan[i] ? 'right' : 'wrong') + ' and shows the line with the answer' + tag);
      await tap(page.locator('.psg-ansb .btn.pri'));
    }
    t = await page.locator('.psg-card').innerText();
    check(/2 of 3 right/.test(t) && /\+20 coins/.test(t), 'the result: 2 of 3 right, +20 coins the first time' + tag);
    check(await page.locator('.psg-tr li').count() === 5 && /小明，这是你家人吗/.test(t), 'the transcript shows every line after the questions' + tag);
    await tap(page.locator('.psg-tog .linkbtn', { hasText: 'Show English' }));
    check(/Is this your family/i.test(await page.locator('.psg-tr').innerText()), 'English can be shown under each line' + tag);
    const xp1 = await page.evaluate(() => window.shanlu.state.xp);
    check(xp1 === 20, 'coins were added (' + xp1 + ')' + tag);
    // again: all right, but only 2 a right answer now
    await tap(page.locator('.psg-ansb .btn', { hasText: 'Listen and answer again' }));
    await tap(page.locator('.psg-play .btn', { hasText: 'Play the conversation' }));
    await tap(page.locator('.psg-play .btn', { hasText: 'Answer the questions' }));
    for (let i = 0; i < 3; i++) {
      const k = await page.evaluate(() => { const g = window.shanlu.state.psg; return g.ord[g.qi].indexOf(0); });
      await tap(page.locator('.psg-opts .opt').nth(k)); await tap(page.locator('.psg-ansb .btn.pri'));
    }
    t = await page.locator('.psg-card').innerText();
    check(/3 of 3 right/.test(t) && /\+6 coins/.test(t), 'a second time pays 2 a right answer (no farming)' + tag);
    // the Path stop is done
    await tap(page.locator('.psg-ansb .btn', { hasText: 'Back to the Path' }));
    const st = await page.evaluate(() => { const b = (window.shanlu.state); return true; });
    const pref = await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs['psg.p1-family']);
    check(pref && pref.v && pref.v.b === 3 && pref.v.n === 2, 'the best result is saved with the person (best 3, twice)' + tag);
    // speed: 0.8×, 1× and 1.25× buttons; the fast-ear challenge pays once for all right after listening only at 1.25×
    await page.evaluate(() => window.shanlu.pathStart('h1.l.p1-family')); await page.waitForSelector('.psg-card');
    const spd = await page.locator('.psg-speed .fc2').allInnerTexts();
    check(spd.join(' ') === '0.8× 1× 1.25×' && await page.locator('.psg-speed .fc2.on').innerText() === '1×', 'the passage has its own speed buttons, 1× to start (' + spd.join(' ') + ')' + tag);
    check(/Fast-ear challenge: listen only at 1\.25×/.test(await page.locator('.psg-fast').innerText()), 'the fast-ear challenge is explained before playing' + tag);
    await tap(page.locator('.psg-speed .fc2', { hasText: '1.25×' }));
    await tap(page.locator('.psg-play .btn', { hasText: 'Play the conversation' }));
    check(await page.evaluate(() => window.shanlu.state.psg.minRate === 1.25) && /challenge on/.test(await page.locator('.psg-fast').innerText()), 'playing at 1.25× turns the challenge on' + tag);
    await tap(page.locator('.psg-play .btn', { hasText: 'Answer the questions' }));
    for (let i = 0; i < 3; i++) {
      const k = await page.evaluate(() => { const g = window.shanlu.state.psg; return g.ord[g.qi].indexOf(0); });
      await tap(page.locator('.psg-opts .opt').nth(k)); await tap(page.locator('.psg-ansb .btn.pri'));
    }
    t = await page.locator('.psg-card').innerText();
    check(/3 of 3 right/.test(t) && /\+16 coins/.test(t) && /fast ear: \+10/.test(t), 'all right at 1.25× pays the fast-ear bonus: 6 + 10 (' + (/\+\d+ coins[^\n]*/.exec(t) || [''])[0] + ')' + tag);
    const pp = await page.evaluate(() => { const pr = JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs; return { sp: pr.psgSpeed && pr.psgSpeed.v, f: pr['psg.p1-family'] && pr['psg.p1-family'].v.f }; });
    check(pp.sp === 1.25 && pp.f === 1, 'the chosen speed and the earned challenge are saved with the person' + tag);
    // once earned, it is not offered or paid again; slowing down before the questions switches it off
    await tap(page.locator('.psg-ansb .btn', { hasText: 'Listen and answer again' }));
    check(await page.locator('.psg-fast').count() === 0 && await page.locator('.psg-speed .fc2.on').innerText() === '1.25×', 'the challenge is not offered again, and the speed is remembered' + tag);
    await page.evaluate(() => window.shanlu.psgSetSpeed(0.8));
    await tap(page.locator('.psg-play .btn', { hasText: 'Play the conversation' }));
    check(await page.evaluate(() => window.shanlu.state.psg.minRate === 0.8), 'a slower listen is remembered for this try' + tag);
    await page.evaluate(() => window.shanlu.psgSetSpeed(1));
    check(errors.length === 0, 'no page errors' + tag + ' ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failures ? failures + ' failed' : 'passage tests passed');
  process.exit(failures ? 1 : 0);
})();
