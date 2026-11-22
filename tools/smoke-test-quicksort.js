/* Browser test for the quick sort (N6): "I know a little" in the first-visit flow opens it; Know it / Not yet with tap, keys and swipe;
 * every 4th "Know it" gets a meaning check (a miss turns it into "Not yet"); five "Not yet" in a row ends it; saving marks the known words
 * (probably known, or known when checked), Path stops whose words are all known count as done, and Start here begins at the first new word.
 * Also the Settings button next to "Check my level". Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-quicksort.js */
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
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 }, hasTouch: !!opts.touch });
    await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await ctx.addInitScript((o) => { window.SHANLU_MUTE_SFX = true; window.SHANLU_JY_FIRST = 'sichuan'; window.SHANLU_AUTO_SHARE = 0; if (o.onb) window.SHANLU_ONBOARDING = 1; }, { onb: !!opts.onb });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const qs = (page) => page.evaluate(() => { const q = window.shanlu.state.qs; return q ? { step: q.step, i: q.i, n: q.deck.length, zh: q.deck[q.i], marks: q.marks, chk: q.chk } : null; });
  const answerCheck = async (page, right) => {
    const q = await qs(page); const idx = q.chk.opts.findIndex(o => o.ok === right);
    await page.locator('.qs .obm-opts button').nth(idx).click();
  };

  // ---- the first-visit flow: "I know a little" opens the quick sort ----
  {
    const { ctx, page, errors } = await open({ onb: true });
    await page.locator('button', { hasText: 'Take my first step' }).click();
    await page.locator('.jy-go').click(); await page.locator('.jy-trip-go').click(); await page.locator('.jy-host-go').click();
    await page.waitForSelector('.obm-guide'); await page.locator('.obm-bar button', { hasText: 'Skip' }).click();
    check(/one-minute sort/.test(await page.locator('.obm-opt', { hasText: 'I know a little' }).innerText()), '"I know a little" says it opens a one-minute sort');
    await page.locator('.obm-opt', { hasText: 'I know a little' }).click();
    await page.locator('button', { hasText: /^\s*Continue\s*$/ }).click();
    await page.locator('button', { hasText: 'Stay a guest for now' }).click(); await page.waitForTimeout(300);
    let q = await qs(page);
    check(q && q.step === 'intro' && q.n === 30 && /Quick sort/.test(await page.locator('.qs').innerText()), 'after the name step the quick sort opens, with 30 words');
    check(/Skip, start from the first words/.test(await page.locator('.qs').innerText()), 'it can be skipped');
    await page.locator('.qs button', { hasText: /^\s*Start\s*$/ }).click();
    q = await qs(page);
    const first = q.zh;
    check(q.step === 'card' && (await page.locator('.qs .pc-zh').innerText()).trim() === first, 'the first card shows the first word on the Path: ' + first);
    check(await page.locator('.qs .pc-py').count() === 0, 'no pinyin on the card (the meaning has to come from you)');
    // know the first 11 words: by button, by key and by swipe; checks at the 4th and 8th (right) and 12th... we stop before
    const known = [];
    for (let k = 1; k <= 11; k++) {
      q = await qs(page); if (q.step !== 'card') break;
      known.push(q.zh);
      if (k % 3 === 0) await page.keyboard.press('ArrowRight'); else await page.locator('.qs-yes').click();
      q = await qs(page);
      if (q.step === 'check') {
        check(k % 4 === 0 && await page.locator('.qs .obm-opts button').count() === 3, 'the ' + k + 'th "Know it" asks what it means, with 3 choices');
        if (k === 8) { await answerCheck(page, false); check(/Not quite/.test(await page.locator('.qs').innerText()), 'a wrong meaning says so and shows the right one'); known.pop(); }
        else { await answerCheck(page, true); check(/Right\./.test(await page.locator('.qs').innerText()), 'a right meaning counts it as known'); }
        await page.locator('.qs button', { hasText: 'Continue' }).click();
      }
    }
    // a swipe left: Not yet
    const sw = await page.locator('.qs-card').boundingBox();
    q = await qs(page); const swiped = q.zh;
    await page.mouse.move(sw.x + sw.width / 2, sw.y + sw.height / 2); await page.mouse.down(); await page.mouse.move(sw.x + sw.width / 2 - 150, sw.y + sw.height / 2, { steps: 6 }); await page.mouse.up();
    q = await qs(page);
    check(q.marks[swiped] === 'not', 'a swipe to the left is Not yet');
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowLeft');
    q = await qs(page);
    check(q.step === 'done', 'five "Not yet" in a row end it early (after ' + Object.keys(q.marks).length + ' words)');
    const sure = Object.keys(q.marks).filter(z => q.marks[z] === 'sure').length, plainKnow = Object.keys(q.marks).filter(z => q.marks[z] === 'know').length;
    check(sure === 1 && plainKnow === 9, 'one checked word, nine others marked known, the wrong one is not (' + sure + ', ' + plainKnow + ')');
    const t = await page.locator('.qs').innerText();
    check(/You know 10 of 16/.test(t) && /20 a day/.test(t) && /count as done/.test(t), 'the summary: ' + t.replace(/\s+/g, ' ').slice(0, 160));
    const before = await page.evaluate(() => window.shanlu.state.xp);
    await page.locator('.qs button', { hasText: 'Save and start' }).click(); await page.waitForTimeout(300);
    const st = await page.evaluate((ks) => { const a = window.shanlu; const S = a.state; return { qs: S.qs, xp: S.xp, see: ks.map(z => S.ws[z] && S.ws[z].see), note: S.pcNote }; }, known);
    check(!st.qs && st.xp === before, 'saving closes it and pays no coins');
    check(st.see.every(x => x && x.s > 0) && st.see.filter(x => x.pk).length === 9, 'the known words are marked: nine probably known (with a release day), one known');
    check(/Quick sort done: 10 words/.test(st.note || ''), 'a note says what happened: ' + st.note);
    // Home: Start here begins at the first stop with a word not known
    const start = await page.locator('section.ob[aria-label="Start here"]').count();
    const words = start ? await page.locator('.ob-w b').allInnerTexts() : [];
    check(start === 1 && words.length > 0 && words.every(w => known.indexOf(w) < 0), 'Start here offers the first stop with new words, none of the known ones: ' + words.join(' '));
    await page.evaluate(() => window.shanlu.go('path')); await page.waitForTimeout(300);
    const done = await page.locator('.pth-node.done').count();
    check(done >= 1, 'Path stops whose words are all known count as done (' + done + ')');
    const ach = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}').prefs || {}; return p.onb && p.onb.v; });
    check(ach && ach.qs > 0 && ach.l === 'some', 'the first-visit record notes the quick sort');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- from Settings, next to the level check; and "Do not save" ----
  {
    const { ctx, page, errors } = await open({});
    await page.evaluate(() => { window.shanlu.go('voice'); window.shanlu.setSec('level'); }); await page.waitForTimeout(200);
    check(await page.locator('button', { hasText: 'Check my level' }).count() === 1 && await page.locator('button', { hasText: 'Quick sort (1 minute)' }).count() === 1, 'Settings > Level has the quick sort next to Check my level');
    await page.locator('button', { hasText: 'Quick sort (1 minute)' }).click();
    check(/Not now/.test(await page.locator('.qs').innerText()), 'it opens, with Not now');
    await page.locator('.qs button', { hasText: /^\s*Start\s*$/ }).click();
    await page.locator('.qs-yes').click(); await page.locator('.qs-yes').click();
    await page.locator('.qs button', { hasText: 'Finish here' }).click();
    check(/You know 2 of 2/.test(await page.locator('.qs').innerText()), 'Finish here ends it with what was sorted');
    await page.locator('.qs button', { hasText: 'Do not save' }).click();
    const n = await page.evaluate(() => Object.keys(window.shanlu.state.ws).filter(z => window.shanlu.state.ws[z].see.s > 0).length);
    check(!(await qs(page)) && n === 0, 'Do not save changes nothing');
    // all 30 known: it suggests the level check
    await page.evaluate(() => window.shanlu.qsOpen('menu')); await page.locator('.qs button', { hasText: /^\s*Start\s*$/ }).click();
    for (let k = 0; k < 40; k++) { const q = await qs(page); if (!q || q.step === 'done') break; if (q.step === 'check') { await answerCheck(page, true); await page.keyboard.press('Enter'); continue; } await page.keyboard.press('ArrowRight'); }
    check(/You know 30 of 30/.test(await page.locator('.qs').innerText()) && await page.locator('.qs button', { hasText: 'Take the level check instead' }).count() === 1, 'knowing all 30 suggests the level check');
    await page.locator('.qs button', { hasText: 'Take the level check instead' }).click();
    check(await page.evaluate(() => !window.shanlu.state.qs && !!window.shanlu.state.pcs), 'which opens the level check');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- a phone: it fits ----
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, touch: true });
    await page.evaluate(() => window.shanlu.qsOpen('menu')); await page.locator('.qs button', { hasText: /^\s*Start\s*$/ }).click(); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const b = document.querySelector('.obm').getBoundingClientRect(); return { over: document.documentElement.scrollWidth - window.innerWidth, bottom: Math.round(b.bottom), h: window.innerHeight }; });
    check(r.over <= 1 && r.bottom <= r.h + 1, 'the card fits a phone (overflow ' + r.over + 'px, bottom ' + r.bottom + ')');
    await page.screenshot({ path: '/tmp/qs-phone.png' });
    await ctx.close();
  }

  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('quick sort browser tests passed');
})().catch(e => { console.log(e); process.exit(1); });
