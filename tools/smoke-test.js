/* Smoke test: loads the site in headless Chromium, clicks through every screen and flow,
 * and fails on any console error. Usage: node tools/smoke-test.js [screenshot-dir]
 * Needs Playwright (npm i playwright) and a Chromium build. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const shots = process.argv[2] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); };
  const nav = async (label) => { await page.locator('nav button', { hasText: label }).first().click(); await page.waitForTimeout(120); };
  const text = async () => (await page.locator('main').innerText());

  await page.goto(url);
  await page.waitForSelector('.app');
  check((await text()).includes('Welcome back'), 'home loads');
  check((await page.locator('.side').innerText()).includes('0-day streak'), 'fresh state starts at a 0-day streak');
  await shot('01-home');

  // Word webs
  await nav('Word webs');
  check((await text()).includes('0 of 5 new words today'), 'word webs open');
  await page.locator('button', { hasText: 'Add to my words' }).first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('1 of 5 new words today'), 'adding a word counts it');
  for (let i = 0; i < 3; i++) { await page.locator('button', { hasText: 'Add to my words' }).first().click(); await page.waitForTimeout(60); }
  await page.locator('.hubcard .seg2 button', { hasText: '学' }).click();
  await page.locator('button', { hasText: 'Add to my words' }).first().click();
  await page.waitForTimeout(60);
  check((await text()).includes('5 of 5 new words today'), 'five words added');
  check((await text()).includes('That is five new words for today'), 'daily cap note shows');
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) === 0, 'no add buttons after the cap');
  await shot('02-webs');
  await page.locator('button', { hasText: 'Quiz me' }).click();
  await page.locator('button', { hasText: 'Reveal meaning' }).first().click();
  await page.locator('button', { hasText: 'I knew it' }).first().click();
  await page.waitForTimeout(100);
  check(/Mastery \d+% → \d+%/.test(await text()), 'rating shows a mastery change');
  await page.locator('button', { hasText: 'Opposites' }).click();
  await page.locator('button', { hasText: 'Reveal' }).first().click();
  await page.locator('button', { hasText: 'Topics' }).click();
  await shot('03-topics');
  await page.locator('button', { hasText: 'Shared character' }).click();
  // gap exercise
  await page.locator('.opts .opt').first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('Next sentence'), 'fill-the-gap gives feedback');

  // My words
  await nav('My words');
  check((await text()).includes('40 words in this preview'), 'my words lists 40 words');
  await page.locator('button', { hasText: 'In 1 month' }).click();
  await shot('04-mywords');

  // Review
  await nav('Review words');
  check((await text()).includes('all caught up') || (await text()).includes('All caught up'), 'review shows caught up when nothing is due');
  await page.locator('button', { hasText: 'Practice the 5 weakest anyway' }).click();
  await page.waitForTimeout(100);
  await shot('05-review-front');
  await page.locator('button', { hasText: 'Show answer' }).click();
  await page.waitForTimeout(800);
  await shot('06-review-back');
  for (let i = 0; i < 5; i++) {
    if (!(await page.locator('.rates .rate').count())) await page.locator('button', { hasText: 'Show answer' }).click();
    await page.locator('.rates .rate').nth(2).click();
    await page.waitForTimeout(80);
  }
  check((await text()).includes('words reviewed'), 'review finishes');

  // Listening lab
  await nav('Listening lab');
  await page.locator('button.listen').click();
  await page.fill('#dict-input', 'ni xiang he shenme');
  await page.locator('button', { hasText: 'Check' }).click();
  await page.waitForTimeout(150);
  check((await text()).includes('4 of 4 words caught'), 'dictation scores a correct answer');
  await shot('07-listening');
  await page.locator('button', { hasText: 'Shadowing' }).click();
  for (let i = 0; i < 3; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Next clip'), 'shadowing completes after three rounds');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button.listen').click();
  await page.locator('.tonebtn').first().click();

  // Grammar + quiz
  await nav('Grammar');
  check((await text()).includes('Soon'), 'grammar marks unfinished lessons as Soon');
  await shot('08-grammar');
  await page.locator('button', { hasText: 'Practice this point' }).click();
  await page.waitForTimeout(100);
  // order question: tap tiles in the right order 你 喜欢 茶 吗
  for (const t of ['你', '喜欢', '茶', '吗']) await page.locator('.bank .tile', { hasText: t }).first().click();
  await page.locator('button', { hasText: 'Check' }).click();
  await shot('09-quiz-feedback');
  check((await text()).includes('Correct'), 'grammar order question accepts the right sentence');
  await page.locator('button', { hasText: 'Continue' }).click();
  await page.locator('.tok', { hasText: '吗' }).click();
  await page.locator('button', { hasText: 'Check' }).click();
  await page.locator('button', { hasText: 'Continue' }).click();
  await page.fill('#answer-input', 'ma');
  await page.locator('button', { hasText: 'Check' }).click();
  await page.locator('button', { hasText: 'Continue' }).click();
  for (const t of ['她', '是', '你', '的', '朋友', '吗']) await page.locator('.bank .tile', { hasText: new RegExp('^' + t + '$') }).first().click();
  await page.locator('button', { hasText: 'Check' }).click();
  await page.locator('button', { hasText: 'See results' }).click();
  check((await text()).includes('Back to home'), 'grammar practice reaches results');
  await shot('10-results');

  // Test
  await nav('Tests');
  check((await text()).includes('No tests yet'), 'tests show an empty history at first');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.fill('#answer-input', 'shui'); await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'Continue' }).click();
  await page.locator('.opts .opt').nth(1).click(); await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'Continue' }).click();
  for (const t of ['我', '想', '喝', '茶']) await page.locator('.bank .tile', { hasText: new RegExp('^' + t + '$') }).first().click();
  await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'Continue' }).click();
  await page.fill('#answer-input', 'hao'); await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'Continue' }).click();
  await page.locator('.opts .opt').nth(1).click(); await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'See results' }).click();
  check((await text()).includes('5/5'), 'test scores 5/5 with correct answers');
  await nav('Tests');
  check(!(await text()).includes('No tests yet'), 'test result is saved to history');

  // Speak
  await nav('Speak');
  for (let i = 0; i < 4; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Conversation complete'), 'speaking script completes');
  await shot('11-speak');

  // Exam + home
  await nav('Level exam');
  await shot('12-exam');
  await nav('Home');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'streak counts after activity');
  await shot('13-home-after');

  // persistence
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.app');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'progress survives a reload');
  await nav('My words');
  check(!(await text()).includes('0 words started'), 'word progress survives a reload');

  // export
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).click();
  const d = await dl;
  check(/shanlu-progress-\d{4}-\d{2}-\d{2}\.json/.test(d.suggestedFilename()), 'export downloads a progress file');

  // dark mode + phone width
  await page.locator('button', { hasText: 'Switch to dark' }).click();
  await shot('14-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await nav('Home');
  await shot('15-phone-home');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at phone width');
  await nav('Word webs');
  await shot('16-phone-webs');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on word webs at phone width');

  check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
