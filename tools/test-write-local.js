/* A "Write it" answer that is the model answer is right without asking the AI, whether it is in characters or in pinyin with no tones,
 * no spaces, capitals or punctuation. Anything else still goes to the AI.   node tools/test-write-local.js */
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.SHANLU_AUTO_SHARE = 0; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url); await page.waitForTimeout(800);
  const run = (model, typed) => page.evaluate(async ([model, typed]) => {
    const a = window.shanlu; const q = { type:'write', big:'x', gtitle:'t', model, need:'', pt:'g1-svo', gdim:'w' };
    a.setState({ screen:'quiz', qmode:'greview', qi:0, qres:[], qchecked:false, qbusy:false, qerr:'', qtyped:typed, qcorrect:false });
    await a.checkWrite(q);
    const S = a.state; return { checked:S.qchecked, correct:S.qcorrect, err:S.qerr };
  }, [model, typed]);
  const cases = [
    ['你有手机吗？', 'niyoumeiyoushouji', false],   // a different sentence (你有没有手机): goes to the AI, which is not set up here
    ['你有手机吗？', 'Niyoushoujima', true],
    ['你有手机吗？', 'Nǐ yǒu shǒujī ma?', true],
    ['你有手机吗？', 'ni3 you3 shou3ji1 ma', true],
    ['你有手机吗？', '你有手机吗', true],
    ['你有手机吗？', '你有手机吗？', true],
    ['他们都是学生。', 'Tamendoushixuesheng', true],
    ['请坐。', 'Qingzuo', true],
    ['请坐。', 'qing zuo.', true],
    ['请坐。', 'qingzuo ba', false],
  ];
  for (const [m, t, ok] of cases) {
    const r = await run(m, t);
    if (ok) check(r.checked && r.correct, 'right without the AI: ' + t + ' for ' + m);
    else check(!r.checked && /AI key/.test(r.err), 'not the model answer, goes to the AI: ' + t + ' for ' + m);
  }
  check(errs.length === 0, 'no script errors ' + errs.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
