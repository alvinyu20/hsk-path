/* Browser test for the friends board: real site in Chromium, real worker.js on a real (local) D1 database via Miniflare, several "friends" in
 * separate browser contexts. Needs:  cd worker && npm install   (Miniflare).   Usage: node tools/smoke-test-friends.js */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("window.SHANLU_FRIENDS_URL = window.SHANLU_FRIENDS_URL || '';"); return; }   // tests never talk to the real friends server
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const INVITE = 'ABCD-EFGH-JKLM';

(async () => {
  if (!fs.existsSync(path.join(root, 'worker', 'node_modules', 'miniflare'))) { console.log('skipped: run "cd worker && npm install" first'); process.exit(0); }
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const { makeWorker } = await import(path.join(root, 'worker', 'test.mjs'));
  const mf = await makeWorker({ ALLOWED_ORIGINS: 'http://127.0.0.1:' + server.address().port });
  const api = String(await mf.ready).replace(/\/$/, '');
  const browser = await chromium.launch();
  const mk = async (withServer = true) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    if (withServer) await ctx.addInitScript((u) => { window.SHANLU_FRIENDS_URL = u; }, api);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    page.puts = 0; page.on('request', r => { if (r.method() === 'PUT' && r.url().includes('/api/me')) page.puts++; });
    return { ctx, page, errors };
  };
  const text = (p) => p.locator('main').innerText();

  // dormant: no server address, no Friends tab
  const off = await mk(false);
  await off.page.goto(site); await off.page.waitForSelector('.app');
  check(await off.page.locator('nav button', { hasText: 'Friends' }).count() === 0, 'without a server address there is no Friends tab');
  await off.ctx.close();

  // Alvin joins from an invite link
  const A = await mk();
  await A.page.goto(site + '#join=' + INVITE); await A.page.waitForSelector('.app');
  await A.page.waitForSelector('.frjoin');
  check(await A.page.locator('#fr-code').inputValue() === INVITE && (await A.page.evaluate(() => location.hash)) === '', 'an invite link opens the join form with the code filled in and clears the address');
  check(await A.page.locator('nav button', { hasText: 'Friends' }).count() === 1, 'with a server address the Friends tab shows');
  await A.page.fill('#fr-name', 'Alvin');
  await A.page.locator('button', { hasText: 'Join group' }).click();
  await A.page.waitForSelector('.frow');
  check((await text(A.page)).toLowerCase().includes('together this week') && await A.page.locator('.frow.me').count() === 1 && (await A.page.locator('header').innerText()).includes('Test crew'), 'joining shows the board with the group name and your own row');
  check(await A.page.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-friends')).key), 'the key is kept on the device');

  // numbers that are shared come from every saved progress
  const stats = await A.page.evaluate(() => {
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    window.shanlu.setState({ dayMin: 10 });
    window.shanlu.setState({ minLog: { [d(0)]: 10, [d(1)]: 20 }, activity: { [d(0)]: true, [d(1)]: true, [d(2)]: true } });
    window.shanlu.persistNow();
    localStorage.setItem('shanlu-progress-v1-l2', JSON.stringify({ minLog: { [d(0)]: 5 }, ws: {} }));
    return window.shanlu.friendStats();
  });
  check(stats.last7[6] === 15 && stats.last7[5] === 20 && stats.streak >= 3 && stats.levels[0] === 1 && !('ws' in stats) && Object.keys(stats).sort().join() === 'asOf,last7,lastActive,levels,mem,passed,streak', 'shared totals add up minutes across levels and contain nothing else (' + JSON.stringify(stats.last7) + ')');
  await A.page.evaluate(() => window.shanlu.friendsPush({}));

  // Mei joins; her name is shown as plain text
  const B = await mk();
  await B.page.goto(site + '#join=' + INVITE.toLowerCase()); await B.page.waitForSelector('.frjoin');
  await B.page.fill('#fr-name', '<b>Mei</b> & co');
  await B.page.locator('button', { hasText: 'Join group' }).click();
  await B.page.waitForSelector('.frow');
  check(await B.page.locator('.frow').count() === 2 && (await text(B.page)).includes('Alvin') && (await text(B.page)).includes('35 min'), 'Mei sees Alvin and his minutes (20 yesterday + 15 today)');
  await B.page.evaluate(() => window.shanlu.setState({ dayMin: 25 }));
  await B.page.evaluate(() => window.shanlu.friendsPush({}));

  // cheers
  await B.page.locator('.frow', { hasText: 'Alvin' }).locator('.fcheer').click();
  await B.page.waitForFunction(() => document.querySelector('.fcheer.on'));
  await A.page.locator('button', { hasText: 'Refresh' }).click();
  await A.page.waitForFunction(() => document.querySelector('.frow.me') && /1 cheer/.test(document.querySelector('.frow.me').innerText));
  check(true, 'a cheer from Mei shows up for Alvin');
  const meiRow = await A.page.evaluate(() => { const r = [...document.querySelectorAll('.frow')].find(x => !x.classList.contains('me')); return { text: r.querySelector('.fname b').textContent, kids: r.querySelector('.fname b').children.length, html: r.innerHTML.includes('<b>Mei</b>') }; });
  check(meiRow.kids === 0 && !meiRow.html && /Mei/.test(meiRow.text) && /&/.test(meiRow.text), 'a name with HTML in it is shown as plain text (' + meiRow.text + ')');
  await A.page.locator('button', { hasText: 'Streak' }).click();
  check(await A.page.locator('.seg2 button.on', { hasText: 'Streak' }).count() === 1, 'the board can be ordered by streak');

  // Home card
  await A.page.locator('nav button', { hasText: 'Home' }).click();
  await A.page.waitForSelector('.frhome');
  check((await A.page.locator('.frhome').innerText()).includes('studied today') && await A.page.locator('.frhome .fav').count() === 2, 'Home shows who studied today');

  // spaced-out syncing: 30 quick changes cause no extra uploads
  const before = A.page.puts;
  for (let i = 0; i < 30; i++) await A.page.evaluate((i) => window.shanlu.setState({ dayMin: 31 + i }), i);
  await A.page.waitForTimeout(6500);
  check(A.page.puts === before, 'many quick changes do not cause more uploads (the last upload was under 10 minutes ago)');

  // the same person on two devices: progress, exam passes and minutes end up identical on both
  await A.page.evaluate(() => {
    const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
    ws['你好'].see = { s: 3, l: 0, t: Date.now() }; ws['你好'].prod = { s: 3, l: 0, t: Date.now() };
    app.setState({ ws, exams: [{ at: 1, mode: 'full', l: 18, r: 18, lt: 20, rt: 20 }] });
    app.persistNow();
  });
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  const link2 = await A.page.evaluate(() => { const v = JSON.parse(localStorage.getItem('shanlu-friends')); return location.href.replace(/#.*$/, '') + '#me=' + v.id + '.' + v.key; });
  const E = await mk();
  await E.page.goto(link2); await E.page.waitForSelector('.frow.me');
  await E.page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('shanlu-progress-v1') || '{}'); return s.ws && s.ws['你好'] && s.ws['你好'].see.s === 3; });
  check(await E.page.evaluate(() => window.ShanluLevel.unlocked(2) && (JSON.parse(localStorage.getItem('shanlu-progress-v1')).exams || []).length === 1), 'a second device gets your words and your exam pass, so HSK 2 is unlocked there too');
  check(await E.page.evaluate(() => window.shanlu.state.ws['你好'].see.s === 3), 'and the page on the second device already shows them');
  await E.page.evaluate(() => {
    const app = window.shanlu; const ws = JSON.parse(JSON.stringify(app.state.ws));
    ws['谢谢'].see = { s: 4, l: 0, t: Date.now() };
    app.setState({ ws, dayMin: app.state.dayMin + 20 }); app.persistNow();   // studies 20 more minutes on this device
  });
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  const dbg = (pg) => pg.evaluate(() => ['shanlu-progress-v1', 'shanlu-progress-v1-l2', 'shanlu-progress-v1-all'].map(k => { const s = JSON.parse(localStorage.getItem(k) || 'null'); return s ? [k.slice(-6), s.day, s.dayMin, JSON.stringify(s.minLog), JSON.stringify(s.minDev)] : [k.slice(-6), null]; }));
  if (process.env.DBG) { console.log('A', JSON.stringify(await dbg(A.page))); console.log('E', JSON.stringify(await dbg(E.page))); }
  const sa = await A.page.evaluate(() => window.shanlu.friendStats()), se = await E.page.evaluate(() => window.shanlu.friendStats());
  check(await A.page.evaluate(() => window.shanlu.state.ws['谢谢'].see.s === 4), 'a word studied on the second device appears on the first');
  check(JSON.stringify(sa) === JSON.stringify(se) && sa.mem > 0 && sa.last7[6] === 60 + 5 + 20 && sa.passed.includes(1), 'both devices report identical totals ' + (JSON.stringify(sa) === JSON.stringify(se) ? '' : JSON.stringify(sa) + ' vs ' + JSON.stringify(se)) + ', with minutes from both devices added up (60 on the first, 5 from the HSK 2 save, 20 on the second = ' + sa.last7[6] + ' today)');
  // the person's own settings and notes follow them to every device
  const serverCopy = (pg) => pg.evaluate(async (api) => { const v = JSON.parse(localStorage.getItem('shanlu-friends')); const r = await fetch(api + '/api/me/progress', { headers: { authorization: 'Bearer ' + v.id + '.' + v.key } }); return r.text(); }, api);
  await A.page.evaluate(() => {
    const app = window.shanlu;
    app.lsnStep(2); app.setTtsVoice('Neil'); app.aiHfToggle(); app.memRemember('learner likes hiking');
    app.setState({ aliKeyInput: 'sk-ali-secret' }); app.aliSaveKey();
  });
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  const pe = await E.page.evaluate(() => ({ lvl: window.shanlu.state.lsnLvl, voice: window.shanlu.state.ttsVoice, hf: window.shanlu.state.handsFree, facts: window.shanlu.state.memFacts.map(f => f.t), ali: (JSON.parse(localStorage.getItem('shanlu-ai')).ali || {}).key || null, on: window.shanlu.state.aiOn }));
  check(pe.lvl === 3 && pe.voice === 'Neil' && pe.hf === true && pe.facts.join() === 'learner likes hiking', 'the listening level, chat settings and remembered facts reach the person\'s other device');
  check(pe.ali === null && !(await serverCopy(A.page)).includes('sk-ali-secret'), 'API keys stay on the device by default and are not on the server');
  await A.page.evaluate(() => window.shanlu.keySyncToggle());
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  const pe2 = await E.page.evaluate(() => ({ ali: (JSON.parse(localStorage.getItem('shanlu-ai')).ali || {}).key || null, on: window.shanlu.state.aiOn, keys: window.shanlu.state.syncKeys }));
  check(pe2.ali === 'sk-ali-secret' && pe2.on === true && pe2.keys === true && (await serverCopy(A.page)).includes('sk-ali-secret'), 'switching key sharing on gives the other device the key');
  await E.page.evaluate(() => { window.shanlu.memForget(0); window.shanlu.lsnStep(1); });
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  const pa = await A.page.evaluate(() => ({ lvl: window.shanlu.state.lsnLvl, facts: window.shanlu.state.memFacts.length }));
  check(pa.lvl === 4 && pa.facts === 0, 'a fact forgotten and a level changed on one device show up on the other');
  await E.page.evaluate(() => window.shanlu.keySyncToggle());
  await E.page.evaluate(() => window.shanlu.friendsPush({}));
  check(!(await serverCopy(E.page)).includes('sk-ali-secret'), 'switching key sharing off removes the keys from the server');
  await A.page.evaluate(() => window.shanlu.friendsPush({}));
  check((await A.page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).ali.key)) === 'sk-ali-secret' && (await E.page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-ai')).ali.key)) === 'sk-ali-secret', 'the keys stay on the devices that already have them');
  const exp = await A.page.evaluate(() => { window.shanlu.persistNow(); return JSON.stringify(JSON.parse(localStorage.getItem('shanlu-progress-v1'))); });
  check(!exp.includes('sk-ali-secret') && !exp.includes('hiking'), 'none of it is in the progress file that is exported or synced to GitHub');
  await E.ctx.close();

  // personal link signs in on another device
  const link = await A.page.evaluate(() => { const v = JSON.parse(localStorage.getItem('shanlu-friends')); return location.href.replace(/#.*$/, '') + '#me=' + v.id + '.' + v.key; });
  const C = await mk();
  await C.page.goto(link); await C.page.waitForSelector('.frow.me');
  check((await text(C.page)).includes('Signed in on this device') && await C.page.locator('.frow').count() === 2 && (await C.page.evaluate(() => location.hash)) === '', 'a personal link signs a second device in, and the key leaves the address bar');
  await C.ctx.close();
  const Cbad = await mk();
  await Cbad.page.goto(site + '#me=' + '0'.repeat(16) + '.' + '1'.repeat(48)); await Cbad.page.waitForSelector('.banner.err');
  check(await Cbad.page.locator('.frjoin').count() === 1 && await Cbad.page.evaluate(() => !localStorage.getItem('shanlu-friends')), 'a wrong personal link is refused and nothing is kept');
  await Cbad.ctx.close();

  // wrong invite
  const D = await mk();
  await D.page.goto(site + '#join=WRONG-CODE-HERE'); await D.page.waitForSelector('.frjoin');
  await D.page.fill('#fr-name', 'Eve'); await D.page.locator('button', { hasText: 'Join group' }).click();
  await D.page.waitForSelector('.banner.err');
  check((await text(D.page)).includes('invite code does not work') && await D.page.evaluate(() => !localStorage.getItem('shanlu-friends')), 'a wrong invite code is refused with a clear message');
  await D.ctx.close();

  // leaving
  await B.page.locator('button', { hasText: 'Leave group' }).click();
  check((await text(B.page)).includes('Tap again'), 'leaving asks for a second tap');
  await B.page.locator('button', { hasText: 'Tap again to leave' }).click();
  await B.page.waitForSelector('.frjoin');
  await A.page.locator('nav button', { hasText: 'Friends' }).click();
  await A.page.locator('button', { hasText: 'Refresh' }).click();
  await A.page.waitForFunction(() => document.querySelectorAll('.frow').length === 1);
  check(await B.page.evaluate(() => !localStorage.getItem('shanlu-friends')), 'Mei left and the group list shrinks');

  // server gone: a message, and the rest of the app keeps working
  await mf.dispose();
  await A.page.locator('nav button', { hasText: 'Friends' }).click();
  await A.page.locator('button', { hasText: 'Refresh' }).click();
  await A.page.waitForSelector('.banner.err');
  check((await text(A.page)).includes('Could not reach the friends board'), 'if the server is unreachable the app says so');
  await A.page.locator('nav button', { hasText: 'Word webs' }).click();
  check((await text(A.page)).length > 100 && A.errors.length === 0 && B.errors.length === 0, 'the rest of the app keeps working (no page errors: ' + A.errors.concat(B.errors).slice(0, 2).join(' | ') + ')');

  await browser.close(); server.close();
  console.log(failures ? failures + ' friends check(s) failed' : 'all friends checks passed');
  process.exit(failures ? 1 : 0);
})();
