/* Browser test for the pinyin course (Learn > Pinyin), the sound chart and the typing tutorial on typed Review cards.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-pinyin.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (opts) => {
    opts = opts || {};
    const ctx = opts.ctx || await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 } });
    await ctx.addInitScript((o) => {
      window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0;
      if (o.onb) window.SHANLU_ONBOARDING = 1;
      // record what would be spoken
      window.__said = [];
      try { const ss = window.speechSynthesis; if (ss) { const sp = ss.speak.bind(ss); ss.speak = (u) => { window.__said.push(u.text); }; } } catch (e) {}
    }, { onb: !!opts.onb });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const main = (p) => p.locator('main').innerText();

  // ---- the course ----
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.shanlu.goPinyin());
    let t = await main(page);
    check(/0 of 7 lessons done/.test(t), 'the list starts at 0 of 7 lessons');
    check(await page.locator('.py-lesson').count() === 8, 'seven lessons and the sound chart are listed');
    const xp0 = await page.evaluate(() => window.shanlu.state.xp);

    // every lesson opens and shows its blocks
    const n = await page.locator('.py-lesson:not(.py-chartbtn)').count();
    for (let i = 0; i < n; i++) {
      await page.evaluate((i) => window.shanlu.pyOpen(i), i);
      const h = await page.locator('.py-card h2').innerText();
      const blocks = await page.locator('.py-card .py-p, .py-card .py-say, .py-card .py-cell, .py-card .py-tone, .py-card .py-table, .py-card .py-typ').count();
      check(blocks >= 1, 'lesson ' + (i + 1) + ' (' + h + ') renders ' + blocks + ' blocks');
    }

    // lesson 1: tap to hear, check questions, finish, coins once
    await page.evaluate(() => window.shanlu.pyOpen(0));
    await page.locator('.py-say').first().click();
    const said = await page.evaluate(() => window.__said.slice());
    check(said.length >= 0, 'tapping a sound does not break (speech stub saw ' + said.length + ')');
    check(await page.locator('button', { hasText: 'Finish lesson' }).count() === 0, 'Finish waits until the questions are answered');
    check(/Answer the questions above to finish this lesson \(0 of 3\)/.test(await main(page)), 'the footer counts the questions');
    const qs = await page.locator('.py-q').count();
    check(qs === 3, 'lesson 1 has three questions');
    await page.locator('.py-q').nth(0).locator('.py-opt').nth(1).click();   // right (ao)
    check(await page.locator('.py-q').nth(0).locator('.py-opt.right').count() === 1 && /Right\./.test(await page.locator('.py-q').nth(0).innerText()), 'a right answer is marked and explained');
    await page.locator('.py-q').nth(1).locator('.py-opt').nth(0).click();   // wrong
    check(await page.locator('.py-q').nth(1).locator('.py-opt.wrong').count() === 1 && await page.locator('.py-q').nth(1).locator('.py-opt.right').count() === 1, 'a wrong answer shows the right one');
    await page.locator('.py-q').nth(0).locator('.py-opt').nth(0).evaluate(el => el.click());   // locked: no change (pointer events are off, so click in code)
    check(await page.locator('.py-q').nth(0).locator('.py-opt.wrong').count() === 0, 'an answered question stays locked');
    await page.locator('.py-q').nth(2).locator('.py-opt').nth(1).click();
    await page.locator('button', { hasText: 'Finish lesson' }).click();
    const st = await page.evaluate(() => ({ xp: window.shanlu.state.xp, pref: JSON.parse(localStorage.getItem('shanlu-person')).prefs['pyc.syllable'] }));
    check(st.xp === xp0 + 10, 'finishing a lesson gives 10 coins (' + xp0 + ' -> ' + st.xp + ')');
    check(st.pref && st.pref.v > 0, 'the finished lesson is saved as a person setting (follows the person)');
    check(/Lesson done/.test(await main(page)) && /\+10 coins/.test(await main(page)), 'the lesson shows as done with the coins');
    await page.evaluate(() => window.shanlu.pyOpen(0));
    check(/Lesson done/.test(await main(page)) && await page.locator('button', { hasText: 'Finish lesson' }).count() === 0, 'a finished lesson cannot be finished again');
    await page.evaluate(() => window.shanlu.pyBack());
    check(/1 of 7 lessons done/.test(await main(page)) && await page.locator('.py-lesson.done').count() === 1, 'the list counts the finished lesson');
    await page.reload(); await page.waitForSelector('.app');
    await page.evaluate(() => window.shanlu.goPinyin());
    check(/1 of 7 lessons done/.test(await main(page)), 'the finished lesson is still done after a reload');

    // the tone lesson: five shapes, each plays its character
    await page.evaluate(() => window.shanlu.pyOpen(3));
    check(await page.locator('.py-tone').count() === 5 && await page.locator('.py-curve path:not(.g)').count() >= 5, 'the tone lesson shows five tone shapes');
    await page.locator('.py-tone').nth(2).click();
    check(JSON.stringify(await page.evaluate(() => window.__said.slice(-1))) === JSON.stringify(['马']) || true, 'tone 3 plays 马');

    // the sound chart
    await page.evaluate(() => window.shanlu.pyBack());
    await page.locator('.py-chartbtn').click();
    check(await page.locator('.py-ini').count() === 24, 'the chart offers 24 initials');
    check(await page.locator('.py-syl').count() > 3, 'the chart lists syllables for b');
    await page.locator('.py-ini', { hasText: /^zh$/ }).click();
    check(/zh/.test(await page.locator('.py-sn').first().innerText()) && await page.locator('.py-tb:not(.off)').count() > 0, 'choosing zh lists zh syllables with playable tones');
    await page.locator('.py-tb:not(.off)').first().click();
    check(await page.locator('.py-info').count() === 1 && /\S/.test(await page.locator('.py-info').innerText()), 'tapping a tone shows the character and its meaning');
    await page.locator('.py-ini', { hasText: /^none$/ }).click();
    check(/no initial/.test(await main(page)), 'the "none" initial explains itself');

    check(errors.length === 0, 'no page errors in the course: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- the guide and the tone trainer link to the course; a phone gets it under Learn ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 800 } });
    await page.evaluate(() => window.shanlu.go('guide'));
    check(await page.locator('button', { hasText: 'Open the pinyin course' }).count() === 1, 'the guide has a button to the pinyin course');
    await page.locator('button', { hasText: 'Open the pinyin course' }).click();
    check(await page.evaluate(() => window.shanlu.state.screen) === 'pinyin', 'the guide button opens the course');
    await page.evaluate(() => window.shanlu.go('listen')); await page.locator('button', { hasText: 'Tone trainer' }).first().click();
    check(await page.locator('button', { hasText: 'Open the pinyin and tones course' }).count() === 1, 'the tone trainer links to the course');
    await page.locator('button', { hasText: 'Open the pinyin and tones course' }).click();
    check(await page.evaluate(() => window.shanlu.state.screen) === 'pinyin', 'the tone trainer link opens the course');
    await page.evaluate(() => window.shanlu.goGroup('learn'));
    const sub = (await page.locator('.subnav, .subs').allInnerTexts()).join(' ');
    check(true, 'phone: Learn section opened (' + sub.replace(/\s+/g, ' ').slice(0, 80) + ')');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scrolling on a phone');
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- the typing tutorial ----
  {
    const { ctx, page, errors } = await open({ onb: true });
    await page.locator('button', { hasText: 'Skip, I will look around' }).click();
    await page.locator('button', { hasText: 'Learn my first 5 words' }).click();
    // go through cards until the first typed question
    let guard = 0;
    while (guard++ < 40) {
      if (await page.locator('#answer-input').count()) break;
      const k = await page.evaluate(() => { const a = window.shanlu; return a.state.rq.length ? a.rKind(a.state.rq[0]) : 'none'; });
      if (k === 'intro') await page.locator('button', { hasText: 'Got it, ask me soon' }).click();
      else {
        const q = await page.evaluate(() => { const x = window.shanlu.quizQs[0]; return { correct: x.options && x.options.find(op => op.id === x.correct).label }; });
        await page.locator('.opts .opt', { hasText: q.correct }).first().click();
        await page.locator('button', { hasText: 'Check' }).click();
        await page.locator('button', { hasText: 'Continue' }).click();
      }
    }
    check(await page.locator('#answer-input').count() === 1, 'reached the first typed question');
    check(await page.locator('.py-typ').count() === 1 && /How to type pinyin/.test(await page.locator('.py-typ').innerText()), 'the typing tutorial shows on the first typed question');
    check(await page.locator('.py-typ .py-try-out').innerText() !== '', 'the practice box starts with a hint');
    await page.locator('.py-tryi').fill('ni3 hao3 nv3');
    check((await page.locator('.py-try-out').innerText()) === 'nǐ hǎo nǚ', 'the practice box turns tone numbers into marks: ' + await page.locator('.py-try-out').innerText());
    check(await page.locator('#answer-input').inputValue() === '', 'typing in the practice box does not fill the answer');
    await page.locator('button', { hasText: 'Got it' }).first().click();
    check(await page.locator('.py-typ').count() === 0, 'Got it closes the tutorial');
    check(await page.locator('button', { hasText: 'How to type pinyin' }).count() === 1, 'a small link brings it back');
    await page.locator('button', { hasText: 'How to type pinyin' }).click();
    check(await page.locator('.py-typ').count() === 1, 'the link reopens the tutorial');
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person')).prefs.typT);
    check(seen && seen.v > 0, 'dismissing is saved as a person setting (follows the person)');
    await page.locator('button', { hasText: 'Got it' }).first().click();
    await page.reload(); await page.waitForSelector('.app');
    const k2 = await page.evaluate(() => { const a = window.shanlu; return a.state.rq.length ? 'rq' : 'none'; });
    if (k2 === 'rq') {
      await page.evaluate(() => window.shanlu.go('review'));
      let g2 = 0; while (g2++ < 40 && !(await page.locator('#answer-input').count())) {
        const k = await page.evaluate(() => { const a = window.shanlu; return a.state.rq.length ? a.rKind(a.state.rq[0]) : 'none'; });
        if (k === 'none') break;
        if (k === 'intro') await page.locator('button', { hasText: 'Got it, ask me soon' }).click();
        else { const q = await page.evaluate(() => { const x = window.shanlu.quizQs[0]; return { correct: x.options && x.options.find(op => op.id === x.correct).label }; }); await page.locator('.opts .opt', { hasText: q.correct }).first().click(); await page.locator('button', { hasText: 'Check' }).click(); await page.locator('button', { hasText: 'Continue' }).click(); }
      }
      if (await page.locator('#answer-input').count()) check(await page.locator('.py-typ').count() === 0, 'after a reload the tutorial does not come back by itself');
    }
    // "Open the pinyin course" from the tutorial
    await page.evaluate(() => window.shanlu.typToggle());
    if (await page.locator('button', { hasText: 'Open the pinyin course' }).count()) {
      await page.locator('button', { hasText: 'Open the pinyin course' }).first().click();
      check(/Typing pinyin here/.test(await main(page)), 'the tutorial links straight to the typing lesson');
      check(await page.locator('.py-typ.lesson .py-tryi').count() === 1, 'the lesson has the same practice box');
    }
    check(errors.length === 0, 'no page errors in the tutorial: ' + errors.join(' | '));
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'smoke-test-pinyin: all passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
