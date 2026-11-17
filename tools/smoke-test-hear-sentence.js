/* Browser test for the "Hear the sentence" review card (a listening card for a word you already hear well).
 * Uses the real recorded-audio list, because the card only uses sentences that have a recording.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-hear-sentence.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root, { realAudio: true });
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_SENT_SHARE = 100; });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const a = window.shanlu; const ws = Object.assign({}, a.state.ws); const now = Date.now();
    const set = (h) => { ws['五'] = { see:{ s:10, t:now, d:5 }, hear:{ s:h, t:now, d:5 }, prod:{ s:3, t:now, d:5 } }; a.state.ws = ws; };
    const out = { strong:[], weak:null };
    set(5);
    for (let i = 0; i < 6; i++) { a.state.rstep = i; out.strong.push(a.rQuestion('五#h', 'audio')); }
    set(1); a.state.rstep = 0; out.weak = a.rQuestion('五#h', 'audio');
    return { strong:out.strong.map(q => ({ k:q.kicker, audio:q.audio, labels:q.options.map(o => o.label), correct:q.correct, ids:q.options.map(o => o.id), dim:q.dim, word:q.word })), weak:{ k:out.weak.kicker, audio:out.weak.audio } };
  });
  check(r.strong.every(q => q.k === 'Hear the sentence' && /五/.test(q.audio) && /[。？！]$/.test(q.audio)), 'a word heard well gets a whole sentence with 五 in it: ' + r.strong.map(q => q.audio).join(' '));
  check(r.strong.every(q => q.labels.length === 4 && new Set(q.labels).size === 4 && q.ids.indexOf(q.correct) >= 0), 'four different English meanings, one of them right');
  check(r.strong.every(q => q.dim === 'hear' && q.word === '五'), 'it counts for the hearing skill of 五');
  check(r.weak.k !== 'Hear the sentence' && r.weak.audio === '五', 'a word not yet heard well gets the single-word card');
  // the card on screen: due cards are made by the app, so put 五's hearing card first in a session
  await page.evaluate(() => { const a = window.shanlu; const ws = Object.assign({}, a.state.ws); const now = Date.now(); ws['五'] = { see:{ s:10, t:now, d:5 }, hear:{ s:5, t:now, d:5 }, prod:{ s:3, t:now, d:5 } }; a.setState({ ws, screen:'review', rq:['五#h'], rtotal:1, rdone:0, rstep:0, rcomplete:false }); });
  await page.waitForTimeout(400);
  const txt = await page.locator('main').innerText();
  check(/Hear the sentence/i.test(txt) && /What does this sentence mean/.test(txt), 'Review shows the card: ' + txt.replace(/\s+/g, ' ').slice(0, 400));
  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' failed' : 'hear-the-sentence tests passed');
  process.exit(failures ? 1 : 0);
})();
