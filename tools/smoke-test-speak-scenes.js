/* Browser test (E3): speaking scenes with a choice (you pick what to say, Mingming answers that) and bad-day versions
 * (reached from their place with Good day / Bad day, never listed or counted on their own).   NODE_PATH=$(npm root -g) node tools/smoke-test-speak-scenes.js */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForSelector('.app');
  const text = () => page.locator('main').innerText();
  const open = async (id) => { await page.evaluate((id) => { const a = window.shanlu; a.go('speak'); a.pickScenario(window.HSK1_SPEAK.scenarios.findIndex(s => s.id === id)); }, id); await page.waitForTimeout(100); };
  await page.evaluate(() => { window.shanlu.go('speak'); window.shanlu.setState({ sview:'pick' }); }); await page.waitForTimeout(100);
  const cards = await page.locator('.spk-card').allInnerTexts();
  check(cards.length === 10 && !cards.some(c => /bad day:/i.test(c)) && cards.some(c => /Order a drink[\s\S]*and a bad day/.test(c)), 'the places list has 10 places; the bad-day versions are not cards of their own, and a place that has one says so');
  check(/0 of 10 places visited/.test(await text()), 'the count is of places (bad-day versions are not counted on their own)');
  // a choice: say the second line; Mingming answers that one
  await open('fruit');
  await page.locator('button', { hasText: 'I said it' }).click();
  check(await page.locator('.spk-opt').count() === 2 && /我要五个/.test(await text()) && /我要十个/.test(await text()), 'a turn with a choice shows both things you could say');
  await page.locator('.spk-opt').nth(1).locator('button').click(); await page.waitForTimeout(100);
  let t = await text();
  check(/我要十个/.test(t) && /十个苹果，二十块钱/.test(t) && !/五个苹果，十块钱/.test(t), 'after choosing the second line, the chat shows it and Mingming answers it (ten apples, twenty yuan)');
  check(await page.locator('.spk-opt').count() === 0 && await page.locator('button', { hasText: 'I said it' }).count() === 1, 'the next turn is an ordinary one again');
  await page.locator('button', { hasText: 'I said it' }).click(); await page.locator('button', { hasText: 'I said it' }).click(); await page.waitForTimeout(100);
  check(/Conversation complete/.test(await text()) && /再见/.test(await text()), 'the scene with a choice can be finished');
  // practise again and take the first line this time
  await page.locator('button', { hasText: 'Practice again' }).click();
  await page.locator('button', { hasText: 'I said it' }).click(); await page.locator('.spk-opt').nth(0).locator('button').click(); await page.waitForTimeout(100);
  t = await text();
  check(/五个苹果，十块钱/.test(t) && !/二十块钱/.test(t), 'practising again, the first line gets its own answer (five apples, ten yuan)');
  // a bad day
  await open('cafe');
  check(await page.locator('.spk-day button').count() === 2 && await page.locator('.spk-day button.on', { hasText: 'Good day' }).count() === 1, 'a place with a bad-day version offers Good day / Bad day');
  await page.locator('.spk-day button', { hasText: 'Bad day' }).click(); await page.waitForTimeout(100);
  check(await page.evaluate(() => window.HSK1_SPEAK.scenarios[window.shanlu.state.sidx].id) === 'cafe-bad' && await page.locator('.spk-day button.on', { hasText: 'Bad day' }).count() === 1, 'Bad day opens the bad-day version');
  await page.locator('button', { hasText: 'I said it' }).click(); await page.waitForTimeout(100);
  check(/今天没有茶了/.test(await text()), 'on a bad day the café has no tea');
  await page.evaluate(() => window.shanlu.lateReady()); await page.waitForTimeout(100);
  const st = await page.evaluate(() => [document.querySelector('.stage').getAttribute('style') || '', window.SHANLU_SPEAK_SCENES.cafe.u]);
  check(st[0].indexOf(st[1].slice(0, 200)) >= 0, 'the bad day borrows the café\'s backdrop');
  await page.locator('.spk-day button', { hasText: 'Good day' }).click(); await page.waitForTimeout(100);
  check(await page.evaluate(() => window.HSK1_SPEAK.scenarios[window.shanlu.state.sidx].id) === 'cafe', 'Good day goes back to the ordinary version');
  // a place without a bad day has no switch; role-play lists no bad days
  await open('intro');
  check(await page.locator('.spk-day').count() === 0, 'a place without a bad-day version has no switch');
  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('speaking scene tests passed');
})();
