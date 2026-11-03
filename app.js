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
  // Alibaba Cloud Model Studio (Qwen), International edition (Singapore). Config: { provider, key, model, asr, ali:{ key, ws, model } }
  const ALI_MODELS = [['qwen-flash', 'qwen-flash: fastest and cheapest'], ['qwen-plus', 'qwen-plus: smarter, costs more']];
  const ALI_ASR_MODEL = 'qwen3-asr-flash';
  const aliCfg = () => AICFG.ali || {};
  const aiProviderNow = () => (AICFG.provider === 'alibaba' && aliCfg().key ? 'alibaba' : 'anthropic');
  const aiReadyNow = () => (aiProviderNow() === 'alibaba' ? !!aliCfg().key : !!AICFG.key);
  const asrModeNow = () => (AICFG.asr === 'alibaba' && aliCfg().key ? 'alibaba' : 'browser');
  const aliBase = () => { const ws = String(aliCfg().ws || '').trim(); return ws ? 'https://' + ws + '.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1' : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'; };
  // Qwen text-to-speech (Alibaba Model Studio, Singapore): the voice that reads Mingming's lines when an Alibaba key is saved
  const ALI_TTS_MODEL = 'qwen3-tts-flash';
  const TTS_VOICES = [['Cherry', 'Cherry: woman, friendly'], ['Serena', 'Serena: woman, gentle'], ['Maia', 'Maia: woman, warm'], ['Neil', 'Neil: man, clear news-reader style'], ['Kai', 'Kai: man, calm']];
  const ttsModeNow = () => (aliCfg().key && AICFG.ttsMode !== 'browser' ? 'qwen' : 'browser');
  const ttsVoiceNow = () => (TTS_VOICES.some(v => v[0] === AICFG.ttsVoice) ? AICFG.ttsVoice : 'Cherry');
  const aliApi = () => aliBase().replace('/compatible-mode/v1', '/api/v1');
  const SYNC_STORE = 'shanlu-sync';   // { token, gist, at } lives only on this device, never in the exported progress file
  let SYNCCFG = {};
  try { SYNCCFG = JSON.parse(localStorage.getItem(SYNC_STORE)) || {}; } catch (e) {}
  const saveSyncCfg = () => { try { localStorage.setItem(SYNC_STORE, JSON.stringify(SYNCCFG)); } catch (e) {} };
  const ERHUA_KEY = 'shanlu-erhua';
  let ERHUA_ON = false;
  try { ERHUA_ON = localStorage.getItem(ERHUA_KEY) === 'on'; } catch (e) {}
  const ERHUA = window.ShanluErhua && window.HSK1_ERHUA ? window.ShanluErhua.make(window.HSK1_ERHUA) : null;
  if (ERHUA && !ERHUA_ON) ERHUA.apply(window);

  // Which level this page shows. level.js sets it (saved in this browser; switching reloads the page). Each level keeps its own progress.
  const LV = window.SHANLU_LEVEL == null ? 1 : window.SHANLU_LEVEL;   // 0 means "All levels": every unlocked level together
  const ALL = LV === 0;
  const LVLS = ALL ? (window.SHANLU_LEVELS || [1]) : [LV];            // the levels whose content is shown
  const TOPL = Math.max.apply(null, LVLS);                             // the highest of them
  const LVN = ALL ? 'All levels' : 'HSK ' + LV;
  const LVL = window.ShanluLevel || { MAX_LEVEL:LV, PASS_PCT:80, passedEntry:() => false, levelPassed:() => false, markPassed() {}, unlocked:() => true };
  const LV_DATA = (name) => window['HSK' + LV + '_' + name];
  // In "All levels" the content of every unlocked level is joined (HSK 1 first). Words are different in every level, so nothing is shared or duplicated.
  const LV_ALL = (name) => LVLS.map(n => window['HSK' + n + '_' + name]).filter(Boolean);
  const JOIN = (name, key) => [].concat.apply([], LV_ALL(name).map(d => d[key] || []));
  const WORDS = ALL ? [].concat.apply([], LV_ALL('WORDS')) : LV_DATA('WORDS');
  // which level each word belongs to, for the small tag in All levels (the highest level is "current", the others "old")
  const LEVEL_OF = {};
  if (ALL) LVLS.forEach(n => (window['HSK' + n + '_WORDS'] || []).forEach(w => { LEVEL_OF[w.zh] = n; }));
  const lvInfo = (zh) => (ALL && LEVEL_OF[zh] ? { hasLvTag:true, lvTag:'HSK ' + LEVEL_OF[zh], lvCls:(LEVEL_OF[zh] === TOPL ? 'cur' : 'old') + ' l' + LEVEL_OF[zh] } : { hasLvTag:false, lvTag:'', lvCls:'' });
  // Topics are shared by every level (content/topics.json): a topic has the same name at each level and holds that level's words.
  // In All levels the topics of the same name are joined (their words one after the other, HSK 1 first) and kept in the shared order.
  const mergeTopics = (lists) => {
    const byName = {};
    lists.forEach(list => list.forEach(t => {
      const host = byName[t.name];
      if (host) { t.words.forEach(z => { if (host.words.indexOf(z) < 0) host.words.push(z); }); host.sentence = t.sentence; host.to = t.to; host.cta = t.cta; }
      else byName[t.name] = Object.assign({}, t, { words:t.words.slice() });
    }));
    return Object.keys(byName).map(k => byName[k]).sort((x, y) => x.order - y.order);
  };
  // Lessons are grouped by what they help you say (content/categories-grammar.json): sorted by category, then by level, then by lesson order.
  const LESSON_LV = {};
  LVLS.forEach(n => ((window['HSK' + n + '_GRAMMAR'] || {}).lessons || []).forEach(l => { LESSON_LV[l.id] = n; }));
  const LESSONS = (ALL ? JOIN('GRAMMAR', 'lessons') : LV_DATA('GRAMMAR').lessons).map((l, i) => ({ l, i })).sort((a, b) => ((a.l.catOrder || 0) - (b.l.catOrder || 0)) || (a.i - b.i)).map(x => x.l);
  const { hubs:HUBS, opps:OPPS, topics:TOPICS } = ALL ? { hubs:JOIN('WEBS', 'hubs'), opps:JOIN('WEBS', 'opps'), topics:mergeTopics(LV_ALL('WEBS').map(d => d.topics || [])) } : LV_DATA('WEBS');
  // Listening lab and practice scripts: a level without them (none yet for HSK 3) has those parts switched off.
  const { clips:CLIPS, tones:TONES, pairs:PAIR_DATA } = Object.assign({ clips:[], tones:[], pairs:[] }, (ALL ? { clips:JOIN('LISTEN', 'clips'), tones:(LV_ALL('LISTEN')[0] || {}).tones, pairs:JOIN('LISTEN', 'pairs') } : LV_DATA('LISTEN')) || {});
  // two-syllable words for the tone-pair trainer; the pair [3, 3] is said as 2 + 3 (the first of two third tones rises)
  const PAIR_LIST = () => PAIR_DATA.filter(p => BANK[p.zh]);
  const pairHit = (t, slot, n) => n === t[slot - 1] || (slot === 1 && t[0] === 3 && t[1] === 3 && n === 2);
  const { scenarios:SCEN, phrases:PHRASES } = (ALL ? { scenarios:JOIN('SPEAK', 'scenarios'), phrases:JOIN('SPEAK', 'phrases') } : LV_DATA('SPEAK')) || { scenarios:[], phrases:[] };
  const HAS_LISTEN = CLIPS.length > 0;
  // the level each clip belongs to; in All levels the highest level is "current"
  const CLIP_LV = [];
  LVLS.forEach(n => ((window['HSK' + n + '_LISTEN'] || {}).clips || []).forEach(() => CLIP_LV.push(n)));
  // A random clip. Clips of the current level are 5 times as likely as older levels' clips; clips you have not tried or got wrong come up more
  // often than ones you already caught completely; the last few clips are not repeated.
  const pickClip = (best, recent) => {
    const n = CLIPS.length;
    if (n <= 1) return 0;
    const skip = (recent || []).slice(-Math.min(6, n - 1));
    let total = 0;
    const w = CLIPS.map((_, i) => {
      if (skip.indexOf(i) >= 0) return 0;
      const b = (best && best[i]) || 0;
      const need = b >= 0.99 ? 0.35 : (b > 0 ? 1.3 - 0.6 * b : 1.5);
      const x = (CLIP_LV[i] === TOPL ? 5 : 1) * need;
      total += x; return x;
    });
    let r = Math.random() * total;
    for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return i; }
    return 0;
  };
  const HAS_SCRIPTS = SCEN.length > 0;
  // Talk-with-AI role-play settings are the practice scripts' scenarios (title, sub and goals); a level without scripts has free chat only
  const AISCN = SCEN;
  // stand-ins so the screens that are switched off still render without errors
  const NO_SC = { id:'', glyph:'', title:'', sub:'', goals:[], words:[], ai:[{ zh:'', py:'', en:'' }], you:[{ zh:'', py:'', en:'' }] };
  const NO_CLIP = { zh:'', py:'', en:'', words:[], notes:[] };
  const REPO = 'alvinyu20/hsk-path';
  // Progress is kept per level. "All levels" has a key of its own for the daily numbers (XP, streak, today's list), but the words, grammar,
  // speaking and listening progress (SPLIT) is read from and written back to each level's own save, so every view shows the same progress.
  const storeKey = (n) => (n === 1 ? 'shanlu-progress-v1' : 'shanlu-progress-v1-l' + n);
  const KEY = ALL ? 'shanlu-progress-v1-all' : storeKey(LV);
  const SPLIT = ['ws', 'misses', 'gres', 'sres', 'clipBest'];
  const LESSON_ALIAS = { 2:{ modal:'modal2' } };   // an HSK 2 lesson id that used to clash with an HSK 1 id

  const SYS = {
    '2.0': { levels:[['1', '150'], ['2', '300'], ['3', '600'], ['4', '1,200'], ['5', '2,500'], ['6', '5,000']], note:'Six separate level exams. Word totals are cumulative.' },
    '3.0': { levels:[['1', '300'], ['2', '500'], ['3', '1,000'], ['4', '2,000'], ['5', '3,600'], ['6', '5,400'], ['7', ''], ['8', ''], ['9', '']], note:'Three stages: elementary (1–3), intermediate (4–6), advanced (7–9). Levels 7–9 are tested in one exam and scored as 7, 8 or 9. Word totals are cumulative.' }
  };

  // ---------- word memory model (simplified FSRS-style) ----------
  const LIMIT_OPTIONS = [5, 10, 20, 0];            // 0 = no limit (the default)
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
    // A word is due when a skill that Review practises (see, prod) is due. "hear" is only refreshed by listening-test questions, so it must not
    // keep a word due after you have reviewed it; it counts only for a word that has no see/prod timer yet.
    const dueDims = started.filter(k => k !== 'hear');
    const dueFrom = dueDims.length ? dueDims : started;
    const dueN = started.length ? Math.min.apply(null, dueFrom.map(k => w[k].s - lOf(w[k]) - off)) : 9999;
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

  // Review queue: every word that is due, with no cap. The weakest words tend to come first, but the order is jumbled (a random nudge
  // on each word's recall) so words that were learned together do not come back in list order. "anyway" is every started word.
  const buildQueue = (ws, anyway) => {
    const rows = Object.keys(ws).map(zh => ({ zh, info:winfo(ws[zh], 0) })).filter(r => r.info.started);
    rows.forEach(r => { r.key = r.info.recallN + Math.random() * 30; });
    rows.sort((a, b) => a.key - b.key);
    return (anyway ? rows : rows.filter(r => r.info.dueN <= 0)).map(r => r.zh);
  };

  // "Words in memory": every started word counts by its chance of being recalled right now, so the number rises when you learn and review
  // and falls when reviews slide. (XP points are still counted inside, only to keep the streak, but they are no longer shown.)
  const memOf = (ws) => { let sum = 0, n = 0; Object.keys(ws).forEach(z => { const i = winfo(ws[z], 0); if (i.started) { sum += i.recallN / 100; n++; } }); return { words:Math.round(sum), n, avg:n ? Math.round(100 * sum / n) : 0 }; };

  // ---------- friends board (optional; stays hidden until config.js has the server address) ----------
  const FR = window.ShanluFriends ? window.ShanluFriends.make() : null;
  const FR_PUSH_KEY = 'shanlu-friends-push';
  // a random name for this browser, so minutes studied on two devices can be added up instead of one replacing the other
  const DEVICE = (() => { try { let d = localStorage.getItem('shanlu-device'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('shanlu-device', d); } return d; } catch (e) { return 'x'; } })();
  // The totals shared with friends, read from every saved progress (each level and All levels), so the numbers do not depend on which view you were in.
  const collectFriendStats = () => {
    const keys = Object.keys(LVL.PROGRESS_KEYS || {}).map(n => ({ n:Number(n), key:LVL.PROGRESS_KEYS[n] })).concat([{ n:0, key:'shanlu-progress-v1-all' }]);
    const stores = keys.map(k => { let st = null; try { st = JSON.parse(localStorage.getItem(k.key)); } catch (e) {} return st && typeof st === 'object' ? Object.assign({ __n:k.n }, st) : null; }).filter(Boolean);
    const dayMin = (d) => stores.reduce((a, st) => a + (window.ShanluSync.dayMinutes(st, d) || (st.day === d ? (st.dayMin || 0) : 0)), 0);
    const last7 = [6, 5, 4, 3, 2, 1, 0].map(n => Math.max(0, Math.min(1440, Math.round(dayMin(daysAgo(n))))));
    const active = {};
    stores.forEach(st => Object.keys(st.activity || {}).forEach(d => { active[d] = true; }));
    last7.forEach((m, i) => { if (m > 0) active[daysAgo(6 - i)] = true; });
    const today = ymd(new Date());
    let lastActive = '';
    for (let n = 0; n < 100 && !lastActive; n++) if (active[daysAgo(n)]) lastActive = daysAgo(n);
    let streak = 0;
    if (lastActive === today || lastActive === daysAgo(1)) for (let n = lastActive === today ? 0 : 1; active[daysAgo(n)]; n++) streak++;
    stores.forEach(st => { if ((st.lastActive === today || st.lastActive === daysAgo(1)) && (st.streak || 0) > streak) streak = st.streak; });
    let mem = 0;
    stores.filter(st => st.__n > 0 && st.ws).forEach(st => { try { mem += memOf(st.ws).words; } catch (e) {} });
    const levels = LVL.unlockedLevels ? LVL.unlockedLevels() : [LV];
    return { asOf:today, last7, streak:Math.min(streak, 9999), lastActive, mem, levels, passed:levels.filter(n => LVL.levelPassed(n)) };
  };

  // ---------- dates, saving, daily reset ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

  const PERSIST = ['sys', 'mins', 'theme', 'xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'sres', 'nlimit', 'voiceId', 'speed', 'ascView', 'clipBest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'rlast', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'wdelta', 'wreveal', 'spy', 'sen', 'shint', 'szh', 'exams', 'aiDays', 'rpy', 'mem0', 'minLog', 'minDev'];

  function freshState() {
    let dark = false;
    try { dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    return {
      screen:'home', lvMsg:window.SHANLU_LOCKED || 0, sys:'3.0', mins:20, theme:dark ? 'dark' : 'light',
      fr:null, frAt:0, frBusy:false, frErr:'', frMsg:'', frSort:'week', frName:'', frCode:'', frLeaveAsk:false, frCopied:false,
      xp:0, dayXp:0, dayMin:0, mem0:null, minLog:{}, minDev:{}, streak:0, lastActive:'', activity:{}, day:'',
      gres:{}, sres:{}, nlimit:0, voiceId:'', speed:1, ascView:'trail', webCapOpen:false, gramPick:false, vtick:0, vall:false, glesson:0, ggopen:null, gq:'', sidx:0, wq:'', wshow:40, clipBest:CLIPS.map(() => 0), misses:{}, testHistory:[],
      ws:blankWs(),
      rq:[], rtotal:0, rflip:false, rpy:false, rdone:0, rstep:0, rxp:0, rcomplete:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null,
      qmode:'test', qi:0, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false,
      gdone:false, tdone:false, ldone:false, spokeToday:false, webCredited:false,
      sturn:0, szh:true, spy:true, sen:true, shint:true, sdone:false,
      woff:0, wsort:'weak', wfilter:'all', wdelta:{}, wrated:{}, gfq:0, gfpick:null, shround:0, shbusy:false,
      wmode:'topic', wmist:false, wtmenu:false, wgopen:null, wtq:'', whub:0, wtopic:0, wquiz:false, wlearned:{}, wreveal:{}, wex:{}, wexn:{}, exams:[], exm:null, aiDays:{}, aiVoiceOnly:AICFG.voiceOnly !== false, aiTyping:false, ttsMode:ttsModeNow(), ttsVoice:ttsVoiceNow(), ttsNote:'', ttsBusy:false, aiOn:aiReadyNow(), aiProvider:aiProviderNow(), aiModel:AICFG.model || 'claude-haiku-5-5', aiTab:aiProviderNow(), aliOn:!!aliCfg().key, aliKeyInput:'', aliWsInput:aliCfg().ws || '', aliModelInput:aliCfg().model || 'qwen-flash', aliNote:'', aliTesting:false, asrMode:asrModeNow(), asrBusy:false, aiKeyInput:'', aiNote:'', aiMode:!HAS_SCRIPTS, aim:[], aiBusy:false, aiErr:'', aiInput:'', aiListen:false, aiAlts:[], aiScn:-1, syncOn:!!SYNCCFG.token, syncAt:SYNCCFG.at || 0, syncInput:'', syncBusy:false, syncMsg:'', syncBad:false,
      lmode:'dict', dclip:0, drecent:[], dplays:0, drate:1, dtyped:'', dchecked:false, dmarks:[], dreveal:0,
      tidx:null, tpick:null, tright:0, ttotal:0, tmode:'one', t2idx:null, t2a:null, t2b:null, t2right:0, t2total:0,
      playing:null, noVoice:false
    };
  }

  function rollDay(s) {
    const t = ymd(new Date());
    if (s.day === t) return s.mem0 == null ? Object.assign({}, s, { mem0:memOf(s.ws).words }) : s;
    const rq = buildQueue(s.ws, false);
    return Object.assign({}, s, {
      mem0:memOf(s.ws).words, day:t, dayXp:0, dayMin:0, wlearned:{}, wrated:{}, wdelta:{}, wreveal:{}, webCredited:false,
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

  const aliasGres = (gres, n) => {
    const al = LESSON_ALIAS[n];
    if (!al || !gres) return gres;
    const out = Object.assign({}, gres);
    Object.keys(al).forEach(o => { if (out[o] !== undefined) { out[al[o]] = Math.max(out[al[o]] || 0, out[o]); delete out[o]; } });
    return out;
  };
  const readStore = (n) => {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(storeKey(n))); } catch (e) {}
    if (!st || typeof st !== 'object') return null;
    if (st.gres) st.gres = aliasGres(st.gres, n);
    return st;
  };
  const clipCount = (n) => ((window['HSK' + n + '_LISTEN'] || {}).clips || []).length;
  // the words, grammar, speaking and listening progress of every shown level, joined (All levels)
  const readSplit = () => {
    const out = { ws:{}, misses:{}, gres:{}, sres:{}, clipBest:[] };
    LVLS.forEach(n => {
      const st = readStore(n) || {};
      Object.assign(out.ws, st.ws || {}); Object.assign(out.misses, st.misses || {}); Object.assign(out.gres, st.gres || {}); Object.assign(out.sres, st.sres || {});
      const cb = Array.isArray(st.clipBest) ? st.clipBest : [];
      for (let k = 0; k < clipCount(n); k++) out.clipBest.push(cb[k] || 0);
    });
    return out;
  };

  function mergeSaved(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    if (!ALL && saved.gres) saved = Object.assign({}, saved, { gres:aliasGres(saved.gres, LV) });
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
    if (ALL) {
      if (!saved) {   // first time in All levels: start from the highest level's numbers (streak, XP, settings) and a fresh day
        saved = Object.assign({}, readStore(TOPL) || {});
        delete saved.day; saved.exams = [];
      }
      saved = Object.assign({}, saved, readSplit());
    }
    const st = rollDay(mergeSaved(freshState(), saved));
    st.dclip = pickClip(st.clipBest, []);   // the Listening lab opens on a random clip, not always the first
    st.drecent = [st.dclip];
    return st;
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
  // every word the conversation may use: this level's words, plus the earlier levels' words (at HSK 2 that is HSK 1 too)
  const KB = {};
  for (let n = 1; n < (ALL ? TOPL : LV); n++) (window['HSK' + n + '_WORDS'] || []).forEach(w => { KB[w.zh] = { py:w.py, en:w.en }; });
  WORDS.forEach(w => { KB[w.zh] = { py:w.py, en:w.en }; });
  const KB_KEYS = Object.keys(KB);
  const CHARSET = {};
  KB_KEYS.forEach(k => k.split('').forEach(ch => { CHARSET[ch] = true; }));
  // words of the next level (the 2025 syllabus) the conversation may use as a one-level-up preview; pinyin is checked in tools/build-preview.py
  const PV = window['HSK' + ((ALL ? TOPL : LV) + 1) + '_PREVIEW'] || {};   // the next level's words, shown with pinyin and English when used
  // the other spelling of a 儿 word (the 儿 form when the site shows plain forms, or the reverse) is fine too: the model may use either
  const ERH_ALT = {};
  if (window.HSK1_ERHUA) window.HSK1_ERHUA.pairs.forEach(pr => { [[pr.official, pr.officialPy], [pr.plain, pr.plainPy]].forEach(x => { if (!KB[x[0]] && x[1]) ERH_ALT[x[0]] = x[1]; }); });
  const MAXW = Math.max(KB_KEYS.reduce((n, k) => Math.max(n, k.length), 1), Object.keys(PV).reduce((n, k) => Math.max(n, k.length), 1), Object.keys(ERH_ALT).reduce((n, k) => Math.max(n, k.length), 1));
  // split a Chinese reply into known words, so pinyin comes from our own checked word list and outside words can be flagged
  const segHsk = (text) => {
    const out = [];
    for (let i = 0; i < text.length;) {
      let hit = null;
      for (let n = Math.min(MAXW, text.length - i); n >= 1; n--) { const w = text.substr(i, n); if (KB[w] || ERH_ALT[w] || PV[w]) { hit = w; break; } }
      if (hit && !KB[hit] && ERH_ALT[hit]) { out.push({ t:hit, py:ERH_ALT[hit], cjk:true, ok:true }); i += hit.length; continue; }
      if (hit && KB[hit]) { out.push({ t:hit, py:KB[hit].py.split('/')[0].trim(), cjk:true, ok:true }); i += hit.length; continue; }
      if (hit) { out.push({ t:hit, py:PV[hit][0], en:PV[hit][1], cjk:true, ok:true, pv:true }); i += hit.length; continue; }
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
  // HSK 2 words in a line (shown with pinyin and English so a preview word is never a mystery)
  const aiPreview = (toks) => { const seen = {}; const out = []; toks.forEach(t => { if (t.pv && !seen[t.t]) { seen[t.t] = true; out.push({ t:t.t, py:t.py, en:t.en }); } }); return out; };
  const aiOutside = (toks) => { const seen = {}; const out = []; toks.forEach(t => { if (t.cjk && !t.ok && !seen[t.t]) { seen[t.t] = true; out.push(t.t); } }); return out; };
  // The recogniser offers several guesses for what it heard. Prefer the one made only of HSK 1 characters and closest to the suggested
  // reply (if one is showing); otherwise keep its own first choice. The other guesses are returned so they can be offered.
  const lcsRatio = (a, b) => {
    const x = Array.from(a), y = Array.from(b); if (!x.length || !y.length) return 0;
    const m = Array.from({ length:x.length + 1 }, () => new Array(y.length + 1).fill(0));
    for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) m[i][j] = x[i - 1] === y[j - 1] ? m[i - 1][j - 1] + 1 : Math.max(m[i - 1][j], m[i][j - 1]);
    return m[x.length][y.length] / Math.max(x.length, y.length);
  };
  const aiBestGuess = (res, hint) => {
    const cands = [];
    for (let i = 0; i < res.length; i++) { const t = String(res[i].transcript || '').trim(); if (t && !cands.some(c => c.text === t)) cands.push({ text:t, conf:res[i].confidence || 0, rank:i }); }
    if (!cands.length) return { text:'', others:[] };
    const plain = (t) => t.replace(/[\s，。？！、,.?!]/g, '');
    cands.forEach(c => {
      const chars = Array.from(plain(c.text)); const cjk = chars.filter(ch => /[\u4e00-\u9fff]/.test(ch));
      const vocab = cjk.length ? cjk.filter(ch => CHARSET[ch]).length / cjk.length : 0;
      c.score = (c.rank === 0 ? 0.25 : 0) + vocab + (hint ? lcsRatio(plain(hint), plain(c.text)) : 0) + 0.3 * c.conf;
    });
    const best = cands.reduce((a, b) => (b.score > a.score + 0.15 ? b : a), cands[0]);
    return { text:best.text, others:cands.filter(c => c !== best).slice(0, 3).map(c => c.text) };
  };
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
  const aiSystem = (scn) => {
    const known = TOPL === 1 ? 'HSK 1' : 'HSK 1 and HSK 2';   // the lists the learner knows
    const nextN = 'HSK ' + (TOPL + 1);                        // the level the conversation may peek at
    const up = Object.keys(PV).length > 0;
    return [
      'You are Mingming (明明), a friendly Mandarin conversation partner for an adult English-speaking beginner who is studying for HSK ' + TOPL + (TOPL === 1 ? '' : ' (HSK 1 words are known too)') + (up ? ' and is happy to see a little ' + nextN + ' as a preview.' : '.'),
      'Speak Simplified Chinese. Use mainly words from this ' + known + ' word list (plus punctuation and numbers): ' + KB_KEYS.join(' ') + '.',
      up ? 'You may also use a few words from this ' + nextN + ' list as a gentle preview, at most one or two in a reply, when they make the conversation more natural and realistic or let you cover more everyday situations (cafés, travel, directions, hobbies, health, school, work): ' + Object.keys(PV).join(' ') + '. Never use a word that is on neither list.' : 'Never use a word that is not on the list.',
      'If you need a word that is ' + (up ? 'on neither list' : 'not on the list') + ', say it another way with listed words. Never write pinyin in the Chinese. When you say your own name, say 我叫明明 (the standard way to give a name), not 我是明明. Keep every reply to one or two short sentences (about 15 characters or fewer in total) and ask at most one simple question, so the learner can answer.',
      scn ? 'Role-play setting: ' + scn.title + '. Goals for the learner: ' + scn.goals.join('; ') + '. Stay in this setting and play the other person.' : 'Free chat: pick an everyday topic (food, family, school, weather, plans) and keep it simple.',
      'After each learner message, also judge it. Say "ok" if it is natural and understandable Mandarin. Say "fix" if it has a grammar, word choice or naturalness problem: then give the corrected sentence in Chinese (' + (up ? known + ' words, or a ' + nextN + ' word if it really helps' : known + ' words') + ') and a one-sentence reason in simple English. ' + (up ? 'Using a ' + nextN + ' word is never a mistake. ' : '') + 'Do not nitpick: only fix real problems. If the learner writes English, give "fix" with the Chinese they could say. The learner message may come from speech recognition and contain wrong characters: if it does not make sense, ask them to say it again as the reply.',
      'Answer with ONLY a JSON object, no other text: {"reply":{"zh":"<your Chinese>","en":"<English translation>"},"feedback":{"level":"ok"|"fix","better":"<corrected Chinese or empty>","why":"<short English reason or empty>"},"suggest":{"zh":"<suggested learner reply>","en":"<English>"}}. For the very first message of a conversation, set feedback to {"level":"ok","better":"","why":""}.',
      'Also always add "suggest":{"zh":"<one natural, short reply (about 12 characters or fewer) the learner could say next to answer you, ' + (up ? known + ' words or at most one ' + nextN + ' word' : known + ' words') + ', no pinyin>","en":"<its English meaning>"} so a beginner who is stuck can see what to say. Use 我叫… when giving a name.'
    ].join('\n');
  };
  const aiParse = (text) => {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j < i) throw new Error('The reply was not in the expected format.');
    const o = JSON.parse(text.slice(i, j + 1));
    if (!o.reply || typeof o.reply.zh !== 'string') throw new Error('The reply was not in the expected format.');
    return { zh:o.reply.zh, en:o.reply.en || '', sug:o.suggest && typeof o.suggest.zh === 'string' && o.suggest.zh.trim() ? { zh:o.suggest.zh.trim(), en:o.suggest.en || '' } : null, fb:o.feedback && o.feedback.level === 'fix' ? { better:o.feedback.better || '', why:o.feedback.why || '' } : null };
  };
  // Alibaba Cloud Model Studio (OpenAI-compatible endpoint). Used for the conversation and for the voice recogniser.
  async function aliPost(body) {
    let res;
    try {
      res = await fetch(aliBase() + '/chat/completions', { method:'POST', headers:{ 'Authorization':'Bearer ' + aliCfg().key, 'content-type':'application/json' }, body:JSON.stringify(body) });
    } catch (e) { throw new Error('Could not reach Alibaba from this page. It may be your connection, a wrong workspace ID, or Alibaba not allowing calls straight from a web page.'); }
    if (res.ok) return res.json();
    let detail = ''; try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || j.message || j.code || ''; } catch (e) {}
    let msg;
    if (res.status === 401) msg = 'Alibaba rejected the API key. Use a key made in the Singapore region (International edition).';
    else if (res.status === 429) msg = 'Too many requests right now. Wait a moment and try again.';
    else if (/FreeTierOnly|free tier|free quota/i.test(detail)) msg = 'The free quota is used up. Alibaba needs identity verification and a top-up before it will go on.';
    else msg = 'Alibaba had a problem (' + res.status + ')' + (detail ? ': ' + detail : '') + '.';
    const err = new Error(msg); err.status = res.status; err.detail = detail; throw err;
  }
  const aiText = (data) => {
    const c = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    return Array.isArray(c) ? c.map(x => x.text || '').join('') : String(c || '');
  };
  async function aiCall(history, scn) {
    if (aiProviderNow() === 'alibaba') {
      const body = { model:aliCfg().model || 'qwen-flash', max_tokens:600, messages:[{ role:'system', content:aiSystem(scn) }].concat(history), response_format:{ type:'json_object' } };
      let data;
      try { data = await aliPost(body); }
      catch (e) { if (e.status === 400 && /response_format|json/i.test(e.detail || '')) { delete body.response_format; data = await aliPost(body); } else throw e; }
      const text = aiText(data);
      return { raw:text, parsed:aiParse(text) };
    }
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

  // ---- voice recogniser: record, turn the clip into a 16 kHz mono WAV, send it to Alibaba's Qwen3-ASR ----
  const wavBase64 = (pcm, rate) => {
    const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
    const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) { const x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true); }
    const bytes = new Uint8Array(buf); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  // average neighbouring samples down to 16 kHz (the recording is taken straight from the microphone, so nothing has to be decoded)
  const to16k = (pcm, rate) => {
    if (rate === 16000) return pcm;
    const ratio = rate / 16000, n = Math.floor(pcm.length / ratio), out = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const a = Math.floor(j * ratio), b = Math.max(a + 1, Math.min(pcm.length, Math.floor((j + 1) * ratio)));
      let sum = 0; for (let i = a; i < b; i++) sum += pcm[i];
      out[j] = sum / (b - a);
    }
    return out;
  };
  async function aliTranscribe(b64) {
    const body = { model:ALI_ASR_MODEL, stream:false, asr_options:{ enable_itn:false, language:'zh' },
      messages:[{ role:'user', content:[{ type:'input_audio', input_audio:{ data:'data:audio/wav;base64,' + b64 } }] }] };
    let data;
    try { data = await aliPost(body); }
    catch (e) { if (e.status === 400 && /language|asr_options/i.test(e.detail || '')) { delete body.asr_options.language; data = await aliPost(body); } else throw e; }
    return aiText(data).trim();
  }

  // one line of text -> a link to a WAV file (valid for 24 hours); the page plays it with an <audio> element, so no cross-site download is needed
  async function aliTTS(text, voice) {
    let res;
    try {
      res = await fetch(aliApi() + '/services/aigc/multimodal-generation/generation', { method:'POST', headers:{ 'Authorization':'Bearer ' + aliCfg().key, 'content-type':'application/json' },
        body:JSON.stringify({ model:ALI_TTS_MODEL, input:{ text:text.slice(0, 600), voice, language_type:'Chinese' } }) });
    } catch (e) { throw new Error('Could not reach Alibaba\'s voice service from this page (the browser may be blocking it).'); }
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) {
      const detail = (j && (j.message || j.code || (j.error && (j.error.message || j.error.code)))) || '';
      let msg;
      if (res.status === 401) msg = 'Alibaba rejected the API key.';
      else if (res.status === 429) msg = 'Too many requests right now.';
      else if (/FreeTierOnly|free tier|free quota/i.test(detail)) msg = 'The free quota for the voice model is used up.';
      else msg = 'Alibaba said ' + res.status + (detail ? ': ' + detail : '') + '.';
      const err = new Error(msg); err.status = res.status; throw err;
    }
    const url = j && j.output && j.output.audio && j.output.audio.url;
    if (!url) throw new Error('Alibaba answered but sent no audio link' + (j && j.message ? ' (' + j.message + ')' : '') + '.');
    return String(url).replace(/^http:\/\//, 'https://');
  }

  // ---------- the HSK 1 mock exam ----------
  // Layout follows the official HSK 1 sample papers: 4 listening parts and 4 reading parts, 5 questions each, listening played twice.
  const EXAMBANK = LV_DATA('EXAM') || null;
  const EXAM_MIN = EXAMBANK && EXAMBANK.meta ? { listening:EXAMBANK.meta.listening.minutes, reading:EXAMBANK.meta.reading.minutes } : { listening:15, reading:20 };
  const EXAM_N = EXAMBANK && EXAMBANK.meta ? { listening:EXAMBANK.meta.listening.questions, reading:EXAMBANK.meta.reading.questions } : { listening:20, reading:20 };
  // each section is worth 100 points, shared evenly by its questions (5 each at HSK 1; 100/35 and 4 each at HSK 2)
  const secPts = (correct, total) => Math.round(100 * correct / total);
  const PART_1 = {
    L1:{ sec:'listening', n:1, inst:'Listen. Does the picture match what you hear?' },
    L2:{ sec:'listening', n:2, inst:'Listen to the sentence. Choose the picture that matches.' },
    L3:{ sec:'listening', n:3, inst:'Listen to the short conversation. Choose the picture it is about.' },
    L4:{ sec:'listening', n:4, inst:'Listen to the conversation and the question. Choose the answer.' },
    R1:{ sec:'reading', n:1, inst:'Does the picture match the words?' },
    R2:{ sec:'reading', n:2, inst:'Choose the picture that matches the sentence.' },
    R3:{ sec:'reading', n:3, inst:'Choose the answer to the question.' },
    R4:{ sec:'reading', n:4, inst:'Choose the word that fills the blank.' }
  };
  const PART_2 = {
    L1:{ sec:'listening', n:1, inst:'Listen. Does the picture match the sentence?' },
    L2:{ sec:'listening', n:2, inst:'Listen to the conversation. Choose the picture it is about.' },
    L3:{ sec:'listening', n:3, inst:'Listen to the short conversation and the question. Choose the answer.' },
    L4:{ sec:'listening', n:4, inst:'Listen to the longer conversation and the question. Choose the answer.' },
    R1:{ sec:'reading', n:1, inst:'Choose the picture that matches each sentence.' },
    R2:{ sec:'reading', n:2, inst:'Choose the word that fills the blank.' },
    R3:{ sec:'reading', n:3, inst:'Do the two sentences mean the same?' },
    R4:{ sec:'reading', n:4, inst:'Choose the answer to each question.' }
  };
  const PART = LV === 1 ? PART_1 : PART_2;
  const LETTERS = 'ABCDEF';
  const pickN = (arr, n) => shuffleArr(arr).slice(0, n);
  function shuffleArr(arr) { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; }
  // five true/false items with at least two of each
  const pickTF = (bank) => { const t = shuffleArr(bank.filter(e => e.ok)), f = shuffleArr(bank.filter(e => !e.ok)); const rest = shuffleArr(t.slice(2).concat(f.slice(2))); return shuffleArr(t.slice(0, 2).concat(f.slice(0, 2), rest.slice(0, 1))); };
  const audioOf = (lines) => lines.map(l => ({ text:l.zh, pitch:l.s === '女' ? 1.25 : l.s === '男' ? 0.8 : 1 }));
  // HSK 2: listening 10 + 10 + 10 + 5, reading 5 + 5 + 5 + 10 (the layout of the 2012 HSK 2 sample papers)
  const pickTFn = (bank, n) => { const half = Math.floor(n / 2); const t = shuffleArr(bank.filter(e => e.ok)), f = shuffleArr(bank.filter(e => !e.ok)); const rest = shuffleArr(t.slice(half).concat(f.slice(half))); return shuffleArr(t.slice(0, half).concat(f.slice(0, half), rest.slice(0, n - 2 * half))); };
  const examQsL2 = (sec) => {
    const out = [];
    const add = (part, q) => { out.push(Object.assign({ part, id:part + '-' + out.length, sec:PART[part].sec }, q)); };
    const E = EXAMBANK;
    const sayRev = (lines, q) => ({ zh:lines.map(l => l.zh).join(' ') + (q ? ' ' + q.zh : ''), py:lines.map(l => l.py).join(' ') + (q ? ' ' + q.py : ''), en:lines.map(l => l.en).join(' ') + (q ? ' ' + q.en : '') });
    const textQ = (part, bank, n) => pickN(bank, n).forEach(e => { const order = shuffleArr([0, 1, 2]); const opts = order.map((k, j) => ({ v:j, label:e.opts[k].zh })); add(part, { kind:'text', audio:audioOf(e.say).concat([{ text:e.q.zh, pitch:1 }]), opts, ans:order.indexOf(0), rev:sayRev(e.say, e.q), right:e.opts[0].zh }); });
    if (sec === 'listening') {
      pickTFn(E.L1, 10).forEach(e => add('L1', { kind:'tf', pic:e.pic, audio:[{ text:e.zh }], ans:e.ok ? 'T' : 'F', opts:[{ v:'T', label:'✓ It matches' }, { v:'F', label:'✗ It does not match' }], rev:{ zh:e.zh, py:e.py, en:e.en, pic:e.pic }, right:e.ok ? 'It matches' : 'It does not match' }));
      pickN(E.L2, 2).forEach(st => shuffleArr(st.items).forEach(it => add('L2', { kind:'match', audio:audioOf(it.say), opts:st.opts.map((p, k) => ({ v:k, label:p, emoji:true })), ans:it.ans, rev:sayRev(it.say), right:st.opts[it.ans] })));
      textQ('L3', E.L3, 10);
      textQ('L4', E.L4, 5);
    } else {
      const s1 = E.R1[Math.floor(Math.random() * E.R1.length)];
      shuffleArr(s1.items).forEach(it => add('R1', { kind:'match', text:it.zh, opts:s1.opts.map((p, k) => ({ v:k, label:p, emoji:true })), ans:it.ans, rev:{ zh:it.zh, py:it.py, en:it.en }, right:s1.opts[it.ans] }));
      const s2 = E.R2[Math.floor(Math.random() * E.R2.length)];
      const p2 = shuffleArr([0, 1, 2, 3, 4, 5]);
      shuffleArr(s2.items).forEach(it => add('R2', { kind:'match', text:it.zh, opts:p2.map((k, j) => ({ v:j, label:s2.opts[k].zh })), ans:p2.indexOf(it.ans), rev:{ zh:it.full, py:it.py, en:it.en }, right:s2.opts[it.ans].zh }));
      pickTFn(E.R3.map(e => Object.assign({ ok:e.same }, e)), 5).forEach(e => add('R3', { kind:'tf', text:e.a.zh + '\n' + e.b.zh, ans:e.same ? 'T' : 'F', opts:[{ v:'T', label:'✓ Same meaning' }, { v:'F', label:'✗ Different meaning' }], rev:{ zh:e.a.zh + ' / ' + e.b.zh, py:e.a.py + ' / ' + e.b.py, en:e.a.en + ' / ' + e.b.en }, right:e.same ? 'Same meaning' : 'Different meaning' }));
      pickN(E.R4, 2).forEach(st => {
        const p4 = shuffleArr([0, 1, 2, 3, 4]);
        st.items.forEach(it => add('R4', { kind:'match', text:it.zh, opts:p4.map((k, j) => ({ v:j, label:st.opts[k].zh })), ans:p4.indexOf(it.ans), rev:{ zh:it.zh + ' ' + st.opts[it.ans].zh, py:it.py + ' ' + st.opts[it.ans].py, en:it.en + ' ' + st.opts[it.ans].en }, right:st.opts[it.ans].zh }));
      });
    }
    return out;
  };
  const examQs = (sec) => {
    if (LV === 2) return examQsL2(sec);
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
      if (patch.dayMin !== undefined && patch.dayMin !== S.dayMin && !this.noMin) {   // (not when a sync only brings in another device's numbers)
        const td = ymd(new Date());
        const ml = Object.assign({}, S.minLog); ml[td] = patch.dayMin;
        const ks = Object.keys(ml).sort(); while (ks.length > 60) delete ml[ks.shift()];
        const md = Object.assign({}, S.minDev); md[td] = Object.assign({}, md[td], { [DEVICE]: ((md[td] && md[td][DEVICE]) || 0) + Math.max(0, patch.dayMin - S.dayMin) });   // this device's own minutes: only what was added here
        const kd = Object.keys(md).sort(); while (kd.length > 60) delete md[kd.shift()];
        patch = Object.assign({}, patch, { minLog:ml, minDev:md });
      }
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
      this.friendsTick();
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persistNow(), 250);
    }
    persistNow() {
      try {
        const out = {};
        PERSIST.forEach(k => { if (!ALL || SPLIT.indexOf(k) < 0) out[k] = this.state[k]; });
        localStorage.setItem(KEY, JSON.stringify(out));
        if (ALL) this.persistSplit();
        else if ((this.state.exams || []).some(LVL.passedEntry)) LVL.markPassed(LV);   // a passed full exam opens the next level
      } catch (e) {}
    }
    // ----- friends board: talks to the server rarely (on open, after a pause in studying, when you leave, and at most every ~10 minutes) -----
    frTimer = null;
    friendsTick() {
      if (!FR || !FR.enabled() || !FR.identity() || this.frTimer) return;
      const last = Number(localStorage.getItem(FR_PUSH_KEY) || 0);
      if (Date.now() - last < 10 * 60 * 1000) return;
      this.frTimer = setTimeout(() => { this.frTimer = null; this.friendsPush({ minGap:10 * 60 * 1000 }); }, 5000);
    }
    friendsPush = async (o) => {
      const opt = o || {};
      if (!FR || !FR.enabled() || !FR.identity()) return;
      const last = Number(localStorage.getItem(FR_PUSH_KEY) || 0);
      if (opt.minGap && Date.now() - last < opt.minGap) return;
      try {
        if (!opt.keepalive) await this.friendsProgressSync();   // merge your progress first, so the numbers below come from the same progress on every device
        this.persistNow();
        await FR.push(collectFriendStats(), opt.keepalive ? { keepalive:true } : undefined);
        try { localStorage.setItem(FR_PUSH_KEY, String(Date.now())); } catch (e) {}
      } catch (e) { this.friendsFailed(e); }
    };
    friendStats = () => collectFriendStats();
    // Your progress lives on the server too: every device merges into it (the same order-independent merge the GitHub sync uses),
    // so a word, an exam pass or a day's study on one device shows up on all of them.
    friendsProgressSync = async () => {
      const SY = window.ShanluSync;
      if (!FR || !FR.enabled() || !FR.identity() || !SY) return false;
      this.persistNow();
      const levels = Object.keys(LVL.PROGRESS_KEYS || {}).map(Number);
      const local = {};
      levels.forEach(n => { const st = readStore(n); if (st) local[n] = SY.pick(st); });
      const got = await FR.getProgress();
      const remote = (got && got.progress && got.progress.levels) || {};
      const merged = {}; let pushNeeded = !(got && got.progress), changed = false;
      Object.keys(Object.assign({}, local, remote)).forEach(k => {
        const n = Number(k);
        if (levels.indexOf(n) < 0) { merged[k] = remote[k]; return; }   // a level this version does not know: pass it through untouched
        const m = SY.merge(local[k], remote[k]);
        merged[k] = m;
        if (!SY.same(m, SY.merge(remote[k], remote[k]))) pushNeeded = true;
        if (!SY.same(m, SY.merge(local[k], local[k]))) changed = true;
      });
      if (changed) {
        levels.forEach(n => { if (merged[n]) { const st = readStore(n) || {}; try { localStorage.setItem(storeKey(n), JSON.stringify(Object.assign({}, st, SY.pick(merged[n])))); } catch (e) {} if ((merged[n].exams || []).some(LVL.passedEntry)) LVL.markPassed(n); } });
        // bring this view up to date
        let patch;
        if (ALL) { const tmp = Object.assign({}, this.state, readSplit()); Object.keys(BANK).forEach(zh => { if (!tmp.ws[zh]) tmp.ws[zh] = blankWord(); }); carryOverErhua(tmp); patch = {}; SPLIT.forEach(k => { patch[k] = tmp[k]; }); }
        else if (merged[LV]) { const next = rollDay(Object.assign({}, this.state, merged[LV])); carryOverErhua(next); patch = SY.pick(next); patch.rq = (patch.rq || []).filter(z => BANK[z]); }
        if (patch) { this.noSync = true; this.noMin = true; this.setState(patch); this.noMin = false; this.noSync = false; this.persistNow(); }
      }
      if (pushNeeded) await FR.putProgress({ v:1, levels:merged });
      return changed;
    };
    friendsFailed = (e) => {
      if (e && e.status === 401) { FR.forget(); this.setState({ fr:null, frErr:'This device is not in the group any more. Open your invite link to join again.' }); return; }
      this.setState({ frErr:(e && e.message) || 'Could not reach the friends board.' });
    };
    friendsRefresh = async (force) => {
      if (!FR || !FR.enabled() || !FR.identity()) return;
      const S = this.state;
      if (S.frBusy || (!force && S.fr && Date.now() - S.frAt < 2 * 60 * 1000)) return;
      this.setState({ frBusy:true });
      try { const g = await FR.group(); this.setState({ fr:g, frAt:Date.now(), frBusy:false, frErr:'' }); }
      catch (e) { this.setState({ frBusy:false }); this.friendsFailed(e); }
    };
    friendsJoin = async () => {
      const S = this.state;
      if (S.frBusy || !FR) return;
      this.setState({ frBusy:true, frErr:'' });
      try {
        await FR.join(S.frCode, S.frName);
        this.setState({ frBusy:false, frName:'', frCode:'', frMsg:'' });
        await this.friendsPush({});
        await this.friendsRefresh(true);
      } catch (e) { this.setState({ frBusy:false, frErr:(e && e.message) || 'Could not join.' }); }
    };
    friendsCheer = async (id) => {
      try { await FR.cheer(id); await this.friendsRefresh(true); } catch (e) { this.friendsFailed(e); }
    };
    friendsLeave = async () => {
      if (!this.state.frLeaveAsk) { this.setState({ frLeaveAsk:true }); return; }
      try { await FR.leave(); this.setState({ fr:null, frLeaveAsk:false, frErr:'', frMsg:'You left the group.' }); } catch (e) { this.setState({ frLeaveAsk:false }); this.friendsFailed(e); }
    };
    friendsCopyLink = async () => {
      const id = FR && FR.identity();
      if (!id) return;
      const link = window.ShanluFriends.makeLink(location.href, id);
      try { await navigator.clipboard.writeText(link); this.setState({ frCopied:true }); setTimeout(() => this.setState({ frCopied:false }), 2500); } catch (e) { try { window.prompt('Copy your link', link); } catch (e2) {} }
    };
    // an invite link (#join=CODE) opens the join form; a personal link (#me=...) signs this device in
    friendsBoot = async () => {
      if (!FR || !FR.enabled()) return;
      const hit = window.ShanluFriends.parseHash(location.hash);
      if (hit.join || hit.me) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      if (hit.join) {
        if (FR.identity()) this.setState({ screen:'friends', frMsg:'This device is already in the group.' });
        else this.setState({ screen:'friends', frCode:hit.join });
      } else if (hit.me) {
        const cur = FR.identity();
        if (cur && cur.id !== hit.me.id && !window.confirm('This device is already in the group as ' + (cur.name || 'someone') + '. Replace that with the link you opened?')) { this.setState({ screen:'friends' }); return; }
        try { const g = await FR.restore(hit.me); this.setState({ screen:'friends', fr:g, frAt:Date.now(), frMsg:'Signed in on this device.', frErr:'' }); await this.friendsPush({}); }
        catch (e) { this.setState({ screen:'friends', frErr:(e && e.message) || 'That link does not work.' }); }
      }
      if (FR.identity()) { await this.friendsRefresh(false); setTimeout(() => this.friendsPush({ minGap:5 * 60 * 1000 }), 1500); }
    };

    // All levels: hand each level its own part of the progress, leaving the rest of that level's save alone
    persistSplit() {
      const S = this.state;
      let off = 0;
      LVLS.forEach(n => {
        const st = readStore(n) || {};
        const words = (window['HSK' + n + '_WORDS'] || []).map(w => w.zh);
        const ws = Object.assign({}, st.ws); words.forEach(z => { if (S.ws[z]) ws[z] = S.ws[z]; });
        const mis = Object.assign({}, st.misses); words.forEach(z => { if (S.misses[z] !== undefined) mis[z] = S.misses[z]; else delete mis[z]; });
        const pick = (src, ids) => { const o = {}; ids.forEach(id => { if (src[id] !== undefined) o[id] = src[id]; }); return o; };
        const lessons = ((window['HSK' + n + '_GRAMMAR'] || {}).lessons || []).map(l => l.id);
        const scns = ((window['HSK' + n + '_SPEAK'] || {}).scenarios || []).map(x => x.id);
        const gres = Object.assign({}, st.gres); lessons.forEach(id => { delete gres[id]; }); Object.assign(gres, pick(S.gres, lessons));
        const sres = Object.assign({}, st.sres); scns.forEach(id => { delete sres[id]; }); Object.assign(sres, pick(S.sres, scns));
        const cnt = clipCount(n);
        st.ws = ws; st.misses = mis; st.gres = gres; st.sres = sres; st.clipBest = S.clipBest.slice(off, off + cnt);
        off += cnt;
        try { localStorage.setItem(storeKey(n), JSON.stringify(st)); } catch (e) {}
      });
    }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); }

    go = (screen) => {
      this.setState({ screen }); try { window.scrollTo(0, 0); } catch (e) {}
      if (screen === 'speak' && !HAS_SCRIPTS) { const S = this.state; if (S.aiOn && !S.aim.length && !S.aiBusy) this.aiStart(S.aiScn); }   // no scripts at this level: go straight to the AI conversation
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
    // recorded audio: audio/<text>.<ext> for every text listed in data/audio-manifest.js; anything else is read by the browser voice
    nativeAudio = null;
    nativeFile = (text) => {
      const m = window.SHANLU_AUDIO;
      return m && text && Object.prototype.hasOwnProperty.call(m, text) ? 'audio/' + encodeURIComponent(text) + '.' + m[text] : null;
    };
    stopNative = () => { this.ttsTok++; try { if (this.nativeAudio) { this.nativeAudio.pause(); this.nativeAudio = null; } } catch (e) {} try { if (this.ttsEl) this.ttsEl.pause(); } catch (e) {} };
    // Mingming's voice: Qwen when an Alibaba key is saved (and it is switched on), otherwise the browser voice. Any failure falls back to the browser voice.
    ttsEl = null; ttsTok = 0; ttsOpen = false; ttsCache = {}; ttsWarned = false;
    ttsUnlock = () => {   // phones only allow sound that starts inside a tap: play a silent clip on the same <audio> element now, reuse it later
      try {
        if (ttsModeNow() !== 'qwen') return;
        if (!this.ttsEl) this.ttsEl = new Audio();
        if (this.ttsOpen) return; this.ttsOpen = true;
        this.ttsEl.src = 'data:audio/wav;base64,' + wavBase64(new Float32Array(800), 8000);
        const p = this.ttsEl.play(); if (p && p.catch) p.catch(() => { this.ttsOpen = false; });
      } catch (e) {}
    };
    sayAi = async (text, key, rate) => {
      if (ttsModeNow() !== 'qwen') { this.say(text, key, rate); return; }
      this.stopNative(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      const tok = ++this.ttsTok;
      this.setState({ playing:key, ttsBusy:true });
      try {
        const voice = ttsVoiceNow(), ck = voice + '|' + text; let c = this.ttsCache[ck];
        if (!c || c.exp < Date.now()) { c = this.ttsCache[ck] = { url:await aliTTS(text, voice), exp:Date.now() + 20 * 3600000 }; }
        if (tok !== this.ttsTok) return;
        if (!this.ttsEl) this.ttsEl = new Audio();
        const a = this.ttsEl;
        a.onended = () => { if (tok === this.ttsTok && this.state.playing === key) this.setState({ playing:null }); };
        a.onerror = () => { if (tok === this.ttsTok) { this.ttsFail(new Error('the audio could not be played')); this.say(text, key, rate); } };
        a.src = c.url; a.playbackRate = rate || this.state.speed || 1; try { a.preservesPitch = true; } catch (e) {}
        await a.play();
        this.ttsOpen = true;
        if (tok === this.ttsTok) this.setState({ ttsBusy:false });
      } catch (e) {
        if (tok !== this.ttsTok) return;
        this.ttsFail(e); this.say(text, key, rate);
      }
    };
    ttsFail = (e) => {
      this.setState({ ttsBusy:false });
      if (this.ttsWarned) return; this.ttsWarned = true;
      this.setState({ aiErr:'The Qwen voice did not work (' + ((e && e.message) || 'unknown problem').replace(/\.$/, '') + '), so this browser\'s voice is used for now. Settings has a Test connection button.' });
    };
    say = (text, key, rate, voice) => {
      const file = voice ? null : this.nativeFile(text);      // a chosen voice (the voice sample in Settings) is always the browser voice
      if (!file) { this.sayTTS(text, key, rate, voice); return; }
      this.stopNative();
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      let a = null;
      const fallback = () => { if (a && this.nativeAudio === a) { this.nativeAudio = null; this.sayTTS(text, key, rate, voice); } };
      try {
        a = new Audio(file);
        a.playbackRate = rate || this.state.speed || 1;
        try { a.preservesPitch = true; } catch (e) {}
        this.nativeAudio = a;
        a.addEventListener('error', fallback);
        const pr = a.play(); if (pr && pr.catch) pr.catch(fallback);
      } catch (e) { fallback(); return; }
      this.setState({ playing:key });
      this.later(() => { if (this.state.playing === key) this.setState({ playing:null }); }, 1400);
    };
    sayTTS = (text, key, rate, voice) => {
      this.stopNative();
      try {
        if (window.speechSynthesis) {
          const zh = voice || pickVoice(this.state.voiceId);
          if (allVoices().length && !zh) this.setState({ noVoice:true });
          this.speakWhenReady((ss) => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = zh ? zh.lang : 'zh-CN'; u.rate = rate || this.state.speed || 1;
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
          lines.forEach(l => { const u = new SpeechSynthesisUtterance(l.text); u.lang = zh ? zh.lang : 'zh-CN'; u.rate = this.state.speed || 1; u.pitch = l.pitch || 1; if (zh) u.voice = zh; ss.speak(u); });
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
      const entry = { at:Date.now(), mode:m.mode, l:results.listening ? results.listening.correct : null, r:results.reading ? results.reading.correct : null, lt:results.listening ? results.listening.total : null, rt:results.reading ? results.reading.total : null };
      if (LVL.passedEntry(entry)) LVL.markPassed(LV);   // a passed full exam opens the next level straight away
      const day = ymd(new Date());
      this.setState({ exm:Object.assign({}, m, { stage:'result', results }), exams:this.state.exams.concat([entry]).slice(-20), dayMin:this.state.dayMin + (m.mode === 'full' ? 30 : 15), xp:this.state.xp + Math.round(correct * 2), dayXp:this.state.dayXp + Math.round(correct * 2) });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    exContinue = () => { const m = this.state.exm; if (m) this.exBegin({ mode:'full', sec:'reading', results:m.results }); };
    exClose = () => { clearInterval(this.exTimer); this.setState({ exm:null }); try { window.scrollTo(0, 0); } catch (e) {} };

    // ----- talk with AI -----
    setAiMode = (on) => { this.setState({ aiMode:on }); if (on && this.state.aiOn && !this.state.aim.length) this.aiStart(this.state.aiScn); };
    aiStart = (scnIdx) => { this.ttsUnlock(); this.setState({ aiScn:scnIdx, aim:[], aiErr:'', aiInput:'' }); this.aiAsk([{ role:'user', content:'(Start the conversation with a short greeting and your first question.)' }], scnIdx, []); };
    aiAsk = async (history, scnIdx, shown) => {
      this.setState({ aiBusy:true, aiErr:'' });
      try {
        const out = await aiCall(history, scnIdx >= 0 ? AISCN[scnIdx] : null);
        const p = out.parsed; const toks = segHsk(p.zh);
        let sug = null;
        if (p.sug) { const st = segHsk(p.sug.zh); if (!aiOutside(st).length && aiPinyin(st)) sug = { zh:p.sug.zh, en:p.sug.en, py:aiPinyin(st), open:false }; }   // only suggest what the site can show with pinyin
        const msg = { who:'ai', zh:p.zh, en:p.en, py:aiPinyin(toks), outside:aiOutside(toks), pv:aiPreview(toks), raw:out.raw, sug };
        const next = shown.slice();
        const last = next[next.length - 1];
        if (last && last.who === 'me') next[next.length - 1] = Object.assign({}, last, { judged:true, fb:p.fb });   // the judgement is about the learner's last line
        this.setState({ aim:next.concat([msg]), aiBusy:false });
        this.sayAi(p.zh, 'aim' + next.length);
      } catch (e) { this.setState({ aiBusy:false, aiErr:(e && e.message) || 'Something went wrong.' }); }
    };
    aiSend = () => {
      const S = this.state; const text = (S.aiInput || '').trim();
      if (!text || S.aiBusy || !S.aiOn) return;
      try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}   // lets the reply play on iPhone
      this.ttsUnlock();
      const toks = segHsk(text);
      const lastAi = S.aim[S.aim.length - 1];
      const cmp = lastAi && lastAi.who === 'ai' && lastAi.sug && lastAi.sug.open ? aiCompare(lastAi.sug.zh, lastAi.sug.py, text) : null;
      const me = { who:'me', zh:text, en:'', py:aiPinyin(toks), outside:aiOutside(toks), pv:aiPreview(toks), cmp };
      const shown = S.aim.concat([me]);
      const hist = [{ role:'user', content:'(Start the conversation with a short greeting and your first question.)' }];
      shown.forEach(m => { if (m.who === 'ai') hist.push({ role:'assistant', content:m.raw }); else hist.push({ role:'user', content:m.zh }); });
      const days = Object.assign({}, S.aiDays); const t = ymd(new Date()); days[t] = (days[t] || 0) + 1;
      const patch = { aim:shown, aiInput:'', aiAlts:[], aiDays:days, xp:S.xp + 2, dayXp:S.dayXp + 2 };
      if (days[t] >= 4 && !S.spokeToday) { patch.spokeToday = true; patch.dayMin = S.dayMin + 6; }
      this.setState(patch);
      this.aiAsk(hist.slice(-13), S.aiScn, shown);
    };
    // Listening. Built to cope with normal speed: it keeps listening through short pauses (the default stops at the first one), shows the words
    // as they come in, asks the recogniser for several guesses and prefers the guess made only of HSK 1 characters that fits the suggested
    // reply, and lets you tap another guess if it still heard it wrong.
    aiMic = () => {
      this.ttsUnlock(); try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}   // the reply that follows a spoken turn starts outside a tap
      if (this.state.asrMode === 'alibaba') { this.aiRecord(); return; }
      const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
      if (!SR) return;
      if (this.state.aiListen) { try { this.recog && this.recog.stop(); } catch (e) {} return; }
      const lastM = this.state.aim[this.state.aim.length - 1];
      const hint = lastM && lastM.who === 'ai' && lastM.sug && lastM.sug.open ? lastM.sug.zh : '';
      let silence = null, cap = null, heard = false;
      try {
        const r = new SR(); this.recog = r;
        r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
        const done = () => { clearTimeout(silence); clearTimeout(cap); try { r.stop(); } catch (e) {} };
        r.onresult = (e) => {
          heard = true;
          let fin = '', interim = '', alts = [], finals = 0;
          for (let i = 0; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) { const c = aiBestGuess(res, hint); fin += c.text; finals++; alts = c.others; } else if (res[0]) interim += res[0].transcript;
          }
          this.setState({ aiInput:fin + interim, aiAlts:finals === 1 && !interim ? alts : [] });
          clearTimeout(silence); silence = setTimeout(done, interim ? 3000 : 1800);   // stop on its own after a natural pause
        };
        r.onerror = (ev) => {
          clearTimeout(silence); clearTimeout(cap);
          const err = ev && ev.error;
          if (err === 'no-speech' || err === 'aborted') { this.setState({ aiListen:false }); return; }
          this.setState({ aiListen:false, aiErr:'The microphone did not work. Check the browser permission, or type instead.' });
        };
        r.onend = () => { clearTimeout(silence); clearTimeout(cap); this.setState({ aiListen:false }); this.aiAutoSend(); };
        this.setState({ aiListen:true, aiErr:'', aiAlts:[] });
        r.start();
        cap = setTimeout(done, 20000);
      } catch (e) { this.setState({ aiListen:false, aiErr:'The microphone could not start. Type instead.' }); }
    };
    // voice only: what the microphone heard is sent by itself (the recognised line stays on screen, with any correction under it)
    voiceOnlyOn = () => { const S = this.state; return !!S.aiVoiceOnly && !S.aiTyping && this.hasMicNow(); };
    hasMicNow = () => (this.state.asrMode === 'alibaba' ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)) : !!(window.webkitSpeechRecognition || window.SpeechRecognition));
    aiAutoSend = () => { if (this.voiceOnlyOn() && (this.state.aiInput || '').trim() && !this.state.aiBusy) this.aiSend(); };
    aiVoToggle = () => {
      if (this.voiceOnlyOn()) { this.setState({ aiTyping:true }); return; }
      AICFG.voiceOnly = true; saveAiCfg(); this.setState({ aiVoiceOnly:true, aiTyping:false });
    };
    aiReveal = (k) => { const a = this.state.aim.slice(); if (!a[k]) return; a[k] = Object.assign({}, a[k], { rev:true }); this.setState({ aim:a }); };
    setTtsMode = (m) => {
      if (m === 'qwen' && !aliCfg().key) { this.setState({ aliNote:'Save an Alibaba key first, then Qwen can speak for Mingming.' }); return; }
      AICFG.ttsMode = m; saveAiCfg(); this.ttsWarned = false; this.setState({ ttsMode:ttsModeNow() });
    };
    setTtsVoice = (v) => { AICFG.ttsVoice = v; saveAiCfg(); this.setState({ ttsVoice:ttsVoiceNow() }); if (ttsModeNow() === 'qwen') this.sayAi('你好，我是明明。我们说中文吧。', 'ttsdemo'); };
    aiPickAlt = (t) => { this.setState({ aiInput:t, aiAlts:[] }); };
    aiShowSug = () => { const a = this.state.aim.slice(); const i = a.length - 1; if (i < 0 || !a[i].sug) return; a[i] = Object.assign({}, a[i], { sug:Object.assign({}, a[i].sug, { open:true }) }); this.setState({ aim:a }); };
    aiUseSug = () => { const a = this.state.aim; const m = a[a.length - 1]; if (m && m.sug) this.setState({ aiInput:m.sug.zh }); };
    aiSimpler = () => { this.setState({ aiInput:'请再说一遍，慢一点。' }); this.aiSend(); };
    aiSaveKey = () => {
      const k = (this.state.aiKeyInput || '').trim();
      if (!k) { this.setState({ aiNote:'Paste your API key first.' }); return; }
      AICFG.key = k; AICFG.model = this.state.aiModel; saveAiCfg();
      this.setState({ aiOn:aiReadyNow(), aiKeyInput:'', aiNote:'Saved on this device.' });
    };
    aiRemoveKey = () => { delete AICFG.key; delete AICFG.model; saveAiCfg(); this.setState({ aiOn:aiReadyNow(), aiNote:'The key was removed from this device.', aim:[] }); };
    aiSetModel = (m) => { AICFG.model = m; if (AICFG.key) saveAiCfg(); this.setState({ aiModel:m }); };
    // which service writes Mingming's lines
    viewProvider = (p) => { this.setState({ aiTab:p, aiNote:'', aliNote:'' }); };   // which settings form is shown; nothing else changes
    setProvider = (p) => {
      const has = p === 'alibaba' ? !!aliCfg().key : !!AICFG.key;
      if (!has) return;
      AICFG.provider = p; saveAiCfg();
      this.setState({ aiTab:p, aiProvider:aiProviderNow(), aiOn:aiReadyNow(), aim:[], aiNote:'', aliNote:'', aiErr:'' });
    };
    aliSaveKey = () => {
      const k = (this.state.aliKeyInput || '').trim();
      const ws = (this.state.aliWsInput || '').trim();
      const model = (this.state.aliModelInput || '').trim() || 'qwen-flash';
      if (!/^[A-Za-z0-9_-]*$/.test(ws)) { this.setState({ aliNote:'The workspace ID should be letters, numbers, dashes and underscores only. Leave it empty if you are not sure.' }); return; }
      if (!k && !aliCfg().key) { this.setState({ aliNote:'Paste your Alibaba API key first.' }); return; }
      AICFG.ali = { key:k || aliCfg().key, ws, model };
      if (!AICFG.key || AICFG.provider === 'alibaba') AICFG.provider = 'alibaba';
      saveAiCfg();
      this.setState({ aliOn:true, aliKeyInput:'', aliModelInput:model, aiTab:'alibaba', aiProvider:aiProviderNow(), aiOn:aiReadyNow(), aliNote:'Saved on this device. Press "Test connection" to check it.' });
    };
    aliRemoveKey = () => {
      delete AICFG.ali; if (AICFG.provider === 'alibaba') AICFG.provider = 'anthropic'; if (AICFG.asr === 'alibaba') AICFG.asr = 'browser'; saveAiCfg();
      this.setState({ aliOn:false, aliWsInput:'', aliModelInput:'qwen-flash', aiProvider:aiProviderNow(), aiOn:aiReadyNow(), asrMode:'browser', aliNote:'The Alibaba key was removed from this device.', aim:[] });
    };
    aliPreset = (m) => { this.setState({ aliModelInput:m }); };
    aliTest = async () => {
      if (!aliCfg().key) { this.setState({ aliNote:'Save the key first.' }); return; }
      this.setState({ aliTesting:true, aliNote:'Testing…' });
      const lines = [];
      try { await aliPost({ model:aliCfg().model || 'qwen-flash', max_tokens:8, messages:[{ role:'user', content:'Reply with the single word OK.' }] }); lines.push('Chat model (' + (aliCfg().model || 'qwen-flash') + '): working.'); }
      catch (e) { lines.push('Chat model: ' + e.message); }
      try { await aliTranscribe(wavBase64(new Float32Array(8000), 16000)); lines.push('Voice recogniser: working.'); }
      catch (e) { lines.push('Voice recogniser: ' + (e.status ? 'Alibaba answered, but said: ' + e.message : e.message)); }
      try { await aliTTS('你好', ttsVoiceNow()); lines.push('Voice (' + ALI_TTS_MODEL + '): working.'); }
      catch (e) { lines.push('Voice (' + ALI_TTS_MODEL + '): ' + e.message); }
      this.setState({ aliTesting:false, aliNote:lines.join(' ') });
    };
    setAsr = (m) => {
      if (m === 'alibaba' && !aliCfg().key) { this.setState({ aliNote:'Save an Alibaba key first, then you can use it to hear you.' }); return; }
      AICFG.asr = m; saveAiCfg(); this.setState({ asrMode:asrModeNow() });
    };
    // recording for Alibaba's recogniser: stops by itself after a pause once you have spoken (or when you tap again)
    recStop = null;
    aiRecord = async () => {
      if (this.state.aiListen) { if (this.recStop) this.recStop(true); return; }
      if (this.state.asrBusy || this.state.aiBusy) return;
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
      catch (e) { this.setState({ aiErr:'The microphone is blocked. Allow microphone access for this site in the browser, or type instead.' }); return; }
      let actx = null, node = null;
      const release = () => { try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} try { if (node) node.disconnect(); } catch (e) {} try { if (actx) actx.close(); } catch (e) {} };
      try {
        // the sound is taken straight from the microphone as raw samples (no MediaRecorder, so no compressed clip has to be decoded afterwards: that step fails on some browsers)
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC(); if (actx.resume) { try { await actx.resume(); } catch (e) {} }
        const rate = actx.sampleRate;
        const srcNode = actx.createMediaStreamSource(stream);
        const an = actx.createAnalyser(); an.fftSize = 1024; srcNode.connect(an);
        const buf = new Float32Array(an.fftSize);
        const parts = []; let total = 0;
        node = actx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (e) => { const d = e.inputBuffer.getChannelData(0); parts.push(new Float32Array(d)); total += d.length; };
        const mute = actx.createGain(); mute.gain.value = 0;   // keeps the processor running without playing the microphone back
        srcNode.connect(node); node.connect(mute); mute.connect(actx.destination);
        let heard = false, manual = false, stopped = false, lastVoice = Date.now(); const t0 = Date.now();
        const finish = async () => {
          const pcm = new Float32Array(total); let o = 0; parts.forEach(p => { pcm.set(p, o); o += p.length; });
          release(); this.recStop = null;
          if (!heard && !manual) { this.setState({ aiListen:false, aiErr:'I did not hear anything. Check your microphone, then try again.' }); return; }
          if (total < rate * 0.2) { this.setState({ aiListen:false, aiErr:'That was too short. Tap Speak and say a whole sentence.' }); return; }
          this.setState({ aiListen:false, asrBusy:true });
          try {
            const text = await aliTranscribe(wavBase64(to16k(pcm, rate), 16000));
            this.setState({ aiInput:text, asrBusy:false, aiAlts:[], aiErr:text ? '' : 'I could not make out any words. Try again a little closer to the microphone.' });
            this.aiAutoSend();
          } catch (e) { this.setState({ asrBusy:false, aiErr:(e && e.message) || 'The recording could not be read.' }); }
        };
        const stop = (byHand) => { if (stopped) return; stopped = true; manual = !!byHand; clearInterval(timer); finish(); };
        const timer = setInterval(() => {
          an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const now = Date.now();
          if (Math.sqrt(sum / buf.length) > 0.02) { heard = true; lastVoice = now; }
          if ((heard && now - lastVoice > 1500) || now - t0 > 30000 || (!heard && now - t0 > 8000)) stop(false);
        }, 100);
        this.recStop = stop;
        this.setState({ aiListen:true, aiErr:'', aiAlts:[] });
      } catch (e) { release(); this.setState({ aiListen:false, aiErr:'The microphone could not start. Type instead.' }); }
    };

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
        let r, patch;
        if (ALL) {
          // every shown level syncs its own file; only the words, grammar, speaking and listening progress comes back into this view
          let gist = SYNCCFG.gist || null, created = false;
          for (const n of LVLS) {
            const st = readStore(n) || {};
            const rr = await window.ShanluSync.round({ token:SYNCCFG.token, gistId:gist, state:st, file:window.ShanluSync.fileFor(n) });
            gist = rr.gistId; created = created || rr.created;
            try { localStorage.setItem(storeKey(n), JSON.stringify(Object.assign({}, st, window.ShanluSync.pick(rr.merged)))); } catch (e) {}
          }
          r = { gistId:gist, created };
          const tmp = Object.assign({}, this.state, readSplit());
          Object.keys(BANK).forEach(zh => { if (!tmp.ws[zh]) tmp.ws[zh] = blankWord(); });
          carryOverErhua(tmp);
          patch = {}; SPLIT.forEach(k => { patch[k] = tmp[k]; });
        } else {
          r = await window.ShanluSync.round({ token:SYNCCFG.token, gistId:SYNCCFG.gist || null, state:this.state, file:window.ShanluSync.fileFor(LV) });
          let next = rollDay(Object.assign({}, this.state, r.merged));
          carryOverErhua(next);
          patch = window.ShanluSync.pick(next);
          patch.rq = (patch.rq || []).filter(z => BANK[z]);
        }
        SYNCCFG.gist = r.gistId; SYNCCFG.at = Date.now(); saveSyncCfg();
        this.noSync = true; this.noMin = true;
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
    toggleRpy = () => { this.setState({ rpy:!this.state.rpy }); };
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
    pickLesson = (i) => { this.setState({ glesson:i, gramPick:false, ggopen:null, gq:'' }); try { window.scrollTo(0, 0); } catch (e) {} };
    pickTopic = (i) => { this.setState({ wtopic:i, wtmenu:false, wgopen:null, wtq:'' }); try { window.scrollTo(0, 0); } catch (e) {} };

    // ----- speaking practice: a scripted conversation you say out loud yourself -----
    sayIt = () => {
      const S = this.state;
      const sc = SCEN[S.sidx] || NO_SC;
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
    // a new random clip (see pickClip); `reset` clears the dictation box
    newClip = (extra) => { const S = this.state; const i = pickClip(S.clipBest, S.drecent); this.setState(Object.assign({ dclip:i, drecent:(S.drecent || []).concat([i]).slice(-8) }, extra || {})); };
    shadowNext = () => { this.newClip({ shround:0 }); };

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
    nextClip = () => { this.newClip({ dplays:0, dtyped:'', dchecked:false, dmarks:[], dreveal:0 }); };
    playTone = () => {
      const S = this.state;
      let idx = S.tidx;
      if (idx === null || S.tpick !== null) { idx = Math.floor(Math.random() * 4); this.setState({ tidx:idx, tpick:null }); }
      this.say(TONES[idx].zh, 'tone', 0.8);
    };
    playPair = () => {
      const S = this.state; const list = PAIR_LIST(); if (!list.length) return;
      let idx = S.t2idx;
      if (idx === null || idx >= list.length || (S.t2a !== null && S.t2b !== null)) {
        do { idx = Math.floor(Math.random() * list.length); } while (list.length > 1 && idx === S.t2idx);
        this.setState({ t2idx:idx, t2a:null, t2b:null });
      }
      this.say(list[idx].zh, 'tone2', 0.8);
    };
    pickPair = (slot, n) => {
      const S = this.state; const list = PAIR_LIST();
      if (S.t2idx === null || !list[S.t2idx] || (S.t2a !== null && S.t2b !== null)) return;
      const a = slot === 1 ? n : S.t2a, b = slot === 2 ? n : S.t2b;
      const patch = slot === 1 ? { t2a:n } : { t2b:n };
      if (a !== null && b !== null) {
        const t = list[S.t2idx].t;
        patch.t2total = S.t2total + 1; patch.t2right = S.t2right + (pairHit(t, 1, a) && pairHit(t, 2, b) ? 1 : 0);
      }
      this.setState(patch);
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
        const blob = new Blob([JSON.stringify({ app:'shanlu', version:1, level:LV, saved:new Date().toISOString(), data:out }, null, 2)], { type:'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'shanlu-progress-' + (LV === 1 ? '' : (ALL ? 'all-' : 'hsk' + LV + '-')) + ymd(new Date()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) {}
    };
    importData = () => { const el = document.getElementById('import-file'); if (el) el.click(); };
    importText = (text) => {
      try {
        const obj = JSON.parse(text);
        const data = obj && obj.data;
        if (!data || typeof data !== 'object' || !data.ws) throw new Error('not a progress file');
        const fileLv = obj.level == null ? 1 : obj.level;
        if (fileLv !== LV) { window.alert('That file is ' + (fileLv === 0 ? 'All levels' : 'HSK ' + fileLv) + ' progress, but this page is on ' + LVN + '. Switch level first, then import it.'); return; }
        const merged = mergeSaved(Object.assign({}, this.state), data);
        this.setState(rollDay(merged));
        this.persistNow();
      } catch (e) { window.alert('That file does not look like a Shanlu progress file.'); }
    };
    resetAll = () => {
      if (window.confirm((FR && FR.identity() ? 'You are in a friends group and your progress is also saved on its server, so it will come back at the next sync. To really start over, leave the group first (Friends tab). ' : '') + (ALL ? 'Delete the progress of every level shown here (' + LVLS.map(n => 'HSK ' + n).join(' and ') + ') in this browser? Export it first if you want a copy.' : 'Delete all progress in this browser? Export it first if you want a copy.'))) {
        try { localStorage.removeItem(KEY); if (ALL) LVLS.forEach(n => localStorage.removeItem(storeKey(n))); } catch (e) {}
        window.location.reload();
      }
    };
    switchLevel = (n) => {
      if (n === LV) return;
      this.persistNow();
      try { localStorage.setItem('shanlu-level', String(n)); } catch (e) {}
      window.location.reload();
    };
    toggleTheme = () => { this.setState({ theme:this.state.theme === 'dark' ? 'light' : 'dark' }); };

    aiVals() {
      const S = this.state;
      const aiEff = S.aiMode || !HAS_SCRIPTS;   // without practice scripts, Speak is the AI conversation only
      const quiet = !S.szh && !S.spy && !S.sen;
      const hasMic0 = S.asrMode === 'alibaba' ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)) : !!(window.webkitSpeechRecognition || window.SpeechRecognition);
      const vo = !!S.aiVoiceOnly && !S.aiTyping && hasMic0;   // voice only: Mingming's lines are heard, not read, until you tap Show text
      const msgs = S.aim.map((m, k) => ({
        who:m.who, isAi:m.who === 'ai', zh:m.zh, py:m.py, en:m.en,
        showZh:vo ? (m.who === 'me' || !!m.rev) : S.szh, showPy:vo ? (!!m.py && (m.who === 'me' || !!m.rev)) : S.spy && !!m.py, showEn:vo ? (!!m.rev && !!m.en && m.who === 'ai') : S.sen && !!m.en && m.who === 'ai',
        canReveal:vo && m.who === 'ai' && !m.rev, reveal:() => this.aiReveal(k),
        quiet:vo ? (m.who === 'ai' && !m.rev) : quiet, quietText:m.who === 'ai' ? 'Listen to Mingming' : 'You said it', pc:S.playing === 'aim' + k ? 'on' : '', play:() => this.sayAi(m.zh, 'aim' + k),
        hasOutside:m.outside.length > 0, outsideText:'Not in this site\'s HSK 1 or HSK 2 lists, so no pinyin: ' + m.outside.join(' '),
        hasPv:!!(m.pv && m.pv.length), pvText:'HSK ' + (TOPL + 1) + ' preview: ' + (m.pv || []).map(p => p.t + ' ' + p.py + ' = ' + p.en).join('  ·  '),
        hasFb:!!m.fb, fbBetter:m.fb ? m.fb.better : '', fbWhy:m.fb ? m.fb.why : '', hasOk:m.who === 'me' && !!m.judged && !m.fb,
        cmpGood:!!(m.cmp && m.cmp.same), cmpBad:!!(m.cmp && !m.cmp.same),
        cmpBadHead:m.cmp && !m.cmp.same ? 'Suggested: ' + m.cmp.sugZh + ' (' + m.cmp.sugPy + ')' : '',
        cmpBadDetail:m.cmp && !m.cmp.same ? (m.cmp.lens ? 'The suggestion has ' + m.cmp.lens.exp + ' characters and you had ' + m.cmp.lens.got + '.' : m.cmp.diffs.map(d => d.exp + (d.pe ? ' (' + d.pe + ')' : '') + ' → you: ' + d.got + (d.pg ? ' (' + d.pg + ')' : '') + (d.tone ? ' · same sound, different tone' : '')).join('  ·  ')) : ''
      }));
      const hasMic = S.asrMode === 'alibaba' ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)) : !!(window.webkitSpeechRecognition || window.SpeechRecognition);
      const lastM = S.aim[S.aim.length - 1];
      const sg = lastM && lastM.who === 'ai' && lastM.sug && !S.aiBusy ? lastM.sug : null;
      return {
        aiVo:vo, aiNotVo:!vo, aiVoToggleLabel:vo ? 'Type instead' : 'Voice only', aiVoToggle:this.aiVoToggle, aiCanVo:hasMic0,
        ttsOpts:[['qwen', 'Alibaba Qwen voice (needs the Alibaba key)'], ['browser', 'This browser\'s own voice']].map(o => ({ label:o[1], cls:S.ttsMode === o[0] ? 'on' : '', fn:() => this.setTtsMode(o[0]) })),
        ttsVoiceOpts:TTS_VOICES.map(v => ({ label:v[1], cls:S.ttsVoice === v[0] ? 'on' : '', fn:() => this.setTtsVoice(v[0]) })), ttsIsQwen:S.ttsMode === 'qwen',
        sugClosed:!!sg && !sg.open, sugOpen:!!sg && sg.open, sugZh:sg ? sg.zh : '', sugPy:sg ? sg.py : '', sugEn:sg ? sg.en : '',
        hasAlts:S.aiAlts.length > 0, altList:S.aiAlts.map(t => ({ t, fn:() => this.aiPickAlt(t) })), sugShow:this.aiShowSug, sugUse:this.aiUseSug, sugPc:S.playing === 'sug' ? 'on' : '', sugPlay:() => sg && this.sayAi(sg.zh, 'sug'),
        scriptMode:!aiEff, aiModeOn:aiEff, scriptCls:aiEff ? '' : 'on', aiCls:aiEff ? 'on' : '', hasModeSwitch:HAS_SCRIPTS,
        setScript:() => this.setAiMode(false), setAi:() => this.setAiMode(true),
        aiNoKey:aiEff && !S.aiOn, aiReady:aiEff && S.aiOn, aiMsgs:msgs, aiBusy:S.aiBusy, aiErr:S.aiErr, hasAiErr:!!S.aiErr,
        aiInput:S.aiInput, onAiInput:(e) => this.setState({ aiInput:e.target.value }), onAiKey:(e) => { if (e.key === 'Enter') this.aiSend(); },
        aiSend:this.aiSend, aiMic:this.aiMic, aiHasMic:hasMic, aiNoMic:!hasMic, aiMicLabel:S.asrBusy ? 'Transcribing…' : (S.aiListen ? 'Listening… tap to stop' : 'Speak'), aiMicCls:S.aiListen ? 'on' : (vo ? 'pri' : ''),
        aiScnList:[{ title:'Free chat', sub:'Anything simple', cls:S.aiScn === -1 ? 'cur' : '', fn:() => this.aiStart(-1) }].concat(AISCN.map((x, i) => ({ title:x.title, sub:x.sub, cls:S.aiScn === i ? 'cur' : '', fn:() => this.aiStart(i) }))),
        aiToday:(S.aiDays[ymd(new Date())] || 0) + ' messages today · ' + (S.aiProvider === 'alibaba' ? 'Qwen' : 'Claude'), aiSimpler:this.aiSimpler,
        aiSet:!!AICFG.key, aiUnset:!AICFG.key, aiKeyInput:S.aiKeyInput, onAiKeyInput:(e) => this.setState({ aiKeyInput:e.target.value }), aiSaveKey:this.aiSaveKey, aiRemoveKey:this.aiRemoveKey,
        aiModelOpts:AI_MODELS.map(m => ({ label:m[1], cls:S.aiModel === m[0] ? 'on' : '', fn:() => this.aiSetModel(m[0]) })), aiNote:S.aiNote, hasAiNote:!!S.aiNote,
        provAnthropic:S.aiTab !== 'alibaba', provAlibaba:S.aiTab === 'alibaba',
        provOpts:[['anthropic', 'Claude (Anthropic)'], ['alibaba', 'Qwen (Alibaba)']].map(o => ({ label:o[1] + (S.aiProvider === o[0] && S.aiOn ? ' · in use' : ''), cls:S.aiTab === o[0] ? 'on' : '', fn:() => this.viewProvider(o[0]) })),
        aliSet:S.aliOn, aliUnset:!S.aliOn, aliKeyInput:S.aliKeyInput, onAliKeyInput:(e) => this.setState({ aliKeyInput:e.target.value }),
        aliWsInput:S.aliWsInput, onAliWsInput:(e) => this.setState({ aliWsInput:e.target.value }), aliModelInput:S.aliModelInput, onAliModelInput:(e) => this.setState({ aliModelInput:e.target.value }),
        aliModelOpts:ALI_MODELS.map(m => ({ label:m[1], cls:S.aliModelInput === m[0] ? 'on' : '', fn:() => this.aliPreset(m[0]) })),
        aliCanUse:S.aliOn && S.aiProvider !== 'alibaba', aiCanUse:!!AICFG.key && S.aiProvider === 'alibaba', useAli:() => this.setProvider('alibaba'), useAnth:() => this.setProvider('anthropic'),
        aliSaveKey:this.aliSaveKey, aliRemoveKey:this.aliRemoveKey, aliTest:this.aliTest, aliTestLabel:S.aliTesting ? 'Testing…' : 'Test connection', aliNote:S.aliNote, hasAliNote:!!S.aliNote,
        asrOpts:[['browser', 'This browser\'s own recogniser'], ['alibaba', 'Alibaba Qwen3-ASR (needs the Alibaba key)']].map(o => ({ label:o[1], cls:S.asrMode === o[0] ? 'on' : '', fn:() => this.setAsr(o[0]) }))
      };
    }

    examVals() {
      const S = this.state, m = S.exm;
      const secName = (s) => (s === 'listening' ? 'Listening' : 'Reading');
      const hist = (S.exams || []).slice(-5).reverse().map(h => {
        const pts = (h.l != null ? secPts(h.l, h.lt || 20) : 0) + (h.r != null ? secPts(h.r, h.rt || 20) : 0);
        const what = h.mode === 'full' ? 'Full exam' : secName(h.mode);
        const parts = [];
        if (h.l !== null && h.l !== undefined) parts.push('Listening ' + h.l + '/' + (h.lt || 20));
        if (h.r !== null && h.r !== undefined) parts.push('Reading ' + h.r + '/' + (h.rt || 20));
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
        v.exBreakText = 'Listening finished: ' + l.correct + ' of ' + l.total + ' right. Next is Reading: ' + EXAM_N.reading + ' questions, ' + EXAM_MIN.reading + ' minutes. Take a breath first.';
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
          return { name:secName(s), text:r.correct + ' of ' + r.total, pts:secPts(r.correct, r.total) + ' / 100', pct:pct + '%', ok:pct >= LVL.PASS_PCT, cls:pct >= LVL.PASS_PCT ? 'good' : 'low', auto:r.auto,
            parts:Object.keys(r.byPart).map(p => ({ name:'Part ' + PART[p].n, score:r.byPart[p].c + ' / ' + r.byPart[p].t, cls:r.byPart[p].c === r.byPart[p].t ? 'good' : '' })) };
        });
        const total = ['listening', 'reading'].reduce((n, s) => n + (m.results[s] ? secPts(m.results[s].correct, m.results[s].total) : 0), 0);
        const seal = secs.length > 0 && secs.every(s => s.ok);
        const wrong = [];
        ['listening', 'reading'].forEach(s => { if (m.results[s]) m.results[s].wrong.forEach(w => wrong.push(w)); });
        Object.assign(v, {
          exSecs:secs, exFull:m.mode === 'full', exSingle:m.mode !== 'full', exTotal200:total + ' / 200', exPassReal:total >= 120,
          exVerdict:m.mode === 'full' ? (total >= 120 ? 'At or above 120 of 200, the pass mark of the official ' + LVN + ' test.' : 'Below 120 of 200, the pass mark of the official ' + LVN + ' test.') : 'One section only. The official pass mark is on the total of both sections.',
          exUnlock:seal && m.mode === 'full' && LV < LVL.MAX_LEVEL, exUnlockText:'You passed the ' + LVN + ' level exam. HSK ' + (LV + 1) + ' is now open.', exUnlockGo:() => this.switchLevel(LV + 1), exUnlockGoText:'Go to HSK ' + (LV + 1),
          exSeal:seal, exNoSeal:!seal, exSealText:seal ? (m.mode === 'full' ? 'You reached ' + LVL.PASS_PCT + '% in every section. That is this site\'s bar for the ' + LVN + ' seal.' : 'You reached ' + LVL.PASS_PCT + '% in the section you took. Take the full exam to open the next level.') : 'The seal here needs 80% in every section. Review the questions below and try again.',
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
          play:() => this.say(VOICE_SAMPLE, 'v:' + v.voiceURI, undefined, v), playCls:S.playing === 'v:' + v.voiceURI ? 'on' : '',
          use:() => this.setVoice(v.voiceURI), useLabel:on ? 'In use' : 'Use this voice', useCls:on ? 'on' : ''
        };
      });
      const everything = all.map(v => ({ line:v.name + ' · ' + v.lang + (v.localService ? '' : ' · online') }));
      let intro;
      if (!all.length) intro = 'Your browser has not listed any voices yet. If you just downloaded one, tap Refresh.';
      else if (!ranked.length) intro = 'Your browser lists ' + all.length + ' voices, but none of them is Mandarin Chinese, so audio on this site may be silent or in the wrong language.';
      else intro = 'Your browser lists ' + all.length + ' voices, ' + ranked.length + ' of them Mandarin. Unless you pick one, the site uses the best-sounding Mandarin voice it can find.';
      const speedOpts = [['Slow', 0.75], ['Relaxed', 0.9], ['Normal', 1], ['Quick', 1.15]].map(o => ({ label:o[0], cls:(S.speed || 1) === o[1] ? 'on' : '', fn:() => { this.setState({ speed:o[1] }); this.say(VOICE_SAMPLE, 'v:speed', o[1]); } }));
      return {
        speedOpts, speedNote:'Audio on this site plays at the voice\'s normal pace. Pick Slow or Relaxed if you want it slower. The Listening lab has its own speed buttons.',
        voiceIntro:intro, voiceRows:rows, hasVoices:rows.length > 0,
        autoCls:manual ? '' : 'on', autoLabel:manual ? 'Use automatic' : 'In use',
        autoName:chosen ? 'Automatic: ' + chosen.name : 'Automatic',
        autoPlay:() => this.say(VOICE_SAMPLE, 'v:auto'), autoPlayCls:S.playing === 'v:auto' ? 'on' : '',
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
      const memNow = { words:Math.round(infos.reduce((a, i) => a + (i.started ? i.recallN / 100 : 0), 0)), avg:(() => { const st = infos.filter(i => i.started); return st.length ? Math.round(st.reduce((a, i) => a + i.recallN, 0) / st.length) : 0; })() };
      const weekDates = [0, 1, 2, 3, 4, 5, 6].map(daysAgo);
      const weekMin = weekDates.reduce((a, d) => a + (d === ymd(new Date()) ? Math.max(S.dayMin, window.ShanluSync.dayMinutes(S, d)) : window.ShanluSync.dayMinutes(S, d)), 0);
      const weekDays = weekDates.filter(d => S.activity[d]).length;
      const startedCount = infos.filter(i => i.started).length;
      const vocabPct = Math.round(infos.reduce((a, i) => a + i.m, 0) / bankKeys.length);
      const gramPassed = LESSONS.filter(L => (S.gres[L.id] || 0) >= 80).length;
      const gramPct = Math.round(gramPassed / LESSONS.length * 100);
      const testReady = BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0)).length >= 3;
      const clipsTried = S.clipBest.filter(x => x > 0).length;
      const listenPct = HAS_LISTEN ? Math.round(S.clipBest.reduce((a, b) => a + b, 0) / CLIPS.length * 100) : 0;
      const spkDone = SCEN.filter(sc => S.sres[sc.id]).length;
      const spkPct = HAS_SCRIPTS ? Math.round(spkDone / SCEN.length * 100) : 0;
      const pctParts = [vocabPct, gramPct].concat(HAS_LISTEN ? [listenPct] : []).concat(HAS_SCRIPTS ? [spkPct] : []);
      const overall = Math.round(pctParts.reduce((a, b) => a + b, 0) / pctParts.length);
      const wm = {
        mastered:infos.filter(i => i.lv === 'mastered').length,
        familiar:infos.filter(i => i.lv === 'familiar' || i.lv === 'strong').length,
        learning:infos.filter(i => i.lv === 'learning').length
      };
      const streakShown = (S.lastActive === today || S.lastActive === daysAgo(1)) ? S.streak : 0;

      const active = S.screen === 'quiz' ? (S.qmode === 'grammar' ? 'grammar' : 'testlobby') : S.screen;
      const navCls = (k) => 'nav' + (active === k ? ' on' : '');

      // friends board
      const frIdent = FR && FR.enabled() ? FR.identity() : null;
      const frToday = ymd(new Date());
      const frRows = S.fr ? window.ShanluFriends.sortRows(S.fr.members.map(m => window.ShanluFriends.boardRow(m, frToday, S.fr.me)), S.frSort) : [];
      const frWeekMin = frRows.reduce((a, r) => a + r.minutes, 0);
      const frGoal = Math.max(1, frRows.length) * 100;
      const frAgo = S.frAt ? Math.max(0, Math.round((Date.now() - S.frAt) / 60000)) : 0;
      const frSorts = [['week', 'This week'], ['streak', 'Streak'], ['mem', 'In memory']];
      const frVals = {
        frJoined:!!frIdent, frNotJoined:!!(FR && FR.enabled()) && !frIdent, frOff:!(FR && FR.enabled()),
        frName:S.frName, frCode:S.frCode, frErr:S.frErr, frHasErr:!!S.frErr, frMsg:S.frMsg, frHasMsg:!!S.frMsg, frBusy:S.frBusy, frJoinText:S.frBusy ? 'Joining…' : 'Join group',
        onFrName:(e) => this.setState({ frName:e.target.value }), onFrCode:(e) => this.setState({ frCode:e.target.value }), friendsJoin:this.friendsJoin,
        frLoaded:!!S.fr, frWaiting:!!frIdent && !S.fr, frMine:frIdent ? frIdent.name : '', frGroup:frIdent ? frIdent.group : '',
        frWeekMin, frGoal, frGoalPct:Math.min(100, Math.round(frWeekMin / frGoal * 100)) + '%', frGoalText:frWeekMin + ' of ' + frGoal + ' min',
        frSortOpts:frSorts.map(x => ({ label:x[1], cls:S.frSort === x[0] ? 'on' : '', fn:() => this.setState({ frSort:x[0] }) })),
        frRows:frRows.map((r, i) => ({
          name:r.name, initial:r.initial, avCls:'c' + (i % 4), isMe:r.isMe, you:r.isMe ? 'You' : r.name, hasLv:r.level > 0, lvTag:'HSK ' + r.level, lvCls:'cur l' + r.level,
          strip:r.week.map(m => ({ cls:m > 0 ? 'on' : '' })), studied:r.studiedToday, cls:r.isMe ? 'me' : '',
          minutes:r.hasStats ? r.minutes + ' min' : 'New', sub:(r.hasStats ? (r.streak > 0 ? r.streak + ' day streak' : 'No streak yet') + ' · ' + r.mem + ' in memory' : 'Has not shared yet') + (r.isMe && r.cheers > 0 ? ' · ' + r.cheers + (r.cheers === 1 ? ' cheer' : ' cheers') + ' for you' : ''),
          canCheer:!r.isMe, cheerCls:r.cheered ? 'on' : '', hasCheers:r.cheers > 0, cheers:r.cheers, cheerLabel:(r.cheered ? 'You cheered ' : 'Cheer for ') + r.name, cheer:() => this.friendsCheer(r.id)
        })),
        frStudied:frRows.filter(r => r.studiedToday).length, frCount:frRows.length,
        frAvatars:frRows.slice(0, 8).map((r, i) => ({ initial:r.initial, cls:'fav c' + (i % 4) + (r.studiedToday ? ' done' : ' idle'), name:r.name + (r.studiedToday ? ' studied today' : ' has not studied today') })),
        frHomeShow:!!frIdent && !!S.fr && S.screen === 'home', frHomeText:frRows.filter(r => r.studiedToday).length + ' of ' + frRows.length + ' studied today',
        goFriendsHome:() => { this.go('friends'); this.friendsRefresh(false); },
        frUpdated:S.fr ? (frAgo < 1 ? 'Updated just now' : 'Updated ' + frAgo + ' min ago') : '', frRefresh:() => this.friendsRefresh(true),
        frLinkText:S.frCopied ? 'Copied' : 'Copy my link', frCopy:this.friendsCopyLink, frMyLink:frIdent ? window.ShanluFriends.makeLink(location.href, frIdent) : '',
        frLeaveText:S.frLeaveAsk ? 'Tap again to leave' : 'Leave group', frLeave:this.friendsLeave,
        frOffText:'The friends board is not set up yet. Add the address of your friends server to config.js (see worker/README.md).'
      };

      const titles = {
        home:['Welcome back', S.dayMin >= S.mins ? 'Daily goal reached. Anything else is a bonus.' : (S.mins - S.dayMin) + ' min to go for today\'s goal.'],
        review:['Review words', 'Words that are due, based on how well you remember them.'],
        testlobby:[LVN + ' test', 'Mixed questions from the words you have started, so you are recalling words, not just recognizing them.'],
        grammar:['Grammar', ALL ? LESSONS.length + ' lessons from every unlocked level, one at a time.' : LV === 1 ? LESSONS.length + ' lessons that cover the HSK 1 grammar outline, one at a time.' : LESSONS.length + ' lessons on the grammar of the ' + LVN + ' words, one at a time.'],
        speak:['Speaking practice', HAS_SCRIPTS ? 'Say a short conversation out loud.' : 'Talk with Mingming, the AI conversation partner.'],
        exam:[ALL ? 'Level exams' : LVN + ' level exam', ALL ? 'Each exam belongs to one level.' : LV === 1 ? 'Pass every section to climb to HSK 2.' : 'Not built yet for ' + LVN + '.'],
        web:['Word webs', 'Learn new words next to the words you already know.'],
        words:['My words', 'How well you know each word, and when it needs a refresh.'],
        friends:['Friends', FR && FR.identity() && FR.identity().group ? FR.identity().group + '. Only your study totals are shared.' : 'Study together. Only your study totals are shared.'],
        listen:['Listening lab', HAS_LISTEN ? 'Train your ear for how people really talk, not just how lessons sound.' : 'Not built yet for ' + LVN + '.'],
        voice:['Settings', LV <= 1 ? 'Sync your progress between devices, choose the level and the voice that reads Chinese aloud, and how 儿 endings are shown.' : 'Sync your progress between devices, choose the level and the voice that reads Chinese aloud.'],
        quiz:S.qmode === 'grammar' ? ['Grammar practice', LESSONS[S.glesson].title] : [LVN + ' test', 'Take your time. Wrong answers show you why.']
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
      const unstartedN = bankKeys.length - startedCount;   // words not yet started: the Learn task only makes sense while some are left
      const learnN = Math.max(1, Math.min(4, limitOf(S), unstartedN));
      const pool = [
        { glyph:'联', title:'Learn ' + learnN + (learnN === 1 ? ' new word with its relatives' : ' new words with their relatives'), meta:'Word webs', min:5, done:S.webCredited, to:'web', show:unstartedN > 0 || S.webCredited },
        { glyph:'词', title:'Review ' + Math.max(S.rtotal, dueNow) + ' word' + (Math.max(S.rtotal, dueNow) === 1 ? '' : 's'), meta:'Words that are due', min:reviewMin, done:S.rcomplete, to:'review', show:S.rcomplete || dueNow > 0 },
        { glyph:'听', title:'Listening drill', meta:'Dictation with a speed ladder', min:4, done:S.ldone, to:'listen', show:HAS_LISTEN },
        { glyph:'说', title:'Say: ' + (SCEN[nextScn] || NO_SC).title, meta:'Practice script, ' + (SCEN[nextScn] || NO_SC).you.length + ' turns', min:6, done:S.spokeToday, to:'speak', show:HAS_SCRIPTS, pre:() => this.setState({ sidx:nextScn, sturn:0, sdone:false }) },
        { glyph:'语', title:'Grammar: ' + LESSONS[nextLesson].title, meta:LESSONS[nextLesson].q.length + ' exercises', min:4, done:S.gdone, to:'grammar', pre:() => this.setState({ ggopen:null, gq:'', glesson:nextLesson }) },
        { glyph:'测', title:LVN + ' test', meta:'Mixed questions from your words', min:3, done:S.tdone, to:'testlobby', show:testReady }
      ].filter(t => t.show !== false);
      let planned = 0;
      const plan = [];
      pool.forEach(t => { if (planned + t.min <= S.mins) { plan.push(t); planned += t.min; } });
      const tasks = plan.map(t => ({ glyph:t.glyph, title:t.title, meta:t.meta, xp:t.min + ' min', done:t.done, open:!t.done, cls:t.done ? 'done' : '', go:() => { if (t.pre) t.pre(); this.go(t.to); } }));
      const minOpts = [10, 20, 30, 45].map(m => ({ label:m + ' min', cls:S.mins === m ? 'on' : '', fn:() => this.setState({ mins:m }) }));
      const planNote = planned + ' of ' + S.mins + ' minutes planned. A longer goal adds more to the list.';
      const skills = [
        { label:'Vocabulary', detail:startedCount + ' of ' + bankKeys.length + ' words started', w:vocabPct + '%' },
        { label:'Grammar', detail:gramPassed + ' of ' + LESSONS.length + ' lessons passed', w:gramPct + '%' }
      ].concat(HAS_LISTEN ? [{ label:'Listening', detail:clipsTried + ' of ' + CLIPS.length + ' clips tried', w:listenPct + '%' }] : [])
        .concat(HAS_SCRIPTS ? [{ label:'Speaking', detail:spkDone + ' of ' + SCEN.length + ' scripts done', w:spkPct + '%' }] : []);
      skills.forEach(k => { const n = parseInt(k.w, 10) || 0; k.pctN = n; k.dash = (n / 100 * 138.23).toFixed(1) + ' 138.23'; });
      const lvList = sd.levels.slice((ALL ? TOPL : LV) - 1);   // this level first, then the ones above it
      const lvN = lvList.length;
      const stairs = lvList.map((lv, i) => ({
        label:'HSK ' + lv[0], words:lv[1] ? lv[1] + ' words' : 'Advanced', h:(172 + i * (lvN > 7 ? 24 : 32)) + 'px',
        cls:i === 0 ? 'cur' : 'lock', isCur:i === 0, isLock:i !== 0,
        fillH:i === 0 ? overall + '%' : '0%', status:i === 0 ? overall + '% done' : (i <= 2 ? 'In review' : 'Locked')
      }));

      // the ascent: trail and mist views (art in ascent.js)
      const AS = window.ShanluAscent;
      const ascDark = S.theme === 'dark';
      const ascV = ['trail', 'stairs'].includes(S.ascView) ? S.ascView : 'trail';
      const apct = (v, tot) => (v / tot * 100).toFixed(2) + '%';
      const asLabels = (t) => t.labels.map(l => ({ left:apct(l.x, t.w), top:apct(l.y, t.h), cls:l.center ? 'c' : '', kind:l.kind, text:l.text, sub:l.sub, hasSub:!!l.sub }));
      const totalW = bankKeys.length;
      const trD = AS.trail({ started:startedCount, total:totalW, levels:lvList, dark:ascDark });
      const trP = AS.phoneTrail({ started:startedCount, total:totalW, levels:lvList, dark:ascDark });
      const youLabel = (t) => ({ left:apct(t.you.x, t.w), top:apct(t.you.y, t.h), cls:t === trD ? 'c' : '', kind:'you', text:'You are here', sub:startedCount + ' word' + (startedCount === 1 ? '' : 's') + ' kept', hasSub:true });
      const trailAlt = 'Mountain trail: ' + startedCount + ' of ' + totalW + ' words learned on the way to the ' + LVN + ' level exam';
      const nextM = AS.nextMilestone(startedCount, totalW);
      const toGo = nextM - startedCount;
      const prevM = [0].concat(AS.MILESTONES).filter(m => m < nextM).pop();
      const allStarted = startedCount >= totalW;
      const studiedToday = S.lastActive === today;
      const minsLeft = Math.max(0, S.mins - S.dayMin);
      const ascCta = dueNow > 0 ? { text:'Climb: review ' + dueNow + ' due word' + (dueNow === 1 ? '' : 's'), to:'review' }
        : (minsLeft > 0 ? { text:'Climb for ' + minsLeft + ' more minute' + (minsLeft === 1 ? '' : 's'), to:(startedCount >= totalW ? 'testlobby' : 'web') } : (startedCount >= totalW ? { text:'Test yourself', to:'testlobby' } : { text:'Learn new words', to:'web' }));
      // mist: one mountain per Word web topic; the mist thins as its words are learned
      const tinfo = TOPICS.map((t, i) => {
        const got = t.words.filter(zh => S.ws[zh] && winfo(S.ws[zh], 0).started).length;
        const tot = t.words.length;
        return { i, name:t.name, got, tot, clear:got === tot, near:got > 0 && got < tot && tot - got <= 3 };
      });
      const mistClear = tinfo.filter(t => t.clear).length;
      const openTopic = (i) => { this.go('web'); this.setState({ wmode:'topic', wtopic:i, wgopen:null, wtq:'' }); };
      const nearBest = tinfo.filter(t => t.got > 0 && !t.clear).sort((a, b) => (a.tot - a.got) - (b.tot - b.got) || a.i - b.i)[0];
      const mistTiles = tinfo.map(t => ({
        name:t.name, count:t.got + ' of ' + t.tot + ' words' + (t.clear ? ' · clear' : ''), clear:t.clear, near:t.near, nearText:(t.tot - t.got) + ' to clear',
        cls:t.near ? 'near' : '', art:AS.mist({ frac:t.got / t.tot, idx:t.i, dark:ascDark, w:212, h:84 }), go:() => openTopic(t.i)
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
      const sc = SCEN[S.sidx] || NO_SC;
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
        }, info, lvInfo(w.zh), dlt(w.zh), exFor(w.zh, revealed));
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
          revealed:rev, hidden:!rev, hint:(o.pair ? 'The partner of ' : 'The opposite of ') + A.en,
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
          reportUrl:report('Pairs and opposites', A.zh + ' / ' + B.zh + ': ' + o.note)
        }, dlt(B.zh));
      });
      const topicNow = TOPICS[S.wtopic];
      const topicChips = topicNow.words.map(zh => {
        const b = BANK[zh];
        const info = mini(zh);
        const isNew = info.lv === 'new';
        return Object.assign({ zh, py:b.py, en:b.en, cls:isNew ? 'new' : 'ok', canAdd:isNew && !capReached, capHit:isNew && capReached,
          play:() => this.say(zh, 'w' + zh), learn:() => this.learnWord(zh) }, info, lvInfo(zh), exFor(zh, true));
      });
      const topicStarted = topicNow.words.filter(zh => mini(zh).started).length;
      const topicOpts = TOPICS.map((t, i) => ({ label:t.name, count:tinfo[i].got + '/' + tinfo[i].tot, cls:(S.wtopic === i ? 'on' : '') + (tinfo[i].clear ? ' clear' : ''), fn:() => this.pickTopic(i) }));
      // two tiers: a group opens to show its topics. The group of the topic you are on is open by default; a search opens every group that matches.
      const normQ = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fff ]/g, '');
      const tq = normQ(S.wtq).trim();
      const tqc = tq.replace(/ /g, '');
      const topicMatch = (t) => {
        if (!tq || normQ(t.name).includes(tq)) return { ok:true, hint:'' };
        const hits = t.words.filter(z => { const b = BANK[z]; return z.includes(tq) || normQ(b.py).replace(/ /g, '').includes(tqc) || normQ(b.en).includes(tq); });
        return hits.length ? { ok:true, hint:hits.slice(0, 3).join(' ') } : { ok:false, hint:'' };
      };
      const curGroup = TOPICS[S.wtopic] ? TOPICS[S.wtopic].group : '';
      const openGroup = S.wgopen === null || S.wgopen === undefined ? curGroup : S.wgopen;
      let topicGroups = [];
      TOPICS.forEach((t, i) => {
        let g = topicGroups.find(x => x.label === t.group);
        if (!g) { g = { label:t.group, items:[], got:0, tot:0, n:0 }; topicGroups.push(g); }
        g.got += tinfo[i].got; g.tot += tinfo[i].tot; g.n++;
        const m = topicMatch(t);
        if (m.ok) g.items.push(Object.assign({}, topicOpts[i], { hint:m.hint, hasHint:!!m.hint }));
      });
      if (tq) topicGroups = topicGroups.filter(g => g.items.length);
      topicGroups.forEach(g => {
        const open = tq ? true : openGroup === g.label;
        Object.assign(g, { open, expanded:open ? 'true' : 'false', chev:open ? '▾' : '▸', cls:(open ? 'open ' : '') + (g.label === curGroup ? 'has-cur' : ''),
          countText:g.n + ' topics · ' + g.got + '/' + g.tot, toggle:() => { if (!tq) this.setState({ wgopen:open ? '' : g.label }); } });
      });
      const topicNoMatch = !!tq && topicGroups.length === 0;
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
      const rowsShown = rowsFiltered.slice(0, S.wshow).map(r => { const n = r.lv === 'new' ? 0 : Math.max(1, Math.min(5, Math.ceil((parseFloat(r.mW) || 0) / 20))); return Object.assign({}, r, lvInfo(r.zh), { dots:[0, 1, 2, 3, 4].map(i => ({ cls:i < n ? 'on' : '' })) }); });
      const dueAllN = rowsAll.filter(r => r.started && r.dueCls === 'due').length;
      const lvNow = (k) => lvCount[k] || 0;
      const moreCount = rowsFiltered.length - rowsShown.length;
      const sortOpts = [['weak', 'Weakest first'], ['due', 'Due soonest'], ['strong', 'Strongest first']].map(x => ({ label:x[1], cls:S.wsort === x[0] ? 'on' : '', fn:() => this.setState({ wsort:x[0] }) }));
      const timeOpts = [[0, 'Today'], [7, 'In 1 week'], [30, 'In 1 month']].map(x => ({ label:x[1], cls:S.woff === x[0] ? 'on' : '', fn:() => this.setState({ woff:x[0] }) }));

      // grammar
      const gqn = String(S.gq || '').toLowerCase().trim();
      const curCat = LESSONS[S.glesson] ? LESSONS[S.glesson].cat : '';
      const openCat = S.ggopen === null || S.ggopen === undefined ? curCat : S.ggopen;
      let lessonGroups = [];
      LESSONS.forEach((l, i) => {
        let g = lessonGroups.find(x => x.label === l.cat);
        if (!g) { g = { label:l.cat, blurb:l.catBlurb, items:[], total:0, passed:0 }; lessonGroups.push(g); }
        const best = S.gres[l.id]; const passed = (best || 0) >= 80;
        g.total++; if (passed) g.passed++;
        if (gqn && !(l.title.toLowerCase().includes(gqn) || l.cat.toLowerCase().includes(gqn))) return;
        const n = LESSON_LV[l.id];
        g.items.push({ n:i + 1, title:l.title, cls:(i === S.glesson ? 'cur ' : '') + (passed ? 'done' : '') + (ALL ? ' rl' + n : ''), tag:best === undefined ? '' : best + '%', fn:() => this.pickLesson(i),
          hasLvTag:ALL, lvTag:'HSK ' + n, lvCls:(n === TOPL ? 'cur' : 'old') + ' l' + n });
      });
      if (gqn) lessonGroups = lessonGroups.filter(g => g.items.length);
      lessonGroups.forEach(g => {
        const open = gqn ? true : openCat === g.label;
        Object.assign(g, { progress:g.passed + '/' + g.total, open, expanded:open ? 'true' : 'false', chev:open ? '▾' : '▸', cls:(open ? 'open ' : '') + (g.label === curCat ? 'has-cur' : ''), toggle:() => { if (!gqn) this.setState({ ggopen:open ? '' : g.label }); } });
      });
      const gramNoMatch = !!gqn && lessonGroups.length === 0;
      const L = LESSONS[S.glesson];
      const lessonBest = S.gres[L.id];
      const lesson = {
        kick:(L.cat ? L.cat + ' · ' : '') + 'Lesson ' + (S.glesson + 1) + ' of ' + LESSONS.length, hasLvTag:ALL, lvTag:'HSK ' + LESSON_LV[L.id], lvCls:(LESSON_LV[L.id] === TOPL ? 'cur' : 'old') + ' l' + LESSON_LV[L.id], title:L.title, pickLabel:(S.glesson + 1) + ' · ' + L.title,
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
      const shClip = CLIPS[S.dclip] || NO_CLIP;
      const shDone = S.shround >= 3;
      const shHelps = ['Read along and say it right after you hear it.', 'Same again, with characters only.', 'Now with no text. Say it from what you hear.', 'All three rounds done. Try the same clip again tomorrow.'];

      // listening lab
      const clip = CLIPS[S.dclip] || NO_CLIP;
      const clipBest = (S.clipBest && S.clipBest[S.dclip]) || 0;
      const lvInfo2 = (i) => (ALL && CLIP_LV[i] ? { hasClipLv:true, clipLv:'HSK ' + CLIP_LV[i], clipLvCls:(CLIP_LV[i] === TOPL ? 'cur' : 'old') + ' l' + CLIP_LV[i] } : { hasClipLv:false, clipLv:'', clipLvCls:'' });
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
      const pairList = PAIR_LIST(); const pair = S.t2idx !== null ? pairList[S.t2idx] : null;
      const pairDone = !!pair && S.t2a !== null && S.t2b !== null;
      const pairOk = pairDone && pairHit(pair.t, 1, S.t2a) && pairHit(pair.t, 2, S.t2b);
      const pairOpts = (slot) => Array.from({ length:slot === 1 ? 4 : 5 }, (_, i) => {
        const n = i + 1, mine = slot === 1 ? S.t2a : S.t2b;
        const good = !!pair && pairHit(pair.t, slot, n), chosen = mine === n;
        return { py:n === 5 ? 'ma' : TONES[i].py, label:n === 5 ? 'Light and short' : TONES[i].label,
          cls:pairDone ? (good && (chosen || !pairHit(pair.t, slot, mine)) ? 'right' : (chosen ? 'wrong' : '')) : (chosen ? 'right' : ''),
          fn:() => this.pickPair(slot, n) };
      });
      const tn = (n) => n === 5 ? 'light' : String(n);
      const pairW = pair ? BANK[pair.zh] : null;
      const pairLine = !pairDone ? '' : (pairOk ? 'Right. ' : 'Not quite. ') + pair.zh + ' ' + pairW.py + ' (' + pairW.en + ') is tone ' + tn(pair.t[0]) + ' + ' + tn(pair.t[1]) + '.'
        + (pair.t[0] === 3 && pair.t[1] === 3 ? ' Two third tones in a row: the first one is said as a rising tone, so it sounds like 2 + 3. Both answers count.' : '');
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
        gapLine, examParts, navExam:navCls('exam'), goExam:() => this.go('exam'), isExam:S.screen === 'exam' && !!EXAMBANK, isExamNA:S.screen === 'exam' && !EXAMBANK,

        // word webs and word memory
        navWeb:navCls('web'), goWeb:() => this.go('web'), isWeb:S.screen === 'web',
        navWords:navCls('words'), goWords:() => this.go('words'), isWords:S.screen === 'words',
        friendsOn:!!(FR && FR.enabled()), navFriends:navCls('friends'), isFriends:S.screen === 'friends',
        goFriends:() => { this.go('friends'); this.friendsRefresh(false); },
        ...frVals,
        isWChar:S.wmode === 'char', isWOpp:S.wmode === 'opp', isWTopic:S.wmode === 'topic',
        wCharCls:S.wmode === 'char' ? 'on' : '', wOppCls:S.wmode === 'opp' ? 'on' : '', wTopicCls:S.wmode === 'topic' ? 'on' : '',
        setWChar:() => this.setState({ wmode:'char' }), setWOpp:() => this.setState({ wmode:'opp' }), setWTopic:() => this.setState({ wmode:'topic' }),
        quizOffCls:S.wquiz ? '' : 'on', quizOnCls:S.wquiz ? 'on' : '',
        setQuizOff:() => this.setState({ wquiz:false }), setQuizOn:() => this.setState({ wquiz:true }),
        webCountText:limitOf(S) === Infinity ? webCount + ' new words today' : webCount + ' of ' + S.nlimit + ' new words today', capNote:capReached, capCount:S.nlimit, capOpts,
        hubHasNew:hubNew > 0 && !capReached, hubAddAllText:'Add all ' + hubNew + ' new word' + (hubNew === 1 ? '' : 's'), hubAddAll:() => this.learnMany(hubNow.words.map(w => w.zh)),
        topicHasNew:topicNew > 0 && !capReached, topicAddAllText:'Add all ' + topicNew + ' new word' + (topicNew === 1 ? '' : 's'), topicAddAll:() => this.learnMany(topicNow.words),
        moreDue:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft > 0, hasMoreDue:dueLeft > 0, reviewMore:this.reviewMore,
        moreDueText:'Review ' + dueLeft + ' word' + (dueLeft === 1 ? '' : 's'), dueLeftText:dueLeft + ' word' + (dueLeft === 1 ? ' is' : 's are') + ' still due.', topicProgress:topicStarted + ' of ' + topicNow.words.length + ' started',
        hubCards, hubOpts, hubZh:hubNow.hub, hubPy:hubNow.py, hubEn:hubNow.en,
        fillEn:gapNow.en, fillZh:gapNow.zh, gapOpts, gapDone, gapOptsCls:gapDone ? 'locked' : '', fillLine, gapNext:this.gapNext,
        fillReport:report('Which word fits?', gapNow.zh + ' = ' + gapNow.ans + ' / ' + gapNow.en),
        oppRows, topicChips, topicOpts, topicGroups, topicName:topicNow.name, wtq:S.wtq, onTopicSearch:(e) => this.setState({ wtq:e.target.value }), topicNoMatch, topicPos:(S.wtopic + 1) + ' of ' + TOPICS.length, topicMenuOpen:S.wtmenu ? 'true' : 'false', topicMenuShow:S.wtmenu, toggleTopicMenu:() => this.setState({ wtmenu:!this.state.wtmenu }), topicPrev:() => this.pickTopic((S.wtopic + TOPICS.length - 1) % TOPICS.length), topicNext:() => this.pickTopic((S.wtopic + 1) % TOPICS.length), tsZh:topicNow.sentence.zh, tsPy:topicNow.sentence.py, tsEn:topicNow.sentence.en,
        tsReport:report('Topic sentence', topicNow.sentence.zh + ' ' + topicNow.sentence.en),
        topicCta:topicNow.cta, goTopic:() => this.go(topicNow.to),
        hasRlast:!!S.rlast, rlastText:S.rlast ? S.rlast.zh + ': mastery ' + S.rlast.from + '% → ' + S.rlast.to + '%' : '', rlastCls:S.rlast && S.rlast.to < S.rlast.from ? 'down' : 'up',
        wordsSumLine:lvNow('mastered') + ' mastered · ' + lvNow('strong') + ' strong · ' + lvNow('familiar') + ' familiar · ' + lvNow('learning') + ' learning · ' + lvNow('new') + ' new',
        wordsReviewText:dueAllN > 0 ? 'Review ' + dueAllN + ' due word' + (dueAllN === 1 ? '' : 's') : (startedCount >= totalW ? 'Practice all my words' : 'Learn new words'), wordsReviewGo:() => this.go(dueAllN > 0 || startedCount >= totalW ? 'review' : 'web'),
        bankCount:rowsAll.length, filters, levelSegs, sortOpts, timeOpts, rows:rowsShown, hasMoreWords:moreCount > 0, moreWordsText:'Show 40 more (' + moreCount + ' left)', showMoreWords:() => this.setState({ wshow:S.wshow + 40 }),
        wq:S.wq, onWSearch:(e) => this.setState({ wq:e.target.value, wshow:40 }), noRows:rowsShown.length === 0,

        // shadowing
        isShadow:S.lmode === 'shadow', lShadowCls:S.lmode === 'shadow' ? 'on' : '', setShadow:() => this.setState({ lmode:'shadow' }),
        shNow:Math.min(S.shround + 1, 3), shTitle:'Say it after you hear it', shHelp:shHelps[S.shround],
        shZh:shClip.zh, shPy:shClip.py,
        shShowZh:S.shround < 2 || shDone, shShowPy:S.shround === 0 || shDone, shHidden:S.shround === 2,
        shCanGo:!shDone, shDone, shGoLabel:'I said it',
        shadowGo:this.shadowGo, shadowNext:this.shadowNext,

        // listening lab
        navListen:navCls('listen'), goListen:() => this.go('listen'), isListen:S.screen === 'listen' && HAS_LISTEN, isListenNA:S.screen === 'listen' && !HAS_LISTEN,
        isDict:S.lmode === 'dict', isTone:S.lmode === 'tone',
        lDictCls:S.lmode === 'dict' ? 'on' : '', lToneCls:S.lmode === 'tone' ? 'on' : '',
        setDict:() => this.setState({ lmode:'dict' }), setTone:() => this.setState({ lmode:'tone' }),
        stepText:S.dchecked ? 'Step 3 of 3 · Read it, then listen again' : (S.dplays === 0 ? 'Step 1 of 3 · Listen without help' : 'Step 2 of 3 · Type what you heard'),
        clipBadge:clipBest > 0 ? 'Best so far ' + Math.round(clipBest * 100) + '%' : 'New clip', clipBadgeCls:clipBest >= 0.99 ? 'done' : (clipBest > 0 ? 'again' : 'new'),
        clipTried:clipsTried + ' of ' + CLIPS.length + ' clips tried', skipClip:this.nextClip, canSkip:!S.dchecked,
        ...lvInfo2(S.dclip), playedText:S.dplays === 0 ? 'Not played yet.' : 'Played ' + S.dplays + (S.dplays === 1 ? ' time.' : ' times.'),
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
        clipReport:report('Listening clip ' + clip.zh, clip.zh + ' / ' + clip.en + ' / ' + clip.notes.join(' | ')),
        clearPlay:() => this.say(clip.zh, 'clear', 0.7), naturalPlay:() => this.say(clip.zh, 'nat', 1.1),
        clearCls:pc('clear') ? 'ink' : '', natCls:pc('nat') ? 'ink' : '',
        hasMissed:missed.length > 0, missedList:missed.map(w => w.py + ' ' + w.zh).join(', '),
        toneOpts, playTone:this.playTone, tonePlayCls:pc('tone'),
        toneOne:S.tmode === 'one', toneTwo:S.tmode === 'two', tOneCls:S.tmode === 'one' ? 'on' : '', tTwoCls:S.tmode === 'two' ? 'on' : '',
        setTone1:() => this.setState({ tmode:'one' }), setTone2:() => this.setState({ tmode:'two' }),
        playPair:this.playPair, pairPlayCls:pc('tone2'), pairOpts1:pairOpts(1), pairOpts2:pairOpts(2),
        pairIdle:S.t2idx === null, pairAnswered:pairDone, pairLine, hasPairStats:S.t2total > 0, pairStats:S.t2right + ' of ' + S.t2total + ' right', hasPairs:pairList.length > 0,
        toneIdle:S.tidx === null, toneAnswered:S.tpick !== null,
        toneLine:S.tpick === null ? '' : (S.tpick === S.tidx ? 'Right. ' : 'Not quite. ') + 'That was ' + TONES[S.tidx].py + ': ' + TONES[S.tidx].label.toLowerCase() + '.',
        hasToneStats:S.ttotal > 0, toneStats:S.tright + ' of ' + S.ttotal + ' right',
        weak, hasWeak:weak.length > 0, noWeak:weak.length === 0, phrases,
        overall, streak:streakShown, streakText:streakShown + (streakShown === 1 ? ' day' : ' days'), xpText:S.xp.toLocaleString('en-US'), dayXp:S.dayXp,
        memText:memNow.words.toLocaleString('en-US') + ' in memory', memTip:'Words you would probably recall right now: each started word counts by its recall chance. It rises when you learn and review and falls if reviews slide.',
        memWords:memNow.words.toLocaleString('en-US'), memToday:(memNow.words - (S.mem0 == null ? memNow.words : S.mem0) >= 0 ? '+' : '') + (memNow.words - (S.mem0 == null ? memNow.words : S.mem0)) + ' today', memRecall:memNow.avg + '%',
        weekMin:weekMin, weekDays:weekDays,
        title:tt[0], subtitle:tt[1],
        navHome:navCls('home'), navReview:navCls('review'), navTest:navCls('testlobby'), navGrammar:navCls('grammar'), navSpeak:navCls('speak'),
        goHome:() => this.go('home'), goReview:() => this.go('review'), goTest:() => this.go('testlobby'), goGrammar:() => this.go('grammar'), goSpeak:() => this.go('speak'),
        hasDue:S.rq.length > 0 && !S.rcomplete, dueCount:S.rq.length,
        exTitle:LVN + ' mock exam',
        exIntro:LV === 1 ? 'Built like the official HSK 1 sample papers: 20 listening and 20 reading questions in four parts each, about 35 minutes. No hints and no pinyin while you answer. Each exam is drawn from a bank of 120+ questions, so it is different every time.' : 'Built like the HSK 2 sample papers of the 2012 test: 35 listening and 25 reading questions in four parts each, about 47 minutes. No hints and no pinyin while you answer (the real paper has pinyin). Each exam is drawn from a bank of 140+ questions, so it is different every time.',
        exListenT:'Listening · ' + EXAM_N.listening + ' questions · ' + EXAM_MIN.listening + ' min',
        exListenD:LV === 1 ? 'Part 1: does the picture match? Part 2: pick the picture for a sentence. Part 3: match five conversations to pictures. Part 4: a conversation, a question, three answers. Each clip can be played twice.' : 'Part 1 (10): does the picture match the sentence? Part 2 (10): match conversations to pictures. Part 3 (10): a short conversation, a question, three answers. Part 4 (5): a longer conversation, a question, three answers. Each clip can be played twice.',
        exReadT:'Reading · ' + EXAM_N.reading + ' questions · ' + EXAM_MIN.reading + ' min',
        exReadD:LV === 1 ? 'Part 1: does the picture match the words? Part 2: match five sentences to pictures. Part 3: match five questions to answers. Part 4: fill five blanks from a word list.' : 'Part 1 (5): match sentences to pictures. Part 2 (5): fill blanks from a word list. Part 3 (5): do two sentences mean the same? Part 4 (10): match questions to answers.',
        exNote:LV === 1 ? 'The real test has pictures; here emoji stand in for them. The official 2025 test is said to have 20 listening questions (about 12 minutes of audio) and 20 reading questions (20 minutes); the part-by-part layout above is from the official sample papers and I could not confirm every detail of the 2025 version. Listening gets 15 minutes here because you press play yourself.' : 'The real test has pictures; here emoji stand in for them. This layout follows the 2012 (HSK 2.0) sample papers. I could not find the layout of the 2025 HSK band 2 exam, so it may differ. Listening gets 25 minutes because you press play yourself.',
        exScore:(LV === 1 ? 'Each question is worth 5 points, so each section is out of 100 and the total out of 200.' : 'Each section is worth 100 points, shared evenly by its questions (listening about 2.9 points a question, reading 4), so the total is out of 200.') + ' The official ' + LVN + ' pass mark is 120 of 200 (I am not sure whether the 2025 version changed it). This site\'s ' + LVN + ' seal is stricter: ' + LVL.PASS_PCT + '% in every section of one full exam, and it opens ' + (LV < LVL.MAX_LEVEL ? 'HSK ' + (LV + 1) : 'the next level') + '.',
        chatVocab:TOPL === 1 ? 'HSK 1 vocabulary only' : 'HSK 1 and HSK 2 vocabulary only', lvName:LVN, nextLvName:'HSK ' + (TOPL + 1), lvIs1:TOPL === 1, lvIs2:TOPL !== 1, hasExamCard:!!EXAMBANK, noExamCard:!EXAMBANK,
        examCardTitle:ALL ? 'Level exams' : EXAMBANK ? LVN + ' level exam' : LVN + ' progress', examCardNote:ALL ? 'Each level has its own exam. Switch to HSK 1 or HSK 2 in the header to take it; passing it opens the next level. The rings show your progress across all the levels shown here.' : EXAMBANK ? (LVL.levelPassed(LV) ? LVN + ' exam passed.' + (LV < LVL.MAX_LEVEL ? ' HSK ' + (LV + 1) + ' is open.' : '') : (LV < LVL.MAX_LEVEL ? 'Pass the full exam (' + LVL.PASS_PCT + '% in listening and in reading) to open HSK ' + (LV + 1) + '. The rings show how ready you are.' : 'Reach ' + LVL.PASS_PCT + '% in listening and in reading to pass.')) : 'The ' + LVN + ' level exam, listening lab and practice scripts are not built yet. These rings show the parts that are.',
        examBtnText:'See the ' + LVN + ' level exam',
        examNaTitle:ALL ? 'Level exams are taken one level at a time' : LVN + ' mock exam: not built yet',
        examNaText:ALL ? 'Each mock exam belongs to one level. Switch to HSK 1 or HSK 2 in the header, take its exam there, and passing it opens the next level. Everything else on this page mixes all the levels you have unlocked.' : 'The mock exam is modelled on the official HSK 1 sample papers and exists for HSK 1 only so far. For ' + LVN + ', the Tests screen gives mixed questions from the words you have started, and Grammar has practice for every lesson.',
        lvOpts:[1, 2, 0].map(n => { if (n === 0) { const openAll = LVL.unlockedLevels().length >= 2; return { label:'All' + (openAll ? '' : ' 🔒'), cls:(ALL ? 'on' : '') + (openAll ? '' : ' locked'), fn:() => (openAll ? this.switchLevel(0) : this.setState({ lvMsg:99 })) }; } const open = LVL.unlocked(n); return { label:'HSK ' + n + (open ? '' : ' 🔒'), cls:(LV === n ? 'on' : '') + (open ? '' : ' locked'), fn:() => (open ? this.switchLevel(n) : this.setState({ lvMsg:n })) }; }),
        lvMsgShow:S.lvMsg > 0 && (S.lvMsg === 99 ? LVL.unlockedLevels().length < 2 : !LVL.unlocked(S.lvMsg)) ? true : false, lvMsgText:S.lvMsg === 99 ? 'All levels shows every level you have unlocked together, so it needs at least two. Pass the HSK 1 level exam (the full mock exam with at least ' + LVL.PASS_PCT + '% in listening and in reading, in one sitting) to unlock HSK 2.' : 'HSK ' + S.lvMsg + ' is locked. It opens when you pass the HSK ' + (S.lvMsg - 1) + ' level exam: the full mock exam with at least ' + LVL.PASS_PCT + '% in listening and ' + LVL.PASS_PCT + '% in reading, in one sitting.',
        lvMsgGo:() => { const tgt = S.lvMsg === 99 ? 1 : S.lvMsg - 1; this.setState({ lvMsg:0 }); if (LV === tgt) this.go('exam'); else { try { localStorage.setItem('shanlu-level', String(tgt)); } catch (e) {} window.location.reload(); } },
        lvMsgClose:() => this.setState({ lvMsg:0 }), lvMsgGoText:LV === (S.lvMsg === 99 ? 1 : S.lvMsg - 1) ? 'Go to the HSK ' + LV + ' exam' : 'Open HSK ' + (S.lvMsg === 99 ? 1 : S.lvMsg - 1),
        lvNote:'You are studying ' + LVN + '. Each level keeps its own progress on this device and its own copy when you sync. A level opens when you pass the exam of the level before it (the full mock exam with ' + LVL.PASS_PCT + '% in listening and in reading); a lock on a button means it is not open yet. ' + (LV === 1 ? 'HSK 1 has everything: words, word webs, grammar, listening lab, practice scripts, AI conversation and the mock exam.' : 'HSK 2 has words, word webs, grammar, tests and the AI conversation. The listening lab, practice scripts and mock exam are not built for HSK 2 yet.'),
        isHome:S.screen === 'home', isVoice:S.screen === 'voice', isReview:S.screen === 'review', isLobby:S.screen === 'testlobby', isGrammar:S.screen === 'grammar', isSpeak:S.screen === 'speak', isQuiz:S.screen === 'quiz',

        // home
        ringDash, todayLine:titles.home[1], tasks, minOpts, planNote, dayMin:S.dayMin, mins:S.mins, skills, wordTarget:bankKeys.length, wmTotal:startedCount, wm,
        wMastered:(wm.mastered / bankKeys.length * 100).toFixed(1) + '%', wFamiliar:(wm.familiar / bankKeys.length * 100).toFixed(1) + '%', wLearning:(wm.learning / bankKeys.length * 100).toFixed(1) + '%',
        stairs, sysNote:sd.note,
        todayShort:S.dayMin + ' of ' + S.mins + ' min' + (S.mins > S.dayMin ? ' · ' + (S.mins - S.dayMin) + ' to go' : ' · done'),
        webCapOpen:S.webCapOpen, toggleCapOpen:() => this.setState({ webCapOpen:!S.webCapOpen }),
        ascTrail:ascV === 'trail', ascStairs:ascV === 'stairs', ascHasSys:true,
        ascTrailCls:ascV === 'trail' ? 'on' : '', ascStairsCls:ascV === 'stairs' ? 'on' : '',
        setAscTrail:() => this.setState({ ascView:'trail' }), setAscStairs:() => this.setState({ ascView:'stairs' }),
        ascSub:ascV === 'trail' ? 'Every word you learn is a step up the trail.' : 'Pass each checkpoint to climb to the next level.',
        trailD:{ src:trD.src, alt:trailAlt, labels:asLabels(trD).concat([youLabel(trD)]) }, trailP:{ src:trP.src, alt:trailAlt, labels:asLabels(trP).concat(trP.hideYou ? [] : [youLabel(trP)]) },
        cairnBig:allStarted ? 'All ' + totalW + ' started' : toGo + ' word' + (toGo === 1 ? '' : 's') + ' to go',
        cairnSub:allStarted ? 'Take the level exam when you feel ready.' : startedCount + ' of ' + nextM + '. A few cards and it is yours.', cairnPct:(allStarted ? 100 : Math.round((startedCount - prevM) / (nextM - prevM) * 100)) + '%',
        fireBig:streakShown > 0 ? streakShown + ' day' + (streakShown === 1 ? '' : 's') + ' lit' : 'Not lit yet',
        fireSub:studiedToday ? 'Lit for today. Come back tomorrow to keep it.' : (streakShown > 0 ? 'Study today and it burns brighter tomorrow.' : 'Study today to light it.'),
        todayBig:S.dayMin + ' of ' + S.mins + ' min', todaySub:minsLeft > 0 ? minsLeft + ' more minute' + (minsLeft === 1 ? '' : 's') + ' closes today\'s ring.' : 'Today\'s ring is closed. Anything else is a bonus.', todayPct:Math.min(100, Math.round(S.dayMin / Math.max(1, S.mins) * 100)) + '%',
        trailCta:() => this.go(ascCta.to), trailCtaText:ascCta.text,
        trailNote:'Camps are placed by level, not to scale. The climb counts the ' + LVN + ' words you have started; grammar, listening and speaking count towards the level exam.',
        mistClearText:mistClear + ' of ' + TOPICS.length + ' clear', mistTiles, mistHasNear:!!nearBest, mistOpen:S.wmist, toggleMist:() => this.setState({ wmist:!this.state.wmist }), mistToggleText:S.wmist ? 'Hide the mountains' : 'Show all ' + TOPICS.length + ' mountains',
        mistNearText:nearBest ? 'Finish ' + nearBest.name + ' (' + (nearBest.tot - nearBest.got) + ' to go)' : '', mistNearGo:() => nearBest && openTopic(nearBest.i),
        mistNote:'A mountain is clear when you have started every word in its Word web topic.',
        sys2Cls:S.sys === '2.0' ? 'on' : '', sys3Cls:S.sys === '3.0' ? 'on' : '',
        setSys2:() => this.setState({ sys:'2.0' }), setSys3:() => this.setState({ sys:'3.0' }),

        // review
        inReview:!S.rcomplete && S.rq.length > 0, rcomplete:S.rcomplete, rdone:S.rdone, rtotal:S.rtotal, rxp:S.rxp, rcounts:S.rcounts,
        rPct:(S.rtotal ? Math.round(S.rdone / S.rtotal * 100) : 0) + '%',
        emptyNew:!S.rcomplete && S.rq.length === 0 && startedCount === 0,
        caughtUp:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft === 0, nextDueText, practiceAnyway:this.practiceAnyway,
        card, flip:this.flip, rflip:S.rflip, flipCls:S.rflip ? 'flip' : '', flipLabel:S.rflip ? 'Flip the card back' : 'Show the answer',
        cardAnim:S.rstep % 2 === 0 ? 'ea' : 'eb', showAnswerBtn:!S.rflip, rates,
        rpyShow:S.rpy && !S.rflip, toggleRpy:this.toggleRpy, pyBtnText:S.rpy ? 'Hide pinyin' : 'Show pinyin', quickNo:rates[0], quickYes:rates[2],
        playWord:() => this.say(rw.zh, 'word'), playWordCls:pc('word') ? 'ink' : '',
        playEx:() => this.say(rex.zh, 'ex'), playExCls:pc('ex') ? 'ink' : '',

        // lobby
        startTest:() => this.startQuiz('test'), testReady, testBlocked:!testReady,
        testInfo:(Math.min(10, Math.max(5, BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0)).length))) + ' questions · about 4 minutes',
        recent:S.testHistory.map((r, i, a) => ({ date:r.date, score:r.score, h:Math.round(r.score * 1.4) + 'px', cls:i === a.length - 1 ? 'last' : '' })),
        hasRecent:S.testHistory.length > 0, noRecent:S.testHistory.length === 0,

        // grammar
        lessonGroups, gramNoMatch, gq:S.gq, onGramSearch:(e) => this.setState({ gq:e.target.value }), lesson, gramPickOpen:S.gramPick ? 'true' : 'false', gramListCls:S.gramPick ? 'open' : '', toggleGramPick:() => this.setState({ gramPick:!S.gramPick }),
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
        fbTitle:S.qcorrect ? 'Correct' : 'Not quite',
        next:this.next, nextLabel:S.qi + 1 >= total ? 'See results' : 'Continue',
        qcombo:S.qcombo, comboCls:S.qcombo >= 2 ? 'on' : '', exitQuiz:this.exitQuiz,
        resTitle, resSub, resScore:S.qscore + '/' + total, qbest:S.qbest, resGain,
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
      else if ((e.key === 'p' || e.key === 'P') && !S.rflip) { app.toggleRpy(); }
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
  window.addEventListener('pagehide', () => { app.persistNow(); app.friendsPush({ minGap:2 * 60 * 1000, keepalive:true }); });
  app.friendsBoot();
  if (SYNCCFG.token) setTimeout(() => app.syncNow(false), 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { app.persistNow(); app.friendsPush({ minGap:2 * 60 * 1000, keepalive:true }); } else { app._schedule(); if (SYNCCFG.token) app.syncNow(false); } });
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
