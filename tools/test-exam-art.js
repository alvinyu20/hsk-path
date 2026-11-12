/* Exam and test pictures are drawings (data/exam-art.js): every picture the exams use has one, each is a valid script-free SVG,
 * and a pictured question shows the drawing (whole, not cropped).   node tools/test-exam-art.js   (needs Playwright) */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_AUTO_SHARE = 0; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(site); await page.waitForSelector('.app');
  const d = await page.evaluate(() => {
    const ART = window.SHANLU_EXAM_ART || {}; const bad = []; const missing = []; const parser = new DOMParser(); const seen = {};
    const norm = (e) => String(e).replace(/️/g, '');
    const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { const v = o[k]; if (k === 'pic' && typeof v === 'string') seen[norm(v)] = 1; if ((k === 'opts' || k === 'o') && Array.isArray(v)) v.forEach((x) => { if (typeof x === 'string' && /\p{Extended_Pictographic}/u.test(x)) seen[norm(x)] = 1; }); walk(v); }); };
    [1, 2, 3].forEach((n) => walk(window['HSK' + n + '_EXAM']));
    Object.keys(seen).forEach((k) => { if (!ART[k]) missing.push(k); });
    Object.keys(ART).forEach((k) => {
      const m = /^data:image\/svg\+xml;charset=utf-8,(.*)$/.exec(ART[k].u || ''); if (!m) { bad.push(k + ': not an svg address'); return; }
      const svg = decodeURIComponent(m[1]); const doc = parser.parseFromString(svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) bad.push(k + ': does not parse');
      if (/<script|onload|onclick|href=|<image|<foreignObject/i.test(svg)) bad.push(k + ': has something it should not');
      if (!ART[k].a) bad.push(k + ': no description');
    });
    return { n: Object.keys(ART).length, used: Object.keys(seen).length, missing, bad };
  });
  check(d.used >= 50, 'the exams use many pictures (' + d.used + ')');
  check(d.missing.length === 0, 'every exam picture has a drawing' + (d.missing.length ? ': missing ' + d.missing.join(' ') : ''));
  check(d.bad.length === 0, 'every drawing is a clean SVG' + (d.bad.length ? ': ' + d.bad.slice(0, 4).join(' | ') : ''));
  const res = await page.evaluate(async () => {
    const app = window.shanlu; app.startExam('listening'); await new Promise((r) => setTimeout(r, 200));
    let pictured = 0, drawn = 0, emojiLeft = 0, shape = null;
    for (let i = 0; i < 20; i++) {
      app.exGo(i); await new Promise((r) => setTimeout(r, 60));
      const root = document.querySelector('.ex-q, .exam, body');
      const imgs = document.querySelectorAll('.ex-pic-photo .ex-img, .ex-opt .ex-img');
      if (imgs.length) { pictured++; if ([].every.call(imgs, (im) => /^data:image\/svg/.test(im.getAttribute('src')))) drawn++; if (!shape) { const cs = getComputedStyle(imgs[0]); shape = cs.objectFit + ' ' + cs.aspectRatio; } }
      if (document.querySelector('.ex-pic')) emojiLeft++;
    }
    return { pictured, drawn, emojiLeft, shape };
  });
  check(res.pictured >= 3 && res.drawn === res.pictured, 'pictured questions show drawings (' + res.drawn + ' of ' + res.pictured + ')');
  check(res.emojiLeft === 0, 'no emoji are left on pictured questions');
  check(/contain/.test(res.shape || ''), 'drawings are shown whole (' + res.shape + ')');
  check(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})();
