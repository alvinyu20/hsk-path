/* Listening cards never offer two answers that sound exactly the same (的 / 地 / 得 are all "de"; 是 / 事 / 市 are all "shì").
 *   node tools/test-hear-homophones.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url + '?level=3'); await page.waitForSelector('.app'); await page.waitForTimeout(400);
  const res = await page.evaluate(() => {
    const a = window.shanlu; const keys = Object.keys(a.state.ws);
    const W = [].concat(window.HSK1_WORDS || [], window.HSK2_WORDS || [], window.HSK3_WORDS || []); const by = {}; W.forEach((w) => { by[w.zh] = w; });
    const sk = (py) => String(py || '').toLowerCase().split(/[\/,;]/).map((r) => r.replace(/[\s'’·\-]/g, '')).filter(Boolean);
    const alike = (x, y) => { const p = sk(by[x] && by[x].py); return sk(by[y] && by[y].py).some((r) => p.indexOf(r) >= 0); };
    let n = 0; const bad = []; let homoWords = 0;
    const inBank = {}; keys.forEach((z) => { inBank[z] = 1; });
    const homo = keys.filter((zh) => by[zh] && keys.some((z) => z !== zh && by[z] && alike(z, zh)));
    homoWords = homo.length;
    homo.forEach((zh) => {
      for (let r = 0; r < 120; r++) {
        const w = a.rQuestion(zh, 'audio'); if (!w || !w.options) continue; n++;
        w.options.forEach((o) => { W.forEach((x) => { if (inBank[x.zh] && x.zh !== zh && x.en === o.label && alike(x.zh, zh) && !W.some((y) => inBank[y.zh] && y.en === o.label && !alike(y.zh, zh))) bad.push(zh + ' ~ ' + x.zh + ' (' + o.label + ')'); }); });
        if (!/mean/.test(w.prompt || '')) { w.options.forEach((o) => { if (o.label !== zh && alike(o.label, zh)) bad.push(zh + ' ~ ' + o.label + ' (hear the word)'); }); }
      }
    });
    return { n, bad: bad.slice(0, 8), nbad: bad.length, homoWords };
  });
  check(res.n > 1500, 'checked many listening cards (' + res.n + ')');
  check(res.homoWords > 20, 'the word bank really has same-sounding words (' + res.homoWords + ' words), so this test means something');
  check(res.nbad === 0, 'no answer sounds the same as the right one' + (res.nbad ? ': ' + res.bad.join(' | ') : ''));
  check(errs.length === 0, 'no script errors');
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})();
