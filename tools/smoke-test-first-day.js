/* Browser test for a brand-new person's first day: Today's Path row lists the day's first stops by name (nothing is picked for them: they are the first
 * stops of the Path, in order). Not shown on later days, for a one-step plan, or once an earlier day has activity.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-first-day.js */
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // a new person who has finished the first-visit steps, so Today shows the plan (not the Start here card)
  await ctx.addInitScript(() => {
    window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; window.SHANLU_ONBOARDING = 1;
    if (!localStorage.getItem('shanlu-person')) localStorage.setItem('shanlu-person', JSON.stringify({ prefs: { onb: { v: { p: 'done', w: 1, l: 'new', s: 'skip' }, at: 1 }, name: { v: 'Mei', at: 1 } } }));
  });
  await ctx.route(/wikimedia\.org/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(500);
  const home = async () => { await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(200); };
  const set = async (patch) => { await page.evaluate(p => window.shanlu.setState(p), patch); await page.waitForTimeout(150); };
  const row = () => page.locator('.tasks2 .task2', { hasText: 'Path: ' }).first();
  const stops = () => page.locator('.tasks2 .tstop').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));

  await home();
  let r = (await row().innerText()).replace(/\s+/g, ' ');
  check(/Path: 4 steps today/.test(r) && /Your first 4 stops · 0 of 4 done/.test(r), 'a new person\'s Path row says "Your first 4 stops": ' + r);
  let s = await stops();
  check(s.length === 4 && /^1 Greetings and manners \(1 of 2\)/.test(s[0]) && /^4 /.test(s[3]), 'the four stops are listed by name, in Path order: ' + s.join(' | '));
  check(s.every(x => /new words?$|Grammar lesson$|Speaking scene$/.test(x)), 'each stop says what it is (new words, a grammar lesson or a speaking scene)');
  check(await page.locator('.tasks2 .task2.done .tstop').count() === 0, 'nothing is marked done yet');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the list does not make the page scroll sideways');

  // a shorter goal asks for fewer steps, and the list follows (never more stops than steps)
  await set({ mins: 10 }); await home();
  s = await stops(); check(s.length === 2, 'a 10 minute goal lists 2 stops: ' + s.length);
  await set({ mins: 5 }); await home();
  r = (await row().innerText()).replace(/\s+/g, ' ');
  check((await stops()).length === 0 && !/steps today/.test(r), 'a one-step plan shows the stop itself, with no list: ' + r);

  // not the first day: an earlier day with activity
  await set({ mins: 20 }); await home();
  check((await stops()).length === 4, 'back at 20 minutes the list is there again');
  const yd = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await set({ activity: { [yd]: true } }); await home();
  r = (await row().innerText()).replace(/\s+/g, ' ');
  check((await stops()).length === 0 && /Path: 4 steps today/.test(r) && /0 of 4 done · Next: /.test(r), 'after an earlier day of study the list is gone and the normal row is back: ' + r);

  check(errors.length === 0, 'no page errors: ' + errors.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' first-day check(s) failed' : 'first-day browser tests passed');
  process.exit(failures ? 1 : 0);
})();
