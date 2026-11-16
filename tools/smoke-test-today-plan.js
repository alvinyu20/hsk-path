/* Browser test for Today's plan: how many Path steps it asks for (goal minus the review time, 1 to 4, a big backlog keeps it at 1), the n-of-target row,
 * extra steps staying open, and the finished-day card that replaces the greeting and the plan once everything is done.
 * Usage: node tools/smoke-test-today-plan.js   (needs Playwright; SHOT=dir saves screenshots) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  await ctx.route(/wikimedia\.org/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(300);
  const shot = async (name) => { if (process.env.SHOT) await page.screenshot({ path: path.join(process.env.SHOT, name + '.png'), fullPage: true }); };
  const set = async (patch) => { await page.evaluate(p => window.shanlu.setState(p), patch); await page.waitForTimeout(120); };
  const home = async () => { await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(150); };
  const pathRow = () => page.locator('.tasks2 .task2', { hasText: 'Path: ' }).first().innerText().then(t => t.replace(/\s+/g, ' '));

  // some progress, so Today shows the plan and not the first-visit start card
  await page.evaluate(() => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); Object.keys(ws).slice(0, 20).forEach(zh => { ws[zh].see.s = 3; ws[zh].see.t = Date.now(); }); window.__wsClean = JSON.parse(JSON.stringify(ws)); const k0 = Object.keys(ws)[0]; ws[k0].see.t = Date.now() - 86400000 * 40; window.__wsDue = JSON.parse(JSON.stringify(ws)); a.setState({ ws, rq: [], rcomplete: false, grdone: false }); });   // one word is due, so Today has an open Review row
  await set({ mins: 45, dcN: 0, pbase: 0 }); await home();
  // stops the seeded progress already finished: the row says "N of T done" when the baseline is 0
  const base = await page.evaluate(() => { const m = (document.querySelector('.tasks2 .task2') || { innerText: '' }).innerText.match(/(\d+) of \d+ done/); return m ? +m[1] : 0; });
  const B = (k) => base - k;   // the baseline that makes exactly k steps count as done today
  await set({ pbase: B(0) }); await home();
  check(await page.locator('.th-hero').count() === 1 && await page.locator('.fin').count() === 0, 'before the day is done, Today shows the greeting and the plan, not the finished-day card');

  // the target: goal minus review time, 1 to 4
  const target = async (mins, dcN) => { await set({ mins, dcN, pbase: B(0) }); await home(); return pathRow(); };
  let r = await target(45, 0); check(/Path: 4 steps today/.test(r) && /0 of 4 done/.test(r) && /Next: /.test(r), 'a 45 minute goal with nothing due asks for 4 steps, the cap: ' + r);
  r = await target(20, 0); check(/Path: 4 steps today/.test(r), 'a 20 minute goal with nothing due asks for 4 steps: ' + r);
  r = await target(20, 14); check(/Path: 3 steps today/.test(r), 'a 20 minute goal with 14 due asks for 3 steps: ' + r);
  r = await target(10, 0); check(/Path: 2 steps today/.test(r), 'a 10 minute goal asks for 2 steps: ' + r);
  r = await target(10, 10); check(!/steps today/.test(r) && /Path: /.test(r), 'a 10 minute goal with 10 due asks for 1 step and shows it as the stop itself: ' + r);
  r = await target(45, 60); check(!/steps today/.test(r) && /Path: /.test(r), 'a backlog of 60 keeps it at 1 step even with a long goal: ' + r);
  r = await target(45, 40); check(!/steps today/.test(r), 'the backlog guard starts at 40 due: ' + r);
  r = await target(45, 39); check(/steps today/.test(r), 'and not at 39: ' + r);
  r = await target(5, 0); check(/Path: /.test(r), 'a tiny goal still asks for 1 step (the minimum): ' + r);

  // progress through the target
  await set({ mins: 20, dcN: 14, pbase: B(1) }); await home();
  r = await pathRow(); check(/Path: 3 steps today/.test(r) && /1 of 3 done/.test(r) && !/Done/.test(r), 'after 1 of 3 the row shows 1 of 3 and is still open: ' + r);
  check(await page.locator('.tchip', { hasText: 'Another stop' }).count() === 0, 'and Another stop is not offered while the plan still has steps');
  await set({ pbase: B(2) }); await home();
  r = await pathRow(); check(/2 of 3 done/.test(r), 'after 2 of 3: ' + r);
  await set({ pbase: B(3) }); await home();
  r = await pathRow(); check(/Path: 3 steps done/.test(r) && /Done/.test(r), 'at 3 of 3 the row says 3 steps done and is ticked: ' + r);
  check(await page.locator('.tchip', { hasText: 'Another stop' }).count() === 1, 'and an extra step is offered under More ways to study');
  await set({ pbase: B(5) }); await home();
  r = await pathRow(); check(/Path: 5 steps done/.test(r), 'extra steps keep counting: ' + r);

  // every task done: the finished-day card replaces the greeting and the plan
  await page.evaluate(() => window.shanlu.setState({ ws: window.__wsClean }));
  await set({ mins: 20, dcN: 0, pbase: B(4), rq: [], rcomplete: true, grdone: true, dayMin: 26, dayXp: 340 });   // the first gain of the day sets the streak to 1 and lastActive to today
  await set({ streak: 3 }); await home();
  check(await page.locator('.fin').count() === 1, 'with every task done, Today shows the finished-day card');
  check(await page.locator('.th-hero').count() === 0 && await page.locator('.tasks2').count() === 0 && await page.locator('.today-go').count() === 0, 'it replaces the greeting and the plan card');
  const fin = (await page.locator('.fin').innerText()).replace(/\s+/g, ' ');
  check(/Today is cleared/.test(fin) && /26 min/.test(fin) && /goal 20 min/.test(fin) && /\+340/.test(fin) && /coins today/.test(fin) && /Day 3/.test(fin) && /in a row/.test(fin), 'it shows the real minutes, goal, coins and streak: ' + fin.slice(0, 120));
  check(/Light day 4/.test(fin), 'tomorrow lights day 4 of the streak');
  check(await page.locator('.fw-d').count() === 7 && await page.locator('.fw-d.nx').count() === 1, 'the lantern row has 7 days and one marked next');
  check(/Nothing is due tomorrow|come[s]? due tomorrow/.test(fin), 'it says what is due tomorrow: ' + (fin.match(/(Nothing is due[^.]*\.|\d+ words? comes? due[^.]*\.)/) || [''])[0]);
  check(await page.locator('.fin-go').count() === 1 && /Bonus round/.test(fin) && /Path: /.test(fin), 'a Bonus round button names the next Path step');
  check((await page.locator('.fin-row .btn').allInnerTexts()).map(t => t.trim()).join('|').endsWith('Journey'), 'and shortcuts end with the Journey: ' + (await page.locator('.fin-row .btn').allInnerTexts()).join('|'));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the card fits the phone width');
  // the treasure chest: closed until tapped, one tap opens it and pays once
  check(await page.locator('.fin-top .ch.ch-closed').count() === 1 && /Bonus reward/.test(await page.locator('.fin-top .ch').innerText()) && !/Tap the chest/.test(await page.locator('.fin').innerText()), 'the Today is cleared card holds a closed chest labelled Bonus reward');
  const x0 = await page.evaluate(() => window.shanlu.state.xp);
  await page.locator('.ch-btn').click(); await page.waitForTimeout(150);
  const o1 = await page.evaluate(() => ({ xp: window.shanlu.state.xp, paid: window.shanlu.state.dcPaid, amt: window.shanlu.state.dcAmt, sfx: (window.__sfxLog || []).join('|') }));
  check(o1.paid && [50, 100, 200, 500].includes(o1.amt) && o1.xp === x0 + o1.amt && /chest/.test(o1.sfx), 'tapping opens it, pays 50, 100, 200 or 500 coins and plays the chest sound: ' + JSON.stringify(o1));
  check(await page.locator('.ch.ch-open.ch-go').count() === 1 && (await page.locator('.ch-amt').innerText()).trim() === '+' + o1.amt + ' coins' && await page.locator('.ch-c').count() === 9, 'the opening animation runs and shows +' + o1.amt);
  await page.waitForTimeout(5000);
  check(await page.locator('.ch.ch-open').count() === 1 && await page.locator('.ch-go').count() === 0 && /opened/.test(await page.locator('.ch-btn').getAttribute('aria-label')), 'afterwards it stays open and still shows what it held');
  await page.evaluate(() => window.shanlu.openChest(0.95)); 
  check(await page.evaluate(() => window.shanlu.state.xp) === x0 + o1.amt, 'a chest is paid once a day');
  // the odds: 40% 50 coins, 30% 100, 20% 200, 10% 500
  const odds = [];
  for (const r of [0, 0.39, 0.4, 0.69, 0.7, 0.89, 0.9, 0.999]) { await page.evaluate(() => window.shanlu.setState({ dcPaid: false, dcAmt: 0 })); await page.evaluate(r => window.shanlu.openChest(r), r); odds.push(await page.evaluate(() => window.shanlu.state.dcAmt)); }
  check(odds.join(',') === '50,50,100,100,200,200,500,500', 'the roll maps to 40% 50, 30% 100, 20% 200, 10% 500: ' + odds.join(','));
  const draws = await page.evaluate(() => { const a = window.shanlu; const c = { 50: 0, 100: 0, 200: 0, 500: 0 }; for (let i = 0; i < 4000; i++) { a.setState({ dcPaid: false, dcAmt: 0 }); a.openChest(); c[a.state.dcAmt]++; } return c; });
  check(Math.abs(draws[50] / 4000 - 0.4) < 0.04 && Math.abs(draws[100] / 4000 - 0.3) < 0.04 && Math.abs(draws[200] / 4000 - 0.2) < 0.04 && Math.abs(draws[500] / 4000 - 0.1) < 0.03, 'a few thousand real draws land near those odds: ' + JSON.stringify(draws));
  await page.evaluate(() => window.shanlu.setState({ dcPaid: false, dcAmt: 0, chestGo: false, dayXp: 340 })); await home();
  check(await page.locator('.ch.ch-closed').count() === 1, 'a new chest is closed again (reset for the next check)');
  await shot('finished-light');
  // something still due again: the plan comes back
  await page.evaluate(() => window.shanlu.setState({ ws: window.__wsDue, rcomplete: false })); await home();
  check(await page.locator('.fin').count() === 0 && await page.locator('.tasks2').count() === 1, 'when a task opens again (a word comes due) the plan returns');
  // regression: a grammar review that ended with points still due must not finish the day (the chest used to show with 3 points left)
  const gres0 = await page.evaluate(() => window.shanlu.state.gres);
  await page.evaluate(() => { const a = window.shanlu; const L = Object.keys(window.HSK1_GRAMMAR.points.reduce((o, p) => { o[p.lesson] = 1; return o; }, {}))[0]; a.setState({ gres: Object.assign({}, a.state.gres, { [L]: 90 }), grdone: true, rcomplete: true }); }); await home();
  const gr = (await page.locator('.tasks2 .task2', { hasText: 'Grammar review' }).first().innerText()).replace(/\s+/g, ' ');
  check(await page.locator('.fin').count() === 0 && /still due/.test(gr) && !/Done/.test(gr), 'a finished grammar session with points still due keeps the plan open: ' + gr);
  await page.evaluate(g => window.shanlu.setState({ gres: g }), gres0); await home();
  await page.evaluate(() => window.shanlu.setState({ ws: window.__wsClean, rcomplete: true })); await home();
  // tomorrow's due words are counted: find how long ago a 1-day-stability word was seen so that it is not due today but is by tomorrow
  let found = false;
  for (const ago of [0.1, 0.3, 0.5, 0.7, 0.9, 1.1]) {
    await page.evaluate((ago) => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(window.__wsClean)); Object.keys(ws).slice(0, 7).forEach(zh => { ['see', 'hear', 'prod'].forEach(k => { ws[zh][k].s = 1; ws[zh][k].t = Date.now() - 86400000 * ago; }); }); a.setState({ ws }); }, ago);
    await home();
    if (await page.locator('.fin').count() && /\d+ words? comes? due tomorrow/.test(await page.locator('.fin').innerText())) { found = true; break; }
  }
  check(found, 'with words due by tomorrow (and none today), the card says how many');

  // the bonus round opens the Path
  await page.locator('.fin-go').click(); await page.waitForTimeout(500);
  check(await page.evaluate(() => window.shanlu.state.screen) === 'path', 'Bonus round opens the Path');
  await home();
  // dark theme still reads
  await set({ theme: 'dark' }); await home(); await shot('finished-dark'); await set({ theme: 'light' });

  // a finished path: no bonus round button
  check(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' failure(s)' : 'today plan test passed');
  process.exit(failures ? 1 : 0);
})();
