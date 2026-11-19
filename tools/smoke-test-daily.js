/* Browser test: due dates switch over at midnight (the day's list is fixed), and the daily treasure chest pays once.
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
  // the daily treasure chest (a new one each day, paid once, only when nothing is due)
  const today = () => ev(() => { const p = (v) => String(v).padStart(2, '0'); const n = new Date(); return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate()); });
  const x0 = await ev(() => window.shanlu.state.xp);
  // a day that started with nothing due has no chest (19 Nov: the chest is for clearing what was due)
  await setWord(60e3, 5);
  await ev(async (d) => { const a = window.shanlu; a.setState({ dcN: 0, dcPaid: false, dcAmt: 0, day: d }); }, await today());
  await ev(() => window.shanlu.openChest(0.5));
  check(await ev(() => window.shanlu.state.xp) === x0 && !(await ev(() => window.shanlu.state.dcPaid)), 'no chest on a day that started with nothing due');
  await ev(async (d) => { const a = window.shanlu; a.setState({ dcN: 1, dcPaid: false, dcAmt: 0, day: d }); }, await today());
  await setWord(5 * DAY, 2);   // something is due
  await ev(() => window.shanlu.openChest(0.5));
  check(await ev(() => window.shanlu.state.xp) === x0 && !(await ev(() => window.shanlu.state.dcPaid)), 'the chest will not open while something is still due');
  await setWord(60e3, 5);   // reviewed just now: nothing due
  await ev(() => window.shanlu.openChest(0.5)); await page.waitForTimeout(100);
  const x1 = await ev(() => ({ xp: window.shanlu.state.xp, paid: window.shanlu.state.dcPaid, amt: window.shanlu.state.dcAmt }));
  check(x1.xp === x0 + 100 && x1.paid && x1.amt === 100, 'with nothing due the chest opens and pays (a 0.5 roll is 100 coins): ' + JSON.stringify(x1));
  await ev(() => window.shanlu.openChest(0.95));
  check(await ev(() => window.shanlu.state.xp) === x1.xp, 'the chest is paid once a day');
  check(await ev(() => !window.shanlu.dailyClear), 'clearing everything due no longer pays by itself');
  // a new day starts again, with the count of what is due
  await setWord(5 * DAY, 2);
  await ev(() => { const a = window.shanlu; a.setState({ day: '2000-01-01', dcPaid: true, dcAmt: 200, dcN: 0 }); a.go('home'); }); await page.waitForTimeout(300);
  const nd = await ev(() => ({ paid: window.shanlu.state.dcPaid, amt: window.shanlu.state.dcAmt, n: window.shanlu.state.dcN, note: (document.querySelector('.dc-note') || {}).textContent }));
  check(nd.paid === false && nd.n === 1 && nd.amt === 0 && /treasure chest/i.test(nd.note || ''), 'a new day resets the chest and counts what is due (' + JSON.stringify(nd) + ')');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('daily browser tests passed'); process.exit(0);
})();
