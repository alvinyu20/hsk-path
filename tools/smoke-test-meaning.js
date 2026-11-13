/* Listening lab, Meaning: hear a clip, type what it means in English, the AI checks it (against a fake Anthropic API).
 * With no key you rate your own answer. Now and then a Dictation clip turns into a Meaning clip.   node tools/smoke-test-meaning.js */
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
  const calls = []; let verdicts = ['pass', 'close', 'fix'];
  await ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    calls.push(JSON.parse(req.postData()));
    const v = verdicts.shift() || 'pass';
    const reply = { verdict: v, reason: v === 'pass' ? '' : 'Look at the question word again.' };
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url); await page.waitForSelector('.app');
  await page.evaluate(() => { window.SHANLU_MEAN_MIX = 0; window.shanlu.go('listen'); });
  await page.waitForTimeout(200);
  check((await page.locator('.seg2 button', { hasText: 'Meaning' }).count()) === 1, 'the Listening lab has a Meaning tab');
  await page.locator('.seg2 button', { hasText: 'Meaning' }).click();
  const clip = await page.evaluate(() => { const L = window.HSK1_LISTEN.clips[window.shanlu.state.dclip]; return { zh: L.zh, en: L.en, py: L.py }; });
  check((await page.locator('main').innerText()).includes('What does it mean?') && (await page.locator('main').innerText()).includes('No AI key is saved'), 'Meaning asks what the clip means, and says what happens with no AI key');
  // no key: an exact answer is right with no AI, anything else is rated by you
  await page.fill('#mean-input', clip.en.toUpperCase().replace(/[.?!]$/, ''));
  await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForTimeout(150);
  check((await page.locator('.lfb').innerText()).startsWith('Right') && (await page.locator('.lfb').innerText()).includes(clip.en), 'with no key, the model answer typed back is right and the meaning is shown');
  await page.locator('button', { hasText: 'Next clip' }).click(); await page.waitForTimeout(150);
  await page.fill('#mean-input', 'purple elephants');
  await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForTimeout(150);
  check((await page.locator('.lfb').innerText()).includes('Check it yourself') && (await page.locator('.lfb button', { hasText: 'I had it' }).count()) === 1 && calls.length === 0, 'with no key, anything else asks you to rate yourself (no AI call)');
  await page.locator('.lfb button', { hasText: 'Not quite' }).click(); await page.waitForTimeout(150);
  check((await page.locator('.lfb').innerText()).startsWith('Not quite') && (await page.evaluate(() => Object.keys(window.shanlu.state.mbest).length)) === 1, 'rating yourself "Not quite" settles it and earns no credit');
  // with a key: the AI decides
  await page.evaluate(() => { localStorage.setItem('shanlu-ai', JSON.stringify({ key: 'sk-ant-test' })); });
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate(() => { window.SHANLU_MEAN_MIX = 0; window.shanlu.go('listen'); });
  await page.locator('.seg2 button', { hasText: 'Meaning' }).click();
  const c2 = await page.evaluate(() => { const L = window.HSK1_LISTEN.clips[window.shanlu.state.dclip]; return { zh: L.zh, en: L.en }; });
  const xp0 = await page.evaluate(() => window.shanlu.state.xp);
  await page.fill('#mean-input', 'Chinese 你好');
  await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForTimeout(150);
  check(calls.length === 0 && (await page.locator('.m-err').innerText()).includes('English'), 'an answer in Chinese is turned away without asking the AI');
  await page.fill('#mean-input', 'something about the weather');
  await page.locator('button', { hasText: 'Check my answer' }).click();
  await page.waitForSelector('.lfb');
  const res1 = await page.locator('.lfb').innerText();
  check(calls.length === 1 && /^claude-/.test(calls[0].model) && calls[0].messages[0].content.includes(c2.zh) && calls[0].messages[0].content.includes('something about the weather'), 'the AI gets the Chinese, the model answer and your answer');
  check(res1.startsWith('Right') && res1.includes(c2.en) && res1.includes('Checked by Claude'), 'a "pass" shows Right, the meaning and who checked it');
  check((await page.evaluate(() => window.shanlu.state.xp)) > xp0 && (await page.evaluate((z) => window.shanlu.state.mbest[z], c2.zh)) === 2, 'a right answer earns points and is remembered');
  await page.locator('button', { hasText: 'Next clip' }).click(); await page.waitForTimeout(150);
  await page.fill('#mean-input', 'a different thing');
  await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForSelector('.lfb');
  const res2 = await page.locator('.lfb').innerText();
  check(res2.startsWith('Close') && res2.includes('Look at the question word again.'), 'a "close" answer says what to look at again');
  await page.locator('button', { hasText: 'Next clip' }).click(); await page.waitForTimeout(150);
  await page.fill('#mean-input', 'nonsense');
  await page.locator('button', { hasText: 'Peek at the pinyin' }).click();
  check((await page.locator('main').innerText()).includes(await page.evaluate(() => window.HSK1_LISTEN.clips[window.shanlu.state.dclip].py)), 'Peek shows the pinyin first');
  await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForSelector('.lfb');
  check((await page.locator('.lfb').innerText()).startsWith('Not quite') && (await page.locator('.lfb').innerText()).includes('You peeked'), 'peeking is noted and a wrong answer says Not quite');
  // a Dictation clip turns into a Meaning clip now and then
  await page.evaluate(() => { window.SHANLU_MEAN_MIX = 1; window.shanlu.setState({ lmode: 'dict' }); });
  await page.locator('button', { hasText: 'Another clip' }).click(); await page.waitForTimeout(200);
  check((await page.locator('main').innerText()).includes('Mixed in: say what this one means') && (await page.locator('.lab-main .seg2 button.on').innerText()) === 'Meaning', 'with a key, Dictation sometimes turns a clip into a Meaning clip');
  await page.evaluate(() => { window.SHANLU_MEAN_MIX = 0; });
  verdicts = ['pass']; await page.fill('#mean-input', 'anything'); await page.locator('button', { hasText: 'Check my answer' }).click(); await page.waitForSelector('.lfb');
  await page.locator('button', { hasText: 'Back to Dictation' }).click(); await page.waitForTimeout(200);
  check((await page.locator('.lab-main .seg2 button.on').innerText()) === 'Dictation' && (await page.locator('main').innerText()).includes('What do you hear?'), '"Back to Dictation" returns to the usual mode');
  // the mix never happens with no key
  await page.evaluate(() => { localStorage.removeItem('shanlu-ai'); });
  await page.reload(); await page.waitForSelector('.app');
  await page.evaluate(() => { window.SHANLU_MEAN_MIX = 1; window.shanlu.go('listen'); });
  await page.locator('button', { hasText: 'Another clip' }).click(); await page.waitForTimeout(200);
  check((await page.locator('.lab-main .seg2 button.on').innerText()) === 'Dictation', 'with no key Dictation stays Dictation');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('meaning test passed');
})();
