/* Browser test: smarter wrong answers (D4). A card offers the words a learner really mixes up (买 / 卖, 他 / 她, other tones, opposites,
 * word families), never a word that means the same (早饭 / 早餐), and a listening card never a word that sounds exactly the same.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-confusers.js */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1, 3: 1, 4: 1 })); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForSelector('.app');
  const r = await page.evaluate(() => {
    const a = window.shanlu, T = a.testApi, ws = a.state.ws;
    const labelsOf = (zh, kind, n) => { const out = []; for (let i = 0; i < n; i++) { const q = a.rQuestion(zh, kind); if (q && q.options) out.push(q.options.map(o => o.label)); } return out; };
    const c = T.confusers('买');
    const mai = labelsOf('买', 'choice', 10).filter(ls => ls.some(l => /sell/.test(l))).length;
    const ta = labelsOf('他', 'choice', 10).filter(ls => ls.some(l => /^(she|it|also)\b/.test(l))).length;
    // words that mean the same are never offered together (Chinese options or English ones)
    const EN = {}; (window.HSK1_WORDS || []).forEach(w => { EN[w.zh] = w.en; });
    const S = window.SHANLU_CONFUSERS.same.map(g => g.filter(z => ws[z])).filter(g => g.length >= 2);
    let together = [];
    S.forEach(g => g.forEach(zh => ['choice', 'audio'].forEach(kind => { for (let i = 0; i < 6; i++) { const q = a.rQuestion(zh, kind); if (!q || !q.options) continue;
      const others = g.filter(z => z !== zh); q.options.forEach(o => { if (others.some(z => o.label === z || o.label === EN[z])) together.push(zh + ' + ' + o.label); }); } })));
    const pl = []; for (let i = 0; i < 10; i++) pl.push(T.plChoices('买', 'mean', ['你好', '谢谢'], 3));
    const plRev = []; S.forEach(g => { for (let i = 0; i < 5; i++) plRev.push({ g, got:T.plChoices(g[0], 'rev', g.slice(1).concat(['你好']), 4) }); });
    return { look:c.look, tone:c.tone, mai, ta, groups:S.length, together, plMai:pl.filter(x => x.indexOf('卖') >= 0).length, plSame:plRev.filter(x => x.got.some(z => z !== x.g[0] && x.g.indexOf(z) >= 0)).map(x => x.got.join(' ')) };
  });
  check(r.look.indexOf('卖') >= 0 && r.tone.indexOf('卖') >= 0, '买 and 卖 look alike and differ only in tone (look: ' + r.look.join(' ') + '; tone: ' + r.tone.join(' ') + ')');
  check(r.mai >= 9, '"What does 买 mean?" offers "to sell" (' + r.mai + ' of 10)');
  check(r.ta >= 9, '"What does 他 mean?" offers a look-alike: she (她), it (它) or also (也) (' + r.ta + ' of 10)');
  check(r.groups >= 1 && r.together.length === 0, 'words that mean the same are never options together (' + r.groups + ' groups at HSK 1: ' + r.together.slice(0, 5).join(', ') + ')');
  check(r.plMai >= 9, 'a Path "What does it mean?" card for 买 offers 卖 (' + r.plMai + ' of 10)');
  check(r.plSame.length === 0, 'a Path "Which word means …?" card never offers a word that means the same: ' + r.plSame.slice(0, 3).join(' | '));
  // listening: other tones are offered, the very same sound never
  await page.goto(url + '?level=2'); await page.waitForSelector('.app');
  const h = await page.evaluate(() => {
    const a = window.shanlu, T = a.testApi, keys = Object.keys(a.state.ws);
    const plain = (p) => String(p || '').toLowerCase().split(/[\/,;]/).map(x => x.replace(/[\s'’·\-]/g, ''));
    const pyOf = {}; keys.forEach(z => { pyOf[z] = (window.HSK2_WORDS.find(w => w.zh === z) || {}).py; });
    let same = [], tone = 0, n = 0;
    keys.forEach(zh => { const c = T.confusers(zh); if (!c.tone.length) return;
      for (let i = 0; i < 4; i++) { const q = T.choiceOptions(zh, z => z, false, true); n++;   // as qHearWord (Review > Test) builds it
        const labels = q.options.map(o => o.label); if (labels.some(l => c.tone.indexOf(l) >= 0)) tone++;
        labels.forEach(l => { if (l !== zh && plain(pyOf[l]).some(x => plain(pyOf[zh]).indexOf(x) >= 0)) same.push(zh + '/' + l); }); } });
    return { n, tone, same };
  });
  check(h.n > 0 && h.tone > h.n / 2, '"Which word did you hear?" offers the same syllables with other tones when there are some (' + h.tone + ' of ' + h.n + ' cards)');
  check(h.same.length === 0, 'and never a word that sounds exactly the same: ' + h.same.slice(0, 5).join(', '));
  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('confuser tests passed');
})();
