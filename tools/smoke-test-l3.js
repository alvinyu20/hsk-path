/* Smoke test for HSK 3: loads the site at level 3 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, listening lab, practice scripts, AI conversation, level switch, separate progress,
 * All levels with three levels, the mock exam including the writing practice).
 * HSK 3 is open on the real site (behind the lock: it needs the HSK 2 exam passed); the first checks here look at that lock, and
 * smoke-test-l2.js checks that passing the HSK 2 exam opens HSK 3.
 * Usage: node tools/smoke-test-l3.js [--erhua]   (needs Playwright). Tests for the other levels: smoke-test.js, smoke-test-l2.js. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const erhuaMode = process.argv.includes('--erhua');
const server = require('./test-static').server(root);

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const openLv = async (p) => { if (!(await p.locator('.lvpanel').count())) await p.locator('.lvbtn').click(); await p.waitForTimeout(80); };

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
    await openLv(p0); check((await p0.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 3"))').getAttribute('class') || '').includes('locked'), 'the HSK 3 button shows a lock');
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

  const nav = require('./test-nav').makeNav(page);
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
    await page.locator('button', { hasText: /^\s*Check\s*$/ }).click();
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
  check(home.includes('Dictation drill') && (await page.locator('.tchip', { hasText: 'Speak' }).count()) === 1 && (await page.locator('.tchip', { hasText: 'Grammar lesson' }).count()) === 1, 'Today offers the listening drill, a practice script and a grammar lesson');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'], l3: !!window.shanlu.state.ws['聪明'] }));
  check(st.n === n3 && !st.l1 && !st.l2 && st.l3, 'progress holds the HSK 3 words and none of the HSK 1 or HSK 2 words');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1') && !localStorage.getItem('shanlu-progress-v1-l2')), 'HSK 1 and HSK 2 progress are not touched by opening HSK 3');
  const allText = await page.evaluate(() => JSON.stringify([window.HSK3_WORDS, window.HSK3_GRAMMAR, window.HSK3_WEBS]));
  check(erhuaMode ? /这儿|哪儿|一点儿/.test(allText) : !/这儿|哪儿|一点儿|有点儿|孩儿/.test(allText), erhuaMode ? 'in 儿 style the HSK 3 content shows the 儿 forms' : 'in plain style no 儿 ending is left in the HSK 3 content');
  check(await page.evaluate(() => { const all = JSON.stringify([window.HSK3_WORDS, window.HSK3_GRAMMAR, window.HSK3_WEBS]); return !/yǒushí jiān|měi tiān|wài guó rén/.test(all); }), 'HSK 3 pinyin keeps 有时间, 每天 and 外国人 as one word each');

  // ---- word webs
  await nav('Archive');
  await page.locator('button', { hasText: 'Shared character' }).click();
  const hubN = await page.evaluate(() => window.HSK3_WEBS.hubs.length);
  check((await page.locator('[aria-label="Shared characters"] .ctile').count()) === hubN && hubN === 36, 'HSK 3 has ' + hubN + ' shared-character groups, all listed');
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

  // ---- listening lab and practice scripts
  await nav('Listening lab');
  check((await text()).includes('Dictation') && (await text()).includes('Shadowing') && (await text()).includes('Tone trainer'), 'the HSK 3 listening lab has dictation, shadowing and the tone trainer');
  check(await page.evaluate(() => window.HSK3_LISTEN.clips.length === 24 && window.HSK3_LISTEN.clips.every(c => c.words.length >= 4 && c.notes.length >= 2)), 'there are 24 HSK 3 clips, each with words to dictate and two notes');
  await page.locator('button[aria-label="Play the clip"]').first().click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__spoken.length > 0 && window.HSK3_LISTEN.clips.some(c => window.__spoken.some(x => x.text === c.zh))), 'a dictation clip is read aloud');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button', { hasText: 'Two syllables' }).click();
  await page.locator('button[aria-label="Play a two-syllable word"]').click();
  await page.waitForTimeout(300);
  const pairL3 = await page.evaluate(() => { const last = window.__spoken[window.__spoken.length - 1]; const p = window.HSK3_LISTEN.pairs.find(x => x.zh === (last && last.text)); return p ? { zh: p.zh, t: p.t } : null; });
  check(!!pairL3, 'at HSK 3 the two-syllable trainer reads a word aloud (' + (pairL3 && pairL3.zh) + ')');
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(pairL3.t[0] - 1).click();
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(pairL3.t[1] - 1).click();
  check((await text()).includes('Right. ' + pairL3.zh), 'the HSK 3 two-syllable trainer scores a right answer');
  check(await page.evaluate(() => window.HSK3_LISTEN.pairs.length > 500 && window.HSK3_LISTEN.pairs.some(p => p.zh === '老师' && p.t[0] === 3 && p.t[1] === 1) && window.HSK3_LISTEN.pairs.some(p => p.zh === '决定' && p.t[0] === 2 && p.t[1] === 4)), 'the HSK 3 tone-pair list includes HSK 1, HSK 2 and HSK 3 two-syllable words');
  await nav('Speak');
  check((await page.locator('.modeseg').count()) === 1 && (await text()).includes('Practice script'), 'Speak has the practice-script switch at HSK 3');
  check((await text()).includes('Check in at a hotel') && (await text()).includes('Call a friend abroad') && await page.evaluate(() => window.HSK3_SPEAK.scenarios.length === 8 && window.HSK3_SPEAK.phrases.length === 8), 'the eight HSK 3 scripts and eight phrases are listed');
  await page.locator('.spk-card').first().click();
  await page.locator('button', { hasText: 'I said it' }).first().click();
  check((await text()).includes('欢迎来到我们宾馆'), 'an HSK 3 script plays: the first line of the first scenario shows after "I said it"');
  await nav('Level exam');
  const ex3 = await text();
  check(ex3.includes('HSK 3 mock exam') && ex3.includes('40 questions') && ex3.includes('30 questions') && ex3.includes('10 questions') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1 && (await page.locator('button', { hasText: 'Writing practice' }).count()) === 1,
    'the HSK 3 exam page offers the full exam (40 + 30 questions) and writing practice (10)');
  const draw3 = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    const chars = (s) => Array.from(s).sort().join('');
    for (let t = 0; t < 60; t++) ['listening', 'reading', 'writing'].forEach(sec => {
      const qs = app.examDraw(sec); const want = sec === 'listening' ? 40 : sec === 'reading' ? 30 : 10;
      if (qs.length !== want) bad.push(sec + ' has ' + qs.length);
      if (new Set(qs.map(q => q.id)).size !== want) bad.push('duplicate ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      const exp = sec === 'listening' ? { L1: 10, L2: 10, L3: 10, L4: 10 } : sec === 'reading' ? { R1: 10, R2: 10, R3: 10 } : { W1: 5, W2: 5 };
      Object.keys(exp).forEach(k => { if (parts[k] !== exp[k]) bad.push(sec + ' part ' + k + ' has ' + parts[k]); });
      qs.forEach(q => {
        if (q.kind === 'order') {
          if (chars(q.opts.map(o => o.label).join('')) !== chars(q.ans) || (q.alts || []).some(a => chars(a) !== chars(q.ans))) bad.push(q.id + ': the words do not make the answer');
          const shown = q.opts.map(o => o.label).join(''); if (shown === q.ans || (q.alts || []).indexOf(shown) >= 0) bad.push(q.id + ': words are already in a right order');
        } else if (q.kind === 'type') {
          if (q.ans.length !== 1 || !q.hint || q.text.indexOf('___') < 0) bad.push(q.id + ': a typed question needs one character, a hint and a blank');
        } else {
          if (!q.opts.some(o => o.v === q.ans)) bad.push(q.id + ': answer not among options');
          if (new Set(q.opts.map(o => o.label)).size !== q.opts.length) bad.push(q.id + ': two options look the same');
        }
      });
      ['L1', 'R1', 'R2'].forEach(p => { const g = qs.filter(q => q.part === p); for (let i = 0; i < g.length; i += 5) { if (new Set(g.slice(i, i + 5).map(q => q.right)).size !== 5) bad.push(p + ': two questions in one set share an answer'); } });
      if (sec === 'listening') { const tf = qs.filter(q => q.part === 'L2'); const yes = tf.filter(q => q.ans === 'T').length; if (yes < 4 || yes > 6) bad.push('L2 has ' + yes + ' true of 10'); if (tf.some(q => !q.text || !q.audio)) bad.push('L2 needs a sentence on screen and a passage to hear'); }
    });
    return bad.slice(0, 5);
  });
  check(draw3.length === 0, '60 random HSK 3 exams are well formed: 40 + 30 + 10 questions in the right parts, one right answer each' + (draw3.length ? ' ' + draw3.join('; ') : ''));
  const answerAll3 = async (right) => {
    const total = await page.evaluate(() => window.shanlu.state.exm.qs.length);
    for (let i = 0; i < total; i++) {
      const q = await page.evaluate(() => { const m = window.shanlu.state.exm; const q = m.qs[m.i]; return { kind: q.kind, ans: q.ans, vals: q.opts.map(o => o.v), labels: q.opts.map(o => o.label) }; });
      if (q.kind === 'type') {
        await page.locator('#ex-input').fill(right ? q.ans : '无');
      } else if (q.kind === 'order') {
        if (right) { let rest = q.ans; const used = []; while (rest) { const k = q.labels.findIndex((l, j) => used.indexOf(j) < 0 && rest.startsWith(l)); used.push(k); await page.locator('.ex-opt').nth(k).click(); rest = rest.slice(q.labels[k].length); } }
        else await page.locator('.ex-opt').first().click();
      } else {
        let target = q.vals.indexOf(q.ans);
        if (!right) target = (target + 1) % q.vals.length;
        await page.locator('.ex-opt').nth(target).click();
      }
      if (i < total - 1) await page.locator('.ex-nav button', { hasText: 'Next' }).click();
    }
  };
  // part 2 of listening: a passage to hear and a sentence to read
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Question 1 of 40') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the HSK 3 exam starts with question 1 of 40 and a timer');
  await page.evaluate(() => window.shanlu.exGo(10));
  check((await page.locator('.ex-play').count()) === 1 && (await page.locator('.ex-text').innerText()).length > 3 && (await page.locator('.ex-opt').count()) === 2, 'listening part 2 plays a passage and shows the sentence with two answers');
  await page.evaluate(() => window.shanlu.exGo(0));
  // a sitting with many wrong answers: no seal
  await answerAll3(false);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Question 1 of 30'), 'reading has 30 questions');
  await answerAll3(false);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  let rt3 = await text();
  check(rt3.includes('Your result') && !rt3.includes('seal earned') && rt3.includes('What to review'), 'an HSK 3 sitting with wrong answers earns no seal and lists what to review');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  // writing practice: a wrong sitting, then a perfect one; neither counts toward the seal
  await page.locator('button', { hasText: 'Writing practice' }).click();
  check((await text()).includes('Question 1 of 10') && (await text()).includes('Tap the words'), 'writing practice starts with question 1 of 10');
  await answerAll3(false);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt3 = await text();
  check(rt3.includes('Writing') && rt3.includes('0 of 10') && rt3.includes('Right answer') && rt3.includes('does not count toward the seal'), 'a wrong writing sitting scores 0 of 10, shows the right answers and says it does not count toward the seal');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  await page.locator('button', { hasText: 'Writing practice' }).click();
  await answerAll3(true);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt3 = await text();
  check(rt3.includes('10 of 10') && !rt3.includes('seal earned') && !rt3.includes('What to review'), 'a perfect writing sitting scores 10 of 10 and earns no seal');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[3]), 'writing practice alone does not mark HSK 3 as passed');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('Writing practice'), 'the writing sitting appears in the exam history');
  // a perfect full sitting: 100 + 100 and the seal
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  await answerAll3(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  await answerAll3(true);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  rt3 = await text();
  check(rt3.includes('200 / 200') && rt3.includes('HSK 3 seal earned'), 'a perfect HSK 3 sitting scores 200 of 200 and earns the seal');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[3]), 'the HSK 3 pass is remembered');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('200 / 200'), 'the full sitting appears in the exam history');

  // ---- Speak with AI: talk to a fake Anthropic API
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你担心考试吗？', en: 'Are you worried about the exam?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我有一点儿担心。', en: 'I am a little worried.' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.locator('button', { hasText: 'Open Settings' }).click();
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  await page.locator('.ai-tools button', { hasText: 'Type instead' }).click();   // voice only is the default and keeps Mingming's lines hidden
  const sys = calls[0].system;
  check(sys.includes('HSK 1, HSK 2 and HSK 3') && sys.includes('HSK 1 and HSK 2 words are known too'), 'the instructions name all three word lists');
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('聪明') && sys.includes('担心'), 'the instructions hold the HSK 1, HSK 2 and HSK 3 words');
  check(sys.includes('as a gentle preview') && sys.includes('HSK 4 list') && sys.includes('面试'), 'at HSK 3 the instructions allow a few HSK 4 words as a preview');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你担心考试吗？') && first.includes('Nǐ dānxīn kǎoshì ma?'), 'an HSK 3 word in the reply gets its pinyin from the HSK 3 list');
  check(!first.includes('preview') && !first.includes('no pinyin'), 'HSK 3 words are not flagged as a preview or as unknown at HSK 3');
  check((await text()).includes('Check in at a hotel') && (await text()).includes('Take the high-speed train'), 'the HSK 3 script scenarios are offered as role-play settings');

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
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 2"))').click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 2);
  await page.waitForSelector('.app');
  check((await text()).includes('197 words to go'), 'switching to HSK 2 shows the HSK 2 trail');
  check(await page.evaluate(() => !window.shanlu.state.ws['聪明'] && Object.keys(window.shanlu.state.wlearned).length === 0), 'HSK 2 progress is separate: none of the HSK 3 words started there');
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 3"))').click();
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
    check((await pA.locator('.lvbtn').innerText()).includes('All levels'), 'the All button is the selected one');
    check((await openLv(pA), (await pA.locator('.lvpanel .lvitem .lvn').allInnerTexts()).join('|').replace(/\s+/g, '') === 'HSK1|HSK2|HSK3|HSK4|Alllevels'), 'the Levels menu offers HSK 1, HSK 2, HSK 3, HSK 4 (locked until HSK 3 is passed) and All levels');
    // grammar from three levels in one list
    await require('./test-nav').makeNav(pA)('Grammar');
    await pA.waitForTimeout(150);
    check(await pA.evaluate(() => (document.querySelector('main').innerText).toLowerCase().includes('lesson 1 of ' + (window.HSK1_GRAMMAR.lessons.length + window.HSK2_GRAMMAR.lessons.length + window.HSK3_GRAMMAR.lessons.length))), 'Grammar lists the lessons of the three levels');
    check(await pA.locator('.gl .gg').count() === 15, 'Grammar is in 15 categories');
    const t0 = await pA.evaluate(() => window.HSK3_GRAMMAR.lessons[0].title);
    await pA.fill('.gl .tr-search', t0);
    await pA.waitForTimeout(100);
    check(await pA.locator('.gl .gp .lvtag.l3').count() >= 1 && await pA.locator('.gl .gp.rl3').count() >= 1, 'an HSK 3 lesson is found by its title and carries its HSK 3 tag and coloured edge (' + t0 + ')');
    await pA.fill('.gl .tr-search', '');
    // topics of the same name are joined across the three levels; HSK 3 words carry their tag
    await require('./test-nav').makeNav(pA)('Archive');
    await pA.waitForTimeout(150);
    await pA.locator('button', { hasText: /^Show all \d+ topics$/ }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.mtile').count() === await pA.evaluate(() => new Set(window.HSK1_WEBS.topics.concat(window.HSK2_WEBS.topics, window.HSK3_WEBS.topics).map(t => t.name)).size), 'Word webs shows one mountain per topic name across the three levels');
    await pA.locator('button', { hasText: 'Shared character' }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.cidx .ctile').count() === await pA.evaluate(() => window.HSK1_WEBS.hubs.length + window.HSK2_WEBS.hubs.length + window.HSK3_WEBS.hubs.length), 'the shared-character picker holds the hubs of the three levels');
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
