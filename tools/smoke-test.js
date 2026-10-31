/* Smoke test: loads the site in headless Chromium, clicks through every screen and flow,
 * and fails on any console error. Usage: node tools/smoke-test.js [screenshot-dir]
 * Needs Playwright (npm i playwright) and a Chromium build.
 * Quiz questions are read from the running app (window.shanlu.curQ()) and answered correctly, so every question type is exercised. */
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
  const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // Answers the current quiz question. right=false picks a wrong answer where it can.
  const answer = async (right) => {
    const q = await page.evaluate(() => { const q = window.shanlu.curQ(); return JSON.parse(JSON.stringify(q)); });
    if (q.type === 'order') {
      const order = right ? q.toks : q.toks.slice().reverse();
      for (const t of order) {
        const tiles = page.locator('.bank .tile:not(.ghost)');
        const n = await tiles.count();
        for (let i = 0; i < n; i++) { if ((await tiles.nth(i).innerText()).trim() === t) { await tiles.nth(i).click(); break; } }
      }
    } else if (q.type === 'cloze' || q.type === 'type') {
      await page.fill('#answer-input', right ? q.accepts[q.accepts.length - 1] : 'xx');
    } else if (q.type === 'spot') {
      await page.locator('.tok').nth(right ? q.spot : (q.spot + 1) % q.tokens.length).click();
    } else if (q.type === 'mc' || q.type === 'listen') {
      const opts = page.locator('.opts .opt');
      const n = await opts.count();
      let target = -1;
      for (let i = 0; i < n; i++) { const o = q.options[i]; if ((o.id === q.correct) === right) { target = i; break; } }
      await opts.nth(target).click();
    }
    await page.locator('button', { hasText: 'Check' }).click();
    await page.waitForTimeout(40);
    return q;
  };
  const runQuiz = async (right) => {
    let total = await page.evaluate(() => window.shanlu.quizQs.length);
    for (let i = 0; i < total; i++) {
      await answer(right);
      await page.locator('button', { hasText: i === total - 1 ? 'See results' : 'Continue' }).click();
      await page.waitForTimeout(40);
    }
    return total;
  };

  await page.goto(url);
  await page.waitForSelector('.app');
  check((await text()).includes('Welcome back'), 'home loads');
  check((await page.locator('.side').innerText()).includes('0-day streak'), 'fresh state starts at a 0-day streak');
  check(await page.evaluate(() => window.HSK1_WORDS.length === 300 && window.HSK1_WORDS.every(w => w.ex && w.ex.zh && w.py && w.en)), 'all 300 words are loaded with a gloss, pinyin and an example');
  await shot('01-home');

  // Tests are blocked until words are started
  await nav('Tests');
  check((await text()).includes('Add at least three words'), 'test is blocked until you have started words');
  check((await page.locator('button', { hasText: 'Start the test' }).count()) === 0, 'no start button while blocked');

  // Word webs
  await nav('Word webs');
  check((await text()).includes('0 of 5 new words today'), 'word webs open with a daily limit of 5');
  await page.locator('button', { hasText: 'Add to my words' }).first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('1 of 5 new words today'), 'adding a word counts it');
  for (let i = 0; i < 4; i++) { await page.locator('button', { hasText: 'Add to my words' }).first().click(); await page.waitForTimeout(60); }
  check((await text()).includes('5 of 5 new words today'), 'five words added');
  check((await text()).includes('That is 5 new words for today'), 'daily cap note shows');
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) === 0, 'no add buttons after the cap');
  await page.locator('[aria-label="New words per day"] button', { hasText: /^8$/ }).click();
  await page.waitForTimeout(80);
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) > 0, 'raising the daily limit brings the add buttons back');
  await page.locator('button', { hasText: 'Add to my words' }).first().click();
  await page.waitForTimeout(60);
  check((await text()).includes('6 of 8 new words today'), 'the new daily limit is used');
  check((await page.locator('[aria-label="Pick a character"] button').count()) >= 20, 'many shared-character groups are available');
  await shot('02-webs');
  await page.locator('[aria-label="Pick a character"] button', { hasText: '饭' }).click();
  check((await text()).includes('米饭'), 'switching the shared character shows its words');
  await page.locator('button', { hasText: 'Quiz me' }).click();
  await page.locator('button', { hasText: 'Reveal meaning' }).first().click();
  await page.locator('button', { hasText: 'Add to my words' }).first().click().catch(() => {});
  await page.locator('button', { hasText: 'Opposites' }).click();
  await page.locator('button', { hasText: 'Reveal' }).first().click();
  check((await page.locator('.orow').count()) >= 20, 'opposite pairs are listed');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.locator('[aria-label="Topic"] button', { hasText: 'At school' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.tgrid .tc').count()) >= 20, 'a topic lists its words');
  check(/\d+ of \d+ started/.test(await text()), 'a topic shows how many of its words you started');
  await shot('03-topics');
  await page.locator('button', { hasText: 'Shared character' }).click();
  await page.locator('.opts .opt').first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('Next sentence'), 'fill-the-gap gives feedback');

  // My words
  await nav('My words');
  check((await text()).includes('300 HSK 1 words'), 'my words lists all 300 words');
  check((await page.locator('.wrow').count()) === 40, 'my words shows the first 40 rows');
  await page.locator('button', { hasText: 'Show 40 more' }).click();
  check((await page.locator('.wrow').count()) === 80, 'show more adds 40 rows');
  await page.fill('.wsearch', 'tea');
  await page.waitForTimeout(100);
  check((await page.locator('.wrow').first().innerText()).includes('茶'), 'search by English finds 茶 first');
  await page.fill('.wsearch', 'xiexie');
  await page.waitForTimeout(100);
  check((await page.locator('.wrow').first().innerText()).includes('谢谢'), 'search by pinyin without tone marks works');
  await page.fill('.wsearch', '');
  await page.locator('button', { hasText: 'In 1 month' }).click();
  await shot('04-mywords');

  // Review
  await nav('Review words');
  check((await text()).toLowerCase().includes('all caught up'), 'review shows caught up when nothing is due');
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
  check(await page.evaluate(() => window.HSK1_LISTEN.clips.length) >= 20, 'there are at least 20 listening clips');
  await page.locator('button.listen').click();
  await page.fill('#dict-input', 'ni hao wo jiao xiaoming');
  await page.locator('button', { hasText: 'Check' }).click();
  await page.waitForTimeout(150);
  check(/(\d+) of \1 words caught/.test(await text()), 'dictation scores a correct answer');
  await shot('07-listening');
  await page.locator('button', { hasText: 'Shadowing' }).click();
  for (let i = 0; i < 3; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Next clip'), 'shadowing completes after three rounds');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button.listen').click();
  await page.locator('.tonebtn').first().click();

  // Grammar
  await nav('Grammar');
  check((await page.locator('.gl .gp').count()) === 26, 'grammar lists 26 lessons');
  check((await text()).toLowerCase().includes('lesson 1 of 26'), 'the first lesson is open');
  await shot('08-grammar');
  await page.locator('.gl .gp').nth(3).click();
  check((await text()).includes('Yes/no questions with 吗'), 'choosing a lesson opens it');
  check((await text()).includes('你想喝茶吗'), 'the 吗 lesson teaches the offer with 想');
  await page.locator('button', { hasText: 'Practise this lesson' }).click();
  await page.waitForTimeout(100);
  // a wrong answer first: feedback should say so and the combo resets
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await shot('09-quiz-feedback');
  await page.locator('button', { hasText: 'Continue' }).click();
  for (let i = 1; i < 5; i++) {
    await answer(true);
    await page.locator('button', { hasText: i === 4 ? 'See results' : 'Continue' }).click();
    await page.waitForTimeout(40);
  }
  check((await text()).includes('4/5'), 'one wrong answer scores 4/5');
  await shot('10-results');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
  await page.waitForTimeout(100);
  await nav('Grammar');
  check((await page.locator('.gl .gp.cur').first().innerText()).includes('80%'), 'the lesson shows its best score');
  // pass every question of another lesson (all question types appear across lessons)
  for (const idx of [0, 4, 14, 20]) {
    await page.locator('.gl .gp').nth(idx).click();
    await page.locator('button', { hasText: 'Practise this lesson' }).click();
    await page.waitForTimeout(80);
    const total = await runQuiz(true);
    check((await text()).includes(total + '/' + total), 'lesson ' + (idx + 1) + ' scores ' + total + '/' + total + ' with right answers');
    await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
    await nav('Grammar');
  }
  check((await page.locator('.gl .gp.done').count()) >= 4, 'passed lessons are marked done');

  // Test
  await nav('Tests');
  check((await text()).includes('No tests yet'), 'tests show an empty history at first');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  const kinds = await page.evaluate(() => Array.from(new Set(window.shanlu.quizQs.map(q => q.type))));
  check(kinds.length >= 3, 'the test mixes question types: ' + kinds.join(', '));
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'test scores full marks with correct answers');
  await nav('Tests');
  check(!(await text()).includes('No tests yet'), 'test result is saved to history');
  const hear = await page.evaluate(() => Object.values(window.shanlu.state.ws).filter(w => w.hear.s > 0 || w.prod.s > 0).length);
  check(hear >= 1, 'test answers update the Hear / Recall bars of words');

  // Speak
  await nav('Speak');
  check((await page.locator('.scn').count()) === 8, 'speaking lists 8 scripts');
  for (let i = 0; i < 4; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Conversation complete'), 'the first speaking script completes');
  await page.locator('.scn').nth(1).click();
  check((await page.locator('.chat-t').innerText()).includes('Introduce yourself'), 'choosing another script opens it');
  for (let i = 0; i < 4; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Conversation complete'), 'the second speaking script completes');
  check((await page.locator('.scn.done').count()) >= 2, 'finished scripts are marked done');
  await shot('11-speak');

  // Exam + home
  await nav('Level exam');
  await shot('12-exam');
  await nav('Home');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'streak counts after activity');
  check((await text()).includes('lessons passed') && (await text()).includes('scripts done'), 'home shows grammar and speaking progress');
  await shot('13-home-after');

  // persistence
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.app');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'progress survives a reload');
  await nav('Grammar');
  check((await page.locator('.gl .gp.done').count()) >= 4, 'passed lessons survive a reload');
  await nav('Speak');
  check((await page.locator('.scn.done').count()) >= 2, 'finished speaking scripts survive a reload');
  await nav('Word webs');
  check((await text()).includes('of 8 new words today'), 'the daily limit setting survives a reload');
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
  for (const [label, name] of [['Home', '15-phone-home'], ['Word webs', '16-phone-webs'], ['My words', '17-phone-words'], ['Grammar', '18-phone-grammar'], ['Speak', '19-phone-speak'], ['Listening lab', '20-phone-listen']]) {
    await nav(label);
    await shot(name);
    check(await noSideways(), 'no sideways scroll on ' + label + ' at phone width');
  }
  await page.locator('button', { hasText: 'Topics' }).first().click().catch(() => {});

  check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
