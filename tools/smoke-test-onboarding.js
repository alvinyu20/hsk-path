/* Browser test for the first-run experience: Welcome card, Start here session, what-next panel, and the guide that opens after the first flight.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-onboarding.js */
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
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 } });
    await ctx.addInitScript((o) => {
      window.SHANLU_MUTE_SFX = true; window.SHANLU_JY_FIRST = 'sichuan'; window.SHANLU_AUTO_SHARE = 0;
      if (!o.off) window.SHANLU_ONBOARDING = 1;
      if (o.xp != null && !localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', JSON.stringify({ xp: o.xp, dayXp: 0 }));
    }, { off: !!opts.off, xp: opts.xp });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const main = (p) => p.locator('main').innerText();
  const drive = async (page) => {   // one Review card, answered correctly
    const st = await page.evaluate(() => { const a = window.shanlu; const it = a.state.rq[0]; return { kind: a.rKind(it) }; });
    if (st.kind === 'intro') { await page.locator('button', { hasText: 'Got it, ask me soon' }).click(); return; }
    const q = await page.evaluate(() => { const x = window.shanlu.quizQs[0]; return { type: x.type, correct: x.options && x.options.find(op => op.id === x.correct).label, py: x.exp && x.exp.py }; });
    if (q.type === 'type') await page.fill('#answer-input', q.py); else await page.locator('.opts .opt', { hasText: q.correct }).first().click();
    await page.locator('button', { hasText: 'Check' }).click();
    await page.locator('button', { hasText: 'Continue' }).click();
  };

  // ---- a new person ----
  {
    const { ctx, page, errors } = await open();
    let t = await main(page);
    check(/Welcome to Shanlu/.test(await page.locator('h1').innerText()), 'a new person is welcomed');
    check(await page.locator('section.ob[aria-label="Welcome"]').count() === 1, 'the Welcome card is on Home');
    check(await page.locator('section.ob[aria-label="Start here"]').count() === 0, 'Start here waits until the Welcome card is dealt with');
    check(/HSK 2 opens when you pass the HSK 1 exam/.test(t) && /optional/.test(t), 'the Welcome card explains the level lock and that the AI is optional');
    check(await page.getByText('How Shanlu works').count() === 0, 'the guide is not offered before the first flight');
    // the goal can be set from the card
    await page.locator('section.ob[aria-label="Welcome"] .seg2 button', { hasText: '30 min' }).click();
    check(await page.evaluate(() => window.shanlu.state.mins) === 30, 'the daily goal can be chosen on the Welcome card');
    // skipping keeps the Start here card
    await page.locator('button', { hasText: 'Skip, I will look around' }).click();
    check(await page.locator('section.ob[aria-label="Welcome"]').count() === 0 && await page.locator('section.ob[aria-label="Start here"]').count() === 1, 'skipping the Welcome card leaves Start here');
    await page.reload(); await page.waitForSelector('.app');
    check(await page.locator('section.ob[aria-label="Welcome"]').count() === 0, 'the Welcome card stays gone after a reload');
    const words = await page.locator('.ob-w b').allInnerTexts();
    check(JSON.stringify(words) === JSON.stringify(['你好', '谢谢', '我', '你', '是']), 'Start here shows the five fixed words: ' + words.join(' '));
    // the session
    await page.locator('button', { hasText: 'Learn my first 5 words' }).click();
    await page.waitForSelector('text=Got it, ask me soon');
    const st = await page.evaluate(() => ({ lrn: Object.keys(window.shanlu.state.lrn).sort(), rq: window.shanlu.state.rq.length, screen: window.shanlu.state.screen }));
    check(st.screen === 'review' && st.lrn.length === 5 && st.rq === 5, 'the button puts the five words into Review and starts the session');
    // leave and come back: Continue, not a restart
    await page.locator('.brand').click();
    check(await page.locator('button', { hasText: 'Continue my first session' }).count() === 1, 'Home offers to continue a started session');
    await page.locator('button', { hasText: 'Continue my first session' }).click();
    check(await page.evaluate(() => window.shanlu.state.rq.length) === 5 && await page.evaluate(() => window.shanlu.state.screen) === 'review', 'continuing does not restart the session');
    for (let i = 0; i < 60 && !(await main(page)).includes('cards done'); i++) await drive(page);
    t = await main(page);
    check(/cards done/.test(t) && /First session done/.test(t), 'finishing shows what to do next');
    check(/Tomorrow, Review brings these five words back/.test(t), 'the what-next panel says what to do tomorrow');
    check(await page.locator('button', { hasText: 'Take my first flight' }).count() === 1, 'the first flight is offered');
    await page.locator('.brand').click();
    check(await page.locator('section.ob').count() === 0, 'Home no longer shows Start here once the session is done');
    check(/Welcome back/.test(await page.locator('h1').innerText()), 'the Home title is back to normal');
    // the first flight, then the guide
    check(await page.getByText('How Shanlu works').count() === 0, 'the guide is still hidden before the flight');
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click();
    t = await main(page);
    check(/You have landed/.test(t) && await page.locator('.ob-banner button', { hasText: 'How Shanlu works' }).count() === 1, 'after the first flight the guide is offered');
    await page.locator('.ob-banner button', { hasText: 'How Shanlu works' }).click();
    t = await main(page);
    check(/A day on Shanlu/.test(t) && /What each part is for/.test(t) && /XP and the Journey/.test(t) && /Your progress and your friends/.test(t), 'the guide opens with its sections');
    check(/Your first stop is free/.test(t) && /50, 100, 150, 200 and then 250 XP/.test(t), 'the guide states the XP ramp');
    check(await page.locator('.side .linkbtn', { hasText: 'How Shanlu works' }).count() === 1, 'the sidebar keeps a link to the guide');
    await page.locator('.pill.xpp').click();
    check(await page.locator('.ob-banner').count() === 0, 'the prompt does not come back once the guide was opened');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- phone: the guide is under More once the first flight has happened ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 } });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 1, 'the Welcome card fits a phone width (overflow ' + over + 'px)');
    await page.locator('button', { hasText: 'Start with 5 words' }).click();
    await page.waitForSelector('text=Got it, ask me soon');
    check(await page.evaluate(() => window.shanlu.state.rq.length) === 5 && await page.evaluate(() => Object.keys(window.shanlu.state.lrn).length) === 5, 'Start with 5 words on the Welcome card starts the session too');
    await page.locator('.navg button', { hasText: 'More' }).click();
    check(!(await page.locator('.subnav button').allInnerTexts()).includes('How Shanlu works'), 'More has no guide before the flight');
    await page.evaluate(() => { const a = window.shanlu; a.go('journey'); });
    await page.locator('.jy-go').click();
    await page.locator('.navg button', { hasText: 'More' }).click();
    check((await page.locator('.subnav button').allInnerTexts()).includes('How Shanlu works'), 'More lists the guide after the flight');
    await page.locator('.subnav button', { hasText: 'How Shanlu works' }).click();
    const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(/A day on Shanlu/.test(await main(page)) && over2 <= 1, 'the guide fits a phone width (overflow ' + over2 + 'px)');
    check(errors.length === 0, 'no errors on the phone: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- someone who already studies never sees the Welcome card; Skip start hides Start here ----
  {
    const { ctx, page, errors } = await open({ xp: 500 });
    check(await page.locator('section.ob').count() === 0, 'a person with progress gets no Welcome card or Start here');
    check(/Welcome back/.test(await page.locator('h1').innerText()), 'and keeps the normal Home title');
    await ctx.close();
  }
  {
    const { ctx, page } = await open();
    await page.locator('button', { hasText: 'Skip, I will look around' }).click();
    await page.locator('button', { hasText: 'Skip this, I will find my own way' }).click();
    check(await page.locator('section.ob').count() === 0, 'skipping Start here removes it');
    await page.reload(); await page.waitForSelector('.app');
    check(await page.locator('section.ob').count() === 0, 'and it stays removed after a reload');
    await ctx.close();
  }
  // ---- the browser tests of everything else run without onboarding ----
  {
    const { ctx, page } = await open({ off: true });
    check(await page.locator('section.ob').count() === 0, 'automated browsers skip the onboarding unless a test asks for it');
    await ctx.close();
  }

  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('onboarding browser tests passed');
})().catch(e => { console.log(e); process.exit(1); });
