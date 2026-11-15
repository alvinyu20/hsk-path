/* Browser test: due dates switch over at midnight (the day's list is fixed), and clearing everything due pays a one-time 100-coin bonus.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-daily.js */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(site); await page.waitForSelector('.app'); await page.waitForTimeout(300);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // one word, with its recognition card set to a chosen last-review time and interval (in days)
  const setWord = (lastMsAgo, days) => ev(({ lastMsAgo, days }) => {
    const a = window.shanlu; const S = a.state; const zh = Object.keys(S.ws)[0];
    const ws = Object.assign({}, S.ws); ws[zh] = Object.assign({}, ws[zh], { see: { s: days, t: Date.now() - lastMsAgo, d: 5 }, hear: { s: 0, d: 5 }, prod: { s: 0, d: 5 } });
    a.setState({ ws }); return a.dueCounts();
  }, { lastMsAgo, days });
  const DAY = 864e5;
  // reviewed 2 days ago with a 2.5 day interval: due in about 12 hours, i.e. tomorrow morning if the clock were continuous. Whether it is due today depends on the hour,
  // so pick the interval from the time left today: it falls due 1 minute before midnight tonight, and must already count as due this morning.
  const left = await ev(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - Date.now(); });
  let c = await setWord(2 * DAY, 2 + (left - 60e3) / DAY);
  check(c.w === 1, 'a word that falls due late tonight already counts as due today (' + JSON.stringify(c) + ')');
  c = await setWord(2 * DAY, 2 + (left + 60e3) / DAY);
  check(c.w === 0, 'a word that falls due just after midnight is not due today (' + JSON.stringify(c) + ')');
  c = await setWord(60e3, 0.2);
  check(c.w === 0, 'a word reviewed a minute ago with a short interval does not come straight back (' + JSON.stringify(c) + ')');
  c = await setWord(5 * DAY, 2);
  check(c.w === 1, 'an overdue word is due');
  // a word counts as due only when Review can really ask it: saying a word joins a review once you recognise it twice (a lapse resets the recognition card, which used to leave
  // "Review 6 words" on screen with nothing behind it)
  const setSkills = (see, prod) => ev(({ see, prod }) => { const a = window.shanlu; const S = a.state; const zh = Object.keys(S.ws)[0];
    const ws = Object.assign({}, S.ws); ws[zh] = Object.assign({}, ws[zh], { see: Object.assign({ d: 5 }, see), hear: { s: 0, d: 5 }, prod: Object.assign({ d: 5 }, prod) });
    a.setState({ ws, rq: [], rcomplete: false }); return a.dueCounts(); }, { see, prod });
  c = await setSkills({ s: 1, t: Date.now() - 60e3 }, { s: 3, t: Date.now() - 9 * DAY });
  check(c.w === 0, 'a word whose only due skill is saying it, before it is recognised twice, is not counted as due (' + JSON.stringify(c) + ')');
  c = await setSkills({ s: 2, t: Date.now() - 60e3 }, { s: 3, t: Date.now() - 9 * DAY });
  check(c.w === 1, 'once it is recognised twice its overdue saying card counts as due (' + JSON.stringify(c) + ')');
  await ev(() => window.shanlu.reviewMore());
  check(await ev(() => window.shanlu.state.rq.length) >= 1, 'every due word gives Review something to ask');
  await ev(() => window.shanlu.setState({ rq: [], rcomplete: false }));
  // the daily clear bonus
  const x0 = await ev(() => window.shanlu.state.xp);
  await ev(() => { const a = window.shanlu; a.setState({ dcN: 1, dcPaid: false, day: (function (n) { const p = (v) => String(v).padStart(2, '0'); return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate()); })(new Date()) }); a.dailyClear(); });
  check(await ev(() => window.shanlu.state.xp) === x0 && !(await ev(() => window.shanlu.state.dcPaid)), 'no bonus while something is still due');
  await setWord(60e3, 5);   // reviewed just now: nothing due
  await ev(() => window.shanlu.dailyClear()); await page.waitForTimeout(100);
  const x1 = await ev(() => ({ xp: window.shanlu.state.xp, paid: window.shanlu.state.dcPaid, toast: (window.shanlu.state.msQueue || []).map(m => m.title).join('|') }));
  check(x1.xp === x0 + 100 && x1.paid && /Daily clear/.test(x1.toast), 'clearing everything due pays 100 coins and says so (' + JSON.stringify(x1) + ')');
  await ev(() => window.shanlu.dailyClear());
  check(await ev(() => window.shanlu.state.xp) === x1.xp, 'the bonus is paid once a day');
  await ev(() => { const a = window.shanlu; a.setState({ dcN: 0, dcPaid: false }); a.dailyClear(); });
  check(await ev(() => window.shanlu.state.xp) === x1.xp && !(await ev(() => window.shanlu.state.dcPaid)), 'a day that started with nothing due pays no bonus');
  // a new day starts again, with the count of what is due
  await setWord(5 * DAY, 2);
  await ev(() => { const a = window.shanlu; a.setState({ day: '2000-01-01', dcPaid: true, dcN: 0 }); a.go('home'); }); await page.waitForTimeout(300);
  const nd = await ev(() => ({ paid: window.shanlu.state.dcPaid, n: window.shanlu.state.dcN, note: (document.querySelector('.dc-note') || {}).textContent }));
  check(nd.paid === false && nd.n === 1 && /\+100 coins/.test(nd.note || ''), 'a new day resets the bonus and counts what is due (' + JSON.stringify(nd) + ')');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('daily browser tests passed'); process.exit(0);
})();
