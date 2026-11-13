/* Smoke test: loads the site in headless Chromium, clicks through every screen and flow,
 * and fails on any console error. Usage: node tools/smoke-test.js [screenshot-dir]
 * Needs Playwright (npm i playwright) and a Chromium build.
 * Quiz questions are read from the running app (window.shanlu.curQ()) and answered correctly, so every question type is exercised. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
// Default run: plain forms (no 儿 endings), which is what the site ships with. `--erhua` runs everything again in exam style (儿 endings on).
const erhuaMode = process.argv.includes('--erhua');
const WORD_COUNT = erhuaMode ? 300 : 297;
const shots = process.argv.slice(2).find(a => !a.startsWith('--')) || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

const server = require('./test-static').server(root);

let failures = 0;
const window_level_still_1 = (n) => n === 1;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const openLv = async (p) => { if (!(await p.locator('.lvpanel').count())) await p.locator('.lvbtn').click(); await p.waitForTimeout(80); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ['microphone'] });
  await ctx.addInitScript(() => { Date.prototype.getHours = function () { return 12; }; });   // the hour of the day is noon unless a test sets it, so "Night owl" and "Early bird" do not depend on when the suite runs
  await ctx.addInitScript(() => { window.SHANLU_AUTO_SHARE = 0; });   // Review: no auto-checked recognition cards unless a test asks for them
  // A fake text-to-speech with the kinds of voices an iPhone lists, so the voice picker can be tested without a phone.
  await ctx.addInitScript((erhua) => {
    try { if (erhua && localStorage.getItem('shanlu-erhua') === null) localStorage.setItem('shanlu-erhua', 'on'); } catch (e) {}
    const mk = (name, lang, uri, local) => ({ name, lang, voiceURI: uri, localService: local !== false, default: false });
    const voices = [
      mk('Sinji', 'zh-HK', 'com.apple.voice.compact.zh-HK.Sinji'),
      mk('Meijia', 'zh-TW', 'com.apple.voice.compact.zh-TW.Meijia'),
      mk('Tingting', 'zh-CN', 'com.apple.voice.compact.zh-CN.Tingting'),
      mk('Lili (Premium)', 'zh-CN', 'com.apple.voice.premium.zh-CN.Lili'),
      mk('Daniel', 'en-GB', 'com.apple.voice.compact.en-GB.Daniel')
    ];
    window.__spoken = [];
    const ss = { getVoices: () => voices, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.voiceURI, lang: u.lang, rate: u.rate }); }, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    // a fake microphone: it "hears" 我想喝茶
    window.__micAlts = ['我想喝茶'];
    window.__micOpts = null;
    window.webkitSpeechRecognition = function () {
      this.start = () => { window.__micOpts = { continuous: this.continuous, interim: this.interimResults, alts: this.maxAlternatives, lang: this.lang };
        setTimeout(() => { const res = Object.assign(window.__micAlts.map((t, i) => ({ transcript: t, confidence: 0.9 - i * 0.2 })), { isFinal: true });
          if (this.onresult) this.onresult({ results: [res] }); }, 10); };
      this.stop = () => { setTimeout(() => { if (this.onend) this.onend(); }, 5); };
    };
  }, erhuaMode);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR|status of (401|500)/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); };
  // five tabs on every screen size; the pages of a tab sit under it (sidebar on a wide window, a strip under the header on a phone)
  const nav = require('./test-nav').makeNav(page);
  const text = async () => (await page.locator('main').innerText());
  const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // Answers the current quiz question. right=false picks a wrong answer where it can.
  const answer = async (right) => {
    const q = await page.evaluate(() => { const q = window.shanlu.curQ(); return JSON.parse(JSON.stringify(q)); });
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
    await page.locator('button', { hasText: 'Check' }).click();
    await page.waitForTimeout(40);
    return q;
  };
  const runQuiz = async (right) => {
    let total = await page.evaluate(() => window.shanlu.quizQs.length);
    for (let i = 0; i < total; i++) {
      await answer(right);
      await page.locator('button', { hasText: i === total - 1 ? 'See results' : 'Continue' }).click();
      await page.waitForTimeout(40);
    }
    return total;
  };

  await page.goto(url);
  await page.waitForSelector('.app');
  check((await text()).includes('Start today\'s plan'), 'home loads');
  check((await page.locator('.side').innerText()).includes('0-day streak'), 'fresh state starts at a 0-day streak');
  // Home: the trail comes first, then today and the level exam
  check(await page.evaluate(() => { const h = document.querySelector('.home'); const f = h && h.querySelector('.hgrid2') && h.querySelector('.hgrid2').firstElementChild; return !!f && !!f.querySelector('.today-go') && f.innerText.includes('Today') && !!h.querySelector('.trail') && f.compareDocumentPosition(h.querySelector('.trail')) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'Today and its main button come first on Home; the path is below');
  check(await page.locator('.rg').count() === 4 && await page.locator('.task2').count() >= 1, 'Home shows four skill rings and the Today list');
  // The ascent: trail, mist and stairs views of the same progress
  const ws0 = await page.evaluate(() => JSON.stringify(window.shanlu.state.ws));
  check((await text()).toLowerCase().includes('next milestone') && (await text()).includes('10 words to go'), 'your path opens on the trail: ten words to the first milestone on a fresh start');
  check(await page.locator('.trail-d .apill.next').count() === 1 && (await page.locator('.trail-d .apill.next').innerText()).includes('HSK 1 exam'), 'the trail names the next camp');
  check((await page.locator('.trail-d img').getAttribute('src')).startsWith('data:image/svg+xml'), 'the trail art is drawn from the progress');
  const learnN = async (n) => page.evaluate((n) => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).slice(0, n).forEach(zh => { ws[zh].see = { s:2, l:2, t:Date.now() }; }); app.setState({ ws }); }, n);
  await learnN(96);
  await page.waitForTimeout(150);
  check((await text()).includes('4 words to go') && (await text()).includes('96 of 100'), 'after 96 words the next milestone (100) is 4 words away');
  check((await page.locator('.trail-d .apill.you').innerText()).includes('96 words kept'), 'the trail says where you are');
  check(await page.locator('.seg2 button', { hasText: /^Mist$/ }).count() === 0 && await page.locator('.mtile').count() === 0, 'Home no longer has a Mist view');
  await nav('Archive');
  await page.waitForTimeout(150);
  check(await page.locator('.mtile').count() === 0, 'the mountains start folded away');
  await page.locator('button', { hasText: /^Show all \d+ topics$/ }).click();
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.shanlu.state.wmode) === 'topic' && (await page.locator('.web-bar .seg2 button').first().innerText()).trim() === 'Topics', 'Word webs opens on Topics, which is the first tab');
  const NT = await page.evaluate(() => window.HSK1_WEBS.topics.length);
  check(await page.locator('.mtile').count() === NT && (await text()).includes('of ' + NT + ' fully started'), 'the mist view shows one mountain per Word web topic (' + NT + ')');
  await learnN(300);
  await page.waitForTimeout(150);
  check((await text()).includes(NT + ' of ' + NT + ' fully started') && await page.locator('.mtile .mseal-on').count() === NT, 'when every word is started every mountain is clear and sealed');
  await page.evaluate((j) => { window.shanlu.setState({ ws:JSON.parse(j) }); }, ws0);
  await page.locator('.mtile').nth(4).click();
  await page.waitForTimeout(150);
  check((await text()).includes('Numbers') && await page.evaluate(() => window.shanlu.state.screen === 'web' && window.shanlu.state.wmode === 'topic' && window.shanlu.state.wtopic === 4), 'tapping a mountain opens that topic in the Word webs');
  await page.evaluate(() => { window.shanlu.setState({ wmode:'char', wtopic:0 }); });
  await nav('Home');
  await page.locator('.seg2 button', { hasText: /^Stairs$/ }).click();
  check(await page.locator('.stairs .step').count() === 9, 'the stairs view is still there');
  check(await page.locator('.seg2 button', { hasText: /^HSK 2.0/ }).count() === 0, 'the HSK 2.0 / 3.0 switch is not on the home screen (it is in Settings)');
  await page.evaluate(() => window.shanlu.setState({ sys: '2.0' }));
  await page.waitForTimeout(80);
  check(await page.locator('.stairs .step').count() === 6, 'the HSK 2.0 / 3.0 switch still changes the stairs');
  await page.evaluate(() => window.shanlu.setState({ sys: '3.0' }));
  await page.waitForTimeout(80);
  await page.locator('.seg2 button', { hasText: /^Trail$/ }).click();
  await page.evaluate(() => window.shanlu.setState({ sys: '2.0' }));
  await page.waitForTimeout(80);
  check(await page.locator('.trail-d .apill.near, .trail-d .apill.far').count() === 5 && !(await page.locator('.trail-d').innerText()).includes('HSK 7'), 'with HSK 2.0 the trail has six camps');
  await page.evaluate(() => window.shanlu.setState({ sys: '3.0' }));
  await page.waitForTimeout(80);
  await page.evaluate(() => { window.shanlu.setState({ ascView:'stairs' }); window.shanlu.persistNow(); });
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-progress-v1')).ascView === 'stairs'), 'the view choice is saved');
  await page.evaluate(() => { window.shanlu.setState({ ascView:'trail' }); });
  check(await page.evaluate((N) => window.HSK1_WORDS.length === N && window.HSK1_WORDS.every(w => w.ex && w.ex.zh && w.py && w.en), WORD_COUNT), 'all ' + WORD_COUNT + ' words are loaded with a gloss, pinyin and an example');
  await shot('01-home');

  check(await page.evaluate(() => window.HSK1_WORDS.every(w => (w.more || []).length >= 2)), 'every word has at least two extra example sentences');

  // Tests are blocked until words are started
  await nav('Tests');
  check((await text()).includes('Add at least three words'), 'test is blocked until you have started words');
  check((await page.locator('button', { hasText: 'Start the test' }).count()) === 0, 'no start button while blocked');

  // Word webs (the Library's Topics tile opens on Topics; this part of the test works in Shared character)
  await nav('Archive');
  await page.evaluate(() => window.shanlu.setState({ wmode:'char' }));
  await page.waitForTimeout(80);
  check((await text()).includes('0 added today') && !/\d+ of \d+ added today/.test(await text()), 'word webs open with no daily limit');
  const credit0 = await page.evaluate(() => { const S = window.shanlu.state; return JSON.stringify([S.xp, S.dayMin, S.streak, S.lastActive]); });
  for (let i = 0; i < 6; i++) { await page.locator('button[aria-label="Add to my words"]').first().click(); await page.waitForTimeout(50); }
  check(await page.evaluate((c) => { const S = window.shanlu.state; return JSON.stringify([S.xp, S.dayMin, S.streak, S.lastActive]) === c; }, credit0), 'adding words earns no XP, minutes or streak: only recalling them does');
  check(await page.evaluate(() => { const S = window.shanlu.state; return Object.keys(S.lrn).length === 6 && Object.keys(S.ws).every(z => !(S.ws[z].see.s > 0)); }), 'added words wait in their learning phase: none is "learned" or "in memory" yet');
  check((await text()).includes('6 added today'), 'six words added with no limit in the way');
  check((await page.locator('button[aria-label="Add to my words"]').count()) > 0, 'add buttons are still there after six words');
  if (!(await page.locator('[aria-label="New words per day"]').count())) await page.locator('.capbtn').click();
  await page.locator('[aria-label="New words per day"] button', { hasText: /^5$/ }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('You have reached your limit of 5') && (await page.locator('button[aria-label="Add to my words"]').count()) === 0, 'choosing a limit of 5 stops further adds');
  await page.locator('[aria-label="New words per day"] button', { hasText: 'No limit' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('button[aria-label="Add to my words"]').count()) > 0, 'choosing "No limit" brings the add buttons back');
  const before = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  await page.locator('button', { hasText: /^Add (all )?\d+( of \d+)? new word/ }).first().click();
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  check(after > before + 1, 'Add all adds the rest of a shared-character group (' + before + ' to ' + after + ')');
  check((await page.locator('[aria-label="Shared characters"] .ctile').count()) >= 20, 'many shared-character groups are available');
  await shot('02-webs');
  await page.locator('[aria-label="Shared characters"] .ctile', { hasText: '饭' }).click();
  check((await text()).includes('米饭'), 'switching the shared character shows its words');
  // Show example: a word's own sentence, on demand
  const firstCardWord = (await page.locator('.crow .cr-zh').first().innerText()).trim();
  const firstEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, firstCardWord);
  check(!(await page.locator('.crow').first().innerText()).includes(firstEx), 'a word card does not show its example sentence until asked');
  await page.locator('.crow').first().locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow').first().innerText()).includes(firstEx), 'Show example reveals the word\'s example sentence (' + firstCardWord + ': ' + firstEx + ')');
  check((await page.locator('.crow').first().locator('.wexbox .spk').count()) === 1, 'the example sentence has a play button');
  const more0 = await page.evaluate((zh) => { const m = window.HSK1_WORDS.find(w => w.zh === zh).more || []; return m.length ? m[0].zh : null; }, firstCardWord);
  check(!!more0, 'every word has more than one example sentence (' + firstCardWord + ')');
  await page.locator('.crow').first().locator('button', { hasText: 'Another example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow').first().innerText()).includes(more0) && (await page.locator('.crow').first().innerText()).includes('2 of'), 'Another example shows the next sentence for the word');
  await page.locator('.crow').first().locator('button', { hasText: 'Hide example' }).click();
  await page.waitForTimeout(60);
  check(!(await page.locator('.crow').first().innerText()).includes(firstEx), 'Hide example puts it away again');
  // Study view: cover one side, tap to show it for that word
  await page.locator('.lstudy button', { hasText: 'Cover English' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow').first().innerText()).indexOf(await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).en.split(/[;,(]/)[0].trim(), firstCardWord)) < 0 && (await page.locator('.crow .cvbtn').count()) > 0, 'Cover English hides the meaning and offers a Show button');
  await page.locator('.crow .cvbtn').first().click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow').first().locator('.cvbtn').count()) < 2, 'tapping Show uncovers that word only');
  await page.locator('.lstudy button', { hasText: 'Cover Chinese' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow .cr-zh').count()) === 0, 'Cover Chinese hides the words');
  await page.locator('.lstudy button', { hasText: 'Show all' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.crow .cr-zh').count()) > 0 && (await page.locator('.crow .cvbtn').count()) === 0, 'Show all brings everything back');
  await page.locator('button', { hasText: 'Word pairs' }).click();
  check((await page.locator('.pcard').count()) >= 20, 'opposite pairs are listed');
  const pair = await page.evaluate(() => window.HSK1_WEBS.opps[0]);
  const opBefore = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(!opBefore.a && !opBefore.b, 'the first opposite pair starts out not added (' + pair.a + ' / ' + pair.b + ')');
  const rowText = await page.locator('.pcard').first().innerText();
  check(rowText.includes('Add both words') && rowText.includes('Add ' + pair.a) && rowText.includes('Add ' + pair.b), 'an opposite pair offers both words and "Add both"');
  await page.locator('.pcard').first().locator('button', { hasText: 'Add both words' }).click();
  await page.waitForTimeout(60);
  const opAfter = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(opAfter.a && opAfter.b, 'Add both starts the left and the right word of an opposite pair');
  check(!(await page.locator('.pcard').first().innerText()).includes('Add both words'), 'no add buttons are left once both words are started');
  const exA = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.a).ex.zh, pair);
  const exB = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.b).ex.zh, pair);
  await page.locator('.pcard').first().locator('button', { hasText: 'Show examples' }).click();
  await page.waitForTimeout(60);
  const oText = await page.locator('.pcard').first().innerText();
  check(oText.includes(exA) && oText.includes(exB), 'an opposite pair can show an example for both words');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.locator('.trail-rail .tr-gh', { hasText: 'School and language' }).click();
  check((await page.locator('.trail-rail .tr-gh.open').count()) === 1, 'opening a group closes the one that was open');
  await page.locator('.trail-rail .trl', { hasText: /^School/ }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.lrow').count()) >= 14, 'a topic lists its words');
  const tcWord = (await page.locator('.lrow .lr-hz').first().innerText()).trim();
  const tcEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, tcWord);
  check((await page.locator('.lrow').first().innerText()).includes(tcEx), 'a topic row shows its word\'s example sentence (' + tcWord + ': ' + tcEx + ')');
  check(/\d+ of \d+ started/.test(await text()), 'a topic shows how many of its words you started');
  await page.evaluate(() => window.shanlu.setState({ lrn: {}, wlearned: {} }));
  await page.waitForTimeout(80);
  await page.locator('button', { hasText: /^Add (all )?\d+( of \d+)? new word/ }).first().click();
  await page.waitForTimeout(100);
  const tp = (await text()).match(/(\d+) of (\d+) started/);
  check(tp && Number(tp[1]) === Math.min(12, Number(tp[2])), 'Add on a topic puts its words in the learning phase, at most 12 waiting at once (' + (tp ? tp[0] : 'no progress text') + ')');
  check(/Add 12 of \d+ new word|Add all \d+ new word/.test(await text()) || (await page.evaluate(() => Object.keys(window.shanlu.state.lrn).length)) === 12, 'the learning queue is capped at 12 words');
  await shot('03-topics');
  await page.locator('button', { hasText: 'Shared character' }).click();
  await page.locator('.opts .opt').first().click();
  await page.waitForTimeout(100);
  check((await text()).includes('Next sentence'), 'fill-the-gap gives feedback');

  // "Which word fits?" must not always put the right answer first
  const gapPositions = [];
  for (let k = 0; k < 40; k++) {
    const hubIdx = k % 20, qIdx = Math.floor(k / 20);
    await page.evaluate(([h, q]) => window.shanlu.setState({ whub: h, gfq: q, gfpick: null }), [hubIdx, qIdx]);
    await page.waitForTimeout(25);
    const labels = await page.locator('.opts .opt').allInnerTexts();
    const ans = await page.evaluate(([h, q]) => window.HSK1_WEBS.hubs[h].gaps[q].ans, [hubIdx, qIdx]);
    gapPositions.push(labels.findIndex(t => t.split(/\s/)[0] === ans));
  }
  check(!gapPositions.includes(-1) && new Set(gapPositions).size >= 3 && gapPositions.filter(x => x === 0).length <= 20, 'the right answer is not always the first option (positions ' + gapPositions.join('') + ')');
  const gapStable = await page.evaluate(async () => { const a = [...document.querySelectorAll('.opts .opt')].map(e => e.innerText).join('|'); window.shanlu.setState({ xp: window.shanlu.state.xp }); await new Promise(r => setTimeout(r, 60)); return a === [...document.querySelectorAll('.opts .opt')].map(e => e.innerText).join('|'); });
  check(gapStable, 'the option order stays put when the page redraws');

  // a word can carry a short note (汉语 and 中文 do)
  await page.evaluate(() => window.shanlu.setState({ screen: 'web', wmode: 'topic', wtopic: window.HSK1_WEBS.topics.findIndex(t => t.words.indexOf('汉语') >= 0), wcover: 'all' }));
  await page.waitForTimeout(80);
  const noteCard = page.locator('.lrow').filter({ has: page.locator('.lr-hz', { hasText: /^中文$/ }) }).first();
  check((await noteCard.innerText()).includes('everyday word'), 'the 中文 row shows its note under the example');
  check(!(await page.locator('.lrow').filter({ has: page.locator('.lr-hz', { hasText: /^茶$/ }) }).first().innerText().catch(() => '')).includes('everyday word'), 'other words have no note');

  // My words
  await nav('My words');
  check((await text()).includes(WORD_COUNT + ' words'), 'my words lists all ' + WORD_COUNT + ' words');
  check((await page.locator('.wr2').count()) === 40, 'my words shows the first 40 rows');
  check(await page.locator('.wr2 .wr2-dots i').count() === 200, 'each word row has a five-dot strength meter');
  check(await page.locator('.capbtn').count() === 0, 'the new-words-per-day controls are not on My words');
  await page.locator('button', { hasText: 'Show 40 more' }).click();
  check((await page.locator('.wr2').count()) === 80, 'show more adds 40 rows');
  await page.fill('.wsearch', 'tea');
  await page.waitForTimeout(100);
  check((await page.locator('.wr2').first().innerText()).includes('茶'), 'search by English finds 茶 first');
  await page.fill('.wsearch', 'xiexie');
  await page.waitForTimeout(100);
  check((await page.locator('.wr2').first().innerText()).includes('谢谢'), 'search by pinyin without tone marks works');
  await page.fill('.wsearch', '');
  await shot('04-mywords');

  // Review: new words go through a learning phase first
  const driveCard = async (opts) => {
    const o = Object.assign({ right: true }, opts || {});
    const st = await page.evaluate(() => { const a = window.shanlu; const it = a.state.rq[0]; return { it, kind: a.rKind(it) }; });
    if (st.kind === 'intro') { await page.locator('button', { hasText: 'Got it, ask me soon' }).click(); return st.kind; }
    if (st.kind === 'flip') {
      await page.locator('button', { hasText: 'Show answer' }).click();
      await page.locator('.rates .rate').nth(o.right ? 2 : 0).click();
      return st.kind;
    }
    const q = await page.evaluate(() => { const x = window.shanlu.quizQs[0]; return { type: x.type, correct: x.options && x.options.find(op => op.id === x.correct).label, py: x.exp && x.exp.py, wrong: x.options && x.options.find(op => op.id !== x.correct).label }; });
    if (q.type === 'type') await page.fill('#answer-input', o.right ? q.py : 'zzz');
    else await page.locator('.opts .opt', { hasText: o.right ? q.correct : q.wrong }).first().click();
    await page.locator('button', { hasText: 'Check' }).click();
    await page.locator('button', { hasText: 'Continue' }).click();
    return st.kind;
  };
  await nav('Review words');
  check((await text()).includes('New words are waiting'), 'review offers the added words as new words waiting, not as due reviews');
  const lrnN = await page.evaluate(() => Object.keys(window.shanlu.state.lrn).length);
  await page.locator('button', { hasText: /^Learn \d+ new word/ }).click();
  await page.waitForTimeout(100);
  const firstKind = await page.evaluate(() => window.shanlu.rKind(window.shanlu.state.rq[0]));
  check(firstKind === 'intro' && (await page.locator('.rates .rate').count()) === 0 && (await page.locator('button', { hasText: 'Got it, ask me soon' }).count()) === 1, 'a new word is first introduced (answer showing), with no grading buttons');
  check((await page.locator('button', { hasText: 'Hear the word' }).count()) === 1, 'the introduction lets you hear the word');
  const rtotal0 = await page.evaluate(() => window.shanlu.state.rq.length);
  // leaving in the middle of the session (a refresh, a frozen tab) must not lose the queue or the steps already made
  for (let i = 0; i < 4; i++) await driveCard();
  const midBefore = await page.evaluate(() => ({ rq: window.shanlu.state.rq.slice(), lrn: JSON.stringify(window.shanlu.state.lrn), total: window.shanlu.state.rtotal }));
  check(midBefore.rq.some(z => z.endsWith('#l')), 'mid-session the queue holds new-word cards (' + midBefore.rq.slice(0, 3).join(' ') + ' ...)');
  await page.reload();
  await page.waitForSelector('.app');
  const midAfter = await page.evaluate(() => ({ rq: window.shanlu.state.rq.slice(), lrn: JSON.stringify(window.shanlu.state.lrn), total: window.shanlu.state.rtotal }));
  check(JSON.stringify(midAfter.rq) === JSON.stringify(midBefore.rq) && midAfter.lrn === midBefore.lrn && midAfter.total === midBefore.total, 'after a refresh in the middle of a session the queue and every new word\'s step are exactly as they were');
  check(await page.evaluate(() => { const q = window.shanlu.state.rq.slice(0, 2).concat(['nope#l']); return JSON.stringify(window.shanlu.cleanQueue(q)) === JSON.stringify(q.slice(0, 2)); }), 'a sync keeps the new-word, typed and heard cards of the queue and drops only unknown words');
  await nav('Review words');
  check(!(await text()).includes('New words are waiting') && (await page.evaluate(() => window.shanlu.state.rq.length)) === midBefore.rq.length, 'Review picks the session up where it was left, not from the start');
  const lkinds = [];
  for (let i = 0; i < lrnN * 6 && !(await text()).includes('cards done'); i++) lkinds.push(await driveCard());
  check((await text()).includes('cards done') && lkinds.includes('intro') && lkinds.includes('choice') && lkinds.includes('type'), 'a new word goes intro, then a check it can fail, then typed recall, before the session ends (' + [...new Set(lkinds)].join(', ') + ')');
  check(await page.evaluate((n) => { const S = window.shanlu.state; return Object.keys(S.lrn).length === 0 && Object.keys(S.ws).filter(z => S.ws[z].see.s > 0 && S.ws[z].prod.s > 0).length === n; }, lrnN), 'only after two recalls do the ' + lrnN + ' words get an interval and count in "words in memory"');
  check(await page.evaluate(() => { const S = window.shanlu.state; return S.rlog.length >= 6 && S.rlog.every(e => e.length === 5); }), 'every answer is written to the review log');
  // a new-word card for a word that already graduated (another device finished it, or a sync restored an old queue) must not show it as new again or reset it
  check(await page.evaluate(() => { const T = window.shanlu.testApi; const ws = { 三: { see: { s: 1.5 } }, 四: { see: { s: 0 } } };
    return T.staleNew('三#l', ws, {}) === true && T.staleNew('三#l', ws, { 三: { st: 0 } }) === false && T.staleNew('四#l', ws, {}) === false && T.staleNew('三', ws, {}) === false && T.staleNew('三#p', ws, {}) === false; }), 'a new-word card is out of date only when the word is already in memory and no longer in the learning list');
  const stale = await page.evaluate(() => { const a = window.shanlu; const z = Object.keys(a.state.ws).find(w => a.state.ws[w].see.s > 0); const other = Object.keys(a.state.ws).find(w => w !== z && a.state.ws[w].see.s > 0); const before = JSON.stringify(a.state.ws[z]);
    a.setState({ rq: [z + '#l', other], rtotal: 2, rcomplete: false });
    const cleaned = a.cleanQueue(a.state.rq, a.state.ws, a.state.lrn);
    return { z, other, cleaned, same: JSON.stringify(a.rGrade(z + '#l', 'good', 'f').ws[z]) === before }; });
  check(stale.cleaned.length === 1 && stale.cleaned[0] === stale.other && stale.same, 'a sync drops the out-of-date new-word card, and grading one would not reset the word');
  await page.evaluate(() => window.shanlu.setState({ rcomplete: false, rq: [] }));
  await nav('Home'); await nav('Review words');
  check((await text()).toLowerCase().includes('all caught up'), 'review shows caught up when nothing is due');
  await page.locator('button', { hasText: 'Practice all my words anyway' }).click();
  await page.waitForTimeout(100);
  const practiceN = await page.evaluate(() => window.shanlu.state.rq.length);
  check(practiceN === (await page.evaluate(() => Object.keys(window.shanlu.state.ws).filter(zh => window.shanlu.state.ws[zh].see.s > 0 || window.shanlu.state.ws[zh].see.l > 0).length)) && practiceN >= 5, 'practising anyway offers every started word, not just five');
  // if drawing a card ever fails, the page must not go dead: the bad card is skipped, the next one shows, and a bar says what happened
  const dead = await page.evaluate(async () => { const a = window.shanlu; const n = a.state.rq.length; a.setState({ rq: ['not-a-word'].concat(a.state.rq), rtotal: n + 1, rstep: a.state.rstep + 1 });
    await new Promise((r) => setTimeout(r, 150)); const bar = document.getElementById('render-err');
    return { first: a.state.rq[0], n: a.state.rq.length, expect: n, bar: !!bar && /snag/.test(bar.textContent), main: document.querySelector('main').innerText.length > 40 }; });
  check(dead.first !== 'not-a-word' && dead.n === dead.expect && dead.bar && dead.main, 'a card that cannot be drawn is skipped, the page keeps working and a red bar says so');
  await page.evaluate(() => { const b = document.getElementById('render-err'); if (b) b.remove(); });
  // a saved queue that holds a word this view does not have (a locked level's word) is cleaned on load instead of crashing the card
  const savedKey = await page.evaluate(() => { const a = window.shanlu; a.persistNow(); a.frozen = true;
    const k = Object.keys(localStorage).filter((x) => /^shanlu-progress/.test(x)).find((x) => { try { return Array.isArray(JSON.parse(localStorage.getItem(x)).rq); } catch (e) { return false; } });
    const o = JSON.parse(localStorage.getItem(k)); o.rq = ['not-a-word#p'].concat(o.rq || []); localStorage.setItem(k, JSON.stringify(o)); return k; });
  await page.reload(); await page.waitForSelector('.app');
  check(await page.evaluate((k) => !window.shanlu.state.rq.some((z) => /not-a-word/.test(z)) && !document.getElementById('render-err'), savedKey), 'a saved Review queue with an unknown word is cleaned on load, with no error bar');
  await page.evaluate(() => { window.shanlu.go('review'); window.shanlu.practiceAnyway(); }); await page.waitForTimeout(150);   // back to the practice queue the next checks use
  {   // the whole of Review words can be done from the keyboard
    const st = () => page.evaluate(() => { const S = window.shanlu.state; return { done: S.rdone, flip: S.rflip, n: S.rq.length, screen: S.screen }; });
    const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(120); };
    await page.evaluate(() => { window.__kb0 = JSON.stringify({ lrn: window.shanlu.state.lrn, ws: window.shanlu.state.ws }); });
    const k0 = await st();
    check(k0.screen === 'review' && k0.n >= 4 && /Keys:/.test(await page.locator('.kbhint').innerText()), 'Review shows a line of keyboard shortcuts');
    await key(' '); const k1 = await st();
    await key('3'); const k2 = await st();
    await key(' '); await key(' '); const k3 = await st();
    await key('y'); const k4 = await st();
    await key('Enter'); await key('4'); const k5 = await st();
    check(k1.flip && !k2.flip && k2.done === k0.done + 1 && k3.done === k0.done + 2 && k4.done === k0.done + 3 && k5.done === k0.done + 4, 'Review words works from the keyboard: Space shows, 1-4 or Space rates, Y marks "knew it" (' + [k0.done, k2.done, k3.done, k4.done, k5.done].join(',') + ')');
    await page.evaluate(() => { const a = window.shanlu; const z = Object.keys(a.state.ws).find(w => !(a.state.ws[w].see.s > 0) && !a.state.lrn[w]); const q = a.state.rq.length ? a.state.rq : [z]; a.setState({ lrn: Object.assign({}, a.state.lrn, { [z]: { st: -1, m: 0, at: Date.now() } }), rq: [z + '#l', ...q.slice(0, 2)], rtotal: 3, rdone: 0, rcomplete: false, rflip: false }); });
    await page.waitForTimeout(120);
    const i0 = await page.evaluate(() => window.shanlu.state.rq[0]); await key(' ');
    check(await page.evaluate((f) => window.shanlu.state.rq[0] !== f, i0), 'on a new word, Space is "got it" and the card moves on')
    // a choice card: one key answers it, the next Space continues
    await page.evaluate(() => { const a = window.shanlu; const zs = Object.keys(a.state.ws).filter(w => a.state.ws[w].see.s > 0); a.setState({ rq: [zs[0] + '#l', zs[1]], rtotal: 2, rdone: 0, rcomplete: false, rflip: false, qchecked: false, qchoice: null, lrn: Object.assign({}, a.state.lrn, { [zs[0]]: { st: 0, m: 0, at: Date.now() } }), ws: Object.assign({}, a.state.ws, { [zs[0]]: Object.assign({}, a.state.ws[zs[0]], { see: { s: 0, l: 0 } }) }) }); });
    await page.waitForTimeout(150);
    const c0 = await page.evaluate(() => ({ choice: !!document.querySelector('.rev .opts .opt'), checked: window.shanlu.state.qchecked }));
    if (c0.choice) { const f0 = await page.evaluate(() => window.shanlu.state.rq[0]); await key('2'); const c1 = await page.evaluate(() => window.shanlu.state.qchecked); await key(' '); const c2 = await page.evaluate((f) => ({ checked: window.shanlu.state.qchecked, moved: window.shanlu.state.rq[0] !== f }), f0); check(c1 && !c2.checked && c2.moved, 'on a multiple-choice card one key answers it and Space moves on'); }
    else check(false, 'the keyboard test could not set up a multiple-choice card');
    // a typed card: the cursor is already in the box; Enter checks, Enter continues
    await page.evaluate(() => { const a = window.shanlu; const zs = Object.keys(a.state.ws).filter(w => a.state.ws[w].see.s > 0); a.setState({ rq: [zs[2] + '#p', zs[3]], rtotal: 2, rdone: 0, rcomplete: false, rflip: false, qchecked: false, qchoice: null, qtyped: '' }); });
    await page.waitForTimeout(200);
    const foc = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.type('x'); await key('Enter'); const t1 = await page.evaluate(() => window.shanlu.state.qchecked); await key('Enter'); const t2 = await page.evaluate(() => window.shanlu.state.qchecked);
    check(foc === 'answer-input' && t1 && !t2, 'on a typed card the cursor is already in the box, Enter checks and Enter continues');
    await page.evaluate(() => { const a = window.shanlu; const o = JSON.parse(window.__kb0); a.setState({ lrn: o.lrn, ws: o.ws }); a.go('review'); a.practiceAnyway(); }); await page.waitForTimeout(150);
  }
  {   // sounds, milestones, the session-end celebration and the daily goal bar
    await page.evaluate(() => { window.SHANLU_MUTE_SFX = true; window.__sfxLog = []; });
    const key2 = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
    await key2(' '); await key2('3'); await key2(' '); await key2('1');
    const log1 = await page.evaluate(() => window.__sfxLog.join(','));
    check(log1 === 'ok,bad', 'a right answer plays the ding and a missed one the soft tone (' + log1 + ')');
    await page.evaluate(() => { window.shanlu.go('voice'); }); await page.waitForTimeout(150);
    await page.locator('button', { hasText: /^Sounds are on/ }).click(); await page.waitForTimeout(100);
    await page.evaluate(() => { window.__sfxLog = []; window.shanlu.go('review'); window.shanlu.practiceAnyway(); }); await page.waitForTimeout(150);
    await key2(' '); await key2('3');
    check(await page.evaluate(() => window.__sfxLog.length === 0), 'with sounds turned off in Settings nothing plays');
    await page.evaluate(() => { window.shanlu.go('voice'); }); await page.waitForTimeout(150);
    await page.locator('button', { hasText: /^Sounds are off/ }).click(); await page.waitForTimeout(100);
    check(await page.evaluate(() => window.__sfxLog.join(',') === 'ok'), 'turning sounds back on plays a sample');
    check(await page.evaluate(() => { window.shanlu.go('review'); return true; }) && (await page.locator('.dgoal').count()) === 1, 'the daily goal is shown while studying');
    await page.evaluate(() => { const a = window.shanlu; const today = new Date(); const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); a.setState({ streak: 7, lastActive: ymd(today), msQueue: [] }); a.persistNow(); });
    await page.waitForTimeout(200);
    const ms = await page.evaluate(() => (window.shanlu.state.msQueue || []).map(x => x.title).join('|'));
    check(/full week/.test(ms) && (await page.locator('.mstoast').count()) === 1, 'reaching a 7-day streak shows a milestone toast (' + ms + ')');
    await page.evaluate(() => { const a = window.shanlu; a.setState({ msQueue: [] }); a.persistNow(); }); await page.waitForTimeout(150);
    check(await page.evaluate(() => !(window.shanlu.state.msQueue || []).some(x => /full week/.test(x.title))), 'a milestone is shown only once');
    await page.evaluate(() => { const a = window.shanlu; a.setState({ rq: [], rtotal: 12, rcomplete: true, rcounts: { again: 1, hard: 1, good: 6, easy: 4 }, rxp: 40 }); }); await page.waitForTimeout(200);
    const cel = await page.locator('.res.celebrate').innerText();
    check(/right first time/.test(cel) && /day streak/.test(cel) && (await page.locator('.confetti').count()) === 1 && /83%\s+right first time/.test(cel) && /\+40\s+coins/.test(cel), 'the end of a session is a celebration with the accuracy, XP and streak');
    await page.evaluate(() => { window.SHANLU_MUTE_SFX = false; const a = window.shanlu; a.setState({ rcomplete: false }); a.go('review'); a.practiceAnyway(); }); await page.waitForTimeout(150);
    {   // achievements: the page, and the things that earn them
      const titles = () => page.evaluate(() => (window.shanlu.state.msQueue || []).map(x => x.title).join('|'));
      await page.evaluate(() => { window.SHANLU_MUTE_SFX = true; const a = window.shanlu; a.setState({ msQueue: [], rcomplete: false }); a.go('review'); a.practiceAnyway(); }); await page.waitForTimeout(150);
      await page.evaluate(() => { const a = window.shanlu; a.setState({ rq: [a.state.rq[0]], rtotal: 12, rcomplete: false, rcounts: { again: 0, hard: 0, good: 11, easy: 0 } }); a.rAdvance(); }); await page.waitForTimeout(300);
      check(/Flawless session/.test(await titles()), 'finishing a 10+ card session without a miss earns "Flawless session" (' + await titles() + ')');
      await page.evaluate(() => { const a = window.shanlu; a.setState({ msQueue: [] }); const h = Date.prototype.getHours; Date.prototype.getHours = () => 6; a.setState({ xp: a.state.xp + 1 }); Date.prototype.getHours = h; }); await page.waitForTimeout(300);
      check(/Early bird/.test(await titles()), 'studying at 6 in the morning earns "Early bird" (' + await titles() + ')');
      await page.evaluate(() => { const a = window.shanlu; a.setState({ msQueue: [] }); const h = Date.prototype.getHours; Date.prototype.getHours = () => 23; a.setState({ xp: a.state.xp + 1 }); Date.prototype.getHours = h; }); await page.waitForTimeout(300);
      check(/Night owl/.test(await titles()), 'studying at 11 at night earns "Night owl" (' + await titles() + ')');
      await page.evaluate(() => {   // a week and more away: every saved progress last studied long ago, then the first study of today
        const a = window.shanlu; a.setState({ msQueue: [] });
        Object.values(window.ShanluLevel.PROGRESS_KEYS).concat(['shanlu-progress-v1-all']).forEach(k => { try { const st = JSON.parse(localStorage.getItem(k)); if (st) { st.activity = {}; st.lastActive = '2020-01-01'; localStorage.setItem(k, JSON.stringify(st)); } } catch (e) {} });
        window.__ach0 = { streak: a.state.streak, lastActive: a.state.lastActive, activity: a.state.activity };
        a.setState({ activity: {}, lastActive: '2020-01-01' }); a.setState({ xp: a.state.xp + 1 });
      }); await page.waitForTimeout(300);
      check(/Welcome back/.test(await titles()), 'studying again after a long time away earns "Welcome back" (' + await titles() + ')');
      await page.evaluate(() => { const a = window.shanlu; a.setState(window.__ach0); a.setState({ msQueue: [] }); });
      const am = await page.evaluate(() => { const a = window.shanlu; const m = a.achMetrics(); return { lv1: m.lv[1], lv2: !!m.lv[2], gwrote: m.gwrote }; });
      check(am.lv1 && am.lv1.total > 100 && am.lv1.lessonsTotal > 5 && am.lv2, 'the achievements know each level\'s words and lessons (' + JSON.stringify(am.lv1) + ')');
      await page.evaluate(() => { window.shanlu.go('acct'); }); await page.waitForTimeout(150);
      check((await page.locator('.acct-row', { hasText: 'Achievements' }).count()) === 1, 'Achievements is reached from the Account page');
      await page.evaluate(() => { window.shanlu.go('ach'); }); await page.waitForTimeout(200);
      const ach = await page.locator('.ach').innerText();
      check(/\d+ of \d+ earned/.test(ach) && /Streaks/.test(ach) && /Habits/.test(ach) && /Collecting/.test(ach) && /Friends/.test(ach) && (await page.locator('.ach-card.got').count()) >= 3 && (await page.locator('.ach-card.lock').count()) >= 10, 'the Achievements page lists earned and locked achievements by group');
      check(/Path/.test(ach) && /Sounds/.test(ach) && /First step on the Path/.test(ach) && /First conversation/.test(ach) && /Word family complete/.test(ach) && /A full day/.test(ach), 'the Achievements page has Path and Sounds groups, plus the word family and full-day badges');
      check((await page.locator('.ach-card.got', { hasText: 'Flawless session' }).count()) === 1 && (await page.locator('.ach-card.lock .ach-pb').count()) >= 3, 'earned ones are lit and locked ones show how far along you are');
      await page.evaluate(() => { window.SHANLU_MUTE_SFX = false; const a = window.shanlu; a.go('review'); a.practiceAnyway(); }); await page.waitForTimeout(150);
    }
  }
  await shot('05-review-front');
  // answer without flipping: pinyin button shows/hides pinyin on the front only; quick buttons rate straight away
  check((await page.locator('.fc-fpy').count()) === 0, 'review front shows no pinyin at first');
  await page.locator('button', { hasText: 'Show pinyin' }).click();
  await page.waitForTimeout(100);
  check((await page.locator('.fc-fpy').count()) === 1 && !(await page.evaluate(() => window.shanlu.state.rflip)), 'Show pinyin reveals the pinyin without flipping the card');
  await page.locator('button', { hasText: 'Hide pinyin' }).click();
  check((await page.locator('.fc-fpy').count()) === 0, 'Hide pinyin hides it again');
  const rqBefore = await page.evaluate(() => window.shanlu.state.rdone + window.shanlu.state.rq.length);
  await page.locator('button', { hasText: 'Show pinyin' }).click();
  check((await page.locator('.rates .rate').allInnerTexts()).map(t => t.split('\n')[0]).join('|') === 'Again|Hard|Good|Easy', 'the front of the card offers all four ratings');
  await page.locator('.rates .rate').nth(2).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.rdone)) === 1 && !(await page.evaluate(() => window.shanlu.state.rflip)), 'Good on the front rates the card without flipping it');
  check((await page.locator('.fc-fpy').count()) === 0 && (await page.locator('button', { hasText: 'Show pinyin' }).count()) === 1, 'the pinyin peek is for one card only: the next card starts with it hidden');
  check((await page.locator('button', { hasText: 'Hear the word' }).count()) === 0, 'the word is not played before you answer (the sound would give away the tones)');
  await page.locator('.rates .rate').nth(0).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.rdone)) === 1 && (await page.evaluate(() => window.shanlu.state.rq.length)) === rqBefore - 1, 'Again on the front sends the card to the back of the queue');
  await page.locator('button', { hasText: 'Show answer' }).click();
  await page.waitForTimeout(800);
  check((await page.locator('.rates .rate').count()) === 4, 'the back of the card offers the same four ratings');
  await shot('06-review-back');
  for (let i = 0; i < practiceN + 3 && !(await text()).includes('cards done'); i++) {
    if (!(await page.evaluate(() => window.shanlu.state.rflip))) await page.locator('button', { hasText: 'Show answer' }).click();
    await page.locator('.rates .rate').nth(2).click();
    await page.waitForTimeout(60);
  }
  check((await text()).includes('cards done'), 'review finishes');
  // make 100 words due: there is no cap, all 100 are in one round, in a jumbled order
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).slice(0, 100).forEach(zh => { ws[zh].see = { s:1, l:5 }; }); app.setState({ ws, rq:[], rcomplete:false }); window.__listOrder = Object.keys(ws).slice(0, 100); });
  await nav('Review words');
  check((await text()).includes('More words are due') && (await text()).includes('Review 100 words'), 'all due words are offered in one round, with no limit');
  await page.locator('button', { hasText: 'Review 100 words' }).click();
  await page.waitForTimeout(100);
  const rq = await page.evaluate(() => window.shanlu.state.rq.slice());
  check(rq.length === 100, 'a review round holds every due word (100), not just 30');
  const inListOrder = await page.evaluate(() => { const q = window.shanlu.state.rq.slice(0, 20); const idx = q.map(z => window.__listOrder.indexOf(z)); return idx.every((v, i) => i === 0 || v > idx[i - 1]); });
  check(!inListOrder, 'the words come in a jumbled order, not in word-list order');
  await page.evaluate(() => { window.shanlu.setState({ rq:[], rcomplete:true }); });
  await page.waitForTimeout(100);
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).forEach(zh => { if (ws[zh].see.s === 1 && ws[zh].see.l === 5) ws[zh].see = { s:30, l:0 }; }); app.setState({ ws, rq:[], rcomplete:false }); });

  // the tabs run learn -> practice -> check -> your words, and the logo goes Home
  check(JSON.stringify(await page.locator('.navg .nav').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim()))) === JSON.stringify(['Today', 'Learn', 'Review', 'Talk', 'Journey']), 'the five tabs are in learning order on a wide window too');
  await nav('Review words');
  check(JSON.stringify(await page.locator('.navsub .subl').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim()))) === JSON.stringify(['Words', 'Grammar', 'Test']), 'the open tab lists its pages under itself in the sidebar: Words, Grammar, Test');
  await nav('Grammar');
  await page.locator('.brand').click();
  await page.waitForTimeout(120);
  check(await page.evaluate(() => window.shanlu.state.screen) === 'home', 'clicking the logo goes Home');
  // Listening lab
  await nav('Listening lab');
  check(await page.evaluate(() => window.HSK1_LISTEN.clips.length) >= 20, 'there are at least 20 listening clips');
  await page.locator('button.listen').click();
  // the lab opens on a random clip (never numbered), and "Another clip" gives a different one
  check(!(await text()).includes('Clip 1 of') && (await text()).includes('What do you hear?') && (await text()).includes('clips tried'), 'the Listening lab shows no clip numbers');
  const firstClip = await page.evaluate(() => window.shanlu.state.dclip);
  let moved = false;
  for (let i = 0; i < 5 && !moved; i++) { await page.locator('button', { hasText: 'Another clip' }).click(); moved = (await page.evaluate(() => window.shanlu.state.dclip)) !== firstClip; }
  check(moved, 'Another clip gives a different clip');
  const typedAns = await page.evaluate(() => window.HSK1_LISTEN.clips[window.shanlu.state.dclip].words.map(w => w.key).join(' '));
  await page.fill('#dict-input', typedAns);
  await page.locator('button', { hasText: 'Check' }).click();
  await page.waitForTimeout(150);
  check(/(\d+) of \1 words caught/.test(await text()), 'dictation scores a correct answer');
  await shot('07-listening');
  await page.locator('button', { hasText: 'Shadowing' }).click();
  for (let i = 0; i < 3; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Next clip'), 'shadowing completes after three rounds');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('button.listen').click();
  await page.locator('.tonebtn').first().click();

  // two-syllable tone trainer
  await page.locator('button', { hasText: 'Two syllables' }).click();
  check((await text()).includes('Which tones did you hear?') && (await page.locator('.tones').count()) === 2, 'the tone trainer has a two-syllable mode with a row of tones for each syllable');
  const heardPair = async () => page.evaluate(() => { const last = window.__spoken[window.__spoken.length - 1]; const p = window.HSK1_LISTEN.pairs.find(x => x.zh === (last && last.text)); return p ? { zh: p.zh, t: p.t } : null; });
  await page.locator('button[aria-label="Play a two-syllable word"]').click();
  await page.waitForTimeout(300);
  const pair1 = await heardPair();
  check(!!pair1 && pair1.t.length === 2 && pair1.zh.length === 2, 'a two-syllable word is read aloud (' + (pair1 && pair1.zh) + ')');
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(pair1.t[0] - 1).click();
  check(!(await text()).includes('Right.') && !(await text()).includes('Not quite.'), 'one syllable picked is not an answer yet');
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(pair1.t[1] - 1).click();
  check((await text()).includes('Right. ' + pair1.zh) && (await text()).includes('1 of 1 right'), 'the right tones for both syllables are marked right and scored');
  await page.locator('button[aria-label="Play a two-syllable word"]').click();
  await page.waitForTimeout(300);
  const pair2 = await heardPair();
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(pair2.t[0] % 4).click();   // always a different first tone (and not the 2 that also counts for 3 + 3)
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(pair2.t[1] - 1).click();
  check((await text()).includes('Not quite. ' + pair2.zh) && (await text()).includes('1 of 2 right'), 'a wrong first tone is marked wrong and the answer is shown');
  check(await page.evaluate(() => { const l = window.HSK1_LISTEN.pairs; return l.length > 100 && l.every(p => p.t.length === 2 && p.t[0] >= 1 && p.t[0] <= 4 && p.t[1] >= 1 && p.t[1] <= 5); }), 'the HSK 1 tone-pair list holds real two-syllable words with tones 1-4 first and 1-5 second');
  const sandhi = await page.evaluate(() => { const p = window.HSK1_LISTEN.pairs.find(x => x.t[0] === 3 && x.t[1] === 3); window.shanlu.setState({ t2idx: window.HSK1_LISTEN.pairs.filter(q => window.HSK1_WORDS.some(w => w.zh === q.zh)).findIndex(q => q.zh === p.zh), t2a: null, t2b: null }); return p.zh; });
  await page.locator('.tones').nth(0).locator('.tonebtn').nth(1).click();   // "2" for the first syllable of a 3 + 3 word
  await page.locator('.tones').nth(1).locator('.tonebtn').nth(2).click();
  check((await text()).includes('Right. ' + sandhi) && (await text()).includes('rising tone'), 'for 3 + 3 words, 2 + 3 also counts as right, with the reason');
  await page.locator('button', { hasText: 'One syllable' }).click();
  check((await text()).includes('Which tone did you hear?'), 'the one-syllable trainer comes back');

  // recorded audio: a text listed in the manifest plays its file instead of the browser voice
  const wavBody = (() => { const n = 4000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
  const audioAsked = []; let audioFound = true;
  await ctx.route('**/audio/*', async (r) => { audioAsked.push(decodeURIComponent(new URL(r.request().url()).pathname)); if (audioFound) await r.fulfill({ status: 200, contentType: 'audio/wav', body: wavBody }); else await r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from('this is not audio') }); });
  await page.evaluate(() => { ['妈', '麻', '马', '骂'].forEach(z => { window.SHANLU_AUDIO[z] = 'mp3'; }); });
  const spokenBeforeRec = await page.evaluate(() => window.__spoken.length);
  await page.locator('button.listen').first().click();
  await page.waitForTimeout(600);
  check(audioAsked.some(u => /\/audio\/[妈麻马骂]\.mp3$/.test(u)), 'a text with a recording asks for its audio file');
  check(await page.evaluate((n) => window.__spoken.length === n, spokenBeforeRec), 'the recording is played instead of the browser voice');
  audioFound = false;
  await page.locator('button.listen').first().click();
  await page.waitForTimeout(800);
  check(await page.evaluate((n) => window.__spoken.length > n, spokenBeforeRec), 'if the audio file cannot be played, the browser voice reads it instead');
  await page.evaluate(() => { ['妈', '麻', '马', '骂'].forEach(z => { delete window.SHANLU_AUDIO[z]; }); });

  // Grammar
  await nav('Grammar');
  check((await page.locator('.gl .gg').count()) === 11 && (await page.locator('.gl .gg .gg-n').allInnerTexts()).reduce((a, t) => a + parseInt(t.split('/')[1], 10), 0) === 26, 'grammar lists 26 lessons in 11 categories');
  check((await page.locator('.gl .gp').count()) < 26 && (await page.locator('.gl .gg.open').count()) === 1, 'only the open category shows its lessons');
  check((await text()).toLowerCase().includes('lesson 1 of 26'), 'the first lesson is open');
  await page.evaluate(() => { window.shanlu.go('greview'); }); await page.waitForTimeout(150);
  check((await page.locator('.grv').count()) === 1 && (await page.locator('.grv-go .btn.pri').count()) === 1, 'the Review section has a Grammar review panel');
  check(/unlock/.test(await page.locator('.grv-go .btn.pri').innerText()), 'before any grammar lesson is passed, Grammar review is locked and says so');
  const gl = await page.evaluate(() => { const a = window.shanlu; const L = Object.keys(window.HSK1_GRAMMAR.points.reduce((o, p) => { o[p.lesson] = 1; return o; }, {}))[0]; a.setState({ gres: Object.assign({}, a.state.gres, { [L]: 90 }) }); return L; });
  await page.waitForTimeout(150);
  await page.locator('.grv-go .btn.pri').click(); await page.waitForTimeout(150);
  check(await page.evaluate((L) => { const S = window.shanlu.state; const ok = window.shanlu.quizQs.length > 0 && window.shanlu.quizQs.every(q => window.HSK1_GRAMMAR.points.find(p => p.id === q.pt).lesson === L); return S.qmode === 'greview' && S.screen === 'quiz' && ok; }, gl), 'once a lesson is passed, Start grammar review asks only about the points of passed lessons');
  {   // after each grammar-review card the point's percentage change is shown, as in Review words
    await page.evaluate(() => { const a = window.shanlu; const pid = a.quizQs[0].pt; a.gptRecord(pid, 'r', true, 'good'); a.gptRecord(pid, 'r', true, 'good'); }); await page.waitForTimeout(150);
    const up = await page.locator('.delta.up').first().innerText().catch(() => '');
    check(/, recognising: \d+% → \d+%/.test(up) && (await page.locator('.delta.up').count()) === 1, 'after a grammar-review answer the point\'s change is shown (' + up + ')');
    await page.evaluate(() => { const a = window.shanlu; a.gptRecord(a.quizQs[0].pt, 'r', false, 'again'); }); await page.waitForTimeout(150);
    check((await page.locator('.delta.down').count()) === 1, 'a missed grammar-review card shows the percentage going down');
    check(await page.evaluate(() => getComputedStyle(document.body).touchAction === 'manipulation' || getComputedStyle(document.querySelector('.app')).touchAction === 'manipulation'), 'double-tap zoom is switched off (touch-action: manipulation)');
  }
  await page.evaluate(() => { window.shanlu.exitQuiz(); }); await page.waitForTimeout(150);
  check(await page.evaluate(() => window.shanlu.state.screen === 'greview'), 'leaving a grammar review returns to the Grammar review screen');
  await nav('Grammar'); await page.waitForTimeout(100);
  await shot('08-grammar');
  await page.fill('.gl .tr-search', 'yes/no');
  check((await page.locator('.gl .gp').count()) === 1, 'searching for a lesson shows only the matching lessons');
  await page.locator('.gl .gp', { hasText: 'Yes/no questions with 吗' }).click();
  check((await text()).includes('Yes/no questions with 吗'), 'choosing a lesson opens it');
  check((await text()).includes('你想喝茶吗'), 'the 吗 lesson teaches the offer with 想');
  check(await page.locator('.lesson .expl p').count() >= 2 && (await page.locator('.lesson').innerText()).toLowerCase().includes('the full explanation'), 'the full grammar explanation is shown by default');
  check(await page.locator('.lesson .formula .fchip').count() >= 2 && await page.locator('.ex2').count() >= 3, 'a lesson shows its formula and example cards');
  await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
  await page.waitForTimeout(100);
  // a wrong answer first: feedback should say so and the combo resets
  await answer(false);
  check((await text()).includes('Not quite'), 'a wrong grammar answer is marked wrong');
  await shot('09-quiz-feedback');
  await page.locator('button', { hasText: 'Continue' }).click();
  for (let i = 1; i < 5; i++) {
    await answer(true);
    await page.locator('button', { hasText: i === 4 ? 'See results' : 'Continue' }).click();
    await page.waitForTimeout(40);
  }
  check((await text()).includes('4/5'), 'one wrong answer scores 4/5');
  await shot('10-results');
  await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
  await page.waitForTimeout(100);
  await nav('Grammar');
  check((await page.locator('.gl .gp.cur').first().innerText()).includes('80%'), 'the lesson shows its best score');
  // pass every question of another lesson (all question types appear across lessons)
  for (const idx of [0, 4, 14, 20]) {
    await page.evaluate((i) => window.shanlu.pickLesson(i), idx);
    await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
    await page.waitForTimeout(80);
    const total = await runQuiz(true);
    check((await text()).includes(total + '/' + total), 'lesson ' + (idx + 1) + ' scores ' + total + '/' + total + ' with right answers');
    await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
    await nav('Grammar');
  }
  check(await page.evaluate(() => Object.values(window.shanlu.state.gres).filter(v => v >= 80).length) >= 4, 'passed lessons are marked done');

  // Test
  await nav('Tests');
  check((await text()).includes('No tests yet'), 'tests show an empty history at first');
  await page.locator('button', { hasText: 'Start the test' }).click();
  await page.waitForTimeout(100);
  const tq = await page.evaluate(() => window.shanlu.quizQs.length);
  check(tq >= 5 && tq <= 10, 'the test has 5 to 10 questions (' + tq + ')');
  const kinds = await page.evaluate(() => Array.from(new Set(window.shanlu.quizQs.map(q => q.type))));
  check(kinds.length >= 3, 'the test mixes question types: ' + kinds.join(', '));
  await runQuiz(true);
  check((await text()).includes(tq + '/' + tq), 'test scores full marks with correct answers');
  await nav('Tests');
  check(!(await text()).includes('No tests yet'), 'test result is saved to history');
  const hear = await page.evaluate(() => Object.values(window.shanlu.state.ws).filter(w => w.hear.s > 0 || w.prod.s > 0).length);
  check(hear >= 1, 'test answers update the Hear / Recall bars of words');

  // Speak
  await nav('Speak');
  check((await page.locator('.spk-card').count()) === 8, 'speaking lists 8 places to pick from');
  await page.locator('.spk-card').first().click();
  check((await page.locator('.chat.staged .stage').count()) === 1 && (await page.locator('.scn').count()) === 8, 'picking a place opens its scene and the list of 8 scripts');
  for (let i = 0; i < 4; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Conversation complete'), 'the first speaking script completes');
  await page.locator('.scn').nth(1).click();
  check((await page.locator('.chat-t').innerText()).includes('Introduce yourself'), 'choosing another script opens it');
  for (let i = 0; i < 4; i++) await page.locator('button', { hasText: 'I said it' }).click();
  check((await text()).includes('Conversation complete'), 'the second speaking script completes');
  check((await page.locator('.scn.done').count()) >= 2, 'finished scripts are marked done');
  await shot('11-speak');

  // listen only: hide characters, pinyin and English
  await page.locator('.scn').nth(2).click();
  const firstAi = await page.evaluate(() => window.HSK1_SPEAK.scenarios[2].ai.map(x => x.zh));
  const chat0 = await page.locator('.msgs').innerText();
  check(chat0.includes(firstAi[0]), 'speaking shows the characters by default');
  for (const b of ['Characters', 'Pinyin', 'English']) await page.locator('.chat-h .seg2 button', { hasText: b }).click();
  await page.waitForTimeout(60);
  const chat1 = await page.locator('.msgs').innerText();
  check(!chat1.includes(firstAi[0]) && chat1.includes('Listen to Mingming'), 'with everything hidden the chat shows no Chinese or English, only the sound button');
  await page.locator('button', { hasText: 'I said it' }).click();
  await page.waitForTimeout(500);   // desktop audio waits a moment for the sound card to wake
  const lastSaid = await page.evaluate(() => window.__spoken[window.__spoken.length - 1]);
  check(lastSaid && lastSaid.text === firstAi[1], 'in listen-only mode Mingming\'s next line plays by itself');
  await page.locator('.chat-h .seg2 button', { hasText: 'Characters' }).click();
  check((await page.locator('.msgs').innerText()).includes(firstAi[0]), 'Characters brings the Chinese back');
  await page.reload();
  await page.waitForSelector('.app');
  await nav('Speak');
  check((await page.locator('.spk-card').count()) === 8, 'after a reload Speak opens on the places to pick from');
  await page.locator('.spk-card').first().click();
  check(!(await page.locator('.chat-h .seg2 button', { hasText: 'Pinyin' }).getAttribute('class') || '').includes('on'), 'the hidden pinyin and English stay hidden after a reload');
  await page.locator('.chat-h .seg2 button', { hasText: 'Pinyin' }).click();
  await page.locator('.chat-h .seg2 button', { hasText: 'English' }).click();

  // Mock exam: the bank, the draw, and a full sitting
  const drawCheck = await page.evaluate(() => {
    const bad = []; const app = window.shanlu;
    for (let t = 0; t < 60; t++) ['listening', 'reading'].forEach(sec => {
      const qs = app.examDraw(sec);
      if (qs.length !== 20) bad.push(sec + ' has ' + qs.length + ' questions');
      const ids = new Set(qs.map(q => q.id)); if (ids.size !== 20) bad.push('duplicate question ids');
      const parts = {}; qs.forEach(q => { parts[q.part] = (parts[q.part] || 0) + 1; });
      if (Object.keys(parts).length !== 4 || Object.values(parts).some(n => n !== 5)) bad.push('parts are not 4 x 5: ' + JSON.stringify(parts));
      qs.forEach(q => {
        const vals = q.opts.map(o => o.v);
        if (!vals.includes(q.ans)) bad.push(q.id + ': the answer is not one of the options');
        if (new Set(q.opts.map(o => o.label)).size !== q.opts.length) bad.push(q.id + ': two options look the same');
      });
      ['L3', 'R2', 'R3', 'R4'].forEach(p => { const g = qs.filter(q => q.part === p); if (g.length && new Set(g.map(q => q.ans)).size !== 5) bad.push(p + ': two questions share an answer'); });
      ['L1', 'R1'].forEach(p => { const g = qs.filter(q => q.part === p); const t = g.filter(q => q.ans === 'T').length; if (g.length && (t < 2 || t > 3)) bad.push(p + ': true/false balance ' + t); });
    });
    return bad.slice(0, 5);
  });
  check(drawCheck.length === 0, '60 random exams are well formed: 20 + 20 questions, 4 parts of 5, one right answer each' + (drawCheck.length ? ' ' + drawCheck.join('; ') : ''));
  await nav('Level exam');
  check((await text()).includes('HSK 1 mock exam') && (await page.locator('button', { hasText: 'Start the full exam' }).count()) === 1, 'the exam page offers the full exam');
  const answerAll = async (right) => {
    const total = await page.evaluate(() => window.shanlu.state.exm.qs.length);
    for (let i = 0; i < total; i++) {
      const q = await page.evaluate(() => { const m = window.shanlu.state.exm; const q = m.qs[m.i]; return { ans: q.ans, vals: q.opts.map(o => o.v) }; });
      let target = q.vals.indexOf(q.ans);
      if (!right) target = (target + 1) % q.vals.length;
      await page.locator('.ex-opt').nth(target).click();
      if (i < total - 1) await page.locator('.ex-nav button', { hasText: 'Next' }).click();
    }
  };
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  check((await text()).includes('Listening') && (await text()).includes('Question 1 of 20') && /\d+:\d\d/.test(await page.locator('.ex-timer').innerText()), 'the exam shows the section, the question number and a timer');
  const spokenBefore = await page.evaluate(() => window.__spoken.length);
  await page.locator('.ex-play button').click();
  await page.waitForTimeout(500);
  await page.locator('.ex-play button').click();
  await page.waitForTimeout(500);
  const spokenTwo = await page.evaluate(() => window.__spoken.length);
  await page.locator('.ex-play button').click({ force: true });
  check((await page.evaluate(() => window.__spoken.length)) === spokenTwo, 'a third play does nothing');
  const spokenAfter = await page.evaluate(() => window.__spoken.length);
  check(spokenAfter - spokenBefore >= 2 && (await text()).includes('0 plays left'), 'a listening clip can be played twice, then no more');
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('Listening is done') && (await text()).includes('20 of 20'), 'finishing the listening section of the full exam shows a break with the score');
  await page.locator('button', { hasText: 'Start Reading' }).click();
  check((await text()).includes('Reading') && (await text()).includes('Question 1 of 20'), 'the full exam goes on to reading');
  await answerAll(true);
  // make the last five wrong: go back and change them
  for (let k = 15; k < 20; k++) {
    await page.locator('.ex-pal button', { hasText: new RegExp('^' + (k + 1) + '$') }).click();
    const q = await page.evaluate(() => { const m = window.shanlu.state.exm; const q = m.qs[m.i]; return { ans: q.ans, vals: q.opts.map(o => o.v) }; });
    await page.locator('.ex-opt').nth((q.vals.indexOf(q.ans) + 1) % q.vals.length).click();
  }
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  const rt = await text();
  check(rt.includes('Your result') && rt.includes('175 / 200'), 'the result adds up: 20 + 15 right is 175 of 200');
  check(rt.includes('At or above 120') && !rt.includes('seal earned'), 'a pass on points but no seal when a section is under 80%');
  check((await page.locator('.exw').count()) === 5, 'the review lists the 5 missed questions');
  await shot('22-exam-result');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();
  check((await text()).includes('Full exam') && (await text()).includes('175 / 200'), 'the attempt appears in the exam history');
  await page.locator('button', { hasText: 'Reading only' }).click();
  await page.locator('button', { hasText: 'Submit reading' }).click();
  check((await text()).includes('20 question(s) are unanswered'), 'submitting with unanswered questions asks first');
  await page.locator('button', { hasText: 'Submit reading' }).click();
  check((await text()).includes('0 of 20') && (await text()).includes('One section only'), 'a section on its own is scored on its own');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

  // The lock: HSK 2 stays closed until a full exam is passed with 80% in both sections
  await openLv(page); check((await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 2"))').getAttribute('class') || '').includes('locked'), 'HSK 2 shows a lock before the exam is passed');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[1]), 'a full exam with a section under 80% does not open HSK 2');
  await openLv(page); await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 2"))').click();
  check((await text()).includes('HSK 2 is locked') && window_level_still_1(await page.evaluate(() => window.SHANLU_LEVEL)), 'pressing the locked HSK 2 explains how to open it and stays on HSK 1');
  await page.locator('button', { hasText: 'Go to the HSK 1 exam' }).click();
  check((await text()).includes('HSK 1 mock exam'), 'the lock message leads to the exam');
  await page.locator('button', { hasText: 'Start the full exam' }).click();
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit listening' }).click();
  await page.locator('button', { hasText: 'Start Reading' }).click();
  await answerAll(true);
  await page.locator('button', { hasText: 'Submit reading' }).click();
  await page.waitForTimeout(100);
  const pt = await text();
  check(pt.includes('seal earned') && pt.includes('HSK 2 is now open') && pt.includes('200 / 200'), 'a perfect full exam earns the seal and says HSK 2 is open');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[1]), 'the pass is remembered');
  await openLv(page); check(!(await page.locator('.lvpanel .lvitem:has(.lvn:text-is("HSK 2"))').getAttribute('class') || '').includes('locked'), 'the lock on HSK 2 is gone');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

  // Exam + home
  await nav('Level exam');
  await shot('12-exam');
  await nav('Home');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'streak counts after activity');
  check((await text()).includes('lessons passed') && (await text()).includes('scripts done'), 'home shows grammar and speaking progress');
  await shot('13-home-after');

  // persistence
  await nav('Archive');
  if (!(await page.locator('[aria-label="New words per day"]').count())) await page.locator('.capbtn').click();
  await page.locator('[aria-label="New words per day"] button', { hasText: /^10$/ }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.app');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'progress survives a reload');
  await nav('Grammar');
  check(await page.evaluate(() => Object.values(window.shanlu.state.gres).filter(v => v >= 80).length) >= 4, 'passed lessons survive a reload');
  await nav('Speak');
  check((await page.locator('.spk-card.done').count()) >= 2, 'finished speaking scripts survive a reload');
  await nav('Archive');
  check(/of 10 added today/.test(await text()), 'a chosen daily limit survives a reload');
  await nav('My words');
  check(!(await text()).includes('0 words started'), 'word progress survives a reload');


  // Chinese voice picker
  const lastSpoken = async () => { await page.waitForTimeout(500); return page.evaluate(() => window.__spoken[window.__spoken.length - 1] || null); };
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.waitForTimeout(100);
  const vt = await text();
  check(vt.includes('Lili (Premium)') && vt.includes('Tingting') && vt.includes('Meijia'), 'voice screen lists the Mandarin voices');
  check(!vt.includes('Sinji') && !vt.includes('Daniel'), 'Cantonese and English voices are left out of the list');
  check(vt.includes('Automatic: Lili (Premium)'), 'automatic picks the Premium mainland voice over compact ones');
  await page.locator('button', { hasText: /^Play$/ }).first().click();
  let sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.premium.zh-CN.Lili' && sp.lang === 'zh-CN', 'automatic plays with the Premium voice and its own language tag');
  check(sp.rate === 1, 'audio plays at the voice\'s normal speed by default');
  await page.locator('button', { hasText: /^Slow$/ }).click();
  sp = await lastSpoken();
  check(sp.rate === 0.75 && (await page.evaluate(() => window.shanlu.state.speed)) === 0.75, 'the Slow speed setting slows the audio and is remembered');
  await page.locator('button', { hasText: /^Normal$/ }).click();
  sp = await lastSpoken();
  check(sp.rate === 1, 'Normal puts the speed back');
  await page.locator('.vrow', { hasText: 'Tingting' }).locator('button', { hasText: /^Play$/ }).click();
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.compact.zh-CN.Tingting', 'a sample plays with the voice you tapped');
  check(await page.evaluate(() => window.shanlu.state.voiceId === ''), 'playing a sample does not change the chosen voice');
  await page.locator('.vrow', { hasText: 'Tingting' }).locator('button', { hasText: 'Use this voice' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.vrow.on').innerText()).includes('Tingting'), 'the chosen voice is marked in use');
  await page.evaluate(() => window.shanlu.say('你好', 'x'));
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.compact.zh-CN.Tingting', 'the rest of the site now speaks with the chosen voice');
  await page.reload();
  await page.waitForSelector('.app');
  check(await page.evaluate(() => window.shanlu.state.voiceId === 'com.apple.voice.compact.zh-CN.Tingting'), 'the chosen voice survives a reload');
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: 'Use automatic' }).click();
  await page.evaluate(() => window.shanlu.say('你好', 'x'));
  sp = await lastSpoken();
  check(sp && sp.voice === 'com.apple.voice.premium.zh-CN.Lili', 'going back to automatic uses the Premium voice again');
  await page.locator('button', { hasText: /Show every voice/ }).click();
  check((await text()).includes('Sinji · zh-HK'), 'the full voice list shows every voice the browser reports');
  await shot('21-voice');
  await page.locator('button', { hasText: 'Back to home' }).click();

  // 儿 endings switch
  const OFFICIAL_ER = ['面条儿', '一点儿', '有点儿', '好玩儿', '这儿', '那儿', '哪儿'];
  const modeNow = await page.evaluate((er) => ({ words: window.HSK1_WORDS.map(w => w.zh), er }), OFFICIAL_ER);
  if (erhuaMode) check(OFFICIAL_ER.every(z => modeNow.words.includes(z)), 'exam style keeps all seven 儿 words');
  else check(!OFFICIAL_ER.some(z => modeNow.words.includes(z)) && modeNow.words.includes('面条') && modeNow.words.includes('哪里'), 'plain mode has no 儿 words and uses 面条 and 哪里');
  // In plain mode the only 儿 left should be the real character 儿 "child" (儿子, 女儿 and their notes), plus typed answers that still accept the 儿 form.
  const leftovers = await page.evaluate(() => {
    const out = [];
    const walk = (v, where) => {
      if (typeof v === 'string') { if (/儿/.test(v.replace(/女儿|儿子/g, ''))) out.push(where + ': ' + v); }
      else if (Array.isArray(v)) { if (!/\.accepts$/.test(where)) v.forEach((x, i) => walk(x, where + '[' + i + ']')); }
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k));
    };
    ['HSK1_WORDS', 'HSK1_GRAMMAR', 'HSK1_WEBS', 'HSK1_SPEAK', 'HSK1_LISTEN'].forEach(k => walk(window[k], k));
    return out;
  });
  const okLeft = (l) => /parts\[\d\]\[0\]: 儿$/.test(l) || /opps\[\d+\]\.note: Son and daughter/.test(l);
  if (!erhuaMode) check(leftovers.every(okLeft) && leftovers.length === 3, 'plain mode leaves no 儿 ending in the content (only the "child" character is left)' + (leftovers.every(okLeft) ? '' : ': ' + leftovers.filter(l => !okLeft(l)).slice(0, 3).join(' | ')));
  const myKey = erhuaMode ? '面条儿' : '面条', otherKey = erhuaMode ? '面条' : '面条儿';
  await page.evaluate((k) => { const ws = Object.assign({}, window.shanlu.state.ws); ws[k] = { see: { s: 7, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws }); window.shanlu.persistNow(); }, myKey);
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes(erhuaMode ? 'Now: 儿 endings are on' : 'Now: plain forms'), 'the voice and 儿 screen says which style is on');
  await Promise.all([page.waitForNavigation(), page.locator('button', { hasText: erhuaMode ? 'Switch to plain forms' : 'Switch to 儿 endings' }).click()]);
  await page.waitForSelector('.app');
  const flipped = await page.evaluate((a) => ({ n: window.HSK1_WORDS.length, has: window.HSK1_WORDS.some(w => w.zh === a), s: window.shanlu.state.ws[a] && window.shanlu.state.ws[a].see.s, gone: window.shanlu.state.ws[a === '面条' ? '面条儿' : '面条'] === undefined }), otherKey);
  check(flipped.n === (erhuaMode ? 297 : 300) && flipped.has, 'switching flips the word list (' + flipped.n + ' words)');
  check(flipped.s === 7, 'progress on a renamed word carries over when the style switches (' + myKey + ' to ' + otherKey + ')');
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await Promise.all([page.waitForNavigation(), page.locator('button', { hasText: erhuaMode ? 'Switch to 儿 endings' : 'Switch to plain forms' }).click()]);
  await page.waitForSelector('.app');
  const back = await page.evaluate((a) => ({ n: window.HSK1_WORDS.length, s: window.shanlu.state.ws[a] && window.shanlu.state.ws[a].see.s }), myKey);
  check(back.n === WORD_COUNT && back.s === 7, 'switching back restores the list and the progress');

  // real time: a word reviewed 3 days ago with a 1.5-day interval is due; one reviewed just now is not
  const timeCheck = await page.evaluate(() => {
    const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
    const keys = Object.keys(ws); const a = keys[10], b = keys[11];
    keys.forEach(z => { ws[z] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    ws[a].see = { s: 1.5, l: 0, t: Date.now() - 3 * 864e5 };
    ws[b].see = { s: 1.5, l: 0, t: Date.now() };
    app.setState({ ws, rq: [], rcomplete: false });
    app.reviewMore();
    return { a, b, rq: app.state.rq.slice() };
  });
  check(timeCheck.rq.includes(timeCheck.a) && !timeCheck.rq.includes(timeCheck.b), 'a word becomes due as real days pass (reviewed 3 days ago is due, just now is not)');
  // a listening answer starts the "hear" timer: when it is overdue it comes back as an audio card of its own
  const hearCheck = await page.evaluate(() => {
    const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
    const keys = Object.keys(ws); const a = keys[20], b = keys[21], c = keys[22];
    keys.forEach(z => { ws[z] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
    const now = Date.now();
    ws[a] = { see: { s: 5, l: 0, t: now }, hear: { s: 0.4, l: 0, t: now - 3 * 864e5 }, prod: { s: 5, l: 0, t: now } };     // reviewed just now, old listening answer
    ws[b] = { see: { s: 1.5, l: 0, t: now - 3 * 864e5 }, hear: { s: 5, l: 0, t: now }, prod: { s: 1.5, l: 0, t: now - 3 * 864e5 } };   // see/prod really overdue
    ws[c] = { see: { s: 0, l: 0 }, hear: { s: 0.4, l: 0, t: now - 3 * 864e5 }, prod: { s: 0, l: 0 } };   // only ever heard, overdue
    app.setState({ ws, rq: [], rcomplete: false });
    app.reviewMore();
    return { a, b, c, rq: app.state.rq.slice() };
  });
  check(!hearCheck.rq.includes(hearCheck.a) && hearCheck.rq.includes(hearCheck.a + '#h') && hearCheck.rq.includes(hearCheck.b) && hearCheck.rq.includes(hearCheck.c + '#h'), 'every skill has its own timer: an overdue listening answer comes back as an audio card, not as a recognition card');
  // pinyin word boundaries: solid words are one unit, in the content and in the AI conversation
  check(await page.evaluate(() => { const all = JSON.stringify(window.HSK1_WORDS.map(w => [w.ex].concat(w.more || []).map(e => e.py))); return !/qián biān|wài guó rén|měi tiān/.test(all) && all.includes('qiánbian'); }), 'sentence pinyin writes 前边 as one word (qiánbian), not qián biān');
  check(await page.evaluate(() => { const T = window.shanlu.testApi; return T.aiPinyin(T.segHsk('每天我在家。')) === 'Měitiān wǒ zài jiā.' && T.aiPinyin(T.segHsk('商店在学校前边。')).endsWith('qiánbian.') && T.aiPinyin(T.segHsk('外国人也想学汉语。')).startsWith('Wàiguórén'); }), 'the AI conversation spaces solid words (每天, 前边, 外国人) the same way, with no "not on the lists" flag');
  check(await page.evaluate(() => { const T = window.shanlu.testApi; return T.segHsk('每天').every(x => x.ok); }), 'a solid word that is not on the HSK list is not flagged as outside the lists');
  // levels: each exam section can be passed on its own; the lock can be set to open
  const lockT = await page.evaluate(() => {
    const L = window.ShanluLevel; const e = (o) => Object.assign({ at: 1, lt: 20, rt: 20 }, o);
    return {
      both: L.passedList([e({ mode: 'full', l: 17, r: 17 })]),
      split: L.passedList([e({ mode: 'listening', l: 18, r: null }), e({ mode: 'reading', l: null, r: 16 })]),
      retake: L.passedList([e({ mode: 'listening', l: 10, r: null }), e({ mode: 'listening', l: 17, r: null }), e({ mode: 'reading', l: null, r: 20 })]),
      oneOnly: L.passedList([e({ mode: 'listening', l: 20, r: null })]),
      low: L.passedList([e({ mode: 'full', l: 15, r: 20 })]),
      best: L.bestSections([e({ mode: 'listening', l: 12, r: null }), e({ mode: 'listening', l: 18, r: null })]).l
    };
  });
  check(lockT.both && lockT.split && lockT.retake && !lockT.oneOnly && !lockT.low && lockT.best === 90, 'a level passes when the best listening result and the best reading result are both 80%, from one sitting or from separate retakes');
  const lockOpen = await page.evaluate(() => { const L = window.ShanluLevel; const before = L.unlocked(2); const p = JSON.parse(localStorage.getItem('shanlu-person') || '{}'); p.prefs = p.prefs || {}; p.prefs.softLock = { v: true, at: Date.now() }; localStorage.setItem('shanlu-person', JSON.stringify(p)); const open = L.unlocked(2) && L.softLock(); p.prefs.softLock = { v: false, at: Date.now() }; localStorage.setItem('shanlu-person', JSON.stringify(p)); return { before, open, after: L.unlocked(2) }; });
  check(lockOpen.before === lockOpen.after && lockOpen.open, 'switching the level lock to open unlocks the next level without the exam, and back');
  // typed pinyin: tones count, with feedback that says what was right
  const cp = (inp, py, opt) => page.evaluate(([i, p, o]) => { const r = window.shanlu.testApi.comparePinyin(i, p, o); return { ok: r.ok, grade: r.grade, note: r.note }; }, [inp, py, !!opt]);
  check((await cp('nǐ hǎo', 'nǐ hǎo')).ok && (await cp('ni3 hao3', 'nǐ hǎo')).ok && (await cp('ni3hao3', 'nǐ hǎo')).ok && (await cp('Nǐ Hǎo', 'nǐ hǎo')).ok, 'tone marks or tone numbers are both accepted, with or without spaces');
  const noTone = await cp('ni hao', 'nǐ hǎo');
  check(!noTone.ok && noTone.grade === 'hard' && /tones count/.test(noTone.note), 'a toneless answer is not marked right, and says the tones count');
  check((await cp('ni hao', 'nǐ hǎo', true)).ok, 'with "tones optional" on, a toneless answer is accepted');
  const wrongTone = await cp('ni4 hao3', 'nǐ hǎo');
  check(!wrongTone.ok && wrongTone.grade === 'hard' && /wrong tone/.test(wrongTone.note) && wrongTone.note.includes('nǐ hǎo'), 'right sounds with a wrong tone get partial feedback and the right answer');
  check((await cp('ni2 hao3', 'nǐ hǎo')).ok, 'the spoken 3+3 -> 2+3 change is accepted too');
  check((await cp('xie4xie', 'xièxie')).ok && (await cp('xie4xie5', 'xièxie')).ok && (await cp('xie4 xie4', 'xièxie')).grade === 'hard', 'neutral tones: the unmarked syllable may be written plainly or with 5');
  check((await cp('nv3', 'nǚ')).ok && (await cp('nü3', 'nǚ')).ok && (await cp('nu3', 'nǚ')).ok, 'ü may be written v, ü or u');
  check((await cp('shui', 'shéi')).grade === 'again' || (await cp('chi1', 'shéi')).grade === 'again', 'different sounds are simply wrong');
  // the scheduler: a lapse then a same-session relearn does not inflate the interval; more difficulty grows slower; desired retention moves due dates
  const sched = await page.evaluate(() => {
    const T = window.shanlu.testApi; const now = Date.now();
    const d90 = { s: 90, l: 0, t: now - 90 * 864e5, d: 5 };
    const lapse = T.bump(d90, 'again');
    const relearn = T.bump(lapse, 'good', { relearn: true });
    const grown = T.bump({ s: 10, l: 0, t: now - 10 * 864e5, d: 5 }, 'good');
    const hard = T.bump({ s: 10, l: 0, t: now - 10 * 864e5, d: 9 }, 'good');
    const easy = T.bump({ s: 10, l: 0, t: now - 10 * 864e5, d: 2 }, 'good');
    return { lapse: lapse.s, relearn: relearn.s, grown: grown.s, hard: hard.s, easy: easy.s, dLapse: lapse.d };
  });
  check(sched.lapse === 6 && sched.relearn === 6, 'a word forgotten at 90 days comes back after about 6 days, and relearning in the same session does not make it jump (' + sched.lapse + ' then ' + sched.relearn + ')');
  check(sched.hard < sched.grown && sched.grown < sched.easy && sched.dLapse > 5, 'a harder card grows its interval more slowly than an easy one, and a lapse makes a card harder');
  const ret = await page.evaluate(() => {
    const app = window.shanlu; const T = app.testApi; const zh = Object.keys(app.state.ws)[5]; const now = Date.now();
    const ws = JSON.parse(JSON.stringify(app.state.ws)); ws[zh].see = { s: 10, l: 0, t: now - 12 * 864e5, d: 5 };
    const due = (r) => { app.setRetention(r); return T.buildQueue(ws, false, {}).includes(zh); };
    const out = { at90: due(0.9), at80: due(0.8), k80: T.retK() }; app.setRetention(0.9); return out;
  });
  check(ret.at90 && !ret.at80 && ret.k80 > 2 && ret.k80 < 2.6, 'a lower desired retention spaces reviews further apart: 12 days after a review a word is due at 90% but not at 80%');
  // Review cards of the other kinds, checked for you and written to the log
  await page.evaluate(() => { window.SHANLU_AUTO_SHARE = 100; });
  const mk = await page.evaluate(() => {
    const app = window.shanlu; const keys = Object.keys(app.state.ws).slice(30, 36); const now = Date.now(); const ws = JSON.parse(JSON.stringify(app.state.ws));
    keys.forEach(z => { ws[z] = { see: { s: 3, l: 0, t: now - 5 * 864e5, d: 5 }, hear: { s: 3, l: 0, t: now - 5 * 864e5, d: 5 }, prod: { s: 3, l: 0, t: now - 5 * 864e5, d: 5 } }; });
    app.setState({ ws, rq: [], rcomplete: false, lrn: {}, rlog: [], screen: 'review' }); app.reviewMore();
    return { n: app.state.rq.length, items: app.state.rq.slice(), keys };
  });
  check(mk.items.some(i => i.endsWith('#p')) && mk.items.some(i => i.endsWith('#h')) && mk.items.some(i => !i.includes('#')), 'a word due in every skill gives a recognition card, a saying card and an audio card');
  await page.waitForTimeout(150);
  const seen = {};
  for (let i = 0; i < 40 && (await page.evaluate(() => window.shanlu.state.rq.length)) > 0; i++) {
    const info = await page.evaluate(() => { const a = window.shanlu; return { it: a.state.rq[0], kind: a.rKind(a.state.rq[0]) }; });
    seen[info.kind] = true;
    if (info.kind === 'type') {   // first without tones: close but not right; then right
      await page.fill('#answer-input', await page.evaluate(() => window.shanlu.quizQs[0].exp.py.replace(/[^a-züǖ\s]/gi, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, ''))));
      await page.locator('button', { hasText: 'Check' }).click();
      const fb = await page.locator('.fb').innerText();
      if (!seen.noTone) { seen.noTone = /close/i.test(fb) && /tones count/i.test(fb); }
      await page.locator('button', { hasText: 'Continue' }).click();
    } else { await driveCard(); }
  }
  check(seen.choice && seen.audio && seen.type, 'Review mixes checked-for-you cards: choice, audio and typed (' + Object.keys(seen).join(', ') + ')');
  check(seen.noTone === true, 'a typed answer without tones is "Close" with a note that tones count');
  const lg = await page.evaluate(() => window.shanlu.state.rlog.map(e => e[4] + e[2]));
  check(lg.some(x => x === 'cs') && lg.some(x => x === 'ah') && lg.some(x => x === 'tp'), 'the log records the kind of card and the skill (' + [...new Set(lg)].join(' ') + ')');
  await page.evaluate(() => { window.SHANLU_AUTO_SHARE = 0; });
  // the honesty check compares self-ratings with the cards that were checked for you
  await page.evaluate(() => { const app = window.shanlu; const t = Date.now(); const log = []; for (let i = 0; i < 10; i++) log.push([t + i, 'w', 's', 'g', 'f']); for (let i = 0; i < 10; i++) log.push([t + 20 + i, 'w', 's', i < 4 ? 'g' : 'a', 'c']); app.setState({ rlog: log, rcomplete: true, rq: [] }); });
  await nav('Review words');
  check((await text()).includes('Honesty check') && (await text()).includes('marked 100% of your flip cards') && (await text()).includes('got 40% right') && (await text()).includes('a little generous'), 'the finished screen compares your self-ratings with your checked answers');
  await page.evaluate(() => window.shanlu.setState({ rcomplete: false, rq: [], rlog: [] }));
  // the daily goal offers "Learn new words" only while some words are not started
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).forEach(z => { ws[z].see = { s: 3, l: 0, t: Date.now() }; ws[z].prod = { s: 3, l: 0, t: Date.now() }; }); app.setState({ ws, rq: [], rcomplete: false, webCredited: false, screen: 'home' }); });
  await page.waitForTimeout(200);
  check(!(await text()).includes('with their relatives') && !(await text()).includes('with its relatives'), 'with every word started the daily goal has no Learn-new-words task');
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); ws['一'] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; const lrn = Object.assign({}, app.state.lrn); delete lrn['一']; const wlearned = Object.assign({}, app.state.wlearned); delete wlearned['一']; app.setState({ ws, lrn, wlearned }); });
  await page.waitForTimeout(200);
  check(/Path: /.test(await text()), 'with one word left Today still has its Path step');
  await page.evaluate(() => { const app = window.shanlu; app.setState({ wlearned: Object.assign({}, app.state.wlearned, { '一': true }) }); });
  await page.waitForTimeout(150);
  check(!(await text()).includes('Count to five') && !(await text()).includes('new word with its relatives'), 'a word that has been met (waiting in Review) no longer counts as left to learn');
  await page.evaluate(() => { const app = window.shanlu; const wl = Object.assign({}, app.state.wlearned); delete wl['一']; app.setState({ wlearned: wl }); });
  {   // adding new words in Word webs (a topic's "add all") ticks the daily goal task
    const before = await page.evaluate(() => { const a = window.shanlu; const S = a.state; return JSON.stringify({ lrn: S.lrn, wlearned: S.wlearned, webCredited: S.webCredited, dayMin: S.dayMin, ws: S.ws }); });
    const r = await page.evaluate(() => {
      const a = window.shanlu; const S = a.state;
      const ws = JSON.parse(JSON.stringify(S.ws)); const zs = Object.keys(ws).slice(0, 5); zs.forEach(z => { ws[z] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; });
      a.setState({ ws, lrn: {}, wlearned: {}, webCredited: false });
      const m0 = a.state.dayMin; a.learnMany(zs.slice(0, 3)); const mid = a.state.webCredited;
      a.learnMany(zs.slice(3, 5)); return { mid, after: a.state.webCredited, dm: a.state.dayMin - m0 };
    });
    check(!r.mid && r.after && r.dm === 0, 'adding the day\'s new words in Word webs ticks the Learn goal on the home page without adding minutes (' + JSON.stringify(r) + ')');
    await page.evaluate((b) => { const o = JSON.parse(b); window.shanlu.setState({ lrn: o.lrn, wlearned: o.wlearned, webCredited: o.webCredited, dayMin: o.dayMin, ws: o.ws }); }, before);
    await page.waitForTimeout(150);
  }

  // sync across devices, against a fake GitHub (two separate browsers sharing one gist)
  const S2 = require('../sync.js');
  const fakeGists = {}; let gistN = 0;
  const route = async (r) => {
    const req = r.request(); const u = new URL(req.url()); const method = req.method(); const j = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if ((req.headers()['authorization'] || '') !== 'Bearer ghp_test') return j({ message: 'Bad credentials' }, 401);
    if (method === 'GET' && u.pathname === '/gists') return j(Object.keys(fakeGists).map(id => ({ id, files: fakeGists[id] })));
    if (method === 'POST' && u.pathname === '/gists') { const b = JSON.parse(req.postData()); const id = 'g' + (++gistN); fakeGists[id] = { [S2.FILE]: { content: b.files[S2.FILE].content } }; return j({ id }, 201); }
    const m = u.pathname.match(/^\/gists\/(\w+)$/);
    if (m && method === 'GET') return fakeGists[m[1]] ? j({ id: m[1], files: fakeGists[m[1]] }) : j({}, 404);
    if (m && method === 'PATCH') { fakeGists[m[1]][S2.FILE].content = JSON.parse(req.postData()).files[S2.FILE].content; return j({}); }
    return j({}, 500);
  };
  await ctx.route('https://api.github.com/**', route);
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('Sync across devices') && (await page.locator('input[aria-label="GitHub token"]').count()) === 1, 'settings has a sync card with a token box');
  await page.fill('input[aria-label="GitHub token"]', 'nope');
  await page.locator('button', { hasText: 'Connect' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  check((await text()).includes('rejected the token'), 'a wrong token is explained, not silent');
  await page.locator('button', { hasText: 'Disconnect this device' }).click();
  await page.fill('input[aria-label="GitHub token"]', 'ghp_test');
  await page.evaluate(() => { const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws)); ws['你好'] = { see: { s: 9, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws, xp: 777 }); });
  await page.locator('button', { hasText: 'Connect' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  check((await text()).includes('private GitHub gist') && Object.keys(fakeGists).length === 1, 'connecting creates one private gist');
  check(!JSON.stringify(fakeGists).includes('ghp_test'), 'the token is not written into the gist');
  // device two: a fresh browser
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.route('https://api.github.com/**', route);
  const p2 = await ctx2.newPage();
  await p2.goto(url); await p2.waitForSelector('.app');
  check(await p2.evaluate(() => window.shanlu.state.xp === 0), 'a second browser starts with nothing');
  await p2.locator('button', { hasText: 'Settings' }).first().click();
  await p2.fill('input[aria-label="GitHub token"]', 'ghp_test');
  await p2.locator('button', { hasText: 'Connect' }).click();
  await p2.waitForFunction(() => !window.shanlu.state.syncBusy && window.shanlu.state.syncMsg);
  const got = await p2.evaluate(() => ({ xp: window.shanlu.state.xp, s: window.shanlu.state.ws['你好'].see.s }));
  check(got.xp === 777 && got.s === 9, 'the second browser gets the first one\'s progress after connecting');
  await p2.evaluate(() => { const ws = JSON.parse(JSON.stringify(window.shanlu.state.ws)); ws['谢谢'] = { see: { s: 4, l: 0, t: Date.now() }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; window.shanlu.setState({ ws }); });
  await p2.locator('button', { hasText: 'Sync now' }).click();
  await p2.waitForFunction(() => !window.shanlu.state.syncBusy);
  await page.locator('button', { hasText: 'Sync now' }).click();
  await page.waitForFunction(() => !window.shanlu.state.syncBusy);
  check(await page.evaluate(() => window.shanlu.state.ws['谢谢'].see.s === 4 && window.shanlu.state.ws['你好'].see.s === 9), 'work done on the second browser reaches the first after a sync');
  await ctx2.close();
  await page.locator('button', { hasText: 'Disconnect this device' }).click();
  await page.locator('button', { hasText: 'Back to home' }).click();

  // AI conversation, against a fake Anthropic API
  const aiCalls = [];
  let aiMode2 = 'ok';
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData());
    aiCalls.push({ headers: req.headers(), body });
    if (aiMode2 === 'bad-key') return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{}' });
    const n = aiCalls.length;
    const reply = n === 1 ? { reply: { zh: '你好！你想喝什么？', en: 'Hello! What do you want to drink?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我想喝茶。', en: 'I want to drink tea.' } }
      : n === 2 ? { reply: { zh: '好的，你想去公园吗？', en: 'Okay, do you want to go to the park?' }, feedback: { level: 'fix', better: '我想喝茶。', why: 'Add 想 to say you would like something.' }, suggest: n === 2 ? { zh: '我想去学校。', en: 'I want to go to school.' } : undefined }
      : n === 3 ? { reply: { zh: '很好！你想喝咖啡吗？', en: 'Very good! Would you like coffee?' }, feedback: { level: 'ok', better: '', why: '' } }
      : { reply: { zh: '很好！', en: 'Very good!' }, feedback: { level: 'ok', better: '', why: '' } };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'Here you go: ' + JSON.stringify(reply) }] }) });
  });
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('AI conversation (optional)'), 'settings has an AI conversation card');
  await page.fill('input[aria-label="Anthropic API key"]', 'sk-ant-test');
  await page.locator('button', { hasText: 'Save key' }).click();
  check((await text()).includes('Saved on this device') && (await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).key === 'sk-ant-test')), 'the key is saved on this device');
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  check(await page.locator('input[aria-label="Your reply"]').count() === 0 && (await page.locator('.ai-tools').innerText()).includes('Type instead'), 'voice only is the default: no typing box until you ask for it');
  await page.locator('.ai-tools button', { hasText: 'Type instead' }).click();
  const first = await page.locator('.msgs').innerText();
  check(first.includes('你好！你想喝什么？') && first.includes('Nǐ hǎo! Nǐ xiǎng hē shénme?'), 'Mingming opens the conversation, with pinyin from the site\'s own word list');
  check(aiCalls[0].headers['x-api-key'] === 'sk-ant-test' && aiCalls[0].headers['anthropic-dangerous-direct-browser-access'] === 'true' && /^claude-/.test(aiCalls[0].body.model), 'the request carries the key and a Claude model name');
  check(aiCalls[0].body.system.includes('米饭') && aiCalls[0].body.system.includes('HSK 1'), 'the instructions hold the HSK 1 word list');
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__spoken[window.__spoken.length - 1].text)) === '你好！你想喝什么？', 'Mingming\'s reply is spoken aloud');
  check(await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).count() === 1 && !(await page.locator('.ai-dock').innerText()).includes('Wǒ xiǎng hē chá'), 'a suggested reply is offered but not shown until you ask');
  await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).click();
  const sugTxt = await page.locator('.ai-dock').innerText();
  check(sugTxt.includes('我想喝茶。') && sugTxt.includes('Wǒ xiǎng hē chá.') && sugTxt.includes('I want to drink tea.'), 'the suggested reply shows characters, pinyin with tone marks and English');
  await page.locator('button[aria-label="Hear the suggested reply"]').click();
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__spoken[window.__spoken.length - 1].text)) === '我想喝茶。', 'the suggested reply can be played');
  await page.locator('.ai-tools button', { hasText: 'Speak' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiInput === '我想喝茶');
  check((await page.inputValue('input[aria-label="Your reply"]')) === '我想喝茶', 'the microphone puts what it heard in the box to check');
  const mo = await page.evaluate(() => window.__micOpts);
  check(mo && mo.continuous === true && mo.interim === true && mo.alts >= 3 && mo.lang === 'zh-CN', 'the microphone keeps listening through pauses, shows words as they come and asks for several guesses');
  await page.waitForFunction(() => !window.shanlu.state.aiListen, null, { timeout: 5000 });
  // the recogniser's first guess is wrong, a later guess is made of HSK 1 characters and matches the suggested reply: that one is chosen, the other is offered
  await page.evaluate(() => { window.__micAlts = ['我想和察', '我想喝茶', '我想喝查']; });
  await page.locator('.ai-tools button', { hasText: 'Speak' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiInput === '我想喝茶');
  check((await page.locator('.alts').innerText()).includes('我想和察'), 'the other guesses can be tapped if the microphone still heard it wrong');
  await page.locator('.alts button', { hasText: '我想和察' }).click();
  check((await page.inputValue('input[aria-label="Your reply"]')) === '我想和察', 'tapping another guess puts it in the box');
  await page.evaluate(() => { window.__micAlts = ['我想喝茶']; });
  await page.locator('.ai-tools button', { hasText: 'Speak' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiInput === '我想喝茶');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 3 && !window.shanlu.state.aiBusy);
  const second = await page.locator('.msgs').innerText();
  check(second.includes('我想喝茶') && second.includes('A more natural way') && second.includes('Add 想'), 'the correction of your line is shown under it');
  check(second.includes('Matches the suggested reply'), 'saying the suggested reply is recognised as a match');
  check(second.includes('so no pinyin') && second.includes('公') && !second.includes('Not in this site\'s HSK 1 or HSK 2 lists, so no pinyin: 想'), 'words outside the HSK 1 and HSK 2 lists in a reply are flagged');
  check(aiCalls[1].body.messages.length >= 3 && aiCalls[1].body.messages[aiCalls[1].body.messages.length - 1].content === '我想喝茶', 'the conversation so far is sent along');
  const exported = await page.evaluate(() => { window.shanlu.persistNow(); return JSON.stringify(JSON.parse(localStorage.getItem('shanlu-progress-v1'))); });
  check(!exported.includes('sk-ant-test'), 'the key is not in the saved progress (so not in the export or the sync)');
  await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).click();
  await page.fill('input[aria-label="Your reply"]', '我想去商店');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 5 && !window.shanlu.state.aiBusy);
  const third = await page.locator('.msgs').innerText();
  check(third.includes('Not the same as the suggestion') && third.includes('我想去学校。') && third.includes('商'), 'a reply that differs from the suggestion shows what was suggested and where it differs');
  check(third.includes('咖啡') && third.includes('HSK 2 preview') && third.includes('kāfēi = coffee') && third.includes('Nǐ xiǎng hē kāfēi'), 'an HSK 2 word in a reply is allowed and comes with pinyin and English');
  check(!third.split('\n').some(l => l.includes('so no pinyin') && l.includes('咖')), 'an HSK 2 word is not flagged as outside the lists');
  check(aiCalls[0].body.system.includes('咖啡') && aiCalls[0].body.system.includes('HSK 2'), 'the instructions allow a few HSK 2 words and list them');
  aiMode2 = 'bad-key';
  await page.fill('input[aria-label="Your reply"]', '你好');
  await page.locator('.ai-in button', { hasText: 'Send' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiErr);
  check((await text()).includes('API key was rejected'), 'a rejected key is explained');
  // Alibaba Qwen: chat and voice recogniser, against a fake Alibaba API
  const aliCalls = [];
  let aliChatN = 0, ttsMode2 = 'ok', aliUnderstood = null, aliRemember = [];
  const silentWav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64');
  await ctx.route('https://tts-files.test/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'audio/wav', body: silentWav }));
  const aliHandler = async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData());
    aliCalls.push({ url: req.url(), headers: req.headers(), body });
    if (body.model === 'qwen3-tts-flash') {
      if (ttsMode2 === 'fail') return r.fulfill({ status: 500, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'InternalError', message: 'voice service down' }) });
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ request_id: 'x', output: { audio: { url: 'http://tts-files.test/' + encodeURIComponent(body.input.voice + '-' + body.input.text) + '.wav', data: '' } }, usage: { characters: body.input.text.length } }) });
    }
    if (body.model === 'qwen3-asr-flash') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: '我想喝茶' } }] }) });
    const last = body.messages[body.messages.length - 1].content;
    if (last === 'Reply with the single word OK.') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'OK' } }] }) });
    aliChatN++;
    const reply = aliChatN === 1 ? { reply: { zh: '你好！你想去哪儿？', en: 'Hello! Where do you want to go?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我想去学校。', en: 'I want to go to school.' } }
      : { reply: { zh: '好的。', en: 'Okay.' }, feedback: { level: 'ok', better: '', why: '' } };
    if (aliUnderstood !== null) reply.feedback.understood = aliUnderstood;
    reply.remember = aliRemember;
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(reply) } }] }) });
  };
  await ctx.route('https://dashscope-intl.aliyuncs.com/**', aliHandler);
  await ctx.route('https://testws1.ap-southeast-1.maas.aliyuncs.com/**', aliHandler);
  await page.locator('.modeseg button', { hasText: 'Practice script' }).click();
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: /^Qwen \(Alibaba\)/ }).click();
  check((await text()).includes('Key Management') && !(await text()).includes('console.anthropic.com and add'), 'the Qwen tab shows the Alibaba steps instead of the Claude ones');
  await page.fill('input[aria-label="Alibaba API key"]', 'sk-ali-test');
  await page.locator('button', { hasText: /^Save$/ }).click();
  check((await text()).includes('A key is saved on this device') && (await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).ali.key === 'sk-ali-test')), 'the Alibaba key is saved on this device');
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).key)) === 'sk-ant-test', 'saving the Alibaba key leaves the Claude key alone');
  check((await text()).includes('Claude (Anthropic) · in use') && !(await text()).includes('Qwen (Alibaba) · in use'), 'saving a second key does not switch services: Claude stays in use');
  await page.locator('button', { hasText: 'Use Qwen for conversation' }).click();
  check((await text()).includes('Qwen (Alibaba) · in use'), 'Use Qwen for conversation switches to Qwen and marks it in use');
  await page.locator('button', { hasText: 'Test connection' }).click();
  await page.waitForFunction(() => /Voice recogniser: working/.test(document.body.innerText), null, { timeout: 5000 });
  check((await text()).includes('Chat model (qwen-flash): working.') && (await text()).includes('Voice (qwen3-tts-flash): working.'), 'Test connection reports the chat model, the voice recogniser and the Qwen voice');
  const testCall = aliCalls.find(c => c.body.model === 'qwen3-asr-flash');
  check(testCall && testCall.headers['authorization'] === 'Bearer sk-ali-test' && testCall.url.startsWith('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions') && testCall.body.messages[0].content[0].input_audio.data.startsWith('data:audio/wav;base64,UklGR'), 'the recogniser request carries the key and a WAV clip to the Singapore endpoint');
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.waitForFunction(() => window.shanlu.state.aim.length >= 1 && !window.shanlu.state.aiBusy);
  const ali1 = await page.locator('.msgs').innerText();
  check(ali1.includes('你好！你想去哪儿？') && ali1.includes('Nǐ hǎo! Nǐ xiǎng qù nǎr?') || ali1.includes('Nǐ xiǎng qù nǎlǐ'), 'Qwen opens the conversation, with pinyin from the site\'s own word list');
  const chatCall = aliCalls.find(c => c.body.model === 'qwen-flash' && c.body.messages[0].role === 'system');
  check(chatCall && chatCall.headers['authorization'] === 'Bearer sk-ali-test' && chatCall.body.messages[0].content.includes('咖啡') && chatCall.body.response_format && chatCall.body.response_format.type === 'json_object', 'the Qwen request has the instructions as a system message, the key, and asks for JSON');
  check((await page.locator('.chat-t span').innerText()).includes('Qwen'), 'the chat header says Qwen is answering');
  check(await page.locator('.ai-dock button', { hasText: 'Suggest a reply' }).count() === 1, 'Qwen replies also come with a suggested reply');
  // voice: record from the (fake) microphone, send to Alibaba's recogniser, the text lands in the box
  await page.locator('.modeseg button', { hasText: 'Practice script' }).click();
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: /^Alibaba Qwen3-ASR/ }).click();
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  await page.fill('input[aria-label="Your reply"]', '');
  const asrBefore = aliCalls.filter(c => c.body.model === 'qwen3-asr-flash').length;
  await page.locator('.ai-tools button', { hasText: 'Speak' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiListen === true, null, { timeout: 5000 });
  check((await page.locator('.ai-tools').innerText()).includes('Listening'), 'recording shows that it is listening');
  await page.waitForTimeout(1200);
  await page.locator('.ai-tools button', { hasText: 'Listening' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiInput === '我想喝茶', null, { timeout: 8000 });
  const asrCalls = aliCalls.filter(c => c.body.model === 'qwen3-asr-flash');
  check(asrCalls.length === asrBefore + 1 && asrCalls[asrCalls.length - 1].body.messages[0].content[0].input_audio.data.length > 2000, 'recording is sent to Alibaba as a WAV clip and the words land in the box');
  const wavHead = Buffer.from(asrCalls[asrCalls.length - 1].body.messages[0].content[0].input_audio.data.split(',')[1].slice(0, 64), 'base64').toString('latin1');
  check(wavHead.startsWith('RIFF') && wavHead.slice(8, 12) === 'WAVE', 'the clip is a real WAV file');
  const wavBytes = Buffer.from(asrCalls[asrCalls.length - 1].body.messages[0].content[0].input_audio.data.split(',')[1], 'base64');
  check(wavBytes.readUInt32LE(24) === 16000 && wavBytes.readUInt16LE(22) === 1 && wavBytes.length > 44 + 16000 * 2 * 0.8, 'the clip is 16 kHz mono and holds about as much sound as was recorded (' + wavBytes.length + ' bytes), taken straight from the microphone');
  // voice only: what the microphone heard is sent by itself, Mingming answers out loud with the Qwen voice, her text stays hidden until tapped
  await page.locator('.ai-tools button', { hasText: 'Voice only' }).click();
  check(await page.locator('input[aria-label="Your reply"]').count() === 0, 'Voice only hides the typing box again');
  const nBefore = await page.evaluate(() => window.shanlu.state.aim.length);
  await page.locator('.ai-tools button', { hasText: /^Speak$/ }).click();
  await page.waitForFunction(() => window.shanlu.state.aiListen === true, null, { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.locator('.ai-tools button', { hasText: 'Listening' }).click();
  await page.waitForFunction((n) => window.shanlu.state.aim.length >= n + 2 && !window.shanlu.state.aiBusy, nBefore, { timeout: 10000 });
  const vo1 = await page.locator('.msgs').innerText();
  check(vo1.includes('我想喝茶') && vo1.includes('Listen to Mingming') && !vo1.includes('好的。'), 'in voice only the recognised line is sent by itself and shown, while Mingming\'s reply is hidden');
  const ttsReply = aliCalls.filter(c => c.body.model === 'qwen3-tts-flash' && c.body.input.text === '好的。');
  check(ttsReply.length === 1 && ttsReply[0].body.input.voice === 'Maia' && ttsReply[0].body.input.language_type === 'Chinese' && ttsReply[0].url === 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' && ttsReply[0].headers['authorization'] === 'Bearer sk-ali-test', 'the reply is read by the Qwen voice (Cherry) through Alibaba\'s speech endpoint');
  await page.waitForFunction((u) => window.shanlu.ttsEl && window.shanlu.ttsEl.src === u, 'https://tts-files.test/Maia-' + encodeURIComponent('好的。') + '.wav', { timeout: 5000 }).catch(() => {});
  check((await page.evaluate(() => window.shanlu.ttsEl && window.shanlu.ttsEl.src)) === 'https://tts-files.test/Maia-' + encodeURIComponent('好的。') + '.wav', 'the audio link Alibaba returned is what plays (upgraded to https)');
  await page.locator('.msgs button', { hasText: 'Show text' }).last().click();
  const vo2 = await page.locator('.msgs').innerText();
  check(vo2.includes('好的。') && vo2.includes('Okay.'), 'Show text reveals Mingming\'s line with pinyin and English');
  // the same line again comes from the cache (no second charge); another voice is used when chosen
  await page.locator('.msgs .spk').last().click();
  await page.waitForTimeout(300);
  check(aliCalls.filter(c => c.body.model === 'qwen3-tts-flash' && c.body.input.text === '好的。').length === 1, 'hearing a line again does not ask Alibaba again');
  await page.evaluate(() => window.shanlu.setTtsVoice('Neil'));
  await page.waitForTimeout(400);
  check(aliCalls.some(c => c.body.model === 'qwen3-tts-flash' && c.body.input.voice === 'Neil'), 'choosing a voice plays a sample in that voice');
  // if the Qwen voice fails the browser voice takes over and says so
  ttsMode2 = 'fail';
  await page.evaluate(() => { window.shanlu.ttsCache = {}; window.shanlu.ttsWarned = false; window.shanlu.setState({ aiErr:'' }); });
  await page.locator('.msgs .spk').last().click();
  await page.waitForFunction(() => window.shanlu.state.aiErr, null, { timeout: 5000 });
  check((await page.evaluate(() => window.shanlu.state.aiErr)).includes('Qwen voice did not work') && (await page.evaluate(() => window.shanlu.state.aiErr)).includes('voice service down'), 'when the Qwen voice fails you are told, and the browser voice is used instead');
  ttsMode2 = 'ok';
  await page.locator('.ai-tools button', { hasText: 'Type instead' }).click();
  check(await page.locator('input[aria-label="Your reply"]').count() === 1, 'Type instead brings the typing box back');
  // listening level: lines get faster and longer when you keep up, easier when you do not (device only)
  const sysOf = (i) => aliCalls.filter(c => c.body.messages && c.body.messages[0] && c.body.messages[0].role === 'system')[i];
  const lastSys = () => { const l = aliCalls.filter(c => c.body.messages && c.body.messages[0] && c.body.messages[0].role === 'system'); return l[l.length - 1].body.messages[0].content; };
  const say = async (t) => { const n = await page.evaluate(() => window.shanlu.state.aim.length); await page.evaluate((t) => { window.shanlu.setState({ aiInput: t }); window.shanlu.aiSend(); }, t); await page.waitForFunction((n) => window.shanlu.state.aim.length >= n + 2 && !window.shanlu.state.aiBusy, n, { timeout: 8000 }); };
  const lsn = () => page.evaluate(() => (JSON.parse(localStorage.getItem('shanlu-person') || '{}').lsn || {}).v || {});
  await page.evaluate(() => { window.shanlu.lsnStep(0); window.shanlu.aiStart(-1); });
  await page.waitForFunction(() => window.shanlu.state.aim.length === 1 && !window.shanlu.state.aiBusy);
  aliUnderstood = true;
  check((await text()).includes('Listening level 1 of 5 · slow and clear') && lastSys().includes('ONE very short sentence'), 'level 1 asks for one very short, slow sentence');
  check(lastSys().includes('"understood"') && lastSys().includes('PREVIOUS reply'), 'the instructions ask the AI to say whether you understood its last line');
  await say('你好'); await say('我想喝茶'); await say('我想去学校');
  check((await page.evaluate(() => window.shanlu.state.lsnLvl)) === 2 && (await text()).includes('You kept up: listening level 2 of 5') && (await lsn()).lvl === 2, 'three smooth turns in a row raise the listening level');
  await say('我很好');
  check(lastSys().includes('one or two short sentences (about 16 characters'), 'at level 2 Mingming\'s lines get a little longer');
  check((await page.evaluate(() => window.shanlu.lsnRate())) === 1, 'level 2 plays at the normal pace');
  aliUnderstood = false;
  await say('什么'); await say('我不知道');
  check((await page.evaluate(() => window.shanlu.state.lsnLvl)) === 1 && (await text()).includes('A little easier now: listening level 1 of 5'), 'two misunderstood lines in a row lower the level');
  check(Math.abs((await page.evaluate(() => window.shanlu.lsnRate())) - 0.85) < 0.001, 'level 1 plays slower');
  aliUnderstood = true;
  await page.evaluate(() => { const a = window.shanlu.state.aim; window.shanlu.aiSlower(a.length - 1); });
  await say('我想喝水');
  check((await lsn()).ok === 0 && (await lsn()).miss === 1, 'asking to hear a line slower counts as not having caught it');
  await page.locator('.ai-lsn button', { hasText: 'Harder' }).click();
  check((await page.evaluate(() => window.shanlu.state.lsnLvl)) === 2, 'Harder raises the level by hand');
  await page.locator('.ai-lsn button', { hasText: 'Auto-adjust: on' }).click();
  await say('好'); await say('好的'); await say('好吧'); await say('好啊');
  check((await page.evaluate(() => window.shanlu.state.lsnLvl)) === 2 && (await text()).includes('Auto-adjust: off'), 'with auto-adjust off the level stays where you put it');
  await page.locator('.ai-lsn button', { hasText: 'Auto-adjust: off' }).click();
  const exported2 = await page.evaluate(() => { window.shanlu.persistNow(); return JSON.stringify(JSON.parse(localStorage.getItem('shanlu-progress-v1'))); });
  check(!exported2.includes('"lsn"') && !exported2.includes('shanlu-person'), 'the listening level is not part of the synced progress');
  // what Mingming remembers (device only)
  aliRemember = ['learner likes hiking'];
  await say('我喜欢爬山');
  check((await page.evaluate(() => window.shanlu.state.memFacts.map(f => f.t))).join() === 'learner likes hiking', 'a lasting everyday fact is kept on this device');
  check((await page.locator('.msgs').innerText()).includes('Mingming will remember: learner likes hiking'), 'the chat says what it will remember');
  aliRemember = [];
  await say('你好');
  check(lastSys().includes('Things the learner told you in earlier chats') && lastSys().includes('learner likes hiking'), 'a remembered fact is passed to the next chat');
  aliRemember = ['learner likes hiking'];
  await say('好的');
  aliRemember = ['learner has diabetes', 'learner has a salary of 90k'];
  await say('我很好');
  aliRemember = ['learner has a cat'];
  await say('我有一只猫');
  const facts = await page.evaluate(() => window.shanlu.state.memFacts.map(f => f.t));
  check(facts.join() === 'learner likes hiking,learner has a cat', 'the same fact is not kept twice, and health or money facts are never kept (' + facts.join(' | ') + ')');
  const exported3 = await page.evaluate(() => { window.shanlu.persistNow(); return JSON.stringify(JSON.parse(localStorage.getItem('shanlu-progress-v1'))) + JSON.stringify(JSON.parse(localStorage.getItem('shanlu-friends') || 'null')); });
  check(!exported3.includes('hiking'), 'remembered facts are not in the saved progress (so not in the export, the sync or the friends server)');
  await page.locator('button', { hasText: 'Settings' }).first().click();
  check((await text()).includes('What Mingming remembers') && (await text()).includes('learner likes hiking') && (await text()).includes('learner has a cat'), 'Settings lists what Mingming remembers');
  await page.locator('button', { hasText: 'Forget' }).first().click();
  check((await page.evaluate(() => window.shanlu.state.memFacts.map(f => f.t))).join() === 'learner has a cat', 'one fact can be forgotten');
  await page.locator('button', { hasText: 'On: Mingming remembers' }).click();
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  aliRemember = ['learner likes tea'];
  await say('你好');
  check(lastSys().includes('Always use an empty list for "remember"') && !lastSys().includes('learner has a cat') && (await page.evaluate(() => window.shanlu.state.memFacts.length)) === 1, 'with memory switched off nothing is sent or kept');
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: 'Off: nothing is kept' }).click();
  await page.locator('button', { hasText: 'Forget everything' }).click();
  check((await page.evaluate(() => window.shanlu.state.memFacts.length)) === 0 && (await text()).includes('Nothing remembered yet'), 'Forget everything empties the list');
  aliRemember = [];
  await nav('Speak');
  await page.locator('.modeseg button', { hasText: 'Talk with AI' }).click();
  // hands-free: the microphone opens by itself when Mingming has finished speaking
  await page.locator('.ai-tools button', { hasText: 'Voice only' }).click();
  aliUnderstood = null;
  check((await page.locator('.ai-tools').innerText()).includes('Hands-free: off'), 'hands-free starts off');
  await page.locator('.ai-tools button', { hasText: 'Hands-free: off' }).click();
  await page.waitForFunction(() => window.shanlu.state.aiListen === true, null, { timeout: 5000 });
  check((await page.locator('.ai-tools').innerText()).includes('Hands-free: on') && (await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).handsFree)) === true && (await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person')).prefs.handsFree.v)) === true, 'turning hands-free on opens the microphone and is remembered');
  await page.waitForTimeout(1200);
  const hfN = await page.evaluate(() => window.shanlu.state.aim.length);
  await page.locator('.ai-tools button', { hasText: 'Listening' }).click();
  await page.waitForFunction((n) => window.shanlu.state.aim.length >= n + 2 && !window.shanlu.state.aiBusy, hfN, { timeout: 10000 });
  await page.waitForFunction(() => window.shanlu.state.aiListen === true, null, { timeout: 6000 });
  check(true, 'after Mingming finished speaking the microphone opened by itself');
  await page.locator('.ai-tools button', { hasText: 'Hands-free: on' }).click();
  await page.waitForTimeout(500);
  const hfM = await page.evaluate(() => window.shanlu.state.aim.length);
  await page.locator('.ai-tools button', { hasText: 'Listening' }).click();
  await page.waitForFunction((n) => window.shanlu.state.aim.length >= n + 2 && !window.shanlu.state.aiBusy, hfM, { timeout: 10000 });
  await page.waitForTimeout(2200);
  check((await page.evaluate(() => window.shanlu.state.aiListen)) === false, 'with hands-free off the microphone waits for you to tap Speak');
  // exam conversations: with a Qwen voice set up, the woman and the man are the same voices on every device
  await page.evaluate(() => { window.shanlu.setTtsMode('qwen'); window.shanlu.speakLines([{ text: '你好吗？', pitch: 1.25 }, { text: '我很好。', pitch: 0.8 }], 'exqtest'); });
  await page.waitForFunction(() => window.shanlu.state.playing === null || true, null, { timeout: 2000 });
  await page.waitForTimeout(1500);
  const exVoices = aliCalls.filter(c => c.body.model === 'qwen3-tts-flash' && (c.body.input.text === '你好吗？' || c.body.input.text === '我很好。')).map(c => c.body.input.voice + ':' + c.body.input.text);
  check(exVoices.join() === 'Maia:你好吗？,Kai:我很好。', 'an exam conversation is read by Qwen with a woman\'s voice and a man\'s voice, line by line (' + exVoices.join(' ') + ')');
  // a workspace ID changes the web address
  await page.evaluate(() => { const app = window.shanlu; app.setState({ aliWsInput:'testws1', aliKeyInput:'' }); app.aliSaveKey(); });
  await page.evaluate(() => window.shanlu.aliTest());
  check(aliCalls.some(c => c.url.startsWith('https://testws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions')), 'a workspace ID switches to the workspace web address');
  await page.evaluate(() => { const app = window.shanlu; app.setState({ aliWsInput:'' }); app.aliSaveKey(); app.setProvider('anthropic'); app.setAsr('browser'); });
  check((await page.evaluate(() => window.shanlu.state.aiProvider)) === 'anthropic', 'you can switch back to Claude');
  await page.locator('.modeseg button', { hasText: 'Practice script' }).click();
  await page.locator('button', { hasText: 'Settings' }).first().click();
  await page.locator('button', { hasText: 'Remove the key' }).click();
  check(!(await page.evaluate(() => localStorage.getItem('shanlu-ai') && JSON.parse(localStorage.getItem('shanlu-ai')).key)), 'the key can be removed');
  await page.locator('button', { hasText: 'Back to home' }).click();

  // export
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: 'Export progress' }).click();
  const d = await dl;
  check(/shanlu-progress-\d{4}-\d{2}-\d{2}\.json/.test(d.suggestedFilename()), 'export downloads a progress file');

  // dark mode + phone width
  await page.locator('button', { hasText: 'Switch to dark' }).click();
  await shot('14-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, name] of [['Home', '15-phone-home'], ['Archive', '16-phone-webs'], ['My words', '17-phone-words'], ['Grammar', '18-phone-grammar'], ['Speak', '19-phone-speak'], ['Listening lab', '20-phone-listen'], ['Review words', '20b-phone-review']]) {
    await nav(label);
    await shot(name);
    check(await noSideways(), 'no sideways scroll on ' + label + ' at phone width');
    if (['Review words', 'Listening lab', 'Speak'].includes(label)) check(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1 && getComputedStyle(document.querySelector('.app')).position === 'fixed'), label + ' fills the phone screen like an app, with no page scrolling');
  }
  {   // the end-of-session screen must fit a phone without scrolling (a small phone too), with its buttons above the bottom bar
    await nav('Review words');
    await page.evaluate(() => { const S = window.shanlu.state; window.__r0 = { rq: S.rq, rtotal: S.rtotal, rcomplete: S.rcomplete, rcounts: S.rcounts, rxp: S.rxp }; });
    for (const [w, h] of [[390, 844], [375, 667]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => { window.shanlu.setState({ rq: [], rtotal: 12, rcomplete: true, rcounts: { again: 2, hard: 1, good: 5, easy: 4 }, rxp: 40 }); });
      await page.waitForTimeout(300);
      const fit = await page.evaluate(() => { const r = document.querySelector('.res.celebrate'); const b = r.querySelector('.res-act').getBoundingClientRect(); const nav = document.querySelector('.navg').getBoundingClientRect(); return { inner: r.scrollHeight <= r.clientHeight + 1, doc: document.documentElement.scrollHeight <= window.innerHeight + 1, btn: b.bottom <= nav.top + 1, rs: r.scrollHeight, rch: r.clientHeight }; });
      check(fit.inner && fit.doc && fit.btn, 'the session-end screen fits a ' + w + 'x' + h + ' phone with no scrolling (' + JSON.stringify(fit) + ')');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.shanlu.setState(window.__r0); }); await page.waitForTimeout(200);
  }
  await page.locator('button', { hasText: 'Topics' }).first().click().catch(() => {});

  // phone navigation: five tabs that all fit, a strip for the screens of a section, one slim header, Today first
  await nav('Home');
  const bar = await page.evaluate(() => { const b = document.querySelector('.navg'); const r = b.getBoundingClientRect(); return { n: b.querySelectorAll('button').length, fits: b.scrollWidth <= b.clientWidth + 1, visible: r.height > 40 && r.bottom <= window.innerHeight + 1, sub: getComputedStyle(document.querySelector('.navsub') || document.body).display }; });
  check(bar.n === 5 && bar.fits && bar.visible, 'on a phone the bottom bar has five tabs that all fit, with no sideways scroll ' + JSON.stringify(bar));
  check((await page.locator('.navg button.nav').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').replace(/\d+$/, '').trim()).join('|') === 'Today|Learn|Review|Talk|Journey', 'the tabs are Today, Learn, Review, Talk, Journey');
  const homeTop = await page.evaluate(() => { const g = document.querySelector('.today-go').getBoundingClientRect(); return { y: g.bottom, h: window.innerHeight }; });
  check(homeTop.y < homeTop.h - 60, 'on a phone the main Today button is on the first screen, above the bottom bar (bottom edge at ' + Math.round(homeTop.y) + ' of ' + homeTop.h + ')');
  await page.locator('.navg button.nav', { hasText: 'Learn' }).click();
  await page.waitForTimeout(120);
  check((await page.locator('.subnav button').allInnerTexts()).join('|') === 'Path|Library' && ['path', 'library'].includes(await page.evaluate(() => window.shanlu.state.screen)), 'the Learn tab opens a Learn screen, with the Path and the Library one tap away');
  await page.locator('.subnav button', { hasText: /^Library$/ }).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.screen)) === 'library' && (await page.locator('.navg button.nav.on').innerText()).includes('Learn'), 'the strip switches screens inside the section and the Learn tab stays lit');
  await page.locator('.navg button.nav', { hasText: 'Review' }).click(); await page.waitForTimeout(100);
  check((await page.locator('.subnav button').allInnerTexts()).join('|') === 'Words|Grammar|Test', 'the Review tab holds Words, Grammar and Test');
  await page.locator('.navg button.nav', { hasText: 'Learn' }).click(); await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.screen)) === 'library', 'a tab returns to the screen you last used in that section');
  await page.locator('.navg button.nav', { hasText: 'Journey' }).click(); await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.screen)) === 'journey' && (await page.locator('.navg button.nav.on').innerText()).includes('Journey'), 'the Journey tab opens the Journey and lights up');
  await page.locator('.acct-mini').click(); await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.screen)) === 'acct' && await page.locator('.navg button.nav.on').count() === 0 && await page.locator('.acct-mini.on').count() === 1, 'the avatar opens the Account page; no tab is lit and the avatar is');
  const acctRows = (await page.locator('.acct-row').allInnerTexts()).join(' ');
  check(/Settings/.test(acctRows) && /Achievements/.test(acctRows), 'Settings and Achievements branch off the Account page (' + acctRows.replace(/\n/g, ' ').slice(0, 80) + ')');
  await page.locator('.acct-row', { hasText: 'Achievements' }).click(); await page.waitForTimeout(100);
  check(await page.locator('.backbar').isVisible() && (await page.locator('.navg button.nav.on').count()) === 0, 'Achievements has a back link to Account, and no tab is lit');
  await page.locator('.backbar').click(); await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.screen)) === 'acct' && !(await page.locator('.backbar').isVisible().catch(() => false)), 'the back link returns to the Account page');
  const slim = await page.evaluate(() => { const t = document.querySelector('.top').getBoundingClientRect(); return { h: t.height, pills: [...document.querySelectorAll('.stats .pill')].filter(p => p.offsetParent !== null).length }; });
  check(slim.h < 90 && slim.pills === 0, 'the header is one slim row on a phone, with no repeated streak and memory chips outside Today (' + Math.round(slim.h) + ' px)');
  await nav('Home');
  check((await page.evaluate(() => [...document.querySelectorAll('.stats > .pill')].filter(p => p.offsetParent !== null).length)) === 3, 'Today still shows the streak, XP and memory chips');
  await page.setViewportSize({ width: 1280, height: 900 });

  check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
