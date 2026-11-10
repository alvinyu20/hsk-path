/* Recorded audio (made by tools/make-audio.py): a text with a recording plays the file, with or without an Alibaba key, and never asks Alibaba;
 * a conversation plays from files when every line has one (woman's and man's files), and otherwise goes on as before.   node tools/smoke-test-audio.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
const wav = (() => { const n = 800, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const files = [], qwen = [];
  await ctx.route('**/data/audio-manifest.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: 'window.SHANLU_AUDIO={"谢谢":"aaaaaaaaaaaaaa.mp3","你好吗？":"bbbbbbbbbbbbbb.mp3","m|我很好。":"cccccccccccccc.mp3","旧的":"mp3"};' }));
  await ctx.route('**/audio/*', (r) => { files.push(decodeURIComponent(new URL(r.request().url()).pathname.split('/audio/')[1])); r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
  await ctx.route('https://dashscope-intl.aliyuncs.com/**', (r) => { try { qwen.push(JSON.parse(r.request().postData()).input.text); } catch (e) { qwen.push('?'); } r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url); await page.waitForSelector('.app');
  const wait = (ms) => page.waitForTimeout(ms);
  // no key: a recorded word plays its file; an unrecorded one makes no request
  await page.evaluate(() => window.shanlu.sayAi('谢谢', 'word')); await wait(300);
  check(files.length === 1 && files[0] === 'aaaaaaaaaaaaaa.mp3', 'a recorded word plays its file (' + files.join(',') + ')');
  await page.evaluate(() => window.shanlu.sayAi('你好', 'word')); await wait(300);
  check(files.length === 1, 'an unrecorded text asks for no file');
  await page.evaluate(() => window.shanlu.say('旧的', 'x')); await wait(300);
  check(files[files.length - 1] === '%E6%97%A7%E7%9A%84.mp3' || files[files.length - 1] === '旧的.mp3', 'a file named after its text still works (' + files[files.length - 1] + ')');
  // with a key: a recorded text still never asks Alibaba
  await page.evaluate(() => { const a = window.shanlu; a.setState({ aliKeyInput: 'sk-test-key' }); a.aliSaveKey(); });
  const before = files.length;
  await page.evaluate(() => window.shanlu.sayAi('谢谢', 'word')); await wait(300);
  check(files.length === before + 1 && qwen.length === 0, 'with a key saved, a recorded text still plays the file and asks Alibaba for nothing');
  // a conversation: the woman's file, then the man's
  files.length = 0;
  await page.evaluate(() => window.shanlu.speakLines([{ text: '你好吗？', pitch: 1.25 }, { text: '我很好。', pitch: 0.8 }], 'exq')); await wait(1200);
  check(files.join(',') === 'bbbbbbbbbbbbbb.mp3,cccccccccccccc.mp3', 'a conversation plays the woman\'s file and then the man\'s (' + files.join(',') + ')');
  check(qwen.length === 0, 'and asks Alibaba for nothing');
  // one line missing: the old path (the live Qwen voice) takes over
  files.length = 0;
  await page.evaluate(() => window.shanlu.speakLines([{ text: '你好吗？', pitch: 1.25 }, { text: '没有录音。', pitch: 0.8 }], 'exq')); await wait(900);
  check(files.length === 0 && qwen.length >= 1, 'a conversation with a line that has no recording is not played from files (live voice asked: ' + qwen.join('|') + ')');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close(); server.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('audio tests passed');
})();
