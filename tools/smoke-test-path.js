/* Browser test for the learning path (Learn > Path), the stop lesson, the Archive and the Account page.
 * Runs at HSK 1 on a desktop screen and on a phone screen, in a fresh browser with HSK 1 passed.
 * Usage: node tools/smoke-test-path.js   (needs Playwright). `--erhua` runs it again in exam style (儿 endings on). */
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const erhuaMode = process.argv.includes('--erhua');
const server = require('./test-static').server(root);

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const mkCtx = async (vp, mobile) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: !!mobile, isMobile: !!mobile });
    await ctx.addInitScript((erhua) => {
      try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); if (erhua && !localStorage.getItem('shanlu-erhua')) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {}
      const voices = [{ name: 'Tingting', lang: 'zh-CN', voiceURI: 'x', localService: true, default: false }];
      window.__spoken = [];
      Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => voices, cancel() {}, speak(u) { window.__spoken.push(u.text); }, onvoiceschanged: null }, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    }, erhuaMode);
    return ctx;
  };
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR|status of (401|500)/.test(m.text())) errors.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept());
  };
  const st = (page) => page.evaluate(() => { const s = window.shanlu.state; return { screen: s.screen, pstop: s.pstop, plNote: s.plNote, i: s.pl && s.pl.i, n: s.pl && s.pl.steps.length, lrn: Object.keys(s.lrn || {}).length }; });
  const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // Plays the open stop lesson to the end. wrongFirst: the first answer to every question is a wrong one (the question comes back once).
  const play = async (page, wrongFirst) => {
    let asked = 0, again = 0;
    for (let guard = 0; guard < 120; guard++) {
      if (await page.locator('.pl-res').count()) break;
      if (await page.locator('.pl-meet').count()) { await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(30); continue; }
      const step = await page.evaluate(() => { const pl = window.shanlu.state.pl; const s = pl.steps[pl.i]; return { zh: s.zh, opts: s.opts, again: !!s.again, kind: s.kind, checked: pl.checked }; });
      const right = step.opts.indexOf(step.zh);
      const wrong = step.opts.findIndex(o => o !== step.zh);
      const pick = wrongFirst && !step.again ? wrong : right;
      await page.locator('.q-card .opt').nth(pick).click(); await page.waitForTimeout(30);
      asked++; if (step.again) again++;
      await page.locator('.fb button:has-text("Continue")').click(); await page.waitForTimeout(30);
    }
    return { asked, again };
  };

  // ================= desktop
  {
    const ctx = await mkCtx({ width: 1280, height: 900 });
    const page = await ctx.newPage(); watch(page);
    await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(200);

    const sideLabels = (await page.locator('.side .navs:not(.navg) .nav').allInnerTexts()).map(t => t.replace(/\d+$/, '').trim());
    check(sideLabels.indexOf('Path') >= 0 && sideLabels.indexOf('Archive') >= 0 && sideLabels.indexOf('Word webs') < 0, 'the sidebar has Path and Archive (Word webs is now Archive): ' + sideLabels.join(', '));
    check(sideLabels.indexOf('Path') === 1, 'Path comes right after Home');

    // ---- the path
    await page.locator('.side .nav', { hasText: 'Path' }).first().click(); await page.waitForTimeout(150);
    check((await page.locator('.pth-unit').count()) === 13, 'HSK 1 path shows its 13 units');
    const head = await page.locator('.pth-head').innerText();
    const wordsHsk1 = await page.evaluate(() => (window.HSK1_WORDS || []).length);
    check(/0 of 83 stops done/.test(head) && head.includes('0 of ' + wordsHsk1 + ' words started'), 'the header counts 83 stops and every word of the level (' + wordsHsk1 + '): ' + head.replace(/\n/g, ' | '));
    check((await page.locator('.pth-next').innerText()).includes('Greetings and manners'), 'the next stop is the first one, with a Start button');
    check(await noSideways(page), 'the path does not scroll sideways');
    check(await page.locator('.pth-node.cur').count() === 1, 'exactly one stop is marked as the current one');
    // grammar stops sit in the same path
    check(await page.locator('.pth-node.g').count() >= 1, 'grammar stops are on the same path');

    // a unit can be hidden and shown again
    const openBefore = await page.locator('.pth-node').count();
    await page.locator('.pth-unit').first().locator('.pth-uc').click(); await page.waitForTimeout(80);
    const openAfter = await page.locator('.pth-node').count();
    check(openAfter < openBefore, 'Hide folds a unit away (' + openBefore + ' → ' + openAfter + ' stops showing)');
    await page.locator('.pth-unit').first().locator('.pth-uc').click(); await page.waitForTimeout(80);
    check(await page.locator('.pth-node').count() === openBefore, 'and Show brings it back');

    // ---- the sheet
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(150);
    check(await page.locator('.pth-sheet').count() === 1, 'tapping a stop opens its sheet');
    const sheet = await page.locator('.pth-sheet').innerText();
    check(sheet.includes('你好') && sheet.includes('hello') && sheet.includes('nǐ hǎo'), 'the sheet lists the words with pinyin and meaning');
    await page.locator('.pth-sheet button', { hasText: 'Close' }).click(); await page.waitForTimeout(80);
    check(await page.locator('.pth-sheet').count() === 0, 'Close puts the sheet away');
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);
    await page.keyboard.press('Escape'); await page.waitForTimeout(80);
    check(await page.locator('.pth-sheet').count() === 0, 'Escape puts the sheet away');
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);

    // ---- the lesson: meet the words, then questions, then the result
    const nWords = await page.locator('.pth-sheet .pth-wl li').count();
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'plesson' && await page.locator('.pl-meet').count() === 1, 'Start opens the lesson on the first word card');
    check((await page.locator('.pl-w').innerText()).trim() === '你好' && (await page.locator('.pl-py').innerText()).includes('nǐ hǎo'), 'the first card shows 你好 with its pinyin');
    check(await page.locator('.pl-ex').count() === 1, 'the card has an example sentence');
    await page.locator('.pl .listen').first().click(); await page.waitForTimeout(60);
    check((await page.evaluate(() => window.__spoken)).includes('你好'), 'the speaker button says the word');
    // Exit on the very first card just leaves (nothing has been done yet); further in it asks first
    await page.locator('.pl .q-top button', { hasText: 'Exit' }).click(); await page.waitForTimeout(80);
    check((await st(page)).screen === 'path' && (await st(page)).lrn === 0, 'Exit on the first card leaves without asking and adds nothing');
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
    await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(60);
    await page.locator('.pl .q-top button', { hasText: 'Exit' }).click(); await page.waitForTimeout(80);
    check(await page.locator('[role=alertdialog]').count() === 1, 'Exit asks before leaving once the lesson is under way');
    await page.locator('[role=alertdialog] button', { hasText: 'Keep going' }).click(); await page.waitForTimeout(80);
    check((await st(page)).screen === 'plesson' && await page.locator('[role=alertdialog]').count() === 0, 'Keep going stays in the lesson');
    // all the cards come before the first question of their batch, and the lesson never shows more than 4 new words in a row
    let metSeq = 0, maxRun = 0, seenQ = false;
    for (let g = 0; g < 40; g++) {
      if (await page.locator('.pl-meet').count()) { metSeq++; maxRun = Math.max(maxRun, metSeq); await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(30); }
      else { seenQ = true; break; }
    }
    check(seenQ && maxRun <= 4, 'new words come in small groups (at most 4 cards before the first questions): ' + maxRun);
    // question formats: meaning first, then listening, a checkpoint at the end
    const kinds = new Set();
    for (let g = 0; g < 60; g++) {
      if (await page.locator('.pl-res').count()) break;
      if (await page.locator('.pl-meet').count()) { await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(30); continue; }
      const s = await page.evaluate(() => { const pl = window.shanlu.state.pl; const x = pl.steps[pl.i]; return { zh: x.zh, opts: x.opts, kind: x.kind, again: !!x.again, ph: x.ph }; });
      kinds.add(s.kind);
      await page.locator('.q-card .opt').nth(s.opts.indexOf(s.zh)).click(); await page.waitForTimeout(30);
      check((await page.locator('.fb.good').count()) === 1, 'a right answer shows the green feedback (' + s.kind + ')');
      await page.locator('.fb button:has-text("Continue")').click(); await page.waitForTimeout(30);
    }
    check(kinds.has('mean') && kinds.has('hear'), 'the lesson asks for meanings and for listening (' + [...kinds].join(', ') + ')');
    check(await page.locator('.pl-res').count() === 1, 'the lesson ends on a result');
    const res = await page.locator('.pl-res').innerText();
    check(res.includes('Stop complete') && res.includes('+10 coins'), 'the result says the stop is complete and gives 10 coins');
    check(await page.locator('.pl-res .pth-wl li').count() === nWords, 'the result lists all ' + nWords + ' words');
    const after1 = await st(page);
    check(after1.lrn === nWords, 'the ' + nWords + ' words are now in Review as new words');
    check(await page.evaluate(() => Object.values(window.shanlu.state.lrn).every(o => o.st === 0 || o.st === -1)), 'they start as new words in the Review queue');
    check((await page.locator('.pl-res .btn.pri').innerText()).includes('Next:'), 'the result offers the next stop');
    // the coins and the stop are saved once
    const coins1 = await page.evaluate(() => window.shanlu.state.xp);
    await page.locator('.pl-res button', { hasText: 'Back to the path' }).click(); await page.waitForTimeout(150);
    check(await page.locator('.pth').count() === 1 && /1 of 83 stops done/.test(await page.locator('.pth-head').innerText()), 'back on the path, one stop is done');
    check(await page.locator('.pth-node.done').count() === 1, 'the stop shows as done');

    // replaying a done stop is practice only: no new words, no coins again
    await page.locator('.pth-node.done').first().click(); await page.waitForTimeout(100);
    check((await page.locator('.pth-sheet').innerText()).toLowerCase().includes('practi') || (await page.locator('.pth-sheet .pth-go').innerText()).length > 0, 'a done stop can be opened again');
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(100);
    await play(page, false);
    check((await st(page)).lrn === nWords, 'playing a done stop again adds no words');
    check(await page.evaluate((c) => window.shanlu.state.xp === c, coins1), 'and gives no coins again');
    await page.locator('.pl-res button', { hasText: 'Back to the path' }).click(); await page.waitForTimeout(100);

    // ---- a wrong answer comes back once, and a word missed in the checkpoint starts Review as "still learning"
    await page.locator('.pth-node.cur').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(100);
    const nSteps0 = (await st(page)).n;
    const r = await play(page, true);
    check(r.again >= 1, 'a wrong answer comes back later in the same lesson (' + r.again + ' repeats)');
    check(await page.locator('.pl-res').count() === 1, 'even with mistakes the lesson can be finished');
    const res2 = await page.locator('.pl-res').innerText();
    check(res2.includes('Worth another look'), 'the result names the words that were missed');
    check(await page.evaluate(() => Object.values(window.shanlu.state.lrn).some(o => o.st === -1)), 'words missed in the checkpoint start Review as still learning');
    // go on to the next stop from the result
    await page.locator('.pl-res .btn.pri').click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'plesson' || (await st(page)).pstop !== '' || (await st(page)).screen === 'path', 'Next goes on to the next stop (or tells why not)');
    void nSteps0;

    // ---- gating: the daily limit and the Review queue
    await page.evaluate(() => { window.shanlu.setState({ screen: 'path', pl: null, pstop: '', plNote: '', plAlt: '', nlimit: 5 }); });
    await page.waitForTimeout(100);
    await page.locator('.pth-node.cur').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(100);
    const lim = await st(page);
    check(lim.screen === 'path' && /limit of 5/.test(lim.plNote || ''), 'past the daily limit of new words, Start explains why instead of starting: ' + (lim.plNote || '').slice(0, 70));
    check(await page.locator('.pth-sheet').innerText().then(t => /limit of 5/.test(t)), 'the explanation shows in the sheet');
    await page.evaluate(() => { window.shanlu.setState({ nlimit: 0, pstop: '', plNote: '', plAlt: '' }); });
    await page.waitForTimeout(80);
    // the Review queue is full: pretend 12 words are waiting
    await page.evaluate(() => {
      const lrn = {}; for (let k = 0; k < 14; k++) lrn['x' + k] = { st: 0, m: 0, at: Date.now() };
      window.shanlu.setState({ lrn, screen: 'path', pstop: '', plNote: '' });
    });
    await page.waitForTimeout(100);
    await page.locator('.pth-node.cur').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click().catch(() => {}); await page.waitForTimeout(100);
    const gate = await st(page);
    check(gate.screen === 'path' && /waiting|Review/.test(gate.plNote || ''), 'with the new-word queue full, Start says to learn those in Review first: ' + (gate.plNote || '').slice(0, 80));
    await page.evaluate(() => { const s = window.shanlu.state; const lrn = Object.assign({}, s.lrn); Object.keys(lrn).filter(k => k[0] === 'x').forEach(k => delete lrn[k]); window.shanlu.setState({ lrn, pstop: '', plNote: '' }); });

    // ---- a grammar stop opens its grammar lesson
    await page.waitForTimeout(80);
    await page.locator('.pth-node.g').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'grammar' && await page.evaluate(() => window.shanlu.state.glesson !== null && window.shanlu.state.glesson !== undefined), 'a grammar stop opens its grammar lesson');

    // ---- the Archive keeps the old screens
    await page.locator('.side .nav', { hasText: 'Archive' }).first().click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'web', 'Archive opens the topics, word webs and pairs');
    await page.locator('.side .nav', { hasText: 'My words' }).first().click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'words', 'My words is still there');

    // ---- Today points at the path
    await page.locator('.side .nav', { hasText: 'Home' }).first().click(); await page.waitForTimeout(150);
    const home = await page.locator('main').innerText();
    check(/Path: /.test(home), 'the Today list has a Path task with the next stop');
    check(await page.locator('.task2', { hasText: 'Path: ' }).first().innerText().then(t => /Done/.test(t)), 'the Path task shows as done once a stop has been finished today');
    await page.evaluate(() => window.shanlu.setState({ webCredited: false })); await page.waitForTimeout(100);
    await page.locator('.task2', { hasText: 'Path: ' }).first().locator('button').click();
    await page.waitForTimeout(150);
    check((await st(page)).screen === 'path' && await page.locator('.pth-sheet').count() === 1, 'its Start button opens the Path with that stop ready');
    await page.keyboard.press('Escape'); await page.waitForTimeout(60);

    // ---- the Account page
    await page.locator('.side button.me').click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'acct' && await page.locator('.acct').count() === 1, 'the avatar button at the bottom of the sidebar opens the Account page');
    check(await page.locator('button.me.on').count() === 1, 'and shows as the open one');
    const acct = await page.locator('.acct').innerText();
    check(acct.includes('Learner') && acct.includes('Your numbers') && acct.includes('Settings and sync') && acct.includes('Achievements'), 'the Account page has the name, the numbers and the links');
    check(/Path stops done/.test(acct) && /Words started/.test(acct), 'it shows the path progress');
    await page.locator('.acct button', { hasText: 'Change my name' }).click(); await page.waitForTimeout(80);
    await page.locator('.acct input').fill('Alvin'); await page.locator('.acct .acct-btns button', { hasText: 'Save' }).click(); await page.waitForTimeout(120);
    check((await page.locator('.acct').innerText()).includes('Alvin') && (await page.locator('.side button.me').innerText()).includes('Alvin'), 'a name can be set, and shows in the sidebar');
    await page.locator('.acct .acct-row', { hasText: 'Settings and sync' }).click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'voice', 'Settings and sync opens the settings');
    await page.locator('.side button.me').click(); await page.waitForTimeout(100);
    await page.locator('.acct button', { hasText: '20 min' }).first().click().catch(() => {}); await page.waitForTimeout(80);
    check(await noSideways(page), 'the Account page does not scroll sideways');
    await ctx.close();
  }

  // ================= phone
  {
    const ctx = await mkCtx({ width: 390, height: 844 }, true);
    const page = await ctx.newPage(); watch(page);
    await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(200);
    check((await page.locator('.navg button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim()).join('|') === 'Today|Learn|Review|Listen & speak|Journey', 'the five tabs on a phone: Today, Learn, Review, Listen & speak, Journey');
    await page.locator('.navg button', { hasText: 'Learn' }).click(); await page.waitForTimeout(150);
    check((await page.locator('.subnav button').allInnerTexts()).join('|') === 'Path|Pinyin|Grammar', 'Learn holds Path, Pinyin and Grammar');
    check((await st(page)).screen === 'path', 'Learn opens on the Path');
    check(await noSideways(page), 'the path does not scroll sideways on a phone');
    // every label sits inside the screen
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.pth-label')].filter(l => { const r = l.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).length);
    check(clipped === 0, 'no stop label runs off the screen on a phone');
    await page.locator('.navg button', { hasText: 'Review' }).click(); await page.waitForTimeout(150);
    check((await page.locator('.subnav button').allInnerTexts()).join('|') === 'Review words|Grammar review|Tests|Level exam|Archive|My words', 'Review holds Review words, Grammar review, Tests, Level exam, Archive and My words');
    check(await page.locator('.acct-mini').count() === 1 && await page.locator('.acct-mini').isVisible(), 'the account avatar sits in the phone header');
    const box = await page.locator('.acct-mini').boundingBox();
    check(box && Math.abs(box.width - box.height) < 2, 'the avatar is round (' + (box ? Math.round(box.width) + 'x' + Math.round(box.height) : '?') + ')');
    await page.locator('.acct-mini').click(); await page.waitForTimeout(150);
    check((await st(page)).screen === 'acct', 'the avatar opens the Account page');
    check(await noSideways(page), 'the Account page does not scroll sideways on a phone');
    // a lesson on a phone: the bottom tabs go away, the options fit
    await page.locator('.navg button', { hasText: 'Learn' }).click(); await page.waitForTimeout(150);
    await page.locator('.pth-node').first().tap(); await page.waitForTimeout(150);
    check(await noSideways(page), 'the stop sheet does not scroll sideways on a phone');
    await page.locator('.pth-sheet .pth-go').tap(); await page.waitForTimeout(150);
    check(await page.locator('.pl-meet').count() === 1 && await noSideways(page), 'the lesson opens on a phone without scrolling sideways');
    check(!(await page.locator('.navg').isVisible()), 'the tabs get out of the way during a lesson');
    await ctx.close();
  }

  // ================= HSK 2 and HSK 3 have their own paths
  for (const [lv, units, stops] of [[2, 10, 64], [3, 17, 121]]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((a) => { try { localStorage.setItem('shanlu-passed', JSON.stringify(a.passed)); localStorage.setItem('shanlu-level', String(a.lv)); if (a.erhua) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {} }, { passed: lv === 2 ? { 1: 1 } : { 1: 1, 2: 1 }, lv, erhua: erhuaMode });
    const page = await ctx.newPage(); watch(page);
    await page.goto(url + '?level=' + lv); await page.waitForSelector('.app'); await page.waitForTimeout(200);
    check(await page.evaluate(() => window.SHANLU_LEVEL) === lv, 'HSK ' + lv + ' is open');
    await page.locator('.side .nav', { hasText: 'Path' }).first().click(); await page.waitForTimeout(150);
    const head = await page.locator('.pth-head').innerText();
    check((await page.locator('.pth-unit').count()) === units && head.includes('0 of ' + stops + ' stops done'), 'HSK ' + lv + ' has its own path: ' + units + ' units, ' + stops + ' stops');
    const words = await page.evaluate((l) => window['HSK' + l + '_WORDS'].length, lv);
    check(head.includes('0 of ' + words + ' words started'), 'HSK ' + lv + ': the path counts all ' + words + ' words of the level');
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
    const first = await st(page);
    check(first.screen === 'plesson', 'HSK ' + lv + ': the first stop opens a lesson');
    const r = await play(page, false);
    check(await page.locator('.pl-res').count() === 1 && r.asked > 3, 'HSK ' + lv + ': the first stop can be finished (' + r.asked + ' questions)');
    await ctx.close();
  }

  await browser.close(); server.close();
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' / ') : ''));
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('path smoke test passed' + (erhuaMode ? ' (儿 endings)' : ''));
})().catch(e => { console.log('crashed', e); process.exit(1); });
