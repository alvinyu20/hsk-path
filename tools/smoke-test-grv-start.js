/* Browser test: opening the Grammar review tab shows a start card (like the Words one) instead of dropping straight into questions.
 * Usage: node tools/smoke-test-grv-start.js   (needs Playwright; SHOT=dir saves a screenshot) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url); await page.waitForSelector('.app');
  const st = () => page.evaluate(() => ({ screen: window.shanlu.state.screen, n: (window.shanlu.quizQs || []).length, h: (document.querySelector('.res-h') || {}).innerText || '', p: (document.querySelector('.res-p') || {}).innerText || '', b: [...document.querySelectorAll('.res .btn')].map(b => b.innerText.trim()) }));

  await page.evaluate(() => window.shanlu.go('greview')); await page.waitForTimeout(250);
  let s = await st();
  check(s.screen === 'greview' && /Nothing to review yet/.test(s.h), 'before any lesson is passed the page says there is nothing to review yet');

  await page.evaluate(() => { const a = window.shanlu; const L = Object.keys(window.HSK1_GRAMMAR.points.reduce((o, p) => { o[p.lesson] = 1; return o; }, {}))[0]; a.setState({ gres: Object.assign({}, a.state.gres, { [L]: 90 }) }); });
  await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(150);
  await page.evaluate(() => window.shanlu.go('greview')); await page.waitForTimeout(250);
  s = await st();
  check(s.screen === 'greview', 'opening Grammar review stays on its own page (no questions yet)');
  check(/more points are due/i.test(s.h) && /points? (is|are) still due/.test(s.p) && s.b.length === 1 && /^Review \d+ points?$/.test(s.b[0]), 'it shows the start card with the number of points due: ' + s.h + ' / ' + s.b.join('|'));
  check(await page.locator('.res-ming').count() === 1, 'the card has the Ming illustration');
  if (process.env.SHOT) await page.screenshot({ path: path.join(process.env.SHOT, 'grv-start.png') });
  await page.locator('.res .btn.pri').click(); await page.waitForTimeout(250);
  s = await st();
  check(s.screen === 'quiz' && s.n > 0, 'the button starts the questions');
  await page.evaluate(() => window.shanlu.exitQuiz()); await page.waitForTimeout(200);
  s = await st();
  check(s.screen === 'greview', 'leaving a review returns to the start page');
  // the Review tabs reach it too
  await page.evaluate(() => window.shanlu.go('review')); await page.waitForTimeout(200);
  await page.locator('.subnav button', { hasText: 'Grammar' }).first().click(); await page.waitForTimeout(250);
  s = await st();
  check(s.screen === 'greview' && s.n >= 0 && /more points are due|caught up/i.test(s.h), 'the Grammar tab opens the start page: ' + s.h);
  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('grammar review start test passed');
})().catch(e => { console.log('crash', e); process.exit(1); });
