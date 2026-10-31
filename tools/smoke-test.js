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
  // A fake text-to-speech with the kinds of voices an iPhone lists, so the voice picker can be tested without a phone.
  await ctx.addInitScript(() => {
    const mk = (name, lang, uri, local) => ({ name, lang, voiceURI: uri, localService: local !== false, default: false });
    const voices = [
      mk('Sinji', 'zh-HK', 'com.apple.voice.compact.zh-HK.Sinji'),
      mk('Meijia', 'zh-TW', 'com.apple.voice.compact.zh-TW.Meijia'),
      mk('Tingting', 'zh-CN', 'com.apple.voice.compact.zh-CN.Tingting'),
      mk('Lili (Premium)', 'zh-CN', 'com.apple.voice.premium.zh-CN.Lili'),
      mk('Daniel', 'en-GB', 'com.apple.voice.compact.en-GB.Daniel')
    ];
    window.__spoken = [];
    const ss = { getVoices: () => voices, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.voiceURI, lang: u.lang }); }, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
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
  check((await text()).includes('0 new words today') && !/\d+ of \d+ new words today/.test(await text()), 'word webs open with no daily limit');
  for (let i = 0; i < 6; i++) { await page.locator('button', { hasText: 'Add to my words' }).first().click(); await page.waitForTimeout(50); }
  check((await text()).includes('6 new words today'), 'six words added with no limit in the way');
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) > 0, 'add buttons are still there after six words');
  await page.locator('[aria-label="New words per day"] button', { hasText: /^5$/ }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('You have reached your limit of 5') && (await page.locator('button', { hasText: 'Add to my words' }).count()) === 0, 'choosing a limit of 5 stops further adds');
  await page.locator('[aria-label="New words per day"] button', { hasText: 'No limit' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) > 0, 'choosing "No limit" brings the add buttons back');
  const before = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  check(after > before + 1, 'Add all adds the rest of a shared-character group (' + before + ' to ' + after + ')');
  check((await page.locator('[aria-label="Pick a character"] button').count()) >= 20, 'many shared-character groups are available');
  await shot('02-webs');
  await page.locator('[aria-label="Pick a character"] button', { hasText: '饭' }).click();
  check((await text()).includes('米饭'), 'switching the shared character shows its words');
  // Show example: a word's own sentence, on demand
  const firstCardWord = (await page.locator('.wc .wc-zh').first().innerText()).trim();
  const firstEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, firstCardWord);
  check(!(await page.locator('.wc').first().innerText()).includes(firstEx), 'a word card does not show its example sentence until asked');
  await page.locator('.wc').first().locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.wc').first().innerText()).includes(firstEx), 'Show example reveals the word\'s example sentence (' + firstCardWord + ': ' + firstEx + ')');
  check((await page.locator('.wc').first().locator('.exbox .spk').count()) === 1, 'the example sentence has a play button');
  await page.locator('.wc').first().locator('button', { hasText: 'Hide example' }).click();
  await page.waitForTimeout(60);
  check(!(await page.locator('.wc').first().innerText()).includes(firstEx), 'Hide example puts it away again');
  await page.locator('button', { hasText: 'Quiz me' }).click();
  check((await page.locator('button', { hasText: 'Show example' }).count()) === 0, 'in quiz mode the example stays hidden until the meaning is revealed');
  await page.locator('button', { hasText: 'Reveal meaning' }).first().click();
  await page.locator('button', { hasText: 'Add to my words' }).first().click().catch(() => {});
  await page.locator('button', { hasText: 'Opposites' }).click();
  await page.locator('button', { hasText: 'Reveal' }).first().click();
  check((await page.locator('.orow').count()) >= 20, 'opposite pairs are listed');
  const pair = await page.evaluate(() => window.HSK1_WEBS.opps[0]);
  const opBefore = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(!opBefore.a && !opBefore.b, 'the first opposite pair starts out not added (' + pair.a + ' / ' + pair.b + ')');
  const rowText = await page.locator('.orow').first().innerText();
  check(rowText.includes('Add both words') && rowText.includes('Add ' + pair.a) && rowText.includes('Add ' + pair.b), 'a revealed opposite pair offers both words and "Add both"');
  await page.locator('.orow').first().locator('button', { hasText: 'Add both words' }).click();
  await page.waitForTimeout(60);
  const opAfter = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(opAfter.a && opAfter.b, 'Add both starts the left and the right word of an opposite pair');
  check(!(await page.locator('.orow').first().innerText()).includes('Add both words'), 'no add buttons are left once both words are started');
  const exA = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.a).ex.zh, pair);
  const exB = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.b).ex.zh, pair);
  await page.locator('.orow').first().locator('button', { hasText: 'Show examples' }).click();
  await page.waitForTimeout(60);
  const oText = await page.locator('.orow').first().innerText();
  check(oText.includes(exA) && oText.includes(exB), 'an opposite pair can show an example for both words');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.locator('[aria-label="Topic"] button', { hasText: 'At school' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.tgrid .tc').count()) >= 20, 'a topic lists its words');
  const tcWord = (await page.locator('.tc .tc-zh').first().innerText()).trim();
  const tcEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, tcWord);
  await page.locator('.tc').first().locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.tc').first().innerText()).includes(tcEx), 'a topic card can show its word\'s example sentence (' + tcWord + ': ' + tcEx + ')');
  check(/\d+ of \d+ started/.test(await text()), 'a topic shows how many of its words you started');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(100);
  const tp = (await text()).match(/(\d+) of (\d+) started/);
  check(tp && tp[1] === tp[2], 'Add all on a topic starts every word in it (' + (tp ? tp[0] : 'no progress text') + ')');
  await shot('03-topics');
  await page.locator('button', { hasText: 'Shared character' }).click();
  await page.locator('.opts .opt').first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('Next sentence'), 'fill-the-gap gives feedback');

  // "Which word fits?" must not always put the right answer first
  const gapPositions = [];
  for (let k = 0; k < 40; k++) {
    const hubIdx = k % 20, qIdx = Math.floor(k / 20);
    await page.evaluate(([h, q]) => window.shanlu.setState({ whub: h, gfq: q, gfpick: null }), [hubIdx, qIdx]);
    await page.waitForTimeout(25);
    const labels = await page.locator('.opts .opt').allInnerTexts();
    const ans = await page.evaluate(([h, q]) => window.HSK1_WEBS.hubs[h].gaps[q].ans, [hubIdx, qIdx]);
    gapPositions.push(labels.findIndex(t => t.split(/\s/)[0] === ans));
  }
  check(!gapPositions.includes(-1) && new Set(gapPositions).size >= 3 && gapPositions.filter(x => x === 0).length <= 20, 'the right answer is not always the first option (positions ' + gapPositions.join('') + ')');
  const gapStable = await page.evaluate(async () => { const a = [...document.querySelectorAll('.opts .opt')].map(e => e.innerText).join('|'); window.shanlu.setState({ xp: window.shanlu.state.xp }); await new Promise(r => setTimeout(r, 60)); return a === [...document.querySelectorAll('.opts .opt')].map(e => e.innerText).join('|'); });
  check(gapStable, 'the option order stays put when the page redraws');

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
  // make 100 words due and check that reviews continue in rounds
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).slice(0, 100).forEach(zh => { ws[zh].see = { s:1, l:5 }; }); app.setState({ ws, rq:[], rcomplete:false }); });
  await nav('Review words');
  check((await text()).includes('More words are due') && (await text()).includes('Review 30 more'), 'when more than a round is due, review offers the next 30');
  await page.locator('button', { hasText: 'Review 30 more' }).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.rq.length)) === 30, 'a review round has 30 cards');
  await page.evaluate(() => { window.shanlu.setState({ rq:[], rcomplete:true }); });
  await page.waitForTimeout(100);
  check((await page.locator('button', { hasText: /^Review \d+ more$/ }).count()) === 1, 'the finished-round screen offers more while words are still due');
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).forEach(zh => { if (ws[zh].see.s === 1 && ws[zh].see.l === 5) ws[zh].see = { s:30, l:0 }; }); app.setState({ ws, rq:[], rcomplete:false }); });

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
  await nav('Word webs');
  await page.locator('[aria-label="New words per day"] button', { hasText: /^10$/ }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.app');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'progress survives a reload');
  await nav('Grammar');
  check((await page.locator('.gl .gp.done').count()) >= 4, 'passed lessons survive a reload');
  await nav('Speak');
  check((await page.locator('.scn.done').count()) >= 2, 'finished speaking scripts survive a reload');
  await nav('Word webs');
  check(/of 10 new words today/.test(await text()), 'a chosen daily limit survives a reload');
  await nav('My words');
  check(!(await text()).includes('0 words started'), 'word progress survives a reload');


  // Chinese voice picker
  const lastSpoken = () => page.evaluate(() => window.__spoken[window.__spoken.length - 1] || null);
  await page.locator('button', { hasText: 'Chinese voice' }).first().click();
  await page.waitForTimeout(100);
  const vt = await text();
  check(vt.includes('Lili (Premium)') && vt.includes('Tingting') && vt.includes('Meijia'), 'voice screen lists the Mandarin voices');
  check(!vt.includes('Sinji') && !vt.includes('Daniel'), 'Cantonese and English voices are left out of the list');
  check(vt.includes('Automatic: Lili (Premium)'), 'automatic picks the Premium mainland voice over compact ones');
  await page.locator('button', { hasText: /^Play$/ }).first().click();
  let sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.premium.zh-CN.Lili' && sp.lang === 'zh-CN', 'automatic plays with the Premium voice and its own language tag');
  await page.locator('.vrow', { hasText: 'Tingting' }).locator('button', { hasText: /^Play$/ }).click();
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.compact.zh-CN.Tingting', 'a sample plays with the voice you tapped');
  check(await page.evaluate(() => window.shanlu.state.voiceId === ''), 'playing a sample does not change the chosen voice');
  await page.locator('.vrow', { hasText: 'Tingting' }).locator('button', { hasText: 'Use this voice' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.vrow.on').innerText()).includes('Tingting'), 'the chosen voice is marked in use');
  await page.evaluate(() => window.shanlu.say('你好', 'x'));
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.compact.zh-CN.Tingting', 'the rest of the site now speaks with the chosen voice');
  await page.reload();
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.shanlu.state.voiceId === 'com.apple.voice.compact.zh-CN.Tingting'), 'the chosen voice survives a reload');
  await page.locator('button', { hasText: 'Chinese voice' }).first().click();
  await page.locator('button', { hasText: 'Use automatic' }).click();
  await page.evaluate(() => window.shanlu.say('你好', 'x'));
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.premium.zh-CN.Lili', 'going back to automatic uses the Premium voice again');
  await page.locator('button', { hasText: /Show every voice/ }).click();
  check((await text()).includes('Sinji · zh-HK'), 'the full voice list shows every voice the browser reports');
  await shot('21-voice');
  await page.locator('button', { hasText: 'Back to home' }).click();

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
