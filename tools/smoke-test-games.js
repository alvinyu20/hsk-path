/* Browser test for Games (Learn > Games): the hub (Game of the day, a tile per game), each game's page (open rounds, locked ones folded away),
 * and the three games: Tell them apart (locks by lessons and words, picks, misses first), Measure words (rounds per level, runs of right
 * answers), Quick-fire numbers (typed answers, steps opening in order). Also coins (per card, perfect, half again the same day).
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
    await page.addStyleTag({ content: '.mstoast{display:none!important}' });   // achievement toasts would cover the buttons
    const tag = vp.width < 600 ? ' (phone)' : ' (desktop)';
    const xp = () => page.evaluate(() => window.shanlu.state.xp);
    const pref = (k) => page.evaluate((k) => { const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs[k]; return p && p.v; }, k);
    const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
    const cardInfo = () => page.evaluate(() => { const g = window.shanlu.state.gm; const c = g.deck[g.qi]; return { a: c.opts.findIndex(o => o.zh === c.a), n: c.opts.length, key: c.key }; });
    const playTo = async (n, wrong) => { for (let i = 0; i < n; i++) { const ci = await cardInfo(); await page.keyboard.press(String((wrong && i < wrong ? (ci.a + 1) % ci.n : ci.a) + 1)); await page.keyboard.press('Enter'); } };
    const rowOf = (title) => page.locator('.gm-row').filter({ has: page.locator('.gm-st b', { hasText: new RegExp('^' + title.replace(/[?.]/g, '\\$&') + '$') }) });
    // the data: every level has sets, built and checked by tools/build-games.py
    const counts = await page.evaluate(() => Object.keys(window.SHANLU_GAMES.tellapart).map(n => n + ':' + window.SHANLU_GAMES.tellapart[n].length).join(' '));
    check(/1:\d+ 2:\d+ 3:\d+ 4:\d+ 5:\d+/.test(counts), 'Tell them apart has sets for HSK 1 to 5 (' + counts + ')' + tag);
    // the hub: Games sits under Learn; a tile per game
    await page.evaluate(() => window.shanlu.go('games')); await page.waitForSelector('.gm');
    if (vp.width < 600) check((await page.locator('.navsub .subl').allInnerTexts()).join('|') === 'Path|Library|Games' && (await page.locator('.navsub .subl.on').innerText()).trim() === 'Games', 'Learn lists Path, Library and Games, with Games lit' + tag);
    const tiles = await page.locator('.gm-tile .gm-tn').allInnerTexts();
    check(await page.locator('.top h1').innerText() === 'Games' && tiles.join('|') === 'Tell them apart|Measure words|Quick-fire numbers', 'the hub has a tile for each game (' + tiles.join(', ') + ')' + tag);
    // Tell them apart: its page; a locked set is folded away until asked for
    await tap(page.locator('.gm-tile', { hasText: 'Tell them apart' }));
    await page.waitForSelector('.gm-head');
    check(await page.locator('.gm-head h2').innerText() === 'Tell them apart' && await page.locator('.gm-row.locked').count() === 0 && await page.locator('.gm-more').count() === 1, 'the game page folds the locked sets into one line' + tag);
    await tap(page.locator('.gm-more'));
    const dy = rowOf('都 or 也?');
    check(/Pass 都, 也, 还, 再 and joining sentences to open/.test(await dy.innerText()) && await dy.evaluate(e => e.classList.contains('locked')), 'a set waits for the lessons it mixes (' + (await dy.innerText()).replace(/\s+/g, ' ') + ')' + tag);
    await page.evaluate(() => window.shanlu.setState({ gres: Object.assign({}, window.shanlu.state.gres, { adv: 100 }) }));
    check(/of 5 cards ready/.test(await dy.innerText()), 'with the lesson passed, the set waits until enough of its words are started' + tag);
    await page.evaluate(() => { const s = window.SHANLU_GAMES.tellapart['1'].find(x => x.id === 'dou-ye'); const wl = {}; s.items.forEach(it => it.w.forEach(z => { wl[z] = true; })); window.shanlu.setState({ wlearned: Object.assign({}, window.shanlu.state.wlearned, wl) }); });
    check(await dy.locator('.gm-play', { hasText: 'Play' }).count() === 1 && /8 cards/.test(await dy.innerText()), 'once the words are started the set opens with 8 cards' + tag);
    // a round: right, wrong, then right for the rest
    await tap(dy.locator('.gm-play'));
    await page.waitForSelector('.gm-card');
    check(/1 \/ 8/.test(await page.locator('.gm-step').innerText()) && await page.locator('.gm-dots i').count() === 8 && await page.locator('.gm-opts .opt').count() === 2, 'a round of 8 cards (8 dots), two buttons (都 and 也)' + tag);
    check(await page.locator('.gm-py').count() === 0, 'no pinyin until asked for' + tag);
    await tap(page.locator('.gm-card .linkbtn', { hasText: 'Show pinyin' }));
    check(/___/.test(await page.locator('.gm-py').innerText()), 'the pinyin leaves the gap blank, so it does not give the answer away' + tag);
    const xp0 = await xp();
    let c = await cardInfo();
    await tap(page.locator('.gm-opts .opt').nth(c.a));
    let t = await page.locator('.gm-card').innerText();
    check(/Right!/.test(t) && await page.locator('.gm-gap.ok').count() === 1 && await page.locator('.gm-dots i.ok').count() === 1, 'a right pick says so, fills the gap and turns its dot green' + tag);
    await tap(page.locator('.gm-card .gm-next', { hasText: 'Next' }));
    c = await cardInfo();
    await tap(page.locator('.gm-opts .opt').nth(1 - c.a));
    t = await page.locator('.gm-card').innerText();
    check(/Not quite: it is/.test(t) && /Your pick:/.test(t) && await page.locator('.gm-opts .opt.wrong').count() === 1, 'a wrong pick names the answer and says what your pick means' + tag);
    await blur(); await page.keyboard.press('Enter');
    await playTo(6);
    await page.waitForSelector('.gm-score');
    t = await page.locator('.gm-card').innerText();
    // coins: 7 right x 4 = 28 (the first round of the day pays full), plus 15 if this set happens to be Game of the day
    const day = await page.evaluate(() => window.shanlu.gmOfDay(window.shanlu.state));
    const dayB = day && day.key === 'ta.dou-ye' ? 15 : 0;
    check(/7 \/ 8/.test(t) && (await xp()) - xp0 === 28 + dayB && /7 right × 4 coins/.test(t), 'the end shows 7 / 8 and pays 4 a right card (' + ((await xp()) - xp0) + ')' + tag);
    check(await page.locator('.gm-b').count() >= 1 && /one to watch/.test(t) && await page.locator('.gm-m').count() === 1, 'it breaks the score down by pattern, names the one to watch and lists the miss' + tag);
    const tp = await pref('ta.dou-ye');
    check(tp && tp.b === 7 && tp.t === 8 && tp.n === 1 && tp.m.length === 1, 'the result is saved with the person (best 7 of 8, one miss)' + tag);
    // again the same day: the missed card is in it, and it pays half
    await tap(page.locator('.gm-card .btn', { hasText: 'Play again' }));
    check(await page.evaluate((m) => window.shanlu.state.gm.deck.some(c => c.key === m), tp.m[0]), 'the missed card is in the next round' + tag);
    const xp1 = await xp(); await blur(); await playTo(8);
    await page.waitForSelector('.gm-score');
    check((await xp()) - xp1 === Math.ceil((8 * 4 + 10) / 2) && /half/.test(await page.locator('.gm-cw').innerText()), 'the same round again today pays half: (32 + 10 perfect) / 2 = 21 (' + ((await xp()) - xp1) + ')' + tag);
    await tap(page.locator('.gm-card .gm-next', { hasText: 'Done' }));
    check(/Best 8 of 8 · played today/.test(await rowOf('都 or 也?').innerText()), 'back on the game page, the set shows its best' + tag);
    // Measure words: waits for its words, then a round of 10 with three choices; misses come back first
    await page.evaluate(() => window.shanlu.gmGame('mw'));
    await page.waitForSelector('.gm-head');
    check(await page.locator('.gm-head h2').innerText() === 'Measure words' && await page.locator('.gm-row:not(.locked)').count() === 0 && /Nothing is open yet/.test(await page.locator('.gm-list').innerText()), 'Measure words has nothing open before its words are started' + tag);
    await page.evaluate(() => { const wl = {}; window.SHANLU_GAMES.mw.cards.filter(c => c.lv === 1).forEach(c => c.w.forEach(z => { wl[z] = true; })); window.shanlu.setState({ wlearned: Object.assign({}, window.shanlu.state.wlearned, wl) }); });
    await tap(rowOf('HSK 1 measure words').locator('.gm-play'));
    await page.waitForSelector('.gm-card');
    const mwc = await page.evaluate(() => { const g = window.shanlu.state.gm; return { n: g.deck.length, three: g.deck.every(c => c.opts.length === 3 && c.opts.filter(o => o.zh === c.a || c.also.indexOf(o.zh) >= 0).length === 1), lv: g.deck.every(c => c.opts.every(o => window.SHANLU_GAMES.mw.mws.find(m => m.zh === o.zh).lv <= 1)) }; });
    check(mwc.n === 10 && mwc.three && mwc.lv, 'a round of 10 pairs, three choices each, exactly one of them right, all HSK 1 measure words' + tag);
    await blur(); await playTo(10, 2);
    await page.waitForSelector('.gm-score');
    const k = await pref('mwk');
    check(/8 \/ 10/.test(await page.locator('.gm-card').innerText()) && Object.values(k).filter(x => x === 0).length === 2 && Object.values(k).filter(x => x === 1).length === 8, 'the end shows 8 / 10, and each pair keeps its run of right answers' + tag);
    await tap(page.locator('.gm-card .btn', { hasText: 'Play again' }));
    check(await page.evaluate(() => { const g = window.shanlu.state.gm; const p = JSON.parse(localStorage.getItem('shanlu-person')).prefs.mwk.v; return Object.keys(p).filter(z => p[z] === 0).every(z => g.deck.some(c => c.key === z)); }), 'the missed pairs are in the next round' + tag);
    // Quick-fire numbers: typed answers; only the first step is open; 8 right opens the next
    await page.evaluate(() => window.shanlu.gmGame('qf'));
    await page.waitForSelector('.gm-head');
    check(await rowOf('1. Numbers to 99').locator('.gm-play').count() === 1 && /Get 8 of 10 in Numbers to 99 to open/.test(await rowOf('2. Bigger numbers').innerText()) && await page.locator('.gm-row.locked').count() === 1, 'Quick-fire numbers shows step 1 open and only the next locked step' + tag);
    await tap(rowOf('1. Numbers to 99').locator('.gm-play'));
    await page.waitForSelector('#gm-input');
    check(await page.locator('.gm-opts').count() === 0 && await page.locator('.gm-zh').count() === 0 && await page.locator('.gm-speed .fc2').count() === 3, 'you type the number: no choices, no text until you answer, and speed buttons' + tag);
    await page.fill('#gm-input', 'fourteen'); await page.press('#gm-input', 'Enter');
    check(await page.locator('.m-err').count() === 1 && await page.evaluate(() => window.shanlu.state.gm.pick === -1), 'an answer that is not a number gets a hint, not a miss' + tag);
    const qx0 = await xp();
    const typeCard = async (wrong) => { const ci = await cardInfo(); await page.fill('#gm-input', wrong ? String(Number(ci.key) + 1) : ci.key); await page.press('#gm-input', 'Enter'); };
    await typeCard(true);
    t = await page.locator('.gm-card').innerText();
    check(/Not quite: it is/.test(t) && /You typed/.test(t) && await page.locator('.gm-zh').count() === 1 && await page.locator('.gm-py').count() === 1, 'a wrong answer shows what you typed, the Chinese and its pinyin' + tag);
    await page.press('#gm-input', 'Enter');
    for (let i = 0; i < 9; i++) { await typeCard(false); await page.press('#gm-input', 'Enter'); }
    await page.waitForSelector('.gm-score');
    check(/9 \/ 10/.test(await page.locator('.gm-card').innerText()) && (await xp()) - qx0 >= 27, 'the round ends with 9 / 10 and pays 3 a right answer at 1x (' + ((await xp()) - qx0) + ')' + tag);
    await tap(page.locator('.gm-card .gm-next', { hasText: 'Done' }));
    check(await rowOf('2. Bigger numbers').locator('.gm-play').count() === 1, '8 or more right opens Bigger numbers' + tag);
    // the hub: Game of the day on top; Today shows it too
    await page.evaluate(() => window.shanlu.taHub());
    check(await page.locator('.gm-day').count() === 1, 'the hub shows Game of the day (' + (await page.locator('.gm-day').innerText()).replace(/\s+/g, ' ') + ')' + tag);
    await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(200);
    check(await page.locator('.mw', { hasText: 'Game of the day' }).count() === 1, 'Today offers a Game of the day (' + (await page.locator('.mw', { hasText: 'Game of the day' }).innerText()).replace(/\s+/g, ' ') + ')' + tag);
    check(await page.evaluate(() => window.shanlu.achMetrics().taRounds === 2), 'the achievements count the rounds' + tag);
    check(errors.length === 0, 'no page errors' + tag + ' ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('all games checks passed');
})().catch(e => { console.error(e); process.exit(1); });
