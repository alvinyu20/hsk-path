/* Smoke test for HSK 2: loads the site at level 2 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, AI conversation, level switch, separate progress), and that the parts
 * that do not exist yet (listening lab, practice scripts, mock exam) say so instead of breaking.
 * Usage: node tools/smoke-test-l2.js   (needs Playwright). The HSK 1 test is tools/smoke-test.js. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
// Default run: plain forms (no 儿 endings). `--erhua` runs everything again in exam style (儿 endings on).
const erhuaMode = process.argv.includes('--erhua');
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
  // ---- the lock: a fresh browser has not passed HSK 1, so HSK 2 stays closed
  {
    const c0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p0 = await c0.newPage();
    await p0.goto(url + '?level=2');
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 1, 'asking for ?level=2 before passing HSK 1 gives HSK 1');
    check((await p0.locator('main').innerText()).includes('HSK 2 is locked'), 'the page explains that HSK 2 is locked');
    check((await p0.locator('.lvseg button', { hasText: 'HSK 2' }).innerText()).includes('🔒'), 'the HSK 2 button shows a lock');
    await p0.evaluate(() => localStorage.setItem('shanlu-level', '2'));
    await p0.reload();
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 1, 'a saved choice of HSK 2 does not get past the lock either');
    // an exam sitting in the saved HSK 1 progress opens it (the pass is read from the progress, so a device that synced the pass is covered)
    await p0.goto(url + 'level.js');   // a page without the app, so the app cannot save over what is written here
    await p0.evaluate(() => { const k = 'shanlu-progress-v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.exams = [{ at: 1, mode: 'full', l: 17, r: 15 }]; localStorage.setItem(k, JSON.stringify(o)); });
    await p0.goto(url + '?level=2');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 1, '17 of 20 and 15 of 20 (75% in reading) does not open HSK 2');
    await p0.goto(url + 'level.js');
    await p0.evaluate(() => { const k = 'shanlu-progress-v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.exams = [{ at: 1, mode: 'reading', l: null, r: 20 }, { at: 2, mode: 'full', l: 16, r: 16 }]; localStorage.setItem(k, JSON.stringify(o)); });
    await p0.goto(url + '?level=2');
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 2, 'a full exam with 16 of 20 in both sections opens HSK 2');
    await c0.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript((erhua) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, erhuaMode);
  await ctx.addInitScript(() => {
    const voices = [{ name: 'Tingting', lang: 'zh-CN', voiceURI: 'com.apple.voice.compact.zh-CN.Tingting', localService: true, default: false }];
    window.__spoken = [];
    const ss = { getVoices: () => voices, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, rate: u.rate }); }, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR|status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

  const nav = async (label) => { await page.locator('nav button', { hasText: label }).first().click(); await page.waitForTimeout(120); };
  const text = async () => (await page.locator('main').innerText());
  const answer = async (right) => {
    const q = await page.evaluate(() => JSON.parse(JSON.stringify(window.shanlu.curQ())));
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
    await page.waitForTimeout(30);
    return q;
  };
  const runQuiz = async (right) => {
    const total = await page.evaluate(() => window.shanlu.quizQs.length);
    for (let i = 0; i < total; i++) {
      await answer(right);
      await page.locator('button', { hasText: i === total - 1 ? 'See results' : 'Continue' }).click();
      await page.waitForTimeout(30);
    }
    return total;
  };

  // ---- load at level 2
  await page.goto(url + '?level=2');
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.SHANLU_LEVEL) === 2, 'the address ?level=2 selects HSK 2');
  check(!page.url().includes('level='), 'the ?level part is removed from the address so a reload does not reapply it');
  check((await page.locator('.side').innerText()).includes('HSK 2'), 'the sidebar says HSK 2');
  check((await page.title()).includes('HSK 2'), 'the page title says HSK 2');
  const home = await text();
  check(home.includes('197 words to go'), 'the trail counts the 197 HSK 2 words');
  check(home.includes('Listening drill') && home.includes('Say: ') && home.includes('Grammar: Comparing'), 'Today offers word webs, the listening drill, a practice script and grammar');
  check(home.includes('HSK 2 level exam') && home.includes('Reach 80%') && (await page.locator('.rg').count()) === 4, 'the home card is the HSK 2 level exam with four skill rings and the pass bar');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'] }));
  check(st.n === 197 && !st.l1 && st.l2, 'progress holds the 197 HSK 2 words and none of the HSK 1 words');
  const kidWord = await page.evaluate((erhua) => ({ has: !!window.shanlu.state.ws[erhua ? '男孩儿' : '男孩'], other: !!window.shanlu.state.ws[erhua ? '男孩' : '男孩儿'], moment: !!window.shanlu.state.ws['一会儿'] }), erhuaMode);
  check(kidWord.has && !kidWord.other && kidWord.moment, 'the HSK 2 儿 words follow the switch (' + (erhuaMode ? '男孩儿' : '男孩') + ', and 一会儿 keeps its 儿 in both' + ')');
  const allText = await page.evaluate(() => JSON.stringify([window.HSK2_WORDS, window.HSK2_GRAMMAR, window.HSK2_WEBS]));
  check(erhuaMode ? /这儿|哪儿|一点儿/.test(allText) : !/这儿|哪儿|一点儿|有点儿|孩儿/.test(allText), erhuaMode ? 'in 儿 style the HSK 2 content shows the 儿 forms' : 'in plain style no 儿 ending is left in the HSK 2 content');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1')), 'HSK 1 progress is not touched by opening HSK 2');

  // ---- word webs
  await nav('Word webs');
  check((await page.locator('[aria-label="Pick a character"] button').count()) === 17, 'HSK 2 has 17 shared-character groups');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const added = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned));
  check(added.length === 7 && added.every(z => /来/.test(z)), 'Add all starts the seven 来 words (' + added.join(' ') + ')');
  await page.locator('button', { hasText: 'Pairs' }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('左') && (await text()).includes('右'), 'opposite pairs include 左 and 右');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.waitForTimeout(80);
  const topicN = await page.evaluate(() => window.HSK2_WEBS.topics.length);
  check(topicN === 14 && (await text()).includes('Getting around'), 'the topics screen lists the 14 HSK 2 topics');
  check(await page.evaluate(() => window.HSK2_WEBS.hubs.every(h => h.gaps.every(g => g.opts.includes(g.ans)))), 'every fill-in gap has its answer among its options');

  // ---- review and My words
  await nav('My words');
  check((await text()).includes('机场') || (await text()).includes('出来'), 'My words lists HSK 2 words');
  await nav('Review words');
  check((await text()).length > 50, 'the review screen opens');

  // ---- tests
  await nav('Tests');
  check((await text()).includes('HSK 2 test'), 'the test screen is titled HSK 2 test');
  await page.evaluate(() => {
    const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws));
    ['机场', '地铁', '左边', '右边', '前面'].forEach(z => { ws[z] = { see: { s: 2, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    window.shanlu.setState({ ws });
  });
  await nav('Tests');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  const onlyL2 = await page.evaluate(() => window.shanlu.quizQs.every(q => !q.word || !!window.HSK2_WORDS.find(w => w.zh === q.word)));
  check(onlyL2, 'every test question is about an HSK 2 word');
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'a test answered correctly scores full marks');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- every grammar lesson: all 90 questions answered correctly
  await nav('Grammar');
  const lessons = await page.evaluate(() => window.HSK2_GRAMMAR.lessons.length);
  check(lessons === 19, 'the Grammar screen has 19 HSK 2 lessons');
  let allFull = true;
  for (let i = 0; i < lessons; i++) {
    await page.locator('.gl .gp').nth(i).click();
    await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
    await page.waitForTimeout(60);
    const total = await runQuiz(true);
    if (!(await text()).includes(total + '/' + total)) { allFull = false; console.log('lesson', i + 1, 'did not score full marks'); }
    await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
    await nav('Grammar');
  }
  check(allFull, 'every HSK 2 lesson scores full marks when its questions are answered correctly');
  check((await page.locator('.gl .gp.done').count()) === 19, 'all 19 lessons are marked done');
  // wrong answers are marked wrong in each question type
  await page.locator('.gl .gp').nth(0).click();
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- listening lab, practice scripts, mock exam (all exist at HSK 2 now)
  await nav('Listening lab');
  check((await text()).includes('Dictation') && (await text()).includes('Shadowing') && (await text()).includes('Tone trainer'), 'the HSK 2 listening lab has dictation, shadowing and the tone trainer');
  check(await page.evaluate(() => window.HSK2_LISTEN.clips.length === 24 && window.HSK2_LISTEN.clips.every(c => c.words.length >= 3 && c.notes.length >= 1)), 'there are 24 HSK 2 clips, each with words to dictate and notes');
  await page.locator('button[aria-label="Play the clip"]').first().click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__spoken.length > 0 && window.HSK2_LISTEN.clips.some(c => window.__spoken.some(x => x.text === c.zh))), 'a dictation clip is read aloud');
  await nav('Speak');
  check((await page.locator('.modeseg').count()) === 1 && (await text()).includes('Practice script'), 'Speak has the practice-script switch at HSK 2');
  const scn = await page.evaluate(() => window.HSK2_SPEAK.scenarios.map(s => s.title));
  check(scn.length === 8 && (await text()).includes('Ask the way') && (await text()).includes('Order at a café'), 'the eight HSK 2 scripts are listed');
  await page.locator('button', { hasText: 'I said it' }).first().click();
  check((await text()).includes('请问，车站在哪') || (await text()).includes('请问，车站在哪里'), 'an HSK 2 script plays: the first line of the first scenario shows after "I said it"');
  await nav('Level exam');
  check((await text()).includes('HSK 2 mock exam') && (await text()).includes('35 questions') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1, 'the HSK 2 exam page offers the full exam (35 + 25 questions)');
  const draw = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    for (let t = 0; t < 60; t++) ['listening', 'reading'].forEach(sec => {
      const qs = app.examDraw(sec); const want = sec === 'listening' ? 35 : 25;
      if (qs.length !== want) bad.push(sec + ' has ' + qs.length);
      if (new Set(qs.map(q => q.id)).size !== want) bad.push('duplicate ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      const exp = sec === 'listening' ? { L1: 10, L2: 10, L3: 10, L4: 5 } : { R1: 5, R2: 5, R3: 5, R4: 10 };
      Object.keys(exp).forEach(k => { if (parts[k] !== exp[k]) bad.push(sec + ' part ' + k + ' has ' + parts[k]); });
      qs.forEach(q => { if (!q.opts.some(o => o.v === q.ans)) bad.push(q.id + ': answer not among options'); if (new Set(q.opts.map(o => o.label)).size !== q.opts.length) bad.push(q.id + ': two options look the same'); });
      ['L2', 'R1', 'R2', 'R4'].forEach(p => { const g = qs.filter(q => q.part === p); if (g.length) { const per = p === 'L2' || p === 'R4' ? 5 : 5; for (let i = 0; i < g.length; i += per) { if (new Set(g.slice(i, i + per).map(q => q.right)).size !== 5) bad.push(p + ': two questions in one set share an answer'); } } });
    });
    return bad.slice(0, 5);
  });
  check(draw.length === 0, '60 random HSK 2 exams are well formed: 35 + 25 questions in the right parts, one right answer each' + (draw.length ? ' ' + draw.join('; ') : ''));
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
  // a sitting with many wrong answers: no seal, and no level to open
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Question 1 of 35') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the exam starts with question 1 of 35 and a timer');
  await answerAll(false);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Question 1 of 25'), 'reading has 25 questions');
  await answerAll(false);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  let rt = await text();
  check(rt.includes('Your result') && !rt.includes('seal earned') && !rt.includes('is now open'), 'a sitting with wrong answers earns no seal');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  // a perfect sitting: 100 + 100, the seal, and it is remembered as passed
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  rt = await text();
  check(rt.includes('200 / 200') && rt.includes('HSK 2 seal earned'), 'a perfect HSK 2 sitting scores 200 of 200 and earns the seal');
  check(!rt.includes('is now open'), 'there is no next level to open yet, so no unlock card');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[2]), 'the HSK 2 pass is remembered (it will open HSK 3 later)');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('200 / 200'), 'the sitting appears in the exam history');

  // ---- Speak is the AI conversation only; talk to a fake Anthropic API
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  check((await text()).includes('Talk with Mingming'), 'Talk with AI is the second tab in Speak');
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你去机场吗？你很聪明。', en: 'Are you going to the airport? You are clever.' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我坐地铁去。', en: 'I go by subway.' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  await page.locator('button', { hasText: 'Open Settings' }).click();
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  const sys = calls[0].system;
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('HSK 2'), 'the instructions hold the HSK 1 and HSK 2 word lists');
  check(sys.includes('as a gentle preview') && sys.includes('HSK 3 list') && sys.includes('聪明'), 'at HSK 2 the instructions allow a few HSK 3 words as a preview');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你去机场吗？') && first.includes('Nǐ qù jīchǎng ma?'), 'an HSK 2 word in the reply gets its pinyin from the HSK 2 list');
  check(first.includes('HSK 3 preview') && first.includes('聪明 cōngming = intelligent') && first.includes('cōngming'), 'an HSK 3 word in the reply is shown as a preview, with pinyin and English');
  check(!first.includes('HSK 2 preview') && !(await page.locator('.msgs').innerText()).includes('no pinyin'), 'HSK 2 words are not flagged as a preview or as unknown at HSK 2');
  check((await text()).includes('Order at a café') && (await text()).includes('Buy trousers'), 'the HSK 2 script scenarios are offered as role-play settings');

  // ---- settings: level card, no 儿 card, export names the level
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('You are studying HSK 2') && (await text()).includes('儿 endings'), 'Settings has a Level card and the 儿 endings card at HSK 2');
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).first().click();
  const d = await dl;
  check(/hsk2/.test(d.suggestedFilename()), 'the exported file name says hsk2 (' + d.suggestedFilename() + ')');
  const exported = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  check(exported.level === 2 && Object.keys(exported.data.ws).length === 197, 'the exported file is marked as level 2 and holds 197 words');
  // an HSK 1 file is refused at HSK 2
  await page.evaluate(() => window.shanlu.importText(JSON.stringify({ app: 'shanlu', version: 1, level: 1, data: { ws: {} } })));
  check(dialogs.some(m => /HSK 1 progress, but this page is on HSK 2/.test(m)), 'importing an HSK 1 file at HSK 2 is refused with an explanation');

  // ---- switching level keeps both progresses
  await page.locator('.lvseg button', { hasText: 'HSK 1' }).click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 1);
  await page.waitForSelector('.app');
  const l1Words = erhuaMode ? 300 : 297; // three HSK 1 words fold into another form in plain style
  check((await text()).includes(l1Words + ' words to go'), 'switching to HSK 1 shows the HSK 1 trail');
  check(await page.evaluate((n) => Object.keys(window.shanlu.state.ws).length === n && !window.shanlu.state.ws['机场'] && Object.keys(window.shanlu.state.wlearned).length === 0, l1Words), 'HSK 1 progress is separate: none of the HSK 2 words started there');
  check((await page.locator('nav button', { hasText: 'Listening lab' }).count()) === 1 && (await page.locator('main').innerText()).includes('Say: '), 'HSK 1 still offers its listening lab and practice scripts');
  await page.locator('.lvseg button', { hasText: 'HSK 2' }).click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 2);
  await page.waitForSelector('.app');
  check(await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length === 7 && window.shanlu.state.gres[window.HSK2_GRAMMAR.lessons[0].id] >= 80), 'switching back to HSK 2 brings its progress back (7 web words, lesson results)');

  check(errors.length === 0, 'no console errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all HSK 2 checks passed');
  process.exit(failures ? 1 : 0);
})();
