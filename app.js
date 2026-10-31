/* Shanlu: the app logic.
 * State lives in one object. Progress is saved in this browser (localStorage) and can be exported to a file.
 * Content comes from data/hsk1.js. The page template is in index.html and rendered by runtime.js.
 */
(function () {
  // "儿 endings" switch (see erhua.js). Plain forms are the default; the setting is read here, before any content is used.
  const AI_STORE = 'shanlu-ai';   // { key, model } lives only on this device
  let AICFG = {};
  try { AICFG = JSON.parse(localStorage.getItem(AI_STORE)) || {}; } catch (e) {}
  const saveAiCfg = () => { try { localStorage.setItem(AI_STORE, JSON.stringify(AICFG)); } catch (e) {} };
  const AI_MODELS = [['claude-haiku-5-5', 'Haiku 5.5: fastest and cheapest'], ['claude-sonnet-5-5', 'Sonnet 5.5: smarter, costs more']];
  const SYNC_STORE = 'shanlu-sync';   // { token, gist, at } lives only on this device, never in the exported progress file
  let SYNCCFG = {};
  try { SYNCCFG = JSON.parse(localStorage.getItem(SYNC_STORE)) || {}; } catch (e) {}
  const saveSyncCfg = () => { try { localStorage.setItem(SYNC_STORE, JSON.stringify(SYNCCFG)); } catch (e) {} };
  const ERHUA_KEY = 'shanlu-erhua';
  let ERHUA_ON = false;
  try { ERHUA_ON = localStorage.getItem(ERHUA_KEY) === 'on'; } catch (e) {}
  const ERHUA = window.ShanluErhua && window.HSK1_ERHUA ? window.ShanluErhua.make(window.HSK1_ERHUA) : null;
  if (ERHUA && !ERHUA_ON) ERHUA.apply(window);

  const WORDS = window.HSK1_WORDS;
  const LESSONS = window.HSK1_GRAMMAR.lessons;
  const { hubs:HUBS, opps:OPPS, topics:TOPICS } = window.HSK1_WEBS;
  const { clips:CLIPS, tones:TONES } = window.HSK1_LISTEN;
  const { scenarios:SCEN, phrases:PHRASES } = window.HSK1_SPEAK;
  const REPO = 'alvinyu20/hsk-path';
  const KEY = 'shanlu-progress-v1';

  const SYS = {
    '2.0': { levels:[['1', '150'], ['2', '300'], ['3', '600'], ['4', '1,200'], ['5', '2,500'], ['6', '5,000']], note:'Six separate level exams. Word totals are cumulative.' },
    '3.0': { levels:[['1', '300'], ['2', '500'], ['3', '1,000'], ['4', '2,000'], ['5', '3,600'], ['6', '5,400'], ['7', ''], ['8', ''], ['9', '']], note:'Three stages: elementary (1–3), intermediate (4–6), advanced (7–9). Levels 7–9 are tested in one exam and scored as 7, 8 or 9. Word totals are cumulative.' }
  };

  // ---------- word memory model (simplified FSRS-style) ----------
  const LIMIT_OPTIONS = [5, 10, 20, 0];            // 0 = no limit (the default)
  const REVIEW_CHUNK = 30;                          // cards per review round; "Review more" continues until nothing is due
  const limitOf = (S) => (S.nlimit > 0 ? S.nlimit : Infinity);
  const DIMS = ['see', 'hear', 'prod'];
  // Real elapsed time: every dimension remembers when it was last reviewed (t, in ms). Older saves had only a fixed `l`, which never grew.
  const DAY_MS = 864e5;
  const lOf = (d) => (d.t ? Math.max(0, (Date.now() - d.t) / DAY_MS) : (d.l || 0));
  const retr = (d, off) => (d.s > 0 ? Math.pow(1 + (19 / 81) * (lOf(d) + (off || 0)) / d.s, -0.5) : 0);
  const mast = (d) => (d.s > 0 ? Math.min(100, 100 * Math.log(1 + d.s) / Math.log(91)) : 0);
  const wMastery = (w) => Math.round(DIMS.reduce((a, k) => a + mast(w[k]), 0) / 3);
  const levelOf = (m) => (m <= 0 ? 'new' : m < 30 ? 'learning' : m < 55 ? 'familiar' : m < 80 ? 'strong' : 'mastered');
  const LEVEL_LABEL = { new:'New', learning:'Learning', familiar:'Familiar', strong:'Strong', mastered:'Mastered' };
  const bump = (d, r) => {
    const R = retr(d);
    let s = d.s;
    if (r === 'again') s = s > 0 ? Math.max(0.4, s * 0.35) : 0.4;
    else if (r === 'hard') s = s > 0 ? Math.max(0.8, s * 1.25) : 1;
    else if (r === 'good') s = s > 0 ? s * (1.6 + 1.4 * (1 - R)) : 1.5;
    else s = s > 0 ? s * (2.2 + 1.8 * (1 - R)) : 3;
    return { s, l:0, t:Date.now() };
  };
  const fmtInterval = (s) => (s < 1 ? 'Today' : s < 1.5 ? 'Tomorrow' : s < 45 ? 'In ' + Math.round(s) + ' days' : 'In ' + Math.round(s / 30) + ' months');

  const BANK = {};
  const EX = {};
  const NOTE = {};   // optional short teaching note per word (content/words-*.tsv, 6th column)
  const EXS = {};    // every example sentence for a word: its main one first, then the extras (content/examples-*.tsv)
  WORDS.forEach(w => { BANK[w.zh] = { zh:w.zh, py:w.py, en:w.en, pos:w.pos }; EX[w.zh] = w.ex; NOTE[w.zh] = w.note || ''; EXS[w.zh] = [w.ex].concat(w.more || []); });
  // a random example that fits (`ok`), so the same word does not always come with the same sentence
  const pickEx = (zh, ok) => { const all = EXS[zh]; const fit = ok ? all.filter(ok) : all; const pool = fit.length ? fit : all; return pool[Math.floor(Math.random() * pool.length)]; };
  const strHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const CLIP_PY = {};
  CLIPS.forEach(c => c.words.forEach(w => { CLIP_PY[w.zh] = w.py; }));
  const BANK_KEYS = Object.keys(BANK);

  const blankDim = () => ({ s:0, l:0 });
  const blankWord = () => ({ see:blankDim(), hear:blankDim(), prod:blankDim() });
  const blankWs = () => { const out = {}; Object.keys(BANK).forEach(zh => { out[zh] = blankWord(); }); return out; };

  const winfo = (w, off) => {
    const started = DIMS.filter(k => w[k].s > 0);
    const m = wMastery(w);
    const lv = levelOf(m);
    const recall = started.length ? Math.round(100 * started.reduce((a, k) => a + retr(w[k], off), 0) / started.length) : 0;
    const dueN = started.length ? Math.min.apply(null, started.map(k => w[k].s - lOf(w[k]) - off)) : 9999;
    let due = 'Not started';
    if (started.length) due = dueN <= 0 ? 'Due now' : (dueN < 1.5 ? 'Due tomorrow' : (dueN < 60 ? 'Due in ' + Math.round(dueN) + ' days' : 'Due in ' + Math.round(dueN / 30) + ' months'));
    return {
      m, lv, started:started.length > 0, mLabel:LEVEL_LABEL[lv], mPct:m + '%', mW:m + '%', mCls:'lv-' + lv,
      recallN:started.length ? recall : 999, dueN,
      recallText:started.length ? 'Recall chance ' + recall + '%' : 'Not learned yet', due, dueCls:started.length && dueN <= 0 ? 'due' : '',
      chipCls:lv === 'new' ? '' : (lv === 'learning' ? 'learning' : 'familiar'),
      dSee:Math.round(mast(w.see)) + '%', dHear:Math.round(mast(w.hear)) + '%', dProd:Math.round(mast(w.prod)) + '%'
    };
  };

  // Review queue: words that are due, weakest recall first. "anyway" gives the five weakest started words.
  const buildQueue = (ws, anyway) => {
    const rows = Object.keys(ws).map(zh => ({ zh, info:winfo(ws[zh], 0) })).filter(r => r.info.started);
    rows.sort((a, b) => a.info.recallN - b.info.recallN);
    if (anyway) return rows.slice(0, 5).map(r => r.zh);
    return rows.filter(r => r.info.dueN <= 0).slice(0, REVIEW_CHUNK).map(r => r.zh);
  };

  // ---------- dates, saving, daily reset ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

  const PERSIST = ['sys', 'mins', 'theme', 'xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'sres', 'nlimit', 'voiceId', 'clipBest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'rlast', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'wdelta', 'wreveal', 'spy', 'sen', 'shint', 'szh', 'exams', 'aiDays'];

  function freshState() {
    let dark = false;
    try { dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    return {
      screen:'home', sys:'3.0', mins:20, theme:dark ? 'dark' : 'light',
      xp:0, dayXp:0, dayMin:0, streak:0, lastActive:'', activity:{}, day:'',
      gres:{}, sres:{}, nlimit:0, voiceId:'', vtick:0, vall:false, glesson:0, sidx:0, wq:'', wshow:40, clipBest:CLIPS.map(() => 0), misses:{}, testHistory:[],
      ws:blankWs(),
      rq:[], rtotal:0, rflip:false, rdone:0, rstep:0, rxp:0, rcomplete:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null,
      qmode:'test', qi:0, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false,
      gdone:false, tdone:false, ldone:false, spokeToday:false, webCredited:false,
      sturn:0, szh:true, spy:true, sen:true, shint:true, sdone:false,
      woff:0, wsort:'weak', wfilter:'all', wdelta:{}, wrated:{}, gfq:0, gfpick:null, shround:0, shbusy:false,
      wmode:'char', whub:0, wtopic:0, wquiz:false, wlearned:{}, wreveal:{}, wex:{}, wexn:{}, exams:[], exm:null, aiDays:{}, aiOn:!!AICFG.key, aiModel:AICFG.model || 'claude-haiku-5-5', aiKeyInput:'', aiNote:'', aiMode:false, aim:[], aiBusy:false, aiErr:'', aiInput:'', aiListen:false, aiScn:-1, syncOn:!!SYNCCFG.token, syncAt:SYNCCFG.at || 0, syncInput:'', syncBusy:false, syncMsg:'', syncBad:false,
      lmode:'dict', dclip:0, dplays:0, drate:1, dtyped:'', dchecked:false, dmarks:[], dreveal:0,
      tidx:null, tpick:null, tright:0, ttotal:0,
      playing:null, noVoice:false
    };
  }

  function rollDay(s) {
    const t = ymd(new Date());
    if (s.day === t) return s;
    const rq = buildQueue(s.ws, false);
    return Object.assign({}, s, {
      day:t, dayXp:0, dayMin:0, wlearned:{}, wrated:{}, wdelta:{}, wreveal:{}, webCredited:false,
      rcomplete:false, rdone:0, rxp:0, rq, rtotal:rq.length, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null, rflip:false,
      gdone:false, tdone:false, ldone:false, spokeToday:false, sdone:false, sturn:0
    });
  }

  // When the 儿 switch changes, the words that are renamed (面条儿 <-> 面条, 一点儿 <-> 一点 ...) keep their progress.
  // The three 儿 words that already have their own plain twin on the list (这儿/这里 ...) are separate words and are not merged.
  function carryOverErhua(S) {
    if (!ERHUA) return;
    const blank = (w) => !w || ['see', 'hear', 'prod'].every(k => !w[k] || !(w[k].s > 0));
    const maps = ['wlearned', 'wrated', 'wreveal', 'wdelta', 'wex', 'misses'];
    ERHUA.pairs.filter(p => !p.twin).forEach(p => {
      const f = ERHUA_ON ? p.plain : p.official;
      const t = ERHUA_ON ? p.official : p.plain;
      if (S.ws && S.ws[f] && blank(S.ws[t])) { S.ws[t] = S.ws[f]; delete S.ws[f]; }
      maps.forEach(m => { if (S[m] && S[m][f] !== undefined && S[m][t] === undefined) { S[m][t] = S[m][f]; delete S[m][f]; } });
      if (Array.isArray(S.rq)) S.rq = S.rq.map(z => (z === f ? t : z)).filter((z, i, arr) => arr.indexOf(z) === i);
    });
    // anything still pointing at a word that is not in this mode's list (the dropped twins) is left out of today's lists
    if (Array.isArray(S.rq)) S.rq = S.rq.filter(z => BANK[z]);
    if (S.wlearned) Object.keys(S.wlearned).forEach(z => { if (!BANK[z]) delete S.wlearned[z]; });
    if (S.rlast && !BANK[S.rlast.zh]) S.rlast = null;
  }

  function mergeSaved(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    PERSIST.forEach(k => { if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k]; });
    carryOverErhua(base);
    // older saves: a started word with no timestamp is treated as reviewed now, so nothing is suddenly overdue
    if (base.ws) Object.keys(base.ws).forEach(z => DIMS.forEach(k => { const d = base.ws[z] && base.ws[z][k]; if (d && d.s > 0 && !d.t) d.t = Date.now() - (d.l || 0) * DAY_MS; }));
    Object.keys(BANK).forEach(zh => { if (!base.ws[zh]) base.ws[zh] = blankWord(); });
    if (!Array.isArray(base.clipBest) || base.clipBest.length !== CLIPS.length) base.clipBest = CLIPS.map((_, i) => (saved.clipBest && saved.clipBest[i]) || 0);
    return base;
  }

  function loadState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    return rollDay(mergeSaved(freshState(), saved));
  }

  const report = (where, text) => 'https://github.com/' + REPO + '/issues/new?title=' + encodeURIComponent('Content mistake: ' + text) +
    '&body=' + encodeURIComponent('Where: ' + where + '\nText: ' + text + '\n\nWhat is wrong:\n\nWhat it should say:\n');

  // ---------- building quiz questions ----------
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const toneless = (py) => py.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const pinyinAccepts = (py, zh) => {
    const out = [zh];
    py.split('/').forEach(v => { const t = toneless(v); if (t) { out.push(t); if (/r$/.test(t) && /儿/.test(zh)) out.push(t.replace(/r$/, 'er')); } });
    return out.filter((x, i, a) => a.indexOf(x) === i);
  };
  const ORDER_IDS = 'abcd';
  const orderQ = (toks, base) => {
    let p;
    let tries = 0;
    do { p = shuffle(toks.map((_, i) => i)); tries++; } while (toks.length > 1 && p.every((v, i) => v === i) && tries < 12);
    return Object.assign({}, base, { type:'order', toks, tiles:p.map(i => toks[i]), seq:toks.map((_, j) => p.indexOf(j)) });
  };
  function prepGrammar(L) {
    return L.q.map(q => {
      const base = { kicker:q.kicker, prompt:q.prompt, reveal:q.reveal, explain:q.explain };
      if (q.type === 'order') return orderQ(q.toks, base);
      if (q.type === 'cloze') return Object.assign(base, { type:'cloze', big:q.big, sub:q.sub, placeholder:q.placeholder, accepts:q.accepts });
      if (q.type === 'spot') return Object.assign(base, { type:'spot', tokens:q.tokens, punct:q.punct, spot:q.spot });
      const opts = shuffle(q.options.map(o => o.label));
      return Object.assign(base, { type:'mc', options:opts.map((label, i) => ({ id:ORDER_IDS[i], label })), correct:ORDER_IDS[opts.indexOf(q.reveal)] });
    });
  }
  function buildTest(S) {
    const pool = BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0));
    if (pool.length < 3) return [];
    const n = Math.min(10, Math.max(5, pool.length));
    const ranked = pool.map(zh => ({ zh, r:winfo(S.ws[zh], 0).recallN + Math.random() * 25 })).sort((a, b) => a.r - b.r).map(x => x.zh);
    const picks = [];
    for (let i = 0; i < n; i++) picks.push(ranked[i % ranked.length]);
    const kinds = ['mc', 'listen', 'type', 'cloze', 'order'];
    const offset = Math.floor(Math.random() * kinds.length);
    const others = (zh, k) => {
      const w = BANK[zh];
      const same = shuffle(BANK_KEYS.filter(z => z !== zh && BANK[z].pos === w.pos && BANK[z].en !== w.en));
      const rest = shuffle(BANK_KEYS.filter(z => z !== zh && BANK[z].pos !== w.pos && BANK[z].en !== w.en));
      return same.concat(rest).slice(0, k);
    };
    const choiceOptions = (zh, labelOf) => {
      const opts = shuffle([zh].concat(others(zh, 3))).map((z, i) => ({ id:ORDER_IDS[i], label:labelOf(z), zh:z }));
      return { options:opts.map(o => ({ id:o.id, label:o.label })), correct:opts.find(o => o.zh === zh).id };
    };
    const mcQ = (zh) => { const e0 = pickEx(zh); return Object.assign({ type:'mc', kicker:'Meaning', prompt:'What does this word mean?', big:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:e0.zh + ' ' + e0.py + ' (' + e0.en + ')', word:zh, dim:'see' }, choiceOptions(zh, z => BANK[z].en)); };
    return picks.map((zh, i) => {
      const kind = kinds[(i + offset) % kinds.length];
      const ex = kind === 'cloze' ? pickEx(zh, e => e.toks.indexOf(zh) >= 0 && e.zh.split(zh).length === 2)
        : kind === 'order' ? pickEx(zh, e => e.toks.length >= 3 && e.toks.length <= 8) : pickEx(zh);
      if (kind === 'listen') return Object.assign({ type:'listen', kicker:'Listen', prompt:'Which word did you hear?', audio:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:ex.zh + ' ' + ex.py + ' (' + ex.en + ')', word:zh, dim:'hear' }, choiceOptions(zh, z => z));
      if (kind === 'type') return { type:'type', kicker:'Type it', prompt:'Type the pinyin for this word', big:zh, placeholder:'Pinyin, for example shui', accepts:pinyinAccepts(BANK[zh].py, ''), reveal:BANK[zh].py + ' · ' + BANK[zh].en, explain:'Tone marks are optional for now. Example: ' + ex.zh + ' ' + ex.py, word:zh, dim:'prod' };
      if (kind === 'cloze' && ex.toks.indexOf(zh) >= 0 && ex.zh.split(zh).length === 2) return { type:'cloze', kicker:'Fill it', prompt:'Type the missing word', big:ex.zh.replace(zh, '___'), sub:ex.en, placeholder:'Pinyin or character', accepts:pinyinAccepts(BANK[zh].py, zh), reveal:zh + ' · ' + BANK[zh].py, explain:ex.py, word:zh, dim:'prod' };
      if (kind === 'order' && ex.toks.length >= 3 && ex.toks.length <= 8) return orderQ(ex.toks, { kicker:'Build it', prompt:'Put the words in order: ' + ex.en, reveal:ex.zh, explain:ex.py });
      return mcQ(zh);
    });
  }

  // ---------- talking with an AI (bring-your-own-key, straight from the browser) ----------
  const CHARSET = {};
  BANK_KEYS.forEach(k => k.split('').forEach(ch => { CHARSET[ch] = true; }));
  const MAXW = BANK_KEYS.reduce((n, k) => Math.max(n, k.length), 1);
  // split a Chinese reply into HSK 1 words, so pinyin comes from our own checked word list and outside words can be flagged
  const segHsk = (text) => {
    const out = [];
    for (let i = 0; i < text.length;) {
      let hit = null;
      for (let n = Math.min(MAXW, text.length - i); n >= 1; n--) { const w = text.substr(i, n); if (BANK[w]) { hit = w; break; } }
      if (hit) { out.push({ t:hit, py:BANK[hit].py.split('/')[0].trim(), cjk:true, ok:true }); i += hit.length; continue; }
      const ch = text[i]; const cjk = /[\u4e00-\u9fff]/.test(ch);
      out.push({ t:ch, py:'', cjk, ok:!cjk || !!CHARSET[ch] });
      i++;
    }
    return out;
  };
  const aiPinyin = (toks) => {
    if (toks.some(t => t.cjk && !t.py)) return '';
    const line = toks.map(t => (t.cjk ? t.py : t.t.replace('。', '.').replace('，', ',').replace('？', '?').replace('！', '!'))).join(' ').replace(/ ([,.?!])/g, '$1').replace(/\s+/g, ' ').trim();
    return line.replace(/(^|[.?!] )([a-zà-ž])/g, (m, p, c) => p + c.toUpperCase());
  };
  const aiOutside = (toks) => { const seen = {}; const out = []; toks.forEach(t => { if (t.cjk && !t.ok && !seen[t.t]) { seen[t.t] = true; out.push(t.t); } }); return out; };
  // Checking a spoken or typed reply against the suggested one. The microphone returns characters, not sounds, so this can only say
  // whether the same characters came back: a wrong tone often turns into a different character, but it is not a pronunciation score.
  const stripTone = (py) => String(py).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const charPy = (ch) => { const t = segHsk(ch)[0]; return t && t.cjk && t.ok && t.py ? t.py : ''; };
  const aiCompare = (sugZh, sugPy, said) => {
    const strip = (x) => Array.from(String(x).replace(/[\s，。？！、,.?!]/g, ''));
    const a = strip(sugZh), b = strip(said);
    const out = { same:a.join('') === b.join(''), sugZh, sugPy, diffs:[], lens:null };
    if (out.same) return out;
    if (a.length === b.length) a.forEach((c, i) => { if (c !== b[i]) { const pe = charPy(c), pg = charPy(b[i]); out.diffs.push({ exp:c, got:b[i], pe, pg, tone:!!(pe && pg && stripTone(pe) === stripTone(pg)) }); } });
    else out.lens = { exp:a.length, got:b.length };
    return out;
  };
  const aiSystem = (scn) => [
    'You are Mingming (明明), a friendly Mandarin conversation partner for an adult English-speaking beginner who is studying for HSK 1.',
    'Speak Simplified Chinese using ONLY words from this HSK 1 word list (plus punctuation and numbers): ' + BANK_KEYS.join(' ') + '.',
    'If you need a word that is not in the list, say it another way with listed words. Never write pinyin in the Chinese. When you say your own name, say 我叫明明 (the standard way to give a name), not 我是明明. Keep every reply to one or two short sentences (about 15 characters or fewer in total) and ask at most one simple question, so the learner can answer.',
    scn ? 'Role-play setting: ' + scn.title + '. Goals for the learner: ' + scn.goals.join('; ') + '. Stay in this setting and play the other person.' : 'Free chat: pick an everyday topic (food, family, school, weather, plans) and keep it simple.',
    'After each learner message, also judge it. Say "ok" if it is natural and understandable Mandarin. Say "fix" if it has a grammar, word choice or naturalness problem: then give the corrected sentence in Chinese (HSK 1 words only) and a one-sentence reason in simple English. Do not nitpick: only fix real problems. If the learner writes English, give "fix" with the Chinese they could say. The learner message may come from speech recognition and contain wrong characters: if it does not make sense, ask them to say it again as the reply.',
    'Answer with ONLY a JSON object, no other text: {"reply":{"zh":"<your Chinese>","en":"<English translation>"},"feedback":{"level":"ok"|"fix","better":"<corrected Chinese or empty>","why":"<short English reason or empty>"},"suggest":{"zh":"<suggested learner reply>","en":"<English>"}}. For the very first message of a conversation, set feedback to {"level":"ok","better":"","why":""}.',
    'Also always add "suggest":{"zh":"<one natural, short reply (about 12 characters or fewer) the learner could say next to answer you, HSK 1 words only, no pinyin>","en":"<its English meaning>"} so a beginner who is stuck can see what to say. Use 我叫… when giving a name.'
  ].join('\n');
  const aiParse = (text) => {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j < i) throw new Error('The reply was not in the expected format.');
    const o = JSON.parse(text.slice(i, j + 1));
    if (!o.reply || typeof o.reply.zh !== 'string') throw new Error('The reply was not in the expected format.');
    return { zh:o.reply.zh, en:o.reply.en || '', sug:o.suggest && typeof o.suggest.zh === 'string' && o.suggest.zh.trim() ? { zh:o.suggest.zh.trim(), en:o.suggest.en || '' } : null, fb:o.feedback && o.feedback.level === 'fix' ? { better:o.feedback.better || '', why:o.feedback.why || '' } : null };
  };
  async function aiCall(history, scn) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST',
        headers:{ 'x-api-key':AICFG.key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true', 'content-type':'application/json' },
        body:JSON.stringify({ model:AICFG.model || 'claude-haiku-5-5', max_tokens:600, system:aiSystem(scn), messages:history }) });
    } catch (e) { throw new Error('Could not reach the AI service. Check your connection.'); }
    if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Too many requests right now. Wait a moment and try again.');
    if (res.status === 400 || res.status === 402 || res.status === 403) throw new Error('The AI service refused the request (often: no credits on the API account).');
    if (!res.ok) throw new Error('The AI service had a problem (' + res.status + ').');
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { raw:text, parsed:aiParse(text) };
  }

  // ---------- the HSK 1 mock exam ----------
  // Layout follows the official HSK 1 sample papers: 4 listening parts and 4 reading parts, 5 questions each, listening played twice.
  const EXAMBANK = window.HSK1_EXAM || null;
  const EXAM_MIN = { listening:15, reading:20 };
  const PART = {
    L1:{ sec:'listening', n:1, inst:'Listen. Does the picture match what you hear?' },
    L2:{ sec:'listening', n:2, inst:'Listen to the sentence. Choose the picture that matches.' },
    L3:{ sec:'listening', n:3, inst:'Listen to the short conversation. Choose the picture it is about.' },
    L4:{ sec:'listening', n:4, inst:'Listen to the conversation and the question. Choose the answer.' },
    R1:{ sec:'reading', n:1, inst:'Does the picture match the words?' },
    R2:{ sec:'reading', n:2, inst:'Choose the picture that matches the sentence.' },
    R3:{ sec:'reading', n:3, inst:'Choose the answer to the question.' },
    R4:{ sec:'reading', n:4, inst:'Choose the word that fills the blank.' }
  };
  const LETTERS = 'ABCDEF';
  const pickN = (arr, n) => shuffleArr(arr).slice(0, n);
  function shuffleArr(arr) { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; }
  // five true/false items with at least two of each
  const pickTF = (bank) => { const t = shuffleArr(bank.filter(e => e.ok)), f = shuffleArr(bank.filter(e => !e.ok)); const rest = shuffleArr(t.slice(2).concat(f.slice(2))); return shuffleArr(t.slice(0, 2).concat(f.slice(0, 2), rest.slice(0, 1))); };
  const audioOf = (lines) => lines.map(l => ({ text:l.zh, pitch:l.s === '女' ? 1.25 : l.s === '男' ? 0.8 : 1 }));
  const examQs = (sec) => {
    const out = [];
    const add = (part, q) => { out.push(Object.assign({ part, id:part + '-' + out.length, sec:PART[part].sec }, q)); };
    const E = EXAMBANK;
    if (sec === 'listening') {
      pickTF(E.L1).forEach(e => add('L1', { kind:'tf', pic:e.pic, audio:[{ text:e.zh }], ans:e.ok ? 'T' : 'F', opts:[{ v:'T', label:'✓ It matches' }, { v:'F', label:'✗ It does not match' }], rev:{ zh:e.zh, py:e.py, en:e.en, pic:e.pic }, right:e.ok ? 'It matches' : 'It does not match' }));
      pickN(E.L2, 5).forEach(e => { const order = shuffleArr([0, 1, 2]); const opts = order.map((k, j) => ({ v:j, label:e.opts[k], emoji:true })); add('L2', { kind:'pic', audio:[{ text:e.zh }], opts, ans:order.indexOf(0), rev:{ zh:e.zh, py:e.py, en:e.en }, right:e.opts[0] }); });
      const s3 = E.L3[Math.floor(Math.random() * E.L3.length)];
      shuffleArr(s3.items).forEach(it => add('L3', { kind:'match', audio:audioOf(it.say), opts:s3.opts.map((p, k) => ({ v:k, label:p, emoji:true })), ans:it.ans, rev:{ zh:it.say.map(l => l.zh).join(' '), py:it.say.map(l => l.py).join(' '), en:it.say.map(l => l.en).join(' ') }, right:s3.opts[it.ans] }));
      pickN(E.L4, 5).forEach(e => { const order = shuffleArr([0, 1, 2]); const opts = order.map((k, j) => ({ v:j, label:e.opts[k].zh })); add('L4', { kind:'text', audio:audioOf(e.say).concat([{ text:e.q.zh, pitch:1 }]), opts, ans:order.indexOf(0), rev:{ zh:e.say.map(l => l.zh).join(' ') + ' ' + e.q.zh, py:e.say.map(l => l.py).join(' ') + ' ' + e.q.py, en:e.say.map(l => l.en).join(' ') + ' ' + e.q.en }, right:e.opts[0].zh }); });
    } else {
      pickTF(E.R1).forEach(e => add('R1', { kind:'tf', pic:e.pic, text:e.zh, ans:e.ok ? 'T' : 'F', opts:[{ v:'T', label:'✓ It matches' }, { v:'F', label:'✗ It does not match' }], rev:{ zh:e.zh, py:e.py, en:e.en, pic:e.pic }, right:e.ok ? 'It matches' : 'It does not match' }));
      const s2 = E.R2[Math.floor(Math.random() * E.R2.length)];
      shuffleArr(s2.items).forEach(it => add('R2', { kind:'match', text:it.zh, opts:s2.opts.map((p, k) => ({ v:k, label:p, emoji:true })), ans:it.ans, rev:{ zh:it.zh, py:it.py, en:it.en }, right:s2.opts[it.ans] }));
      const s3 = E.R3[Math.floor(Math.random() * E.R3.length)];
      const p3 = shuffleArr([0, 1, 2, 3, 4]);
      s3.items.forEach(it => add('R3', { kind:'match', text:it.zh, opts:p3.map((k, j) => ({ v:j, label:s3.opts[k].zh })), ans:p3.indexOf(it.ans), rev:{ zh:it.zh + ' ' + s3.opts[it.ans].zh, py:it.py + ' ' + s3.opts[it.ans].py, en:it.en + ' ' + s3.opts[it.ans].en }, right:s3.opts[it.ans].zh }));
      const s4 = E.R4[Math.floor(Math.random() * E.R4.length)];
      const p4 = shuffleArr([0, 1, 2, 3, 4]);
      s4.items.forEach(it => add('R4', { kind:'match', text:it.zh, opts:p4.map((k, j) => ({ v:j, label:s4.opts[k].zh })), ans:p4.indexOf(it.ans), rev:{ zh:it.full, py:it.py, en:it.en }, right:s4.opts[it.ans].zh }));
    }
    return out;
  };

  // ---------- Chinese voice (the browser's own text-to-speech) ----------
  // The old code used the first Chinese voice the browser listed, which on a phone is often a basic one
  // (or a Cantonese or Taiwan one) even when a better voice is installed. Now: Mandarin voices only, best quality first,
  // and the learner can pick one by hand.
  const VOICE_SAMPLE = '你好，很高兴认识你。';
  const QUALITY_LABEL = ['Compact', 'Standard', 'Enhanced', 'Premium'];
  const allVoices = () => { try { return (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; } catch (e) { return []; } };
  const voiceLang = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
  // Mandarin-capable voices. Cantonese (zh-HK, yue) is left out because it is a different language.
  const isMandarinVoice = (v) => /^(zh|cmn)/.test(voiceLang(v)) && !/^(zh-hk|zh-yue|yue)/.test(voiceLang(v));
  // iPhone and Mac voices carry "premium", "enhanced" or "compact" in their id or name; other platforms mostly do not say.
  const voiceQuality = (v) => {
    const id = String(v.voiceURI || '') + ' ' + String(v.name || '');
    if (/premium/i.test(id)) return 3;
    if (/enhanced|neural|natural/i.test(id)) return 2;
    if (/compact/i.test(id)) return 0;
    return 1;
  };
  const voiceRegion = (v) => (/^(zh-cn|zh-hans|cmn-cn|cmn-hans|zh-sg)/.test(voiceLang(v)) ? 2 : 1);
  const rankedVoices = () => allVoices().filter(isMandarinVoice).sort((a, b) =>
    voiceQuality(b) - voiceQuality(a) || voiceRegion(b) - voiceRegion(a) || String(a.name).localeCompare(String(b.name)));
  const pickVoice = (id) => (id && rankedVoices().find(v => v.voiceURI === id)) || rankedVoices()[0] || null;

  // The "Which word fits?" options are authored with the answer first, so they must be shuffled when shown.
  // The order is fixed for a question within one page load (so it does not jump around when you tap), and differs between visits.
  const GAP_SEED = Math.floor(Math.random() * 1e9);
  const seededShuffle = (arr, seed) => {
    const a = arr.slice();
    let t = seed >>> 0;
    const rnd = () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  };

  class Component extends DCLogic {
    state = loadState();
    timers = [];
    saveTimer = null;

    setState(patch) {
      if (typeof patch === 'function') patch = patch(this.state);
      const S = this.state;
      const gained = (patch.xp !== undefined && patch.xp > S.xp) || (patch.dayMin !== undefined && patch.dayMin > S.dayMin);
      if (gained) {
        const t = ymd(new Date());
        if (!S.activity[t]) {
          const act = Object.assign({}, S.activity); act[t] = true;
          const keys = Object.keys(act).sort();
          while (keys.length > 60) delete act[keys.shift()];
          patch = Object.assign({}, patch, { activity:act, streak:S.lastActive === daysAgo(1) ? S.streak + 1 : 1, lastActive:t });
        }
      }
      super.setState(patch);
      this.persistSoon();
    }
    persistSoon() {
      this.syncLater();
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persistNow(), 250);
    }
    persistNow() {
      try {
        const out = {};
        PERSIST.forEach(k => { out[k] = this.state[k]; });
        localStorage.setItem(KEY, JSON.stringify(out));
      } catch (e) {}
    }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); }

    go = (screen) => {
      this.setState({ screen }); try { window.scrollTo(0, 0); } catch (e) {}
      // on phones the tab bar scrolls sideways: keep the current tab in view
      setTimeout(() => { try { const bar = document.querySelector('.navs'); const on = bar && bar.querySelector('.nav.on'); if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2; } catch (e) {} }, 60);
    };

    // audio (the browser's own text-to-speech; needs a click)
    // Desktop Chrome can clip the first fraction of a second of speech: the sound card or Bluetooth speaker is asleep and wakes
    // after the speech has started. So: wake the output with an almost silent sound, and wait a moment if it had been idle.
    // Also, Chrome sometimes drops or clips a speak() that comes straight after cancel(), so that gets a short gap too.
    audioCtx = null; lastWake = 0; sayTok = 0;
    wakeAudio = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return 0;
        if (!this.audioCtx) this.audioCtx = new AC();
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const warm = Date.now() - this.lastWake < 5000;
        const len = Math.floor(ctx.sampleRate * 2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.0005;   // about -66 dB: not audible, but not digital silence
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
        this.lastWake = Date.now();
        return warm ? 0 : 250;
      } catch (e) { return 0; }
    };
    // run doSpeak(ss) once the audio is ready; a newer request replaces one that is still waiting
    speakWhenReady = (doSpeak) => {
      const ss = window.speechSynthesis; if (!ss) return;
      const tok = ++this.sayTok;
      // phones are left exactly as they were: they do not clip, and iPhone only allows speech started right inside a tap
      let desktop = false; try { desktop = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) {}
      if (!desktop) { try { ss.cancel(); } catch (e) {} doSpeak(ss); return; }
      let wait = this.wakeAudio();
      try { if (ss.speaking || ss.pending) { ss.cancel(); wait = Math.max(wait, 60); } } catch (e) {}
      if (!wait) { doSpeak(ss); return; }
      setTimeout(() => { if (tok === this.sayTok) { try { doSpeak(ss); } catch (e) {} } }, wait);
    };
    say = (text, key, rate, voice) => {
      try {
        if (window.speechSynthesis) {
          const zh = voice || pickVoice(this.state.voiceId);
          if (allVoices().length && !zh) this.setState({ noVoice:true });
          this.speakWhenReady((ss) => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = zh ? zh.lang : 'zh-CN'; u.rate = rate || 0.85;
            if (zh) u.voice = zh;
            ss.speak(u);
          });
        } else {
          this.setState({ noVoice:true });
        }
      } catch (e) {}
      this.setState({ playing:key });
      this.later(() => { if (this.state.playing === key) this.setState({ playing:null }); }, 1400);
    };
    // ----- the mock exam -----
    exTimer = null;
    examDraw = (sec) => examQs(sec);   // used by the browser test
    startExam = (mode) => { if (!EXAMBANK) return; this.exBegin({ mode, sec:mode === 'reading' ? 'reading' : 'listening', results:{} }); };
    exBegin = (base) => {
      const exm = Object.assign({}, base, { stage:'run', qs:examQs(base.sec), ans:{}, i:0, plays:{}, confirm:false, endAt:Date.now() + EXAM_MIN[base.sec] * 60000 });
      clearInterval(this.exTimer);
      this.exTimer = setInterval(() => {
        const m = this.state.exm;
        if (!m || m.stage !== 'run') { clearInterval(this.exTimer); return; }
        if (Date.now() >= m.endAt) this.exSubmit(true); else this._schedule();
      }, 1000);
      try { window.scrollTo(0, 0); } catch (e) {}
      this.setState({ exm, screen:'exam' });
    };
    exPatch = (patch) => { const m = this.state.exm; if (m) this.setState({ exm:Object.assign({}, m, patch) }); };
    exPick = (v) => { const m = this.state.exm; if (!m || m.stage !== 'run') return; const ans = Object.assign({}, m.ans); ans[m.qs[m.i].id] = v; this.exPatch({ ans, confirm:false }); };
    exGo = (i) => { const m = this.state.exm; if (!m) return; try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} this.exPatch({ i:Math.max(0, Math.min(m.qs.length - 1, i)), confirm:false }); };
    exPlay = () => {
      const m = this.state.exm; if (!m) return;
      const q = m.qs[m.i]; if (!q.audio) return;
      const used = m.plays[q.id] || 0; if (used >= 2) return;
      const plays = Object.assign({}, m.plays); plays[q.id] = used + 1;
      this.exPatch({ plays });
      this.speakLines(q.audio, 'exq');
    };
    // several lines in a row (a conversation); the second voice is pitched higher where the browser allows it
    speakLines = (lines, key) => {
      try {
        if (!window.speechSynthesis) return;
        const zh = pickVoice(this.state.voiceId);
        this.speakWhenReady((ss) => {
          lines.forEach(l => { const u = new SpeechSynthesisUtterance(l.text); u.lang = zh ? zh.lang : 'zh-CN'; u.rate = 0.85; u.pitch = l.pitch || 1; if (zh) u.voice = zh; ss.speak(u); });
        });
      } catch (e) {}
      const ms = lines.reduce((n, l) => n + l.text.length * 330 + 500, 0);
      this.setState({ playing:key });
      this.later(() => { if (this.state.playing === key) this.setState({ playing:null }); }, ms);
    };
    exSubmit = (auto) => {
      const m = this.state.exm; if (!m || m.stage !== 'run') return;
      const open = m.qs.filter(q => m.ans[q.id] === undefined).length;
      if (!auto && open > 0 && !m.confirm) { this.exPatch({ confirm:true }); return; }
      clearInterval(this.exTimer);
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      const byPart = {};
      const wrong = [];
      let correct = 0;
      m.qs.forEach((q, n) => {
        byPart[q.part] = byPart[q.part] || { c:0, t:0 };
        byPart[q.part].t += 1;
        if (m.ans[q.id] === q.ans) { correct += 1; byPart[q.part].c += 1; } else wrong.push({ n:n + 1, q, yours:m.ans[q.id] });
      });
      const res = { sec:m.sec, correct, total:m.qs.length, byPart, wrong, auto:!!auto };
      const results = Object.assign({}, m.results); results[m.sec] = res;
      if (m.mode === 'full' && m.sec === 'listening') { this.exPatch({ stage:'break', results }); return; }
      const entry = { at:Date.now(), mode:m.mode, l:results.listening ? results.listening.correct : null, r:results.reading ? results.reading.correct : null };
      const day = ymd(new Date());
      this.setState({ exm:Object.assign({}, m, { stage:'result', results }), exams:this.state.exams.concat([entry]).slice(-20), dayMin:this.state.dayMin + (m.mode === 'full' ? 30 : 15), xp:this.state.xp + Math.round(correct * 2), dayXp:this.state.dayXp + Math.round(correct * 2) });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    exContinue = () => { const m = this.state.exm; if (m) this.exBegin({ mode:'full', sec:'reading', results:m.results }); };
    exClose = () => { clearInterval(this.exTimer); this.setState({ exm:null }); try { window.scrollTo(0, 0); } catch (e) {} };

    // ----- talk with AI -----
    setAiMode = (on) => { this.setState({ aiMode:on }); if (on && this.state.aiOn && !this.state.aim.length) this.aiStart(this.state.aiScn); };
    aiStart = (scnIdx) => { this.setState({ aiScn:scnIdx, aim:[], aiErr:'', aiInput:'' }); this.aiAsk([{ role:'user', content:'(Start the conversation with a short greeting and your first question.)' }], scnIdx, []); };
    aiAsk = async (history, scnIdx, shown) => {
      this.setState({ aiBusy:true, aiErr:'' });
      try {
        const out = await aiCall(history, scnIdx >= 0 ? SCEN[scnIdx] : null);
        const p = out.parsed; const toks = segHsk(p.zh);
        let sug = null;
        if (p.sug) { const st = segHsk(p.sug.zh); if (!aiOutside(st).length && aiPinyin(st)) sug = { zh:p.sug.zh, en:p.sug.en, py:aiPinyin(st), open:false }; }   // only suggest what the site can show with pinyin
        const msg = { who:'ai', zh:p.zh, en:p.en, py:aiPinyin(toks), outside:aiOutside(toks), raw:out.raw, sug };
        const next = shown.slice();
        const last = next[next.length - 1];
        if (last && last.who === 'me') next[next.length - 1] = Object.assign({}, last, { judged:true, fb:p.fb });   // the judgement is about the learner's last line
        this.setState({ aim:next.concat([msg]), aiBusy:false });
        this.say(p.zh, 'aim' + next.length);
      } catch (e) { this.setState({ aiBusy:false, aiErr:(e && e.message) || 'Something went wrong.' }); }
    };
    aiSend = () => {
      const S = this.state; const text = (S.aiInput || '').trim();
      if (!text || S.aiBusy || !S.aiOn) return;
      try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}   // lets the reply play on iPhone
      const toks = segHsk(text);
      const lastAi = S.aim[S.aim.length - 1];
      const cmp = lastAi && lastAi.who === 'ai' && lastAi.sug && lastAi.sug.open ? aiCompare(lastAi.sug.zh, lastAi.sug.py, text) : null;
      const me = { who:'me', zh:text, en:'', py:aiPinyin(toks), outside:aiOutside(toks), cmp };
      const shown = S.aim.concat([me]);
      const hist = [{ role:'user', content:'(Start the conversation with a short greeting and your first question.)' }];
      shown.forEach(m => { if (m.who === 'ai') hist.push({ role:'assistant', content:m.raw }); else hist.push({ role:'user', content:m.zh }); });
      const days = Object.assign({}, S.aiDays); const t = ymd(new Date()); days[t] = (days[t] || 0) + 1;
      const patch = { aim:shown, aiInput:'', aiDays:days, xp:S.xp + 2, dayXp:S.dayXp + 2 };
      if (days[t] >= 4 && !S.spokeToday) { patch.spokeToday = true; patch.dayMin = S.dayMin + 6; }
      this.setState(patch);
      this.aiAsk(hist.slice(-13), S.aiScn, shown);
    };
    aiMic = () => {
      const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
      if (!SR) return;
      if (this.state.aiListen) { try { this.recog && this.recog.stop(); } catch (e) {} return; }
      try {
        const r = new SR(); this.recog = r;
        r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 1;
        r.onresult = (e) => { const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : ''; this.setState({ aiInput:t, aiListen:false }); };
        r.onerror = () => { this.setState({ aiListen:false, aiErr:'The microphone did not work. Check the browser permission, or type instead.' }); };
        r.onend = () => { this.setState({ aiListen:false }); };
        this.setState({ aiListen:true, aiErr:'' });
        r.start();
      } catch (e) { this.setState({ aiListen:false, aiErr:'The microphone could not start. Type instead.' }); }
    };
    aiShowSug = () => { const a = this.state.aim.slice(); const i = a.length - 1; if (i < 0 || !a[i].sug) return; a[i] = Object.assign({}, a[i], { sug:Object.assign({}, a[i].sug, { open:true }) }); this.setState({ aim:a }); };
    aiUseSug = () => { const a = this.state.aim; const m = a[a.length - 1]; if (m && m.sug) this.setState({ aiInput:m.sug.zh }); };
    aiSimpler = () => { this.setState({ aiInput:'请再说一遍，慢一点。' }); this.aiSend(); };
    aiSaveKey = () => {
      const k = (this.state.aiKeyInput || '').trim();
      if (!k) { this.setState({ aiNote:'Paste your API key first.' }); return; }
      AICFG.key = k; AICFG.model = this.state.aiModel; saveAiCfg();
      this.setState({ aiOn:true, aiKeyInput:'', aiNote:'Saved on this device.' });
    };
    aiRemoveKey = () => { AICFG = {}; saveAiCfg(); this.setState({ aiOn:false, aiNote:'The key was removed from this device.', aim:[] }); };
    aiSetModel = (m) => { AICFG.model = m; if (AICFG.key) saveAiCfg(); this.setState({ aiModel:m }); };

    goVoice = () => this.go('voice');

    // ----- sync across devices (a private GitHub gist; see sync.js) -----
    syncTimer = null;
    syncLater = () => {
      if (!SYNCCFG.token || this.noSync) return;
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => this.syncNow(false), 30000);
    };
    syncNow = async (manual) => {
      const S0 = this.state;
      if (!SYNCCFG.token || S0.syncBusy || !window.ShanluSync) return;
      this.noSync = true;
      this.setState({ syncBusy:true, syncMsg:manual ? 'Syncing…' : S0.syncMsg });
      this.noSync = false;
      try {
        this.persistNow();
        const r = await window.ShanluSync.round({ token:SYNCCFG.token, gistId:SYNCCFG.gist || null, state:this.state });
        let next = rollDay(Object.assign({}, this.state, r.merged));
        carryOverErhua(next);
        const patch = window.ShanluSync.pick(next);
        patch.rq = (patch.rq || []).filter(z => BANK[z]);
        SYNCCFG.gist = r.gistId; SYNCCFG.at = Date.now(); saveSyncCfg();
        this.noSync = true;
        this.setState(Object.assign(patch, { syncBusy:false, syncAt:SYNCCFG.at, syncBad:false, syncMsg:r.created ? 'Connected. Your progress is now saved in a private GitHub gist.' : 'Synced.' }));
        this.noSync = false;
        this.persistNow();
      } catch (e) {
        this.noSync = true;
        this.setState({ syncBusy:false, syncBad:true, syncMsg:(e && e.message) || 'Sync failed.' });
        this.noSync = false;
      }
    };
    syncConnect = () => {
      const t = (this.state.syncInput || '').trim();
      if (!t) { this.setState({ syncBad:true, syncMsg:'Paste the token first.' }); return; }
      SYNCCFG = { token:t, gist:'', at:0 }; saveSyncCfg();
      this.setState({ syncOn:true, syncInput:'', syncMsg:'', syncBad:false });
      this.syncNow(true);
    };
    syncDisconnect = () => { SYNCCFG = {}; saveSyncCfg(); clearTimeout(this.syncTimer); this.setState({ syncOn:false, syncAt:0, syncMsg:'This device is disconnected. Your progress here is kept.', syncBad:false }); };
    toggleErhua = () => {
      this.persistNow();
      try { localStorage.setItem(ERHUA_KEY, ERHUA_ON ? 'off' : 'on'); } catch (e) {}
      try { location.reload(); } catch (e) {}
    };
    setVoice = (id) => { this.setState({ voiceId:id }); };
    refreshVoices = () => { this.setState({ vtick:this.state.vtick + 1 }); };
    toggleAllVoices = () => { this.setState({ vall:!this.state.vall }); };

    // ----- review -----
    flip = () => { this.setState({ rflip:!this.state.rflip }); };
    rate = (r) => {
      const S = this.state;
      if (!S.rq.length) return;
      const q = S.rq.slice();
      const zh = q.shift();
      const res = this.applyRating(zh, r, ['see', 'prod']);
      const gain = { again:0, hard:2, good:4, easy:5 }[r];
      const counts = Object.assign({}, S.rcounts);
      counts[r] = counts[r] + 1;
      let done = S.rdone;
      if (r === 'again') q.push(zh); else done = done + 1;
      const finished = q.length === 0;
      this.setState({
        rq:q, rflip:false, rdone:done, rstep:S.rstep + 1, rxp:S.rxp + gain, rcomplete:finished, rcounts:counts,
        xp:S.xp + gain, dayXp:S.dayXp + gain, dayMin:S.dayMin + (finished ? Math.max(1, Math.round(S.rtotal * 0.5)) : 0),
        ws:res.ws, woff:0, rlast:{ zh, from:res.from, to:res.to }
      });
    };
    practiceAnyway = () => {
      const q = buildQueue(this.state.ws, true);
      this.setState({ rq:q, rtotal:q.length, rdone:0, rxp:0, rcomplete:false, rflip:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null });
    };

    // ----- quiz engine (tests and grammar practice) -----
    quizQs = [];
    qs = () => this.quizQs;
    curQ = () => this.quizQs[this.state.qi] || this.quizQs[0];
    startQuiz = (mode, lessonIdx) => {
      const list = mode === 'grammar' ? prepGrammar(LESSONS[lessonIdx === undefined ? this.state.glesson : lessonIdx]) : buildTest(this.state);
      if (!list.length) return;
      this.quizQs = list;
      this.setState({ screen:'quiz', qmode:mode, qi:0, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0-9\s.,!?]/g, '');
    canCheck = () => {
      const S = this.state; const q = this.curQ();
      if (!q) return false;
      if (q.type === 'type' || q.type === 'cloze') return this.norm(S.qtyped).length > 0;
      if (q.type === 'order') return S.qpicked.length === q.tiles.length;
      return S.qchoice !== null;
    };
    check = () => {
      const S = this.state;
      if (S.qchecked || !this.canCheck()) return;
      const q = this.curQ();
      let ok = false;
      if (q.type === 'type' || q.type === 'cloze') ok = q.accepts.indexOf(this.norm(S.qtyped)) >= 0;
      else if (q.type === 'listen' || q.type === 'mc') ok = S.qchoice === q.correct;
      else if (q.type === 'order') ok = S.qpicked.map(id => q.tiles[id]).join('|') === q.toks.join('|');
      else if (q.type === 'spot') ok = S.qchoice === q.spot;
      const gain = ok ? 10 + Math.min(S.qcombo, 4) * 2 : 0;
      const combo = ok ? S.qcombo + 1 : 0;
      const res = S.qres.slice(); res[S.qi] = ok;
      const patch = { qchecked:true, qcorrect:ok, qscore:S.qscore + (ok ? 1 : 0), qcombo:combo, qbest:Math.max(S.qbest, combo), qxp:S.qxp + gain, qgain:gain, qres:res, xp:S.xp + gain, dayXp:S.dayXp + gain };
      if (q.word && q.dim && S.ws[q.word]) {
        const cur = S.ws[q.word];
        const ws = Object.assign({}, S.ws);
        ws[q.word] = { see:cur.see, hear:cur.hear, prod:cur.prod };
        ws[q.word][q.dim] = bump(cur[q.dim], ok ? 'good' : 'again');
        patch.ws = ws;
      }
      this.setState(patch);
    };
    next = () => {
      const S = this.state;
      const total = this.quizQs.length;
      if (S.qi + 1 >= total) {
        const patch = { qdone:true };
        const pct = Math.round(S.qscore / total * 100);
        if (S.qmode === 'test') {
          const hist = S.testHistory.concat([{ date:new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' }), score:pct }]).slice(-5);
          patch.testHistory = hist; patch.tdone = true; patch.dayMin = S.dayMin + (S.tdone ? 0 : 3);
        } else {
          const L = LESSONS[S.glesson];
          const gres = Object.assign({}, S.gres); gres[L.id] = Math.max(gres[L.id] || 0, pct);
          patch.gres = gres; patch.gdone = true; patch.dayMin = S.dayMin + (S.gdone ? 0 : 4);
        }
        this.setState(patch);
      } else {
        this.setState({ qi:S.qi + 1, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false });
      }
    };
    primary = () => { if (this.state.qchecked) this.next(); else this.check(); };
    pick = (id) => { const S = this.state; if (S.qchecked || S.qpicked.indexOf(id) >= 0) return; this.setState({ qpicked:S.qpicked.concat([id]) }); };
    unpick = (id) => { const S = this.state; if (S.qchecked) return; this.setState({ qpicked:S.qpicked.filter(x => x !== id) }); };
    exitQuiz = () => { this.setState({ screen:this.state.qmode === 'grammar' ? 'grammar' : 'testlobby', qdone:false }); };
    pickLesson = (i) => { this.setState({ glesson:i }); try { window.scrollTo(0, 0); } catch (e) {} };

    // ----- speaking practice: a scripted conversation you say out loud yourself -----
    sayIt = () => {
      const S = this.state;
      const sc = SCEN[S.sidx];
      const total = sc.you.length;
      if (S.sturn >= total) return;
      const t = S.sturn + 1;
      const patch = { sturn:t };
      if (t >= total) {
        const sres = Object.assign({}, S.sres); sres[sc.id] = true;
        patch.sdone = true; patch.sres = sres; patch.xp = S.xp + 10; patch.dayXp = S.dayXp + 10;
        patch.dayMin = S.dayMin + (S.spokeToday ? 0 : 6); patch.spokeToday = true;
      }
      this.setState(patch);
      // listening only: Mingming's next line plays by itself (this runs inside your tap, so the browser allows the sound)
      if (!S.szh && !S.spy && !S.sen && t < sc.ai.length) this.say(sc.ai[t].zh, 'ai' + t);
    };
    resetSpeak = () => { this.setState({ sturn:0, sdone:false }); };
    pickScenario = (i) => { this.setState({ sidx:i, sturn:0, sdone:false }); };

    // ----- word webs and word memory -----
    applyRating = (zh, r, dims) => {
      const cur = this.state.ws[zh];
      const next = { see:cur.see, hear:cur.hear, prod:cur.prod };
      dims.forEach(k => { next[k] = bump(cur[k], r); });
      const ws = Object.assign({}, this.state.ws);
      ws[zh] = next;
      return { ws, from:wMastery(cur), to:wMastery(next) };
    };
    learnWord = (zh) => {
      const S = this.state;
      if (S.wlearned[zh] || Object.keys(S.wlearned).length >= limitOf(S)) return;
      const cur = S.ws[zh];
      const ws = Object.assign({}, S.ws);
      ws[zh] = { see:{ s:0.5, l:0, t:Date.now() }, hear:cur.hear, prod:cur.prod };
      const wl = Object.assign({}, S.wlearned); wl[zh] = true;
      const patch = { ws, wlearned:wl, xp:S.xp + 3, dayXp:S.dayXp + 3 };
      if (Object.keys(wl).length >= Math.min(4, limitOf(S)) && !S.webCredited) { patch.webCredited = true; patch.dayMin = S.dayMin + 5; }
      this.setState(patch);
    };
    rateWeb = (zh, ok) => {
      const S = this.state;
      if (S.wrated[zh]) return;
      const wasNew = wMastery(S.ws[zh]) === 0;
      if (wasNew && !S.wlearned[zh] && Object.keys(S.wlearned).length >= limitOf(S)) return;
      const res = this.applyRating(zh, ok ? 'good' : 'again', ['see']);
      const wr = Object.assign({}, S.wrated); wr[zh] = true;
      const wd = Object.assign({}, S.wdelta); wd[zh] = { from:res.from, to:res.to };
      const patch = { ws:res.ws, wrated:wr, wdelta:wd, xp:S.xp + (ok ? 3 : 1), dayXp:S.dayXp + (ok ? 3 : 1) };
      if (wasNew) {
        const wl = Object.assign({}, S.wlearned); wl[zh] = true; patch.wlearned = wl;
        if (Object.keys(wl).length >= Math.min(4, limitOf(S)) && !S.webCredited) { patch.webCredited = true; patch.dayMin = S.dayMin + 5; }
      }
      this.setState(patch);
    };
    setLimit = (n) => { this.setState({ nlimit:n }); };
    // Adds every still-new word in a list (a shared-character group or a topic), up to the daily limit if one is set.
    learnMany = (list) => {
      const S = this.state;
      const lim = limitOf(S);
      const wl = Object.assign({}, S.wlearned);
      const ws = Object.assign({}, S.ws);
      let n = 0;
      list.forEach(zh => {
        if (wl[zh] || wMastery(ws[zh]) > 0 || Object.keys(wl).length >= lim) return;
        ws[zh] = { see:{ s:0.5, l:0, t:Date.now() }, hear:ws[zh].hear, prod:ws[zh].prod };
        wl[zh] = true;
        n++;
      });
      if (!n) return;
      const patch = { ws, wlearned:wl, xp:S.xp + 3 * n, dayXp:S.dayXp + 3 * n };
      if (Object.keys(wl).length >= Math.min(4, lim) && !S.webCredited) { patch.webCredited = true; patch.dayMin = S.dayMin + 5; }
      this.setState(patch);
    };
    reviewMore = () => {
      const q = buildQueue(this.state.ws, false);
      if (!q.length) return;
      this.setState({ rq:q, rtotal:q.length, rdone:0, rxp:0, rcomplete:false, rflip:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null });
    };
    nextEx = (zh) => { const n = Object.assign({}, this.state.wexn); n[zh] = ((n[zh] || 0) + 1) % EXS[zh].length; this.setState({ wexn:n }); };
    toggleEx = (key) => { const x = Object.assign({}, this.state.wex); x[key] = !x[key]; this.setState({ wex:x }); };
    revealWord = (zh) => { const r = Object.assign({}, this.state.wreveal); r[zh] = true; this.setState({ wreveal:r }); };
    gapPick = (zh) => {
      const S = this.state;
      if (S.gfpick !== null) return;
      const g = HUBS[S.whub].gaps[S.gfq];
      const ok = zh === g.ans;
      const res = this.applyRating(g.ans, ok ? 'good' : 'again', ['see']);
      this.setState({ gfpick:zh, ws:res.ws, xp:S.xp + (ok ? 2 : 0) });
    };
    gapNext = () => { const S = this.state; this.setState({ gfq:(S.gfq + 1) % HUBS[S.whub].gaps.length, gfpick:null }); };

    // ----- shadowing (you say it yourself; nothing is recorded) -----
    shadowGo = () => {
      const S = this.state;
      if (S.shround >= 3) return;
      const n = S.shround + 1;
      const patch = { shround:n };
      if (n >= 3) { patch.xp = S.xp + 6; patch.dayXp = S.dayXp + 6; }
      this.setState(patch);
    };
    shadowNext = () => { this.setState({ dclip:(this.state.dclip + 1) % CLIPS.length, shround:0 }); };

    // ----- listening lab -----
    playClip = () => { this.say(CLIPS[this.state.dclip].zh, 'clip', this.state.drate); this.setState({ dplays:this.state.dplays + 1 }); };
    checkDict = () => {
      const S = this.state;
      if (S.dchecked) return;
      const clip = CLIPS[S.dclip];
      const typed = S.dtyped.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
      if (!typed.length) return;
      let pos = 0;
      const marks = clip.words.map(w => { const i = typed.indexOf(w.key, pos); if (i >= 0) { pos = i + w.key.length; return true; } return false; });
      const patch = { dchecked:true, dmarks:marks, dreveal:2 };
      let wsNext = S.ws;
      clip.words.forEach((w, i) => {
        if (wsNext[w.zh]) { const cur = wsNext[w.zh]; wsNext = Object.assign({}, wsNext); wsNext[w.zh] = { see:cur.see, hear:bump(cur.hear, marks[i] ? 'good' : 'again'), prod:cur.prod }; }
      });
      patch.ws = wsNext;
      const hits = marks.filter(m => m).length;
      const cb = S.clipBest.slice(); cb[S.dclip] = Math.max(cb[S.dclip] || 0, hits / clip.words.length);
      patch.clipBest = cb;
      const mis = Object.assign({}, S.misses);
      clip.words.forEach((w, i) => { if (!marks[i]) mis[w.zh] = (mis[w.zh] || 0) + 1; });
      patch.misses = mis;
      if (!S.ldone) { patch.ldone = true; patch.dayMin = S.dayMin + 4; }
      patch.xp = S.xp + hits; patch.dayXp = S.dayXp + hits;
      this.setState(patch);
    };
    nextClip = () => { const S = this.state; this.setState({ dclip:(S.dclip + 1) % CLIPS.length, dplays:0, dtyped:'', dchecked:false, dmarks:[], dreveal:0 }); };
    playTone = () => {
      const S = this.state;
      let idx = S.tidx;
      if (idx === null || S.tpick !== null) { idx = Math.floor(Math.random() * 4); this.setState({ tidx:idx, tpick:null }); }
      this.say(TONES[idx].zh, 'tone', 0.8);
    };
    pickTone = (n) => {
      const S = this.state;
      if (S.tidx === null || S.tpick !== null) return;
      this.setState({ tpick:n, tright:S.tright + (n === S.tidx ? 1 : 0), ttotal:S.ttotal + 1 });
    };

    // ----- progress file and reset -----
    exportData = () => {
      try {
        this.persistNow();
        const out = {};
        PERSIST.forEach(k => { out[k] = this.state[k]; });
        const blob = new Blob([JSON.stringify({ app:'shanlu', version:1, saved:new Date().toISOString(), data:out }, null, 2)], { type:'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'shanlu-progress-' + ymd(new Date()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) {}
    };
    importData = () => { const el = document.getElementById('import-file'); if (el) el.click(); };
    importText = (text) => {
      try {
        const obj = JSON.parse(text);
        const data = obj && obj.data;
        if (!data || typeof data !== 'object' || !data.ws) throw new Error('not a progress file');
        const merged = mergeSaved(Object.assign({}, this.state), data);
        this.setState(rollDay(merged));
        this.persistNow();
      } catch (e) { window.alert('That file does not look like a Shanlu progress file.'); }
    };
    resetAll = () => {
      if (window.confirm('Delete all progress in this browser? Export it first if you want a copy.')) {
        try { localStorage.removeItem(KEY); } catch (e) {}
        window.location.reload();
      }
    };
    toggleTheme = () => { this.setState({ theme:this.state.theme === 'dark' ? 'light' : 'dark' }); };

    aiVals() {
      const S = this.state;
      const quiet = !S.szh && !S.spy && !S.sen;
      const msgs = S.aim.map((m, k) => ({
        who:m.who, isAi:m.who === 'ai', zh:m.zh, py:m.py, en:m.en, showZh:S.szh, showPy:S.spy && !!m.py, showEn:S.sen && !!m.en && m.who === 'ai',
        quiet, quietText:m.who === 'ai' ? 'Listen to Mingming' : 'You said it', pc:S.playing === 'aim' + k ? 'on' : '', play:() => this.say(m.zh, 'aim' + k),
        hasOutside:m.outside.length > 0, outsideText:'Not in the HSK 1 list: ' + m.outside.join(' '),
        hasFb:!!m.fb, fbBetter:m.fb ? m.fb.better : '', fbWhy:m.fb ? m.fb.why : '', hasOk:m.who === 'me' && !!m.judged && !m.fb,
        cmpGood:!!(m.cmp && m.cmp.same), cmpBad:!!(m.cmp && !m.cmp.same),
        cmpBadHead:m.cmp && !m.cmp.same ? 'Suggested: ' + m.cmp.sugZh + ' (' + m.cmp.sugPy + ')' : '',
        cmpBadDetail:m.cmp && !m.cmp.same ? (m.cmp.lens ? 'The suggestion has ' + m.cmp.lens.exp + ' characters and you had ' + m.cmp.lens.got + '.' : m.cmp.diffs.map(d => d.exp + (d.pe ? ' (' + d.pe + ')' : '') + ' → you: ' + d.got + (d.pg ? ' (' + d.pg + ')' : '') + (d.tone ? ' · same sound, different tone' : '')).join('  ·  ')) : ''
      }));
      const hasMic = !!(window.webkitSpeechRecognition || window.SpeechRecognition);
      const lastM = S.aim[S.aim.length - 1];
      const sg = lastM && lastM.who === 'ai' && lastM.sug && !S.aiBusy ? lastM.sug : null;
      return {
        sugClosed:!!sg && !sg.open, sugOpen:!!sg && sg.open, sugZh:sg ? sg.zh : '', sugPy:sg ? sg.py : '', sugEn:sg ? sg.en : '',
        sugShow:this.aiShowSug, sugUse:this.aiUseSug, sugPc:S.playing === 'sug' ? 'on' : '', sugPlay:() => sg && this.say(sg.zh, 'sug'),
        scriptMode:!S.aiMode, aiModeOn:S.aiMode, scriptCls:S.aiMode ? '' : 'on', aiCls:S.aiMode ? 'on' : '',
        setScript:() => this.setAiMode(false), setAi:() => this.setAiMode(true),
        aiNoKey:S.aiMode && !S.aiOn, aiReady:S.aiMode && S.aiOn, aiMsgs:msgs, aiBusy:S.aiBusy, aiErr:S.aiErr, hasAiErr:!!S.aiErr,
        aiInput:S.aiInput, onAiInput:(e) => this.setState({ aiInput:e.target.value }), onAiKey:(e) => { if (e.key === 'Enter') this.aiSend(); },
        aiSend:this.aiSend, aiMic:this.aiMic, aiHasMic:hasMic, aiNoMic:!hasMic, aiMicLabel:S.aiListen ? 'Listening… tap to stop' : 'Speak', aiMicCls:S.aiListen ? 'on' : '',
        aiScnList:[{ title:'Free chat', sub:'Anything simple', cls:S.aiScn === -1 ? 'cur' : '', fn:() => this.aiStart(-1) }].concat(SCEN.map((x, i) => ({ title:x.title, sub:x.sub, cls:S.aiScn === i ? 'cur' : '', fn:() => this.aiStart(i) }))),
        aiToday:(S.aiDays[ymd(new Date())] || 0) + ' messages today', aiSimpler:this.aiSimpler,
        aiSet:S.aiOn, aiUnset:!S.aiOn, aiKeyInput:S.aiKeyInput, onAiKeyInput:(e) => this.setState({ aiKeyInput:e.target.value }), aiSaveKey:this.aiSaveKey, aiRemoveKey:this.aiRemoveKey,
        aiModelOpts:AI_MODELS.map(m => ({ label:m[1], cls:S.aiModel === m[0] ? 'on' : '', fn:() => this.aiSetModel(m[0]) })), aiNote:S.aiNote, hasAiNote:!!S.aiNote
      };
    }

    examVals() {
      const S = this.state, m = S.exm;
      const secName = (s) => (s === 'listening' ? 'Listening' : 'Reading');
      const hist = (S.exams || []).slice(-5).reverse().map(h => {
        const pts = ((h.l || 0) + (h.r || 0)) * 5;
        const what = h.mode === 'full' ? 'Full exam' : secName(h.mode);
        const parts = [];
        if (h.l !== null && h.l !== undefined) parts.push('Listening ' + h.l + '/20');
        if (h.r !== null && h.r !== undefined) parts.push('Reading ' + h.r + '/20');
        return { text:new Date(h.at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' · ' + what, score:h.mode === 'full' ? pts + ' / 200' : parts.join(' '), detail:h.mode === 'full' ? parts.join(' · ') : '' };
      });
      const v = {
        examAvailable:!!EXAMBANK, exHome:!m, exRun:!!m && m.stage === 'run', exBreak:!!m && m.stage === 'break', exResult:!!m && m.stage === 'result',
        startFull:() => this.startExam('full'), startListening:() => this.startExam('listening'), startReading:() => this.startExam('reading'),
        histRows:hist, hasHist:hist.length > 0, noHist:hist.length === 0, exClose:this.exClose, exContinue:this.exContinue
      };
      if (!m) return v;
      if (m.stage === 'break') {
        const l = m.results.listening;
        v.exBreakText = 'Listening finished: ' + l.correct + ' of ' + l.total + ' right. Next is Reading: 20 questions, ' + EXAM_MIN.reading + ' minutes. Take a breath first.';
      }
      if (m.stage === 'run') {
        const q = m.qs[m.i];
        const left = Math.max(0, m.endAt - Date.now());
        const used = m.plays[q.id] || 0;
        const chosen = m.ans[q.id];
        const taken = {};
        if (q.kind === 'match') m.qs.forEach(o => { if (o.part === q.part && o.id !== q.id && m.ans[o.id] !== undefined) taken[m.ans[o.id]] = true; });
        Object.assign(v, {
          exSection:secName(m.sec) + ' · Part ' + PART[q.part].n, exInst:PART[q.part].inst, exN:m.i + 1, exTotal:m.qs.length,
          exTimer:Math.floor(left / 60000) + ':' + pad(Math.floor(left / 1000) % 60), exTimerCls:left < 60000 ? 'warn' : '',
          exListen:!!q.audio, exPlaysLeft:2 - used, exCanPlay:used < 2, exPlayDis:used < 2 ? 'false' : 'true', exPlayCls:S.playing === 'exq' ? 'on' : '', exPlay:this.exPlay,
          exHasPic:!!q.pic, exPic:q.pic || '', exHasText:!!q.text, exText:q.text || '',
          exOpts:q.opts.map((o, k) => ({ letter:q.kind === 'tf' ? '' : LETTERS[k], label:o.label, emo:!!o.emoji, big:(q.kind === 'pic' || o.emoji) ? 'true' : '',
            cls:(chosen === o.v ? 'on ' : '') + (taken[o.v] ? 'used ' : ''), pick:() => this.exPick(o.v) })),
          exOptsCls:'k-' + q.kind, exPal:m.qs.map((o, k) => ({ n:k + 1, cls:(k === m.i ? 'cur ' : '') + (m.ans[o.id] !== undefined ? 'done' : ''), go:() => this.exGo(k) })),
          exPrev:() => this.exGo(m.i - 1), exNext:() => this.exGo(m.i + 1), exCanPrev:m.i > 0, exCanNext:m.i < m.qs.length - 1,
          exSubmit:() => this.exSubmit(false), exSubmitLabel:'Submit ' + secName(m.sec).toLowerCase(), exOpen:m.qs.filter(o => m.ans[o.id] === undefined).length,
          hasConfirm:!!m.confirm, exConfirmMsg:m.qs.filter(o => m.ans[o.id] === undefined).length + ' question(s) are unanswered. Press submit again to finish anyway.'
        });
      }
      if (m.stage === 'result') {
        const secs = ['listening', 'reading'].filter(s => m.results[s]).map(s => {
          const r = m.results[s]; const pct = Math.round(100 * r.correct / r.total);
          return { name:secName(s), text:r.correct + ' of ' + r.total, pts:r.correct * 5 + ' / 100', pct:pct + '%', ok:pct >= 80, cls:pct >= 80 ? 'good' : 'low', auto:r.auto,
            parts:Object.keys(r.byPart).map(p => ({ name:'Part ' + PART[p].n, score:r.byPart[p].c + ' / ' + r.byPart[p].t, cls:r.byPart[p].c === r.byPart[p].t ? 'good' : '' })) };
        });
        const total = ['listening', 'reading'].reduce((n, s) => n + (m.results[s] ? m.results[s].correct * 5 : 0), 0);
        const seal = secs.length > 0 && secs.every(s => s.ok);
        const wrong = [];
        ['listening', 'reading'].forEach(s => { if (m.results[s]) m.results[s].wrong.forEach(w => wrong.push(w)); });
        Object.assign(v, {
          exSecs:secs, exFull:m.mode === 'full', exSingle:m.mode !== 'full', exTotal200:total + ' / 200', exPassReal:total >= 120,
          exVerdict:m.mode === 'full' ? (total >= 120 ? 'At or above 120 of 200, the pass mark of the official HSK 1 test.' : 'Below 120 of 200, the pass mark of the official HSK 1 test.') : 'One section only. The official pass mark is on the total of both sections.',
          exSeal:seal, exNoSeal:!seal, exSealText:seal ? 'You reached 80% in every section you took. That is this site\'s bar for the HSK 1 seal.' : 'The seal here needs 80% in every section. Review the questions below and try again.',
          exWrong:wrong.map(w => ({ n:w.n, part:'Part ' + PART[w.q.part].n, zh:w.q.rev.zh, py:w.q.rev.py, en:w.q.rev.en, pic:w.q.rev.pic || '', hasPic:!!w.q.rev.pic,
            right:w.q.right, yours:w.yours === undefined ? 'No answer' : (w.q.opts.find(o => o.v === w.yours) || { label:'' }).label })), hasWrong:wrong.length > 0, perfect:wrong.length === 0,
          exAgain:() => this.startExam(m.mode)
        });
      }
      return v;
    }

    voiceVals() {
      const S = this.state;
      const all = allVoices();
      const ranked = rankedVoices();
      const chosen = pickVoice(S.voiceId);
      const manual = !!S.voiceId && ranked.some(v => v.voiceURI === S.voiceId);
      const rows = ranked.map(v => {
        const on = !!chosen && manual && v.voiceURI === chosen.voiceURI;
        return {
          name:v.name, cls:on ? 'on' : '',
          meta:v.lang + ' · ' + QUALITY_LABEL[voiceQuality(v)] + (v.localService ? '' : ' · online'),
          play:() => this.say(VOICE_SAMPLE, 'v:' + v.voiceURI, 0.85, v), playCls:S.playing === 'v:' + v.voiceURI ? 'on' : '',
          use:() => this.setVoice(v.voiceURI), useLabel:on ? 'In use' : 'Use this voice', useCls:on ? 'on' : ''
        };
      });
      const everything = all.map(v => ({ line:v.name + ' · ' + v.lang + (v.localService ? '' : ' · online') }));
      let intro;
      if (!all.length) intro = 'Your browser has not listed any voices yet. If you just downloaded one, tap Refresh.';
      else if (!ranked.length) intro = 'Your browser lists ' + all.length + ' voices, but none of them is Mandarin Chinese, so audio on this site may be silent or in the wrong language.';
      else intro = 'Your browser lists ' + all.length + ' voices, ' + ranked.length + ' of them Mandarin. Unless you pick one, the site uses the best-sounding Mandarin voice it can find.';
      return {
        voiceIntro:intro, voiceRows:rows, hasVoices:rows.length > 0,
        autoCls:manual ? '' : 'on', autoLabel:manual ? 'Use automatic' : 'In use',
        autoName:chosen ? 'Automatic: ' + chosen.name : 'Automatic',
        autoPlay:() => this.say(VOICE_SAMPLE, 'v:auto', 0.85), autoPlayCls:S.playing === 'v:auto' ? 'on' : '',
        useAuto:() => this.setVoice(''), refreshVoices:this.refreshVoices,
        showAllVoices:S.vall, allVoicesBtn:S.vall ? 'Hide the full list' : 'Show every voice the browser reports (' + all.length + ')',
        toggleAllVoices:this.toggleAllVoices, everyVoice:everything
      };
    }

    renderVals() {
      this.state = rollDay(this.state);
      const S = this.state;
      const dark = S.theme === 'dark';
      const sd = SYS[S.sys];
      const today = ymd(new Date());
      const pc = (key) => (S.playing === key ? 'on' : '');

      // progress
      const bankKeys = Object.keys(BANK);
      const infos = bankKeys.map(zh => winfo(S.ws[zh], 0));
      const startedCount = infos.filter(i => i.started).length;
      const vocabPct = Math.round(infos.reduce((a, i) => a + i.m, 0) / bankKeys.length);
      const gramPassed = LESSONS.filter(L => (S.gres[L.id] || 0) >= 80).length;
      const gramPct = Math.round(gramPassed / LESSONS.length * 100);
      const testReady = BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0)).length >= 3;
      const clipsTried = S.clipBest.filter(x => x > 0).length;
      const listenPct = Math.round(S.clipBest.reduce((a, b) => a + b, 0) / CLIPS.length * 100);
      const spkDone = SCEN.filter(sc => S.sres[sc.id]).length;
      const spkPct = Math.round(spkDone / SCEN.length * 100);
      const overall = Math.round((vocabPct + gramPct + listenPct + spkPct) / 4);
      const wm = {
        mastered:infos.filter(i => i.lv === 'mastered').length,
        familiar:infos.filter(i => i.lv === 'familiar' || i.lv === 'strong').length,
        learning:infos.filter(i => i.lv === 'learning').length
      };
      const streakShown = (S.lastActive === today || S.lastActive === daysAgo(1)) ? S.streak : 0;

      const active = S.screen === 'quiz' ? (S.qmode === 'grammar' ? 'grammar' : 'testlobby') : S.screen;
      const navCls = (k) => 'nav' + (active === k ? ' on' : '');

      const titles = {
        home:['Welcome back', S.dayMin >= S.mins ? 'Daily goal reached. Anything else is a bonus.' : (S.mins - S.dayMin) + ' min to go for today\'s goal.'],
        review:['Review words', 'Words that are due, based on how well you remember them.'],
        testlobby:['HSK 1 test', 'Mixed questions from the words you have started, so you are recalling words, not just recognizing them.'],
        grammar:['Grammar', LESSONS.length + ' lessons that cover the HSK 1 grammar outline, one at a time.'],
        speak:['Speaking practice', 'Say a short conversation out loud.'],
        exam:['HSK 1 level exam', 'Pass every section to climb to HSK 2.'],
        web:['Word webs', 'Learn new words next to the words you already know.'],
        words:['My words', 'How well you know each word, and when it needs a refresh.'],
        listen:['Listening lab', 'Train your ear for how people really talk, not just how lessons sound.'],
        voice:['Settings', 'Sync your progress between devices, choose the voice that reads Chinese aloud, and how 儿 endings are shown.'],
        quiz:S.qmode === 'grammar' ? ['Grammar practice', LESSONS[S.glesson].title] : ['HSK 1 test', 'Take your time. Wrong answers show you why.']
      };
      const tt = titles[S.screen];

      // week strip (Monday first)
      const now = new Date();
      const dow = (now.getDay() + 6) % 7;
      const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
        const d = new Date(now); d.setDate(now.getDate() - dow + i);
        const key = ymd(d);
        return { l, cls:S.activity[key] ? 'd' : (key === today ? 't' : '') };
      });

      // home
      const C = 2 * Math.PI * 46;
      const ringDash = (Math.min(S.dayMin / S.mins, 1) * C).toFixed(1) + 'px ' + C.toFixed(1) + 'px';
      const dueNow = S.rq.length;
      const reviewMin = Math.max(2, Math.min(6, Math.round(Math.max(S.rtotal, dueNow) * 0.5)));
      const nextLesson = Math.max(0, LESSONS.findIndex(L => (S.gres[L.id] || 0) < 80));
      const nextScn = Math.max(0, SCEN.findIndex(sc => !S.sres[sc.id]));
      const learnN = Math.min(4, limitOf(S));
      const pool = [
        { glyph:'联', title:'Learn ' + learnN + ' new words with their relatives', meta:'Word webs', min:5, done:S.webCredited, to:'web' },
        { glyph:'词', title:'Review ' + Math.max(S.rtotal, dueNow) + ' word' + (Math.max(S.rtotal, dueNow) === 1 ? '' : 's'), meta:'Words that are due', min:reviewMin, done:S.rcomplete, to:'review', show:S.rcomplete || dueNow > 0 },
        { glyph:'听', title:'Listening drill', meta:'Dictation with a speed ladder', min:4, done:S.ldone, to:'listen' },
        { glyph:'说', title:'Say: ' + SCEN[nextScn].title, meta:'Practice script, ' + SCEN[nextScn].you.length + ' turns', min:6, done:S.spokeToday, to:'speak', pre:() => this.setState({ sidx:nextScn, sturn:0, sdone:false }) },
        { glyph:'语', title:'Grammar: ' + LESSONS[nextLesson].title, meta:LESSONS[nextLesson].q.length + ' exercises', min:4, done:S.gdone, to:'grammar', pre:() => this.setState({ glesson:nextLesson }) },
        { glyph:'测', title:'HSK 1 test', meta:'Mixed questions from your words', min:3, done:S.tdone, to:'testlobby', show:testReady }
      ].filter(t => t.show !== false);
      let planned = 0;
      const plan = [];
      pool.forEach(t => { if (planned + t.min <= S.mins) { plan.push(t); planned += t.min; } });
      const tasks = plan.map(t => ({ glyph:t.glyph, title:t.title, meta:t.meta, xp:t.min + ' min', done:t.done, open:!t.done, cls:t.done ? 'done' : '', go:() => { if (t.pre) t.pre(); this.go(t.to); } }));
      const minOpts = [10, 20, 30, 45].map(m => ({ label:m + ' min', cls:S.mins === m ? 'on' : '', fn:() => this.setState({ mins:m }) }));
      const planNote = planned + ' of ' + S.mins + ' minutes planned. A longer goal adds more to the list.';
      const skills = [
        { label:'Vocabulary', detail:startedCount + ' of ' + bankKeys.length + ' words started', w:vocabPct + '%' },
        { label:'Grammar', detail:gramPassed + ' of ' + LESSONS.length + ' lessons passed', w:gramPct + '%' },
        { label:'Listening', detail:clipsTried + ' of ' + CLIPS.length + ' clips tried', w:listenPct + '%' },
        { label:'Speaking', detail:spkDone + ' of ' + SCEN.length + ' scripts done', w:spkPct + '%' }
      ];
      const lvN = sd.levels.length;
      const stairs = sd.levels.map((lv, i) => ({
        label:'HSK ' + lv[0], words:lv[1] ? lv[1] + ' words' : 'Advanced', h:(172 + i * (lvN > 7 ? 24 : 32)) + 'px',
        cls:i === 0 ? 'cur' : 'lock', isCur:i === 0, isLock:i !== 0,
        fillH:i === 0 ? overall + '%' : '0%', status:i === 0 ? overall + '% done' : (i <= 2 ? 'In review' : 'Locked')
      }));

      // review
      const rzh = S.rq.length ? S.rq[0] : bankKeys[0];
      const rw = BANK[rzh];
      const rexL = EXS[rzh]; const rex = rexL[(strHash(rzh) + Math.floor(Date.now() / 864e5) + S.rstep) % rexL.length];
      const cinfo = winfo(S.ws[rzh], 0);
      const card = Object.assign({ zh:rw.zh, py:rw.py, en:rw.en, stage:cinfo.chipCls, stageLabel:cinfo.mLabel, sizeCls:rw.zh.length > 1 ? 'two' : '', exZh:rex.zh, exPy:rex.py, exEn:rex.en, hasNote:!!NOTE[rzh], note:NOTE[rzh] || '', reportUrl:report('Review card for ' + rw.zh, rex.zh + ' (' + rex.py + ') ' + rex.en) }, cinfo);
      const rates = [
        { key:'again', label:'Again', cls:'again' },
        { key:'hard', label:'Hard', cls:'' },
        { key:'good', label:'Good', cls:'' },
        { key:'easy', label:'Easy', cls:'easy' }
      ].map(r => Object.assign({}, r, { hint:r.key === 'again' ? 'Later today' : fmtInterval(bump(S.ws[rzh].see, r.key).s), fn:() => this.rate(r.key) }));
      let nextDueText = '';
      if (startedCount > 0) {
        const soon = infos.filter(i => i.started).sort((a, b) => a.dueN - b.dueN)[0];
        nextDueText = 'Next word to review: ' + soon.due.toLowerCase() + '.';
      }

      // quiz
      const qs = this.quizQs.length ? this.quizQs : [{ type:'mc', kicker:'', prompt:'', options:[], correct:'', reveal:'', explain:'' }];
      const q0 = qs[Math.min(S.qi, qs.length - 1)];
      const isTyped = q0.type === 'type' || q0.type === 'cloze';
      const isListen = q0.type === 'listen';
      const isChoice = isListen || q0.type === 'mc';
      const isOrder = q0.type === 'order';
      const isSpot = q0.type === 'spot';
      const q = {
        kicker:q0.kicker, prompt:q0.prompt, big:q0.big || '', hasBig:!!q0.big, bigCls:(q0.big || '').length > 3 ? 'sm' : '',
        sub:q0.sub || '', hasSub:!!q0.sub, placeholder:q0.placeholder || '',
        isTyped, isListen, isChoice, isOrder, isSpot, reveal:q0.reveal, explain:q0.explain,
        reportUrl:report((S.qmode === 'grammar' ? 'Grammar practice' : 'Test') + ' question ' + (S.qi + 1), q0.prompt + ' / ' + q0.reveal)
      };
      const opts = (isChoice ? q0.options : []).map(o => {
        let cls = '';
        if (S.qchecked) { if (o.id === q0.correct) cls = 'right'; else if (o.id === S.qchoice) cls = 'wrong'; }
        else if (o.id === S.qchoice) cls = 'sel';
        return { label:o.label, cls, lcls:isListen ? 'zh' : '', pick:() => { if (!this.state.qchecked) this.setState({ qchoice:o.id }); } };
      });
      const tileState = S.qchecked ? (S.qcorrect ? 'right' : 'wrong') : '';
      const pickedTiles = (isOrder ? S.qpicked : []).map(id => ({ label:q0.tiles[id], cls:tileState, fn:() => this.unpick(id) }));
      const bankTiles = (isOrder ? q0.tiles : []).map((label, id) => ({ label, cls:S.qpicked.indexOf(id) >= 0 ? 'ghost' : '', fn:() => this.pick(id) }));
      const spotTokens = (isSpot ? q0.tokens : []).map((label, id) => {
        let cls = '';
        if (S.qchecked) { if (id === q0.spot) cls = 'right'; else if (id === S.qchoice) cls = 'wrong'; }
        else if (id === S.qchoice) cls = 'sel';
        return { label, isTok:true, isPunct:false, cls, pick:() => { if (!this.state.qchecked) this.setState({ qchoice:id }); } };
      }).concat(isSpot && q0.punct ? [{ label:q0.punct, isTok:false, isPunct:true, cls:'', pick:() => {} }] : []);
      const segs = qs.map((_, i) => ({ cls:S.qres[i] === true ? 'ok' : S.qres[i] === false ? 'miss' : (i === S.qi ? 'cur' : '') }));
      const canCheck = this.canCheck();
      const total = qs.length;
      const acc = Math.round(S.qscore / total * 100);
      const resTitle = acc >= 80 ? 'Strong run' : acc >= 60 ? 'Solid work' : 'Good start';
      const resSub = S.qmode === 'grammar'
        ? (acc >= 80 ? 'Lesson passed. It now counts toward your grammar progress.' : 'You need 80% to pass a lesson. Read the explanation again and have another go.')
        : 'Your score is saved to the list of recent tests.';
      const resGain = S.qmode === 'grammar' ? (acc >= 80 ? 'Lesson passed' : 'Not passed yet (80% needed)') : 'Test saved to your history';

      // speak (practice script)
      const sc = SCEN[S.sidx];
      const turns = sc.you.length;
      const msgs = [];
      const listenOnly = !S.szh && !S.spy && !S.sen;   // everything hidden: just listen
      for (let k = 0; k <= turns; k++) {
        if (S.sturn >= k) msgs.push({ who:'ai', isAi:true, zh:sc.ai[k].zh, py:sc.ai[k].py, en:sc.ai[k].en, showZh:S.szh, showPy:S.spy, showEn:S.sen, quiet:listenOnly, quietText:'Listen to Mingming', hasNote:false, note:'', noteCls:'', pc:pc('ai' + k), play:() => this.say(sc.ai[k].zh, 'ai' + k) });
        if (k < turns && S.sturn > k) msgs.push({ who:'me', isAi:false, zh:sc.you[k].zh, py:sc.you[k].py, en:sc.you[k].en, showZh:S.szh, showPy:S.spy, showEn:S.sen, quiet:listenOnly, quietText:'You said it', hasNote:false, note:'', noteCls:'', pc:'', play:() => {} });
      }
      const canTalk = S.sturn < turns;
      const target = sc.you[Math.min(S.sturn, turns - 1)];
      const goals = sc.goals.map((g, i) => ({ t:g, cls:S.sturn >= i + 1 ? 'ok' : '' }));
      const wchips = sc.words.map(x => ({ zh:x.zh, py:x.py, play:() => this.say(x.zh, 'w' + x.zh) }));
      const scenarios = SCEN.map((x, i) => ({ glyph:x.glyph, title:x.title, sub:x.sub, state:S.sres[x.id] ? 'Done' : (i === S.sidx ? 'Now' : 'Open'), cls:(S.sres[x.id] ? 'done ' : '') + (i === S.sidx ? 'cur' : ''), fn:() => this.pickScenario(i) }));

      // word webs and word memory
      const webCount = Object.keys(S.wlearned).length;
      const capReached = webCount >= limitOf(S);
      const mini = (zh) => winfo(S.ws[zh], 0);
      // "Show example": the word's own example sentence (the same checked sentences used in My words and the tests)
      const exOf = (zh) => { const l = EXS[zh]; const e = l ? l[(S.wexn[zh] || 0) % l.length] : null; return e ? { zh:e.zh, py:e.py, en:e.en } : { zh:'', py:'', en:'' }; };
      const exFor = (zh, avail) => {
        const e = exOf(zh);
        const open = avail && !!S.wex[zh];
        return { hasExBtn:avail && !!e.zh, exOpen:open, exLabel:open ? 'Hide example' : 'Show example', exToggle:() => this.toggleEx(zh),
          exZh:e.zh, exPy:e.py, exEn:e.en, exPlay:() => this.say(e.zh, 'x' + zh), exPc:pc('x' + zh),
          hasExMore:(EXS[zh] || []).length > 1, exNext:() => this.nextEx(zh), exCount:(((S.wexn[zh] || 0) % (EXS[zh] || [0]).length) + 1) + ' of ' + (EXS[zh] || []).length, hasExNote:!!NOTE[zh], exNote:NOTE[zh] || '' };
      };
      const dlt = (zh) => { const d = S.wdelta[zh]; return d ? { hasDelta:true, deltaText:'Mastery ' + d.from + '% → ' + d.to + '%', deltaCls:d.to >= d.from ? 'up' : 'down' } : { hasDelta:false, deltaText:'', deltaCls:'' }; };
      const cardOf = (w, hubZh) => {
        const b = BANK[w.zh];
        const info = mini(w.zh);
        const isNew = info.lv === 'new';
        const revealed = !S.wquiz || !!S.wreveal[w.zh];
        const rated = !!S.wrated[w.zh];
        return Object.assign({
          zh:w.zh, py:b.py, en:b.en,
          cls:isNew ? 'new' : 'ok', status:info.mLabel,
          showEn:revealed, canReveal:!revealed,
          canRate:S.wquiz && revealed && !rated && !(isNew && capReached),
          canAdd:!S.wquiz && isNew && !capReached,
          capHit:isNew && capReached && !rated,
          p1c:w.parts[0][0], p1n:w.parts[0][1], p1cls:w.parts[0][0] === hubZh ? 'hub' : '',
          p2c:w.parts[1][0], p2n:w.parts[1][1], p2cls:w.parts[1][0] === hubZh ? 'hub' : '',
          pc:pc('w' + w.zh), play:() => this.say(w.zh, 'w' + w.zh),
          reveal:() => this.revealWord(w.zh), learn:() => this.learnWord(w.zh),
          knew:() => this.rateWeb(w.zh, true), missed:() => this.rateWeb(w.zh, false),
          reportUrl:report('Word web card', w.zh + ' (' + b.py + ') ' + b.en + '; parts ' + w.parts.map(p => p[0] + '=' + p[1]).join(', '))
        }, info, dlt(w.zh), exFor(w.zh, revealed));
      };
      const hubNow = HUBS[S.whub];
      const hubCards = hubNow.words.map(w => cardOf(w, hubNow.hub));
      const hubOpts = HUBS.map((h, i) => ({ zh:h.hub, cls:S.whub === i ? 'on' : '', fn:() => this.setState({ whub:i, gfq:0, gfpick:null }) }));
      const gapNow = hubNow.gaps[S.gfq % hubNow.gaps.length];
      const gapDone = S.gfpick !== null;
      const gapOpts = seededShuffle(gapNow.opts, GAP_SEED + S.whub * 131 + (S.gfq % hubNow.gaps.length) * 17).map(zh => ({ zh, py:BANK[zh].py, cls:!gapDone ? '' : (zh === gapNow.ans ? 'right' : (zh === S.gfpick ? 'wrong' : '')), fn:() => this.gapPick(zh) }));
      const fillLine = !gapDone ? '' : (S.gfpick === gapNow.ans ? 'Right. ' : 'Not quite. ') + gapNow.ans + ' (' + BANK[gapNow.ans].py + ') means ' + BANK[gapNow.ans].en + '.';
      const oppRows = OPPS.map(o => {
        const A = BANK[o.a];
        const B = BANK[o.b];
        const ia = mini(o.a);
        const ib = mini(o.b);
        const rev = !!S.wreveal[o.b];
        const bNew = ib.lv === 'new';
        const rated = !!S.wrated[o.b];
        return Object.assign({
          azh:A.zh, apy:A.py, aen:A.en, bzh:B.zh, bpy:B.py, ben:B.en, note:o.note,
          revealed:rev, hidden:!rev, hint:'The opposite of ' + A.en,
          aPc:pc('w' + A.zh), bPc:pc('w' + B.zh),
          playA:() => this.say(A.zh, 'w' + A.zh), playB:() => this.say(B.zh, 'w' + B.zh),
          reveal:() => this.revealWord(B.zh),
          canAdd:rev && bNew && !capReached, canRate:rev && !bNew && !rated, capHit:rev && bNew && capReached && !rated,
          hasExBtn:rev, exOpen:rev && !!S.wex[A.zh + B.zh], exLabel:(rev && S.wex[A.zh + B.zh]) ? 'Hide examples' : 'Show examples', exToggle:() => this.toggleEx(A.zh + B.zh),
          aExZh:exOf(A.zh).zh, aExPy:exOf(A.zh).py, aExEn:exOf(A.zh).en, bExZh:exOf(B.zh).zh, bExPy:exOf(B.zh).py, bExEn:exOf(B.zh).en,
          aExPlay:() => this.say(exOf(A.zh).zh, 'x' + A.zh), bExPlay:() => this.say(exOf(B.zh).zh, 'x' + B.zh), aExPc:pc('x' + A.zh), bExPc:pc('x' + B.zh),
          canAddA:ia.lv === 'new' && !capReached, hasAdd:(ia.lv === 'new' || (rev && bNew)) && !capReached,
          canAddBoth:rev && ia.lv === 'new' && bNew && !capReached && (limitOf(S) - webCount >= 2),
          learnA:() => this.learnWord(A.zh), learnBoth:() => this.learnMany([A.zh, B.zh]),
          learn:() => this.learnWord(B.zh), knew:() => this.rateWeb(B.zh, true), missed:() => this.rateWeb(B.zh, false),
          aLabel:ia.mLabel, aPct:ia.mPct, aW:ia.mW, aBar:ia.mCls, bLabel:ib.mLabel, bPct:ib.mPct, bW:ib.mW, bBar:ib.mCls, bCls:bNew ? 'new' : 'ok',
          reportUrl:report('Opposites pair', A.zh + ' / ' + B.zh + ': ' + o.note)
        }, dlt(B.zh));
      });
      const topicNow = TOPICS[S.wtopic];
      const topicChips = topicNow.words.map(zh => {
        const b = BANK[zh];
        const info = mini(zh);
        const isNew = info.lv === 'new';
        return Object.assign({ zh, py:b.py, en:b.en, cls:isNew ? 'new' : 'ok', canAdd:isNew && !capReached, capHit:isNew && capReached,
          play:() => this.say(zh, 'w' + zh), learn:() => this.learnWord(zh) }, info, exFor(zh, true));
      });
      const topicStarted = topicNow.words.filter(zh => mini(zh).started).length;
      const topicOpts = TOPICS.map((t, i) => ({ label:t.name, cls:S.wtopic === i ? 'on' : '', fn:() => this.setState({ wtopic:i }) }));
      const capOpts = LIMIT_OPTIONS.map(n => ({ label:n === 0 ? 'No limit' : String(n), cls:S.nlimit === n ? 'on' : '', fn:() => this.setLimit(n) }));
      const hubNew = hubNow.words.filter(w => mini(w.zh).lv === 'new' && !S.wlearned[w.zh]).length;
      const topicNew = topicNow.words.filter(zh => mini(zh).lv === 'new' && !S.wlearned[zh]).length;
      const dueLeft = BANK_KEYS.filter(zh => { const i = winfo(S.ws[zh], 0); return i.started && i.dueN <= 0; }).length;

      // my words
      const rowsAll = BANK_KEYS.map(zh => Object.assign({ zh, py:BANK[zh].py, en:BANK[zh].en, pc:pc('w' + zh), play:() => this.say(zh, 'w' + zh) }, winfo(S.ws[zh], S.woff)));
      const lvKeys = ['new', 'learning', 'familiar', 'strong', 'mastered'];
      const lvCount = {};
      lvKeys.forEach(k => { lvCount[k] = rowsAll.filter(r => r.lv === k).length; });
      const filters = [{ key:'all', label:'All', n:rowsAll.length }].concat(lvKeys.map(k => ({ key:k, label:LEVEL_LABEL[k], n:lvCount[k] })))
        .map(f => ({ label:f.label, n:f.n, cls:S.wfilter === f.key ? 'on' : '', fn:() => this.setState({ wfilter:f.key, wshow:40 }) }));
      const levelSegs = lvKeys.map(k => ({ cls:'lv-' + k, w:(lvCount[k] / rowsAll.length * 100).toFixed(1) + '%' }));
      const sorters = { weak:(a, b) => a.recallN - b.recallN, due:(a, b) => a.dueN - b.dueN, strong:(a, b) => b.m - a.m };
      const qWords = S.wq.trim().toLowerCase();
      const qPlain = toneless(qWords);
      const matchRow = (r) => !qWords || r.zh.indexOf(qWords) >= 0 || r.en.toLowerCase().indexOf(qWords) >= 0 || (qPlain.length > 0 && toneless(r.py).indexOf(qPlain) >= 0);
      // exact matches (the character itself, or the whole English gloss) come first, then the chosen sort order
      const matchRank = (r) => (!qWords ? 0 : (r.zh === qWords || r.en.toLowerCase() === qWords || r.en.toLowerCase().split(/[,;(]\s*/)[0].trim() === qWords ? 0 : 1));
      const rowsFiltered = rowsAll.filter(r => (S.wfilter === 'all' || r.lv === S.wfilter) && matchRow(r)).sort((a, b) => matchRank(a) - matchRank(b) || sorters[S.wsort](a, b));
      const rowsShown = rowsFiltered.slice(0, S.wshow);
      const moreCount = rowsFiltered.length - rowsShown.length;
      const sortOpts = [['weak', 'Weakest first'], ['due', 'Due soonest'], ['strong', 'Strongest first']].map(x => ({ label:x[1], cls:S.wsort === x[0] ? 'on' : '', fn:() => this.setState({ wsort:x[0] }) }));
      const timeOpts = [[0, 'Today'], [7, 'In 1 week'], [30, 'In 1 month']].map(x => ({ label:x[1], cls:S.woff === x[0] ? 'on' : '', fn:() => this.setState({ woff:x[0] }) }));

      // grammar
      const lessonList = LESSONS.map((l, i) => { const best = S.gres[l.id]; const passed = (best || 0) >= 80; return { n:i + 1, title:l.title, cls:(i === S.glesson ? 'cur ' : '') + (passed ? 'done' : ''), tag:best === undefined ? '' : (passed ? best + '%' : best + '%'), fn:() => this.pickLesson(i) }; });
      const L = LESSONS[S.glesson];
      const lessonBest = S.gres[L.id];
      const lesson = {
        kick:'Lesson ' + (S.glesson + 1) + ' of ' + LESSONS.length, title:L.title,
        formula:L.formula.map(f => ({ t:f.t, cls:(f.k ? 'k ' : '') + (f.z ? 'zh' : ''), sep:f.sep, hasSep:f.sep !== '' })),
        explain:L.explain.map(t => ({ t })), hasMistakes:L.mistakes.length > 0, mistakes:L.mistakes.map(t => ({ t })),
        examples:L.examples.map((e, i) => ({ zh:e.zh, py:e.py, en:e.en, pc:pc('g' + i), play:() => this.say(e.zh, 'g' + i), reportUrl:report('Grammar lesson: ' + L.title, e.zh + ' (' + e.py + ') ' + e.en) })),
        count:L.q.length + ' exercises · about ' + Math.max(2, Math.round(L.q.length * 0.7)) + ' minutes',
        covers:'Official grammar outline points: ' + L.covers.join(', '),
        reportUrl:report('Grammar lesson: ' + L.title, 'the explanation or examples'),
        best:lessonBest === undefined ? 'Not tried yet' : (lessonBest >= 80 ? 'Passed with ' + lessonBest + '%' : 'Best so far: ' + lessonBest + '% (80% to pass)'),
        hasPrev:S.glesson > 0, hasNext:S.glesson < LESSONS.length - 1, prev:() => this.pickLesson(S.glesson - 1), next:() => this.pickLesson(S.glesson + 1)
      };

      // shadowing
      const shClip = CLIPS[S.dclip];
      const shDone = S.shround >= 3;
      const shHelps = ['Read along and say it right after you hear it.', 'Same again, with characters only.', 'Now with no text. Say it from what you hear.', 'All three rounds done. Try the same clip again tomorrow.'];

      // listening lab
      const clip = CLIPS[S.dclip];
      const wordsView = clip.words.map((w, i) => ({ py:S.dreveal >= 1 ? w.py : '', zh:S.dreveal >= 2 ? w.zh : '·', cls:S.dchecked ? (S.dmarks[i] ? 'ok' : 'miss') : '' }));
      const hits = S.dmarks.filter(m => m).length;
      const missed = clip.words.filter((w, i) => S.dchecked && !S.dmarks[i]);
      const typedOk = S.dtyped.replace(/[^a-zA-Z]/g, '').length > 0;
      const rateOpts = [0.6, 0.8, 1, 1.2].map(r => ({ label:r + '×', cls:S.drate === r ? 'on' : '', fn:() => this.setState({ drate:r }) }));
      const toneOpts = TONES.map((t, i) => ({
        py:t.py, label:t.label,
        cls:S.tpick === null ? '' : (i === S.tidx ? 'right' : (i === S.tpick ? 'wrong' : '')),
        fn:() => this.pickTone(i)
      }));
      const weak = Object.keys(S.misses).filter(zh => BANK[zh]).map(zh => ({ zh, n:S.misses[zh] })).sort((a, b) => b.n - a.n).slice(0, 3)
        .map(x => ({ t:x.zh + ' ' + (CLIP_PY[x.zh] || ''), d:'Missed ' + x.n + (x.n === 1 ? ' time' : ' times') + ' in dictation' }));
      const phrases = PHRASES.map((p, i) => ({ zh:p.zh, py:p.py, en:p.en, pc:pc('ph' + i), play:() => this.say(p.zh, 'ph' + i) }));

      const lowest = skills.reduce((a, b) => (parseInt(b.w, 10) < parseInt(a.w, 10) ? b : a));
      const gapLine = lowest.label + ' is your lowest at ' + lowest.w + '. Get it to 80% to unlock the exam.';
      const examParts = [
        { glyph:'听', name:'Listening', detail:'20 questions · about 15 min', note:'Each clip plays twice.', state:'Planned' },
        { glyph:'读', name:'Reading', detail:'20 questions · about 15 min', note:'Short texts and signs, characters only.', state:'Planned' },
        { glyph:'语', name:'Grammar', detail:'15 questions · about 10 min', note:'Build sentences, fix mistakes, fill gaps.', state:'Planned' },
        { glyph:'说', name:'Speaking', detail:'4 prompts · about 6 min', note:'You speak, then review the words that were flagged.', state:'Planned' }
      ];

      return {
        focusCls:(S.exm && (S.exm.stage === 'run' || S.exm.stage === 'break') && S.screen === 'exam') || (S.screen === 'quiz' && !S.qdone) ? 'focus' : '',
        themeCls:dark ? 't-dark' : 't-light', themeLabel:dark ? 'Switch to light' : 'Switch to dark', toggleTheme:this.toggleTheme,
        noVoice:S.noVoice, week,
        gapLine, examParts, navExam:navCls('exam'), goExam:() => this.go('exam'), isExam:S.screen === 'exam',

        // word webs and word memory
        navWeb:navCls('web'), goWeb:() => this.go('web'), isWeb:S.screen === 'web',
        navWords:navCls('words'), goWords:() => this.go('words'), isWords:S.screen === 'words',
        isWChar:S.wmode === 'char', isWOpp:S.wmode === 'opp', isWTopic:S.wmode === 'topic',
        wCharCls:S.wmode === 'char' ? 'on' : '', wOppCls:S.wmode === 'opp' ? 'on' : '', wTopicCls:S.wmode === 'topic' ? 'on' : '',
        setWChar:() => this.setState({ wmode:'char' }), setWOpp:() => this.setState({ wmode:'opp' }), setWTopic:() => this.setState({ wmode:'topic' }),
        quizOffCls:S.wquiz ? '' : 'on', quizOnCls:S.wquiz ? 'on' : '',
        setQuizOff:() => this.setState({ wquiz:false }), setQuizOn:() => this.setState({ wquiz:true }),
        webCountText:limitOf(S) === Infinity ? webCount + ' new words today' : webCount + ' of ' + S.nlimit + ' new words today', capNote:capReached, capCount:S.nlimit, capOpts,
        hubHasNew:hubNew > 0 && !capReached, hubAddAllText:'Add all ' + hubNew + ' new word' + (hubNew === 1 ? '' : 's'), hubAddAll:() => this.learnMany(hubNow.words.map(w => w.zh)),
        topicHasNew:topicNew > 0 && !capReached, topicAddAllText:'Add all ' + topicNew + ' new word' + (topicNew === 1 ? '' : 's'), topicAddAll:() => this.learnMany(topicNow.words),
        moreDue:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft > 0, hasMoreDue:dueLeft > 0, reviewMore:this.reviewMore,
        moreDueText:'Review ' + Math.min(REVIEW_CHUNK, dueLeft) + ' more', dueLeftText:dueLeft + ' word' + (dueLeft === 1 ? ' is' : 's are') + ' still due.', topicProgress:topicStarted + ' of ' + topicNow.words.length + ' started',
        hubCards, hubOpts, hubZh:hubNow.hub, hubPy:hubNow.py, hubEn:hubNow.en,
        fillEn:gapNow.en, fillZh:gapNow.zh, gapOpts, gapDone, gapOptsCls:gapDone ? 'locked' : '', fillLine, gapNext:this.gapNext,
        fillReport:report('Which word fits?', gapNow.zh + ' = ' + gapNow.ans + ' / ' + gapNow.en),
        oppRows, topicChips, topicOpts, tsZh:topicNow.sentence.zh, tsPy:topicNow.sentence.py, tsEn:topicNow.sentence.en,
        tsReport:report('Topic sentence', topicNow.sentence.zh + ' ' + topicNow.sentence.en),
        topicCta:topicNow.cta, goTopic:() => this.go(topicNow.to),
        hasRlast:!!S.rlast, rlastText:S.rlast ? S.rlast.zh + ': mastery ' + S.rlast.from + '% → ' + S.rlast.to + '%' : '', rlastCls:S.rlast && S.rlast.to < S.rlast.from ? 'down' : 'up',
        bankCount:rowsAll.length, filters, levelSegs, sortOpts, timeOpts, rows:rowsShown, hasMoreWords:moreCount > 0, moreWordsText:'Show 40 more (' + moreCount + ' left)', showMoreWords:() => this.setState({ wshow:S.wshow + 40 }),
        wq:S.wq, onWSearch:(e) => this.setState({ wq:e.target.value, wshow:40 }), noRows:rowsShown.length === 0,

        // shadowing
        isShadow:S.lmode === 'shadow', lShadowCls:S.lmode === 'shadow' ? 'on' : '', setShadow:() => this.setState({ lmode:'shadow' }),
        shNow:Math.min(S.shround + 1, 3), shTitle:'Clip ' + (S.dclip + 1) + ' of ' + CLIPS.length, shHelp:shHelps[S.shround],
        shZh:shClip.zh, shPy:shClip.py,
        shShowZh:S.shround < 2 || shDone, shShowPy:S.shround === 0 || shDone, shHidden:S.shround === 2,
        shCanGo:!shDone, shDone, shGoLabel:'I said it',
        shadowGo:this.shadowGo, shadowNext:this.shadowNext,

        // listening lab
        navListen:navCls('listen'), goListen:() => this.go('listen'), isListen:S.screen === 'listen',
        isDict:S.lmode === 'dict', isTone:S.lmode === 'tone',
        lDictCls:S.lmode === 'dict' ? 'on' : '', lToneCls:S.lmode === 'tone' ? 'on' : '',
        setDict:() => this.setState({ lmode:'dict' }), setTone:() => this.setState({ lmode:'tone' }),
        stepText:S.dchecked ? 'Step 3 of 3 · Read it, then listen again' : (S.dplays === 0 ? 'Step 1 of 3 · Listen without help' : 'Step 2 of 3 · Type what you heard'),
        clipNo:S.dclip + 1, clipTotal:CLIPS.length, playedText:S.dplays === 0 ? 'Not played yet.' : 'Played ' + S.dplays + (S.dplays === 1 ? ' time.' : ' times.'),
        rateHint:S.drate < 1 ? 'Slow clip, good for catching every sound.' : (S.drate === 1 ? 'Normal speed.' : 'Faster than a textbook.'),
        rateOpts, playClip:this.playClip, clipPlayCls:pc('clip'),
        dtyped:S.dtyped, dInpCls:S.dchecked ? 'locked' : '',
        onDType:(e) => { if (!this.state.dchecked) this.setState({ dtyped:e.target.value }); },
        onDEnter:(e) => { if (e.key === 'Enter') { if (this.state.dchecked) this.nextClip(); else this.checkDict(); } },
        showWords:S.dreveal >= 1, wordsView, canPeek:S.dreveal < 2 && !S.dchecked,
        peekLabel:S.dreveal === 0 ? 'Peek at the pinyin' : 'Peek at the characters',
        peek:() => this.setState({ dreveal:Math.min(2, this.state.dreveal + 1) }),
        dNotChecked:!S.dchecked, dchecked:S.dchecked, dCheckCls:typedOk ? '' : 'dis', dCheckAria:typedOk ? 'false' : 'true',
        checkDict:this.checkDict, nextClip:this.nextClip,
        dSummary:hits + ' of ' + clip.words.length + ' words', clipEn:clip.en, notes:clip.notes.map(t => ({ t })),
        clipReport:report('Listening clip ' + (S.dclip + 1), clip.zh + ' / ' + clip.en + ' / ' + clip.notes.join(' | ')),
        clearPlay:() => this.say(clip.zh, 'clear', 0.7), naturalPlay:() => this.say(clip.zh, 'nat', 1.25),
        clearCls:pc('clear') ? 'ink' : '', natCls:pc('nat') ? 'ink' : '',
        hasMissed:missed.length > 0, missedList:missed.map(w => w.py + ' ' + w.zh).join(', '),
        toneOpts, playTone:this.playTone, tonePlayCls:pc('tone'),
        toneIdle:S.tidx === null, toneAnswered:S.tpick !== null,
        toneLine:S.tpick === null ? '' : (S.tpick === S.tidx ? 'Right. ' : 'Not quite. ') + 'That was ' + TONES[S.tidx].py + ': ' + TONES[S.tidx].label.toLowerCase() + '.',
        hasToneStats:S.ttotal > 0, toneStats:S.tright + ' of ' + S.ttotal + ' right',
        weak, hasWeak:weak.length > 0, noWeak:weak.length === 0, phrases,
        overall, streak:streakShown, streakText:streakShown + (streakShown === 1 ? ' day' : ' days'), xpText:S.xp.toLocaleString('en-US'), dayXp:S.dayXp,
        title:tt[0], subtitle:tt[1],
        navHome:navCls('home'), navReview:navCls('review'), navTest:navCls('testlobby'), navGrammar:navCls('grammar'), navSpeak:navCls('speak'),
        goHome:() => this.go('home'), goReview:() => this.go('review'), goTest:() => this.go('testlobby'), goGrammar:() => this.go('grammar'), goSpeak:() => this.go('speak'),
        hasDue:S.rq.length > 0 && !S.rcomplete, dueCount:S.rq.length,
        isHome:S.screen === 'home', isVoice:S.screen === 'voice', isReview:S.screen === 'review', isLobby:S.screen === 'testlobby', isGrammar:S.screen === 'grammar', isSpeak:S.screen === 'speak', isQuiz:S.screen === 'quiz',

        // home
        ringDash, todayLine:titles.home[1], tasks, minOpts, planNote, dayMin:S.dayMin, mins:S.mins, skills, wordTarget:bankKeys.length, wmTotal:startedCount, wm,
        wMastered:(wm.mastered / bankKeys.length * 100).toFixed(1) + '%', wFamiliar:(wm.familiar / bankKeys.length * 100).toFixed(1) + '%', wLearning:(wm.learning / bankKeys.length * 100).toFixed(1) + '%',
        stairs, sysNote:sd.note,
        sys2Cls:S.sys === '2.0' ? 'on' : '', sys3Cls:S.sys === '3.0' ? 'on' : '',
        setSys2:() => this.setState({ sys:'2.0' }), setSys3:() => this.setState({ sys:'3.0' }),

        // review
        inReview:!S.rcomplete && S.rq.length > 0, rcomplete:S.rcomplete, rdone:S.rdone, rtotal:S.rtotal, rxp:S.rxp, rcounts:S.rcounts,
        rPct:(S.rtotal ? Math.round(S.rdone / S.rtotal * 100) : 0) + '%',
        emptyNew:!S.rcomplete && S.rq.length === 0 && startedCount === 0,
        caughtUp:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft === 0, nextDueText, practiceAnyway:this.practiceAnyway,
        card, flip:this.flip, rflip:S.rflip, flipCls:S.rflip ? 'flip' : '', flipLabel:S.rflip ? 'Flip the card back' : 'Show the answer',
        cardAnim:S.rstep % 2 === 0 ? 'ea' : 'eb', showAnswerBtn:!S.rflip, rates,
        playWord:() => this.say(rw.zh, 'word'), playWordCls:pc('word') ? 'ink' : '',
        playEx:() => this.say(rex.zh, 'ex'), playExCls:pc('ex') ? 'ink' : '',

        // lobby
        startTest:() => this.startQuiz('test'), testReady, testBlocked:!testReady,
        testInfo:(Math.min(10, Math.max(5, BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0)).length))) + ' questions · about 4 minutes',
        recent:S.testHistory.map((r, i, a) => ({ date:r.date, score:r.score, h:Math.round(r.score * 1.4) + 'px', cls:i === a.length - 1 ? 'last' : '' })),
        hasRecent:S.testHistory.length > 0, noRecent:S.testHistory.length === 0,

        // grammar
        lessonList, lesson,
        startGrammar:() => this.startQuiz('grammar'),

        // speak
        msgs, typing:false, canTalk, sdone:S.sdone, target, goals, wchips, scenarios, chatGlyph:sc.glyph, chatTitle:sc.title, chatSub:sc.sub, turnsText:turns + ' turns',
        shint:S.shint, noHint:!S.shint, toggleHint:() => this.setState({ shint:!this.state.shint }),
        zhCls:S.szh ? 'on' : '', pyCls:S.spy ? 'on' : '', enCls:S.sen ? 'on' : '', listenOnly:!S.szh && !S.spy && !S.sen,
        toggleZh:() => this.setState({ szh:!this.state.szh }), listenOnlyNow:() => this.setState({ szh:false, spy:false, sen:false }),
        togglePy:() => this.setState({ spy:!this.state.spy }), toggleEn:() => this.setState({ sen:!this.state.sen }),
        sayIt:this.sayIt, resetSpeak:this.resetSpeak,

        // quiz
        inQuestions:!S.qdone, qdone:S.qdone, q, segs, opts, optsCls:S.qchecked ? 'locked' : '', pickedTiles, noPicked:S.qpicked.length === 0, bankTiles, spotTokens,
        qAnim:S.qi % 2 === 0 ? 'qa' : 'qb', qtyped:S.qtyped, inpCls:S.qchecked ? (S.qcorrect ? 'locked right' : 'locked wrong') : '',
        onType:(e) => { if (!this.state.qchecked) this.setState({ qtyped:e.target.value }); },
        onEnter:(e) => { if (e.key === 'Enter') this.primary(); },
        playQ:() => this.say(q0.audio || '', 'q'), listenCls:pc('q'),
        showCheck:!S.qchecked, checkCls:canCheck ? '' : 'dis', checkAria:canCheck ? 'false' : 'true', check:this.check,
        qchecked:S.qchecked, qcorrect:S.qcorrect, qwrong:!S.qcorrect, fbCls:S.qcorrect ? 'good' : 'bad',
        fbTitle:S.qcorrect ? 'Correct, +' + S.qgain + ' XP' : 'Not quite',
        next:this.next, nextLabel:S.qi + 1 >= total ? 'See results' : 'Continue',
        qcombo:S.qcombo, comboCls:S.qcombo >= 2 ? 'on' : '', exitQuiz:this.exitQuiz,
        resTitle, resSub, resScore:S.qscore + '/' + total, qbest:S.qbest, qxp:S.qxp, resGain,
        again:() => this.startQuiz(S.qmode),

        // footer
        exportData:this.exportData, importData:this.importData, resetAll:this.resetAll, goVoice:this.goVoice,
        ...this.voiceVals(),
        ...this.examVals(),
        ...this.aiVals(),
        syncOn:S.syncOn, syncOff:!S.syncOn, syncBusy:S.syncBusy, syncMsg:S.syncMsg, hasSyncMsg:!!S.syncMsg, syncMsgCls:S.syncBad ? 'bad' : 'good',
        syncInput:S.syncInput, onSyncInput:(e) => this.setState({ syncInput:e.target.value }), syncConnect:this.syncConnect, syncNow:() => this.syncNow(true), syncDisconnect:this.syncDisconnect,
        syncAtText:S.syncAt ? 'Last synced ' + new Date(S.syncAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) + '.' : 'Not synced yet.',
        syncTokenUrl:'https://github.com/settings/tokens/new?scopes=gist&description=Shanlu%20progress',
        erhuaOn:ERHUA_ON, erhuaOff:!ERHUA_ON, erhuaAvailable:!!ERHUA, toggleErhua:this.toggleErhua,
        erhuaNow:ERHUA_ON ? 'Now: 儿 endings are on (exam style).' : 'Now: plain forms, no 儿 endings.',
        erhuaBtn:ERHUA_ON ? 'Switch to plain forms' : 'Switch to 儿 endings',
        repoUrl:'https://github.com/' + REPO
      };
    }
  }

  const root = document.getElementById('app');
  const tpl = document.getElementById('app-template');
  const app = DCMount(root, tpl, Component);
  window.shanlu = app;

  // keyboard: Space flips a review card, 1-4 rate it; in the exam, arrows move and A-F or 1-6 choose
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const S = app.state;
    if (S.screen === 'review' && S.rq.length && !S.rcomplete) {
      if ((e.key === ' ' || e.key === 'Enter') && !S.rflip) { e.preventDefault(); app.flip(); }
      else if (S.rflip && '1234'.indexOf(e.key) >= 0 && e.key) { app.rate(['again', 'hard', 'good', 'easy'][Number(e.key) - 1]); }
    } else if (S.screen === 'exam' && S.exm && S.exm.stage === 'run') {
      const m = S.exm;
      if (e.key === 'ArrowRight') { e.preventDefault(); app.exGo(m.i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); app.exGo(m.i - 1); }
      else {
        const q = m.qs[m.i]; const k = /^[a-fA-F]$/.test(e.key) ? 'abcdef'.indexOf(e.key.toLowerCase()) : (/^[1-6]$/.test(e.key) ? Number(e.key) - 1 : -1);
        if (k >= 0 && k < q.opts.length) app.exPick(q.opts[k].v);
      }
    }
  });
  window.addEventListener('pagehide', () => app.persistNow());
  if (SYNCCFG.token) setTimeout(() => app.syncNow(false), 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.persistNow(); else { app._schedule(); if (SYNCCFG.token) app.syncNow(false); } });
  const fileInput = document.getElementById('import-file');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { app.importText(String(reader.result)); fileInput.value = ''; };
      reader.readAsText(f);
    });
  }
  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { app.setState({ vtick:app.state.vtick + 1 }); }; } catch (e) {}
})();
