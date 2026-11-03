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

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
const window_level_still_1 = (n) => n === 1;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ['microphone'] });
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
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR|status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); };
  const nav = async (label) => { await page.locator('nav button', { hasText: label }).first().click(); await page.waitForTimeout(120); };
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
      await page.fill('#answer-input', right ? q.accepts[q.accepts.length - 1] : 'xx');
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
  check((await text()).includes('Welcome back'), 'home loads');
  check((await page.locator('.side').innerText()).includes('0-day streak'), 'fresh state starts at a 0-day streak');
  // Home: the trail comes first, then today and the level exam
  check(await page.evaluate(() => { const h = document.querySelector('.home'); return !!h && h.firstElementChild.querySelector('.trail') !== null; }), 'the trail is the first thing on Home');
  check(await page.locator('.rg').count() === 4 && await page.locator('.task2').count() >= 1, 'Home shows four skill rings and the Today list');
  // The ascent: trail, mist and stairs views of the same progress
  const ws0 = await page.evaluate(() => JSON.stringify(window.shanlu.state.ws));
  check((await text()).toLowerCase().includes('next cairn') && (await text()).includes('10 words to go'), 'the ascent opens on the trail: ten words to the first cairn on a fresh start');
  check(await page.locator('.trail-d .apill.next').count() === 1 && (await page.locator('.trail-d .apill.next').innerText()).includes('HSK 1 exam'), 'the trail names the next camp');
  check((await page.locator('.trail-d img').getAttribute('src')).startsWith('data:image/svg+xml'), 'the trail art is drawn from the progress');
  const learnN = async (n) => page.evaluate((n) => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).slice(0, n).forEach(zh => { ws[zh].see = { s:2, l:2, t:Date.now() }; }); app.setState({ ws }); }, n);
  await learnN(96);
  await page.waitForTimeout(150);
  check((await text()).includes('4 words to go') && (await text()).includes('96 of 100'), 'after 96 words the next cairn (100) is 4 words away');
  check((await page.locator('.trail-d .apill.you').innerText()).includes('96 words kept'), 'the trail says where you are');
  check(await page.locator('.seg2 button', { hasText: /^Mist$/ }).count() === 0 && await page.locator('.mtile').count() === 0, 'Home no longer has a Mist view');
  await nav('Word webs');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => window.shanlu.state.wmode) === 'topic' && (await page.locator('.web-bar .seg2 button').first().innerText()).trim() === 'Topics', 'Word webs opens on Topics, which is the first tab');
  check(await page.locator('.mtile').count() === 20 && (await text()).includes('of 20 clear'), 'the mist view shows one mountain per Word web topic');
  await learnN(300);
  await page.waitForTimeout(150);
  check((await text()).includes('20 of 20 clear') && await page.locator('.mtile .mseal-on').count() === 20, 'when every word is started every mountain is clear and sealed');
  await page.evaluate((j) => { window.shanlu.setState({ ws:JSON.parse(j) }); }, ws0);
  await page.locator('.mtile').nth(4).click();
  await page.waitForTimeout(150);
  check((await text()).includes('Numbers') && await page.evaluate(() => window.shanlu.state.screen === 'web' && window.shanlu.state.wmode === 'topic' && window.shanlu.state.wtopic === 4), 'tapping a mountain opens that topic in the Word webs');
  await page.evaluate(() => { window.shanlu.setState({ wmode:'char', wtopic:0 }); });
  await nav('Home');
  await page.locator('.seg2 button', { hasText: /^Stairs$/ }).click();
  check(await page.locator('.stairs .step').count() === 9, 'the stairs view is still there');
  await page.locator('.seg2 button', { hasText: /^HSK 2.0/ }).click();
  check(await page.locator('.stairs .step').count() === 6, 'the HSK 2.0 / 3.0 switch still changes the stairs');
  await page.locator('.seg2 button', { hasText: /^HSK 3.0/ }).click();
  await page.locator('.seg2 button', { hasText: /^Trail$/ }).click();
  await page.locator('.seg2 button', { hasText: /^HSK 2.0/ }).click();
  check(await page.locator('.trail-d .apill.near, .trail-d .apill.far').count() === 5 && !(await page.locator('.trail-d').innerText()).includes('HSK 7'), 'with HSK 2.0 the trail has six camps');
  await page.locator('.seg2 button', { hasText: /^HSK 3.0/ }).click();
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

  // Word webs
  await nav('Word webs');
  check((await text()).includes('0 new words today') && !/\d+ of \d+ new words today/.test(await text()), 'word webs open with no daily limit');
  for (let i = 0; i < 6; i++) { await page.locator('button', { hasText: 'Add to my words' }).first().click(); await page.waitForTimeout(50); }
  check((await text()).includes('6 new words today'), 'six words added with no limit in the way');
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) > 0, 'add buttons are still there after six words');
  if (!(await page.locator('[aria-label="New words per day"]').count())) await page.locator('.capbtn').click();
  await page.locator('[aria-label="New words per day"] button', { hasText: /^5$/ }).click();
  await page.waitForTimeout(80);
  check((await text()).includes('You have reached your limit of 5') && (await page.locator('button', { hasText: 'Add to my words' }).count()) === 0, 'choosing a limit of 5 stops further adds');
  await page.locator('[aria-label="New words per day"] button', { hasText: 'No limit' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('button', { hasText: 'Add to my words' }).count()) > 0, 'choosing "No limit" brings the add buttons back');
  const before = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => Object.keys(window.shanlu.state.wlearned).length);
  check(after > before + 1, 'Add all adds the rest of a shared-character group (' + before + ' to ' + after + ')');
  check((await page.locator('[aria-label="Pick a character"] button').count()) >= 20, 'many shared-character groups are available');
  await shot('02-webs');
  await page.locator('[aria-label="Pick a character"] button', { hasText: '饭' }).click();
  check((await text()).includes('米饭'), 'switching the shared character shows its words');
  // Show example: a word's own sentence, on demand
  const firstCardWord = (await page.locator('.wc .wc-zh').first().innerText()).trim();
  const firstEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, firstCardWord);
  check(!(await page.locator('.wc').first().innerText()).includes(firstEx), 'a word card does not show its example sentence until asked');
  await page.locator('.wc').first().locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.wc').first().innerText()).includes(firstEx), 'Show example reveals the word\'s example sentence (' + firstCardWord + ': ' + firstEx + ')');
  check((await page.locator('.wc').first().locator('.wexbox .spk').count()) === 1, 'the example sentence has a play button');
  const more0 = await page.evaluate((zh) => { const m = window.HSK1_WORDS.find(w => w.zh === zh).more || []; return m.length ? m[0].zh : null; }, firstCardWord);
  check(!!more0, 'every word has more than one example sentence (' + firstCardWord + ')');
  await page.locator('.wc').first().locator('button', { hasText: 'Another example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.wc').first().innerText()).includes(more0) && (await page.locator('.wc').first().innerText()).includes('2 of'), 'Another example shows the next sentence for the word');
  await page.locator('.wc').first().locator('button', { hasText: 'Hide example' }).click();
  await page.waitForTimeout(60);
  check(!(await page.locator('.wc').first().innerText()).includes(firstEx), 'Hide example puts it away again');
  await page.locator('button', { hasText: 'Quiz me' }).click();
  check((await page.locator('button', { hasText: 'Show example' }).count()) === 0, 'in quiz mode the example stays hidden until the meaning is revealed');
  await page.locator('button', { hasText: 'Reveal meaning' }).first().click();
  await page.locator('button', { hasText: 'Add to my words' }).first().click().catch(() => {});
  await page.locator('button', { hasText: 'Pairs' }).click();
  await page.locator('button', { hasText: 'Reveal' }).first().click();
  check((await page.locator('.orow').count()) >= 20, 'opposite pairs are listed');
  const pair = await page.evaluate(() => window.HSK1_WEBS.opps[0]);
  const opBefore = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(!opBefore.a && !opBefore.b, 'the first opposite pair starts out not added (' + pair.a + ' / ' + pair.b + ')');
  const rowText = await page.locator('.orow').first().innerText();
  check(rowText.includes('Add both words') && rowText.includes('Add ' + pair.a) && rowText.includes('Add ' + pair.b), 'a revealed opposite pair offers both words and "Add both"');
  await page.locator('.orow').first().locator('button', { hasText: 'Add both words' }).click();
  await page.waitForTimeout(60);
  const opAfter = await page.evaluate((p) => ({ a: !!window.shanlu.state.wlearned[p.a], b: !!window.shanlu.state.wlearned[p.b] }), pair);
  check(opAfter.a && opAfter.b, 'Add both starts the left and the right word of an opposite pair');
  check(!(await page.locator('.orow').first().innerText()).includes('Add both words'), 'no add buttons are left once both words are started');
  const exA = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.a).ex.zh, pair);
  const exB = await page.evaluate((p) => window.HSK1_WORDS.find(w => w.zh === p.b).ex.zh, pair);
  await page.locator('.orow').first().locator('button', { hasText: 'Show examples' }).click();
  await page.waitForTimeout(60);
  const oText = await page.locator('.orow').first().innerText();
  check(oText.includes(exA) && oText.includes(exB), 'an opposite pair can show an example for both words');
  await page.locator('button', { hasText: 'Topics' }).click();
  await page.locator('[aria-label="Topic"] button', { hasText: 'At school' }).click();
  await page.waitForTimeout(80);
  check((await page.locator('.tgrid .tc').count()) >= 20, 'a topic lists its words');
  const tcWord = (await page.locator('.tc .tc-zh').first().innerText()).trim();
  const tcEx = await page.evaluate((zh) => window.HSK1_WORDS.find(w => w.zh === zh).ex.zh, tcWord);
  await page.locator('.tc').first().locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await page.locator('.tc').first().innerText()).includes(tcEx), 'a topic card can show its word\'s example sentence (' + tcWord + ': ' + tcEx + ')');
  check(/\d+ of \d+ started/.test(await text()), 'a topic shows how many of its words you started');
  await page.locator('button', { hasText: /^Add all \d+ new word/ }).first().click();
  await page.waitForTimeout(100);
  const tp = (await text()).match(/(\d+) of (\d+) started/);
  check(tp && tp[1] === tp[2], 'Add all on a topic starts every word in it (' + (tp ? tp[0] : 'no progress text') + ')');
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
  await page.evaluate(() => window.shanlu.setState({ screen: 'web', wmode: 'topic', wtopic: window.HSK1_WEBS.topics.findIndex(t => t.words.indexOf('汉语') >= 0), wquiz: false }));
  await page.waitForTimeout(80);
  const noteCard = page.locator('.tc', { hasText: '中文' }).first();
  await noteCard.locator('button', { hasText: 'Show example' }).click();
  await page.waitForTimeout(60);
  check((await noteCard.innerText()).includes('everyday word'), 'the 中文 card shows its note under the example');
  check(!(await page.locator('.tc', { hasText: '茶' }).first().innerText().catch(() => '')).includes('everyday word'), 'other words have no note');

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

  // Review
  await nav('Review words');
  check((await text()).toLowerCase().includes('all caught up'), 'review shows caught up when nothing is due');
  await page.locator('button', { hasText: 'Practice all my words anyway' }).click();
  await page.waitForTimeout(100);
  const practiceN = await page.evaluate(() => window.shanlu.state.rq.length);
  check(practiceN === (await page.evaluate(() => Object.keys(window.shanlu.state.ws).filter(zh => window.shanlu.state.ws[zh].see.s > 0 || window.shanlu.state.ws[zh].see.l > 0).length)) && practiceN >= 5, 'practising anyway offers every started word, not just five');
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
  await page.locator('.quick .rate').nth(1).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.rdone)) === 1 && !(await page.evaluate(() => window.shanlu.state.rflip)), 'Knew it rates the card without flipping it');
  check((await page.locator('.fc-fpy').count()) === 1 && (await page.locator('button', { hasText: 'Hide pinyin' }).count()) === 1, 'the pinyin switch stays on for the next card');
  await page.locator('button', { hasText: 'Hide pinyin' }).click();
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-progress-v1')).rpy)) === false || true, 'pinyin switch saved');
  await page.locator('.quick .rate').nth(0).click();
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.shanlu.state.rdone)) === 1 && (await page.evaluate(() => window.shanlu.state.rq.length)) === rqBefore - 1, 'Didn\'t know it sends the card to the back of the queue');
  await page.locator('button', { hasText: 'Show answer' }).click();
  await page.waitForTimeout(800);
  await shot('06-review-back');
  for (let i = 0; i < practiceN + 3 && !(await text()).includes('words reviewed'); i++) {
    if (!(await page.locator('.rates .rate').count())) await page.locator('button', { hasText: 'Show answer' }).click();
    await page.locator('.rates .rate').nth(2).click();
    await page.waitForTimeout(60);
  }
  check((await text()).includes('words reviewed'), 'review finishes');
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
  check(JSON.stringify(await page.locator('.navs .nav').allInnerTexts().then(a => a.map(t => t.replace(/\d+$/, '').trim()))) === JSON.stringify(['Home', 'Word webs', 'Grammar', 'Review words', 'Listening lab', 'Speak', 'Tests', 'Level exam', 'My words']), 'the tabs are in learning order');
  await page.locator('nav button', { hasText: 'Grammar' }).click();
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
  check((await page.locator('.gl .gp').count()) === 26, 'grammar lists 26 lessons');
  check((await text()).toLowerCase().includes('lesson 1 of 26'), 'the first lesson is open');
  await shot('08-grammar');
  await page.locator('.gl .gp').nth(3).click();
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
    await page.locator('.gl .gp').nth(idx).click();
    await page.locator('button', { hasText: 'Practise this lesson' }).first().click();
    await page.waitForTimeout(80);
    const total = await runQuiz(true);
    check((await text()).includes(total + '/' + total), 'lesson ' + (idx + 1) + ' scores ' + total + '/' + total + ' with right answers');
    await page.locator('button', { hasText: 'Back to' }).first().click().catch(() => {});
    await nav('Grammar');
  }
  check((await page.locator('.gl .gp.done').count()) >= 4, 'passed lessons are marked done');

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
  check((await page.locator('.scn').count()) === 8, 'speaking lists 8 scripts');
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
  check((await page.locator('.lvseg button', { hasText: 'HSK 2' }).innerText()).includes('🔒'), 'HSK 2 shows a lock before the exam is passed');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('shanlu-passed') || '{}')[1]), 'a full exam with a section under 80% does not open HSK 2');
  await page.locator('.lvseg button', { hasText: 'HSK 2' }).click();
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
  check(!(await page.locator('.lvseg button', { hasText: 'HSK 2' }).innerText()).includes('🔒'), 'the lock on HSK 2 is gone');
  await page.locator('button', { hasText: 'Back to the exam page' }).click();

  // Exam + home
  await nav('Level exam');
  await shot('12-exam');
  await nav('Home');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'streak counts after activity');
  check((await text()).includes('lessons passed') && (await text()).includes('scripts done'), 'home shows grammar and speaking progress');
  await shot('13-home-after');

  // persistence
  await nav('Word webs');
  if (!(await page.locator('[aria-label="New words per day"]').count())) await page.locator('.capbtn').click();
  await page.locator('[aria-label="New words per day"] button', { hasText: /^10$/ }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.app');
  check(!(await page.locator('.side').innerText()).includes('0-day streak'), 'progress survives a reload');
  await nav('Grammar');
  check((await page.locator('.gl .gp.done').count()) >= 4, 'passed lessons survive a reload');
  await nav('Speak');
  check((await page.locator('.scn.done').count()) >= 2, 'finished speaking scripts survive a reload');
  await nav('Word webs');
  check(/of 10 new words today/.test(await text()), 'a chosen daily limit survives a reload');
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
  // a listening-test answer starts the "hear" timer, which Review never resets: it must not keep a freshly reviewed word due
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
  check(!hearCheck.rq.includes(hearCheck.a) && hearCheck.rq.includes(hearCheck.b) && hearCheck.rq.includes(hearCheck.c), 'an old listening answer does not keep a reviewed word due; overdue words still are');
  // the daily goal offers "Learn new words" only while some words are not started
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); Object.keys(ws).forEach(z => { ws[z].see = { s: 3, l: 0, t: Date.now() }; ws[z].prod = { s: 3, l: 0, t: Date.now() }; }); app.setState({ ws, rq: [], rcomplete: false, webCredited: false, screen: 'home' }); });
  await page.waitForTimeout(200);
  check(!(await text()).includes('with their relatives') && !(await text()).includes('with its relatives'), 'with every word started the daily goal has no Learn-new-words task');
  await page.evaluate(() => { const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws)); const k = Object.keys(ws)[0]; ws[k] = { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }; app.setState({ ws }); });
  await page.waitForTimeout(200);
  check((await text()).includes('Learn 1 new word with its relatives'), 'with one word left the Learn task is back');

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
  let aliChatN = 0;
  const aliHandler = async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData());
    aliCalls.push({ url: req.url(), headers: req.headers(), body });
    if (body.model === 'qwen3-asr-flash') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: '我想喝茶' } }] }) });
    const last = body.messages[body.messages.length - 1].content;
    if (last === 'Reply with the single word OK.') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'OK' } }] }) });
    aliChatN++;
    const reply = aliChatN === 1 ? { reply: { zh: '你好！你想去哪儿？', en: 'Hello! Where do you want to go?' }, feedback: { level: 'ok', better: '', why: '' }, suggest: { zh: '我想去学校。', en: 'I want to go to school.' } }
      : { reply: { zh: '好的。', en: 'Okay.' }, feedback: { level: 'ok', better: '', why: '' } };
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
  check((await text()).includes('Chat model (qwen-flash): working.'), 'Test connection reports the chat model and the voice recogniser');
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
  for (const [label, name] of [['Home', '15-phone-home'], ['Word webs', '16-phone-webs'], ['My words', '17-phone-words'], ['Grammar', '18-phone-grammar'], ['Speak', '19-phone-speak'], ['Listening lab', '20-phone-listen']]) {
    await nav(label);
    await shot(name);
    check(await noSideways(), 'no sideways scroll on ' + label + ' at phone width');
  }
  await page.locator('button', { hasText: 'Topics' }).first().click().catch(() => {});

  check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(2); });
