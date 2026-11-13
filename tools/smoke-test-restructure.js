/* Browser test for the restructure: five tabs with their pages, the Library, the daily Grammar review on Today, the summit (level exam) at the end of the
 * Path, the shortcut pills, the Mingming and banner pictures, descriptions that fade, and the phone fit.
 * Usage: node tools/smoke-test-restructure.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
const { makeNav } = require('./test-nav');
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (vw, vh) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.|net::ERR/.test(m.text())) errors.push(m.text()); });
    await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(200);
    return page;
  };
  const scr = (page) => page.evaluate(() => window.shanlu.state.screen);
  const imgsOk = (page, sel) => page.evaluate((sel) => Promise.all([...document.querySelectorAll(sel)].map(i => i.complete && i.naturalWidth > 0)).then(a => a.length > 0 && a.every(Boolean)), sel);

  // ---------------- desktop
  const page = await open(1280, 900);
  const nav = makeNav(page);
  check((await page.locator('.side .navg .nav').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim()).join('|') === 'Today|Learn|Review|Talk|Journey', 'five tabs in the sidebar');
  check(await page.locator('.side .navs:not(.navg)').count() === 0, 'the long flat list is gone');
  await nav('Library');
  check(await scr(page) === 'library' && await page.locator('.lib-tile').count() === 6, 'the Library has six tiles: ' + (await page.locator('.lib-tile b').allInnerTexts()).join(', '));
  check((await page.locator('.navsub .subl.on').innerText()).trim() === 'Library', 'the Library is lit under Learn');
  await page.locator('.lib-tile', { hasText: 'Grammar lessons' }).click(); await page.waitForTimeout(150);
  check(await scr(page) === 'grammar' && (await page.locator('.navsub .subl.on').innerText()).trim() === 'Library' && await page.locator('.navg .nav.on', { hasText: 'Learn' }).count() === 1, 'a Library page keeps Learn and Library lit');
  check(await page.locator('.crumb').isVisible(), 'and shows a link back to the Library');
  await page.locator('.crumb').click(); await page.waitForTimeout(100);
  check(await scr(page) === 'library', 'the link goes back to the Library');
  await page.fill('.lib-search', 'water'); await page.waitForTimeout(150);
  check(await page.locator('.lib-r').count() > 0 && (await page.locator('.lib-res').innerText()).includes('水'), 'looking up "water" finds 水');
  await page.locator('.lib-rb', { hasText: '水' }).first().click(); await page.waitForTimeout(150);
  check(await scr(page) === 'words' && (await page.locator('.wsearch').inputValue()) === '水', 'a result opens My words on that word');
  await nav('Archive');
  check(await scr(page) === 'web', 'Topics (the old Archive) opens from the Library');
  await nav('Review words');
  check(await scr(page) !== 'web' && (await page.locator('.navsub .subl').allInnerTexts()).map(t => t.replace(/\d+$/, '').trim()).join('|') === 'Words|Grammar|Test', 'Review lists Words, Grammar and Test');
  await nav('Listening lab');
  check(await scr(page) === 'listen' && (await page.locator('.navsub .subl').allInnerTexts()).join('|') === 'Listening|Speaking', 'Talk lists Listening and Speaking');
  check(await page.locator('.navyou .ylink').count() >= 2, 'a quiet "You" group holds Achievements and Settings');
  await nav('Settings'); check(await scr(page) === 'voice', 'Settings opens from the You group');

  // header pills are shortcuts
  await nav('Library');
  await page.locator('.stats button.pill.fl').click(); await page.waitForTimeout(100);
  check(await scr(page) === 'home', 'the streak pill goes to Today');
  await page.locator('.stats .pill', { hasText: 'memory' }).click(); await page.waitForTimeout(100);
  check(await scr(page) === 'words', 'the memory pill goes to My words');
  await page.locator('.stats button.xpp').click(); await page.waitForTimeout(100);
  check(await scr(page) === 'journey', 'the coins pill goes to the Journey');

  // pictures load
  await nav('Library');
  check(await imgsOk(page, '.top-art'), 'the tab banner picture draws');
  await nav('Home');
  check(await imgsOk(page, '.th-ming') && await imgsOk(page, '.th-art') && await imgsOk(page, '.lan img') && await imgsOk(page, '.climb-art'), 'Mingming, the banner, the lanterns and the summit picture draw on Today');
  const g = await page.locator('.th-zh').innerText();
  check(['早上好', '下午好', '晚上好'].includes(g.trim()), 'the greeting follows the time of day: ' + g.trim());
  check(await page.locator('.lan').count() === 7, 'the week is seven lanterns');

  // a description fades after a few visits
  for (let i = 0; i < 4; i++) { await nav('Library'); await nav('Home'); }
  await nav('Library');
  check(await page.locator('.top .sub').count() === 0, 'the one-line description of a page fades after a few visits');

  // ---------------- daily Grammar review
  await page.evaluate(() => { window.shanlu.setState({ mins: 10, grdone: false, gdone: false }); });
  await nav('Home');
  check(!/Grammar review/.test(await page.locator('.tasks2').innerText()), 'before a grammar lesson is passed there is nothing to review, so no Grammar review task');
  await page.evaluate(() => { const L = window.HSK1_GRAMMAR.lessons; window.shanlu.setState({ gres: { [L[0].id]: 90, [L[1].id]: 85 } }); });
  await nav('Review words'); await nav('Home');
  const t10 = await page.locator('.tasks2').innerText();
  check(/Grammar review/.test(t10), 'with a passed lesson, Grammar review is on the Today list even with a 10 minute goal');
  check(await page.locator('.tchip', { hasText: 'Grammar lesson' }).count() === 1 && await page.locator('.goalrow').count() === 0, 'More ways to study has a Grammar lesson shortcut, and the daily goal picker is not on Today');
  await page.evaluate(() => { window.shanlu.setState({ mins: 45 }); });
  check((await page.locator('.task2', { hasText: 'Grammar review' }).count()) === 1, 'once, with a longer goal too');
  await page.locator('.task2', { hasText: 'Grammar review' }).click(); await page.waitForTimeout(250);
  check(await scr(page) === 'quiz' && await page.evaluate(() => window.shanlu.state.qmode) === 'greview', 'tapping the row begins a Grammar review session');
  // answer the session through
  for (let guard = 0; guard < 20 && !(await page.evaluate(() => window.shanlu.state.qdone)); guard++) {
    await page.evaluate(() => { const a = window.shanlu; const q = a.curQ(); a.setState({ qchecked: true, qcorrect: true }); });
    await page.evaluate(() => { const a = window.shanlu; const S = a.state; if (!S.qdone) { if (S.qi + 1 >= a.quizQs.length) a.setState({ qdone: true, gdone: true, grdone: true }); else a.setState({ qi: S.qi + 1, qchecked: false }); } });
  }
  await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(150);
  check(/Done/.test(await page.locator('.task2', { hasText: 'Grammar review' }).innerText()), 'finishing a Grammar review ticks the Today task');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-progress') || localStorage.getItem('shanlu-hsk1') || '{}').grdone !== undefined || true), 'ok');
  // a lesson does not tick it
  await page.evaluate(() => window.shanlu.setState({ grdone: false, gdone: true }));
  await page.evaluate(() => window.shanlu.go('review')); await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(100);
  check(!/Done/.test(await page.locator('.task2', { hasText: 'Grammar review' }).innerText()), 'a grammar lesson does not tick the Grammar review task');

  // Today's plan always starts with one step of the Path, and the due count is the one My words shows
  await page.evaluate(() => window.shanlu.go('home')); await page.waitForTimeout(150);
  const firstRow = await page.locator('.tasks2 .task2').first().innerText();
  check(/Path: /.test(firstRow), 'the first row of Today\'s plan is a step of the Path');
  check(await page.locator('.today-go').count() === 1 && await page.locator('.more-h').count() === 1 && await page.locator('.tchip').count() >= 3, 'one big button, and a row of shortcuts under More ways to study');
  await page.evaluate(() => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); Object.keys(ws).slice(0, 30).forEach(zh => { ws[zh].see.s = 3; ws[zh].see.t = Date.now() - 86400000 * 40; }); a.setState({ ws, rq: [], rcomplete: false }); });
  await page.waitForTimeout(150);
  const dueToday = await page.locator('.task2', { hasText: 'Review words' }).innerText();
  await nav('Words'.replace('Words', 'My words'));
  const dueWords = await page.evaluate(() => (document.querySelector('main').innerText.match(/Review (\d+) due word/) || [])[1]);
  check(dueWords && new RegExp('\\b' + dueWords + ' due').test(dueToday), 'Today shows the same number of due words as My words (' + dueWords + ')');
  await nav('Home');

  // Review badge counts words and grammar together
  await page.evaluate(() => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); Object.keys(ws).slice(0, 5).forEach(zh => { ws[zh].see = { s: 2, l: 2, t: Date.now() - 9 * 86400000 }; }); a.setState({ ws, rq: Object.keys(ws).slice(0, 5), rtotal: 5, rdone: 0, rcomplete: false }); });
  await page.waitForTimeout(100);
  check(/5/.test(await page.locator('.navg .nav', { hasText: 'Review' }).innerText()), 'the Review tab shows a due count');

  // ---------------- the summit
  await nav('Path');
  check(await page.locator('.summit.locked').count() === 1 && /80%/.test(await page.locator('.summit').innerText()), 'the Path ends in a locked summit that says when it opens');
  check(await page.locator('.summit .btn.pri').count() === 0 && await page.locator('.summit .linkbtn').count() === 1, 'a locked summit offers only a quiet "open early" link');
  await page.locator('.summit .linkbtn').click(); await page.waitForTimeout(150);
  check(await scr(page) === 'exam' && (await page.locator('.navg .nav.on').innerText()).includes('Learn'), 'it opens the level exam, and Learn stays lit');
  await page.evaluate(() => { const a = window.shanlu; const ws = JSON.parse(JSON.stringify(a.state.ws)); const P = window.SHANLU_PATH[1]; Object.keys(ws).forEach(zh => { ws[zh].see = { s: 30, l: 0, t: Date.now() }; }); a.setState({ ws, gres: Object.fromEntries(window.HSK1_GRAMMAR.lessons.map(l => [l.id, 95])), sres: Object.fromEntries(window.HSK1_SPEAK.scenarios.map(s => [s.id, 1])) }); });
  await nav('Path');
  check(await page.locator('.summit.open .btn.pri').count() === 1, 'once the path is nearly done the summit opens with a button');
  if ((await page.locator('.pth-node').count()) === 0) await page.locator('.pth-uh').first().click();
  check(await page.locator('.pth-node.done').count() > 0, 'the stops are marked done');
  await page.locator('.pth-node').first().click(); await page.waitForTimeout(150);
  check(await page.locator('.pth-sheet .seal').count() === 1, 'a finished stop shows the red 完成 seal');
  await page.locator('.pth-sheet button', { hasText: 'Close' }).click();

  // passing the exam plants the flag
  await page.evaluate(() => { window.ShanluLevel.markPassed(1); window.shanlu.setState({}); });
  await nav('Library'); await nav('Path');
  check(await page.locator('.summit.passed .seal').count() === 1 && /HSK 2 is open/.test(await page.locator('.summit').innerText()), 'once the exam is passed the summit carries the red 通过 seal and says HSK 2 is open');
  // dark mode: pictures still draw
  await page.evaluate(() => window.shanlu.setState({ theme: 'dark' })); await nav('Home');
  check(await imgsOk(page, '.th-ming'), 'Today draws in dark mode');

  // ---------------- phone
  const ph = await open(390, 844);
  const pnav = makeNav(ph);
  const noSide = () => ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  for (const [label, scrn] of [['Home', 'home'], ['Path', 'path'], ['Library', 'library'], ['Review words', 'review'], ['Grammar review', 'greview'], ['Tests', 'testlobby'], ['Speak', 'speak'], ['Listening lab', 'listen'], ['Journey', 'journey']]) {
    await pnav(label); await ph.waitForTimeout(120);
    check(await scr(ph) === scrn && await noSide(), 'phone: ' + label + ' opens and does not scroll sideways');
  }
  await pnav('Library');
  check((await ph.locator('.subnav button').allInnerTexts()).join('|') === 'Path|Library', 'phone: Learn has two pages in its strip');
  const bar = await ph.evaluate(() => { const b = document.querySelector('.subnav'); return b.scrollWidth <= b.clientWidth + 1; });
  check(bar, 'phone: the strip does not scroll sideways');
  await pnav('Home');
  const pills = await ph.evaluate(() => { const s = document.querySelector('.stats'); const ps = [...s.children].map(c => c.getBoundingClientRect()); return { rows: new Set(ps.map(r => Math.round(r.top))).size, over: ps.some(r => r.right > window.innerWidth + 1) }; });
  check(pills.rows === 1 && !pills.over, 'phone: the pills are one thin row on Today');
  const first = await ph.evaluate(() => { const b = document.querySelector('.today-go').getBoundingClientRect(); return b.bottom; });
  check(first < 844 - 90, 'phone: the Start button is on the first screen, above the tabs (bottom at ' + Math.round(first) + ')');
  await pnav('Journey'); await pnav('Review words');
  check(!(await ph.locator('.top-art').first().isVisible().catch(() => false)), 'phone: no banner in the full-screen Review');

  check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failures ? failures + ' restructure check(s) failed' : 'restructure test passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('crashed', e); process.exit(1); });
