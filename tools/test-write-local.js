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
  // a run-on, toneless pinyin answer reaches the AI split into syllables, with the model answer's pinyin beside it (Qwen could not read babarangwomaiyao as one run)
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => { window.SHANLU_AUTO_SHARE = 0; localStorage.setItem('shanlu-ai', JSON.stringify({ provider:'alibaba', ali:{ key:'test-key' } })); });
  const p2 = await ctx2.newPage(); const sent = [];
  await p2.route('**/chat/completions', (route) => { const b = JSON.parse(route.request().postData()); sent.push(b.messages[1].content); route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ choices:[{ message:{ content:'{"verdict":"pass","better":"","reason":""}' } }] }) }); });
  await p2.goto(url); await p2.waitForTimeout(800);
  const r2 = await p2.evaluate(async () => {
    const a = window.shanlu; const q = { type:'write', big:'Dad asked me to buy medicine.', gtitle:'让', model:'爸爸让我去买药。', need:'让', pt:'g1-svo', gdim:'w' };
    a.setState({ screen:'quiz', qmode:'greview', qi:0, qres:[], qchecked:false, qbusy:false, qerr:'', qtyped:'Babarangwomaiyao', qcorrect:false });
    await a.checkWrite(q); return { checked:a.state.qchecked, correct:a.state.qcorrect, err:a.state.qerr };
  });
  check(r2.checked && r2.correct && sent.length === 1, 'a run-on pinyin answer is sent to the AI and its pass shows ' + JSON.stringify(r2));
  check(/Ba ba rang wo mai yao/.test(sent[0] || ''), 'the AI is given the answer split into syllables: ' + (sent[0] || '').split('\n').slice(-2).join(' | '));
  check(/Bàba ràng wǒ qù mǎi yào/.test(sent[0] || ''), 'the AI is given the pinyin of the model answer');
  await ctx2.close();
  // the Report a mistake link on a written answer carries what was typed and the verdict
  await page.evaluate(() => {
    const a = window.shanlu; const q = { type:'write', kicker:'Write it', prompt:'Write this', big:'Please sit.', gtitle:'请, 一下 and 喂', model:'请坐。', need:'', pt:'g1-svo', gdim:'w', reveal:'请坐。', explain:'' };
    a.quizQs = [q];
    a.setState({ screen:'quiz', qmode:'greview', qi:0, qres:[], qchecked:true, qcorrect:false, qfeed:'Too strict.', qtyped:'Qingzuo', qdone:false });
  });
  await page.waitForTimeout(300);
  const href = await page.evaluate(() => { const l = document.querySelector('.fb a.report'); return l ? decodeURIComponent(l.getAttribute('href')) : ''; });
  check(/What I typed: Qingzuo/.test(href) && /marked wrong/.test(href) && /Model answer: 请坐/.test(href) && /Too strict/.test(href), 'the report link has the typed answer, the model answer and the verdict: ' + href.slice(0, 60));
  check(errs.length === 0, 'no script errors ' + errs.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'all passed'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
