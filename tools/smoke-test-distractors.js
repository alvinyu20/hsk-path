/* Browser test: the wrong answers on a "What does this word mean?" card are never near-duplicates of the right one
 * (no "sorry" next to "sorry; embarrassed", no "to read; to study" next to "to read (aloud); to study").
 * Usage: node tools/smoke-test-distractors.js   (needs Playwright) */
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
  await ctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1 })); } catch (e) {} });
  for (const lvl of [1, 2]) {
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + (lvl > 1 ? '?level=' + lvl : '')); await page.waitForSelector('.app'); await page.waitForTimeout(300);
    const res = await page.evaluate(() => {
      const a = window.shanlu; const keys = Object.keys(a.state.ws);
      const SKIP = new Set('to a an the of be or and in on at for it is as with not one i you your my me we he she they that this so by from get do'.split(' '));
      const bits = (en) => new Set(String(en).toLowerCase().replace(/[^a-z\s]+/g, ' ').split(/\s+/).filter(t => t && !SKIP.has(t)).map(t => t.length > 3 ? t.replace(/(ing|ed|es|s)$/, '') : t));
      const clash = (x, y) => { const p = bits(x), q = bits(y); for (const t of p) if (q.has(t)) return true; return false; };
      let n = 0, bad = [], short = 0;
      keys.forEach(zh => ['choice', 'audio'].forEach(kind => { for (let r = 0; r < 4; r++) {
        const q = a.rQuestion(zh, kind); if (!q || !q.options || q.options.length < 2) return;
        if (q.optsLatin === false || (kind === 'choice' && !/mean/.test(q.prompt || ''))) return;
        n++; if (q.options.length < 4) short++;
        const labels = q.options.map(o => o.label);
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (clash(labels[i], labels[j])) bad.push(zh + ': ' + labels[i] + ' / ' + labels[j]);
      } }));
      return { n, bad: bad.slice(0, 8), nbad: bad.length, short };
    });
    check(res.n > 100, 'HSK ' + lvl + ': checked ' + res.n + ' meaning cards');
    check(res.nbad === 0, 'HSK ' + lvl + ': no card has two options that share a meaningful word' + (res.nbad ? ' (' + res.nbad + ', e.g. ' + res.bad.join(' | ') + ')' : ''));
    check(res.short === 0, 'HSK ' + lvl + ': every card still has four options');
    check(errors.length === 0, 'HSK ' + lvl + ': no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await page.close();
  }
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('distractor test passed');
})().catch(e => { console.log('crashed', e); process.exit(1); });
