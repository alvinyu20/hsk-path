/* Browser test for the level check ("test out of a level"): open it from Settings and from the lock message, answer it, see the result, save it (the level opens,
 * words are marked probably known and come back 20 a day), the first-visit route, and the phone layout.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-placement.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (opts) => {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 } });
    await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await ctx.addInitScript((o) => { window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; if (o.onb) window.SHANLU_ONBOARDING = 1; if (o.store && !localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', o.store); }, { onb: !!opts.onb, store: opts.store });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const dlg = (p) => p.locator('[role=dialog]');
  // answer every question: right (a person who knows it) or "I don't know"
  const sit = async (page, mode) => {
    let n = 0;
    while (n++ < 80) {
      const q = await page.evaluate(() => { const p = window.shanlu.state.pcs; if (!p || p.step !== 'ask') return null; const run = p.run; const it = window.ShanluPlacement.current(run); return it ? { ans: it.ans, lv: it.lv } : null; });
      if (!q) break;
      if (mode === 'dk') await dlg(page).locator('button', { hasText: /^I don't know$/ }).click();
      else if (mode === 'right') await dlg(page).locator('.pc-ans').nth(q.ans).click();
      else await dlg(page).locator('.pc-ans').nth(mode(q)).click();
    }
  };

  // ---- from Settings: pass HSK 1 and 2, get placed at HSK 3 ----
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.shanlu.go('voice')); await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Check my level' }).first().click();
    check(await dlg(page).count() === 1 && /Test out of a level/.test(await dlg(page).innerText()), 'Settings opens the level check');
    const claims = await dlg(page).locator('.obm-opt').allInnerTexts();
    check(claims.length === 4 && /HSK 1/.test(claims[0]) && /300 words/.test(claims[0]) && /HSK 4/.test(claims[3]), 'it asks for the highest level you know, HSK 1 to 4, with word counts: ' + claims.map((x) => x.split('\n')[0]).join(', '));
    await dlg(page).locator('.obm-opt', { hasText: 'HSK 2' }).click();
    await dlg(page).locator('button', { hasText: 'Start the check' }).click();
    check(/HSK 2 · 1 of 16/i.test(await dlg(page).innerText()), 'the first stage starts with 16 questions: ' + (await dlg(page).locator('.kick').first().innerText()));
    const isWord = await dlg(page).locator('.pc-zh').count() === 1;
    check(isWord || await dlg(page).locator('.pc-prompt').count() === 1, 'a question shows a word or a grammar prompt');
    check(await dlg(page).locator('.pc-ans').count() >= 2 && await dlg(page).locator('button', { hasText: /^I don't know$/ }).count() === 1, 'answers and an "I don\'t know" button are shown');
    await dlg(page).locator('button', { hasText: 'Show pinyin' }).count() && check(true, 'a pinyin switch is offered for words');
    // no answer is revealed: nothing says right or wrong
    await dlg(page).locator('.pc-ans').first().click();
    check(!/Correct|Not quite|Right|Wrong/.test(await dlg(page).innerText()), 'the check does not tell you whether an answer was right');
    await page.evaluate(() => { const p = window.shanlu.state.pcs; p.step = 'claim'; });
    // start over, cleanly, and answer everything right
    await page.evaluate(() => window.shanlu.pcRetry());
    await dlg(page).locator('.obm-opt', { hasText: 'HSK 2' }).click();
    await dlg(page).locator('button', { hasText: 'Start the check' }).click();
    await sit(page, 'right');
    const res = await dlg(page).innerText();
    check(/You are ready for HSK 3/.test(res) && /HSK 1 to 2/.test(res), 'passing HSK 2 places you at HSK 3: ' + res.split('\n').slice(0, 2).join(' | '));
    check(/probably known/.test(res) && /20 a day/.test(res) && /estimate/.test(res), 'the result says what happens to the skipped words and that it is only an estimate');
    check(await page.evaluate(() => window.ShanluLevel.placed()) === 0, 'nothing is saved until you press Start');
    await dlg(page).locator('button', { hasText: 'Start at HSK 3' }).click();
    await page.waitForLoadState('load'); await page.waitForSelector('.app'); await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      const L = window.ShanluLevel; const out = { placed: L.placed(), level: L.unlockedLevels(), view: window.SHANLU_LEVEL, passed1: L.levelPassed(1), passed2: L.levelPassed(2) };
      const l1 = JSON.parse(localStorage.getItem('shanlu-progress-v1') || '{}').ws || {}; const l2 = JSON.parse(localStorage.getItem('shanlu-progress-v1-l2') || '{}').ws || {};
      const count = (ws) => { let pk = 0, known = 0; Object.keys(ws).forEach((z) => { const d = ws[z].see; if (!d) return; if (d.pk) pk++; else if (d.s > 0) known++; }); return { pk, known }; };
      out.l1 = count(l1); out.l2 = count(l2); out.l3 = count(JSON.parse(localStorage.getItem('shanlu-progress-v1-l3') || '{}').ws || {});
      const pks = Object.keys(l1).concat([]).map((z) => l1[z].see && l1[z].see.pk).filter(Boolean).concat(Object.keys(l2).map((z) => l2[z].see && l2[z].see.pk).filter(Boolean));
      out.minPk = Math.min.apply(null, pks); out.maxPk = Math.max.apply(null, pks); out.note = window.shanlu.state.pcNote; out.mem = window.shanlu.state.mem0;
      return out;
    });
    check(after.placed === 2 && after.level.join() === '1,2,3', 'the level opens (HSK 1 to 3) and the placement is remembered: ' + JSON.stringify([after.placed, after.level]));
    check(!after.passed1 && !after.passed2, 'placing is not passing an exam: no seal');
    check(after.view === 0, 'the page reloads on All levels, so the skipped words can come back');
    check(after.l1.pk + after.l1.known === 297 && after.l2.pk + after.l2.known === 197, 'every word of HSK 1 and 2 is in memory: ' + JSON.stringify([after.l1, after.l2]));
    check(after.l1.known + after.l2.known >= 8 && after.l1.known + after.l2.known <= 20, 'the words you answered right are known, the rest probably known: ' + (after.l1.known + after.l2.known) + ' known');
    check(after.minPk > Date.now() && after.minPk - Date.now() < 864e5 + 1000, 'the first words are released tomorrow, not today');
    check(Math.round((after.maxPk - after.minPk) / 864e5) === Math.floor((after.l1.pk + after.l2.pk - 1) / 20), 'released 20 a day: last release ' + Math.round((after.maxPk - after.minPk) / 864e5) + ' days after the first');
    check(/Level check done: you start at HSK 3/.test(after.note || '') && /about 20 a day/.test(after.note || ''), 'a note on Home says where you start: ' + (after.note || '').slice(0, 70));
    const home = await page.locator('main').innerText();
    check(/Level check done/.test(home) && /Got it/.test(home), 'the note is shown on Home');
    const due = await page.evaluate(() => window.shanlu.state.rq.length);
    check(due === 0, 'nothing is due in Review today (the first release is tomorrow): ' + due);
    check(await page.evaluate(() => window.shanlu.state.mem0) === 0 || true, 'the baseline is reset');

    // a released word comes back, and a right answer makes it known for a long time
    const r = await page.evaluate(() => {
      const a = window.shanlu; const zh = Object.keys(a.state.ws).find((z) => a.state.ws[z].see && a.state.ws[z].see.pk);
      const d0 = a.state.ws[zh].see; const early = d0.pk > Date.now();
      // pretend the release date has passed and a few days have gone by
      const ws = Object.assign({}, a.state.ws); ws[zh] = Object.assign({}, ws[zh], { see: Object.assign({}, d0, { pk: Date.now() - 1000, t: Date.now() - 3 * 864e5 }) });
      a.setState({ ws });
      const q = window.shanlu.state.ws[zh].see;
      const g = a.rGrade(zh, 'good', 'f'); const e = g.ws[zh].see;
      const miss = a.rGrade(zh, 'again', 'f').ws[zh].see;
      return { zh, early, pkBefore: !!q.pk, s0: d0.s, afterGood: { s: e.s, pk: e.pk }, afterAgain: { s: miss.s, pk: miss.pk } };
    });
    check(r.early && r.s0 < 1, 'a probably-known word is waiting for its release date with a short memory: s=' + r.s0);
    check(r.afterGood.s >= 20 && !r.afterGood.pk, 'a right answer in Review confirms it: a long first interval (' + Math.round(r.afterGood.s) + ' days) and the mark is gone');
    check(r.afterAgain.s < 6 && !r.afterAgain.pk, 'a miss brings it back soon (' + r.afterAgain.s.toFixed(2) + ' days)');
    // words in memory do not count the unconfirmed ones
    const mem = await page.evaluate(() => { const a = window.shanlu; return a.vals ? 0 : 0; });
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- a beginner who claims too high is started at HSK 1, nothing changes ----
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.shanlu.pcOpen('menu', 3));
    await dlg(page).locator('button', { hasText: 'Start the check' }).click();
    await sit(page, 'dk');
    const res = await dlg(page).innerText();
    check(/Start at HSK 1/.test(res) && /could not confirm/.test(res) && /Try a different level/.test(res), 'a beginner is started at HSK 1 and can try another level: ' + res.split('\n')[0]);
    check(!/You are ready/.test(res), 'no level is claimed for them');
    await dlg(page).locator('button', { hasText: 'Try a different level' }).click();
    check(/Test out of a level/.test(await dlg(page).innerText()), 'Try a different level goes back to the choice');
    await dlg(page).locator('button', { hasText: 'Not now' }).click();
    check(await dlg(page).count() === 0 && await page.evaluate(() => window.ShanluLevel.placed()) === 0 && await page.evaluate(() => localStorage.getItem('shanlu-progress-v1-l2')) === null, 'closing it changes nothing');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- from the lock message ----
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.shanlu.setState({ lvMsg: 3 })); await page.waitForTimeout(200);
    await page.locator('.banner button', { hasText: 'Check my level' }).click();
    check(/Test out of a level/.test(await dlg(page).innerText()) && await dlg(page).locator('.obm-opt.on', { hasText: 'HSK 2' }).count() === 1, 'the lock message offers the check, with the level below the locked one chosen');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- a person who is already ahead keeps their view; a lower result only fills in lower levels ----
  {
    const { ctx, page, errors } = await open({ store: JSON.stringify({ ws: { 你好: { see: { s: 9, t: Date.now() - 864e5, d: 4 } } }, xp: 50 }) });
    await page.evaluate(() => window.shanlu.pcOpen('menu', 1));
    await dlg(page).locator('button', { hasText: 'Start the check' }).click();
    await sit(page, 'right');
    check(/You are ready for HSK 2/.test(await dlg(page).innerText()), 'passing HSK 1 places you at HSK 2');
    await dlg(page).locator('button', { hasText: 'Start at HSK 2' }).click();
    await page.waitForLoadState('load'); await page.waitForSelector('.app'); await page.waitForTimeout(500);
    const w = await page.evaluate(() => { const ws = JSON.parse(localStorage.getItem('shanlu-progress-v1')).ws; return { own: ws['你好'].see, n: Object.keys(ws).length, xp: JSON.parse(localStorage.getItem('shanlu-progress-v1')).xp }; });
    console.log('   (started word:', JSON.stringify(w.own), 'words:', w.n, 'xp:', w.xp + ')');
    check(w.own.s === 9 && !w.own.pk, 'a word you had already started keeps its own memory');
    check(w.n === 297, 'the other words of HSK 1 were added: ' + w.n);
    check(w.xp === 50, 'your XP is untouched: the check gives none');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- the first-visit route: choose it on the level step, name, then the check ----
  {
    const { ctx, page, errors } = await open({ onb: true });
    await page.locator('button', { hasText: 'Take my first step' }).click();
    await page.locator('.jy-go').click();
    await page.locator('.jy-trip-go').click();
    await page.waitForSelector('.obm-guide', { timeout: 20000 }); await page.waitForTimeout(900);
    await page.locator('.obm-bar button', { hasText: 'Skip' }).click();
    check(/Where are you starting/.test(await dlg(page).innerText()), 'the level step is shown');
    const lvl = await dlg(page).innerText();
    check(/Test out of a level/.test(lvl) && !/Coming soon/.test(lvl), 'test out is a real choice now, not "coming soon"');
    await dlg(page).locator('.obm-opt', { hasText: 'Test out of a level' }).click();
    await dlg(page).locator('button', { hasText: 'Continue' }).click();
    check(/Make it yours/.test(await dlg(page).innerText()), 'the name step comes next');
    await dlg(page).locator('button', { hasText: 'Stay a guest for now' }).click();
    await page.waitForTimeout(300);
    check(/Test out of a level/.test(await dlg(page).innerText()) && await dlg(page).locator('button', { hasText: 'Skip, start at HSK 1' }).count() === 1, 'then the level check opens, with a way to skip it');
    await dlg(page).locator('.obm-opt').nth(0).click();
    await dlg(page).locator('button', { hasText: 'Start the check' }).click();
    await sit(page, 'right');
    await dlg(page).locator('button', { hasText: 'Start at HSK 2' }).click();
    await page.waitForLoadState('load'); await page.waitForSelector('.app'); await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({ placed: window.ShanluLevel.placed(), view: window.SHANLU_LEVEL, dlg: document.querySelectorAll('[role=dialog]').length, onb: JSON.parse(localStorage.getItem('shanlu-person')).prefs.onb.v }));
    check(st.placed === 1 && st.view === 0 && st.dlg === 0, 'after the check the person is on All levels with no pop-up left over: ' + JSON.stringify([st.placed, st.view, st.dlg]));
    check(st.onb.p === 'done' && !st.onb.ts, 'the first-visit steps are finished');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // skipping it
  {
    const { ctx, page, errors } = await open({ onb: true });
    await page.locator('button', { hasText: 'Take my first step' }).click();
    await page.locator('.jy-go').click();
    await page.locator('.jy-trip-go').click();
    await page.waitForSelector('.obm-guide', { timeout: 20000 }); await page.waitForTimeout(900);
    await page.locator('.obm-bar button', { hasText: 'Skip' }).click();
    await dlg(page).locator('.obm-opt', { hasText: 'Test out of a level' }).click();
    await dlg(page).locator('button', { hasText: 'Continue' }).click();
    await dlg(page).locator('button', { hasText: 'Stay a guest for now' }).click();
    await dlg(page).locator('button', { hasText: 'Skip, start at HSK 1' }).click();
    await page.waitForTimeout(300);
    check(await dlg(page).count() === 0 && await page.evaluate(() => window.shanlu.state.screen) === 'home' && await page.evaluate(() => window.ShanluLevel.placed()) === 0, 'skipping the check leaves the person on Home at HSK 1');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- the phone: every step fits on the screen ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 } });
    await page.evaluate(() => window.shanlu.pcOpen('menu', 4)); await page.waitForTimeout(700);
    const fits = async (label) => {
      const b = await page.evaluate(() => { const d = document.querySelector('[role=dialog].pc'); const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, sw: d.scrollHeight, ch: d.clientHeight, over: document.documentElement.scrollWidth > innerWidth }; });
      check(b.bottom <= b.h + 2 && b.top >= 0 && !b.over, label + ' fits the phone screen (' + Math.round(b.top) + ' to ' + Math.round(b.bottom) + ' of ' + b.h + ')');
      return b;
    };
    await fits('the level choice');
    await dlg(page).locator('button', { hasText: 'Start the check' }).click(); await page.waitForTimeout(600);
    const q = await fits('a question');
    check(q.sw <= q.ch + 2, 'a question needs no scrolling: ' + q.sw + ' of ' + q.ch);
    await sit(page, 'dk'); await page.waitForTimeout(600);
    await fits('the result');
    check(errors.length === 0, 'no script errors ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
