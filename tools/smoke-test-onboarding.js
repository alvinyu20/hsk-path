/* Browser test for the first-visit experience: intro pop-up on the Journey, the free first flight, the five guide cards, where to start, name and friends, then Start here and the what-next panel; plus the "How Shanlu works" reference page.
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
    await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));   // photos come from Wikimedia: a stand-in picture keeps the test offline
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
    await page.locator('button', { hasText: /^\s*Check\s*$/ }).click();
    await page.locator('button', { hasText: 'Continue' }).click();
  };

  const toGuide = async (page) => {   // intro -> first step -> first flight -> the guide cards
    await page.locator('button', { hasText: 'Take my first step' }).click();
    await page.locator('.jy-go').click();
    await page.locator('.jy-trip-go').click();
    await page.waitForSelector('.obm-guide', { timeout: 20000 });
    await page.waitForTimeout(900);
  };
  const dlg = (p) => p.locator('[role=dialog]');

  // ---- a new person, on a laptop ----
  {
    const { ctx, page, errors } = await open();
    check(await page.evaluate(() => window.shanlu.state.screen) === 'journey', 'a new person lands on the Journey, not Home');
    check(await dlg(page).count() === 1 && /Welcome to Shanlu/.test(await dlg(page).innerText()), 'the intro pop-up is shown');
    check(/Take my first step/.test(await dlg(page).innerText()) && /I have been here before/.test(await dlg(page).innerText()), 'it offers one main button and a way back for returning people');
    await page.locator('button', { hasText: 'Take my first step' }).click();
    check(await dlg(page).count() === 0 && /Your first stop is free/.test(await page.locator('.ob-banner').innerText()), 'the pop-up closes and the Journey says the first stop is free');
    await page.reload(); await page.waitForSelector('.app');
    check(await dlg(page).count() === 0 && await page.locator('.ob-banner').count() === 1, 'a reload keeps the person at the first flight, without the intro again');
    await page.locator('.jy-go').click();
    await page.locator('.jy-trip-go').click();
    await page.waitForSelector('.obm-guide', { timeout: 20000 }); await page.waitForTimeout(900);
    check(/1 of 5/i.test(await dlg(page).innerText()) && /Meet a few words at a time/.test(await dlg(page).innerText()), 'after the first flight the guide cards start with Meet');
    const titles = [], shots = [], bodies = [];
    const peek = async () => {
      titles.push(await page.locator('.obm-h').innerText()); bodies.push(await page.locator('.obm-guide .obm-p').innerText());
      const u = await page.locator('.obm-shot-img').evaluate((e) => (/url\("?([^")]+)"?\)/.exec(e.style.backgroundImage) || [])[1]);
      const ok = await page.evaluate(async (x) => { const r = await fetch(x); const b = await r.blob(); return r.ok && b.type === 'image/jpeg' && b.size > 20000; }, u);
      shots.push({ u, ok, alt: await page.locator('.obm-shot').getAttribute('aria-label') });
    };
    for (let i = 0; i < 4; i++) { await peek(); await page.locator('.obm-nav .pri').click(); }
    await peek();
    check(shots.length === 5 && shots.every((x) => x.ok && x.alt && x.alt.length > 20) && new Set(shots.map((x) => x.u)).size === 5, 'every card has its own real screenshot, and it loads: ' + shots.map((x) => x.u).join(', '));
    check(/Grammar/.test(bodies[0]) && /Speaking/.test(bodies[0]) && /stamps/.test(bodies[3]) && /souvenirs/.test(bodies[3]), 'the Path card says it has Grammar and Speaking; the Journey card says you collect stamps and souvenirs');
    check(titles.length === 5 && new Set(titles).size === 5, 'five different cards: ' + titles.join(' | '));
    check(/Choose where to start/.test(await page.locator('.obm-nav .pri').innerText()), 'the last card offers Choose where to start');
    check(await page.locator('.obm-nav button', { hasText: 'Back' }).count() === 1, 'the cards can go back');
    await page.locator('.obm-nav .pri').click();
    let t = await dlg(page).innerText();
    check(/Where are you starting/.test(t) && /I am brand new to Chinese/.test(t) && /I know a little/.test(t) && /Test out of a level/.test(t) && !/Coming soon/.test(t), 'then where to start, with test-out as a real choice');
    check(await page.locator('.obm-opt', { hasText: 'Test out of a level' }).isEnabled(), 'test-out can be chosen (tools/smoke-test-placement.js runs it)');
    check(await page.locator('.obm-opt.on').innerText().then(x => /brand new/.test(x)), 'brand new is the preselected, recommended choice');
    check(/sounds of Chinese/.test(t) && /pinyin and tones/.test(t), 'it says that a beginner starts with the sounds');
    await page.locator('button', { hasText: 'Continue' }).click();
    t = await dlg(page).innerText();
    check(/Make it yours/.test(t) && await page.locator('#ob-name').count() === 1, 'then name');
    check(!/Join the study group/.test(t), 'no join option when the site has no friends server');
    check(await page.locator('button', { hasText: 'Stay a guest for now' }).count() === 1, 'and a guest option');
    await page.locator('.obm .seg2 button', { hasText: '30 min' }).click();
    await page.locator('#ob-name').fill('Mei');
    await page.locator('button', { hasText: 'Save and start' }).click();
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ screen: window.shanlu.state.screen, mins: window.shanlu.state.mins, onb: JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs }));
    check(st.screen === 'home' && st.mins === 30, 'finishing lands on Home with the chosen goal');
    check(st.onb && st.onb.name && st.onb.name.v === 'Mei' && st.onb.onb.v.p === 'done' && st.onb.onb.v.l === 'new', 'the name, the choice and "flow done" are saved');
    check(await dlg(page).count() === 0 && await page.locator('section.ob[aria-label="The sounds of Chinese"]').count() === 1 && await page.locator('section.ob[aria-label="Start here"]').count() === 1, 'Home shows the sounds course first and Start here under it');
    check(/Seven|7 short lessons/.test(await main(page)) && await page.locator('button', { hasText: 'Start the sounds course' }).count() === 1, 'the sounds card explains the course and offers it');
    await page.reload(); await page.waitForSelector('.app');
    check(await dlg(page).count() === 0 && await page.evaluate(() => window.shanlu.state.screen) === 'home', 'the flow does not come back after a reload');
    // the pinyin course opens from the card
    await page.locator('button', { hasText: 'Start the sounds course' }).click();
    check(await page.evaluate(() => window.shanlu.state.screen) === 'pinyin' && await page.evaluate(() => window.shanlu.state.pyView) === 'lesson', 'Start the sounds course opens the first lesson');
    await page.locator('.brand').click();
    check(await page.locator('section.ob[aria-label="The sounds of Chinese"]').count() === 0, 'the sounds card is gone once the course has been opened');
    // Start here, the first session
    const words = await page.locator('.ob-w b').allInnerTexts();
    check(JSON.stringify(words) === JSON.stringify(['你好', '谢谢', '我', '你', '是']), 'Start here shows the five fixed words: ' + words.join(' '));
    await page.locator('button', { hasText: 'Learn my first 5 words' }).click();
    await page.waitForSelector('text=Got it, ask me soon');
    const rs = await page.evaluate(() => ({ lrn: Object.keys(window.shanlu.state.lrn).length, rq: window.shanlu.state.rq.length, screen: window.shanlu.state.screen }));
    check(rs.screen === 'review' && rs.lrn === 5 && rs.rq === 5, 'the button puts the five words into Review and starts the session');
    await page.locator('.brand').click();
    check(await page.locator('button', { hasText: 'Continue my first session' }).count() === 1, 'Home offers to continue a started session');
    await page.locator('button', { hasText: 'Continue my first session' }).click();
    for (let i = 0; i < 60 && !(await main(page)).includes('cards done'); i++) await drive(page);
    t = await main(page);
    check(/First session done/.test(t) && /Tomorrow, Review brings these five words back/.test(t), 'finishing shows what to do next');
    check(await page.locator('button', { hasText: 'Take my first flight' }).count() === 0, 'the first flight is not offered again: it was already taken');
    await page.locator('.brand').click();
    check(await page.locator('section.ob').count() === 0 && /^Today/.test(await page.locator('h1').innerText()), 'Home is back to normal once the session is done');
    // the reference page
    await page.locator('.side .ylink', { hasText: 'How Shanlu works' }).click();
    t = await main(page);
    check(/Small steps every day/.test(t) && /Three things, in this order/.test(t) && /Your toolkit/.test(t) && /Everything you study earns coins/.test(t), 'the reference page has its sections');
    check(/Your first stop is free|Free/.test(t) && /\b50\b/.test(t) && /\b500\b/.test(t), 'it shows the coin ramp');
    check(/Nine HSK levels/.test(t) && await page.locator('.gd-rg').count() === 9 && await page.locator('.gd-rg.on').count() === 4, 'it shows nine levels, four of them built');
    check(/New to Chinese\? Start with the sounds/.test(t) && await page.locator('.guide button', { hasText: 'Open the pinyin course' }).count() === 1, 'the pinyin course is near the top');
    check(await page.locator('.side .ylink', { hasText: 'How Shanlu works' }).count() === 1, 'the sidebar keeps a link to it');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- a new person, on a phone (a sheet from the bottom) ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 } });
    const fit = async (what) => { await page.waitForTimeout(600); const r = await page.evaluate(() => { const b = document.querySelector('.obm').getBoundingClientRect(); return { over: document.documentElement.scrollWidth - window.innerWidth, w: Math.round(b.width), bottom: Math.round(b.bottom), h: window.innerHeight }; }); check(r.over <= 1 && r.w <= 390 && r.bottom <= r.h + 1, what + ' fits a phone (overflow ' + r.over + 'px, width ' + r.w + ', bottom ' + r.bottom + ')'); };
    await fit('the intro');
    await toGuide(page);
    await fit('a guide card');
    await page.locator('.obm-bar button', { hasText: 'Skip' }).click();
    check(/Where are you starting/.test(await dlg(page).innerText()), 'Skip on the cards goes to where to start');
    await fit('where to start');
    await page.locator('.obm-opt', { hasText: 'I know a little' }).click();
    await page.locator('button', { hasText: 'Continue' }).click();
    await fit('name and goal');
    await page.locator('#ob-name').fill('Not saved');
    await page.locator('button', { hasText: 'Stay a guest for now' }).click();
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ screen: window.shanlu.state.screen, prefs: JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs || {} }));
    check(st.screen === 'home' && !st.prefs.name && st.prefs.onb.v.l === 'some', 'staying a guest keeps no name and remembers "I know a little"');
    check(await page.locator('section.ob[aria-label="The sounds of Chinese"]').count() === 0 && await page.locator('section.ob[aria-label="Start here"]').count() === 1, '"I know a little" gets Start here without the sounds card');
    await page.locator('.acct-mini').click();
    check((await page.locator('.acct-row').allInnerTexts()).join(' ').includes('How Shanlu works'), 'the Account page lists the reference page');
    await page.locator('.acct-row', { hasText: 'How Shanlu works' }).click();
    const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(/Small steps every day/.test(await main(page)) && over2 <= 1, 'the reference page fits a phone width (overflow ' + over2 + 'px)');
    check(errors.length === 0, 'no errors on the phone: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- skipping the tour, and coming back on another device ----
  {
    const { ctx, page } = await open();
    await page.locator('button', { hasText: 'Take my first step' }).click();
    await page.locator('button', { hasText: 'Skip the tour' }).click();
    check(await page.locator('.ob-banner').count() === 0 && await dlg(page).count() === 0, 'Skip the tour ends the flow');
    await page.locator('.brand').click();
    check(await page.locator('section.ob[aria-label="Start here"]').count() === 1, 'Start here is still offered');
    await page.reload(); await page.waitForSelector('.app');
    check(await dlg(page).count() === 0, 'and the intro stays gone');
    await ctx.close();
  }
  {
    const { ctx, page } = await open();
    await page.locator('button', { hasText: 'I have been here before' }).click();
    const t = await dlg(page).innerText();
    check(/Welcome back/.test(t) && /Restore from a backup file/.test(t), 'a returning person is offered their backup file');
    check(!/Your personal link/.test(t), 'no personal-link box when the site has no friends server');
    await page.locator('button', { hasText: /^\s*Back\s*$/ }).click();
    check(/Welcome to Shanlu/.test(await dlg(page).innerText()), 'Back returns to the intro');
    await ctx.close();
  }

  // ---- someone who already studies sees none of it; automated browsers skip it ----
  {
    const { ctx, page } = await open({ xp: 500 });
    check(await dlg(page).count() === 0 && await page.evaluate(() => window.shanlu.state.screen) === 'home', 'a person with progress gets no pop-up and stays on Home');
    check(/^Today/.test(await page.locator('h1').innerText()) && await page.locator('section.ob').count() === 0, 'and keeps the normal Home title');
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ off: true });
    check(await dlg(page).count() === 0 && await page.locator('section.ob').count() === 0 && await page.evaluate(() => window.shanlu.state.screen) === 'home', 'automated browsers skip the onboarding unless a test asks for it');
    await ctx.close();
  }

  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('onboarding browser tests passed');
})().catch(e => { console.log(e); process.exit(1); });
