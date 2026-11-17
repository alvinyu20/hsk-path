/* Browser test: the grammar review does not show the same exercise of a point again and again.
 * One open point, one question per session: every exercise of the point must come up before any of the lately shown ones repeats.
 * Usage: node tools/smoke-test-grv-variety.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url); await page.waitForSelector('.app');
  // open the points of one lesson, ask for a review again and again and answer every question; each point keeps its own run of exercises
  const info = await page.evaluate(() => { const a = window.shanlu; const pt = window.HSK1_GRAMMAR.points[0]; a.setState({ gres: { [pt.lesson]: 100 } }); return { lesson: pt.lesson, ids: window.HSK1_GRAMMAR.points.filter(p => p.lesson === pt.lesson).map(p => [p.id, p.n]) }; });
  const runs = {};
  for (let i = 0; i < 24; i++) {
    const got = await page.evaluate(() => { const a = window.shanlu; a.startGrammarReview(true); return (a.quizQs || []).map(q => ({ id: q.pt, pool: q.gpool, type: q.type })); });
    for (const q of got) {
      if (q.type === 'write') continue;
      (runs[q.id] = runs[q.id] || []).push(q.pool);
      await page.evaluate((o) => window.shanlu.gptRecord(o.id, 'r', true, 'good', o.pool), q);
    }
  }
  for (const [id, np] of info.ids) {
    const picks = runs[id] || [];
    const win = Math.max(1, Math.floor(np * 0.6)) + 1;
    let ok = picks.length >= 12;
    for (let i = 0; i + win <= picks.length; i++) { if (new Set(picks.slice(i, i + win)).size !== win) ok = false; }
    check(ok, id + ' (pool of ' + np + '): no exercise repeats within ' + win + ' questions in a row: ' + picks.join(' '));
    check(new Set(picks).size === np, id + ': every one of its ' + np + ' exercises was shown');
  }
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('grammar review variety test passed');
})().catch(e => { console.log('crashed', e); process.exit(1); });
