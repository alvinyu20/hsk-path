/* Browser test (E1): a retake of the mock exam draws the questions you have not had yet first, then the ones you had longest ago.
 * For every level and part: draw a section, finish it (remember it), draw again, and count the repeats. Where a part's bank holds at
 * least twice what one sitting draws, the second sitting repeats nothing.   NODE_PATH=$(npm root -g) node tools/smoke-test-exam-fresh.js [--report] */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const report = process.argv.includes('--report');

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('shanlu-passed', JSON.stringify({ 1: 1, 2: 1, 3: 1, 4: 1 })); } catch (e) {} });
  const errors = [];
  for (const lv of [1, 2, 3, 4, 5]) {
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push('HSK ' + lv + ': ' + e.message));
    await page.goto(url + '?level=' + lv); await page.waitForSelector('.app');
    const res = await page.evaluate(() => {
      const a = window.shanlu, T = a.testApi, out = [];
      ['listening', 'reading', 'writing'].forEach(sec => {
        const q1 = a.examDraw(sec); if (!q1.length) return; const d1 = T.exDrawn(); T.exRemember(d1);
        a.examDraw(sec); const d2 = T.exDrawn(); T.exRemember(d2);
        a.examDraw(sec); const d3 = T.exDrawn();
        const parts = {}; d1.forEach(x => { const p = x.split(':')[0]; parts[p] = parts[p] || { n:0, rep:0, rep3:0 }; parts[p].n++; });
        d2.forEach(x => { const p = x.split(':')[0]; if (d1.indexOf(x) >= 0) parts[p].rep++; });
        d3.forEach(x => { const p = x.split(':')[0]; if (d2.indexOf(x) >= 0 && d1.indexOf(x) < 0) parts[p].rep3++; });
        Object.keys(parts).forEach(p => out.push(Object.assign({ sec, part:p }, parts[p])));
      });
      const E = window['HSK' + a.state.level + '_EXAM'] || Object.values(window).find(v => v && v.meta && v.L1) || {};
      return { out, sizes:Object.fromEntries(Object.keys(E).filter(k => Array.isArray(E[k])).map(k => [k, E[k].length])) };
    });
    res.out.forEach(r => {
      const bank = res.sizes[r.part];
      const unitN = r.n, line = 'HSK ' + lv + ' ' + r.part + ': drew ' + unitN + ', bank ' + bank + ', repeated on the retake ' + r.rep;
      if (report) console.log('     ' + line);
      // a set part (a group of five items) draws whole sets: compare in sets; a single-item part compares items
      const sets = bank < unitN;   // more items drawn than entries in the bank: the entries are sets
      if (!sets && bank >= 2 * unitN) check(r.rep === 0, line);
      if (!sets) check(r.rep <= Math.max(0, 2 * unitN - bank) + 1, line + ' (no more than the bank forces)');
    });
    await page.close();
  }
  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('exam retake tests passed');
})();
