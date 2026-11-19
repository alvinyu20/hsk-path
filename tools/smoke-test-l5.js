/* Smoke test for HSK 5: loads the site at level 5 in headless Chromium and checks the parts that exist at this level
 * (words, word webs, every grammar lesson, tests, listening lab, practice scripts, AI conversation, level switch, separate progress,
 * All levels with five levels, the mock exam including the writing practice, and the 5,000-coin level reward).
 * HSK 5 is behind the lock (it needs the HSK 4 exam passed); the first checks here look at that lock, and smoke-test-l4.js checks that
 * passing the HSK 4 exam opens HSK 5.
 * Usage: node tools/smoke-test-l5.js [--erhua]   (needs Playwright). Tests for the other levels: smoke-test.js, smoke-test-l2.js, smoke-test-l3.js, smoke-test-l4.js. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const erhuaMode = process.argv.includes('--erhua');
const server = require('./test-static').server(root, { level5: true });   // level5: opens HSK 5 even before MAX_LEVEL is raised (does nothing once it is)

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const openLv = async (p) => { if (!(await p.locator('.lvpanel').count())) await p.locator('.lvbtn').click(); await p.waitForTimeout(80); };
// what a browser has before the page loads: which levels were passed (only if nothing is saved yet) and the 儿 setting
const startState = (o) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify(o.passed)); if (o.erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();

  // ---- the lock: a fresh browser has passed HSK 1 to 3 only, so HSK 5 stays closed (HSK 4 is open)
  {
    const c0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c0.addInitScript(startState, { passed: { 1: 1, 2: 1, 3: 1 }, erhua: false });
    const p0 = await c0.newPage();
    await p0.goto(url + '?level=5');
    await p0.waitForSelector('.app');
    check(await p0.evaluate(() => window.SHANLU_LEVEL) === 4, 'asking for ?level=5 before passing HSK 4 gives HSK 4');
    check((await p0.locator('main').innerText()).includes('HSK 5 is locked'), 'the page explains that HSK 5 is locked');
    await openLv(p0); check((await p0.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 5"))').getAttribute('class') || '').includes('locked'), 'the HSK 5 button shows a lock');
    await c0.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(startState, { passed: { 1: 1, 2: 1, 3: 1, 4: 1 }, erhua: erhuaMode });
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

  // ---- load at level 5
  await page.goto(url + '?level=5');
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.SHANLU_LEVEL) === 5, 'the address ?level=5 selects HSK 5 once HSK 4 is passed');
  check(!page.url().includes('level='), 'the ?level part is removed from the address so a reload does not reapply it');
  check((await page.locator('.side').innerText()).includes('HSK 5'), 'the sidebar says HSK 5');
  check((await page.title()).includes('HSK 5'), 'the page title says HSK 5');
  const n5 = await page.evaluate(() => window.HSK5_WORDS.length);
  check(n5 === 1579, 'the HSK 5 list has 1,579 cards (' + n5 + ')');
  const home = await text();
  check(home.includes(n5.toLocaleString('en-US') + ' words to go') || home.includes(n5 + ' words to go'), 'the trail counts the ' + n5 + ' HSK 5 words');
  check(home.includes('Dictation drill') && (await page.locator('.tchip', { hasText: 'Speak' }).count()) === 1 && (await page.locator('.tchip', { hasText: 'Grammar lesson' }).count()) === 1, 'Today offers the listening drill, a practice script and a grammar lesson');
  const st = await page.evaluate(() => ({ n: Object.keys(window.shanlu.state.ws).length, l1: !!window.shanlu.state.ws['你好'], l2: !!window.shanlu.state.ws['机场'], l3: !!window.shanlu.state.ws['聪明'], l4: !!window.shanlu.state.ws['面试'], l5: !!window.shanlu.state.ws['成就'] }));
  check(st.n === n5 && !st.l1 && !st.l2 && !st.l3 && !st.l4 && st.l5, 'progress holds the HSK 5 words and none of the HSK 1 to 4 words');
  check(await page.evaluate(() => !localStorage.getItem('shanlu-progress-v1') && !localStorage.getItem('shanlu-progress-v1-l2') && !localStorage.getItem('shanlu-progress-v1-l3') && !localStorage.getItem('shanlu-progress-v1-l4')), 'HSK 1 to 4 progress are not touched by opening HSK 5');
  const allText = await page.evaluate(() => JSON.stringify([window.HSK5_WORDS, window.HSK5_GRAMMAR, window.HSK5_WEBS], (k, v) => k === 'accepts' ? undefined : v));   // typed answers still accept the 儿 form on purpose
  check(erhuaMode ? /这儿|哪儿|一点儿|没法儿/.test(allText) : !/这儿|哪儿|一点儿|有点儿|孩儿|差点儿|没法儿/.test(allText), erhuaMode ? 'in 儿 style the HSK 5 content shows the 儿 forms' : 'in plain style no 儿 ending is left in the HSK 5 content');
  check(await page.evaluate(() => { const all = JSON.stringify([window.HSK5_WORDS, window.HSK5_GRAMMAR, window.HSK5_WEBS]); return !/yǒushí jiān|měi tiān|wài guó rén/.test(all); }), 'HSK 5 pinyin keeps 有时间, 每天 and 外国人 as one word each');

  // ---- word webs
  await nav('Archive');
  await page.locator('button', { hasText: 'Shared character' }).click();
  const hubN = await page.evaluate(() => window.HSK5_WEBS.hubs.length);
  check((await page.locator('[aria-label="Shared characters"] .ctile').count()) === hubN && hubN === 40, 'HSK 5 has ' + hubN + ' shared-character groups, all listed');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const added = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned));
  const hub0 = await page.evaluate(() => window.HSK5_WEBS.hubs[0].hub);
  check(added.length >= 3 && added.every(z => z.includes(hub0)), 'Add all starts the new ' + hub0 + ' words (' + added.join(' ') + ')');
  await page.locator('button', { hasText: 'Word pairs' }).click();
  await page.waitForTimeout(80);
  const opp0 = await page.evaluate(() => window.HSK5_WEBS.opps.map(o => o.a + o.b));
  check(opp0.length === 36 && (await text()).includes(await page.evaluate(() => window.HSK5_WEBS.opps[0].a)), 'the word pairs screen lists the opposite pairs (' + opp0.length + ')');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.waitForTimeout(80);
  const topicInfo = await page.evaluate(() => ({ n: window.HSK5_WEBS.topics.length, words: new Set([].concat(...window.HSK5_WEBS.topics.map(t => t.words))).size, small: window.HSK5_WEBS.topics.filter(t => t.words.length < 3).length }));
  const railN = (await page.locator('.trail-rail .tr-gn').allInnerTexts()).reduce((a, t) => a + parseInt(t, 10), 0);
  check(topicInfo.n === 136 && railN === topicInfo.n, 'the topics screen lists the HSK 5 topics (' + topicInfo.n + ')');
  check(topicInfo.words === n5, 'every one of the ' + n5 + ' HSK 5 words is in a topic (' + topicInfo.words + ')');
  check(await page.evaluate(() => window.HSK5_WEBS.hubs.every(h => h.gaps.every(g => g.opts.includes(g.ans)))), 'every fill-in gap has its answer among its options');

  // ---- review and My words
  await nav('My words');
  check((await text()).includes('哎呀') && /1,?579 words/.test(await text()), 'My words lists the 1,579 HSK 5 words');
  await nav('Review words');
  check((await text()).length > 50, 'the review screen opens');

  // ---- tests
  await nav('Tests');
  check((await text()).includes('HSK 5 test'), 'the test screen is titled HSK 5 test');
  await page.evaluate(() => {
    const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws));
    window.HSK5_WORDS.slice(0, 5).forEach(w => { ws[w.zh] = { see: { s: 2, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    window.shanlu.setState({ ws });
  });
  await nav('Tests');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  check(await page.evaluate(() => window.shanlu.quizQs.every(q => !q.word || !!window.HSK5_WORDS.find(w => w.zh === q.word))), 'every test question is about an HSK 5 word');
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'a test answered correctly scores full marks');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- every grammar lesson: all questions answered correctly
  await nav('Grammar');
  const lessons = await page.evaluate(() => window.HSK5_GRAMMAR.lessons.length);
  check(lessons === 32, 'the Grammar screen has 32 HSK 5 lessons (' + lessons + ')');
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
  check(allFull, 'every HSK 5 lesson scores full marks when its questions are answered correctly');
  check(await page.evaluate(() => Object.values(window.shanlu.state.gres).filter(v => v >= 80).length) === 32, 'all 32 lessons are marked done');
  await page.evaluate(() => window.shanlu.pickLesson(0));
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});

  // ---- listening lab and practice scripts
  await nav('Listening lab');
  check((await text()).includes('Dictation') && (await text()).includes('Shadowing') && (await text()).includes('Tone trainer'), 'the HSK 5 listening lab has dictation, shadowing and the tone trainer');
  check(await page.evaluate(() => window.HSK5_LISTEN.clips.length === 48 && window.HSK5_LISTEN.clips.every(c => c.words.length >= 4 && c.notes.length >= 2)), 'there are 48 HSK 5 clips, each with words to dictate and two notes');
  await page.locator('button[aria-label="Play the clip"]').first().click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__spoken.length > 0 && window.HSK5_LISTEN.clips.some(c => window.__spoken.some(x => x.text === c.zh))), 'a dictation clip is read aloud');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button', { hasText: 'Two syllables' }).click();
  await page.locator('button[aria-label="Play a two-syllable word"]').click();
  await page.waitForTimeout(300);
  const pairL5 = await page.evaluate(() => { const last = window.__spoken[window.__spoken.length - 1]; const p = window.HSK5_LISTEN.pairs.find(x => x.zh === (last && last.text)); return p ? { zh: p.zh, t: p.t } : null; });
  check(!!pairL5, 'at HSK 5 the two-syllable trainer reads a word aloud (' + (pairL5 && pairL5.zh) + ')');
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(pairL5.t[0] - 1).click();
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(pairL5.t[1] - 1).click();
  check((await text()).includes('Right. ' + pairL5.zh), 'the HSK 5 two-syllable trainer scores a right answer');
  check(await page.evaluate(() => window.HSK5_LISTEN.pairs.length > 2000 && window.HSK5_LISTEN.pairs.some(p => p.zh === '老师' && p.t[0] === 3 && p.t[1] === 1) && window.HSK5_LISTEN.pairs.some(p => p.zh === '决定' && p.t[0] === 2 && p.t[1] === 4) && window.HSK5_LISTEN.pairs.some(p => p.zh === '成就' && p.t[0] === 2 && p.t[1] === 4)), 'the HSK 5 tone-pair list includes HSK 1, HSK 4 and HSK 5 two-syllable words');
  await nav('Speak');
  check((await page.locator('.modeseg').count()) === 1 && (await text()).includes('Practice script'), 'Speak has the practice-script switch at HSK 5');
  check((await text()).includes('Return a faulty product') && (await text()).includes('Sign a work contract') && await page.evaluate(() => window.HSK5_SPEAK.scenarios.length === 8 && window.HSK5_SPEAK.phrases.length === 8), 'the eight HSK 5 scripts and eight phrases are listed');
  await page.locator('.spk-card').first().click();
  await page.locator('button', { hasText: 'I said it' }).first().click();
  check((await text()).includes('我可以帮你做什么'), 'an HSK 5 script plays: the first line of the first scenario shows after "I said it"');

  // ---- the level exam
  await nav('Level exam');
  const ex5 = await text();
  check(ex5.includes('HSK 5 mock exam') && ex5.includes('45 questions') && ex5.includes('15 questions') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1 && (await page.locator('button', { hasText: 'Writing practice' }).count()) === 1,
    'the HSK 5 exam page offers the full exam (45 + 45 questions) and writing practice (15)');
  const draw5 = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    const chars = (s) => Array.from(s).sort().join('');
    for (let t = 0; t < 60; t++) ['listening', 'reading', 'writing'].forEach(sec => {
      const qs = app.examDraw(sec); const want = sec === 'writing' ? 15 : 45;
      if (qs.length !== want) bad.push(sec + ' has ' + qs.length);
      if (new Set(qs.map(q => q.id)).size !== want) bad.push('duplicate ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      const exp = sec === 'listening' ? { L1: 20, L2: 25 } : sec === 'reading' ? { R1: 15, R2: 10, R3: 20 } : { W1: 10, W2: 5 };
      Object.keys(exp).forEach(k => { if (parts[k] !== exp[k]) bad.push(sec + ' part ' + k + ' has ' + parts[k]); });
      qs.forEach(q => {
        if (q.kind === 'order') {
          if (chars(q.opts.map(o => o.label).join('')) !== chars(q.ans) || (q.alts || []).some(a => chars(a) !== chars(q.ans))) bad.push(q.id + ': the words do not make the answer');
          const shown = q.opts.map(o => o.label).join(''); if (shown === q.ans || (q.alts || []).indexOf(shown) >= 0) bad.push(q.id + ': words are already in a right order');
        } else if (q.kind === 'type') {
          if (q.ans.length !== 1 || !q.hint || q.text.indexOf('___') < 0) bad.push(q.id + ': a typed question needs one character, a hint and a blank');
        } else {
          if (!q.opts.some(o => o.v === q.ans)) bad.push(q.id + ': answer not among options');
          if (q.opts.length !== 4) bad.push(q.id + ': every HSK 5 question needs four choices');
          if (new Set(q.opts.map(o => o.label)).size !== q.opts.length) bad.push(q.id + ': two options look the same');
          if (!q.text && !q.audio) bad.push(q.id + ': nothing to read or hear');
        }
      });
      if (sec === 'listening') qs.forEach(q => { if (!q.audio || !q.audio.length) bad.push(q.id + ': a listening question needs audio'); });
      if (sec === 'reading') {
        // the cloze: three passages, five questions each, in order; each shows its own numbered blank and the others as plain numbers
        const r1 = qs.filter(q => q.part === 'R1');
        for (let i = 0; i < r1.length; i += 5) {
          const set = r1.slice(i, i + 5);
          set.forEach((q, k) => { if (q.text.indexOf('【' + (k + 1) + '】') < 0 || q.text.indexOf('___') >= 0 || (q.text.match(/【/g) || []).length !== 2) bad.push(q.id + ': blank ' + (k + 1) + ' is not marked right'); });
          if (new Set(set.map(q => q.text.split('\n')[0].replace(/[（【]\d[）】]/g, ''))).size !== 1) bad.push('R1 set ' + (i / 5) + ' mixes passages');
        }
        if (new Set(r1.filter((q, i) => i % 5 === 0).map(q => q.text.split('\n')[0].replace(/[（【]\d[）】]/g, ''))).size !== 3) bad.push('R1 repeats a passage');
      }
    });
    return bad.slice(0, 5);
  });
  check(draw5.length === 0, '60 random HSK 5 exams are well formed: 45 + 45 + 15 questions in the right parts, one right answer each' + (draw5.length ? ' ' + draw5.join('; ') : ''));
  const answerAll = async (right) => {
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
  const fullSitting = async (right) => {
    await page.locator('button', { hasText: 'Start the full exam' }).click();
    await answerAll(right);
    await page.locator('button', { hasText: 'Submit listening' }).click();
    await page.locator('button', { hasText: 'Start Reading' }).click();
    await answerAll(right);
    await page.locator('button', { hasText: 'Submit reading' }).click();
    await page.waitForTimeout(100);
    return text();
  };
  const xpNow = () => page.evaluate(() => window.shanlu.state.xp);
  const receipt = () => page.evaluate(() => { try { const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}'); return (p.prefs && p.prefs['lvlpass.5'] && p.prefs['lvlpass.5'].v) || 0; } catch (e) { return -1; } });
  // part 1 of listening: a short conversation and a question, four answers
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Question 1 of 45') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the HSK 5 exam starts with question 1 of 45 and a timer');
  check((await page.locator('.ex-play').count()) === 1 && (await page.locator('.ex-opt').count()) === 4, 'listening part 1 plays a short conversation with four answers');
  await page.evaluate(() => window.shanlu.exGo(20));
  check((await page.locator('.ex-play').count()) === 1 && (await page.locator('.ex-opt').count()) === 4 && (await text()).includes('Part 2'), 'listening part 2 plays a longer conversation with four answers');
  await page.evaluate(() => window.shanlu.exGo(0));
  // a sitting with many wrong answers: no seal, no bonus
  const xp0 = await xpNow();
  await answerAll(false);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Question 1 of 45'), 'reading has 45 questions');
  check((await text()).includes('【1】') && (await text()).includes('Choose the word for blank 【1】'), 'reading starts with a passage whose first numbered blank is marked');
  await answerAll(false);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  let rt5 = await text();
  check(rt5.includes('Your result') && !rt5.includes('seal earned') && rt5.includes('What to review'), 'an HSK 5 sitting with wrong answers earns no seal and lists what to review');
  check(!rt5.includes('coins for passing') && (await xpNow()) - xp0 < 500 && (await receipt()) === 0, 'a failed sitting pays no level bonus');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  // writing practice: a wrong sitting, then a perfect one; neither counts toward the seal or the bonus
  await page.locator('button', { hasText: 'Writing practice' }).click();
  check((await text()).includes('Question 1 of 15') && (await text()).includes('Tap the words'), 'writing practice starts with question 1 of 15');
  await answerAll(false);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt5 = await text();
  check(rt5.includes('Writing') && rt5.includes('0 of 15') && rt5.includes('Right answer') && rt5.includes('does not count toward the seal'), 'a wrong writing sitting scores 0 of 15, shows the right answers and says it does not count toward the seal');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  await page.locator('button', { hasText: 'Writing practice' }).click();
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit writing' }).click();
  await page.waitForTimeout(100);
  rt5 = await text();
  check(rt5.includes('15 of 15') && !rt5.includes('seal earned') && !rt5.includes('What to review'), 'a perfect writing sitting scores 15 of 15 and earns no seal');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[5]) && (await receipt()) === 0 && !(await text()).includes('coins for passing'), 'writing practice alone does not mark HSK 5 as passed and pays no bonus');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('Writing practice'), 'the writing sitting appears in the exam history');

  // ---- the first pass: 100 + 100, the seal, and 5,000 coins
  const xpBefore = await xpNow();
  rt5 = await fullSitting(true);
  check(rt5.includes('200 / 200') && rt5.includes('HSK 5 seal earned'), 'a perfect HSK 5 sitting scores 200 of 200 and earns the seal');
  check(rt5.includes('+5,000 coins for passing HSK 5') && rt5.includes('paid once for each level'), 'the result says the level bonus of 5,000 coins was paid');
  const xpPaid = await xpNow();
  check(xpPaid - xpBefore >= 5000 && xpPaid - xpBefore < 5500, 'the coins went up by 5,000 plus the exam\'s own few coins (' + (xpPaid - xpBefore) + ')');
  check(!rt5.includes('HSK 6 is now open'), 'there is no HSK 6 to open, so the result does not offer one');
  await page.waitForTimeout(300);
  const paidAt = await receipt();
  check(paidAt > 0, 'the payment is remembered as a receipt in the person\'s own saved settings (travels with sync)');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[5]), 'the HSK 5 pass is remembered');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('200 / 200'), 'the full sitting appears in the exam history');

  // ---- the second pass pays nothing
  const xpBefore2 = await xpNow();
  rt5 = await fullSitting(true);
  check(rt5.includes('HSK 5 seal earned') && !rt5.includes('coins for passing'), 'passing again earns the seal text but no second bonus');
  check((await xpNow()) - xpBefore2 < 500 && (await receipt()) === paidAt, 'the coins only went up by the exam\'s own few coins, and the receipt did not change (' + ((await xpNow()) - xpBefore2) + ')');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

  // ---- the rule itself, in one place (level.js)
  const rule = await page.evaluate(() => {
    const L = window.ShanluLevel; const ok = { l: 40, r: 40, lt: 45, rt: 45, mode: 'full' }; const low = { l: 35, r: 40, lt: 45, rt: 45, mode: 'full' };
    const onlyL = { l: 45, r: null, lt: 45, rt: null, mode: 'listening' }, onlyR = { l: null, r: 45, lt: null, rt: 45, mode: 'reading' };
    return { first: L.passBonus(5, [ok], 0), paid: L.passBonus(5, [ok], 1700000000000), lowScore: L.passBonus(5, [low], 0), none: L.passBonus(5, [], 0), apart: L.passBonus(5, [onlyL, onlyR], 0), half: L.passBonus(5, [onlyL], 0),
      lv1: L.passBonus(1, [ok], 0), lv0: L.passBonus(0, [ok], 0), beyond: L.passBonus(L.MAX_LEVEL + 1, [ok], 0), coins: L.PASS_COINS, max: L.MAX_LEVEL };
  });
  check(rule.first === 5000 && rule.coins === 5000, 'the rule: 5,000 coins the first time a level is passed (' + rule.first + ')');
  check(rule.paid === 0, 'the rule: nothing when that level was paid before');
  check(rule.lowScore === 0 && rule.none === 0 && rule.half === 0, 'the rule: nothing below 80% in a section, with no sitting, or with one section only');
  check(rule.apart === 5000, 'the rule: listening and reading passed in two separate sittings count as one pass');
  check(rule.lv1 === 5000 && rule.lv0 === 0 && rule.beyond === 0 && rule.max === 5, 'the rule: every real level pays, level 0 (All levels) and levels that do not exist pay nothing');

  // ---- a reset does not bring the bonus back
  await page.evaluate(() => { window.shanlu.persistNow(); });
  await page.evaluate(() => window.shanlu.resetAll());
  await page.waitForFunction(() => window.shanlu && window.shanlu.state && window.shanlu.state.exams && window.shanlu.state.exams.length === 0);
  await page.waitForSelector('.app');
  check((await receipt()) === paidAt, 'after a reset of the HSK 5 progress the payment receipt is still there');
  check((await xpNow()) === 0 && await page.evaluate(() => Object.keys(window.shanlu.state.ws).length) === n5, 'the reset cleared the coins and the progress of HSK 5');
  await nav('Level exam');
  rt5 = await fullSitting(true);
  check(rt5.includes('HSK 5 seal earned') && !rt5.includes('coins for passing') && (await xpNow()) < 500, 'passing again after a reset earns no second level bonus (' + (await xpNow()) + ' coins)');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

  // ---- Speak with AI: talk to a fake Anthropic API
  const calls = [];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const reply = { reply: { zh: '你有什么意见吗？', en: 'Do you have any views?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我同意你的意见。', en: 'I agree with your view.' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.locator('button', { hasText: 'Set up Mingming in Settings' }).click();
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  await page.locator('.ai-tools button', { hasText: 'Type instead' }).click();   // voice only is the default and keeps Mingming's lines hidden
  const sys = calls[0].system;
  check(sys.includes('HSK 1, HSK 2, HSK 3, HSK 4 and HSK 5') && sys.includes('HSK 1, HSK 2, HSK 3 and HSK 4 words are known too'), 'the instructions name all five word lists');
  check(sys.includes('机场') && sys.includes('米饭') && sys.includes('聪明') && sys.includes('面试') && sys.includes('成就'), 'the instructions hold the HSK 1 to HSK 5 words');
  check(!sys.includes('as a gentle preview'), 'there is no next level to preview, so the instructions do not offer one');
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你有什么意见吗？') && first.includes('Nǐ yǒu shénme yìjiàn ma?'), 'an HSK 5 word in the reply gets its pinyin from the HSK 5 list');
  check(!first.includes('preview') && !first.includes('no pinyin'), 'HSK 5 words are not flagged as a preview or as unknown at HSK 5');
  check((await text()).includes('Return a faulty product') && (await text()).includes('Sign a work contract'), 'the HSK 5 script scenarios are offered as role-play settings');

  // ---- settings: level card, export names the level
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.evaluate(() => window.shanlu.setSec('level'));   // open the Level row
  check((await text()).includes('You are studying HSK 5'), 'Settings has a Level card that says HSK 5');
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).first().click();
  const d = await dl;
  check(/hsk5/.test(d.suggestedFilename()), 'the exported file name says hsk5 (' + d.suggestedFilename() + ')');
  const exported = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  check(exported.level === 5 && Object.keys(exported.data.ws).length === n5, 'the exported file is marked as level 5 and holds ' + n5 + ' words');
  await page.evaluate(() => window.shanlu.importText(JSON.stringify({ app: 'shanlu', version: 1, level: 4, data: { ws: {} } })));
  check(dialogs.some(m => /HSK 4 progress, but this page is on HSK 5/.test(m)), 'importing an HSK 4 file at HSK 5 is refused with an explanation');

  // ---- switching level keeps every progress
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 4"))').click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 4);
  await page.waitForSelector('.app');
  check((await text()).includes('990 words to go'), 'switching to HSK 4 shows the HSK 4 trail');
  check(await page.evaluate(() => !window.shanlu.state.ws['成就'] && Object.keys(window.shanlu.state.wlearned).length === 0), 'HSK 4 progress is separate: none of the HSK 5 words started there');
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 5"))').click();
  await page.waitForFunction(() => window.SHANLU_LEVEL === 5);
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.shanlu.state.exams.length >= 1 && window.shanlu.state.xp > 0 && !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[5]), 'switching back to HSK 5 brings its progress back (the exam sitting, the coins, the pass)');

  // ---- All levels: five levels together, progress still saved per level
  {
    const cA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cA.addInitScript(startState, { passed: { 1: 1, 2: 1, 3: 1, 4: 1 }, erhua: erhuaMode });
    const pA = await cA.newPage();
    const errsA = []; pA.on('pageerror', e => errsA.push(String(e)));
    await pA.goto(url + '?level=0');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL) === 0 && await pA.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2,3,4,5', 'the address ?level=0 shows All levels with all five levels once HSK 5 is unlocked');
    check(await pA.evaluate(() => Object.keys(window.shanlu.state.ws).length === window.HSK1_WORDS.length + window.HSK2_WORDS.length + window.HSK3_WORDS.length + window.HSK4_WORDS.length + window.HSK5_WORDS.length), 'All levels holds the words of the five levels');
    check((await pA.locator('.lvbtn').innerText()).includes('All levels'), 'the All button is the selected one');
    check((await openLv(pA), (await pA.locator('.lvpanel .lvitem .lvn').allInnerTexts()).join('|').replace(/\s+/g, '') === 'HSK1|HSK2|HSK3|HSK4|HSK5|Alllevels'), 'the Levels menu offers HSK 1, HSK 2, HSK 3, HSK 4, HSK 5 and All levels');
    // grammar from five levels in one list
    await require('./test-nav').makeNav(pA)('Grammar');
    await pA.waitForTimeout(150);
    check(await pA.evaluate(() => (document.querySelector('main').innerText).toLowerCase().includes('lesson 1 of ' + [1, 2, 3, 4, 5].reduce((n, k) => n + window['HSK' + k + '_GRAMMAR'].lessons.length, 0))), 'Grammar lists the lessons of the five levels together');
    check(await pA.locator('.gl .gg').count() === await pA.evaluate(() => new Set([1, 2, 3, 4, 5].flatMap(k => window['HSK' + k + '_GRAMMAR'].lessons.map(l => l.cat))).size), 'Grammar is in one category per distinct name across the five levels');
    const t0 = await pA.evaluate(() => window.HSK5_GRAMMAR.lessons[0].title);
    await pA.fill('.gl .tr-search', t0);
    await pA.waitForTimeout(100);
    check(await pA.locator('.gl .gp .lvtag.l5').count() >= 1 && await pA.locator('.gl .gp.rl5').count() >= 1, 'an HSK 5 lesson is found by its title and carries its HSK 5 tag and coloured edge (' + t0 + ')');
    await pA.fill('.gl .tr-search', '');
    // topics of the same name are joined across the five levels
    await require('./test-nav').makeNav(pA)('Archive');
    await pA.waitForTimeout(150);
    await pA.locator('button', { hasText: /^Show all \d+ topics$/ }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.mtile').count() === await pA.evaluate(() => new Set([1, 2, 3, 4, 5].flatMap(k => window['HSK' + k + '_WEBS'].topics.map(t => t.name))).size), 'Word webs shows one mountain per topic name across the five levels');
    await pA.locator('button', { hasText: 'Shared character' }).click();
    await pA.waitForTimeout(100);
    check(await pA.locator('.cidx .ctile').count() === await pA.evaluate(() => [1, 2, 3, 4, 5].reduce((n, k) => n + window['HSK' + k + '_WEBS'].hubs.length, 0)), 'the shared-character picker holds the hubs of the five levels');
    // progress goes to each level's own save
    await pA.evaluate(() => {
      const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
      const t = [1, 2, 3, 4, 5].map(k => window['HSK' + k + '_WORDS'][3].zh);
      t.forEach(z => { ws[z].see = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; ws[z].prod = { s: 4, l: 0, t: Date.now() - 6 * 864e5 }; });
      window.__t = t;
      app.setState({ ws, rq: [], rcomplete: false }); app.persistNow();
    });
    const saved = await pA.evaluate(() => {
      const keys = ['shanlu-progress-v1', 'shanlu-progress-v1-l2', 'shanlu-progress-v1-l3', 'shanlu-progress-v1-l4', 'shanlu-progress-v1-l5'];
      const s = keys.map(k => JSON.parse(localStorage.getItem(k) || '{}').ws || {});
      return window.__t.map((z, i) => s.map((w, j) => !!(w[z] && w[z].see && w[z].see.s === 4) === (i === j)).every(Boolean));
    });
    check(saved.every(Boolean), 'each word is saved only in its own level\'s progress (HSK 1 to HSK 5)');
    await pA.goto(url + '?level=5');
    await pA.waitForSelector('.app');
    check(await pA.evaluate(() => window.SHANLU_LEVEL === 5 && window.shanlu.state.ws[window.HSK5_WORDS[3].zh].see.s === 4), 'HSK 5 alone shows what was done in All levels');
    check(errsA.length === 0, 'no page errors in All levels (' + errsA.slice(0, 2).join(' | ') + ')');
    await cA.close();
    // the lock for All levels: HSK 1 to 3 passed only, so HSK 5 stays out of it
    const cB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await cB.addInitScript(startState, { passed: { 1: 1, 2: 1, 3: 1 }, erhua: erhuaMode });
    const pB = await cB.newPage();
    await pB.goto(url + '?level=0');
    await pB.waitForSelector('.app');
    check(await pB.evaluate(() => window.SHANLU_LEVELS.join()) === '1,2,3,4', 'All levels holds only the unlocked levels (HSK 1 to HSK 4) while HSK 5 is locked');
    await cB.close();
  }

  check(errors.length === 0, 'no console errors (' + errors.slice(0, 3).join(' | ') + ')');
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all HSK 5 checks passed');
  process.exit(failures ? 1 : 0);
})();
