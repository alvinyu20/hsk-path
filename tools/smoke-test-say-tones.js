/* Browser test (D2): Listening lab > Tone trainer > Say it. Made-up voices stand in for the microphone (window.SHANLU_SAY_PCM): a right tone
 * is marked right, a level voice where a 4th tone is wanted is marked with what it did and a tip, the curve is drawn, words are judged per syllable.
 *   NODE_PATH=$(npm root -g) node tools/smoke-test-say-tones.js */
const path = require('path');
const { chromium } = require('playwright');
const server = require('./test-static').server(path.join(__dirname, '..'));
const synth = require('./synth-voice');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForSelector('.app');
  const nav = require('./test-nav').makeNav(page);
  await nav('Listening lab');
  await page.locator('button', { hasText: 'Tone trainer' }).click();
  await page.locator('[aria-label="Tone trainer type"] button', { hasText: 'Say it' }).click(); await page.waitForTimeout(100);
  const text = () => page.locator('main').innerText();
  check(/Say it: your tones on a curve/.test(await text()) && await page.locator('.say-word .zh').count() === 1, 'Say it shows a word to say, with its pinyin and tones');
  const R = 16000, hz = (s, b) => s.map(k => k * b);
  const tryIt = async (it, sylls, base) => {
    await page.evaluate(([it, pcm]) => { window.SHANLU_SAY_PCM = { pcm:new Float32Array(pcm), rate:16000 }; window.shanlu.setState({ say:{ kind:it.t.length > 1 ? 'two' : 'one', it, rec:'idle', res:null, note:'' } }); },
      [it, Array.from(synth(sylls.map(s => hz(s, base)), R))]);
    await page.locator('.say-btns button.pri').click(); await page.waitForTimeout(200);
    return text();
  };
  let t = await tryIt({ zh:'骂', py:'mà', t:[4] }, [[1.35, 0.8]], 200);
  check(/That tone sounds right/.test(t) && /✓ The tone \(4\): falling/.test(t), 'a falling voice for mà is marked right');
  check(await page.evaluate(() => (document.querySelector('.say-mine') || {}).getAttribute('d').length > 20), 'your pitch curve is drawn');
  t = await tryIt({ zh:'骂', py:'mà', t:[4] }, [[1.2, 1.2]], 200);
  check(/Not quite/.test(t) && /should be falling; yours stayed level/.test(t) && /Start high and drop sharply/.test(t), 'a level voice for mà is marked, with what it did and a tip');
  t = await tryIt({ zh:'麻', py:'má', t:[2] }, [[0.95, 1.05, 1.35]], 120);
  check(/That tone sounds right/.test(t), 'a rising low voice for má is marked right');
  t = await tryIt({ zh:'老师', py:'lǎoshī', t:[3, 1] }, [[0.8, 0.72], [1.25, 1.25]], 200);
  check(/Those tones sound right/.test(t) && /✓ 1st syllable \(3\)/.test(t) && /✓ 2nd syllable \(1\)/.test(t) && await page.locator('.say-cut').count() === 1, 'a word: both syllables judged, the cut between them drawn');
  t = await tryIt({ zh:'上班', py:'shàngbān', t:[4, 1] }, [[1.25, 1.25], [1.25, 1.25]], 200);
  check(/✗ 1st syllable \(4\): should be falling/.test(t) && /✓ 2nd syllable \(1\)/.test(t), 'a word with a level 1st syllable where a 4 is wanted: that syllable is marked');
  t = await tryIt({ zh:'朋友', py:'péngyou', t:[2, 5] }, [[0.95, 1.05, 1.35], [1.0, 0.95]], 200);
  check(/a light tone, not judged/.test(t), 'a light tone is not judged');
  check(/Dashed: the tone shape/.test(t), 'without a recording, the dashed line is the tone shape');
  check(/of 6 right this session/.test(t), 'the tries are counted this session');
  await page.evaluate(() => { window.SHANLU_SAY_PCM = { pcm:new Float32Array(16000), rate:16000 }; });
  await page.locator('.say-btns button.pri').click(); await page.waitForTimeout(150);
  check(/could not hear a clear voice pitch/.test(await text()), 'silence: asked to say it louder, nothing judged');
  const before = await page.locator('.say-word .zh').innerText();
  for (let i = 0; i < 6 && (await page.locator('.say-word .zh').innerText()) === before; i++) { await page.locator('.say-btns button', { hasText: 'Next' }).click(); await page.waitForTimeout(50); }
  check((await page.locator('.say-word .zh').innerText()) !== before, 'Next gives another word');
  check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await browser.close(); server.close();

  // with the real recordings: the model's curve is decoded from the word's recording and drawn dashed
  const real = require('./test-static').server(path.join(__dirname, '..'), { realAudio: true });
  await new Promise(r => real.listen(0, r));
  const b2 = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p2 = await b2.newPage({ viewport: { width: 1100, height: 900 } });
  await p2.addInitScript(() => { window.SHANLU_MUTE_SFX = true; });
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto('http://127.0.0.1:' + real.address().port + '/'); await p2.waitForSelector('.app');
  const nav2 = require('./test-nav').makeNav(p2);
  await nav2('Listening lab'); await p2.locator('button', { hasText: 'Tone trainer' }).click();
  await p2.locator('[aria-label="Tone trainer type"] button', { hasText: 'Say it' }).click(); await p2.waitForTimeout(100);
  await p2.evaluate(([pcm]) => { window.SHANLU_SAY_PCM = { pcm:new Float32Array(pcm), rate:16000 }; window.shanlu.setState({ say:{ kind:'two', it:{ zh:'老师', py:'lǎoshī', t:[3, 1] }, rec:'idle', res:null, note:'' } }); },
    [Array.from(synth([[160, 144], [250, 250]], 16000))]);
  await p2.locator('.say-btns button.pri').click();
  await p2.waitForFunction(() => /Dashed: the recording/.test(document.querySelector('main').innerText), null, { timeout: 8000 }).catch(() => {});
  check(/Dashed: the recording/.test(await p2.locator('main').innerText()) && await p2.evaluate(() => (document.querySelector('.say-model') || {}).getAttribute('d').length > 40), 'with a recording, its own pitch curve is decoded and drawn dashed');
  // the microphone itself (Chromium's fake one): a recording starts, can be stopped by hand, and ends in a verdict or a note, never an error
  await p2.evaluate(() => { delete window.SHANLU_SAY_PCM; });
  await p2.locator('.say-btns button.pri').click(); await p2.waitForTimeout(600);
  const recOn = await p2.locator('.say-rec').count();
  if (recOn) { await p2.locator('.say-rec').click(); await p2.waitForTimeout(400); }
  const after = await p2.locator('main').innerText();
  check(recOn === 1 && (/sound right|Not quite|could not hear|did not hear/.test(after)), 'the microphone records, stops when tapped, and gives a verdict or a note');
  check(err2.length === 0, 'no page errors with the real recordings and the microphone: ' + err2.join(' | '));
  await b2.close(); real.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('say-it tone tests passed');
})();
