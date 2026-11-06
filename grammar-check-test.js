/* Shanlu: grammar checker comparison.
 * 30 learner sentences with a known right answer ("ok" = a teacher would accept it, "bad" = a teacher would send it back).
 * Each chosen AI gets the same instructions and the same sentences; the page scores them against the answers below.
 * Keys come from this browser's saved settings (localStorage 'shanlu-ai'); nothing is sent anywhere but the AI services. */
(function () {
  'use strict';
  // [point, English prompt, learner's answer, gold ('ok' | 'bad'), why]
  const ITEMS = [
    ['比 comparison', 'My older sister is taller than me.', '我姐姐比我高。', 'ok', 'correct'],
    ['比 comparison', 'My older sister is taller than me.', '我姐姐比我很高。', 'bad', '很 cannot follow 比'],
    ['比 comparison', 'My older sister is taller than me.', '我姐姐很高。', 'bad', 'grammatical, but 比 is not used'],
    ['比 comparison', 'My older sister is taller than me.', 'Wǒ jiějie bǐ wǒ hěn gāo.', 'bad', 'pinyin, 很 after 比'],
    ['了 completed action', 'I bought a book yesterday.', '我昨天买了一本书。', 'ok', 'correct'],
    ['了 completed action', 'I bought a book yesterday.', '我昨天了买书。', 'bad', '了 in the wrong place'],
    ['了 completed action', 'I bought a book yesterday.', '我昨天买了两本杂志。', 'bad', 'right grammar, wrong meaning (magazines)'],
    ['过 experience', 'I have been to Beijing.', '我去过北京。', 'ok', 'correct'],
    ['过 experience', 'I have been to Beijing.', 'Wǒ qù guo Běijīng.', 'ok', 'correct, in pinyin with tones'],
    ['过 experience', 'I have been to Beijing.', 'wo qu guo beijing', 'ok', 'correct, in pinyin without tones'],
    ['在 happening now', 'He is eating now.', '他现在在吃饭。', 'ok', 'correct'],
    ['在 happening now', 'He is eating now.', '他在现在吃饭。', 'bad', '在 and 现在 swapped'],
    ['得 complement', 'She speaks Chinese very well.', '她说汉语说得很好。', 'ok', 'correct'],
    ['得 complement', 'She speaks Chinese very well.', '她说得汉语很好。', 'bad', '得 before the object'],
    ['把', 'Please put the book on the table.', '请把书放在桌子上。', 'ok', 'correct'],
    ['把', 'Please put the book on the table.', '请把书放。', 'bad', '把 needs a result or place after the verb'],
    ['被', 'My phone was taken away by my brother.', '我的手机被哥哥拿走了。', 'ok', 'correct'],
    ['被', 'My phone was taken away by my brother.', '我的手机被拿走哥哥了。', 'bad', 'agent after the verb'],
    ['measure words', 'I have two cats.', '我有两只猫。', 'ok', 'correct'],
    ['measure words', 'I have two cats.', '我有两条猫。', 'bad', 'wrong measure word'],
    ['如果…就', 'If it rains tomorrow, I will not go.', '如果明天下雨，我就不去。', 'ok', 'correct'],
    ['如果…就', 'If it rains tomorrow, I will not go.', '明天下雨如果，我不去。', 'bad', '如果 in the wrong place'],
    ['因为…所以', 'Because I was ill, I did not go to school.', '因为我生病了，所以我没有去学校。', 'ok', 'correct'],
    ['不 / 没', 'I am not a student.', '我没是学生。', 'bad', '是 is negated with 不'],
    ['虽然…但是', 'Although it is cold, I still want to go out.', '虽然很冷，但是我还是想出去。', 'ok', 'correct'],
    ['虽然…但是', 'Although it is cold, I still want to go out.', '虽然很冷，因为我想出去。', 'bad', 'wrong connector, pattern missing'],
    ['一边…一边', 'He eats while watching TV.', '他一边吃饭一边看电视。', 'ok', 'correct'],
    ['一边…一边', 'He eats while watching TV.', '他一边吃饭，看一边电视。', 'bad', 'second 一边 misplaced'],
    ['还是 (or)', 'Do you want tea or coffee?', '你要茶还是咖啡？', 'ok', 'correct'],
    ['还是 (or)', 'Do you want tea or coffee?', '你要茶还是咖啡吗？', 'bad', '吗 cannot go with a 还是 question']
  ];

  const MODELS = [
    ['claude-haiku-5-5', 'Claude Haiku 5.5', 'anthropic'],
    ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'anthropic'],
    ['qwen-flash', 'Qwen Flash', 'alibaba'],
    ['qwen-plus', 'Qwen Plus', 'alibaba']
  ];

  const SYSTEM = [
    'You check one sentence written by a learner of Chinese (HSK 1 to 3). Reply with JSON only.',
    'You are given the English prompt, the grammar point being practised, and the learner\'s answer.',
    'The answer may be in Chinese characters or in pinyin (tone marks or numbers may be missing). Treat pinyin as the sentence the learner meant and judge that sentence. Do not fail an answer only because it is pinyin or lacks tones.',
    'Pass the answer only if all three are true: (1) the Chinese is grammatical and natural; (2) it uses the grammar point asked for; (3) it says what the English prompt says. Different natural wording, extra detail, or a different but correct word choice is fine. Ignore punctuation and spacing.',
    'Otherwise the verdict is "fix".',
    'Format: {"verdict":"pass" or "fix","better":"a corrected Chinese sentence, or the same sentence if it passes","reason":"one short sentence in English"}'
  ].join('\n');

  const $ = (id) => document.getElementById(id);
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('shanlu-ai')) || {}; } catch (e) {}
  const ali = cfg.ali || {};
  const have = { anthropic: !!cfg.key, alibaba: !!ali.key };
  const aliBase = () => { const ws = String(ali.ws || '').trim(); return ws ? 'https://' + ws + '.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1' : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function userMsg(it) { return 'English prompt: ' + it[1] + '\nGrammar point: ' + it[0] + '\nLearner\'s answer: ' + it[2]; }

  function parseVerdict(text) {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('no JSON');
    const o = JSON.parse(text.slice(i, j + 1));
    const v = String(o.verdict || '').toLowerCase();
    if (v !== 'pass' && v !== 'fix') throw new Error('no verdict');
    return { verdict: v, better: String(o.better || ''), reason: String(o.reason || '') };
  }

  async function ask(model, it) {
    const t0 = Date.now();
    let text;
    if (model[2] === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
        body: JSON.stringify({ model: model[0], max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content: userMsg(it) }] }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      text = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else {
      const body = { model: model[0], max_tokens: 300, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg(it) }], response_format: { type: 'json_object' } };
      let res = await fetch(aliBase() + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + ali.key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 400) { delete body.response_format; res = await fetch(aliBase() + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + ali.key, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const c = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
      text = Array.isArray(c) ? c.map((x) => x.text || '').join('') : String(c || '');
    }
    const r = parseVerdict(text);
    r.ms = Date.now() - t0;
    return r;
  }

  const results = {};   // model id -> array of { verdict, better, reason, ms } | { error }

  async function runModel(model, onTick) {
    const out = new Array(ITEMS.length);
    let next = 0;
    async function worker() {
      while (next < ITEMS.length) {
        const k = next++;
        try { out[k] = await ask(model, ITEMS[k]); }
        catch (e) { out[k] = { error: String(e && e.message || e) }; }
        onTick();
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    return out;
  }

  function scoreOf(arr) {
    let right = 0, falsePass = 0, falseFail = 0, errors = 0, ms = 0, n = 0;
    arr.forEach((r, k) => {
      if (!r || r.error) { errors++; return; }
      const gold = ITEMS[k][3];
      const said = r.verdict === 'pass' ? 'ok' : 'bad';
      if (said === gold) right++;
      else if (said === 'ok') falsePass++;
      else falseFail++;
      ms += r.ms; n++;
    });
    return { right, falsePass, falseFail, errors, avgMs: n ? Math.round(ms / n) : 0 };
  }

  function render() {
    const ids = MODELS.filter((m) => results[m[0]]);
    if (!ids.length) return;
    let h = '<table><tr><th>Model</th><th>Right</th><th>Wrongly passed</th><th>Wrongly failed</th><th>Errors</th><th>Avg time</th></tr>';
    ids.forEach((m) => {
      const s = scoreOf(results[m[0]]);
      h += '<tr><td>' + esc(m[1]) + '</td><td><b>' + s.right + ' / ' + ITEMS.length + '</b></td><td>' + s.falsePass + '</td><td>' + s.falseFail + '</td><td>' + s.errors + '</td><td>' + (s.avgMs / 1000).toFixed(1) + ' s</td></tr>';
    });
    h += '</table><p class="muted">"Wrongly passed" = the AI accepted a sentence a teacher would reject (the costly mistake). "Wrongly failed" = it rejected a good sentence.</p>';
    $('score').innerHTML = h; $('score').hidden = false;

    let d = '<table><tr><th>#</th><th>Point</th><th>Prompt and answer</th><th>Key</th>';
    ids.forEach((m) => { d += '<th>' + esc(m[1]) + '</th>'; });
    d += '</tr>';
    ITEMS.forEach((it, k) => {
      const cells = ids.map((m) => results[m[0]][k]);
      const dis = cells.some((r) => !r || r.error || (r.verdict === 'pass' ? 'ok' : 'bad') !== it[3]);
      d += '<tr' + (dis ? ' class="dis"' : '') + '><td>' + (k + 1) + '</td><td>' + esc(it[0]) + '</td><td class="zh">' + esc(it[2]) + '<br><span class="muted" style="font-size:12px">' + esc(it[1]) + ' (' + esc(it[4]) + ')</span></td><td>' + it[3] + '</td>';
      cells.forEach((r) => {
        if (!r) d += '<td class="muted">…</td>';
        else if (r.error) d += '<td class="no">error: ' + esc(r.error) + '</td>';
        else {
          const right = (r.verdict === 'pass' ? 'ok' : 'bad') === it[3];
          d += '<td class="' + (right ? 'ok' : 'no') + '">' + (r.verdict === 'pass' ? 'pass' : 'fix') + (right ? '' : ' ✗') + '<br><span class="muted" style="font-weight:400;font-size:12px">' + esc(r.reason) + (r.verdict === 'fix' && r.better ? '<br>' + esc(r.better) : '') + '</span></td>';
        }
      });
      d += '</tr>';
    });
    d += '</table>';
    $('detail').innerHTML = d; $('detail').hidden = false;
  }

  function compact() {
    const ids = MODELS.filter((m) => results[m[0]]);
    let t = 'Grammar checker test (' + ITEMS.length + ' sentences)\n';
    ids.forEach((m) => { const s = scoreOf(results[m[0]]); t += m[1] + ': right ' + s.right + '/' + ITEMS.length + ', wrongly passed ' + s.falsePass + ', wrongly failed ' + s.falseFail + ', errors ' + s.errors + ', avg ' + (s.avgMs / 1000).toFixed(1) + 's\n'; });
    t += '\nMisses (key | model said | reason):\n';
    ITEMS.forEach((it, k) => {
      ids.forEach((m) => {
        const r = results[m[0]][k];
        if (!r) return;
        if (r.error) { t += (k + 1) + ' ' + m[1] + ': ERROR ' + r.error + '\n'; return; }
        const said = r.verdict === 'pass' ? 'ok' : 'bad';
        if (said !== it[3]) t += (k + 1) + ' ' + it[2] + ' | key ' + it[3] + ' (' + it[4] + ') | ' + m[1] + ' said ' + r.verdict + ': ' + r.reason + '\n';
      });
    });
    return t;
  }

  // ---- page set-up ----
  $('keys').textContent = (have.anthropic ? 'Anthropic key found. ' : 'No Anthropic key saved here. ') + (have.alibaba ? 'Alibaba key found.' : 'No Alibaba key saved here.') + ' Keys are read from this browser, so open this page in the browser where the site\'s Settings has them.';
  let h = '';
  MODELS.forEach((m, i) => { h += '<label><input type="checkbox" data-m="' + i + '"' + (have[m[2]] ? ' checked' : ' disabled') + '> ' + esc(m[1]) + '</label>'; });
  $('models').innerHTML = h;

  $('run').addEventListener('click', async () => {
    const picks = MODELS.filter((m, i) => { const c = document.querySelector('[data-m="' + i + '"]'); return c && c.checked && !c.disabled; });
    if (!picks.length) { $('status').textContent = 'Pick at least one model that has a saved key.'; return; }
    $('run').disabled = true; $('copy').disabled = true;
    picks.forEach((m) => { results[m[0]] = new Array(ITEMS.length); });
    let done = 0; const total = picks.length * ITEMS.length;
    const tick = () => { done++; $('status').textContent = 'Checked ' + done + ' of ' + total + '…'; if (done % 6 === 0) render(); };
    $('status').textContent = 'Starting…';
    await Promise.all(picks.map(async (m) => { results[m[0]] = await runModel(m, tick); }));
    render();
    $('status').textContent = 'Done. Press "Copy results" and paste them back, or take a screenshot of the table.';
    $('run').disabled = false; $('copy').disabled = false;
  });

  $('copy').addEventListener('click', async () => {
    const t = compact();
    try { await navigator.clipboard.writeText(t); $('status').textContent = 'Copied.'; }
    catch (e) { $('detail').insertAdjacentHTML('beforebegin', '<pre>' + esc(t) + '</pre>'); $('status').textContent = 'Copy was blocked: the text is shown below instead.'; }
  });

  // for tests
  window.__gct = { ITEMS, MODELS, scoreOf, parseVerdict, compact };
})();
