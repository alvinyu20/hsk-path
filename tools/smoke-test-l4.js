/* Smoke test for HSK 4: loads the site at level 4 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, listening lab, practice scripts, AI conversation, level switch, separate progress,
 * All levels with four levels, the mock exam including the writing practice).
 * HSK 4 is open on the real site (behind the lock: it needs the HSK 3 exam passed); the first checks here look at that lock, and
 * smoke-test-l3.js checks that passing the HSK 3 exam opens HSK 4.
 * Usage: node tools/smoke-test-l4.js [--erhua]   (needs Playwright). Tests for the other levels: smoke-test.js, smoke-test-l2.js, smoke-test-l3.js. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const erhuaMode = process.argv.includes('--erhua');
const server = require('./test-static').server(root, { level4: true });   // level4: opens HSK 4 even before MAX_LEVEL is raised (does nothing once it is)

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const openLv = async (p) => { if (!(await p.locator('.lvpanel').count())) await p.locator('.lvbtn').click(); await p.waitForTimeout(80); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();

  // ---- the lock: a fresh browser has not passed HSK 3, so HSK 4 stays closed
  {
    const c0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c0.addInitScript(() => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); } catch (e) {} });
    const p0 = await c0.newPage();
    await p0.goto(url + '?level=4');
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 3, 'asking for ?level=4 before passing HSK 3 gives HSK 3');
    check((await p0.locator('main').innerText()).includes('HSK 4 is locked'), 'the page explains that HSK 4 is locked');
    await openLv(p0); check((await p0.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 4"))').getAttribute('class') || '').includes('locked'), 'the HSK 4 button shows a lock');
    await c0.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript((erhua) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1, 3: 1 })); if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, erhuaMode);
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
  await page.goto(url + '?level=4');
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.SHANLU_LEVEL) === 4, 'the address ?level=4 selects HSK 4 once HSK 3 is passed');
  check(!page.url().includes('level='), 'the ?level part is removed from the address so a reload does not reapply it');
  check((await page.locator('.side').innerText()).includes('HSK 4'), 'the sidebar says HSK 4');
  check((await page.title()).includes('HSK 4'), 'the page title says HSK 4');
  const n4 = await page.evaluate(() => window.HSK4_WORDS.length);
  check(n4 === 990, 'the HSK 4 list has 990 cards (' + n4 + ')');
  const home = await text();
  check(home.includes(n4 + ' words to go'), 'the trail counts the ' + n4 + ' HSK 4 words');
  check(home.includes('Dictation drill') && (await page.locator('.tchip', { hasText: 'Speak' }).count()) === 1 && (await page.locator('.tchip', { hasText: 'Grammar lesson' }).count()) === 1, 'Today offers the listening drill, a practice script and a grammar lesson');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'], l3: !!window.shanlu.state.ws['聪明'], l4: !!window.shanlu.state.ws['面试'] }));
  check(st.n === n4 && !st.l1 && !st.l2 && !st.l3 && st.l4, 'progress holds the HSK 4 words and none of the HSK 1, HSK 2 or HSK 3 words');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1') && !localStorage.getItem('shanlu-progress-v1-l2') && !localStorage.getItem('shanlu-progress-v1-l3')), 'HSK 1, HSK 2 and HSK 3 progress are not touched by opening HSK 4');
  const allText = await page.evaluate(() => JSON.stringify([window.HSK4_WORDS, window.HSK4_GRAMMAR, window.HSK4_WEBS], (k, v) => k === 'accepts' ? undefined : v));   // typed answers still accept the 儿 form on purpose
  check(erhuaMode ? /这儿|哪儿|一点儿/.test(allText) : !/这儿|哪儿|一点儿|有点儿|孩儿|差点儿/.test(allText), erhuaMode ? 'in 儿 style the HSK 4 content shows the 儿 forms' : 'in plain style no 儿 ending is left in the HSK 4 content');
  check(await page.evaluate(() => { const all = JSON.stringify([window.HSK4_WORDS, window.HSK4_GRAMMAR, window.HSK4_WEBS]); return !/yǒushí jiān|měi tiān|wài guó rén/.test(all); }), 'HSK 4 pinyin keeps 有时间, 每天 and 外国人 as one word each');

  // ---- word webs
  await nav('Archive');
  await page.locator('button', { hasText: 'Shared character' }).click();
  const hubN = await page.evaluate(() => window.HSK4_WEBS.hubs.length);
  check((await page.locator('[aria-label="Shared characters"] .ctile').count()) === hubN && hubN === 37, 'HSK 4 has ' + hubN + ' shared-character groups, all listed');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const added = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned));
  const hub0 = await page.evaluate(() => window.HSK4_WEBS.hubs[0].hub);
  check(added.length >= 3 && added.every(z => z.includes(hub0)), 'Add all starts the new ' + hub0 + ' words (' + added.join(' ') + ')');
  await page.locator('button', { hasText: 'Word pairs' }).click();
  await page.waitForTimeout(80);
  const opp0 = await page.evaluate(() => window.HSK4_WEBS.opps.map(o => o.a + o.b));
  check(opp0.length === 35 && (await text()).includes(await page.evaluate(() => window.HSK4_WEBS.opps[0].a)), 'the word pairs screen lists the opposite pairs (' + opp0.length + ')');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.waitForTimeout(80);
  const topicInfo = await page.evaluate(() => ({ n: window.HSK4_WEBS.topics.length, words: new Set([].concat(...window.HSK4_WEBS.topics.map(t => t.words))).size, small: window.HSK4_WEBS.topics.filter(t => t.words.length < 3).length }));
  const railN = (await page.locator('.trail-rail .tr-gn').allInnerTexts()).reduce((a, t) => a + parseInt(t, 10), 0);
  check(topicInfo.n > 30 && railN === topicInfo.n, 'the topics screen lists the HSK 4 topics (' + topicInfo.n + ')');
  check(topicInfo.words === n4, 'every one of the ' + n4 + ' HSK 4 words is in a topic (' + topicInfo.words + ')');
  check(await page.evaluate(() => window.HSK4_WEBS.hubs.every(h => h.gaps.every(g => g.opts.includes(g.ans)))), 'every fill-in gap has its answer among its options');

  // ---- review and My words
  await nav('My words');
  check((await text()).includes('爱情') && (await text()).includes('990 words'), 'My words lists the 990 HSK 4 words');
  await nav('Review words');
  check((await text()).length > 50, 'the review screen opens');

  // ---- tests
  await nav('Tests');
  check((await text()).includes('HSK 4 test'), 'the test screen is titled HSK 4 test');
  await page.evaluate(() => {
    const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws));
    window.HSK4_WORDS.slice(0, 5).forEach(w => { ws[w.zh] = { see: { s: 2, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    window.shanlu.setState({ ws });
  });
  await nav('Tests');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  check(await page.evaluate(() => window.shanlu.quizQs.every(q => !q.word || !!window.HSK4_WORDS.find(w => w.zh === q.word))), 'every test question is about an HSK 4 word');
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'a test answered correctly scores full marks');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- every grammar lesson: all questions answered correctly
  await nav('Grammar');
  const lessons = await page.evaluate(() => window.HSK4_GRAMMAR.lessons.length);
  check(lessons === 27, 'the Grammar screen has 27 HSK 4 lessons (' + lessons + ')');
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
  check(allFull, 'every HSK 4 lesson scores full marks when its questions are answered correctly');
  check(await page.evaluate(() => Object.values(window.shanlu.state.gres).filter(v => v >= 80).length) === 27, 'all 27 lessons are marked done');
  await page.evaluate(() => window.shanlu.pickLesson(0));
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- listening lab and practice scripts
  await nav('Listening lab');
  check((await text()).includes('Dictation') && (await text()).includes('Shadowing') && (await text()).includes('Tone trainer'), 'the HSK 4 listening lab has dictation, shadowing and the tone trainer');
  check(await page.evaluate(() => window.HSK4_LISTEN.clips.length === 24 && window.HSK4_LISTEN.clips.every(c => c.words.length >= 4 && c.notes.length >= 2)), 'there are 24 HSK 4 clips, each with words to dictate and two notes');
  await page.locator('button[aria-label="Play the clip"]').first().click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__spoken.length > 0 && window.HSK4_LISTEN.clips.some(c => window.__spoken.some(x => x.text === c.zh))), 'a dictation clip is read aloud');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button', { hasText: 'Two syllables' }).click();
  await page.locator('button[aria-label="Play a two-syllable word"]').click();
  await page.waitForTimeout(300);
  const pairL4 = await page.evaluate(() => { const last = window.__spoken[window.__spoken.length - 1]; const p = window.HSK4_LISTEN.pairs.find(x => x.zh === (last && last.text)); return p ? { zh: p.zh, t: p.t } : null; });
  check(!!pairL4, 'at HSK 4 the two-syllable trainer reads a word aloud (' + (pairL4 && pairL4.zh) + ')');
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(pairL4.t[0] - 1).click();
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(pairL4.t[1] - 1).click();
  check((await text()).includes('Right. ' + pairL4.zh), 'the HSK 4 two-syllable trainer scores a right answer');
  check(await page.evaluate(() => window.HSK4_LISTEN.pairs.length > 1000 && window.HSK4_LISTEN.pairs.some(p => p.zh === '老师' && p.t[0] === 3 && p.t[1] === 1) && window.HSK4_LISTEN.pairs.some(p => p.zh === '决定' && p.t[0] === 2 && p.t[1] === 4) && window.HSK4_LISTEN.pairs.some(p => p.zh === '面试' && p.t[0] === 4 && p.t[1] === 4)), 'the HSK 4 tone-pair list includes HSK 1, HSK 3 and HSK 4 two-syllable words');
  await nav('Speak');
  check((await page.locator('.modeseg').count()) === 1 && (await text()).includes('Practice script'), 'Speak has the practice-script switch at HSK 4');
  check((await text()).includes('Go to a job interview') && (await text()).includes('Cheer up a friend') && await page.evaluate(() => window.HSK4_SPEAK.scenarios.length === 8 && window.HSK4_SPEAK.phrases.length === 8), 'the eight HSK 4 scripts and eight phrases are listed');
  await page.locator('.spk-card').first().click();
  await page.locator('button', { hasText: 'I said it' }).first().click();
  check((await text()).includes('请坐'), 'an HSK 4 script plays: the first line of the first scenario shows after "I said it"');
  await nav('Level exam');
  const ex4 = await text();
  check(ex4.includes('HSK 4 mock exam') && ex4.includes('45 questions') && ex4.includes('40 questions') && ex4.includes('15 questions') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1 && (await page.locator('button', { hasText: 'Writing practice' }).count()) === 1,
    'the HSK 4 exam page offers the full exam (45 + 40 questions) and writing practice (15)');
  const draw4 = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    const chars = (s) => Array.from(s).sort().join('');
    for (let t = 0; t < 60; t++) ['listening', 'reading', 'writing'].forEach(sec => {
      const qs = app.examDraw(sec); const want = sec === 'listening' ? 45 : sec === 'reading' ? 40 : 15;
      if (qs.length !== want) bad.push(sec + ' has ' + qs.length);
      if (new Set(qs.map(q => q.id)).size !== want) bad.push('duplicate ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      const exp = sec === 'listening' ? { L1: 10, L2: 15, L3: 20 } : sec === 'reading' ? { R1: 10, R2: 10, R3: 20 } : { W1: 10, W2: 5 };
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
      ['R1'].forEach(p => { const g = qs.filter(q => q.part === p); for (let i = 0; i < g.length; i += 5) { if (new Set(g.slice(i, i + 5).map(q => q.right)).size !== 5) bad.push(p + ': two questions in one set share an answer'); } });
      if (sec === 'listening') { const tf = qs.filter(q => q.part === 'L1'); const yes = tf.filter(q => q.ans === 'T').length; if (yes < 4 || yes > 6) bad.push('L1 has ' + yes + ' true of 10'); if (tf.some(q => !q.text || !q.audio)) bad.push('L1 needs a sentence on screen and a passage to hear');
        qs.filter(q => q.part !== 'L1').forEach(q => { if (q.opts.length !== 4) bad.push(q.id + ': a listening question needs four choices'); }); }
      if (sec === 'reading') qs.filter(q => q.part === 'R3').forEach(q => { if (q.opts.length !== 4) bad.push(q.id + ': a reading question needs four choices'); });
    });
    return bad.slice(0, 5);
  });
  check(draw4.length === 0, '60 random HSK 4 exams are well formed: 45 + 40 + 15 questions in the right parts, one right answer each' + (draw4.length ? ' ' + draw4.join('; ') : ''));
  const answerAll4 = async (right) => {
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
  // part 1 of listening: a passage to hear and a sentence to read
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Question 1 of 45') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the HSK 4 exam starts with question 1 of 45 and a timer');
  check((await page.locator('.ex-play').count()) === 1 && (await page.locator('.ex-text').innerText()).length > 3 && (await page.locator('.ex-opt').count()) === 2, 'listening part 1 plays a passage and shows the sentence with two answers');
  await page.evaluate(() => window.shanlu.exGo(10));
  check((await page.locator('.ex-play').count()) === 1 && (await page.locator('.ex-opt').count()) === 4, 'listening part 2 plays a conversation with four answers');
  await page.evaluate(() => window.shanlu.exGo(0));
  // a sitting with many wrong answers: no seal
  await answerAll4(false);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Question 1 of 40'), 'reading has 40 questions');
  await answerAll4(false);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  let rt4 = await text();
  check(rt4.includes('Your result') && !rt4.includes('seal earned') && rt4.includes('What to review'), 'an HSK 4 sitting with wrong answers earns no seal and lists what to review');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  // writing practice: a wrong sitting, then a perfect one; neither counts toward the seal
  await page.locator('button', { hasText: 'Writing practice' }).click();
  check((await text()).includes('Question 1 of 15') && (await text()).includes('Tap the words'), 'writing practice starts with question 1 of 15');
  await answerAll4(false);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt4 = await text();
  check(rt4.includes('Writing') && rt4.includes('0 of 15') && rt4.includes('Right answer') && rt4.includes('does not count toward the seal'), 'a wrong writing sitting scores 0 of 10, shows the right answers and says it does not count toward the seal');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  await page.locator('button', { hasText: 'Writing practice' }).click();
  await answerAll4(true);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt4 = await text();
  check(rt4.includes('15 of 15') && !rt4.includes('seal earned') && !rt4.includes('What to review'), 'a perfect writing sitting scores 15 of 15 and earns no seal');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[4]), 'writing practice alone does not mark HSK 4 as passed');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('Writing practice'), 'the writing sitting appears in the exam history');
  // a perfect full sitting: 100 + 100 and the seal
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  await answerAll4(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  await answerAll4(true);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  rt4 = await text();
  check(rt4.includes('200 / 200') && rt4.includes('HSK 4 seal earned'), 'a perfect HSK 4 sitting scores 200 of 200 and earns the seal');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[4]), 'the HSK 4 pass is remembered');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('200 / 200'), 'the full sitting appears in the exam history');

  // ---- Speak with AI: talk to a fake Anthropic API
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你想去面试吗？', en: 'Do you want to go to the interview?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我想去面试。', en: 'I want to go to the interview.' } };
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
  check(sys.includes('HSK 1, HSK 2, HSK 3 and HSK 4') && sys.includes('HSK 1, HSK 2 and HSK 3 words are known too'), 'the instructions name all four word lists');
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('聪明') && sys.includes('面试'), 'the instructions hold the HSK 1, HSK 2, HSK 3 and HSK 4 words');
  check(!sys.includes('as a gentle preview'), 'there is no next level to preview, so the instructions do not offer one');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你想去面试吗？') && first.includes('Nǐ xiǎng qù miànshì ma?'), 'an HSK 4 word in the reply gets its pinyin from the HSK 4 list');
  check(!first.includes('preview') && !first.includes('no pinyin'), 'HSK 4 words are not flagged as a preview or as unknown at HSK 4');
  check((await text()).includes('Go to a job interview') && (await text()).includes('Send a parcel'), 'the HSK 4 script scenarios are offered as role-play settings');

  // ---- settings: level card, export names the level
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('You are studying HSK 4'), 'Settings has a Level card that says HSK 4');
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).first().click();
  const d = await dl;
  check(/hsk4/.test(d.suggestedFilename()), 'the exported file name says hsk4 (' + d.suggestedFilename() + ')');
  const exported = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  check(exported.level === 4 && Object.keys(exported.data.ws).length === n4, 'the exported file is marked as level 4 and holds ' + n4 + ' words');
  await page.evaluate(() => window.shanlu.importText(JSON.stringify({ app: 'shanlu', version: 1, level: 3, data: { ws: {} } })));
  check(dialogs.some(m => /HSK 3 progress, but this page is on HSK 4/.test(m)), 'importing an HSK 3 file at HSK 4 is refused with an explanation');

  // ---- switching level keeps every progress
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 3"))').click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 3);
  await page.waitForSelector('.app');
  check((await text()).includes('491 words to go'), 'switching to HSK 3 shows the HSK 3 trail');
  check(await page.evaluate(() => !window.shanlu.state.ws['面试'] && Object.keys(window.shanlu.state.wlearned).length === 0), 'HSK 3 progress is separate: none of the HSK 4 words started there');
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 4"))').click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 4);
  await page.waitForSelector('.app');
  check(await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length >= 3 && window.shanlu.state.gres[window.HSK4_GRAMMAR.lessons[0].id] >= 80), 'switching back to HSK 4 brings its progress back (web words, lesson results)');

  // ---- All levels: four levels together, progress still saved per level
  {
    const cA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cA.addInitScript((erhua) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1, 3: 1 })); if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, erhuaMode);
    const pA = await cA.newPage();
    const errsA = []; pA.on('pageerror', e => errsA.push(String(e)));
    await pA.goto(url + '?level=0');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL) === 0 && await pA.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2,3,4', 'the address ?level=0 shows All levels with all four levels once HSK 4 is unlocked');
    check(await pA.evaluate(() => Object.keys(window.shanlu.state.ws).length === window.HSK1_WORDS.length + window.HSK2_WORDS.length + window.HSK3_WORDS.length + window.HSK4_WORDS.length), 'All levels holds the words of the four levels');
    check((await pA.locator('.lvbtn').innerText()).includes('All levels'), 'the All button is the selected one');
    check((await openLv(pA), (await pA.locator('.lvpanel .lvitem .lvn').allInnerTexts()).join('|').replace(/\s+/g, '') === 'HSK1|HSK2|HSK3|HSK4|Alllevels'), 'the Levels menu offers HSK 1, HSK 2, HSK 3, HSK 4 and All levels');
    // grammar from four levels in one list
    await require('./test-nav').makeNav(pA)('Grammar');
    await pA.waitForTimeout(150);
    check(await pA.evaluate(() => (document.querySelector('main').innerText).toLowerCase().includes('lesson 1 of ' + (window.HSK1_GRAMMAR.lessons.length + window.HSK2_GRAMMAR.lessons.length + window.HSK3_GRAMMAR.lessons.length + window.HSK4_GRAMMAR.lessons.length))), 'Grammar lists the lessons of the four levels');
    check(await pA.locator('.gl .gg').count() === 16, 'Grammar is in 16 categories (the 15 of HSK 1 to 3 and HSK 4\'s "Even, although and no matter")');
    const t0 = await pA.evaluate(() => window.HSK4_GRAMMAR.lessons[0].title);
    await pA.fill('.gl .tr-search', t0);
    await pA.waitForTimeout(100);
    check(await pA.locator('.gl .gp .lvtag.l4').count() >= 1 && await pA.locator('.gl .gp.rl4').count() >= 1, 'an HSK 4 lesson is found by its title and carries its HSK 4 tag and coloured edge (' + t0 + ')');
    await pA.fill('.gl .tr-search', '');
    // topics of the same name are joined across the four levels; HSK 4 words carry their tag
    await require('./test-nav').makeNav(pA)('Archive');
    await pA.waitForTimeout(150);
    await pA.locator('button', { hasText: /^Show all \d+ topics$/ }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.mtile').count() === await pA.evaluate(() => new Set(window.HSK1_WEBS.topics.concat(window.HSK2_WEBS.topics, window.HSK3_WEBS.topics, window.HSK4_WEBS.topics).map(t => t.name)).size), 'Word webs shows one mountain per topic name across the four levels');
    await pA.locator('button', { hasText: 'Shared character' }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.cidx .ctile').count() === await pA.evaluate(() => window.HSK1_WEBS.hubs.length + window.HSK2_WEBS.hubs.length + window.HSK3_WEBS.hubs.length + window.HSK4_WEBS.hubs.length), 'the shared-character picker holds the hubs of the four levels');
    // progress goes to each level's own save
    await pA.evaluate(() => {
      const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
      const t = [window.HSK1_WORDS[3].zh, window.HSK2_WORDS[3].zh, window.HSK3_WORDS[3].zh, window.HSK4_WORDS[3].zh];
      t.forEach(z => { ws[z].see = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; ws[z].prod = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; });
      window.__t = t;
      app.setState({ ws, rq: [], rcomplete: false }); app.persistNow();
    });
    const saved = await pA.evaluate(() => {
      const keys = ['shanlu-progress-v1', 'shanlu-progress-v1-l2', 'shanlu-progress-v1-l3', 'shanlu-progress-v1-l4'];
      const s = keys.map(k => JSON.parse(localStorage.getItem(k) || '{}').ws || {});
      return window.__t.map((z, i) => s.map((w, j) => !!(w[z] && w[z].see && w[z].see.s === 4) === (i === j)).every(Boolean));
    });
    check(saved.every(Boolean), 'each word is saved only in its own level\'s progress (HSK 1, HSK 2, HSK 3 and HSK 4)');
    await pA.goto(url + '?level=4');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL === 4 && window.shanlu.state.ws[window.HSK4_WORDS[3].zh].see.s === 4), 'HSK 4 alone shows what was done in All levels');
    check(errsA.length === 0, 'no page errors in All levels (' + errsA.slice(0, 2).join(' | ') + ')');
    await cA.close();
    // the lock for All levels: HSK 1 and HSK 2 passed only, so HSK 4 stays out of it
    const cB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cB.addInitScript(() => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); } catch (e) {} });
    const pB = await cB.newPage();
    await pB.goto(url + '?level=0');
    await pB.waitForSelector('.app');
    check(await pB.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2,3', 'All levels holds only the unlocked levels (HSK 1, HSK 2 and HSK 3) while HSK 4 is locked');
    await cB.close();
  }

  check(errors.length === 0, 'no console errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all HSK 4 checks passed');
  process.exit(failures ? 1 : 0);
})();
