/* Browser test for phone reminders (F1, Settings > Reminders) against the real worker.js on a local D1 (Miniflare, needs  cd worker && npm install).
 * Headless browsers have no push service, so window.SHANLU_PUSH_FAKE stands in for the browser's push subscription (it uses real P-256 keys, so the
 * Worker's encryption runs as usual). Checks: the row's states (no group, ready), switching on stores the subscription with the hour and time zone,
 * "Send a test" reaches the push address, the hour can be changed, and switching off removes it.
 * Usage: NODE_PATH="$(npm root -g)" node tools/smoke-test-remind.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  if (!fs.existsSync(path.join(root, 'worker', 'node_modules', 'miniflare'))) { console.log('skipped: run "cd worker && npm install" first'); process.exit(0); }
  await new Promise(r => server.listen(0, r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const vapid = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }); const vj = vapid.privateKey.export({ format: 'jwk' });
  const vapidPub = Buffer.concat([Buffer.from([4]), Buffer.from(vj.x, 'base64url'), Buffer.from(vj.y, 'base64url')]).toString('base64url');
  const sent = [];
  const { makeWorker } = await import(path.join(root, 'worker', 'test.mjs'));
  const mf = await makeWorker({ ALLOWED_ORIGINS: origin, VAPID_PUBLIC_KEY: vapidPub, VAPID_PRIVATE_KEY: vj.d, PUSH_TEST_HOST: 'https://push.example/' },
    { outboundService: async (req) => { sent.push(req.url); return new Response('', { status: 201 }); } });
  const api = String(await mf.ready).replace(/\/$/, '');
  const j = await (await fetch(api + '/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ name: 'Rae' }) })).json();
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const fakeSub = { endpoint: 'https://push.example/sub-1', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };

  const browser = await chromium.launch();
  const mk = async (member) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.grantPermissions(['notifications'], { origin });
    await ctx.addInitScript((o) => {
      window.SHANLU_MUTE_SFX = true;
      let on = false;
      window.SHANLU_PUSH_KEYS = [];
      window.SHANLU_PUSH_FAKE = async (make, key) => { if (make) { on = true; window.SHANLU_PUSH_KEYS.push(key); } return on ? { endpoint: o.sub.endpoint, toJSON: () => o.sub, unsubscribe: async () => { on = false; return true; } } : null; };
      if (o.member) { window.SHANLU_FRIENDS_URL = o.api; localStorage.setItem('shanlu-friends', JSON.stringify(o.member)); }
    }, { sub: fakeSub, api, member });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(origin + '/'); await page.waitForSelector('.app');
    await page.evaluate(() => { window.shanlu.go('voice'); window.shanlu.setSec('remind'); }); await page.waitForTimeout(150);
    return { ctx, page, errors };
  };

  const A = await mk(null);
  check(await A.page.locator('.st-item.open .st-row:has-text("Reminders")').count() === 1, 'Settings has a Reminders row');
  check(await A.page.locator('.rem .banner:has-text("join the group")').count() === 1 && await A.page.locator('.rem-switch').count() === 0, 'without the study group it says to join first');
  await A.ctx.close();

  const B = await mk({ id: j.id, key: j.key, name: j.name, group: j.group });
  const p = B.page;
  check(await p.locator('.rem-switch').count() === 1 && (await p.locator('.rem-h').textContent()).trim() === '7 pm', 'in the group it offers reminders, at 7 pm by default');
  await p.locator('.rem-time .btn[aria-label="Later"]').click(); await p.waitForTimeout(60);
  check((await p.locator('.rem-h').textContent()).trim() === '8 pm', 'the time can be changed');
  await p.locator('.rem-switch').click();
  await p.waitForFunction(() => /Reminders are on|blocked|not set up|Could not/.test((document.querySelector('.rem-msg') || {}).textContent || ''), null, { timeout: 8000 });
  check((await p.locator('.rem-msg').textContent()).includes('Reminders are on'), 'switching on works: ' + (await p.locator('.rem-msg').textContent()));
  check((await p.evaluate(() => window.SHANLU_PUSH_KEYS))[0] === vapidPub, 'the browser subscribes with the server\'s key');
  const tok = 'Bearer ' + j.id + '.' + j.key;
  check((await (await fetch(api + '/api/push', { headers: { Authorization: tok, Origin: origin } })).json()).subs === 1, 'the server has this device');
  check((await p.locator('.st-item.open .st-sum').textContent()).includes('8 pm'), 'the row says when');
  await p.locator('.rem-test').click();
  await p.waitForFunction(() => /Sent|did not|Could not/.test((document.querySelector('.rem-msg') || {}).textContent || ''), null, { timeout: 8000 });
  check(sent.length === 1 && sent[0] === fakeSub.endpoint, '"Send a test" reaches the push address');
  // the hourly cron, at 8 pm in this browser's time zone, sends the reminder
  const tz = await p.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  let at = Date.now(); for (let i = 0; i < 48; i++) { const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(at))); if (h === 20) break; at += 3600000; }
  const w = await mf.getWorker(); await w.scheduled({ scheduledTime: at + 86400000 * 2, cron: '7 * * * *' });
  check(sent.length === 2, 'the hourly check sends the day\'s reminder at 8 pm (' + tz + ')');
  await p.locator('.rem-switch').click();
  await p.waitForFunction(() => /off/.test((document.querySelector('.rem-msg') || {}).textContent || ''), null, { timeout: 8000 });
  check((await (await fetch(api + '/api/push', { headers: { Authorization: tok, Origin: origin } })).json()).subs === 0, 'switching off removes the device on the server');
  check(B.errors.length === 0, 'no page errors' + (B.errors.length ? ': ' + B.errors.join(' | ') : ''));

  await browser.close(); await mf.dispose(); server.close();
  console.log(failures ? failures + ' check(s) failed' : 'all reminder checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
