/* Browser test: the grammar review does not show the same exercise of a point again and again.
 * One open point, one question per session: every exercise of the point must come up before any of the lately shown ones repeats.
 * Runs for HSK 1 to 5 (all levels are opened first).
 * Usage: node tools/smoke-test-grv-variety.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

const startState = (o) => { try { if (!localStorage.getItem('shanlu-passed')) localStorage.setItem('shanlu-passed', JSON.stringify(o.passed)); } catch (e) {} };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];
  for (const L of [1, 2, 3, 4, 5]) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
    await ctx.addInitScript(startState, { passed: { 1: 1, 2: 1, 3: 1, 4: 1 } });   // every level open
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('HSK ' + L + ': ' + String(e)));
    await page.goto(url + '?level=' + L); await page.waitForSelector('.app');
    check(await page.evaluate(() => window.SHANLU_LEVEL) === L, 'HSK ' + L + ' is loaded');
    // open the points of one lesson, ask for a review again and again and answer every question; each point keeps its own run of exercises
    const info = await page.evaluate((L) => { const a = window.shanlu; const G = window['HSK' + L + '_GRAMMAR']; const pt = G.points[0]; a.setState({ gres: { [pt.lesson]: 100 } }); return { lesson: pt.lesson, ids: G.points.filter(p => p.lesson === pt.lesson).map(p => [p.id, p.n]) }; }, L);
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
      check(ok, 'HSK ' + L + ' ' + id + ' (pool of ' + np + '): no exercise repeats within ' + win + ' questions in a row: ' + picks.join(' '));
      check(new Set(picks).size === np, 'HSK ' + L + ' ' + id + ': every one of its ' + np + ' exercises was shown');
    }
    await ctx.close();
  }
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('grammar review variety test passed');
})().catch(e => { console.log('crashed', e); process.exit(1); });
