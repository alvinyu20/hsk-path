/* Smoke test for HSK 2: loads the site at level 2 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, AI conversation, level switch, separate progress), and that the parts
 * that do not exist yet (listening lab, practice scripts, mock exam) say so instead of breaking.
 * Usage: node tools/smoke-test-l2.js   (needs Playwright). The HSK 1 test is tools/smoke-test.js. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
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
  check(!home.includes('Listening drill') && !home.includes('Say: ') && home.includes('Grammar: Comparing'), 'Today offers word webs and grammar, not the listening drill or practice scripts');
  check(home.includes('HSK 2 progress') && (await page.locator('.rg').count()) === 2, 'the exam card becomes an "HSK 2 progress" card with two rings');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'] }));
  check(st.n === 197 && !st.l1 && st.l2, 'progress holds the 197 HSK 2 words and none of the HSK 1 words');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1')), 'HSK 1 progress is not touched by opening HSK 2');

  // ---- word webs
  await nav('Word webs');
  check((await page.locator('[aria-label="Pick a character"] button').count()) === 17, 'HSK 2 has 17 shared-character groups');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const added = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned));
  check(added.length === 7 && added.every(z => /来/.test(z)), 'Add all starts the seven 来 words (' + added.join(' ') + ')');
  await page.locator('button', { hasText: 'Opposites' }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('左') && (await text()).includes('右'), 'opposite pairs include 左 and 右');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.waitForTimeout(80);
  const topicN = await page.evaluate(() => window.HSK2_WEBS.topics.length);
  check(topicN === 13 && (await text()).includes('Getting around'), 'the topics screen lists the 13 HSK 2 topics');
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
  check(lessons === 18, 'the Grammar screen has 18 HSK 2 lessons');
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
  check((await page.locator('.gl .gp.done').count()) === 18, 'all 18 lessons are marked done');
  // wrong answers are marked wrong in each question type
  await page.locator('.gl .gp').nth(0).click();
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- parts that are not built at this level
  await nav('Listening lab');
  check((await text()).includes('not built for HSK 2 yet'), 'the listening lab says it is not built for HSK 2 yet');
  await nav('Level exam');
  check((await text()).includes('not built yet'), 'the level exam says it is not built yet');

  // ---- Speak is the AI conversation only; talk to a fake Anthropic API
  await nav('Speak');
  check((await page.locator('.modeseg').count()) === 0, 'Speak has no practice-script switch at HSK 2');
  check((await text()).includes('Talk with Mingming'), 'Speak opens on the AI conversation');
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你去机场吗？', en: 'Are you going to the airport?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我坐地铁去。', en: 'I go by subway.' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  await page.locator('button', { hasText: 'Open Settings' }).click();
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  await nav('Speak');
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  const sys = calls[0].system;
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('HSK 2'), 'the instructions hold the HSK 1 and HSK 2 word lists');
  check(!sys.includes('as a gentle preview'), 'at HSK 2 there is no "preview of the next level" instruction');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你去机场吗？') && first.includes('Nǐ qù jīchǎng ma?'), 'an HSK 2 word in the reply gets its pinyin from the HSK 2 list');
  check(!(await page.locator('.msgs').innerText()).includes('HSK 2 preview'), 'HSK 2 words are not flagged as a preview at HSK 2');
  const scn = await page.locator('.scn, .ai-scn, [class*="scn"]').allInnerTexts();
  check((await text()).includes('Ordering at a café') && (await text()).includes('Planning a trip'), 'HSK 2 role-play settings are offered');

  // ---- settings: level card, no 儿 card, export names the level
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('You are studying HSK 2') && !(await text()).includes('endings'), 'Settings has a Level card and no 儿 endings card at HSK 2');
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
  check((await text()).includes('297 words to go'), 'switching to HSK 1 shows the HSK 1 trail');
  check(await page.evaluate(() => Object.keys(window.shanlu.state.ws).length === 297 && !window.shanlu.state.ws['机场'] && Object.keys(window.shanlu.state.wlearned).length === 0), 'HSK 1 progress is separate: none of the HSK 2 words started there');
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
