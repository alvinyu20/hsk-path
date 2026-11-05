/* Smoke test for HSK 3: loads the site at level 3 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, AI conversation, level switch, separate progress, All levels with three levels),
 * and that the parts that are not built yet (listening lab, practice scripts, mock exam) say so instead of breaking.
 * HSK 3 is closed on the real site until it is released, so this test opens it: the test server gives level.js MAX_LEVEL = 3 and
 * adds the HSK 3 data scripts to the page (tools/test-static.js, option level3). The lock itself is tested by smoke-test-l2.js.
 * Usage: node tools/smoke-test-l3.js [--erhua]   (needs Playwright). Tests for the other levels: smoke-test.js, smoke-test-l2.js. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const erhuaMode = process.argv.includes('--erhua');
const server = require('./test-static').server(root, { level3: true });

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();

  // ---- the lock: a fresh browser has not passed HSK 2, so HSK 3 stays closed
  {
    const c0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c0.addInitScript(() => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); } catch (e) {} });
    const p0 = await c0.newPage();
    await p0.goto(url + '?level=3');
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 2, 'asking for ?level=3 before passing HSK 2 gives HSK 2');
    check((await p0.locator('main').innerText()).includes('HSK 3 is locked'), 'the page explains that HSK 3 is locked');
    check((await p0.locator('.lvseg button', { hasText: 'HSK 3' }).innerText()).includes('🔒'), 'the HSK 3 button shows a lock');
    await c0.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript((erhua) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, erhuaMode);
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
      await page.fill('#answer-input', right ? (q.exp ? q.exp.py.split('/')[0].trim() : q.accepts[q.accepts.length - 1]) : 'xx');
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

  // ---- load at level 3
  await page.goto(url + '?level=3');
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.SHANLU_LEVEL) === 3, 'the address ?level=3 selects HSK 3 once HSK 2 is passed');
  check(!page.url().includes('level='), 'the ?level part is removed from the address so a reload does not reapply it');
  check((await page.locator('.side').innerText()).includes('HSK 3'), 'the sidebar says HSK 3');
  check((await page.title()).includes('HSK 3'), 'the page title says HSK 3');
  const n3 = await page.evaluate(() => window.HSK3_WORDS.length);
  check(n3 === 491, 'the HSK 3 list has 491 cards (' + n3 + ')');
  const home = await text();
  check(home.includes(n3 + ' words to go'), 'the trail counts the ' + n3 + ' HSK 3 words');
  check(home.includes('Grammar: '), 'Today offers a grammar lesson');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'], l3: !!window.shanlu.state.ws['聪明'] }));
  check(st.n === n3 && !st.l1 && !st.l2 && st.l3, 'progress holds the HSK 3 words and none of the HSK 1 or HSK 2 words');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1') && !localStorage.getItem('shanlu-progress-v1-l2')), 'HSK 1 and HSK 2 progress are not touched by opening HSK 3');
  const allText = await page.evaluate(() => JSON.stringify([window.HSK3_WORDS, window.HSK3_GRAMMAR, window.HSK3_WEBS]));
  check(erhuaMode ? /这儿|哪儿|一点儿/.test(allText) : !/这儿|哪儿|一点儿|有点儿|孩儿/.test(allText), erhuaMode ? 'in 儿 style the HSK 3 content shows the 儿 forms' : 'in plain style no 儿 ending is left in the HSK 3 content');
  check(await page.evaluate(() => { const all = JSON.stringify([window.HSK3_WORDS, window.HSK3_GRAMMAR, window.HSK3_WEBS]); return !/yǒushí jiān|měi tiān|wài guó rén/.test(all); }), 'HSK 3 pinyin keeps 有时间, 每天 and 外国人 as one word each');

  // ---- word webs
  await nav('Word webs');
  await page.locator('button', { hasText: 'Shared character' }).click();
  const hubN = await page.evaluate(() => window.HSK3_WEBS.hubs.length);
  check((await page.locator('[aria-label="Pick a character"] button').count()) === hubN && hubN === 28, 'HSK 3 has ' + hubN + ' shared-character groups, all listed');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const added = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned));
  const hub0 = await page.evaluate(() => window.HSK3_WEBS.hubs[0].hub);
  check(added.length >= 3 && added.every(z => z.includes(hub0)), 'Add all starts the new ' + hub0 + ' words (' + added.join(' ') + ')');
  await page.locator('button', { hasText: 'Word pairs' }).click();
  await page.waitForTimeout(80);
  const opp0 = await page.evaluate(() => window.HSK3_WEBS.opps.map(o => o.a + o.b));
  check(opp0.length === 29 && (await text()).includes(await page.evaluate(() => window.HSK3_WEBS.opps[0].a)), 'the word pairs screen lists the opposite pairs (' + opp0.length + ')');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.waitForTimeout(80);
  const topicInfo = await page.evaluate(() => ({ n: window.HSK3_WEBS.topics.length, words: new Set([].concat(...window.HSK3_WEBS.topics.map(t => t.words))).size, small: window.HSK3_WEBS.topics.filter(t => t.words.length < 3).length }));
  const railN = (await page.locator('.trail-rail .tr-gn').allInnerTexts()).reduce((a, t) => a + parseInt(t, 10), 0);
  check(topicInfo.n > 30 && railN === topicInfo.n, 'the topics screen lists the HSK 3 topics (' + topicInfo.n + ')');
  check(topicInfo.words === n3, 'every one of the ' + n3 + ' HSK 3 words is in a topic (' + topicInfo.words + ')');
  check(await page.evaluate(() => window.HSK3_WEBS.hubs.every(h => h.gaps.every(g => g.opts.includes(g.ans)))), 'every fill-in gap has its answer among its options');

  // ---- review and My words
  await nav('My words');
  check((await text()).includes('阿姨') && (await text()).includes('491 words'), 'My words lists the 491 HSK 3 words');
  await nav('Review words');
  check((await text()).length > 50, 'the review screen opens');

  // ---- tests
  await nav('Tests');
  check((await text()).includes('HSK 3 test'), 'the test screen is titled HSK 3 test');
  await page.evaluate(() => {
    const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws));
    window.HSK3_WORDS.slice(0, 5).forEach(w => { ws[w.zh] = { see: { s: 2, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    window.shanlu.setState({ ws });
  });
  await nav('Tests');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  check(await page.evaluate(() => window.shanlu.quizQs.every(q => !q.word || !!window.HSK3_WORDS.find(w => w.zh === q.word))), 'every test question is about an HSK 3 word');
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'a test answered correctly scores full marks');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- every grammar lesson: all questions answered correctly
  await nav('Grammar');
  const lessons = await page.evaluate(() => window.HSK3_GRAMMAR.lessons.length);
  check(lessons === 28, 'the Grammar screen has 28 HSK 3 lessons (' + lessons + ')');
  let allFull = true;
  for (let i = 0; i < lessons; i++) {
    await page.evaluate((j) => window.shanlu.pickLesson(j), i);
    await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
    await page.waitForTimeout(60);
    const total = await runQuiz(true);
    if (!(await text()).includes(total + '/' + total)) { allFull = false; console.log('lesson', i + 1, 'did not score full marks'); }
    await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
    await nav('Grammar');
  }
  check(allFull, 'every HSK 3 lesson scores full marks when its questions are answered correctly');
  check(await page.evaluate(() => Object.values(window.shanlu.state.gres).filter(v => v >= 80).length) === 28, 'all 28 lessons are marked done');
  await page.evaluate(() => window.shanlu.pickLesson(0));
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- the parts that are not built yet say so
  await nav('Listening lab');
  check((await text()).includes('not built for HSK 3 yet'), 'the listening lab says it is not built for HSK 3 yet');
  await nav('Speak');
  check((await text()).includes('Talk with Mingming') || (await text()).includes('Mingming'), 'Speak is the AI conversation only (no practice scripts yet)');

  // ---- Speak: talk to a fake Anthropic API
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你担心考试吗？', en: 'Are you worried about the exam?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我有一点儿担心。', en: 'I am a little worried.' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  await page.locator('button', { hasText: 'Open Settings' }).click();
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  await nav('Speak');
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  await page.locator('.ai-tools button', { hasText: 'Type instead' }).click();   // voice only is the default and keeps Mingming's lines hidden
  const sys = calls[0].system;
  check(sys.includes('HSK 1, HSK 2 and HSK 3') && sys.includes('HSK 1 and HSK 2 words are known too'), 'the instructions name all three word lists');
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('聪明') && sys.includes('担心'), 'the instructions hold the HSK 1, HSK 2 and HSK 3 words');
  check(!sys.includes('as a gentle preview'), 'there is no next level to preview, so the instructions do not offer one');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你担心考试吗？') && first.includes('Nǐ dānxīn kǎoshì ma?'), 'an HSK 3 word in the reply gets its pinyin from the HSK 3 list');
  check(!first.includes('preview') && !first.includes('no pinyin'), 'HSK 3 words are not flagged as a preview or as unknown at HSK 3');

  // ---- settings: level card, export names the level
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('You are studying HSK 3'), 'Settings has a Level card that says HSK 3');
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).first().click();
  const d = await dl;
  check(/hsk3/.test(d.suggestedFilename()), 'the exported file name says hsk3 (' + d.suggestedFilename() + ')');
  const exported = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  check(exported.level === 3 && Object.keys(exported.data.ws).length === n3, 'the exported file is marked as level 3 and holds ' + n3 + ' words');
  await page.evaluate(() => window.shanlu.importText(JSON.stringify({ app: 'shanlu', version: 1, level: 2, data: { ws: {} } })));
  check(dialogs.some(m => /HSK 2 progress, but this page is on HSK 3/.test(m)), 'importing an HSK 2 file at HSK 3 is refused with an explanation');

  // ---- switching level keeps every progress
  await page.locator('.lvseg button', { hasText: 'HSK 2' }).click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 2);
  await page.waitForSelector('.app');
  check((await text()).includes('197 words to go'), 'switching to HSK 2 shows the HSK 2 trail');
  check(await page.evaluate(() => !window.shanlu.state.ws['聪明'] && Object.keys(window.shanlu.state.wlearned).length === 0), 'HSK 2 progress is separate: none of the HSK 3 words started there');
  await page.locator('.lvseg button', { hasText: 'HSK 3' }).click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 3);
  await page.waitForSelector('.app');
  check(await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length >= 3 && window.shanlu.state.gres[window.HSK3_GRAMMAR.lessons[0].id] >= 80), 'switching back to HSK 3 brings its progress back (web words, lesson results)');

  // ---- All levels: three levels together, progress still saved per level
  {
    const cA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cA.addInitScript((erhua) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, erhuaMode);
    const pA = await cA.newPage();
    const errsA = []; pA.on('pageerror', e => errsA.push(String(e)));
    await pA.goto(url + '?level=0');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL) === 0 && await pA.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2,3', 'the address ?level=0 shows All levels with all three levels once HSK 3 is unlocked');
    check(await pA.evaluate(() => Object.keys(window.shanlu.state.ws).length === window.HSK1_WORDS.length + window.HSK2_WORDS.length + window.HSK3_WORDS.length), 'All levels holds the words of the three levels');
    check((await pA.locator('.lvseg button', { hasText: 'All' }).getAttribute('class') || '').includes('on'), 'the All button is the selected one');
    check((await pA.locator('.lvseg button').allInnerTexts()).join('|').replace(/\s+/g, '') === 'HSK1|HSK2|HSK3|All', 'the level switch offers HSK 1, HSK 2, HSK 3 and All');
    // grammar from three levels in one list
    await pA.locator('nav button', { hasText: 'Grammar' }).click();
    await pA.waitForTimeout(150);
    check(await pA.evaluate(() => (document.querySelector('main').innerText).toLowerCase().includes('lesson 1 of ' + (window.HSK1_GRAMMAR.lessons.length + window.HSK2_GRAMMAR.lessons.length + window.HSK3_GRAMMAR.lessons.length))), 'Grammar lists the lessons of the three levels');
    check(await pA.locator('.gl .gg').count() === 15, 'Grammar is in 15 categories');
    const t0 = await pA.evaluate(() => window.HSK3_GRAMMAR.lessons[0].title);
    await pA.fill('.gl .tr-search', t0);
    await pA.waitForTimeout(100);
    check(await pA.locator('.gl .gp .lvtag.l3').count() >= 1 && await pA.locator('.gl .gp.rl3').count() >= 1, 'an HSK 3 lesson is found by its title and carries its HSK 3 tag and coloured edge (' + t0 + ')');
    await pA.fill('.gl .tr-search', '');
    // topics of the same name are joined across the three levels; HSK 3 words carry their tag
    await pA.locator('nav button', { hasText: 'Word webs' }).click();
    await pA.waitForTimeout(150);
    await pA.locator('button', { hasText: /^Show all \d+ topics$/ }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.mtile').count() === await pA.evaluate(() => new Set(window.HSK1_WEBS.topics.concat(window.HSK2_WEBS.topics, window.HSK3_WEBS.topics).map(t => t.name)).size), 'Word webs shows one mountain per topic name across the three levels');
    await pA.locator('button', { hasText: 'Shared character' }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.hubrow .pickrow .fc2').count() === await pA.evaluate(() => window.HSK1_WEBS.hubs.length + window.HSK2_WEBS.hubs.length + window.HSK3_WEBS.hubs.length), 'the shared-character picker holds the hubs of the three levels');
    // progress goes to each level's own save
    await pA.evaluate(() => {
      const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
      const t = [window.HSK1_WORDS[3].zh, window.HSK2_WORDS[3].zh, window.HSK3_WORDS[3].zh];
      t.forEach(z => { ws[z].see = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; ws[z].prod = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; });
      window.__t = t;
      app.setState({ ws, rq: [], rcomplete: false }); app.persistNow();
    });
    const saved = await pA.evaluate(() => {
      const keys = ['shanlu-progress-v1', 'shanlu-progress-v1-l2', 'shanlu-progress-v1-l3'];
      const s = keys.map(k => JSON.parse(localStorage.getItem(k) || '{}').ws || {});
      return window.__t.map((z, i) => s.map((w, j) => !!(w[z] && w[z].see && w[z].see.s === 4) === (i === j)).every(Boolean));
    });
    check(saved.every(Boolean), 'each word is saved only in its own level\'s progress (HSK 1, HSK 2 and HSK 3)');
    await pA.goto(url + '?level=3');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL === 3 && window.shanlu.state.ws[window.HSK3_WORDS[3].zh].see.s === 4), 'HSK 3 alone shows what was done in All levels');
    check(errsA.length === 0, 'no page errors in All levels (' + errsA.slice(0, 2).join(' | ') + ')');
    await cA.close();
    // the lock for All levels: HSK 1 passed only, so HSK 3 stays out of it
    const cB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cB.addInitScript(() => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); } catch (e) {} });
    const pB = await cB.newPage();
    await pB.goto(url + '?level=0');
    await pB.waitForSelector('.app');
    check(await pB.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2', 'All levels holds only the unlocked levels (HSK 1 and HSK 2) while HSK 3 is locked');
    await cB.close();
  }

  check(errors.length === 0, 'no console errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all HSK 3 checks passed');
  process.exit(failures ? 1 : 0);
})();
