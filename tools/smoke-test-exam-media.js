/* Browser test for exam photos: a picture with a photo shows the photo, one without (or whose photo does not load) keeps its emoji, and credits are listed.
 * Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-exam-media.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const EMOJI = ['🍎', '🐶', '🐱', '✈', '💻', '📱', '🚗', '📺', '🍵', '👕', '🚆', '🍚', '🍞', '🥛', '📖'];

(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (media) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; });
    if (media) await ctx.route('**/data/exam-media.js*', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SHANLU_EXAM_MEDIA = ' + JSON.stringify(media) + ';' }));   // stands in for the real data file
    await ctx.route('**/upload.wikimedia.org/**', (r) => /bad\.png/.test(r.request().url()) ? r.abort() : r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const mk = (file) => Object.fromEntries(EMOJI.map(e => [e, { u: 'https://upload.wikimedia.org/test/' + file, c: 'Ann / CC BY 4.0', a: 'thing' }]));
  // walk an exam's questions; report what each pictured question shows
  const walk = async (page, covered) => page.evaluate(async (covered) => {
    const app = window.shanlu; app.startExam('listening'); await new Promise(r => setTimeout(r, 150));
    const out = { photoPic: 0, emojiPic: 0, photoOpts: 0, emojiOpts: 0, wrong: 0 };
    const cov = (e) => covered.indexOf(String(e).replace(/\uFE0F/g, '')) >= 0;
    const qs = app.state.exm.qs;
    for (let k = 0; k < qs.length; k++) {
      app.exGo(k); await new Promise(r => setTimeout(r, 60));
      const q = qs[k], el = document.querySelector('.exam, main') || document;
      if (q.pic) { const ph = !!document.querySelector('.ex-pic-photo .ex-img'); if (ph) out.photoPic++; else if (document.querySelector('.ex-pic')) out.emojiPic++; if (ph !== cov(q.pic)) out.wrong++; }
      const optEmoji = q.opts.filter(o => o.emoji).length;
      if (optEmoji) { const imgs = document.querySelectorAll('.ex-opt .ex-img').length; out.photoOpts += imgs; out.emojiOpts += optEmoji - imgs; if (imgs !== q.opts.filter(o => o.emoji && cov(o.label)).length) out.wrong++; }
    }
    return out;
  }, covered);

  { // photos for every picture: photos show
    const { ctx, page, errors } = await open(mk('ok.png'));
    const r = await walk(page, EMOJI);
    check(r.photoPic > 0 && r.wrong === 0, 'a pictured question shows its photo, not the emoji (' + JSON.stringify(r) + ')');
    check(r.photoOpts > 0 && r.emojiPic + r.emojiOpts > 0, 'answer pictures show photos, and pictures with no photo keep their emoji');
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  }
  { // photos that do not load: the emoji come back
    const { ctx, page, errors } = await open(mk('bad.png'));
    await page.waitForTimeout(100);
    const r = await walk(page, []);
    await page.waitForTimeout(400);
    const after = await walk(page, []);
    check(after.photoPic === 0 && after.photoOpts === 0 && (after.emojiPic > 0 || after.emojiOpts > 0), 'photos that fail to load are dropped and the emoji show (' + JSON.stringify(after) + ')');
    check(errors.length === 0, 'no page errors with broken photos: ' + errors.join(' | '));
    await ctx.close();
  }
  { // no photo data: nothing changes
    const { ctx, page, errors } = await open(null);
    const r = await walk(page, []);
    check(r.photoPic === 0 && r.photoOpts === 0 && (r.emojiPic > 0 || r.emojiOpts > 0), 'without photo data every picture is an emoji (' + JSON.stringify(r) + ')');
    await page.evaluate(() => window.shanlu.setState({ exm: null, screen: 'exam' }));
    check(!(await page.locator('.ex-credits').count()), 'no credits box without photos');
    check(errors.length === 0, 'no page errors without photos');
    await ctx.close();
  }
  { // credits listed in the lobby
    const { ctx, page } = await open(mk('ok.png'));
    await page.evaluate(() => window.shanlu.setState({ exm: null, screen: 'exam' }));
    await page.waitForTimeout(100);
    const t = await page.locator('.ex-credits').textContent().catch(() => '');   // textContent: the list is inside a closed <details>
    check(/Photo credits/.test(t) && /Ann \/ CC BY 4\.0/.test(t), 'the lobby lists the photo credits');
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failures ? failures + ' check(s) failed' : 'smoke-test-exam-media: all passed');
  process.exit(failures ? 1 : 0);
})();
