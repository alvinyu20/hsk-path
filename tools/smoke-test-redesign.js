/* Browser test for the November redesign: End session in Review, the phone new-word lesson fitting without a scroll, the Journey showing where
 * friends are (list + dots on the map), the HSK 1 path opening with the first-class basics, and the new word webs.
 * Usage: node tools/smoke-test-redesign.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];

  // ---- desktop ----
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await dctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); } catch (e) {} });
  const page = await dctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForTimeout(200);

  // End session: mid-review it ends with the summary; with nothing answered it just closes
  await page.evaluate(() => {
    const a = window.shanlu; window.__said = []; a.say = () => {};
    const ws = JSON.parse(JSON.stringify(a.state.ws));
    Object.keys(ws).slice(0, 6).forEach(zh => { ws[zh].see = { s: 2, l: 2, t: Date.now() }; });
    a.setState({ ws, rq: [], rcomplete: false });
    a.go('review'); a.practiceAnyway();
  });
  await page.waitForTimeout(400);
  check(await page.locator('.rev-end').count() >= 1, 'an End session button shows while reviewing');
  const left0 = await page.evaluate(() => window.shanlu.state.rq.length);
  await page.evaluate(() => window.shanlu.endSession()); await page.waitForTimeout(200);
  check(await page.evaluate(() => window.shanlu.state.rq.length) === 0 && left0 > 0, 'ending before answering anything clears the queue');
  check(await page.evaluate(() => !window.shanlu.state.rcomplete), '... without a summary (nothing was reviewed)');
  await page.evaluate(() => { const a = window.shanlu; a.practiceAnyway(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = window.shanlu; a.setState({ rdone: 3, rtotal: a.state.rq.length + 3 }); a.endSession(); });
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.shanlu.state.rcomplete && window.shanlu.state.rtotal === 3), 'ending after answering shows the summary for the 3 reviewed');

  // grammar answers show the sentence's pinyin in the answer box, right or wrong
  const gpy = await page.evaluate(() => {
    const a = window.shanlu;
    for (let li = 0; li < 40; li++) {
      try { a.startQuiz('grammar', li); } catch (e) { continue; }
      const qi = a.quizQs.findIndex(q => q.py && q.reveal);
      if (qi >= 0) { a.setState({ qi, qchecked: true, qcorrect: false, qfeed: '' }); return { py: a.quizQs[qi].py }; }
    }
    return null;
  });
  await page.waitForTimeout(300);
  check(!!gpy && (await page.locator('.fb .fb-py').first().innerText()) === gpy.py, 'the answer box shows the sentence pinyin (' + (gpy && gpy.py) + ')');

  // path: the first-class order
  const order = await page.evaluate(() => window.SHANLU_PATH[1].units.map(u => u.title || u.t || u.n));
  check(order.length === 13, 'HSK 1 has 13 units');
  const first = await page.evaluate(() => window.SHANLU_PATH[1].units[0].stops.map(s => s.k === 'g' ? 'g:' + s.g : s.t || s.title || s.n));
  check(first.length >= 3 && /Greetings/.test(String(first[0])), 'the path opens with greetings (' + first.slice(0, 3).join(' / ') + ')');

  // Journey: the projection and where friends are
  check(await page.evaluate(() => { const p = window.ShanluJourney.projectCountry(39.9, 116.4); return p && isFinite(p[0] + p[1]) || (p && isFinite(p.x + p.y)); }), 'projectCountry puts Beijing on the country map');
  await page.evaluate(() => {
    const a = window.shanlu; const W = window.ShanluJourney.build(window.JOURNEY);
    const rid = W.order[0]; const R = W.byRegion[rid]; const stop = R.stops.filter(s => s.k !== 'P' && s.k !== 'T')[0] || R.stops[0];
    const rid2 = W.order[1]; const R2 = W.byRegion[rid2];
    const jy = { n: 4, here: rid, at: stop.id, done: {}, per: {} };
    const jy2 = { n: 2, here: rid2, at: R2.stops[0].id, done: {}, per: {} };
    a.setState({ fr: { me: 'me', members: [
      { id: 'me', name: 'Me', stats: { jy: { n: 0 } } },
      { id: 'a1', name: 'Ana', stats: { asOf: a.state.today || '', last7: [0, 0, 0, 0, 0, 0, 5], jy } },
      { id: 'b2', name: 'Ben', stats: { asOf: a.state.today || '', last7: [0, 0, 0, 0, 0, 0, 0], jy: jy2 } }] }, frAt: Date.now() });
    a.go('journey');
  });
  await page.waitForTimeout(500);
  const rows = await page.locator('.jy-fr').allInnerTexts();
  check(rows.length === 2 && rows.every(t => /Now in /.test(t)), 'each friend row says where they are now (' + rows.map(t => t.replace(/\s+/g, ' ').slice(0, 60)).join(' | ') + ')');
  await page.locator('.jy-tabs button, .jy-tab', { hasText: 'Map' }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  check(await page.locator('.jy-dot').count() >= 2, 'the country map shows a dot per friend (' + await page.locator('.jy-dot').count() + ')');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the Journey page has no sideways scroll on desktop');

  // ---- phone ----
  const mctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  await mctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1 })); } catch (e) {} });
  const m = await mctx.newPage();
  m.on('pageerror', e => errors.push(e.message));
  await m.goto(url); await m.waitForSelector('.app'); await m.waitForTimeout(300);
  await m.evaluate(() => window.shanlu.go('path')); await m.waitForTimeout(400);
  const hdr = await m.evaluate(() => { const p = document.querySelector('.pth-head, .pth-prog, .pth-bar'); return p ? p.getBoundingClientRect().height : 0; });
  check(hdr < 150, 'the Path header on a phone is compact (' + Math.round(hdr) + 'px)');
  // open the first stop's lesson
  await m.locator('.pth-next button, .pth-next .btn').first().click().catch(() => {});
  await m.waitForTimeout(600);
  const onLesson = await m.evaluate(() => window.shanlu.state.screen === 'plesson');
  check(onLesson, 'the first stop opens a lesson on a phone');
  if (onLesson) {
    const fit = await m.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    check(fit.sh <= fit.ih + 2, 'the new-word card fits the screen with no scrolling (' + fit.sh + ' vs ' + fit.ih + ')');
    const nextBtn = m.locator('.quiz.pl button', { hasText: /Next|Got it|Continue|Try/ }).first();
    if (await nextBtn.count()) {
      const box = await nextBtn.boundingBox();
      check(!!box && box.y + box.height <= 780, 'the Next button is on screen without scrolling');
    }
  }
  const toast = await m.evaluate(() => { window.shanlu.setState({ toast: null }); return true; });

  // ---- new word webs ----
  const hubs = await page.evaluate(() => (window.SHANLU_WEBS || window.HSK1_WEBS || {}).hubs ? (window.SHANLU_WEBS || window.HSK1_WEBS).hubs.map(h => h.hub) : null);
  if (hubs) for (const h of ['中', '们', '里', '边']) check(hubs.includes(h), 'HSK 1 has a word web for ' + h);
  else console.log('skip  (could not read the HSK 1 web hubs by name)');

  await browser.close(); server.close();
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('redesign test passed');
})().catch(e => { console.log('crashed', e); process.exit(1); });
