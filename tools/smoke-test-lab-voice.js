/* The Listening lab speaks through the Qwen voice when an Alibaba key is saved, remembers a made line (no second request for it, even after a reload),
 * and uses the browser voice (no request at all) when there is no key.   node tools/smoke-test-lab-voice.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const asked = [];
  await ctx.route('https://dashscope-intl.aliyuncs.com/**', (r) => { try { asked.push(JSON.parse(r.request().postData()).input.text); } catch (e) { asked.push('?'); }
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ output: { audio: { url: 'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/x' + asked.length + '.wav' } } }) }); });
  await ctx.route('https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'audio/wav', body: Buffer.alloc(64) }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url); await page.waitForSelector('.app');
  const toLab = async () => { await page.locator('.nav', { hasText: 'Listening lab' }).first().click(); await page.waitForTimeout(300); };
  await toLab();
  await page.locator('button', { hasText: /Play|Listen/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  check(asked.length === 0, 'with no Alibaba key the lab asks Alibaba for nothing (browser voice)');
  await page.evaluate(() => { const a = window.shanlu; a.setState({ aliKeyInput: 'sk-test-key' }); a.aliSaveKey(); });
  const clip = await page.evaluate(() => window.shanlu.state.dclip);
  const zh = await page.evaluate(() => { const L = window.HSK1_LISTEN.clips; return L[window.shanlu.state.dclip].zh; });
  await page.evaluate(() => window.shanlu.playClip()); await page.waitForTimeout(900);
  check(asked.length === 1 && asked[0] === zh, 'the clip is made by Qwen with the clip text (asked: ' + asked.join('|') + ')');
  await page.evaluate(() => window.shanlu.playClip()); await page.waitForTimeout(700);
  await page.evaluate(() => window.shanlu.state && window.shanlu.setState({ drate: 0.6 })); await page.evaluate(() => window.shanlu.playClip()); await page.waitForTimeout(700);
  check(asked.length === 1, 'playing it again, even at another speed, is not made again');
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate((c) => window.shanlu.setState({ dclip: c }), clip);
  await page.evaluate(() => window.shanlu.playClip()); await page.waitForTimeout(900);
  check(asked.length === 1, 'after a reload the same clip is not made (and billed) again');
  await page.evaluate(() => window.shanlu.playTone()); await page.waitForTimeout(800);
  check(asked.length === 2 && asked[1].length === 1, 'the tone drill is made by Qwen too (' + asked[1] + ')');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('lab voice tests passed');
})();
