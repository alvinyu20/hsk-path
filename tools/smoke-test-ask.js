/* Browser test for "Ask about this" (the AI help sheet): the "Why?" link under a wrong answer (Path, grammar practice), the Ask button on any screen,
 * follow-up questions, and, with a real worker.js on a local D1 (Miniflare, needs  cd worker && npm install), the group's shared answers and the
 * report queue. The AI itself is faked with window.SHANLU_ASK_FAKE, so the test checks what is sent and what is shown.
 * Usage: NODE_PATH="$(npm root -g)" node tools/smoke-test-ask.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

// the fake AI: records each call and answers in the expected JSON; a question containing "card" makes it say the card is wrong
const fakeAi = () => {
  window.SHANLU_ASK_CALLS = [];
  window.SHANLU_ASK_FAKE = async (lv, msgs, system) => {
    window.SHANLU_ASK_CALLS.push({ lv, msgs, system });
    await new Promise(r => setTimeout(r, 60));
    const last = msgs[msgs.length - 1].content;
    const wrong = /card/i.test(last);
    return JSON.stringify({ answer: 'Answer ' + window.SHANLU_ASK_CALLS.length + ': 你好 (nǐ hǎo) is a greeting.', examples: [{ zh: '你好，老师！', en: 'Hello, teacher!' }, { zh: '没有中文', en: '' }].slice(0, 1),
      card_wrong: wrong, card_note: wrong ? 'The English should say hello.' : '' });
  };
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const mk = async (opts) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript(fakeAi);
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
    if (opts && opts.friends) await ctx.addInitScript((f) => { window.SHANLU_FRIENDS_URL = f.url; localStorage.setItem('shanlu-friends', JSON.stringify(f.me)); }, opts.friends);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(site); await page.waitForSelector('.app');
    await page.evaluate(() => window.shanlu.setState({ aiOn: true }));   // the fake stands in for a key or the shared AI
    return { ctx, page, errors };
  };
  const calls = (page) => page.evaluate(() => window.SHANLU_ASK_CALLS);
  // the first Path stop, up to its first question, answered wrongly
  const pathMistake = async (page) => {
    await page.evaluate(() => window.shanlu.go('path')); await page.waitForTimeout(150);
    await page.locator('.pth-node').first().click(); await page.waitForTimeout(100);
    await page.locator('.pth-sheet .pth-go').click(); await page.waitForTimeout(150);
    for (let g = 0; g < 20 && await page.locator('.pl-meet').count(); g++) { await page.locator('.pl button:has-text("Next")').click(); await page.waitForTimeout(30); }
    const step = await page.evaluate(() => { const pl = window.shanlu.state.pl; const s = pl.steps[pl.i]; return { zh: s.zh, opts: s.opts, kind: s.kind }; });
    const wrong = step.opts.findIndex(o => o !== step.zh);
    check(await page.locator('.ask-why').count() === 0, 'no "Why?" link before answering');
    await page.locator('.q-card .opt').nth(wrong).click(); await page.waitForTimeout(60);
    return Object.assign(step, { picked: step.opts[wrong] });
  };

  // ---------- 1. without the friends board ----------
  const A = await mk();
  const p = A.page;
  check(await p.locator('.askpill').count() === 1, 'the Ask button is in the top bar');
  const step = await pathMistake(p);
  check(await p.locator('.fb.bad .ask-why').count() === 1, 'a wrong answer on a Path stop shows "Why? Ask the AI"');
  await p.locator('.ask-why').click(); await p.waitForSelector('.ask-ai');
  let c = await calls(p);
  const first = c[0].msgs[0].content;
  check(c.length === 1 && c[0].msgs.length === 1 && /Path stop question/.test(first) && first.includes('The right answer: ' + step.zh) && first.includes('The learner picked') && /My question: Why was my answer wrong\?/.test(first), 'the AI gets the question, the options, what was picked, the right answer and "Why was my answer wrong?"');
  check(/HSK 1/.test(c[0].system) && /card_wrong/.test(c[0].system), 'the AI is told the level and the answer format');
  check((await p.locator('.ask-ctx-t').innerText()).includes(step.zh) && /path stop/i.test(await p.locator('.ask-ctx .kick').innerText()), 'the sheet names what it is about (' + (await p.locator('.ask-ctx-t').innerText()) + ')');
  check((await p.locator('.ask-me').first().innerText()).includes('Why was my answer wrong?') && (await p.locator('.ask-a').first().innerText()).includes('Answer 1'), 'the question and the answer show in the sheet');
  check(await p.locator('.ask-ex').count() === 1 && /nǐ hǎo/i.test(await p.locator('.ask-ex .py').innerText()) && (await p.locator('.ask-ex .en').innerText()).includes('Hello'), 'an example comes with pinyin worked out by the site and its English');
  check(/not checked by a teacher/.test(await p.locator('.ask-meta').first().innerText()) && await p.locator('.ask-meta .linkbtn:not(.ask-save)').count() === 0, 'each answer says it is AI and unchecked (no "answer seems wrong" button without the friends board)');
  check(await p.locator('.ask-chip').count() >= 2 && await p.locator('.ask-chip', { hasText: 'Why was my answer wrong?' }).count() === 0, 'suggested follow-ups show, without the one already asked');
  // a follow-up typed in the box carries the conversation
  await p.fill('.ask-inp', 'Is this card right?'); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelectorAll('.ask-ai:not(.ask-typing)').length === 2);
  c = await calls(p);
  check(c.length === 2 && c[1].msgs.length === 3 && c[1].msgs[1].role === 'assistant' && JSON.parse(c[1].msgs[1].content).answer.includes('Answer 1') && c[1].msgs[2].content === 'Is this card right?', 'a follow-up sends the conversation so far');
  check(await p.locator('.ask-flag').count() === 1 && (await p.locator('.ask-flag').innerText()).includes('should say hello') && /Something wrong with this card/.test(await p.locator('.ask-flag').innerText()), 'when the AI thinks the card is wrong it says so, and points to reporting it');
  await p.locator('.ask-foot .linkbtn').click(); await p.waitForTimeout(60);
  const gh = await p.locator('.ask-rep .report').getAttribute('href');
  check(/github\.com\/.*\/issues\/new/.test(gh) && decodeURIComponent(gh).includes(step.zh), 'without the friends board a card is reported on GitHub, with the screen in the report');
  await p.keyboard.press('Escape'); await p.locator('.ask-x').click(); await p.waitForTimeout(60);
  check(await p.locator('.ask').count() === 0, 'the close button puts the sheet away');
  check(A.errors.length === 0, 'no page errors so far: ' + A.errors.join(' | '));

  // the Ask button on another screen: the page's text, and the last mistake still on offer
  await p.locator('.fb button:has-text("Continue")').click();
  await p.evaluate(() => window.shanlu.go('home')); await p.waitForTimeout(150);
  await p.locator('.askpill').click(); await p.waitForSelector('.ask');
  check(/this screen/i.test(await p.locator('.ask-ctx .kick').innerText()) && await p.locator('.ask-ai').count() === 0, 'the Ask button on Today opens the sheet about this screen, without asking anything yet');
  check(await p.locator('.ask-chip', { hasText: 'About my last mistake (' + step.zh + ')' }).count() === 1, 'it offers the last mistake (' + step.zh + ')');
  await p.locator('.ask-chip', { hasText: 'Explain what this screen is for' }).click(); await p.waitForSelector('.ask-ai');
  c = await calls(p);
  check(/^On my screen:\nScreen: /.test(c[2].msgs[0].content) && /Today/.test(c[2].msgs[0].content) && c[2].msgs[0].content.length < 2600 && !/Ask about/.test(c[2].msgs[0].content), 'on any screen the AI gets the page\'s text (not the sheet\'s own)');
  await p.locator('.ask-x').click();

  // grammar practice: a wrong multiple choice
  await p.evaluate(() => { const s = window.shanlu; s.startQuiz('grammar', 0); const i = s.quizQs.findIndex(q => q.type === 'mc'); s.setState({ qi: Math.max(0, i) }); });
  await p.waitForTimeout(100);
  const gq = await p.evaluate(() => { const s = window.shanlu; const q = s.quizQs[s.state.qi]; return { type: q.type, wrong: q.options.findIndex(o => o.id !== q.correct), label: (q.options.find(o => o.id !== q.correct) || {}).label }; });
  if (gq.type === 'mc') {
    await p.locator('.opt').nth(gq.wrong).click(); await p.locator('button:has-text("Check")').click(); await p.waitForTimeout(80);
    check(await p.locator('.fb.bad .ask-why').count() === 1, 'a wrong answer in grammar practice shows "Why?"');
    await p.locator('.ask-why').click(); await p.waitForSelector('.ask-ai');
    c = await calls(p);
    const g = c[c.length - 1].msgs[0].content;
    check(/Grammar practice/.test(g) && g.includes('The learner answered: ' + gq.label) && /The site's right answer: /.test(g) && /Options: /.test(g), 'grammar practice sends the options, the answer given and the right one');
    await p.locator('.ask-x').click();
  } else check(false, 'no multiple-choice question in the first grammar lesson to test with');
  check(A.errors.length === 0, 'no page errors without the friends board: ' + A.errors.join(' | '));
  await A.ctx.close();

  // ---------- 2. with the friends board: shared answers and the report queue ----------
  if (!fs.existsSync(path.join(root, 'worker', 'node_modules', 'miniflare'))) { console.log('skipped the shared answers: run "cd worker && npm install" first'); }
  else {
    const { makeWorker } = await import(path.join(root, 'worker', 'test.mjs'));
    const mf = await makeWorker({ ALLOWED_ORIGINS: 'http://127.0.0.1:' + server.address().port });
    const api = String(await mf.ready).replace(/\/$/, '');
    const join = async (name) => (await (await fetch(api + '/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + server.address().port }, body: JSON.stringify({ name }) })).json());
    const admin = async (p2) => (await (await fetch(api + p2, { headers: { 'X-Admin-Key': 'admin-secret-key' } })).json());
    const j1 = await join('Ann'), j2 = await join('Ben');
    const B1 = await mk({ friends: { url: api, me: { id: j1.id, key: j1.key, name: j1.name, group: j1.group } } });
    const s1 = await pathMistake(B1.page);
    const pl1 = await B1.page.evaluate(() => JSON.stringify(Object.assign({}, window.shanlu.state.pl, { checked: false, pick: null })));
    await B1.page.locator('.ask-why').click(); await B1.page.waitForSelector('.ask-ai');
    await B1.page.waitForTimeout(400);
    let shared = await admin('/api/admin/ask');
    check(shared.answers.length === 1 && shared.answers[0].q === 'Why was my answer wrong?' && shared.answers[0].kind === 'path' && shared.answers[0].title.includes(s1.zh), 'the first answer is shared with the group');
    const B2 = await mk({ friends: { url: api, me: { id: j2.id, key: j2.key, name: j2.name, group: j2.group } } });
    // the same mistake (same word, same wrong pick) on another person's device
    await B2.page.evaluate(() => window.shanlu.go('path')); await B2.page.waitForTimeout(150);
    await B2.page.locator('.pth-node').first().click(); await B2.page.locator('.pth-sheet .pth-go').click(); await B2.page.waitForTimeout(150);
    await B2.page.evaluate((pl) => window.shanlu.setState({ pl: JSON.parse(pl) }), pl1); await B2.page.waitForTimeout(60);   // the same question as Ann had (the order is random)
    const st2 = await B2.page.evaluate(() => { const pl = window.shanlu.state.pl; const s = pl.steps[pl.i]; return { zh: s.zh, opts: s.opts }; });
    const same = st2.zh === s1.zh && st2.opts.indexOf(s1.picked) >= 0;
    if (same) {
      await B2.page.locator('.q-card .opt').nth(st2.opts.indexOf(s1.picked)).click(); await B2.page.waitForTimeout(60);
      await B2.page.locator('.ask-why').click(); await B2.page.waitForSelector('.ask-ai');
      check((await calls(B2.page)).length === 0 && /Asked before in your group/.test(await B2.page.locator('.ask-meta').innerText()) && (await B2.page.locator('.ask-a').innerText()).includes('Answer 1'), 'someone else with the same mistake gets the shared answer, with no AI call');
      await B2.page.locator('.ask-meta .linkbtn:not(.ask-save)').click(); await B2.page.waitForFunction(() => /Thanks, reported/.test((document.querySelector('.ask-meta .linkbtn:not(.ask-save)') || {}).textContent || ''));
      let open = (await admin('/api/admin/reports')).reports;
      check(open.length === 1 && open[0].why === 'answer' && open[0].name === 'Ben' && open[0].ctx.includes('The right answer: ' + s1.zh), '"This answer seems wrong" puts it on the report queue, with the screen');
      check((await admin('/api/admin/ask')).answers[0].bad === 1, '...and the shared answer is no longer handed out');
      // the AI says the card is wrong: queued on its own
      await B2.page.fill('.ask-inp', 'Is the card wrong?'); await B2.page.keyboard.press('Enter');
      await B2.page.waitForFunction(() => /review list/.test((document.querySelector('.ask-flag-s') || {}).textContent || ''));
      open = (await admin('/api/admin/reports')).reports;
      check(open.length === 2 && open[1].why === 'ai' && open[1].note.includes('should say hello'), 'when the AI thinks the card is wrong, it goes on the queue by itself');
      check(/Sent to Alvin's review list/.test(await B2.page.locator('.ask-flag-s').innerText()), '...and the sheet says so');
      // a person's own report about the card
      await B2.page.locator('.ask-foot .linkbtn').click();
      await B2.page.locator('.ask-rep button').click(); await B2.page.waitForTimeout(60);
      check(/Say what looks wrong/.test(await B2.page.locator('.ask-rep-msg').innerText()), 'an empty report asks what looks wrong');
      await B2.page.fill('.ask-rep-t', 'The pinyin is wrong'); await B2.page.locator('.ask-rep button').click();
      await B2.page.waitForFunction(() => /on Alvin's list/.test((document.querySelector('.ask-rep-msg') || {}).textContent || ''));
      open = (await admin('/api/admin/reports')).reports;
      check(open.length === 3 && open[2].why === 'card' && open[2].note === 'The pinyin is wrong', '"Something wrong with this card?" sends the person\'s note to the queue');
    } else check(false, 'the second person did not get the same first question (' + st2.zh + ' vs ' + s1.zh + ')');
    check(B1.errors.length === 0 && B2.errors.length === 0, 'no page errors with the friends board: ' + B1.errors.concat(B2.errors).join(' | '));
    await mf.dispose();
  }

  await browser.close(); server.close();
  console.log(failures ? failures + ' check(s) failed' : 'ask tests passed');
  process.exit(failures ? 1 : 0);
})();
