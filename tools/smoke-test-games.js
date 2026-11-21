/* Browser test for Games (Learn > Games) and its first game, Tell them apart: locks (lessons, then words), a round with right, "also right"
 * and wrong picks, the end screen, coins, what is saved with the person, missed cards first next time, and Game of the day on Today.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-games.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
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
    // the data: every level has sets, built and checked by tools/build-games.py
    const counts = await page.evaluate(() => Object.keys(window.SHANLU_GAMES.tellapart).map(n => n + ':' + window.SHANLU_GAMES.tellapart[n].length).join(' '));
    check(/1:\d+ 2:\d+ 3:\d+ 4:\d+ 5:\d+/.test(counts), 'Tell them apart has sets for HSK 1 to 5 (' + counts + ')' + tag);
    // Games sits under Learn
    await page.evaluate(() => window.shanlu.go('games')); await page.waitForSelector('.gm');
    if (vp.width < 600) check((await page.locator('.navsub .subl').allInnerTexts()).join('|') === 'Path|Library|Games' && (await page.locator('.navsub .subl.on').innerText()).trim() === 'Games', 'Learn lists Path, Library and Games, with Games lit' + tag);
    check(await page.locator('.top h1').innerText() === 'Games' && await page.locator('.gm-game h2', { hasText: 'Tell them apart' }).count() === 1, 'the Games page shows Tell them apart' + tag);
    // locked by lessons: nothing passed yet
    const dy = page.locator('.gm-set', { hasText: '都 or 也?' });
    check(/Pass 都, 也, 还, 再 and joining sentences to open/.test(await dy.innerText()) && await dy.locator('.gm-lock').count() === 1, 'a set waits for the lessons it mixes (' + (await dy.innerText()).replace(/\s+/g, ' ') + ')' + tag);
    // the lesson passed, but its words not started: still locked, with a count of cards ready
    await page.evaluate(() => window.shanlu.setState({ gres: Object.assign({}, window.shanlu.state.gres, { adv: 100 }) }));
    check(/of 5 cards ready/.test(await dy.innerText()), 'with the lesson passed, the set waits until enough of its words are started' + tag);
    // start every word the set uses
    await page.evaluate(() => { const s = window.SHANLU_GAMES.tellapart['1'].find(x => x.id === 'dou-ye'); const wl = {}; s.items.forEach(it => it.w.forEach(z => { wl[z] = true; })); window.shanlu.setState({ wlearned: Object.assign({}, window.shanlu.state.wlearned, wl) }); });
    check(await dy.locator('.btn', { hasText: 'Play' }).count() === 1 && /8 cards/.test(await dy.innerText()), 'once the words are started the set opens with 8 cards' + tag);
    // a round: right, then wrong, then right for the rest
    await tap(dy.locator('.btn', { hasText: 'Play' }));
    await page.waitForSelector('.gm-card');
    check(/Card 1 of 8/.test(await page.locator('.gm-card').innerText()) && await page.locator('.gm-opts .opt').count() === 2, 'a round of 8 cards, two buttons (都 and 也)' + tag);
    check(await page.locator('.gm-py').count() === 0, 'no pinyin until asked for' + tag);
    await tap(page.locator('.gm-card .linkbtn', { hasText: 'Show pinyin' }));
    check(/___/.test(await page.locator('.gm-py').innerText()), 'the pinyin leaves the gap blank, so it does not give the answer away' + tag);
    const cardInfo = () => page.evaluate(() => { const g = window.shanlu.state.gm; const s = window.SHANLU_GAMES.tellapart['1'].find(x => x.id === g.id); const it = s.items[g.cards[g.qi]]; return { a: s.opts.indexOf(it.a), n: s.opts.length }; });
    const xp0 = await page.evaluate(() => window.shanlu.state.xp);
    let c = await cardInfo();
    await tap(page.locator('.gm-opts .opt').nth(c.a));
    let t = await page.locator('.gm-card').innerText();
    check(/Right!/.test(t) && await page.locator('.gm-gap.ok').count() === 1, 'a right pick says so and fills the gap' + tag);
    await tap(page.locator('.gm-card .btn.pri', { hasText: 'Next card' }));
    c = await cardInfo();
    await tap(page.locator('.gm-opts .opt').nth(1 - c.a));
    t = await page.locator('.gm-card').innerText();
    check(/Not quite: it is/.test(t) && /Your pick:/.test(t) && await page.locator('.gm-opts .opt.wrong').count() === 1, 'a wrong pick names the answer and says what your pick means' + tag);
    // keyboard: Enter goes on, a number picks (a mouse user's focus is on the button just clicked: move it away first, as a keyboard user's would be)
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Enter');
    for (let i = 2; i < 8; i++) {
      c = await cardInfo();
      await page.keyboard.press(String(c.a + 1));
      await page.keyboard.press('Enter');
    }
    await page.waitForSelector('.gm-brk');
    t = await page.locator('.gm-card').innerText();
    const xp1 = await page.evaluate(() => window.shanlu.state.xp);
    check(/7 of 8 right/.test(t) && xp1 - xp0 === 14 && /\+14 coins/.test(t), 'the end shows 7 of 8 and pays 2 a right card (' + (xp1 - xp0) + ')' + tag);
    check(await page.locator('.gm-b').count() >= 1 && /one to watch/.test(t) && await page.locator('.gm-m').count() === 1, 'it breaks the score down by pattern, names the one to watch and lists the miss' + tag);
    const pref = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs['ta.dou-ye']; return p && p.v; });
    check(pref && pref.b === 7 && pref.t === 8 && pref.n === 1 && pref.m.length === 1, 'the result is saved with the person (best 7 of 8, one miss)' + tag);
    // the missed card comes back in the next round
    const missed = pref.m[0];
    await tap(page.locator('.gm-card .btn', { hasText: 'Play again' }));
    check(await page.evaluate((m) => window.shanlu.state.gm.cards.indexOf(m) >= 0, missed), 'the missed card is in the next round' + tag);
    // back to the hub shows the best
    await tap(page.locator('.crumb', { hasText: 'Games' }));
    check(/Best 7 of 8 · 1 to fix/.test(await page.locator('.gm-set', { hasText: '都 or 也?' }).innerText()), 'the hub shows the best score and what is left to fix' + tag);
    // Game of the day on Today
    await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(200);
    check(await page.locator('.mw', { hasText: 'Game of the day' }).count() === 1 && /都 or 也\?/.test(await page.locator('.mw', { hasText: 'Game of the day' }).innerText()), 'Today offers the open set as Game of the day' + tag);
    check(await page.evaluate(() => window.shanlu.achMetrics().taRounds === 1), 'the achievements count the round' + tag);
    check(errors.length === 0, 'no page errors' + tag + ' ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('all games checks passed');
})().catch(e => { console.error(e); process.exit(1); });
