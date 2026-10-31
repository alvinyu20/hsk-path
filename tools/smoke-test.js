/* Smoke test: loads the site in headless Chromium, clicks through every screen and flow,
 * and fails on any console error. Usage: node tools/smoke-test.js [screenshot-dir]
 * Needs Playwright (npm i playwright) and a Chromium build.
 * Quiz questions are read from the running app (window.shanlu.curQ()) and answered correctly, so every question type is exercised. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
// Default run: plain forms (no 儿 endings), which is what the site ships with. `--erhua` runs everything again in exam style (儿 endings on).
const erhuaMode = process.argv.includes('--erhua');
const WORD_COUNT = erhuaMode ? 300 : 297;
const shots = process.argv.slice(2).find(a => !a.startsWith('--')) || null;
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
  await ctx.addInitScript((erhua) => {
    try { if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {}
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
    // a fake microphone: it "hears" 我想喝茶
    window.webkitSpeechRecognition = function () { this.start = () => { setTimeout(() => { if (this.onresult) this.onresult({ results: [[{ transcript: '我想喝茶' }]] }); if (this.onend) this.onend(); }, 10); }; this.stop = () => {}; };
  }, erhuaMode);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR|status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
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
  check(await page.evaluate((N) => window.HSK1_WORDS.length === N && window.HSK1_WORDS.every(w => w.ex && w.ex.zh && w.py && w.en), WORD_COUNT), 'all ' + WORD_COUNT + ' words are loaded with a gloss, pinyin and an example');
  await shot('01-home');

  check(await page.evaluate(() => window.HSK1_WORDS.every(w => (w.more || []).length >= 2)), 'every word has at least two extra example sentences');

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
  check((await page.locator('.wc').first().locator('.wexbox .spk').count()) === 1, 'the example sentence has a play button');
  const more0 = await page.evaluate((zh) => { const m = window.HSK1_WORDS.find(w => w.zh === zh).more || []; return m.length ? m[0].zh : null; }, firstCardWord);
  check(!!more0, 'every word has more than one example sentence (' + firstCardWord + ')');
  await page.locator('.wc').first().locator('button', { hasText: 'Another example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.wc').first().innerText()).includes(more0) && (await page.locator('.wc').first().innerText()).includes('2 of'), 'Another example shows the next sentence for the word');
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

  // a word can carry a short note (汉语 and 中文 do)
  await page.evaluate(() => window.shanlu.setState({ screen: 'web', wmode: 'topic', wtopic: window.HSK1_WEBS.topics.findIndex(t => t.words.indexOf('汉语') >= 0), wquiz: false }));
  await page.waitForTimeout(80);
  const noteCard = page.locator('.tc', { hasText: '中文' }).first();
  await noteCard.locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await noteCard.innerText()).includes('everyday word'), 'the 中文 card shows its note under the example');
  check(!(await page.locator('.tc', { hasText: '茶' }).first().innerText().catch(() => '')).includes('everyday word'), 'other words have no note');

  // My words
  await nav('My words');
  check((await text()).includes(WORD_COUNT + ' HSK 1 words'), 'my words lists all ' + WORD_COUNT + ' words');
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

  // listen only: hide characters, pinyin and English
  await page.locator('.scn').nth(2).click();
  const firstAi = await page.evaluate(() => window.HSK1_SPEAK.scenarios[2].ai.map(x => x.zh));
  const chat0 = await page.locator('.msgs').innerText();
  check(chat0.includes(firstAi[0]), 'speaking shows the characters by default');
  for (const b of ['Characters', 'Pinyin', 'English']) await page.locator('.chat-h .seg2 button', { hasText: b }).click();
  await page.waitForTimeout(60);
  const chat1 = await page.locator('.msgs').innerText();
  check(!chat1.includes(firstAi[0]) && chat1.includes('Listen to Mingming'), 'with everything hidden the chat shows no Chinese or English, only the sound button');
  await page.locator('button', { hasText: 'I said it' }).click();
  await page.waitForTimeout(500);   // desktop audio waits a moment for the sound card to wake
  const lastSaid = await page.evaluate(() => window.__spoken[window.__spoken.length - 1]);
  check(lastSaid && lastSaid.text === firstAi[1], 'in listen-only mode Mingming\'s next line plays by itself');
  await page.locator('.chat-h .seg2 button', { hasText: 'Characters' }).click();
  check((await page.locator('.msgs').innerText()).includes(firstAi[0]), 'Characters brings the Chinese back');
  await page.reload();
  await page.waitForSelector('.app');
  await nav('Speak');
  check(!(await page.locator('.chat-h .seg2 button', { hasText: 'Pinyin' }).getAttribute('class') || '').includes('on'), 'the hidden pinyin and English stay hidden after a reload');
  await page.locator('.chat-h .seg2 button', { hasText: 'Pinyin' }).click();
  await page.locator('.chat-h .seg2 button', { hasText: 'English' }).click();

  // Mock exam: the bank, the draw, and a full sitting
  const drawCheck = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    for (let t = 0; t < 60; t++) ['listening', 'reading'].forEach(sec => {
      const qs = app.examDraw(sec);
      if (qs.length !== 20) bad.push(sec + ' has ' + qs.length + ' questions');
      const ids = new Set(qs.map(q => q.id)); if (ids.size !== 20) bad.push('duplicate question ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      if (Object.keys(parts).length !== 4 || Object.values(parts).some(n => n !== 5)) bad.push('parts are not 4 x 5: ' + JSON.stringify(parts));
      qs.forEach(q => {
        const vals = q.opts.map(o => o.v);
        if (!vals.includes(q.ans)) bad.push(q.id + ': the answer is not one of the options');
        if (new Set(q.opts.map(o => o.label)).size !== q.opts.length) bad.push(q.id + ': two options look the same');
      });
      ['L3', 'R2', 'R3', 'R4'].forEach(p => { const g = qs.filter(q => q.part === p); if (g.length && new Set(g.map(q => q.ans)).size !== 5) bad.push(p + ': two questions share an answer'); });
      ['L1', 'R1'].forEach(p => { const g = qs.filter(q => q.part === p); const t = g.filter(q => q.ans === 'T').length; if (g.length && (t < 2 || t > 3)) bad.push(p + ': true/false balance ' + t); });
    });
    return bad.slice(0, 5);
  });
  check(drawCheck.length === 0, '60 random exams are well formed: 20 + 20 questions, 4 parts of 5, one right answer each' + (drawCheck.length ? ' ' + drawCheck.join('; ') : ''));
  await nav('Level exam');
  check((await text()).includes('HSK 1 mock exam') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1, 'the exam page offers the full exam');
  const answerAll = async (right) => {
    const total = await page.evaluate(() => window.shanlu.state.exm.qs.length);
    for (let i = 0; i < total; i++) {
      const q = await page.evaluate(() => { const m = window.shanlu.state.exm; const q = m.qs[m.i]; return { ans: q.ans, vals: q.opts.map(o => o.v) }; });
      let target = q.vals.indexOf(q.ans);
      if (!right) target = (target + 1) % q.vals.length;
      await page.locator('.ex-opt').nth(target).click();
      if (i < total - 1) await page.locator('.ex-nav button', { hasText: 'Next' }).click();
    }
  };
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Listening') && (await text()).includes('Question 1 of 20') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the exam shows the section, the question number and a timer');
  const spokenBefore = await page.evaluate(() => window.__spoken.length);
  await page.locator('.ex-play button').click();
  await page.waitForTimeout(500);
  await page.locator('.ex-play button').click();
  await page.waitForTimeout(500);
  const spokenTwo = await page.evaluate(() => window.__spoken.length);
  await page.locator('.ex-play button').click({ force: true });
  check((await page.evaluate(() => window.__spoken.length)) === spokenTwo, 'a third play does nothing');
  const spokenAfter = await page.evaluate(() => window.__spoken.length);
  check(spokenAfter - spokenBefore >= 2 && (await text()).includes('0 plays left'), 'a listening clip can be played twice, then no more');
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('Listening is done') && (await text()).includes('20 of 20'), 'finishing the listening section of the full exam shows a break with the score');
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Reading') && (await text()).includes('Question 1 of 20'), 'the full exam goes on to reading');
  await answerAll(true);
  // make the last five wrong: go back and change them
  for (let k = 15; k < 20; k++) {
    await page.locator('.ex-pal button', { hasText: new RegExp('^' + (k + 1) + '$') }).click();
    const q = await page.evaluate(() => { const m = window.shanlu.state.exm; const q = m.qs[m.i]; return { ans: q.ans, vals: q.opts.map(o => o.v) }; });
    await page.locator('.ex-opt').nth((q.vals.indexOf(q.ans) + 1) % q.vals.length).click();
  }
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  const rt = await text();
  check(rt.includes('Your result') && rt.includes('175 / 200'), 'the result adds up: 20 + 15 right is 175 of 200');
  check(rt.includes('At or above 120') && !rt.includes('seal earned'), 'a pass on points but no seal when a section is under 80%');
  check((await page.locator('.exw').count()) === 5, 'the review lists the 5 missed questions');
  await shot('22-exam-result');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('Full exam') && (await text()).includes('175 / 200'), 'the attempt appears in the exam history');
  await page.locator('button', { hasText: 'Reading only' }).click();
  await page.locator('button', { hasText: 'Submit reading' }).click();
  check((await text()).includes('20 question(s) are unanswered'), 'submitting with unanswered questions asks first');
  await page.locator('button', { hasText: 'Submit reading' }).click();
  check((await text()).includes('0 of 20') && (await text()).includes('One section only'), 'a section on its own is scored on its own');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

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
  const lastSpoken = async () => { await page.waitForTimeout(500); return page.evaluate(() => window.__spoken[window.__spoken.length - 1] || null); };
  await page.locator('button', { hasText: 'Settings' }).first().click();
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
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: 'Use automatic' }).click();
  await page.evaluate(() => window.shanlu.say('你好', 'x'));
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.premium.zh-CN.Lili', 'going back to automatic uses the Premium voice again');
  await page.locator('button', { hasText: /Show every voice/ }).click();
  check((await text()).includes('Sinji · zh-HK'), 'the full voice list shows every voice the browser reports');
  await shot('21-voice');
  await page.locator('button', { hasText: 'Back to home' }).click();

  // 儿 endings switch
  const OFFICIAL_ER = ['面条儿', '一点儿', '有点儿', '好玩儿', '这儿', '那儿', '哪儿'];
  const modeNow = await page.evaluate((er) => ({ words: window.HSK1_WORDS.map(w => w.zh), er }), OFFICIAL_ER);
  if (erhuaMode) check(OFFICIAL_ER.every(z => modeNow.words.includes(z)), 'exam style keeps all seven 儿 words');
  else check(!OFFICIAL_ER.some(z => modeNow.words.includes(z)) && modeNow.words.includes('面条') && modeNow.words.includes('哪里'), 'plain mode has no 儿 words and uses 面条 and 哪里');
  // In plain mode the only 儿 left should be the real character 儿 "child" (儿子, 女儿 and their notes), plus typed answers that still accept the 儿 form.
  const leftovers = await page.evaluate(() => {
    const out = [];
    const walk = (v, where) => {
      if (typeof v === 'string') { if (/儿/.test(v.replace(/女儿|儿子/g, ''))) out.push(where + ': ' + v); }
      else if (Array.isArray(v)) { if (!/\.accepts$/.test(where)) v.forEach((x, i) => walk(x, where + '[' + i + ']')); }
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k));
    };
    ['HSK1_WORDS', 'HSK1_GRAMMAR', 'HSK1_WEBS', 'HSK1_SPEAK', 'HSK1_LISTEN'].forEach(k => walk(window[k], k));
    return out;
  });
  const okLeft = (l) => /parts\[\d\]\[0\]: 儿$/.test(l) || /opps\[\d+\]\.note: Son and daughter/.test(l);
  if (!erhuaMode) check(leftovers.every(okLeft) && leftovers.length === 3, 'plain mode leaves no 儿 ending in the content (only the "child" character is left)' + (leftovers.every(okLeft) ? '' : ': ' + leftovers.filter(l => !okLeft(l)).slice(0, 3).join(' | ')));
  const myKey = erhuaMode ? '面条儿' : '面条', otherKey = erhuaMode ? '面条' : '面条儿';
  await page.evaluate((k) => { const ws = Object.assign({}, window.shanlu.state.ws); ws[k] = { see: { s: 7, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws }); window.shanlu.persistNow(); }, myKey);
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes(erhuaMode ? 'Now: 儿 endings are on' : 'Now: plain forms'), 'the voice and 儿 screen says which style is on');
  await Promise.all([page.waitForNavigation(), page.locator('button', { hasText: erhuaMode ? 'Switch to plain forms' : 'Switch to 儿 endings' }).click()]);
  await page.waitForSelector('.app');
  const flipped = await page.evaluate((a) => ({ n: window.HSK1_WORDS.length, has: window.HSK1_WORDS.some(w => w.zh === a), s: window.shanlu.state.ws[a] && window.shanlu.state.ws[a].see.s, gone: window.shanlu.state.ws[a === '面条' ? '面条儿' : '面条'] === undefined }), otherKey);
  check(flipped.n === (erhuaMode ? 297 : 300) && flipped.has, 'switching flips the word list (' + flipped.n + ' words)');
  check(flipped.s === 7, 'progress on a renamed word carries over when the style switches (' + myKey + ' to ' + otherKey + ')');
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await Promise.all([page.waitForNavigation(), page.locator('button', { hasText: erhuaMode ? 'Switch to 儿 endings' : 'Switch to plain forms' }).click()]);
  await page.waitForSelector('.app');
  const back = await page.evaluate((a) => ({ n: window.HSK1_WORDS.length, s: window.shanlu.state.ws[a] && window.shanlu.state.ws[a].see.s }), myKey);
  check(back.n === WORD_COUNT && back.s === 7, 'switching back restores the list and the progress');

  // real time: a word reviewed 3 days ago with a 1.5-day interval is due; one reviewed just now is not
  const timeCheck = await page.evaluate(() => {
    const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
    const keys = Object.keys(ws); const a = keys[10], b = keys[11];
    keys.forEach(z => { ws[z] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    ws[a].see = { s: 1.5, l: 0, t: Date.now() - 3 * 864e5 };
    ws[b].see = { s: 1.5, l: 0, t: Date.now() };
    app.setState({ ws, rq: [], rcomplete: false });
    app.reviewMore();
    return { a, b, rq: app.state.rq.slice() };
  });
  check(timeCheck.rq.includes(timeCheck.a) && !timeCheck.rq.includes(timeCheck.b), 'a word becomes due as real days pass (reviewed 3 days ago is due, just now is not)');

  // sync across devices, against a fake GitHub (two separate browsers sharing one gist)
  const S2 = require('../sync.js');
  const fakeGists = {}; let gistN = 0;
  const route = async (r) => {
    const req = r.request(); const u = new URL(req.url()); const method = req.method(); const j = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if ((req.headers()['authorization'] || '') !== 'Bearer ghp_test') return j({ message: 'Bad credentials' }, 401);
    if (method === 'GET' && u.pathname === '/gists') return j(Object.keys(fakeGists).map(id => ({ id, files: fakeGists[id] })));
    if (method === 'POST' && u.pathname === '/gists') { const b = JSON.parse(req.postData()); const id = 'g' + (++gistN); fakeGists[id] = { [S2.FILE]: { content: b.files[S2.FILE].content } }; return j({ id }, 201); }
    const m = u.pathname.match(/^\/gists\/(\w+)$/);
    if (m && method === 'GET') return fakeGists[m[1]] ? j({ id: m[1], files: fakeGists[m[1]] }) : j({}, 404);
    if (m && method === 'PATCH') { fakeGists[m[1]][S2.FILE].content = JSON.parse(req.postData()).files[S2.FILE].content; return j({}); }
    return j({}, 500);
  };
  await ctx.route('https://api.github.com/**', route);
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('Sync across devices') && (await page.locator('input[aria-label="GitHub token"]').count()) === 1, 'settings has a sync card with a token box');
  await page.fill('input[aria-label="GitHub token"]', 'nope');
  await page.locator('button', { hasText: 'Connect' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  check((await text()).includes('rejected the token'), 'a wrong token is explained, not silent');
  await page.locator('button', { hasText: 'Disconnect this device' }).click();
  await page.fill('input[aria-label="GitHub token"]', 'ghp_test');
  await page.evaluate(() => { const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws)); ws['你好'] = { see: { s: 9, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws, xp: 777 }); });
  await page.locator('button', { hasText: 'Connect' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  check((await text()).includes('private GitHub gist') && Object.keys(fakeGists).length === 1, 'connecting creates one private gist');
  check(!JSON.stringify(fakeGists).includes('ghp_test'), 'the token is not written into the gist');
  // device two: a fresh browser
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.route('https://api.github.com/**', route);
  const p2 = await ctx2.newPage();
  await p2.goto(url); await p2.waitForSelector('.app');
  check(await p2.evaluate(() => window.shanlu.state.xp === 0), 'a second browser starts with nothing');
  await p2.locator('button', { hasText: 'Settings' }).first().click();
  await p2.fill('input[aria-label="GitHub token"]', 'ghp_test');
  await p2.locator('button', { hasText: 'Connect' }).click();
  await p2.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  const got = await p2.evaluate(() => ({ xp: window.shanlu.state.xp, s: window.shanlu.state.ws['你好'].see.s }));
  check(got.xp === 777 && got.s === 9, 'the second browser gets the first one\'s progress after connecting');
  await p2.evaluate(() => { const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws)); ws['谢谢'] = { see: { s: 4, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws }); });
  await p2.locator('button', { hasText: 'Sync now' }).click();
  await p2.waitForFunction(() => !window.shanlu.state.syncBusy);
  await page.locator('button', { hasText: 'Sync now' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy);
  check(await page.evaluate(() => window.shanlu.state.ws['谢谢'].see.s === 4 && window.shanlu.state.ws['你好'].see.s === 9), 'work done on the second browser reaches the first after a sync');
  await ctx2.close();
  await page.locator('button', { hasText: 'Disconnect this device' }).click();
  await page.locator('button', { hasText: 'Back to home' }).click();

  // AI conversation, against a fake Anthropic API
  const aiCalls = [];
  let aiMode2 = 'ok';
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData());
    aiCalls.push({ headers: req.headers(), body });
    if (aiMode2 === 'bad-key') return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{}' });
    const n = aiCalls.length;
    const reply = n === 1 ? { reply: { zh: '你好！你想喝什么？', en: 'Hello! What do you want to drink?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我想喝茶。', en: 'I want to drink tea.' } }
      : n === 2 ? { reply: { zh: '好的，你想去公园吗？', en: 'Okay, do you want to go to the park?' }, feedback: { level: 'fix', better: '我想喝茶。', why: 'Add 想 to say you would like something.' }, suggest: n === 2 ? { zh: '我想去学校。', en: 'I want to go to school.' } : undefined }
      : { reply: { zh: '很好！', en: 'Very good!' }, feedback: { level: 'ok', better: '', why: '' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'Here you go: ' + JSON.stringify(reply) }] }) });
  });
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('AI conversation (optional)'), 'settings has an AI conversation card');
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  check((await text()).includes('Saved on this device') && (await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).key === 'sk-ant-test')), 'the key is saved on this device');
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你好！你想喝什么？') && first.includes('Nǐ hǎo! Nǐ xiǎng hē shénme?'), 'Mingming opens the conversation, with pinyin from the site\'s own word list');
  check(aiCalls[0].headers['x-api-key'] === 'sk-ant-test' && aiCalls[0].headers['anthropic-dangerous-direct-browser-access'] === 'true' && /^claude-/.test(aiCalls[0].body.model), 'the request carries the key and a Claude model name');
  check(aiCalls[0].body.system.includes('米饭') && aiCalls[0].body.system.includes('HSK 1'), 'the instructions hold the HSK 1 word list');
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__spoken[window.__spoken.length - 1].text)) === '你好！你想喝什么？', 'Mingming\'s reply is spoken aloud');
  check(await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).count() === 1 && !(await page.locator('.ai-dock').innerText()).includes('Wǒ xiǎng hē chá'), 'a suggested reply is offered but not shown until you ask');
  await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).click();
  const sugTxt = await page.locator('.ai-dock').innerText();
  check(sugTxt.includes('我想喝茶。') && sugTxt.includes('Wǒ xiǎng hē chá.') && sugTxt.includes('I want to drink tea.'), 'the suggested reply shows characters, pinyin with tone marks and English');
  await page.locator('button[aria-label="Hear the suggested reply"]').click();
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__spoken[window.__spoken.length - 1].text)) === '我想喝茶。', 'the suggested reply can be played');
  await page.locator('.ai-tools button', { hasText: 'Speak' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiInput === '我想喝茶');
  check((await page.inputValue('input[aria-label="Your reply"]')) === '我想喝茶', 'the microphone puts what it heard in the box to check');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 3 && !window.shanlu.state.aiBusy);
  const second = await page.locator('.msgs').innerText();
  check(second.includes('我想喝茶') && second.includes('A more natural way') && second.includes('Add 想'), 'the correction of your line is shown under it');
  check(second.includes('Matches the suggested reply'), 'saying the suggested reply is recognised as a match');
  check(second.includes('Not in the HSK 1 list: 公 园') || second.includes('Not in the HSK 1 list: 园') || second.includes('Not in the HSK 1 list'), 'words outside HSK 1 in a reply are flagged');
  check(aiCalls[1].body.messages.length >= 3 && aiCalls[1].body.messages[aiCalls[1].body.messages.length - 1].content === '我想喝茶', 'the conversation so far is sent along');
  const exported = await page.evaluate(() => { window.shanlu.persistNow(); return JSON.stringify(JSON.parse(localStorage.getItem('shanlu-progress-v1'))); });
  check(!exported.includes('sk-ant-test'), 'the key is not in the saved progress (so not in the export or the sync)');
  await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).click();
  await page.fill('input[aria-label="Your reply"]', '我想去商店');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 5 && !window.shanlu.state.aiBusy);
  const third = await page.locator('.msgs').innerText();
  check(third.includes('Not the same as the suggestion') && third.includes('我想去学校。') && third.includes('商'), 'a reply that differs from the suggestion shows what was suggested and where it differs');
  aiMode2 = 'bad-key';
  await page.fill('input[aria-label="Your reply"]', '你好');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiErr);
  check((await text()).includes('API key was rejected'), 'a rejected key is explained');
  await page.locator('.modeseg button', { hasText: 'Practice script' }).click();
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: 'Remove the key' }).click();
  check(!(await page.evaluate(() => localStorage.getItem('shanlu-ai') && JSON.parse(localStorage.getItem('shanlu-ai')).key)), 'the key can be removed');
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
