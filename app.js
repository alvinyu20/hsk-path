/* Shanlu: the app logic.
 * State lives in one object. Progress is saved in this browser (localStorage) and can be exported to a file.
 * Content comes from data/hsk1.js. The page template is in index.html and rendered by runtime.js.
 */
(function () {
  // "儿 endings" switch (see erhua.js). Plain forms are the default; the setting is read here, before any content is used.
  const AI_STORE = 'shanlu-ai';   // { key, model } lives only on this device
  let AICFG = {};
  try { AICFG = JSON.parse(localStorage.getItem(AI_STORE)) || {}; } catch (e) {}
  // Saving can fail (storage full, blocked, a private tab). The person must hear about it instead of quietly losing progress:
  // the first failure raises a banner (app.setState({ saveFail:true }), see the bottom of this file) and the next success clears it.
  let saveFailed = false, onSaveState = null, lsFails = 0, saveInfo = '';
  const SAVE_RETRY_MS = (typeof window.SHANLU_SAVE_RETRY_MS === 'number') ? window.SHANLU_SAVE_RETRY_MS : 10000;   // (the browser tests shorten it)
  const lsSet = (k, v) => {
    try { localStorage.setItem(k, v); if (saveFailed) { saveFailed = false; if (onSaveState) onSaveState(false); } return true; }
    catch (e) {
      lsFails++;
      let used = 0; try { for (let i = 0; i < localStorage.length; i++) { const kk = localStorage.key(i); used += kk.length + (localStorage.getItem(kk) || '').length; } } catch (e2) { used = -1; }
      const prevInfo = saveInfo;
      saveInfo = 'Detail for the developer: could not write "' + k + '" (' + Math.round(String(v).length / 1024) + ' KB), error ' + ((e && e.name) || 'unknown') + (used >= 0 ? ', this site stores ' + Math.round(used / 1024) + ' KB in total' : ', storage could not be read at all') + '.';
      if (!saveFailed) { saveFailed = true; if (onSaveState) onSaveState(true); } else if (saveInfo !== prevInfo && onSaveState) onSaveState(true);   // only when the detail changed, or each failed write would re-save and fail again in a loop
      return false;
    }
  };
  const saveAiCfg = () => { lsSet(AI_STORE, JSON.stringify(AICFG)); };
  // small device-level notes: when a tip was dismissed, when the last backup file was made (these belong to this device, not to the person)
  const TIPS_STORE = 'shanlu-tips';
  const tipRead = () => { try { return JSON.parse(localStorage.getItem(TIPS_STORE)) || {}; } catch (e) { return {}; } };
  const tipStore = (k, v) => { const t = tipRead(); t[k] = v; lsSet(TIPS_STORE, JSON.stringify(t)); };
  const isStandalone = () => { try { return window.navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; } };
  const isIos = () => { try { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch (e) { return false; } };
  let installEvt = null;   // Chrome/Android: the browser's own "install" prompt, kept until the person asks for it
  const AI_MODELS = [['claude-haiku-5-5', 'Haiku 5.5: fastest and cheapest'], ['claude-sonnet-5-5', 'Sonnet 5.5: smarter, costs more']];
  // Alibaba Cloud Model Studio (Qwen), International edition (Singapore). Config: { provider, key, model, asr, ali:{ key, ws, model } }
  const ALI_MODELS = [['qwen-flash', 'qwen-flash: fastest and cheapest'], ['qwen-plus', 'qwen-plus: smarter, costs more']];
  const ALI_ASR_MODEL = 'qwen3-asr-flash';
  const aliCfg = () => AICFG.ali || {};
  // Alibaba Qwen can be used two ways: with a key saved on this device (called straight from the browser), or, for a person in the study group who has
  // no key, through the friends server (it holds one shared key and gives each person a daily allowance, see relayPost below)
  const aliOwn = () => !!aliCfg().key;
  const aliUsable = () => aliOwn() || relayOn();
  const aiProviderNow = () => (((AICFG.provider === 'alibaba' || !AICFG.key) && aliUsable()) ? 'alibaba' : 'anthropic');
  const aiReadyNow = () => (aiProviderNow() === 'alibaba' ? aliUsable() : !!AICFG.key);
  const asrModeNow = () => (AICFG.asr === 'alibaba' && aliUsable() ? 'alibaba' : 'browser');
  const aliBase = () => { const ws = String(aliCfg().ws || '').trim(); return ws ? 'https://' + ws + '.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1' : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'; };
  // Qwen text-to-speech (Alibaba Model Studio, Singapore): the voice that reads Mingming's lines when an Alibaba key is saved
  const ALI_TTS_MODEL = 'qwen3-tts-flash';
  const TTS_VOICES = [['Cherry', 'Cherry: woman, friendly'], ['Serena', 'Serena: woman, gentle'], ['Maia', 'Maia: woman, warm'], ['Neil', 'Neil: man, clear news-reader style'], ['Kai', 'Kai: man, calm']];
  const ttsModeNow = () => (aliUsable() && AICFG.ttsMode !== 'browser' ? 'qwen' : 'browser');
  const ttsVoiceNow = () => (TTS_VOICES.some(v => v[0] === AICFG.ttsVoice) ? AICFG.ttsVoice : 'Maia');
  const aliApi = () => aliBase().replace('/compatible-mode/v1', '/api/v1');
  // ---- the person's own settings and notes follow them to every device (when they are in the study group): the listening level, what
  // Mingming remembers, the chat preferences and, only if switched on, the API keys. Every value is stamped with the time it was set
  // and the newer stamp wins (sync.js, mergePerson). Kept in localStorage 'shanlu-person'; never in the progress export or the GitHub sync.
  const PERSON_STORE = 'shanlu-person';
  let PERSON = {};
  try { PERSON = JSON.parse(localStorage.getItem(PERSON_STORE)) || {}; } catch (e) {}
  if (!PERSON.prefs || typeof PERSON.prefs !== 'object') PERSON.prefs = {};
  if (!PERSON.mem || typeof PERSON.mem !== 'object') PERSON.mem = { facts:[], del:{}, cleared:0 };
  let onPersonChange = () => {};
  const savePerson = (notify) => { lsSet(PERSON_STORE, JSON.stringify(PERSON)); if (notify !== false) onPersonChange(); };
  const prefGet = (k, d) => (PERSON.prefs[k] && PERSON.prefs[k].v !== undefined ? PERSON.prefs[k].v : d);
  const prefSet = (k, v) => { PERSON.prefs[k] = { v, at:Date.now() }; savePerson(); };
  // the small drawings in data/art.js (Mingming, tab banners, lanterns, the summit) as picture addresses
  const TOPKEY = { library:'library', words:'library', grammar:'library', web:'library', pinyin:'library', review:'review', greview:'review', testlobby:'review', listen:'talk', speak:'talk', journey:'journey' };   // which banner picture heads which page
  const ARTC = {};
  const artUri = (a, b) => { const k = a + (b ? '.' + b : ''); if (ARTC[k] === undefined) { const A = window.SHANLU_ART || {}; const svg = b ? (A[a] || {})[b] : A[a]; ARTC[k] = svg ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) : ''; } return ARTC[k]; };
  // take over what older versions kept on the device only (stamp 1: older than anything set on another device)
  (() => {
    let changed = false;
    const old = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const l = old('shanlu-listen'), m = old('shanlu-memory');
    if (l && !PERSON.lsn) { PERSON.lsn = { v:{ lvl:l.lvl || 1, ok:l.ok || 0, miss:l.miss || 0 }, at:1 }; if (l.auto === false) PERSON.prefs.lsnAuto = { v:false, at:1 }; changed = true; }
    if (m) { if (m.on === false) PERSON.prefs.memOn = { v:false, at:1 }; (m.facts || []).forEach(f => { if (f && typeof f.t === 'string') PERSON.mem.facts.push({ t:f.t, d:f.d || '', at:1 }); }); changed = true; }
    ['shanlu-listen', 'shanlu-memory'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    const seed = { voiceOnly:AICFG.voiceOnly, handsFree:AICFG.handsFree, ttsMode:AICFG.ttsMode, ttsVoice:AICFG.ttsVoice, asr:AICFG.asr, provider:AICFG.provider, claudeModel:AICFG.model, aliModel:aliCfg().model };
    Object.keys(seed).forEach(k => { if (seed[k] !== undefined && !PERSON.prefs[k]) { PERSON.prefs[k] = { v:seed[k], at:1 }; changed = true; } });
    if (changed) savePerson(false);
  })();
  const LSN = Object.assign({ lvl:1, ok:0, miss:0 }, (PERSON.lsn && PERSON.lsn.v) || {});   // working copy of the listening level
  const saveLsn = () => { PERSON.lsn = { v:{ lvl:lsnLvl(), ok:LSN.ok || 0, miss:LSN.miss || 0 }, at:Date.now() }; savePerson(); };
  // five listening levels: how fast the voice plays, and how long and casual Mingming's lines are
  const LSN_LEVELS = [
    { name:'slow and clear', factor:0.85, spec:'Reply with ONE very short sentence (about 10 characters or fewer), slow and clear, with no filler words.' },
    { name:'relaxed', factor:1, spec:'Reply with one or two short sentences (about 16 characters or fewer in total).' },
    { name:'everyday pace', factor:1.1, spec:'Reply with two short sentences (about 26 characters or fewer in total), the way a friendly person talks. You may open with a small filler such as 嗯 or 对了.' },
    { name:'quick', factor:1.2, spec:'Reply with two or three sentences (about 36 characters or fewer in total) at a natural speaking pace: casual, with a filler such as 嗯, 哦 or 对了, and you may add a quick aside before your question.' },
    { name:'fast and casual', factor:1.3, spec:'Reply the way a native speaker talks to a friend: two or three quick, casual sentences (about 46 characters or fewer in total) with fillers and an aside. Still use only listed words.' }
  ];
  const lsnLvl = () => Math.max(1, Math.min(5, Math.round(LSN.lvl) || 1));
  const lsnAuto = () => prefGet('lsnAuto', true) !== false;
  const memOn = () => prefGet('memOn', true) !== false;
  const memKey = (t) => String(t || '').trim().toLowerCase();
  const memAlive = (f) => !!f && typeof f.t === 'string' && (f.at || 0) > Math.max(PERSON.mem.cleared || 0, (PERSON.mem.del || {})[memKey(f.t)] || 0);
  const memFacts = () => (PERSON.mem.facts || []).filter(memAlive).sort((a, b) => (a.at || 0) - (b.at || 0));
  const memAdd = (t) => { const k = memKey(t); PERSON.mem.facts = memFacts().filter(f => memKey(f.t) !== k).concat([{ t, d:ymd(new Date()), at:Date.now() }]).slice(-30); savePerson(); };
  const memDrop = (k) => { PERSON.mem.del = Object.assign({}, PERSON.mem.del, { [k]:Date.now() }); PERSON.mem.facts = memFacts().filter(f => memKey(f.t) !== k); savePerson(); };
  const memWipe = () => { PERSON.mem.cleared = Date.now(); PERSON.mem.facts = []; savePerson(); };
  // facts about health, money, identity documents, politics, religion and the like are never kept, even if the AI suggests them (best effort: a keyword filter)
  const MEM_BLOCK = /health|medic|disease|diagnos|illness|\bill\b|sick|cancer|diabet|asthma|allerg|\bhiv\b|surgery|injur|pain|disab|heart|blood|pill|drug|doctor|hospital|clinic|mental|adhd|autis|bipolar|ptsd|trauma|chronic|pregnan|therapy|therapist|depress|anxi|salary|income|wage|debt|loan|money|bank|credit|password|address|phone number|email|passport|licen[sc]e|religio|church|mosque|temple|politic|vote|party|sexual|gay|lesbian|trans\b|immigra|visa|citizen|arrest|police|crime|prison|divorce|abuse|suicid|death|died|funeral/i;
  const cleanFact = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80); return t.length < 4 || MEM_BLOCK.test(t) ? '' : t; };
  const SYNC_STORE = 'shanlu-sync';   // { token, gist, at } lives only on this device, never in the exported progress file
  let SYNCCFG = {};
  try { SYNCCFG = JSON.parse(localStorage.getItem(SYNC_STORE)) || {}; } catch (e) {}
  const saveSyncCfg = () => { lsSet(SYNC_STORE, JSON.stringify(SYNCCFG)); };
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
  // "HSK 1", "HSK 1 and HSK 2", "HSK 1, HSK 2 and HSK 3": the lists the learner knows (everything up to the highest level shown)
  const LV_NAMES = Array.from({ length:TOPL }, (_, i) => 'HSK ' + (i + 1));
  const KNOWN_LISTS = LV_NAMES.length < 2 ? LV_NAMES[0] : LV_NAMES.slice(0, -1).join(', ') + ' and ' + LV_NAMES[LV_NAMES.length - 1];
  const listJoin = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];   // "HSK 1", "HSK 1 and HSK 2", "HSK 1, HSK 2 and HSK 3"
  const LVL = window.ShanluLevel || { MAX_LEVEL:LV, PASS_PCT:80, passedEntry:() => false, passedList:() => false, softLock:() => false, placed:() => 0, levelPassed:() => false, markPassed() {}, unlocked:() => true };
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
  // A level can add words to a character group of a lower level (webs.json "extends": 高中 for the HSK 1 group 中).
  // In All levels they join that group. On one level they stay out: the lower group's words are not part of that level's word list.
  const webHubs = () => {
    const hubs = JOIN('WEBS', 'hubs').map(h => Object.assign({}, h, { words:h.words.slice() }));
    LVLS.forEach(n => {
      const d = window['HSK' + n + '_WEBS']; if (!d || !d.extends) return;
      d.extends.forEach(e => { const host = hubs.find(x => x.hub === e.hub); if (host) e.words.forEach(w => { if (!host.words.some(x => x.zh === w.zh)) host.words.push(w); }); });
    });
    return hubs;
  };
  const { hubs:HUBS, opps:OPPS, topics:TOPICS } = ALL ? { hubs:webHubs(), opps:JOIN('WEBS', 'opps'), topics:mergeTopics(LV_ALL('WEBS').map(d => d.topics || [])) } : LV_DATA('WEBS');
  // Listening lab and practice scripts: a level without them (none yet for HSK 3) has those parts switched off.
  const { clips:CLIPS, tones:TONES, pairs:PAIR_DATA } = Object.assign({ clips:[], tones:(window.HSK1_LISTEN || {}).tones || [], pairs:[] }, (ALL ? { clips:JOIN('LISTEN', 'clips'), tones:(LV_ALL('LISTEN')[0] || {}).tones, pairs:JOIN('LISTEN', 'pairs') } : LV_DATA('LISTEN')) || {});
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
  const SPLIT = ['ws', 'misses', 'gres', 'gpt', 'sres', 'clipBest', 'lrn', 'rlog'];
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
  // How sure the site wants to be before a word comes back: it returns when the recall chance falls to this. 90% by default; 85% or 80%
  // means fewer reviews and more forgetting. A word's interval in days is its stability times retK (1.0 at 90%). A person's setting: it follows them.
  const retention = () => { const r = Number(prefGet('retention', 0.9)); return r >= 0.75 && r <= 0.95 ? r : 0.9; };
  const retK = () => (1 / (retention() * retention()) - 1) * 81 / 19;
  // A word the level check marked "probably known" carries pk, the day it may first come back (the check releases 20 a day); one answer in Review removes it.
  const dueIn = (d, off) => { const base = d.s * retK() - lOf(d) - (off || 0); return d.pk ? Math.max(base, (d.pk - Date.now()) / DAY_MS - (off || 0)) : base; };
  // One answer changes a skill's stability (s) and its difficulty (d, 1 to 10, starts at 5). The growth factors and the lapse rule are hand-set, not fitted.
  // o.relearn: the card is being answered again in the same session after a lapse. That is relearning, so the stability does not grow
  // (before this, a word forgotten at 90 days came back at 31 days and then jumped to 50 days after one Good).
  const bump = (d, r, o) => {
    const R = retr(d);
    const dif = d.d || 5;
    const confirm = !!d.pk && (r === 'good' || r === 'easy');   // "probably known" and right: the person knew it already, so the first interval is long, not a new word's 1 or 3 days
    const grow = (f) => 1 + (f - 1) * Math.max(0.5, 1.3 - 0.06 * dif);   // harder cards grow more slowly, easier ones a little faster
    let s = d.s, nd = dif;
    if (r === 'again') { s = s > 0 ? Math.max(0.4, Math.min(s * 0.35, 6)) : 0.4; nd = Math.min(10, dif + 0.8); }
    else if (o && o.relearn) { nd = dif; }
    else if (r === 'hard') { s = s > 0 ? Math.max(0.8, s * grow(1.25)) : 1; nd = Math.min(10, dif + 0.3); }
    else if (r === 'good') { s = s > 0 ? s * grow(2.2 + 1.4 * (1 - R)) : 1.5; nd = dif + (5 - dif) * 0.05; }   // on time (recall 90%) a Good makes the interval about 2.3 times longer (it was 1.7: three timers per word brought words back too often)
    else { s = s > 0 ? s * grow(3.2 + 1.8 * (1 - R)) : 3; nd = Math.max(1, dif - 0.5); }
    if (confirm) s = Math.max(s, r === 'easy' ? 45 : 20);
    return { s, t:Date.now(), d:Math.round(nd * 100) / 100 };
  };
  const fmtInterval = (s) => { const d = s * retK(); return d < 1 ? 'Today' : d < 1.5 ? 'Tomorrow' : d < 45 ? 'In ' + Math.round(d) + ' days' : 'In ' + Math.round(d / 30) + ' months'; };

  const BANK = {};
  const EX = {};
  const NOTE = {};   // optional short teaching note per word (content/words-*.tsv, 6th column)
  const EXS = {};    // every example sentence for a word: its main one first, then the extras (content/examples-*.tsv)
  WORDS.forEach(w => { BANK[w.zh] = { zh:w.zh, py:w.py, en:w.en, pos:w.pos }; EX[w.zh] = w.ex; NOTE[w.zh] = w.note || ''; EXS[w.zh] = [w.ex].concat(w.more || []); });
  // a random example that fits (`ok`), so the same word does not always come with the same sentence
  const pickEx = (zh, ok) => { const all = EXS[zh] || [{ zh:'', py:'', en:'', toks:[] }]; const fit = ok ? all.filter(ok) : all; const pool = fit.length ? fit : all; return pool[Math.floor(Math.random() * pool.length)]; };
  const strHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const CLIP_PY = {};
  CLIPS.forEach(c => c.words.forEach(w => { CLIP_PY[w.zh] = w.py; }));
  const BANK_KEYS = Object.keys(BANK);

  // ---------- the learning path (Learn > Path) ----------
  // data/path.js (built by tools/build-path.py from content/path.json): per level, units of stops. A word stop is a small group of related
  // words, met for the first time in a short lesson; a grammar stop opens one grammar lesson. Nothing is locked: the path only says what
  // comes next. A word stop is done when every word in it has been started (here, in a web, or in Review) or its lesson was finished;
  // a grammar stop is done when its lesson was passed (80%).
  const PATH = window.SHANLU_PATH || {};
  const PSCENE = window.SHANLU_PATH_SCENES || {};
  const PTILE = window.SHANLU_PATH_TILES || {};     // the wallpaper behind each unit's trail   // the pictures of the themed path (data/path-scenes.js)
  const SSCN = window.SHANLU_SPEAK_SCENES || {};     // one drawn place for each practice script (data/speak-scenes.js)
  const SCEN_AT = {};
  SCEN.forEach((x, i) => { SCEN_AT[x.id] = i; });
  const PATH_LVLS = LVLS.filter(n => PATH[n] && (PATH[n].units || []).length);
  const LESSON_AT = {};
  LESSONS.forEach((L, i) => { LESSON_AT[L.id] = i; });
  const POS_NAME = { n:'noun', v:'verb', adj:'adjective', adv:'adverb', pron:'pronoun', num:'number', m:'measure word', qw:'question word', phr:'phrase', time:'time word', conj:'conjunction', prep:'preposition', part:'particle', loc:'place word', suf:'suffix' };
  const STOP_COINS = 10;     // coins for finishing a word stop the first time
  const PATH_BATCH = 4;      // most words met before the first questions about them
  const PATH_XS = [50, 68, 78, 68, 50, 32, 22, 32];   // where the stops sit across the trail (percent from the left), one after the other
  const stopWords = (st) => (st.k === 'w' ? st.w.filter(z => BANK[z]) : []);
  const stopTitle = (st) => st.t + (st.p ? ' (' + st.p[0] + ' of ' + st.p[1] + ')' : '');
  const wStarted = (S, zh) => !!(S.ws[zh] && S.ws[zh].see.s > 0) || !!(S.lrn || {})[zh] || !!(S.wlearned || {})[zh];
  const stopState = (S, st) => {   // 'done' | 'part' | 'new'
    const home = STOP_BY[st.id]; if (home && home.lv <= LVL.placed()) return 'done';   // a level the person tested out of (the level check): its stops are behind them
    if (st.k === 's') return S.sres[st.s] ? 'done' : 'new';
    if (st.k === 'g') { const i = LESSON_AT[st.g]; const best = i === undefined ? 0 : (S.gres[LESSONS[i].id] || 0); return best >= 80 ? 'done' : best > 0 ? 'part' : 'new'; }
    const ws = stopWords(st); const n = ws.filter(z => wStarted(S, z)).length;
    if (!ws.length || n === ws.length || prefGet('pth.' + st.id, 0)) return 'done';
    return n > 0 ? 'part' : 'new';
  };
  // The path is written with the official word forms. In plain mode the site has rewritten its words (这儿 is gone, 一点儿 is 一点 ...), so the
  // path's lists go through the same rewrite: twins (这儿 next to 这里) drop out, the others take their plain form, and repeats are removed.
  const plainWords = (arr) => {
    if (!ERHUA || ERHUA_ON) return arr;
    const out = [];
    arr.forEach(z => { if (ERHUA.twins.indexOf(z) >= 0) return; const q = ERHUA.zh(z); if (out.indexOf(q) < 0) out.push(q); });
    return out;
  };
  const PATH_U = {}, STOP_BY = {};
  PATH_LVLS.forEach(n => {
    PATH_U[n] = PATH[n].units.map(u => ({ id:u.id, title:u.title, blurb:u.blurb, stops:u.stops.map(st => (st.k === 'w' ? Object.assign({}, st, { w:plainWords(st.w) }) : st)).filter(st => (st.k === 'w' ? stopWords(st).length > 0 : st.k === 's' ? SCEN_AT[st.s] !== undefined : LESSON_AT[st.g] !== undefined)) })).filter(u => u.stops.length);
    PATH_U[n].forEach((u, ui) => u.stops.forEach((st, si) => { STOP_BY[st.id] = { st, u, ui, si, lv:n }; }));
  });
  const pathNext = (S, lv) => {   // the first stop that is not done
    const us = PATH_U[lv] || [];
    for (let ui = 0; ui < us.length; ui++) for (let si = 0; si < us[ui].stops.length; si++) { if (stopState(S, us[ui].stops[si]) !== 'done') return { st:us[ui].stops[si], u:us[ui], ui, si, lv }; }
    return null;
  };
  const pathNextWord = (S, lv) => {   // the first word stop that is not done (the Today list uses it for its new-words task; grammar has its own task there)
    const us = PATH_U[lv] || [];
    for (let ui = 0; ui < us.length; ui++) for (let si = 0; si < us[ui].stops.length; si++) { const st = us[ui].stops[si]; if (st.k === 'w' && stopState(S, st) !== 'done') return { st, u:us[ui], ui, si, lv }; }
    return null;
  };
  const pathFirstOpen = (S) => { for (let i = 0; i < PATH_LVLS.length; i++) { if (pathNext(S, PATH_LVLS[i])) return PATH_LVLS[i]; } return PATH_LVLS.length ? PATH_LVLS[PATH_LVLS.length - 1] : 0; };

  // how many path stops are done, over every level in this view: the difference since the start of the day is "steps done today"
  const pathDoneCount = (S) => { let n = 0; PATH_LVLS.forEach(lv => (PATH_U[lv] || []).forEach(u => u.stops.forEach(st => { if (stopState(S, st) === 'done') n++; }))); return n; };

  const blankDim = () => ({ s:0 });
  const blankWord = () => ({ see:blankDim(), hear:blankDim(), prod:blankDim() });
  const blankWs = () => { const out = {}; Object.keys(BANK).forEach(zh => { out[zh] = blankWord(); }); return out; };
  // Saved progress keeps only started words and skills (see sync.js compactWs). The page works with every word and skill present, so fill in what is missing.
  const fillWs = (ws) => {
    if (!ws) return ws;
    Object.keys(BANK).forEach(zh => { if (!ws[zh]) ws[zh] = {}; });
    Object.keys(ws).forEach(zh => { DIMS.forEach(k => { if (!ws[zh][k]) ws[zh][k] = blankDim(); }); });
    return ws;
  };

  const winfo = (w, off) => {
    const started = DIMS.filter(k => w[k].s > 0);
    const m = wMastery(w);
    const lv = levelOf(m);
    const recall = started.length ? Math.round(100 * started.reduce((a, k) => a + retr(w[k], off), 0) / started.length) : 0;
    // A word is due when any of its skills is due: recognising it (see), saying it (prod) or hearing it (hear); Review practises all three.
    const dueN = started.length ? Math.min.apply(null, started.map(k => dueIn(w[k], off))) : 9999;
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

  // Review queue. Each item is one card: 'zh' recognise it, 'zh#p' produce it (type it with tones), 'zh#h' hear it, 'zh#l' a new word in its
  // learning phase. Every skill has its own timer, so a word can be due as one card and not as another. New words come first; then everything due,
  // weakest first but jumbled (a random nudge) so words learned together do not come back in list order. Saying cards and hearing cards are each capped at
  // a third of the recognition cards (at least 10), so adding two directions does not double the pile in one day; the rest stay due for next time. (The floor was 2: once the recognition cards were done, only 2 typing cards came at a time.)
  const LRN_MAX = 12;       // new words waiting in their learning phase at once; add more after these are learned
  const LEARN_STEPS = 2;    // successful recalls (after meeting the word) before it gets a real interval
  const itemOf = (it) => { const m = /^(.*?)(?:#([lph]))?$/.exec(String(it)); return { zh:m[1], t:m[2] || 's' }; };
  // a "new word" card (word#l) for a word that has already graduated (it is in memory and no longer in the learning list) is out of date: it would show the word as new again and reset its progress
  const staleNew = (z, ws, lrn) => { const m = itemOf(z); return m.t === 'l' && !(lrn && lrn[m.zh]) && !!(ws && ws[m.zh] && ws[m.zh].see && ws[m.zh].see.s > 0); };
  // the words really waiting in their learning phase: a word that is already learned (it has an interval, e.g. marked as known elsewhere) or is not in this view's list
  // can never be served as a new card, so it must not count (it made "Learn N new words" appear after a finished session and used up the 12-word limit)
  const lrnLive = (ws, lrn) => Object.keys(lrn || {}).filter(z => BANK[z] && ws && ws[z] && !(ws[z].see.s > 0));
  const lrnPrune = (ws, lrn) => { const o = {}; Object.keys(lrn || {}).forEach(z => { if (!(ws && ws[z] && ws[z].see.s > 0)) o[z] = lrn[z]; }); return o; };
  const buildQueue = (ws, anyway, lrn) => {
    const fresh = Object.keys(lrn || {}).filter(zh => BANK[zh] && ws[zh] && !(ws[zh].see.s > 0)).map(zh => zh + '#l');
    const see = [], prod = [], hear = [];
    Object.keys(ws).forEach(zh => {
      const w = ws[zh];
      if (!w || !BANK[zh]) return;     // a word from a locked level (not in this view's word bank) never joins the queue
      [['see', ''], ['prod', '#p'], ['hear', '#h']].forEach(x => {
        const d = w[x[0]];
        if (!(d.s > 0)) return;
        if (anyway ? x[0] !== 'see' : dueIn(d, 0) > 0) return;
        if (x[0] === 'prod' && !(w.see.s >= 2)) return;     // say it only once you recognise it
        (x[0] === 'see' ? see : x[0] === 'prod' ? prod : hear).push({ it:zh + x[1], key:retr(d) * 100 + Math.random() * 30 });
      });
    });
    const byKey = (a, b) => a.key - b.key;
    see.sort(byKey); prod.sort(byKey); hear.sort(byKey);
    const cap = Math.max(10, Math.ceil(see.length / 3));
    return fresh.concat(see.concat(prod.slice(0, cap), hear.slice(0, cap)).sort(byKey).map(r => r.it));
  };

  // "Words in memory": every started word counts by its chance of being recalled right now, so the number rises when you learn and review
  // and falls when reviews slide. (XP points are still counted inside, only to keep the streak, but they are no longer shown.)
  const memOf = (ws) => { let sum = 0, n = 0; Object.keys(ws).forEach(z => { const i = winfo(ws[z], 0); if (i.started && !(ws[z].see && ws[z].see.pk)) { sum += i.recallN / 100; n++; } }); return { words:Math.round(sum), n, avg:n ? Math.round(100 * sum / n) : 0 }; };

  // ---------- friends board (optional; stays hidden until config.js has the server address) ----------
  const FR = window.ShanluFriends ? window.ShanluFriends.make() : null;
  const FR_PUSH_KEY = 'shanlu-friends-push';
  // a random name for this browser, so minutes studied on two devices can be added up instead of one replacing the other
  const DEVICE = (() => { try { let d = localStorage.getItem('shanlu-device'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('shanlu-device', d); } return d; } catch (e) { return 'x'; } })();
  // The totals shared with friends, read from every saved progress (each level and All levels), so the numbers do not depend on which view you were in.
  const collectFriendStats = () => {
    const keys = Object.keys(LVL.PROGRESS_KEYS || {}).map(n => ({ n:Number(n), key:LVL.PROGRESS_KEYS[n] })).concat([{ n:0, key:'shanlu-progress-v1-all' }]);
    const stores = keys.map(k => { let st = null; try { st = JSON.parse(localStorage.getItem(k.key)); } catch (e) {} return st && typeof st === 'object' ? Object.assign({ __n:k.n, __key:k.key }, st) : null; }).filter(Boolean);
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
    stores.filter(st => st.__n > 0 && st.ws).forEach(st => { try { mem += memOf(fillWs(st.ws)).words; } catch (e) {} });   // a saved copy keeps only started skills: fill the rest in first
    const levels = LVL.unlockedLevels ? LVL.unlockedLevels() : [LV];
    const out = { asOf:today, last7, streak:Math.min(streak, 9999), lastActive, mem, levels, passed:levels.filter(n => LVL.levelPassed(n)) };
    try { const jy = jyShare(); if (jy) out.jy = jy; } catch (e) {}
    return out;
  };
  // What friends can see of the Journey: how many stops, which regions are stamped (and when), the region you are in, stops per region, and the stop you reached last (an id, so
  // they can see which city you are in). Nothing about where you really are: this is the game's map, not your location.
  const jyShare = () => {
    const st = jyRead(); if (!st || !JWORLD || !st.seen.length) return null;
    const per = {}; st.seen.forEach(id => { const s = JWORLD.byStop[id]; if (s) per[s.rid] = (per[s.rid] || 0) + 1; });
    const done = {}; Object.keys(st.done || {}).forEach(id => { if (JWORLD.byRegion[id]) done[id] = st.done[id]; });
    return { n:st.seen.length, here:st.reg && st.started ? st.reg : '', at:st.seen[st.seen.length - 1] || '', done, per };
  };

  // every saved progress (each level and All levels), as stored; used by the achievements for things that span levels
  const readAllStores = () => {
    const keys = Object.keys(LVL.PROGRESS_KEYS || {}).map(n => ({ n:Number(n), key:LVL.PROGRESS_KEYS[n] })).concat([{ n:0, key:'shanlu-progress-v1-all' }]);
    return keys.map(k => { let st = null; try { st = JSON.parse(localStorage.getItem(k.key)); } catch (e) {} return st && typeof st === 'object' ? Object.assign({ __n:k.n, __key:k.key }, st) : null; }).filter(Boolean);
  };

  // ---- the Journey: journey.js has the rules, data/journey.js the stops, data/journey-map.js the outlines ----
  const JY = window.ShanluJourney || null;
  const JWORLD = JY && window.JOURNEY ? JY.build(window.JOURNEY) : null;
  if (JWORLD && window.SHANLU_JY_FIRST) JWORLD.prefer = window.SHANLU_JY_FIRST;   // set by tests so the first region is known
  const JMAP = window.JOURNEY_MAP || null;
  const JMEDIA = window.JOURNEY_MEDIA || {};
  // Souvenirs: each one hides in a single stop and is found when that stop is unlocked. What you have is worked out from the stops you have
  // seen, so nothing extra is saved and it follows you across devices (the journey itself is already kept with the person).
  const SOUV = window.SOUVENIRS || [];
  const SV_BY_STOP = {}; SOUV.forEach(s => { SV_BY_STOP[s.stop] = s; });
  const svImg = (s) => s.u || (s.u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg));
  // ---- onboarding: the first-visit flow (intro pop-up on the Journey, the first free flight, five guide cards, where to start, name and friends), then the Start here path (pref 'onb': p flow step 'intro' | 'fly' | 'level' | 'me' | 'done', l what they chose ('new' | 'some'), w flow finished, s start path 'go' | 'done' | 'skip', d day finished, g reference page opened, px sounds card dismissed) ----
  const ONB_OFF = () => { try { return !!(navigator.webdriver && !window.SHANLU_ONBOARDING); } catch (e) { return false; } };   // browser tests run without it unless they ask for it
  const onbRead = () => { const v = prefGet('onb', null); return v && typeof v === 'object' ? v : {}; };
  const START_WORDS = ['你好', '谢谢', '我', '你', '是'];   // the same five for everyone: a greeting, thanks, I, you, and the verb to be
  const jyRead = () => { const v = prefGet('jy', null); return v && typeof v === 'object' && Array.isArray(v.seen) ? v : null; };
  // lifetime XP (the saved name for the coins ever earned): this view's live number plus what the other saved copies hold (each level, and All levels); read at most every few seconds because it parses saved data
  let jyOther = { at:0, v:0 };
  const otherXp = (force) => {
    if (force || Date.now() - jyOther.at > 4000) { let t = 0; try { readAllStores().forEach(st => { if (st.__key !== KEY) t += (Number(st.xp) || 0); }); } catch (e) {} jyOther = { at:Date.now(), v:t }; }
    return jyOther.v;
  };
  const totalXp = (S) => (S.xp || 0) + otherXp();
  // coins to spend: everything earned (lifetime XP in the saved data) minus the price of the stops already travelled to
  const coinBalance = (S, st) => Math.max(0, totalXp(S) - (st && JY ? JY.cum(st.n || 0) : 0));

  // ---- the pinyin and tones course (data/pinyin-course.js, data/pinyin-chart.js) and the typing tutorial ----
  // What the person has done follows them: one person pref per finished lesson ('pyc.<lesson id>' = when) and 'typT' = when the typing tutorial was dismissed.
  const PYC = window.SHANLU_PYCOURSE || { lessons:[] };
  const PYCHART = window.SHANLU_PYCHART || {};
  const PY_COINS = 10;   // coins for finishing a lesson the first time
  const pyDoneAt = (id) => Number(prefGet('pyc.' + id, 0)) || 0;
  const typSeen = () => (Number(prefGet('typT', 0)) || 0) > 0;
  const toMarks = (t) => (window.ShanluPinyin ? window.ShanluPinyin.toMarks(t) : String(t == null ? '' : t));
  // the five tone shapes on the five-step scale (1 low, 5 high); y = 34 - (level - 1) * 7 in a 60 x 40 box
  const TONE_PANEL = [
    { n:1, name:'Tone 1', desc:'High and level, like holding a note', path:'M6 6 L54 6', zh:'妈', py:'mā', en:'mom' },
    { n:2, name:'Tone 2', desc:'Rises from the middle to high, like “Really?”', path:'M6 20 L54 6', zh:'麻', py:'má', en:'hemp' },
    { n:3, name:'Tone 3', desc:'Dips low, then comes up', path:'M6 27 Q26 41 54 13', zh:'马', py:'mǎ', en:'horse' },
    { n:4, name:'Tone 4', desc:'Falls sharply, like a firm “No!”', path:'M6 6 L54 34', zh:'骂', py:'mà', en:'to scold' },
    { n:5, name:'Neutral', desc:'Short and light, no mark', path:'M22 24 L38 27', zh:'妈妈', py:'māma', en:'mom' }
  ];
  const PY_INIS = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w', '·'];
  const pyIniOf = (syl) => { const m = /^(zh|ch|sh|b|p|m|f|d|t|n|l|g|k|h|j|q|x|r|z|c|s|y|w)/.exec(syl); return m ? m[1] : '·'; };
  let pyChartCache = null;
  const pyChartBy = () => {   // initial -> syllable -> tone -> entry
    if (pyChartCache) return pyChartCache;
    const by = {};
    Object.keys(PYCHART).forEach(k => {
      const syl = k.slice(0, -1), tone = Number(k.slice(-1)), ini = pyIniOf(syl);
      if (!by[ini]) by[ini] = {};
      if (!by[ini][syl]) by[ini][syl] = {};
      by[ini][syl][tone] = Object.assign({ key:k }, PYCHART[k]);
    });
    pyChartCache = by;
    return by;
  };

  // ---------- dates, saving, daily reset ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

  const PERSIST = ['sys', 'mins', 'theme', 'xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'gpt', 'sres', 'nlimit', 'voiceId', 'speed', 'ascView', 'clipBest', 'mbest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'rlast', 'gdone', 'grdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'pbase', 'wlearned', 'wrated', 'wdelta', 'wreveal', 'spy', 'sen', 'shint', 'szh', 'exams', 'aiDays', 'rpy', 'mem0', 'minLog', 'minDev', 'lrn', 'rlog', 'epoch'];

  // Settings that belong to the person, not the device: kept as person preferences ('set.<name>', 'level', 'erhua') so every device ends up with the same ones.
  // (The browser voice stays on the device: the voices on a phone and a laptop are different ones.)
  const SETTING_KEYS = ['sys', 'mins', 'theme', 'nlimit', 'speed', 'ascView'];
  const SETTING_DEFAULT = { sys:'3.0', mins:20, nlimit:0, speed:1, ascView:'trail' };

  function freshState() {
    let dark = false;
    try { dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    return {
      screen:'home', lvMsg:window.SHANLU_LOCKED || 0, sys:'3.0', mins:20, theme:dark ? 'dark' : 'light',
      fr:null, frAt:0, frBusy:false, frErr:'', frMsg:'', frSort:'week', frName:'', syncBadMsg:'', frSyncing:false, frLinkIn:'', frLinkBusy:false, frLeaveAsk:false, frCopied:false,
      jyPing:0, jyTab:'map', jySvSel:null, jySvFilter:'all', jyPassAll:false, jyReg:null, jyFilter:'all', jyOpen:null, jyRv:null, jySel:null, jyMoreN:40, onbV:0, pcs:null, pcNote:'', obCard:0, obLvl:'new', obName:'', obJoin:true, obGoal:0, obErr:'', obBusy:false, obBack:false,
      xp:0, dayXp:0, dayMin:0, mem0:null, minLog:{}, minDev:{}, lrn:{}, rlog:[], epoch:0, saveFail:false, saveInfo:'', swReady:false, storagePersisted:null, tipGone:0, qfeed:'', lrnNote:'', streak:0, lastActive:'', activity:{}, day:'',
      gres:{}, gpt:{}, glast:null, grvLv:0, grvOpen:false, grvAll:false, qbusy:false, qerr:'', sres:{}, nlimit:0, voiceId:'', speed:1, ascView:'trail', webCapOpen:false, gramPick:false, vtick:0, vall:false, glesson:0, ggopen:null, gq:'', sidx:0, sview:'pick', wq:'', lq:'', wshow:40, clipBest:CLIPS.map(() => 0), misses:{}, testHistory:[],
      ws:blankWs(),
      rq:[], rtotal:0, rflip:false, rpy:false, rdone:0, rstep:0, rxp:0, rcomplete:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null, rrun:0, rmiss:[],
      pyView:'list', pyLs:0, pyAns:{}, pyGain:'', pyIni:'b', pyInfo:null, typOpen:false, typIn:'', qmode:'test', qi:0, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false,
      gdone:false, grdone:false, tdone:false, ldone:false, spokeToday:false, webCredited:false,
      plv:0, pstop:'', pu:{}, pl:null, plNote:'', plAlt:'', acctEdit:false,
      sturn:0, szh:true, spy:true, sen:true, shint:true, sdone:false,
      woff:0, wsort:'weak', wfilter:'all', wdelta:{}, wrated:{}, gfq:0, gfpick:null, shround:0, shbusy:false,
      wmode:'topic', wmist:false, wtmenu:false, wgopen:null, wtq:'', whub:0, wtopic:0, wcover:'all', wpeek:{}, jyPlay:'', jyPlayStamp:false, wopptab:'all', wlearned:{}, wreveal:{}, wex:{}, wexn:{}, exams:[], exm:null, aiDays:{}, syncKeys:prefGet('syncKeys', false) === true, aiVoiceOnly:AICFG.voiceOnly !== false, handsFree:AICFG.handsFree === true, lsnLvl:lsnLvl(), lsnAuto:lsnAuto(), lsnNote:'', memOn:memOn(), memFacts:memFacts().slice(), aiTyping:false, ttsMode:ttsModeNow(), ttsVoice:ttsVoiceNow(), ttsNote:'', ttsBusy:false, aiOn:aiReadyNow(), aiProvider:aiProviderNow(), aiModel:AICFG.model || 'claude-haiku-5-5', aiTab:aiProviderNow(), aliOn:!!aliCfg().key, aliKeyInput:'', aliWsInput:aliCfg().ws || '', aliModelInput:aliCfg().model || 'qwen-flash', aliNote:'', aliTesting:false, aiTesting:false, syncTesting:false, frTesting:false, asrMode:asrModeNow(), asrBusy:false, aiKeyInput:'', aiNote:'', aiMode:!HAS_SCRIPTS, aim:[], aiBusy:false, aiErr:'', aiInput:'', aiListen:false, aiAlts:[], aiScn:-1, syncOn:!!SYNCCFG.token, syncAt:SYNCCFG.at || 0, syncInput:'', syncBusy:false, syncMsg:'', syncBad:false,
      lmode:'dict', dclip:0, drecent:[], dplays:0, drate:1, dtyped:'', dchecked:false, dmarks:[], dreveal:0, mtyped:'', mchecked:false, mbusy:false, mres:null, merr:'', mpeek:0, mmix:false, mbest:{},
      tidx:null, tpick:null, tright:0, ttotal:0, tmode:'one', t2idx:null, t2a:null, t2b:null, t2right:0, t2total:0,
      playing:null, noVoice:false
    };
  }

  function rollDay(s) {
    const t = ymd(new Date());
    if (s.day === t) return s.mem0 == null || s.pbase == null ? Object.assign({}, s, { mem0:s.mem0 == null ? memOf(s.ws).words : s.mem0, pbase:s.pbase == null ? pathDoneCount(s) : s.pbase }) : s;
    const rq = buildQueue(s.ws, false);
    return Object.assign({}, s, {
      mem0:memOf(s.ws).words, pbase:pathDoneCount(s), day:t, dayXp:0, dayMin:0, wlearned:{}, wrated:{}, wdelta:{}, wreveal:{}, webCredited:false,
      rcomplete:false, rdone:0, rxp:0, rq, rtotal:rq.length, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null, rrun:0, rmiss:[], rflip:false,
      gdone:false, grdone:false, tdone:false, ldone:false, spokeToday:false, sdone:false, sturn:0
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
      if (Array.isArray(S.rq)) S.rq = S.rq.map(z => { const m = itemOf(z); return m.zh === f ? t + (m.t === 's' ? '' : '#' + m.t) : z; }).filter((z, i, arr) => arr.indexOf(z) === i);
    });
    // anything still pointing at a word that is not in this mode's list (the dropped twins) is left out of today's lists
    if (Array.isArray(S.rq)) S.rq = S.rq.filter(z => BANK[itemOf(z).zh] && !staleNew(z, S.ws, S.lrn));   // queue items are a word, or word#l / #p / #h for a new, typed or heard card
    if (S.lrn) S.lrn = lrnPrune(S.ws, S.lrn);   // a word that is already learned is not "learning" any more
    if (S.wlearned) Object.keys(S.wlearned).forEach(z => { if (!BANK[z]) delete S.wlearned[z]; });
    // words already added today (before this fix) still count towards the "learn new words" goal
    if (!S.webCredited && S.wlearned && Object.keys(S.wlearned).length >= Math.min(4, limitOf(S)) && Object.keys(S.wlearned).length > 0) S.webCredited = true;
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
    const out = { ws:{}, misses:{}, gres:{}, gpt:{}, sres:{}, clipBest:[], lrn:{}, rlog:[] };
    LVLS.forEach(n => {
      const st = readStore(n) || {};
      Object.assign(out.lrn, st.lrn || {}); out.rlog = out.rlog.concat(Array.isArray(st.rlog) ? st.rlog : []);
      Object.assign(out.ws, st.ws || {}); Object.assign(out.misses, st.misses || {}); Object.assign(out.gres, st.gres || {}); Object.assign(out.gpt, st.gpt || {}); Object.assign(out.sres, st.sres || {});
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
    fillWs(base.ws);
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
    // right after the level check the path jumps ahead: today's "steps done" and "words in memory" start again from there, so the check does not count as a day's work
    try { if (localStorage.getItem('shanlu-rebase') === '1') { localStorage.removeItem('shanlu-rebase'); st.pbase = pathDoneCount(st); st.mem0 = memOf(st.ws).words; } } catch (e) {}
    try { const m = JSON.parse(localStorage.getItem('shanlu-placed-msg')); if (m && m.at) { localStorage.removeItem('shanlu-placed-msg'); st.pcNote = 'Level check done: you start at HSK ' + m.at + '. ' + (m.n ? m.n.toLocaleString('en-US') + ' words of ' + (m.top > 1 ? 'HSK 1 to ' + m.top : 'HSK 1') + ' come back in Review, about ' + m.perDay + ' a day from tomorrow, so any slips are caught.' : 'The levels before it are open.'); } } catch (e) {}
    // a saved Review queue can hold a word this view does not have (a word of a locked level, or one that was renamed): drawing it threw and froze the page
    if (Array.isArray(st.rq)) { const n0 = st.rq.length; st.rq = st.rq.filter(z => BANK[itemOf(z).zh] && !staleNew(z, st.ws, st.lrn)); if (n0 && !st.rq.length) st.rcomplete = true; }
    st.dclip = pickClip(st.clipBest, []);   // the Listening lab opens on a random clip, not always the first
    st.drecent = [st.dclip];
    return st;
  }

  const report = (where, text, extra) => 'https://github.com/' + REPO + '/issues/new?title=' + encodeURIComponent('Content mistake: ' + text) +
    '&body=' + encodeURIComponent('Where: ' + where + '\nText: ' + text + (extra ? '\n' + extra : '') + '\n\nWhat is wrong:\n\nWhat it should say:\n');

  // ---------- building quiz questions ----------
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  // ---------- the stop lesson: how a word is met for the first time ----------
  // Meet 3 or 4 words (hear it, see it, its meaning, a sentence, what it is built from), answer two easy questions about each straight away
  // (meaning, then sound), then after the last group one mixed checkpoint on every word of the stop. A wrong answer comes back once, a few
  // questions later. Nothing is typed yet: the words go into Review afterwards, which asks for them again (a choice, then typed from memory).
  const plPlain = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const plChoices = (zh, kind, pool, n) => {   // zh plus n-1 wrong answers: first words of the same stop, then words of the same kind, then any
    const me = BANK[zh]; const seen = {};
    seen[kind === 'mean' ? me.en : zh] = true;
    if (kind === 'hear') seen['~' + plPlain(me.py)] = true;
    const out = [];
    const take = (list) => list.forEach(z => {
      if (out.length >= n - 1 || z === zh || !BANK[z]) return;
      const key = kind === 'mean' ? BANK[z].en : z; const sound = '~' + plPlain(BANK[z].py);
      if (seen[key] || (kind === 'hear' && seen[sound])) return;
      seen[key] = true; if (kind === 'hear') seen[sound] = true;
      out.push(z);
    });
    take(shuffle(pool)); take(shuffle(BANK_KEYS.filter(z => BANK[z].pos === me.pos))); take(shuffle(BANK_KEYS));
    return shuffle([zh].concat(out));
  };
  const plQ = (zh, kind, pool, n, ph) => {
    let kd = kind, ex = null;
    if (kd === 'cloze') {
      ex = pickEx(zh, e => e.toks.indexOf(zh) >= 0 && e.zh.split(zh).length === 2);
      if (!ex || ex.toks.indexOf(zh) < 0 || ex.zh.split(zh).length !== 2) { kd = 'rev'; ex = null; }
    }
    return { t:'q', kind:kd, zh, ph, ex:ex ? { zh:ex.zh, py:ex.py, en:ex.en } : null, opts:plChoices(zh, kd, pool, n) };
  };
  const plBuild = (teach, known) => {
    const steps = []; const k = Math.ceil(teach.length / PATH_BATCH);
    let at = 0, met = [];
    for (let b = 0; b < k; b++) {
      const size = Math.floor(teach.length / k) + (b < teach.length % k ? 1 : 0);
      const batch = teach.slice(at, at + size); at += size; met = met.concat(batch);
      batch.forEach(z => steps.push({ t:'meet', zh:z, ph:'meet', n:at - size + batch.indexOf(z) + 1, of:teach.length }));
      shuffle(batch).forEach(z => steps.push(plQ(z, 'mean', met, 3, 'try')));
      shuffle(batch).forEach(z => steps.push(plQ(z, 'hear', met, 3, 'try')));
    }
    const all = teach.concat(known);
    shuffle(all).forEach((z, i) => steps.push(plQ(z, i % 2 ? 'cloze' : 'rev', all, 4, 'final')));
    return steps;
  };
  const toneless = (py) => py.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const pinyinAccepts = (py, zh) => {
    const out = [zh];
    py.split('/').forEach(v => { const t = toneless(v); if (t) { out.push(t); if (/r$/.test(t) && /儿/.test(zh)) out.push(t.replace(/r$/, 'er')); } });
    return out.filter((x, i, a) => a.indexOf(x) === i);
  };
  // ---- typed pinyin: tones count (unless the person has switched on "tones optional"), with feedback that says what was right ----
  const tonesOptional = () => prefGet('tonesOptional', false) === true;
  // letters and tones of a pinyin string written with tone marks (nǐ hǎo), tone numbers (ni3 hao3) or neither; ü may be written v, u: or ü
  const toneInfo = (str) => {
    let letters = '', marks = [], digits = [];
    const t = String(str || '').normalize('NFD').toLowerCase();
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c >= 'a' && c <= 'z') letters += c;
      else if (c === '̈') letters = letters.slice(0, -1) + 'v';
      else if (c === ':' && letters.slice(-1) === 'u') letters = letters.slice(0, -1) + 'v';
      else if (c === '̄') marks.push(1); else if (c === '́') marks.push(2); else if (c === '̌') marks.push(3); else if (c === '̀') marks.push(4);
      else if (c >= '0' && c <= '5') digits.push(Number(c));
    }
    return { letters, tones:marks.length ? marks : digits.filter(n => n >= 1 && n <= 4), hasTone:marks.length + digits.length > 0 };
  };
  const sameLetters = (a, b) => { const f = (x) => x.replace(/v/g, 'u'); return f(a) === f(b) || f(a) === f(b).replace(/r$/, 'er') || f(a).replace(/er$/, 'r') === f(b); };
  const sandhi = (tones) => tones.map((t, i) => (t === 3 && tones[i + 1] === 3 ? 2 : t));   // 3+3 is said 2+3: both ways of writing it are accepted
  const tonesEqual = (got, want) => { const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]); return eq(got, want) || eq(got, sandhi(want)); };
  const comparePinyin = (input, py, optional) => {
    const got = toneInfo(input);
    if (!got.letters) return { ok:false, grade:'again', note:'' };
    let partial = null;
    const variants = String(py).split('/');
    for (let i = 0; i < variants.length; i++) {
      const want = toneInfo(variants[i]);
      if (!sameLetters(got.letters, want.letters)) continue;
      const needs = want.tones.length > 0;
      if (!got.hasTone) { if (!needs || optional) return { ok:true, grade:'good', note:'' }; partial = partial || { ok:false, grade:'hard', note:'Right sounds, but the tones count. It is ' + py.split('/')[0].trim() + '.' }; continue; }
      if (needs ? tonesEqual(got.tones, want.tones) : got.tones.length === 0) return { ok:true, grade:'good', note:'' };
      if (needs && got.tones.length < want.tones.length && got.tones.every((v, k) => v === want.tones[k] || (k === 0 && want.tones[0] === 3 && want.tones[1] === 3 && v === 2))) { partial = partial || { ok:false, grade:'hard', note:'Right sounds, but a tone is missing: the word has ' + want.tones.length + ' syllables and you marked ' + got.tones.length + '. You typed ' + String(input).trim() + '; it is ' + py.split('/')[0].trim() + '.' }; continue; }
      partial = partial || { ok:false, grade:'hard', note:'Right sounds, wrong tone. You typed ' + String(input).trim() + '; it is ' + py.split('/')[0].trim() + '.' };
    }
    return partial || { ok:false, grade:'again', note:'Not quite. It is ' + py.split('/')[0].trim() + '.' };
  };
  const PY_WORD = {};   // known words by their toneless pinyin, to recognise "a real word, just not this one"
  const knownByPinyin = (typed) => {
    if (!Object.keys(PY_WORD).length) BANK_KEYS.forEach(z => { String(BANK[z].py).split('/').forEach(v => { const t = toneless(v); if (t && !PY_WORD[t]) PY_WORD[t] = z; }); });
    const t = String(typed || '').trim();
    return BANK[t] ? t : PY_WORD[toneless(t)] || '';
  };
  // "Say it" cards show the English and ask for the word. Another word on the lists whose English is the very same (孩子 and 小孩 are both "child") is a right answer too.
  const senseSet = (en) => String(en).toLowerCase().replace(/\([^)]*\)/g, '').replace(/\bdon['’]t\b/g, 'do not').split(/;|,|\s\/\s/).map(x => x.trim()).filter(Boolean).sort().join('|');
  const sensesOf = (en) => senseSet(en).split('|').filter(Boolean);
  const sharedSense = (a, b) => { const x = sensesOf(a); return sensesOf(b).some(v => x.indexOf(v) >= 0); };
  const pyOk = (typed, z) => comparePinyin(typed, BANK[z].py, tonesOptional()).ok || (!!NEUTRAL_ALT[z] && comparePinyin(typed, NEUTRAL_ALT[z], tonesOptional()).ok);   // also with the characters' own tones (data/neutral-alt.js)
  const synonymOf = (q, typed, soft) => {
    if (!q.sayEn) return '';
    const want = senseSet(q.sayEn);
    if (!want) return '';
    const hit = BANK_KEYS.filter(z => z !== q.exp.zh && senseSet(BANK[z].en) === want);
    return hit.find(z => typed === z || (soft ? comparePinyin(typed, BANK[z].py, tonesOptional()).grade === 'hard' : pyOk(typed, z))) || '';
  };
  // the answer to a typed or fill-in question: hanzi, or pinyin with tones. grade 'good' (right), 'hard' (right sounds, wrong tone, or another real word) or 'again'
  const NEUTRAL_ALT = window.SHANLU_NEUTRAL_ALT || {};   // word -> spelling with the light syllable's own tone (data/neutral-alt.js)
  const checkTyped = (q, typed) => {
    const t = String(typed || '').trim();
    if (!q.exp) return { ok:q.accepts.indexOf(t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[0-9\s.,!?]/g, '')) >= 0, grade:'again', note:'' };
    if (t === q.exp.zh || (q.exp.alt && t === q.exp.alt)) return { ok:true, grade:'good', note:'' };
    const r = comparePinyin(t, q.exp.py, tonesOptional());
    if (!r.ok) {   // a character's own tone is fine where the word changes it: a light syllable (睛 is jīng alone, light in 眼睛), 一/不 before another syllable, 儿 as r. Not for repeated words like 妈妈. See tools/build-neutral-alt.py
      const alt = NEUTRAL_ALT[q.exp.zh];
      if (alt && String(q.exp.py).indexOf('/') < 0 && comparePinyin(t, alt, tonesOptional()).ok) return { ok:true, grade:'good', note:'Also right: those are the characters\' own tones. Said in the word it is ' + String(q.exp.py).trim() + ' (a light syllable, 一 or 不 changing tone, or 儿 as r).' };
    }
    if (r.ok || r.grade === 'hard') return r;
    const syn = synonymOf(q, t);
    if (syn) return { ok:true, grade:'good', note:'Also right: ' + syn + ' (' + BANK[syn].py.split('/')[0].trim() + ') means the same. This card was asking for ' + q.exp.zh + ' (' + q.exp.py.split('/')[0].trim() + ').' };
    if (q.sayEn && q.exp.zh.length > 1) {   // a single syllable or character from inside the answer (店 for 商店): close, with a note
      const flat = toneless(t), whole = toneless(q.exp.py);
      const partHanzi = t.length === 1 && q.exp.zh.indexOf(t) >= 0;
      const partPy = !/[\u4e00-\u9fff]/.test(t) && flat.length >= 2 && flat !== whole && (whole.endsWith(flat) || whole.startsWith(flat));
      if (partHanzi || partPy) {
        const ask = q.exp.zh + ' (' + q.exp.py.split('/')[0].trim() + ')';
        const own = BANK_KEYS.find(z => z !== q.exp.zh && q.exp.zh.indexOf(z) >= 0 && (t === z || pyOk(t, z)));   // the part is a word of its own (听 inside 听见)
        if (own && sharedSense(BANK[own].en, q.sayEn)) return { ok:true, grade:'good', note:'Also right: ' + own + ' (' + BANK[own].py.split('/')[0].trim() + ') means "' + BANK[own].en + '". This card asked for ' + ask + ', "' + q.sayEn + '".' };   // 说 for "to talk, to speak" (说话): the part is a word whose English shares a meaning with the card
        return { ok:false, grade:'hard', note:own ? own + ' (' + BANK[own].py.split('/')[0].trim() + ') is a word too: "' + BANK[own].en + '". This card asks for ' + ask + ', "' + q.sayEn + '".' : 'That is only part of the word. This card asks for the whole word ' + ask + '.' };
      }
    }
    const synSoft = synonymOf(q, t, true);
    if (synSoft) return { ok:false, grade:'hard', note:synSoft + ' (' + BANK[synSoft].py.split('/')[0].trim() + ') means the same, but check the tone. This card was asking for ' + q.exp.zh + ' (' + q.exp.py.split('/')[0].trim() + ').' };
    if (q.sayEn && q.type !== 'cloze') {   // another real word with a shared meaning (时候 for 时, both "time"): say so, instead of a plain miss
      const other = knownByPinyin(t);
      if (other && other !== q.exp.zh && sharedSense(BANK[other].en, q.sayEn)) return { ok:false, grade:'hard', note:other + ' (' + BANK[other].py.split('/')[0].trim() + ') is a real word too: "' + BANK[other].en + '". This card asks for ' + q.exp.zh + ' (' + q.exp.py.split('/')[0].trim() + '), "' + q.sayEn + '".' };
    }
    if (q.type === 'cloze') {   // several words can fit a gap; a real word that is not the expected one is not marked as a plain miss
      const known = knownByPinyin(t);
      if (known && known !== q.exp.zh) return { ok:false, grade:'hard', note:'That is a real word (' + known + ') but not the one this gap was written for. Several words can fit; if yours fits the English too, use "Report a mistake" so it can be added. Expected: ' + q.exp.zh + ' (' + q.exp.py.split('/')[0].trim() + ').' };
    }
    return r;
  };
  // question builders (used by tests and by Review)
  // Meaning choices must not be near-duplicates: "to read; to study" next to "to read (aloud); to study", or "sorry" next to "sorry; embarrassed",
  // makes a right answer feel wrong. Two English glosses clash when they share a meaningful word.
  const GLOSS_SKIP = { to:1, a:1, an:1, the:1, of:1, be:1, or:1, and:1, in:1, on:1, at:1, for:1, it:1, is:1, as:1, with:1, not:1, one:1, i:1, you:1, your:1, my:1, me:1, we:1, he:1, she:1, they:1, that:1, this:1, so:1, by:1, from:1, get:1, do:1 };
  const glossBits = (en) => {
    const out = {};
    String(en || '').toLowerCase().replace(/[^a-z\s]+/g, ' ').split(/\s+/).forEach(t => {
      if (!t || GLOSS_SKIP[t]) return;
      out[t.length > 3 ? t.replace(/(ing|ed|es|s)$/, '') : t] = 1;
    });
    return out;
  };
  const glossClash = (a, b) => { const x = glossBits(a), y = glossBits(b); return Object.keys(x).some(t => y[t]); };
  // Listening cards: two words that sound exactly the same (的 / 地 / 得 are all "de", 是 / 事 / 市 are all "shì") cannot be told apart by ear,
  // so a wrong answer must never sound like the right one. A word with several readings ("zhī / zhǐ") clashes if any of them match.
  const soundKeys = (py) => String(py || '').toLowerCase().split(/[\/,;]/).map(r => r.replace(/[\s'’·\-]/g, '')).filter(Boolean);
  const soundsAlike = (a, b) => { const x = soundKeys(BANK[a] && BANK[a].py); return soundKeys(BANK[b] && BANK[b].py).some(r => x.indexOf(r) >= 0); };
  const others = (zh, k, byMeaning, byEar) => {
    const w = BANK[zh];
    const fair = (z) => z !== zh && !(byEar && soundsAlike(z, zh));
    const same = shuffle(BANK_KEYS.filter(z => fair(z) && BANK[z].pos === w.pos && BANK[z].en !== w.en));
    const rest = shuffle(BANK_KEYS.filter(z => fair(z) && BANK[z].pos !== w.pos && BANK[z].en !== w.en));
    const all = same.concat(rest);
    if (!byMeaning) return all.slice(0, k);
    const picked = [];
    all.forEach(z => { if (picked.length < k && !glossClash(BANK[z].en, w.en) && !picked.some(p => glossClash(BANK[p].en, BANK[z].en))) picked.push(z); });
    if (picked.length < k) all.forEach(z => { if (picked.length < k && picked.indexOf(z) < 0 && !glossClash(BANK[z].en, w.en)) picked.push(z); });   // a tiny word bank: relax the rule between wrong answers
    if (picked.length < k) all.forEach(z => { if (picked.length < k && picked.indexOf(z) < 0) picked.push(z); });
    return picked;
  };
  const choiceOptions = (zh, labelOf, byMeaning, byEar) => {
    const opts = shuffle([zh].concat(others(zh, 3, byMeaning, byEar))).map((z, i) => ({ id:ORDER_IDS[i], label:labelOf(z), zh:z }));
    return { options:opts.map(o => ({ id:o.id, label:o.label })), correct:opts.find(o => o.zh === zh).id };
  };
  const exLine = (e) => e.zh + ' ' + e.py + ' (' + e.en + ')';
  const qMeaning = (zh) => { const e0 = pickEx(zh); return Object.assign({ type:'mc', kicker:'Meaning', prompt:'What does this word mean?', big:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:exLine(e0), word:zh, dim:'see' }, choiceOptions(zh, z => BANK[z].en, true)); };
  const qHearWord = (zh, ex) => Object.assign({ type:'listen', kicker:'Listen', prompt:'Which word did you hear?', audio:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:exLine(ex || pickEx(zh)), word:zh, dim:'hear' }, choiceOptions(zh, z => z, false, true));
  const qHearMeaning = (zh) => Object.assign({ type:'listen', kicker:'Listen', prompt:'What does this word mean?', audio:zh, optsLatin:true, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:exLine(pickEx(zh)), word:zh, dim:'hear' }, choiceOptions(zh, z => BANK[z].en, true, true));
  const TYPE_HELP = 'Write the tones as marks or numbers: nǐ hǎo or ni3 hao3. Hanzi also works.';
  const qTypePinyin = (zh, ex) => ({ type:'type', kicker:'Type it', prompt:'Type the pinyin for this word, with tones', big:zh, placeholder:'nǐ hǎo or ni3 hao3', exp:{ zh, py:BANK[zh].py }, accepts:pinyinAccepts(BANK[zh].py, ''), reveal:BANK[zh].py + ' · ' + BANK[zh].en, explain:TYPE_HELP + ' Example: ' + ex.zh + ' ' + ex.py, word:zh, dim:'prod' });
  const qSayIt = (zh, ex) => ({ type:'type', kicker:'Say it', prompt:'Say this out loud, then type its pinyin with tones', big:BANK[zh].en, bigCls:'en', sayEn:BANK[zh].en, placeholder:'nǐ hǎo or ni3 hao3', exp:{ zh, py:BANK[zh].py }, accepts:pinyinAccepts(BANK[zh].py, ''), reveal:zh + ' · ' + BANK[zh].py, explain:TYPE_HELP + ' Example: ' + ex.zh + ' ' + ex.py, word:zh, dim:'prod' });
  const ORDER_IDS = 'abcd';
  const orderQ = (toks, base) => {
    let p;
    let tries = 0;
    do { p = shuffle(toks.map((_, i) => i)); tries++; } while (toks.length > 1 && p.every((v, i) => v === i) && tries < 12);
    return Object.assign({}, base, { type:'order', toks, tiles:p.map(i => toks[i]), seq:toks.map((_, j) => p.indexOf(j)) });
  };
  function prepGrammar(L) { return L.q.map(prepQ); }
  function prepQ(q) {
    {
      const base = { kicker:q.kicker, prompt:q.prompt, reveal:q.reveal, explain:q.explain, py:q.sentence && q.sentence.py ? q.sentence.py : '' };
      if (q.type === 'order') return orderQ(q.toks, base);
      if (q.type === 'cloze') return Object.assign(base, { type:'cloze', big:q.big, sub:q.sub, placeholder:q.placeholder, accepts:q.accepts });
      if (q.type === 'spot') return Object.assign(base, { type:'spot', tokens:q.tokens, punct:q.punct, spot:q.spot });
      const opts = shuffle(q.options.map(o => o.label));
      return Object.assign(base, { type:'mc', options:opts.map((label, i) => ({ id:ORDER_IDS[i], label })), correct:ORDER_IDS[opts.indexOf(q.reveal)] });
    }
  }
  // ---------- grammar review: every grammar point has its own memory (recognise it, write it), see content/gpoints.json ----------
  const isG = (m) => m === 'grammar' || m === 'greview';
  let GPT_REG = null;
  const gptReg = () => {
    if (GPT_REG) return GPT_REG;
    const reg = {};
    LVLS.forEach(n => {
      const G = window['HSK' + n + '_GRAMMAR'] || {};
      (G.points || []).forEach(p => { reg[p.id] = { id:p.id, title:p.title, lesson:p.lesson, level:n, write:p.write || [], pool:[] }; });
      (G.lessons || []).forEach(l => (l.q || []).concat(l.qx || []).forEach(q => { if (q.pt && reg[q.pt]) reg[q.pt].pool.push(q); }));
    });
    GPT_REG = reg; return reg;
  };
  // a point's state: how well you recognise it, how well you write it, and whether it counts as mastered (that needs your own sentence)
  const gptInfo = (e) => {
    e = e || {}; const r = e.r || { s:0 }, w = e.w || { s:0 };
    const rm = Math.round(mast(r)), wm = Math.round(mast(w));
    const mastered = (e.wok || 0) >= 2 && w.s >= 4 && r.s >= 2;
    const started = r.s > 0 || w.s > 0;
    const state = mastered ? 'mastered' : !started ? 'new' : rm >= 55 && wm > 0 ? 'strong' : rm >= 30 ? 'familiar' : 'learning';
    const rDue = r.s > 0 && dueIn(r, 0) <= 0, wDue = w.s > 0 && dueIn(w, 0) <= 0;
    const due = rDue || (wDue && aiReadyNow());   // a writing memory only counts as due when you can write (an AI key is saved), so the count is always something a session can clear
    return { rm, wm, mastered, started, state, due, rDue, wDue, label:{ mastered:'Mastered', strong:'Strong', familiar:'Familiar', learning:'Learning', new:'New' }[state] };
  };
  const G_SYSTEM = [
    'You check one sentence written by a learner of Chinese (HSK 1 to 4). Reply with JSON only.',
    'You are given the English prompt, the grammar point being practised, and the learner\'s answer.',
    'The answer may be in Chinese characters or in pinyin. Pinyin is allowed to have no tones, no tone marks, no punctuation, no capital letters, and no spaces between syllables (niyoumeiyoushouji means ni you mei you shou ji). Work out the sentence the learner meant, and judge that sentence. Never fail an answer, and never mention tones, spacing, capitals or punctuation in the reason, because of how the pinyin is written. Without tones one run of pinyin can be read several ways: choose the reading that makes a natural sentence matching the English prompt (for example ba ba is 爸爸, rang is 让, he is 和, you duo yuan after a place is 有多远), and judge that. If it can be read as a correct sentence, it is correct.',
    'The grammar point name may list several patterns (for example "请, 一下 and 喂"). The sentence only has to use the pattern that the English prompt calls for, not all of them.',
    'Pass the answer only if all three are true: (1) the Chinese is grammatical and natural; (2) it uses the grammar point asked for; (3) it says what the English prompt says. Different natural wording, extra detail, or a different but correct word choice is fine. Ignore punctuation and spacing.',
    'Otherwise the verdict is "fix".',
    'Format: {"verdict":"pass" or "fix","better":"a corrected Chinese sentence, or the same sentence if it passes","reason":"one short sentence in English"}'
  ].join('\n');
  const gptWeight = (e) => {
    const info = gptInfo(e);
    if (!info.started) return 1;
    const rr = e.r && e.r.s > 0 ? retr(e.r) : 0.5;
    const miss = e.rn ? (e.rn - (e.rok || 0)) / e.rn : 0;
    let w = 0.4 + 3 * (1 - rr) + 1.5 * miss + (info.due ? 1.5 : 0);
    if (info.mastered && !info.due) w *= 0.25;
    return w;
  };
  // a session: weak and due points first, a few new ones, and (when an AI key is saved) a sentence of your own for points you already recognise
  // a grammar point joins Grammar review once its lesson is passed (80%), like a word joins Review words once it is learned
  const gptOpen = (S, id) => { const p = gptReg()[id]; return !!p && ((S.gres || {})[p.lesson] || 0) >= 80; };
  const gptSession = (S, levels, size, canWrite) => {
    const reg = gptReg();
    let ids = Object.keys(reg).filter(id => levels.indexOf(reg[id].level) >= 0 && reg[id].pool.length && gptOpen(S, id));
    const chosen = []; let news = 0;
    // due points come first (weakest first, in a random order among equals), so every question you answer works the count down; only then does a session add weak and new points
    const dueFirst = ids.filter(id => gptInfo(S.gpt[id]).due).map(id => ({ id, k:gptWeight(S.gpt[id]) * (0.6 + Math.random() * 0.8) })).sort((p, q) => q.k - p.k).map(x => x.id);
    dueFirst.slice(0, size).forEach(id => chosen.push(id));
    ids = ids.filter(id => chosen.indexOf(id) < 0);
    while (chosen.length < size && ids.length) {
      let rows = ids.map(id => ({ id, w:gptWeight(S.gpt[id]) * (gptInfo(S.gpt[id]).started ? 1 : (news >= 3 ? 0 : 1)) })).filter(x => x.w > 0);
      if (!rows.length) rows = ids.map(id => ({ id, w:gptWeight(S.gpt[id]) }));   // only new points are left: a first session still gets a full set
      if (!rows.length) break;
      let t = rows.reduce((a, x) => a + x.w, 0) * Math.random(), pick = rows[rows.length - 1];
      for (const x of rows) { t -= x.w; if (t <= 0) { pick = x; break; } }
      chosen.push(pick.id); ids = ids.filter(i => i !== pick.id);
      if (!gptInfo(S.gpt[pick.id]).started) news++;
    }
    return chosen.map(id => {
      const e = S.gpt[id] || {}; const pt = reg[id]; const info = gptInfo(e);
      const wr = pt.write;
      const wantWrite = canWrite && wr.length && e.r && e.r.s >= 1.5 && (info.wDue ? (info.rDue ? Math.random() < 0.5 : true) : info.rDue ? false : (e.w && e.w.s > 0 ? Math.random() < 0.25 : Math.random() < 0.6));
      if (wantWrite) {
        const w = wr[(e.wn || 0) % wr.length];
        return { type:'write', kicker:'Write it · ' + pt.title, prompt:'Write this in Chinese (characters or pinyin)', big:w.en, bigCls:'en', placeholder:'Your own sentence', pt:id, gdim:'w', gtitle:pt.title, model:w.zh, need:w.need || '', reveal:w.zh, explain:'' };
      }
      let k = Math.floor(Math.random() * pt.pool.length);
      if (pt.pool.length > 1 && k === (e.li || 0) % pt.pool.length) k = (k + 1) % pt.pool.length;
      return Object.assign(prepQ(pt.pool[k]), { pt:id, gdim:'r', gpool:k, gtitle:pt.title });
    });
  };
  // quick checks before asking the AI: the pattern the prompt is about must be in a sentence written in characters
  const writeLocal = (q, text) => {
    if (!/[一-鿿]/.test(text) || !q.need) return null;
    const ok = q.need.split('|').some(alt => alt.split('+').every(x => text.indexOf(x) >= 0));
    return ok ? null : 'This point needs ' + q.need.split('|').map(alt => alt.split('+').join(' and ')).join(' or ') + ' in the sentence.';
  };
  // the learner wrote the model answer (in characters, or in pinyin with or without tones, spaces, capitals, punctuation): right, no AI needed
  const writeSame = (q, text) => {
    const cjk = (x) => String(x || '').replace(/[^一-鿿]/g, '');
    if (/[一-鿿]/.test(text)) return cjk(text) === cjk(q.model);
    const toks = segHsk(q.model); const py = aiPinyin(toks);
    return !!py && toneless(py) === toneless(text);
  };
  const gParse = (text) => {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('The reply was not in the expected format.');
    const o = JSON.parse(text.slice(i, j + 1)); const v = String(o.verdict || '').toLowerCase();
    if (v !== 'pass' && v !== 'fix') throw new Error('The reply was not in the expected format.');
    return { verdict:v, better:String(o.better || ''), reason:String(o.reason || '') };
  };
  // Claude Sonnet when an Anthropic key is saved (it got all 30 test sentences right); Qwen Plus when only an Alibaba key is
  async function gAiCheck(q, text) {
    // pinyin with no spaces or tones is hard to read as one run (a weaker model failed babarangwomaiyao): give it syllables, and the model answer's pinyin to line them up with
    const pyIn = !/[一-鿿]/.test(text);
    const split = pyIn ? pySplit(text) : '';
    const mpy = aiPinyin(segHsk(q.model));
    const user = 'English prompt: ' + q.big + '\nGrammar point: ' + q.gtitle + '\nOne model answer (other natural answers are fine too): ' + q.model + (mpy ? ' (' + mpy + ')' : '') +
      (pyIn ? '\nLearner\'s answer, written in pinyin without tones: ' + text + '\nThe same split into syllables (a best guess; the split or a missing tone is never the learner\'s mistake): ' + split : '\nLearner\'s answer: ' + text);
    if (AICFG.key) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 30000);
      let res;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:ctl.signal,
          headers:{ 'x-api-key':AICFG.key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true', 'content-type':'application/json' },
          body:JSON.stringify({ model:'claude-sonnet-5-5', max_tokens:300, system:G_SYSTEM, messages:[{ role:'user', content:user }] }) });
      } catch (e) { throw new Error('Could not reach the AI service. Check your connection.'); } finally { clearTimeout(tm); }
      if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
      if (res.status === 429) throw new Error('Too many requests right now. Wait a moment.');
      if (!res.ok) throw new Error('The AI service had a problem (' + res.status + ').');
      const d = await res.json();
      return Object.assign(gParse((d.content || []).filter(b => b.type === 'text').map(b => b.text).join('')), { by:'claude' });
    }
    if (aliUsable()) {
      const body = { model:'qwen-plus', max_tokens:300, messages:[{ role:'system', content:G_SYSTEM }, { role:'user', content:user }], response_format:{ type:'json_object' } };
      let data;
      try { data = await aliPost(body, 'grammar'); }
      catch (e) { if (e.status === 400 && /response_format|json/i.test(e.detail || '')) { delete body.response_format; data = await aliPost(body, 'grammar'); } else throw e; }
      return Object.assign(gParse(aiText(data)), { by:'qwen' });
    }
    throw new Error('No AI key is saved on this device.');
  }


  // ---------- Listening lab, Meaning: hear a clip, say what it means in English, the AI checks it ----------
  const M_SYSTEM = [
    'A learner of Mandarin (HSK 1 to 4) heard a short Chinese sentence and typed what they think it means in English. Reply with JSON only.',
    'You are given the Chinese, its pinyin, one model English translation, and the learner\'s answer.',
    'Judge only whether the learner\'s English carries the meaning of the Chinese. The wording does not have to match the model: synonyms, contractions, missing articles, spelling slips and other natural phrasings are fine, and so is a different tense where the Chinese does not show tense.',
    '"pass": the meaning is right, even if worded differently. "close": the main idea is right but one part is missing or slightly off (for example a detail such as the time, the number, who does it, or a small word like 吗 that makes it a question). "fix": the meaning is wrong, or most of it is missing.',
    'Do not be generous when a key word is wrong: "drink" for "eat", "tomorrow" for "yesterday", "I" for "you", a statement for a question, or a missing 不 or 没 all change the meaning.',
    'Format: {"verdict":"pass" or "close" or "fix","reason":"one short sentence in plain English. For close or fix, say what part to look at again, without just repeating the model answer. For pass, an empty string."}'
  ].join('\n');
  const mParse = (text) => {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('The reply was not in the expected format.');
    const o = JSON.parse(text.slice(i, j + 1)); const v = String(o.verdict || '').toLowerCase();
    if (v !== 'pass' && v !== 'close' && v !== 'fix') throw new Error('The reply was not in the expected format.');
    return { verdict:v, reason:String(o.reason || '') };
  };
  const mNorm = (t) => String(t || '').toLowerCase().replace(/[’']/g, '\'').replace(/\b(i|you|he|she|we|they|it|that|what|there|who|where|how|let)'(m|re|s|ll|ve|d)\b/g, (m0, a, b) => a + ' ' + ({ m:'am', re:'are', s:'is', ll:'will', ve:'have', d:'would' })[b]).replace(/\b(don|doesn|didn|isn|aren|can|won)'t\b/g, (m0, a) => (a === 'can' ? 'cannot' : a === 'won' ? 'will not' : a + ' not')).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the learner wrote the model answer, give or take punctuation, capitals and contractions: right, no AI needed
  const meanLocal = (clip, text) => (mNorm(text) && mNorm(text) === mNorm(clip.en) ? { verdict:'pass', reason:'' } : null);
  // Claude Haiku when an Anthropic key is saved; Qwen when only an Alibaba key is
  async function mAiCheck(clip, text) {
    const user = 'Chinese: ' + clip.zh + '\nPinyin: ' + clip.py + '\nModel English: ' + clip.en + '\nLearner\'s English: ' + text;
    if (AICFG.key) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 30000);
      let res;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:ctl.signal,
          headers:{ 'x-api-key':AICFG.key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true', 'content-type':'application/json' },
          body:JSON.stringify({ model:'claude-haiku-5-5', max_tokens:200, system:M_SYSTEM, messages:[{ role:'user', content:user }] }) });
      } catch (e) { throw new Error('Could not reach the AI service. Check your connection.'); } finally { clearTimeout(tm); }
      if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
      if (res.status === 429) throw new Error('Too many requests right now. Wait a moment.');
      if (!res.ok) throw new Error('The AI service had a problem (' + res.status + ').');
      const d = await res.json();
      return Object.assign(mParse((d.content || []).filter(b => b.type === 'text').map(b => b.text).join('')), { by:'Claude' });
    }
    if (aliUsable()) {
      const body = { model:'qwen-plus', max_tokens:200, messages:[{ role:'system', content:M_SYSTEM }, { role:'user', content:user }], response_format:{ type:'json_object' } };
      let data;
      try { data = await aliPost(body, 'meaning'); }
      catch (e) { if (e.status === 400 && /response_format|json/i.test(e.detail || '')) { delete body.response_format; data = await aliPost(body, 'meaning'); } else throw e; }
      return Object.assign(mParse(aiText(data)), { by:'Qwen' });
    }
    throw new Error('No AI key is saved on this device.');
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
    return picks.map((zh, i) => {
      const kind = kinds[(i + offset) % kinds.length];
      const ex = kind === 'cloze' ? pickEx(zh, e => e.toks.indexOf(zh) >= 0 && e.zh.split(zh).length === 2)
        : kind === 'order' ? pickEx(zh, e => e.toks.length >= 3 && e.toks.length <= 8) : pickEx(zh);
      if (kind === 'listen') return qHearWord(zh, ex);
      if (kind === 'type') return qTypePinyin(zh, ex);
      if (kind === 'cloze' && ex.toks.indexOf(zh) >= 0 && ex.zh.split(zh).length === 2) return { type:'cloze', kicker:'Fill it', prompt:'Type the missing word', big:ex.zh.replace(zh, '___'), sub:ex.en, placeholder:'Hanzi, or pinyin with tones', exp:{ zh, py:BANK[zh].py }, accepts:pinyinAccepts(BANK[zh].py, zh), reveal:zh + ' · ' + BANK[zh].py, explain:ex.py + ' (' + TYPE_HELP + ')', word:zh, dim:'prod' };
      if (kind === 'order' && ex.toks.length >= 3 && ex.toks.length <= 8) return orderQ(ex.toks, { kicker:'Build it', prompt:'Put the words in order: ' + ex.en, reveal:ex.zh, explain:ex.py });
      return qMeaning(zh);
    });
  }

  // ---------- talking with an AI (bring-your-own-key, straight from the browser) ----------
  // every word the conversation may use: this level's words, plus the earlier levels' words (at HSK 2 that is HSK 1 too)
  const KB = {};
  for (let n = 1; n < (ALL ? TOPL : LV); n++) (window['HSK' + n + '_WORDS'] || []).forEach(w => { KB[w.zh] = { py:w.py, en:w.en }; });
  WORDS.forEach(w => { KB[w.zh] = { py:w.py, en:w.en }; });
  const CHAR_GLOSS = window.CHAR_GLOSSES || {};
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
  const FILLER = { '嗯':'èn', '哦':'ò', '哎':'āi', '哈':'hā', '呀':'ya', '喂':'wèi' };
  const LEX = window.SHANLU_LEXICON || {};   // words written solid that are not on the HSK lists (每天, 前边 ...): spaced and spelt as one word
  const segHsk = (text) => {
    const out = [];
    for (let i = 0; i < text.length;) {
      let hit = null;
      for (let n = Math.min(MAXW, text.length - i); n >= 1; n--) { const w = text.substr(i, n); if (KB[w] || ERH_ALT[w] || PV[w]) { hit = w; break; } }
      let lx = ''; for (let n = Math.min(4, text.length - i); n >= 2; n--) { const w = text.substr(i, n); if (LEX[w]) { lx = w; break; } }
      if (lx && (!hit || lx.length > hit.length)) { out.push({ t:lx, py:LEX[lx], cjk:true, ok:true }); i += lx.length; continue; }   // a solid word: one unit, nothing to flag (its characters are on the lists)
      if (hit && !KB[hit] && ERH_ALT[hit]) { out.push({ t:hit, py:ERH_ALT[hit], cjk:true, ok:true }); i += hit.length; continue; }
      if (hit && KB[hit]) { out.push({ t:hit, py:KB[hit].py.split('/')[0].trim(), cjk:true, ok:true }); i += hit.length; continue; }
      if (hit) { out.push({ t:hit, py:PV[hit][0], en:PV[hit][1], cjk:true, ok:true, pv:true }); i += hit.length; continue; }
      const ch = text[i]; const cjk = /[\u4e00-\u9fff]/.test(ch);
      if (FILLER[ch] && !CHARSET[ch]) { out.push({ t:ch, py:FILLER[ch], cjk:true, ok:true }); i++; continue; }   // spoken fillers: not vocabulary, but nothing to flag
      out.push({ t:ch, py:'', cjk, ok:!cjk || !!CHARSET[ch] });
      i++;
    }
    return out;
  };
  // every toneless pinyin syllable (v = ü): used to split a run-on typed answer such as babarangwomaiyao into syllables before the AI reads it
  const PY_SYL = new Set((
    'a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu ca cai can cang cao ce cen ceng cha chai chan chang chao che ' +
    'chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo da dai dan dang dao de dei den deng di ' +
    'dia dian diao die ding diu dong dou du duan dui dun duo e ei en eng er fa fan fang fei fen feng fiao fo fou fu ga gai gan gang gao ge gei ' +
    'gen geng gong gou gu gua guai guan guang gui gun guo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji jia ' +
    'jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo la ' +
    'lai lan lang lao le lei len leng li lia lian liang liao lie lin ling liu long lou lu luan lun luo lv lve ma mai man mang mao me mei men meng ' +
    'mi mian miao mie min ming miu mo mou mu na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nun nuo nv ' +
    'nve o ou pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun ' +
    'ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo sa sai san sang sao se sen seng sha shai shan shang shao she shei shen sheng ' +
    'shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo ta tai tan tang tao te tei teng ti tian tiao tie ting ' +
    'tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yan yang ' +
    'yao ye yi yin ying yong you yu yuan yue yun za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou ' +
    'zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo').split(' '));
  const pyBase = (ch) => /[üǖǘǚǜÜ]/.test(ch) ? 'v' : ch.normalize('NFD')[0].toLowerCase();
  const pySplit = (text) => String(text || '').split(/([^A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)/).map(chunk => {
    if (!/^[A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/.test(chunk)) return chunk;
    const b = Array.from(chunk).map(pyBase).join(''), n = b.length; if (n < 2) return chunk;
    const best = new Array(n + 1).fill(null); best[0] = { c:0, from:-1 };
    for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 6); j < i; j++) {
      if (!best[j] || !PY_SYL.has(b.slice(j, i))) continue;
      const c = best[j].c + 1;
      if (!best[i] || c < best[i].c || (c === best[i].c && j < best[i].from)) best[i] = { c, from:j };   // fewest syllables; on a tie, the longer last syllable
    }
    if (!best[n]) return chunk;
    const cuts = []; for (let i = n; i > 0; i = best[i].from) cuts.unshift(i);
    const chars = Array.from(chunk); let prev = 0; const out = [];
    cuts.forEach(e => { out.push(chars.slice(prev, e).join('')); prev = e; });
    return out.join(' ');
  }).join('').replace(/\s+/g, ' ').trim();
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
    const known = KNOWN_LISTS;   // the lists the learner knows
    const nextN = 'HSK ' + (TOPL + 1);                        // the level the conversation may peek at
    const up = Object.keys(PV).length > 0;
    return [
      'You are Mingming (明明), a friendly Mandarin conversation partner for an adult English-speaking beginner who is studying for HSK ' + TOPL + (TOPL === 1 ? '' : ' (' + listJoin(LV_NAMES.slice(0, -1)) + ' words are known too)') + (up ? ' and is happy to see a little ' + nextN + ' as a preview.' : '.'),
      'Speak Simplified Chinese. Use mainly words from this ' + known + ' word list (plus punctuation and numbers): ' + KB_KEYS.join(' ') + '.',
      up ? 'You may also use a few words from this ' + nextN + ' list as a gentle preview, at most one or two in a reply, when they make the conversation more natural and realistic or let you cover more everyday situations (cafés, travel, directions, hobbies, health, school, work): ' + Object.keys(PV).join(' ') + '. Never use a word that is on neither list.' : 'Never use a word that is not on the list.',
      'If you need a word that is ' + (up ? 'on neither list' : 'not on the list') + ', say it another way with listed words. Never write pinyin in the Chinese. When you say your own name, say 我叫明明 (the standard way to give a name), not 我是明明. ' + LSN_LEVELS[lsnLvl() - 1].spec + ' Ask at most one simple question, so the learner can answer.',
      scn ? 'Role-play setting: ' + scn.title + '. Goals for the learner: ' + scn.goals.join('; ') + '. Stay in this setting and play the other person.' : 'Free chat: pick an everyday topic (food, family, school, weather, plans) and keep it simple.',
      'After each learner message, also judge it. Say "ok" if it is natural and understandable Mandarin. Say "fix" if it has a grammar, word choice or naturalness problem: then give the corrected sentence in Chinese (' + (up ? known + ' words, or a ' + nextN + ' word if it really helps' : known + ' words') + ') and a one-sentence reason in simple English. ' + (up ? 'Using a ' + nextN + ' word is never a mistake. ' : '') + 'Do not nitpick: only fix real problems. If the learner writes English, give "fix" with the Chinese they could say. The learner message may come from speech recognition and contain wrong characters: if it does not make sense, ask them to say it again as the reply.',
      'Answer with ONLY a JSON object, no other text: {"reply":{"zh":"<your Chinese>","en":"<English translation>"},"feedback":{"level":"ok"|"fix","better":"<corrected Chinese or empty>","why":"<short English reason or empty>","understood":true|false|null},"remember":["<a short English fact, or leave the list empty>"],"suggest":{"zh":"<suggested learner reply>","en":"<English>"}}. For the very first message of a conversation, set feedback to {"level":"ok","better":"","why":"","understood":null}.',
      'About "understood": it is about your PREVIOUS reply. Say true if the learner\'s message answers or reacts sensibly to it. Say false if the message shows they misheard or misunderstood it (an answer to a different question, or something unrelated), or if they ask you to repeat it. Say null if there was no previous reply or the learner only greeted you.',
      memOn() ? 'About "remember": if the learner just told you a lasting, everyday fact about themselves (a hobby, a food they like, a pet, a place, a plan, the kind of work they do), put it in "remember" as a short English phrase such as "learner likes hiking". At most one per reply, only what the learner actually said, never anything about health, money, politics, religion, documents or other sensitive matters. Otherwise use an empty list.' : 'Always use an empty list for "remember".',
      memOn() && memFacts().length ? 'Things the learner told you in earlier chats (use at most one, only when it fits naturally, never invent details, and never say that you remember): ' + memFacts().slice(-12).map(f => f.t).join('; ') + '.' : '',,
      'Also always add "suggest":{"zh":"<one natural, short reply (about 12 characters or fewer) the learner could say next to answer you, ' + (up ? known + ' words or at most one ' + nextN + ' word' : known + ' words') + ', no pinyin>","en":"<its English meaning>"} so a beginner who is stuck can see what to say. Use 我叫… when giving a name.'
    ].filter(Boolean).join('\n');
  };
  const aiParse = (text) => {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j < i) throw new Error('The reply was not in the expected format.');
    const o = JSON.parse(text.slice(i, j + 1));
    if (!o.reply || typeof o.reply.zh !== 'string') throw new Error('The reply was not in the expected format.');
    return { zh:o.reply.zh, en:o.reply.en || '', sug:o.suggest && typeof o.suggest.zh === 'string' && o.suggest.zh.trim() ? { zh:o.suggest.zh.trim(), en:o.suggest.en || '' } : null, fb:o.feedback && o.feedback.level === 'fix' ? { better:o.feedback.better || '', why:o.feedback.why || '' } : null,
      understood:o.feedback && typeof o.feedback.understood === 'boolean' ? o.feedback.understood : null, remember:Array.isArray(o.remember) ? o.remember.filter(x => typeof x === 'string').slice(0, 2) : [] };
  };
  // ---- the shared AI (friends server): status is kept on this device ({ on, used, limit, left, day, at }) so the AI features appear offline too ----
  const RELAY_KEY = 'shanlu-relay';
  const relayGet = () => { try { return JSON.parse(localStorage.getItem(RELAY_KEY) || 'null'); } catch (e) { return null; } };
  const relayPut = (v) => { try { localStorage.setItem(RELAY_KEY, JSON.stringify(v)); } catch (e) {} };
  function relayOn() {
    try { if (!FR || !FR.enabled() || !FR.identity()) return false; const c = relayGet(); return !!(c && c.on && Date.now() - c.at < 7 * 864e5); } catch (e) { return false; }
  }
  // asks the server (on start, after joining, and when Settings opens). Returns true when what the page should offer has changed.
  async function relayRefresh() {
    if (!FR || !FR.enabled() || !FR.identity()) return false;
    const before = relayOn();
    try { const s = await FR.aiStatus(); relayPut({ on:!!s.on, blocked:!!s.blocked, used:s.used, limit:s.limit, left:s.left, day:s.day, at:Date.now() }); }
    catch (e) { if (e && (e.status === 404 || e.status === 401)) relayPut({ on:false, at:Date.now() }); }   // an older server (no shared AI) or a key it no longer knows; a lost connection keeps what was saved
    return relayOn() !== before;
  }
  const relayUsed = (ai) => { const c = relayGet(); if (c && ai) relayPut(Object.assign({}, c, { used:ai.used, limit:ai.limit, left:ai.left })); };
  // what a refused or failed shared-AI call says (the err.status / err.detail pair mirrors aliPost, so its retry rules keep working)
  function relayError(e) {
    const code = e && e.code, j = (e && e.json) || {}, c = relayGet() || {};
    let msg;
    if (code === 'ai_limit') { relayPut(Object.assign({}, c, { left:0 })); msg = 'You have used today\'s AI allowance' + (c.limit ? ' (' + c.limit + ' calls)' : '') + '. It starts again after midnight Pacific time. Until then the browser\'s own voice and recogniser still work.'; }
    else if (code === 'ai_busy') msg = 'The whole group has used up the shared AI for today. It starts again after midnight Pacific time.';
    else if (code === 'ai_off') { relayPut(Object.assign({}, c, { on:false })); msg = 'The shared AI is switched off for you. Ask Alvin, or save a key of your own in Settings.'; }
    else if (code === 'ai_not_set_up') { relayPut(Object.assign({}, c, { on:false })); msg = 'The shared AI is not switched on yet.'; }
    else if (code === 'network') msg = 'Could not reach the AI service. Check your connection.';
    else if (code === 'upstream') msg = 'Alibaba had a problem' + (j.upstream ? ' (' + j.upstream + ')' : '') + (j.detail ? ': ' + j.detail : '') + '.';
    else msg = (e && e.message) || 'The shared AI had a problem.';
    const err = new Error(msg);
    if (code === 'upstream' && j.upstream) { err.status = j.upstream; err.detail = j.detail || ''; }
    err.code = code;
    return err;
  }
  // the line in Settings about the shared AI
  function relayShown() {
    if (!FR || !FR.enabled() || !FR.identity()) return { show:false, text:'' };
    const c = relayGet();
    if (relayOn()) {
      const used = c.used || 0, lim = c.limit || 0;
      return { show:true, text:'Your study group\'s shared AI is on, so Mingming, answer checking, the voice recogniser and the voice work without a key of your own. ' +
        (lim ? 'Today you have used ' + used + ' of ' + lim + ' calls (a chat message, an answer check, a recording or a spoken line is one call each). ' : '') +
        'The allowance starts again after midnight Pacific time.' + (aliOwn() ? ' You also have a key of your own: it is used first, and then nothing counts against the allowance.' : '') };
    }
    if (c && c.blocked) return { show:true, text:'The study group\'s shared AI is switched off for you. Ask Alvin, or save a key of your own below.' };
    return { show:false, text:'' };
  }
  async function relayPost(body, feature) {
    if (!relayOn()) throw new Error('No Alibaba key is saved on this device.');
    const b = Object.assign({}, body);
    if (feature !== 'asr' && !/^qwen-(flash|plus)$/.test(b.model || '')) b.model = 'qwen-flash';   // the shared key serves two chat models only
    try { const r = await FR.aiChat(feature, b); relayUsed(r.ai); return r.data; } catch (e) { throw relayError(e); }
  }
  // Alibaba Cloud Model Studio (OpenAI-compatible endpoint). Used for the conversation and for the voice recogniser.
  async function aliPost(body, feature) {
    if (!aliOwn()) return relayPost(body, feature || 'chat');
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
      try { data = await aliPost(body, 'chat'); }
      catch (e) { if (e.status === 400 && /response_format|json/i.test(e.detail || '')) { delete body.response_format; data = await aliPost(body, 'chat'); } else throw e; }
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
    try { data = await aliPost(body, 'asr'); }
    catch (e) { if (e.status === 400 && /language|asr_options/i.test(e.detail || '')) { delete body.asr_options.language; data = await aliPost(body, 'asr'); } else throw e; }
    return aiText(data).trim();
  }

  // made lines are remembered on this device for 20 of the 24 hours their link lives (a reload or a second look at a clip is not made, or billed, again)
  const TTS_KEPT = 'shanlu-tts-links';
  const ttsKept = (ck) => { try { const m = JSON.parse(localStorage.getItem(TTS_KEPT) || '{}'); const c = m[ck]; return c && c.exp > Date.now() ? c : null; } catch (e) { return null; } };
  const ttsKeep = (ck, c) => {
    try {
      const m = JSON.parse(localStorage.getItem(TTS_KEPT) || '{}'), now = Date.now();
      Object.keys(m).forEach(k => { if (!(m[k].exp > now)) delete m[k]; });
      m[ck] = c;
      const ks = Object.keys(m); if (ks.length > 250) ks.sort((a, b) => m[a].exp - m[b].exp).slice(0, ks.length - 250).forEach(k => delete m[k]);
      localStorage.setItem(TTS_KEPT, JSON.stringify(m));
    } catch (e) {}
  };

  // one line of text -> a link to a WAV file (valid for 24 hours); the page plays it with an <audio> element, so no cross-site download is needed
  async function aliTTS(text, voice) {
    if (!aliOwn()) {   // no key of your own: the friends server makes the line
      if (!relayOn()) throw new Error('No Alibaba key is saved on this device.');
      let r; try { r = await FR.aiTts(text.slice(0, 600), voice); } catch (e) { throw relayError(e); }
      relayUsed(r.ai);
      const u = r.data && r.data.output && r.data.output.audio && r.data.output.audio.url;
      if (!u) throw new Error('Alibaba answered but sent no audio link.');
      return String(u).replace(/^http:\/\//, 'https://');
    }
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
  // Photos for exam pictures (data/exam-media.js, chosen by hand from Wikimedia Commons). A picture without a photo, or whose photo did not load, stays an emoji.
  const EXAM_MEDIA = window.SHANLU_EXAM_MEDIA || {};
  const exBad = {};   // photo addresses that did not load
  // Drawings come first (data/exam-art.js, made by tools/exam-art.js, the same look as the souvenirs); a photo or the emoji is only the fallback for a picture that has no drawing.
  const EXAM_ART = window.SHANLU_EXAM_ART || {};
  const exPhoto = (e) => { const k = e ? String(e).replace(/\uFE0F/g, '') : ''; const d = EXAM_ART[k]; if (d && d.u) return d; const m = k ? EXAM_MEDIA[k] : null; return m && m.u && !exBad[m.u] ? m : null; };
  const EX_PICNOTE = Object.keys(EXAM_ART).length ? 'drawings stand in for them' : Object.keys(EXAM_MEDIA).length ? 'photos (where a clear one is free to use) and emoji stand in for them' : 'emoji stand in for them';
  const EXAM_MIN = EXAMBANK && EXAMBANK.meta ? { listening:EXAMBANK.meta.listening.minutes, reading:EXAMBANK.meta.reading.minutes } : { listening:15, reading:20 };
  const EXAM_N = EXAMBANK && EXAMBANK.meta ? { listening:EXAMBANK.meta.listening.questions, reading:EXAMBANK.meta.reading.questions } : { listening:20, reading:20 };
  // HSK 3 also has a writing section; the site treats it as practice (it is not part of the 200 points or the seal)
  const HAS_WRITING = !!(EXAMBANK && EXAMBANK.meta && EXAMBANK.meta.writing);
  if (HAS_WRITING) { EXAM_MIN.writing = EXAMBANK.meta.writing.minutes; EXAM_N.writing = EXAMBANK.meta.writing.questions; }
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
  const PART_3 = {
    L1:{ sec:'listening', n:1, inst:'Listen to the conversation. Choose the picture it is about.' },
    L2:{ sec:'listening', n:2, inst:'Listen to the passage. Does the sentence on the screen match what you heard?' },
    L3:{ sec:'listening', n:3, inst:'Listen to the short conversation and the question. Choose the answer.' },
    L4:{ sec:'listening', n:4, inst:'Listen to the longer conversation and the question. Choose the answer.' },
    R1:{ sec:'reading', n:1, inst:'Choose the reply that fits the sentence.' },
    R2:{ sec:'reading', n:2, inst:'Choose the word that fills the blank.' },
    R3:{ sec:'reading', n:3, inst:'Read the passage. Choose the answer to the question.' },
    W1:{ sec:'writing', n:1, inst:'Tap the words in the right order to make a sentence. Tap a word again to take it back.' },
    W2:{ sec:'writing', n:2, inst:'Type the missing character. The pinyin under the sentence tells you how it sounds.' }
  };
  const PART_4 = {
    L1:{ sec:'listening', n:1, inst:'Listen to the passage. Does the sentence on the screen match what you heard?' },
    L2:{ sec:'listening', n:2, inst:'Listen to the short conversation and the question. Choose the answer.' },
    L3:{ sec:'listening', n:3, inst:'Listen to the longer conversation and the question. Choose the answer.' },
    R1:{ sec:'reading', n:1, inst:'Choose the word that fills the blank.' },
    R2:{ sec:'reading', n:2, inst:'Tap the three pieces in the right order to make a sentence. Tap a piece again to take it back.' },
    R3:{ sec:'reading', n:3, inst:'Read the passage. Choose the answer to the question.' },
    W1:{ sec:'writing', n:1, inst:'Tap the words in the right order to make a sentence. Tap a word again to take it back.' },
    W2:{ sec:'writing', n:2, inst:'Type the missing character. The pinyin under the sentence tells you how it sounds.' }
  };
  const PART = LV === 1 ? PART_1 : LV === 2 ? PART_2 : LV === 3 ? PART_3 : PART_4;
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
  // HSK 3: listening 10 + 10 + 10 + 10, reading 10 + 10 + 10 (the layout of the 2012 HSK 3 sample papers); writing practice 5 + 5
  const qRight = (q, a) => a !== undefined && (a === q.ans || (q.alts || []).indexOf(a) >= 0);
  const examQsL3 = (sec) => {
    const out = [];
    const add = (part, q) => { out.push(Object.assign({ part, id:part + '-' + out.length, sec:PART[part].sec }, q)); };
    const E = EXAMBANK;
    const sayRev = (lines, q) => ({ zh:lines.map(l => l.zh).join(' ') + (q ? ' ' + q.zh : ''), py:lines.map(l => l.py).join(' ') + (q ? ' ' + q.py : ''), en:lines.map(l => l.en).join(' ') + (q ? ' ' + q.en : '') });
    const textQ = (part, bank, n) => pickN(bank, n).forEach(e => { const order = shuffleArr([0, 1, 2]); const opts = order.map((k, j) => ({ v:j, label:e.opts[k].zh })); add(part, { kind:'text', audio:audioOf(e.say).concat([{ text:e.q.zh, pitch:1 }]), opts, ans:order.indexOf(0), rev:sayRev(e.say, e.q), right:e.opts[0].zh }); });
    if (sec === 'listening') {
      pickN(E.L1, 2).forEach(st => shuffleArr(st.items).forEach(it => add('L1', { kind:'match', audio:audioOf(it.say), opts:st.opts.map((p, k) => ({ v:k, label:p, emoji:true })), ans:it.ans, rev:sayRev(it.say), right:st.opts[it.ans] })));
      pickTFn(E.L2, 10).forEach(e => add('L2', { kind:'tf', text:e.st.zh, audio:audioOf(e.say), ans:e.ok ? 'T' : 'F', opts:[{ v:'T', label:'✓ It matches' }, { v:'F', label:'✗ It does not match' }],
        rev:{ zh:e.say.map(l => l.zh).join(' ') + ' / ' + e.st.zh, py:e.say.map(l => l.py).join(' ') + ' / ' + e.st.py, en:e.say.map(l => l.en).join(' ') + ' / ' + e.st.en }, right:e.ok ? 'It matches' : 'It does not match' }));
      textQ('L3', E.L3, 10);
      textQ('L4', E.L4, 10);
    } else if (sec === 'reading') {
      pickN(E.R1, 2).forEach(st => { const p1 = shuffleArr([0, 1, 2, 3, 4, 5]); st.items.forEach(it => add('R1', { kind:'match', text:it.zh, opts:p1.map((k, j) => ({ v:j, label:st.opts[k].zh })), ans:p1.indexOf(it.ans), rev:{ zh:it.zh + ' ' + st.opts[it.ans].zh, py:it.py + ' ' + st.opts[it.ans].py, en:it.en + ' ' + st.opts[it.ans].en }, right:st.opts[it.ans].zh })); });
      pickN(E.R2, 2).forEach(st => { const p2 = shuffleArr([0, 1, 2, 3, 4, 5]); st.items.forEach(it => add('R2', { kind:'match', text:it.zh, opts:p2.map((k, j) => ({ v:j, label:st.opts[k].zh })), ans:p2.indexOf(it.ans), rev:{ zh:it.full, py:it.py, en:it.en }, right:st.opts[it.ans].zh })); });
      pickN(E.R3, 10).forEach(e => { const order = shuffleArr([0, 1, 2]); add('R3', { kind:'text', text:e.zh + '\n' + e.q.zh, opts:order.map((k, j) => ({ v:j, label:e.opts[k].zh })), ans:order.indexOf(0), rev:{ zh:e.zh + ' ' + e.q.zh, py:e.py + ' ' + e.q.py, en:e.en + ' ' + e.q.en }, right:e.opts[0].zh }); });
    } else {
      // the words are never shown already in a right order (two identical words could otherwise swap places)
      pickN(E.W1, 5).forEach(e => { let order; const said = (o) => o.map(k => e.words[k]).join(''); do { order = shuffleArr(e.words.map((w, k) => k)); } while (said(order) === e.zh || (e.alts || []).indexOf(said(order)) >= 0); add('W1', { kind:'order', opts:order.map((k, j) => ({ v:j, label:e.words[k] })), ans:e.zh, alts:e.alts, rev:{ zh:e.zh, py:e.py, en:e.en }, right:e.zh }); });
      pickN(E.W2, 5).forEach(e => add('W2', { kind:'type', text:e.zh, hint:e.hint, opts:[], ans:e.ans, rev:{ zh:e.full, py:e.py, en:e.en }, right:e.ans }));
    }
    return out;
  };
  // HSK 4: listening 10 + 15 + 20, reading 10 + 10 + 20 (the layout of the 2012 HSK 4 sample papers; every question has four choices); writing practice 10 + 5
  const examQsL4 = (sec) => {
    const out = [];
    const add = (part, q) => { out.push(Object.assign({ part, id:part + '-' + out.length, sec:PART[part].sec }, q)); };
    const E = EXAMBANK;
    const sayRev = (lines, q) => ({ zh:lines.map(l => l.zh).join(' ') + (q ? ' ' + q.zh : ''), py:lines.map(l => l.py).join(' ') + (q ? ' ' + q.py : ''), en:lines.map(l => l.en).join(' ') + (q ? ' ' + q.en : '') });
    // a conversation, a question, four choices (the first one in the bank is the right one; the order is shuffled)
    const textQ = (part, bank, n) => pickN(bank, n).forEach(e => { const order = shuffleArr(e.opts.map((o, k) => k)); const opts = order.map((k, j) => ({ v:j, label:e.opts[k].zh })); add(part, { kind:'text', audio:audioOf(e.say).concat([{ text:e.q.zh, pitch:1 }]), opts, ans:order.indexOf(0), rev:sayRev(e.say, e.q), right:e.opts[0].zh }); });
    const tfOpts = [{ v:'T', label:'✓ It matches' }, { v:'F', label:'✗ It does not match' }];
    if (sec === 'listening') {
      pickTFn(E.L1, 10).forEach(e => add('L1', { kind:'tf', text:e.st.zh, audio:audioOf(e.say), ans:e.ok ? 'T' : 'F', opts:tfOpts,
        rev:{ zh:e.say.map(l => l.zh).join(' ') + ' / ' + e.st.zh, py:e.say.map(l => l.py).join(' ') + ' / ' + e.st.py, en:e.say.map(l => l.en).join(' ') + ' / ' + e.st.en }, right:e.ok ? 'It matches' : 'It does not match' }));
      textQ('L2', E.L2, 15);
      textQ('L3', E.L3, 20);
    } else if (sec === 'reading') {
      pickN(E.R1, 2).forEach(st => { const p1 = shuffleArr([0, 1, 2, 3, 4, 5]); st.items.forEach(it => add('R1', { kind:'match', text:it.zh, opts:p1.map((k, j) => ({ v:j, label:st.opts[k].zh })), ans:p1.indexOf(it.ans), rev:{ zh:it.full, py:it.py, en:it.en }, right:st.opts[it.ans].zh })); });
      // three pieces of a sentence, tapped in order (never shown already in the right order)
      pickN(E.R2, 10).forEach(e => { let order; const said = (o) => o.map(k => e.words[k]).join(''); do { order = shuffleArr(e.words.map((w, k) => k)); } while (said(order) === e.zh || (e.alts || []).indexOf(said(order)) >= 0); add('R2', { kind:'order', opts:order.map((k, j) => ({ v:j, label:e.words[k] })), ans:e.zh, alts:e.alts, rev:{ zh:e.zh, py:e.py, en:e.en }, right:e.zh }); });
      pickN(E.R3, 20).forEach(e => { const order = shuffleArr(e.opts.map((o, k) => k)); add('R3', { kind:'text', text:e.zh + '\n' + e.q.zh, opts:order.map((k, j) => ({ v:j, label:e.opts[k].zh })), ans:order.indexOf(0), rev:{ zh:e.zh + ' ' + e.q.zh, py:e.py + ' ' + e.q.py, en:e.en + ' ' + e.q.en }, right:e.opts[0].zh }); });
    } else {
      pickN(E.W1, 10).forEach(e => { let order; const said = (o) => o.map(k => e.words[k]).join(''); do { order = shuffleArr(e.words.map((w, k) => k)); } while (said(order) === e.zh || (e.alts || []).indexOf(said(order)) >= 0); add('W1', { kind:'order', opts:order.map((k, j) => ({ v:j, label:e.words[k] })), ans:e.zh, alts:e.alts, rev:{ zh:e.zh, py:e.py, en:e.en }, right:e.zh }); });
      pickN(E.W2, 5).forEach(e => add('W2', { kind:'type', text:e.zh, hint:e.hint, opts:[], ans:e.ans, rev:{ zh:e.full, py:e.py, en:e.en }, right:e.ans }));
    }
    return out;
  };
  const examQs = (sec) => {
    if (LV === 2) return examQsL2(sec);
    if (LV === 3) return examQsL3(sec);
    if (LV === 4) return examQsL4(sec);
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

  // ---- sounds: tiny synthesised tones (no audio files). On by default; Settings has a switch. ----
  const SFX = (() => {
    let ctx = null;
    const ensure = () => {
      try {
        if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (e) { return null; }
    };
    const tone = (c, f, at, dur, type, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, at);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.03);
    };
    const SOUNDS = {
      ok:   (c, t) => { tone(c, 880, t, 0.14, 'sine', 0.11); tone(c, 1318.5, t + 0.085, 0.2, 'sine', 0.11); },
      bad:  (c, t) => { tone(c, 262, t, 0.16, 'triangle', 0.1); tone(c, 196, t + 0.1, 0.24, 'triangle', 0.1); },
      done: (c, t) => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.11, 0.3, 'sine', 0.1)); tone(c, 1046.5, t + 0.44, 0.5, 'triangle', 0.06); },
      ach:  (c, t) => { [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(c, f, t + i * 0.09, 0.45, 'sine', 0.09)); },
      fly:  (c, t) => { [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.08, 0.4, 'triangle', 0.08)); tone(c, 1318.5, t + 0.5, 0.6, 'sine', 0.07); }
    };
    const play = (name, force) => {
      try {
        if (!force && prefGet('sound', true) === false) return;
        if (window.SHANLU_MUTE_SFX) { window.__sfxLog = (window.__sfxLog || []).concat([name]); return; }   // (the browser tests listen instead of playing)
        const c = ensure(); if (!c || !SOUNDS[name]) return;
        SOUNDS[name](c, c.currentTime + 0.01);
      } catch (e) {}
    };
    // browsers only let a page make sound after the first tap or key press
    const unlock = () => { ensure(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { once:true, passive:true }));
    return { play };
  })();
  // ---- milestones and achievements: each one is earned once, when its test becomes true. `m` is what achMetrics() measured; `prog` (optional) gives [now, goal] for the bar on the Achievements page ----
  const AGROUPS = ['Streaks', 'Words', 'Path', 'Grammar', 'Sounds', 'Habits', 'Collecting', 'Journey', 'Levels', 'Friends'];
  const streakM = (n, icon, title, desc) => ({ id:'streak' + n, grp:'Streaks', icon, title, desc, hint:'Study ' + n + ' days in a row.', test:m => m.streak >= n, prog:m => [m.streak, n] });
  const wordsM = (n, icon, title, desc) => ({ id:'words' + n, grp:'Words', icon, title, desc, hint:'Get ' + n.toLocaleString('en-US') + ' words into memory.', test:m => m.words >= n, prog:m => [m.words, n] });
  const MILESTONES = [
    streakM(3, '🔥', '3-day streak', 'Three days in a row. The habit is starting.'),
    streakM(7, '🔥', 'A full week', '7 days in a row. That is real consistency.'),
    streakM(14, '🔥', 'Two weeks strong', '14 days in a row.'),
    streakM(30, '🔥', 'A month of Chinese', '30 days in a row. Most people never get here.'),
    streakM(100, '🔥', '100-day streak', 'One hundred days. Remarkable.'),
    wordsM(10, '🌱', 'First 10 words', 'Ten words are in your memory.'),
    wordsM(50, '🌿', '50 words', 'Fifty words you can recall.'),
    wordsM(100, '🌳', '100 words', 'A hundred words in memory.'),
    wordsM(250, '⛰️', '250 words', 'A quarter of a thousand.'),
    wordsM(500, '🏔️', '500 words', 'Half a thousand words. You can read real sentences now.'),
    wordsM(1000, '🚀', '1,000 words', 'One thousand words in memory.'),
    { id:'lesson1', grp:'Grammar', icon:'📘', title:'First grammar lesson', desc:'You passed your first grammar lesson.', hint:'Pass a grammar lesson (80% or more).', test:m => m.lessons >= 1 },
    { id:'lessons10', grp:'Grammar', icon:'📚', title:'10 grammar lessons', desc:'Ten lessons passed.', hint:'Pass 10 grammar lessons.', test:m => m.lessons >= 10, prog:m => [m.lessons, 10] },
    { id:'gmaster1', grp:'Grammar', icon:'✍️', title:'First grammar point mastered', desc:'You wrote it yourself and got it right, more than once.', hint:'Master a grammar point in Grammar review: write it correctly more than once.', test:m => m.gmastered >= 1 },
    { id:'gmaster10', grp:'Grammar', icon:'🧩', title:'10 points mastered', desc:'Ten grammar points are truly yours.', hint:'Master 10 grammar points.', test:m => m.gmastered >= 10, prog:m => [m.gmastered, 10] },
    { id:'gmaster50', grp:'Grammar', icon:'🏛️', title:'50 points mastered', desc:'Fifty grammar points. That is a solid foundation.', hint:'Master 50 grammar points.', test:m => m.gmastered >= 50, prog:m => [m.gmastered, 50] },
    { id:'gwrite1', grp:'Grammar', icon:'💬', title:'Your own sentence', desc:'You wrote a sentence from scratch and the checker passed it.', hint:'Write a sentence in Grammar review that gets a pass.', test:m => m.gwrote >= 1 },
    { id:'perfect', grp:'Habits', icon:'💯', title:'Flawless session', desc:'A full Review session with every card right first time.', hint:'Finish a Review session of 10 or more cards without missing or struggling on any.', test:m => !!m.ev.perfect },
    { id:'comeback', grp:'Habits', icon:'👋', title:'Welcome back', desc:'You came back after a week or more away. That is what counts.', hint:'Study again after 7 or more days away.', test:m => !!m.ev.comeback },
    { id:'early', grp:'Habits', icon:'🌅', title:'Early bird', desc:'Studying before 8 in the morning.', hint:'Study between 4 and 8 in the morning.', test:m => !!m.ev.early },
    { id:'night', grp:'Habits', icon:'🌙', title:'Night owl', desc:'Studying late at night.', hint:'Study between 10 at night and 4 in the morning.', test:m => !!m.ev.night },
    { id:'rev100', grp:'Habits', icon:'⚡', title:'100 reviews in a day', desc:'One hundred cards answered in a single day.', hint:'Answer 100 Review cards in one day.', test:m => !!m.ev.rev100 },
    { id:'goal7', grp:'Habits', icon:'🎯', title:'Goal getter', desc:'Hit your daily goal 7 days in a row.', hint:'Reach your daily goal 7 days in a row.', test:m => m.goalRun >= 7, prog:m => [m.goalRun, 7] },
    { id:'path1', grp:'Path', icon:'👣', title:'First step on the Path', desc:'You finished your first stop on the Path.', hint:'Finish a stop on the Path.', test:m => m.pathStops >= 1 },
    { id:'path10', grp:'Path', icon:'🥾', title:'10 steps', desc:'Ten stops walked.', hint:'Finish 10 stops on the Path.', test:m => m.pathStops >= 10, prog:m => [m.pathStops, 10] },
    { id:'path50', grp:'Path', icon:'🧗', title:'50 steps', desc:'Fifty stops. The trail is behind you now.', hint:'Finish 50 stops on the Path.', test:m => m.pathStops >= 50, prog:m => [m.pathStops, 50] },
    { id:'path150', grp:'Path', icon:'🏕️', title:'150 steps', desc:'A hundred and fifty stops walked.', hint:'Finish 150 stops on the Path.', test:m => m.pathStops >= 150, prog:m => [m.pathStops, 150] },
    { id:'pathunit1', grp:'Path', icon:'🚩', title:'First unit finished', desc:'Every stop in a unit, done.', hint:'Finish every stop in one unit of the Path.', test:m => m.pathUnits >= 1 },
    { id:'pathunit5', grp:'Path', icon:'🗻', title:'5 units finished', desc:'Five units of the Path complete.', hint:'Finish 5 units of the Path.', test:m => m.pathUnits >= 5, prog:m => [m.pathUnits, 5] },
    { id:'pathlevel', grp:'Path', icon:'🏔️', title:'Whole level walked', desc:'You walked every stop of a level. The summit is next.', hint:'Finish every stop of one level on the Path.', test:m => m.pathLevels >= 1 },
    { id:'fullday', grp:'Path', icon:'📅', title:'A full day\'s plan', desc:'A Path step, your Review and your Grammar review, all in one day.', hint:'In one day: finish a Path step, a Review session and a Grammar review.', test:m => !!m.fullDay },
    { id:'py1', grp:'Sounds', icon:'🔤', title:'First Pinyin lesson', desc:'You finished your first Pinyin and tones lesson.', hint:'Finish a lesson in Pinyin and tones.', test:m => m.pyDone >= 1 },
    { id:'pyall', grp:'Sounds', icon:'🎼', title:'Pinyin and tones: done', desc:'Every lesson of the sound course finished.', hint:'Finish every Pinyin and tones lesson.', test:m => m.pyTotal > 0 && m.pyDone >= m.pyTotal, prog:m => [m.pyDone, m.pyTotal] },
    { id:'scene1', grp:'Sounds', icon:'🎙️', title:'First conversation', desc:'You said a whole scene out loud.', hint:'Finish a Speak scene.', test:m => m.scenes >= 1 },
    { id:'scene5', grp:'Sounds', icon:'🗣️', title:'5 conversations', desc:'Five scenes spoken.', hint:'Finish 5 Speak scenes.', test:m => m.scenes >= 5, prog:m => [m.scenes, 5] },
    { id:'sceneall', grp:'Sounds', icon:'🎭', title:'Every scene', desc:'All the Speak scenes of a level, done.', hint:'Finish every Speak scene of a level.', test:m => m.scenesAll },
    { id:'mean1', grp:'Sounds', icon:'💡', title:'First translation', desc:'You heard a clip and said what it means in English.', hint:'Get a clip right in the Meaning mode of the Listening lab.', test:m => m.meanings >= 1 },
    { id:'mean10', grp:'Sounds', icon:'🌟', title:'10 translations', desc:'Ten clips understood without reading a thing.', hint:'Get 10 clips right in the Meaning mode.', test:m => m.meanings >= 10, prog:m => [m.meanings, 10] },
    { id:'clip1', grp:'Sounds', icon:'🎧', title:'First clip', desc:'You tried your first Listening lab clip.', hint:'Try a clip in the Listening lab.', test:m => m.clips >= 1 },
    { id:'clip10', grp:'Sounds', icon:'👂', title:'10 clips', desc:'Ten clips from the Listening lab.', hint:'Try 10 Listening lab clips.', test:m => m.clips >= 10, prog:m => [m.clips, 10] },
    { id:'hub1', grp:'Collecting', icon:'🌐', title:'Word family complete', desc:'Every word that shares one character, started.', hint:'Start every word in one Shared character family.', test:m => m.hubs >= 1 },
    { id:'hub10', grp:'Collecting', icon:'🪢', title:'10 word families', desc:'Ten shared characters, all their words started.', hint:'Finish 10 Shared character families.', test:m => m.hubs >= 10, prog:m => [m.hubs, 10] },
    { id:'sv1', grp:'Collecting', icon:'🎁', title:'First souvenir', desc:'You found a souvenir hidden in one of the stops.', hint:'Unlock a Journey stop that hides a souvenir.', test:m => m.jy.sv >= 1 },
    { id:'sv10', grp:'Collecting', icon:'🧧', title:'10 souvenirs', desc:'Ten keepsakes on the shelf.', hint:'Find 10 souvenirs.', test:m => m.jy.sv >= 10, prog:m => [m.jy.sv, 10] },
    { id:'sv25', grp:'Collecting', icon:'🏮', title:'25 souvenirs', desc:'Twenty-five keepsakes. The shelf is filling up.', hint:'Find 25 souvenirs.', test:m => m.jy.sv >= 25, prog:m => [m.jy.sv, 25] },
    { id:'sv50', grp:'Collecting', icon:'🪭', title:'50 souvenirs', desc:'Fifty keepsakes from all over China.', hint:'Find 50 souvenirs.', test:m => m.jy.sv >= 50, prog:m => [m.jy.sv, 50] },
    { id:'svregion', grp:'Collecting', icon:'🧺', title:'A region\'s shelf complete', desc:'Every souvenir hidden in one region, found.', hint:'Find every souvenir of one region.', test:m => m.jy.svRegions >= 1 },
    { id:'svall', grp:'Collecting', icon:'🏺', title:'Every souvenir', desc:'The whole shelf. Nothing is left hidden.', hint:'Find every souvenir.', test:m => m.jy.svTotal > 0 && m.jy.sv >= m.jy.svTotal, prog:m => [m.jy.sv, m.jy.svTotal] },
    { id:'topic1', grp:'Collecting', icon:'🕸️', title:'Topic complete', desc:'Every word in one topic web has been started.', hint:'Start every word of one topic. The Path and the Archive both get you there.', test:m => !!m.topic },
    { id:'jy1', grp:'Journey', icon:'✈️', title:'Boarding pass', desc:'Your first flight in. The Journey has begun.', hint:'Spend coins on your first stop.', test:m => m.jy.n >= 1 },
    { id:'jy10', grp:'Journey', icon:'🧭', title:'10 stops', desc:'Ten places, dishes and traditions discovered.', hint:'Unlock 10 stops.', test:m => m.jy.n >= 10, prog:m => [m.jy.n, 10] },
    { id:'jy50', grp:'Journey', icon:'🗺️', title:'50 stops', desc:'Fifty stops. The map is filling in.', hint:'Unlock 50 stops.', test:m => m.jy.n >= 50, prog:m => [m.jy.n, 50] },
    { id:'jy200', grp:'Journey', icon:'🚆', title:'200 stops', desc:'Two hundred stops along the way.', hint:'Unlock 200 stops.', test:m => m.jy.n >= 200, prog:m => [m.jy.n, 200] },
    { id:'jy500', grp:'Journey', icon:'🌏', title:'500 stops', desc:'Five hundred stops. You have seen a lot of the Chinese-speaking world.', hint:'Unlock 500 stops.', test:m => m.jy.n >= 500, prog:m => [m.jy.n, 500] },
    { id:'jy1000', grp:'Journey', icon:'🧳', title:'1,000 stops', desc:'A thousand stops. Seasoned traveller.', hint:'Unlock 1,000 stops.', test:m => m.jy.n >= 1000, prog:m => [m.jy.n, 1000] },
    { id:'jystamp1', grp:'Journey', icon:'🛂', title:'First stamp', desc:'You finished a region and your passport is stamped.', hint:'Unlock every stop in one region.', test:m => m.jy.stamps >= 1 },
    { id:'jystamp5', grp:'Journey', icon:'📕', title:'5 stamps', desc:'Five regions stamped.', hint:'Finish 5 regions.', test:m => m.jy.stamps >= 5, prog:m => [m.jy.stamps, 5] },
    { id:'jystamp10', grp:'Journey', icon:'📗', title:'10 stamps', desc:'Ten regions stamped.', hint:'Finish 10 regions.', test:m => m.jy.stamps >= 10, prog:m => [m.jy.stamps, 10] },
    { id:'jystamp20', grp:'Journey', icon:'📘', title:'20 stamps', desc:'Twenty regions stamped.', hint:'Finish 20 regions.', test:m => m.jy.stamps >= 20, prog:m => [m.jy.stamps, 20] },
    { id:'jystampall', grp:'Journey', icon:'🏅', title:'Every stamp', desc:'Every region in your passport. You have been everywhere.', hint:'Finish every region.', test:m => m.jy.total > 0 && m.jy.stamps >= m.jy.total, prog:m => [m.jy.stamps, m.jy.total] },
    { id:'jycity1', grp:'Journey', icon:'🏙️', title:'City explored', desc:'You saw every stop in a city.', hint:'Unlock every stop in one city.', test:m => m.jy.cities >= 1 },
    { id:'jycity25', grp:'Journey', icon:'🌆', title:'25 cities explored', desc:'Twenty-five cities, every stop seen.', hint:'Finish 25 cities.', test:m => m.jy.cities >= 25, prog:m => [m.jy.cities, 25] },
    { id:'jydish10', grp:'Journey', icon:'🥟', title:'10 dishes', desc:'Ten local dishes tried, in spirit.', hint:'Unlock 10 dishes.', test:m => m.jy.dish >= 10, prog:m => [m.jy.dish, 10] },
    { id:'jydish100', grp:'Journey', icon:'🍜', title:'100 dishes', desc:'A hundred dishes. You know what to order.', hint:'Unlock 100 dishes.', test:m => m.jy.dish >= 100, prog:m => [m.jy.dish, 100] },
    { id:'jyattr25', grp:'Journey', icon:'⛰️', title:'25 sights', desc:'Twenty-five attractions seen.', hint:'Unlock 25 attractions.', test:m => m.jy.attr >= 25, prog:m => [m.jy.attr, 25] },
    { id:'jycult25', grp:'Journey', icon:'🎎', title:'25 traditions', desc:'Twenty-five pieces of culture learned.', hint:'Unlock 25 culture stops.', test:m => m.jy.cult >= 25, prog:m => [m.jy.cult, 25] },
    { id:'exam1', grp:'Levels', icon:'🎓', title:'Level exam passed', desc:'You passed a level exam.', hint:'Pass both sections of a level exam.', test:m => m.exams >= 1 },
    { id:'friend1', grp:'Friends', icon:'🤝', title:'Study buddies', desc:'You are in a group with a friend.', hint:'Join a friends group with at least one other person.', test:m => m.frMembers >= 2 },
    { id:'leader', grp:'Friends', icon:'🏆', title:'Top of the board', desc:'Most study minutes this week in your group.', hint:'Study more minutes this week than every friend in your group.', test:m => !!m.frLeader }
  ];
  // one set per level: every lesson passed, every word started, and the first step into each level above HSK 1
  for (let n = 1; n <= LVL.MAX_LEVEL; n++) {
    ((k) => {
      MILESTONES.push({ id:'gram' + k, grp:'Grammar', icon:'📗', title:'All HSK ' + k + ' lessons', desc:'Every HSK ' + k + ' grammar lesson passed.', hint:'Pass every HSK ' + k + ' grammar lesson.', test:m => !!m.lv[k] && m.lv[k].lessonsTotal > 0 && m.lv[k].lessonsDone >= m.lv[k].lessonsTotal, prog:m => m.lv[k] ? [m.lv[k].lessonsDone, m.lv[k].lessonsTotal] : null });
      MILESTONES.push({ id:'all' + k, grp:'Collecting', icon:'🗂️', title:'Every HSK ' + k + ' word', desc:'All HSK ' + k + ' words have been started.', hint:'Start every HSK ' + k + ' word.', test:m => !!m.lv[k] && m.lv[k].total > 0 && m.lv[k].started >= m.lv[k].total, prog:m => m.lv[k] ? [m.lv[k].started, m.lv[k].total] : null });
      if (k > 1) MILESTONES.push({ id:'lvstart' + k, grp:'Levels', icon:'🪜', title:'On to HSK ' + k, desc:'Your first HSK ' + k + ' word.', hint:'Start your first HSK ' + k + ' word.', test:m => !!m.lv[k] && m.lv[k].started >= 1 });
    })(n);
  }
  // A small bar at the top (outside the page that is redrawn) that names an error, so a stuck page can be explained instead of just sitting there
  function showErr(e, kind) {
    try {
      const msg = String(e && e.message || e).slice(0, 200); const where = String((e && e.stack || '').split('\n')[1] || '').replace(/^\s*at\s+/, '').slice(-90);
      try { localStorage.setItem('shanlu-lasterr', JSON.stringify({ at:new Date().toISOString(), kind, msg, where, screen:window.shanlu && window.shanlu.state.screen, item:window.shanlu && window.shanlu.state.rq && window.shanlu.state.rq[0] })); } catch (x) {}
      let b = document.getElementById('render-err');
      if (!b) { b = document.createElement('div'); b.id = 'render-err'; b.className = 'banner bad'; b.setAttribute('role', 'alert'); document.body.insertBefore(b, document.body.firstChild); }
      b.dataset.kind = kind;
      b.textContent = (kind === 'draw' ? 'The page hit a snag and skipped a card. ' : 'Something went wrong. ') + 'If it keeps happening, send this: ' + msg + (where ? ' (' + where + ')' : '') + ' ';
      const r = document.createElement('button'); r.textContent = 'Reload'; r.onclick = () => location.reload(); b.appendChild(r);
      clearTimeout(showErr.t); showErr.t = setTimeout(() => { const o = document.getElementById('render-err'); if (o) o.remove(); }, 30000);
    } catch (x) {}
  }
  class Component extends DCLogic {
    state = loadState();
    timers = [];
    saveTimer = null;

    // If drawing the page ever throws, nothing on screen updates again and every button seems dead. So: catch it, say what happened
    // (the message is also kept in localStorage 'shanlu-lasterr'), drop the Review card that was being drawn, and carry on.
    rFails = 0;
    _render() {
      try { super._render(); this.rFails = 0; this.focusTyped(); this.sfxWatch(); }
      catch (e) {
        showErr(e, 'draw');
        const S = this.state; this.rFails++;
        if (this.rFails > 3) return;
        this.quizQs = []; this.rvKey = null; this.rLast = null;
        if (S.screen === 'review' && S.rq && S.rq.length) this.setState({ rq:S.rq.slice(1), rcomplete:S.rq.length <= 1, rflip:false, rpy:false, qchecked:false, qchoice:null, qtyped:'', qfeed:'' });
        else this.setState({ screen:'home' });
      }
    }

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
        { const h = new Date().getHours(); const ev = this.achEv || (this.achEv = {}); if (h >= 4 && h < 8) ev.early = 1; else if (h >= 22 || h < 4) ev.night = 1; }
        if (!S.activity[t]) {
          try { let last = ''; readAllStores().forEach(st => Object.keys(st.activity || {}).concat(st.lastActive ? [st.lastActive] : []).forEach(d => { if (d < t && d > last) last = d; })); if (last && (Date.parse(t) - Date.parse(last)) / 864e5 >= 7) (this.achEv || (this.achEv = {})).comeback = 1; } catch (e) {}
          const act = Object.assign({}, S.activity); act[t] = true;
          const keys = Object.keys(act).sort();
          while (keys.length > 60) delete act[keys.shift()];
          patch = Object.assign({}, patch, { activity:act, streak:S.lastActive === daysAgo(1) ? S.streak + 1 : 1, lastActive:t });
        }
      }
      // enough XP for another Journey stop: the XP pill glows (see jyView) and a small note says so for a few seconds
      if (patch.xp !== undefined && patch.xp > S.xp && JY && JWORLD) {
        try {
          const st = jyRead();
          if (st && st.reg) {
            const before = totalXp(S), after = before + (patch.xp - S.xp);
            if (JY.meter(after, st).ready > JY.meter(before, st).ready) {
              patch = Object.assign({}, patch, { jyPing:Date.now() });
              clearTimeout(this.pingTimer); this.pingTimer = setTimeout(() => { this.setState({ jyPing:0 }); }, 9000);
            }
          }
        } catch (e) {}
      }
      if (!this.fromPerson) SETTING_KEYS.forEach(k => { if (patch[k] !== undefined && patch[k] !== S[k]) prefSet('set.' + k, patch[k]); });   // a setting the person changed travels to their other devices
      super.setState(patch);
      this.persistSoon();
    }
    persistSoon() {
      if (!this.persistAsked && this.state.xp > 0) this.ensurePersist(true);
      this.syncLater();
      this.friendsTick();
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persistNow(), 250);
    }
    // the Review queue after a sync or an import: drop words that no longer exist, keep the word#l / #p / #h cards (a sync that dropped them emptied the queue mid-session and Continue did nothing)
    cleanQueue = (rq, ws, lrn) => (rq || []).filter(z => BANK[itemOf(z).zh] && !staleNew(z, ws, lrn));
    frozen = false;   // set while the page is being reloaded after a reset, so the leaving page does not write the old progress back
    persistNow() {
      if (this.frozen) return;
      const f0 = lsFails;
      try {
        const out = {};
        PERSIST.forEach(k => { if (!ALL || SPLIT.indexOf(k) < 0) out[k] = this.state[k]; });
        if (out.ws && window.ShanluSync) out.ws = window.ShanluSync.compactWs(out.ws);   // only started words are stored; mergeSaved() fills the rest in
        lsSet(KEY, JSON.stringify(out));
        if (ALL) this.persistSplit();
        else if (LVL.passedList(this.state.exams || [])) LVL.markPassed(LV);   // passing both sections (together or one at a time) opens the next level
      } catch (e) {}
      // a save that failed is tried again every 10 seconds until it works (the next action also saves, as usual); nothing is retried once it has worked
      clearTimeout(this.saveRetry); this.saveRetry = null;
      if (lsFails > f0) this.saveRetry = setTimeout(() => { this.saveRetry = null; this.persistNow(); }, SAVE_RETRY_MS);
      this.checkMilestones();
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
      if (this.frozen || !FR || !FR.enabled() || !FR.identity()) return;
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
    progBusy = false;
    friendsProgressSync = async () => {
      if (this.progBusy) return false;
      this.progBusy = true;
      try {
        const r = await this.friendsProgressSyncRun();
        this.syncInfo = { ok:true, at:Date.now() };
        if (this.state.syncBadMsg) this.setState({ syncBadMsg:'' });
        return r;
      } catch (e) {
        const why = ((e && e.message) || 'Could not reach the server.') + (e && e.status ? ' (error ' + e.status + (e.code ? ', ' + e.code : '') + ')' : '');
        this.syncInfo = { ok:false, at:Date.now(), msg:why };
        try { if (this.state.syncBadMsg !== why) this.setState({ syncBadMsg:why }); } catch (e2) {}
        throw e;
      } finally { this.progBusy = false; }
    };
    syncInfo = null;
    // "Sync now": merge with the server right away and say what happened (the numbers are this device's, after the merge)
    friendsSyncNow = async () => {
      if (!FR || !FR.enabled() || !FR.identity() || this.state.frSyncing) return;
      this.setState({ frSyncing:true, frErr:'', frMsg:'' });
      await this.friendsPush({});
      otherXp(true);
      const info = this.syncInfo, st = jyRead();
      this.setState({ frSyncing:false });
      if (info && info.ok) this.setState({ frMsg:'Synced. This device now has ' + totalXp(this.state).toLocaleString('en-US') + ' coins earned in total and ' + (st ? st.n : 0) + ' Journey stops.' });
      else if (info && !this.state.frErr) this.setState({ frErr:'Could not sync: ' + info.msg });
    };
    friendsProgressSyncRun = async () => {
      let changed = false;
      for (let attempt = 0; attempt < 3; attempt++) {   // a save the server refuses because another device saved in between is simply merged again
        const r = await this.friendsProgressSyncOnce();
        changed = changed || r.changed;
        if (!r.conflict) break;
      }
      return changed;
    };
    friendsProgressSyncOnce = async () => {
      const SY = window.ShanluSync;
      if (!FR || !FR.enabled() || !FR.identity() || !SY) return { changed:false, conflict:false };
      this.persistNow();
      const levels = Object.keys(LVL.PROGRESS_KEYS || {}).map(Number);
      const local = {};
      levels.forEach(n => { const st = readStore(n); if (st) local[n] = SY.pick(st); });
      const got = await FR.getProgress();
      const remote = (got && got.progress && got.progress.levels) || {};
      const merged = {}; let pushNeeded = !(got && got.progress), changed = false;
      // Coins earned while the "All levels" view is open are kept in that view's own saved copy, which is not one of the levels above:
      // they travel as one number (the larger one wins), so every device ends up with the same coin total.
      const allKey = 'shanlu-progress-v1-all';
      const readAllSt = () => { try { return JSON.parse(localStorage.getItem(allKey)); } catch (e) { return null; } };
      const localAllXp = ALL ? (this.state.xp || 0) : ((readAllSt() || {}).xp || 0);
      const remoteAllXp = Number(got && got.progress && got.progress.allXp) || 0;
      const mergedAllXp = Math.max(localAllXp, remoteAllXp);
      if (mergedAllXp > localAllXp) {
        if (ALL) { this.noSync = true; this.setState({ xp:mergedAllXp }); this.noSync = false; this.persistNow(); }
        else { const st = readAllSt() || {}; st.xp = mergedAllXp; lsSet(allKey, JSON.stringify(st)); }
        changed = true; otherXp(true);
      }
      if (mergedAllXp > remoteAllXp) pushNeeded = true;
      Object.keys(Object.assign({}, local, remote)).forEach(k => {
        const n = Number(k);
        if (levels.indexOf(n) < 0) { merged[k] = remote[k]; return; }   // a level this version does not know: pass it through untouched
        const m = SY.merge(local[k], remote[k]);
        merged[k] = m;
        if (!SY.same(m, SY.merge(remote[k], remote[k]))) pushNeeded = true;
        if (!SY.same(m, SY.merge(local[k], local[k]))) changed = true;
      });
      if (changed) {
        levels.forEach(n => { if (merged[n]) { const st = readStore(n) || {}; lsSet(storeKey(n), JSON.stringify(SY.applyMerged(st, merged[n]))); if (LVL.passedList(merged[n].exams || [])) LVL.markPassed(n); } });
        // bring this view up to date
        let patch;
        if (ALL) { const tmp = Object.assign({}, this.state, readSplit()); fillWs(tmp.ws); carryOverErhua(tmp); patch = {}; SPLIT.forEach(k => { patch[k] = tmp[k]; }); }
        else if (merged[LV]) {
          const bumped = (merged[LV].epoch || 0) > (this.state.epoch || 0);   // another device reset this level: today's "words so far" baseline starts again too
          if (merged[LV].ws) fillWs(merged[LV].ws);   // the saved copy holds only started words; the day roll below counts every word
          const next = rollDay(Object.assign({}, this.state, merged[LV], bumped ? { mem0:null } : {}));
          carryOverErhua(next);
          patch = SY.pick(next); patch.rq = this.cleanQueue(patch.rq, patch.ws, patch.lrn); patch.ws = fillWs(patch.ws);
          if (bumped) patch.mem0 = next.mem0;
        }
        if (patch) { this.noSync = true; this.noMin = true; this.setState(patch); this.noMin = false; this.noSync = false; this.persistNow(); }
      }
      // the person's own settings and notes (listening level, what Mingming remembers, chat preferences) travel in the same bundle
      const remoteP = (got && got.progress && got.progress.person) || {};
      const mergedP = SY.mergePerson ? SY.mergePerson(PERSON, remoteP) : PERSON;
      if (SY.samePerson && !SY.samePerson(mergedP, PERSON)) { PERSON = mergedP; savePerson(false); this.personApply(); changed = true; }
      if (SY.samePerson && !SY.samePerson(mergedP, remoteP)) pushNeeded = true;
      if (pushNeeded) {
        try { await FR.putProgress({ v:1, levels:merged, person:mergedP, allXp:mergedAllXp }, { base:got ? got.updated : undefined }); }
        catch (e) { if (e && e.status === 412) return { changed, conflict:true }; throw e; }
      }
      return { changed, conflict:false };
    };
    friendsFailed = (e) => {
      if (e && e.status === 401) { FR.forget(); this.setState({ fr:null, frErr:'This device is not in the group any more. Join again from Friends.' }); return; }
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
    // the shared AI (see relayRefresh): ask the friends server whether this person can use it, then let the AI screens know
    relayCheck = async () => {
      let changed = false; try { changed = await relayRefresh(); } catch (e) {}
      this.setState({ relayAt:Date.now(), aiOn:aiReadyNow(), aiProvider:aiProviderNow(), asrMode:asrModeNow(), ttsMode:ttsModeNow() });
      return changed;
    };
    friendsJoin = async () => {
      const S = this.state;
      if (S.frBusy || !FR) return;
      this.setState({ frBusy:true, frErr:'' });
      try {
        await FR.join(S.frName);
        this.setState({ frBusy:false, frName:'', frMsg:'' });
        this.relayCheck();
        await this.friendsPush({});
        await this.friendsRefresh(true);
      } catch (e) { this.setState({ frBusy:false, frErr:(e && e.message) || 'Could not join.' }); }
    };
    // The Home Screen icon on iPhone has its own storage and links open in the browser, so a personal link has to be pasted in. Accepts the whole link, "#me=…" or just "id.key".
    friendsSignInLink = async () => {
      const S = this.state;
      if (S.frLinkBusy || !FR) return;
      const m = /([0-9a-f]{16})\.([0-9a-f]{48})/.exec(String(S.frLinkIn || '').trim().toLowerCase());
      if (!m) { this.setState({ frErr:'That is not a personal link. Copy it from Friends on the device that is already in the group ("Copy my link").', frMsg:'' }); return; }
      this.setState({ frLinkBusy:true, frErr:'', frMsg:'' });
      try {
        const g = await FR.restore({ id:m[1], key:m[2] });
        this.setState({ frLinkBusy:false, frLinkIn:'', fr:g, frAt:Date.now(), frMsg:'Signed in on this device.', frErr:'' });
        this.relayCheck();
        await this.friendsPush({});
        await this.friendsRefresh(true);
      } catch (e) { this.setState({ frLinkBusy:false, frErr:(e && e.message) || 'That link does not work.' }); }
    };
    // "Test connection" for the friends server: reachable from this browser, and does it still accept this device's key?
    friendsTest = async () => {
      if (!FR || this.state.frTesting) return;
      this.setState({ frTesting:true, frErr:'', frMsg:'Testing…' });
      try {
        const r = await FR.ping();
        let msg = 'The friends server answers (' + r.ms + ' ms).';
        if (r.signedIn === true) msg += ' This device is signed in' + (r.group ? ' to ' + r.group : '') + '.';
        else if (r.signedIn === false) { this.setState({ frTesting:false, frMsg:'', frErr:'The server answers, but it no longer accepts this device. Open your personal link again, or join again from Friends.' }); return; }
        this.setState({ frTesting:false, frMsg:msg });
      } catch (e) { this.setState({ frTesting:false, frMsg:'', frErr:(e && e.message) || 'Could not reach the friends server.' }); }
    };
    friendsCheer = async (id) => {
      try { await FR.cheer(id); await this.friendsRefresh(true); } catch (e) { this.friendsFailed(e); }
    };
    friendsLeave = async () => {
      if (!this.state.frLeaveAsk) { this.setState({ frLeaveAsk:true }); return; }
      try { await FR.leave(); this.setState({ fr:null, frLeaveAsk:false, frErr:'', frMsg:'You left the group.', aiOn:aiReadyNow(), aiProvider:aiProviderNow(), asrMode:asrModeNow(), ttsMode:ttsModeNow() }); } catch (e) { this.setState({ frLeaveAsk:false }); this.friendsFailed(e); }
    };
    friendsCopyLink = async () => {
      const id = FR && FR.identity();
      if (!id) return;
      const link = window.ShanluFriends.makeLink(location.href, id);
      try { await navigator.clipboard.writeText(link); this.setState({ frCopied:true }); setTimeout(() => this.setState({ frCopied:false }), 2500); } catch (e) { try { window.prompt('Copy your link', link); } catch (e2) {} }
    };
    // a personal link (#me=...) signs this device in (invite links no longer exist: joining is open)
    friendsBoot = async () => {
      if (!FR || !FR.enabled()) return;
      const hit = window.ShanluFriends.parseHash(location.hash);
      if (hit.me) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      if (hit.me) {
        const cur = FR.identity();
        if (cur && cur.id !== hit.me.id && !window.confirm('This device is already in the group as ' + (cur.name || 'someone') + '. Replace that with the link you opened?')) { this.setState({ screen:'friends' }); return; }
        try { const g = await FR.restore(hit.me); this.setState({ screen:'friends', fr:g, frAt:Date.now(), frMsg:'Signed in on this device.', frErr:'' }); this.relayCheck(); await this.friendsPush({}); }
        catch (e) { this.setState({ screen:'friends', frErr:(e && e.message) || 'That link does not work.' }); }
      }
      if (FR.identity()) { this.relayCheck(); await this.friendsRefresh(false); this.friendsProgressSync().catch(() => {}); setTimeout(() => this.friendsPush({ minGap:5 * 60 * 1000 }), 1500); }
    };

    // All levels: hand each level its own part of the progress, leaving the rest of that level's save alone
    persistSplit() {
      const S = this.state;
      let off = 0;
      LVLS.forEach(n => {
        const st = readStore(n) || {};
        const words = (window['HSK' + n + '_WORDS'] || []).map(w => w.zh);
        const ws = Object.assign({}, st.ws); words.forEach(z => { const cw = window.ShanluSync ? window.ShanluSync.compactWord(S.ws[z]) : S.ws[z]; if (cw) ws[z] = cw; else delete ws[z]; });
        const mis = Object.assign({}, st.misses); words.forEach(z => { if (S.misses[z] !== undefined) mis[z] = S.misses[z]; else delete mis[z]; });
        const pick = (src, ids) => { const o = {}; ids.forEach(id => { if (src[id] !== undefined) o[id] = src[id]; }); return o; };
        const lessons = ((window['HSK' + n + '_GRAMMAR'] || {}).lessons || []).map(l => l.id);
        const scns = ((window['HSK' + n + '_SPEAK'] || {}).scenarios || []).map(x => x.id);
        const gres = Object.assign({}, st.gres); lessons.forEach(id => { delete gres[id]; }); Object.assign(gres, pick(S.gres, lessons));
        const pts = ((window['HSK' + n + '_GRAMMAR'] || {}).points || []).map(x => x.id);
        const gpt = Object.assign({}, st.gpt); pts.forEach(id => { delete gpt[id]; }); Object.assign(gpt, pick(S.gpt || {}, pts));
        const sres = Object.assign({}, st.sres); scns.forEach(id => { delete sres[id]; }); Object.assign(sres, pick(S.sres, scns));
        const cnt = clipCount(n);
        const wset = {}; words.forEach(z => { wset[z] = true; });
        const lrn = {}; Object.keys(S.lrn || {}).forEach(z => { if (wset[z]) lrn[z] = S.lrn[z]; });
        st.lrn = lrn; st.rlog = (S.rlog || []).filter(e => wset[e[1]]);
        st.ws = ws; st.misses = mis; st.gres = gres; st.gpt = gpt; st.sres = sres; st.clipBest = S.clipBest.slice(off, off + cnt);
        off += cnt;
        lsSet(storeKey(n), JSON.stringify(st));
      });
    }
    later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); }

    lastSub = {};
    goGroup = (id) => {   // a phone tab: back to the screen last used in that section
      const first = { home:'home', learn:PATH_LVLS.length ? 'path' : 'library', review:'review', talk:'listen', journey:'journey' }[id];
      this.go(this.lastSub[id] || first);
    };
    go = (screen) => {
      { const grp = { path:'learn', library:'learn', grammar:'learn', pinyin:'learn', web:'learn', words:'learn', exam:'learn', review:'review', greview:'review', testlobby:'review', listen:'talk', speak:'talk', journey:'journey' }[screen]; if (grp) this.lastSub[grp] = ({ words:'library', grammar:'library', web:'library', pinyin:'library', exam:'path' })[screen] || screen; }
      { const sv = prefGet('sv', {}); if ((sv[screen] || 0) < 4) prefSet('sv', Object.assign({}, sv, { [screen]:(sv[screen] || 0) + 1 })); }   // how many times each page was opened: a page's one-line description fades after a few visits
      if (screen === 'guide' && !onbRead().g) this.onbSet({ g:Date.now() });
      if (screen === 'journey') { otherXp(true); this.jyEnsure(); this.friendsRefresh(false); }
      if ((screen === 'voice' || screen === 'speak') && FR && FR.identity()) this.relayCheck();
      this.setState(screen === 'path' ? { screen, pstop:'', plNote:'', plAlt:'' } : { screen }); try { window.scrollTo(0, 0); } catch (e) {}
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
    // tag 'm' is the man's voice (exam lines spoken by 男). A manifest value with a dot is the file name itself (made by tools/make-audio.py), otherwise it is the extension of audio/<text>.<ext>.
    nativeFile = (text, tag) => {
      const m = window.SHANLU_AUDIO, k = (tag === 'm' ? 'm|' : '') + text;
      if (!m || !text || !Object.prototype.hasOwnProperty.call(m, k)) return null;
      return 'audio/' + (String(m[k]).indexOf('.') >= 0 ? m[k] : encodeURIComponent(text) + '.' + m[k]);
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
    sayAi = async (text, key, rate, after) => {
      if (this.nativeFile(text) || ttsModeNow() !== 'qwen') { this.say(text, key, rate, undefined, after); return; }   // a recording needs no key and costs nothing
      this.stopNative(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      const tok = ++this.ttsTok;
      this.setState({ playing:key, ttsBusy:true });
      // The start of a line can be clipped when the speaker or headset has gone to sleep (worst after the microphone was open): so wake the output
      // right now, while the line is still being fetched, and do not start before it is awake and the clip is ready to play.
      const t0 = Date.now(), cold = this.wakeAudio() > 0;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      try {
        const voice = ttsVoiceNow(), ck = voice + '|' + text; let c = this.ttsCache[ck] || ttsKept(ck);
        if (!c || c.exp < Date.now()) { c = this.ttsCache[ck] = { url:await aliTTS(text, voice), exp:Date.now() + 20 * 3600000 }; ttsKeep(ck, c); }
        else this.ttsCache[ck] = c;
        if (tok !== this.ttsTok) return;
        if (!this.ttsEl) this.ttsEl = new Audio();
        const a = this.ttsEl;
        a.onended = () => { if (tok !== this.ttsTok) return; if (this.state.playing === key) this.setState({ playing:null }); if (after) after(); };
        a.onerror = () => { if (tok === this.ttsTok) { this.ttsFail(new Error('the audio could not be played')); this.say(text, key, rate, undefined, after); } };
        a.preload = 'auto'; a.src = c.url; a.playbackRate = rate || this.state.speed || 1; try { a.preservesPitch = true; } catch (e) {}
        await new Promise((res) => { let done = false; const go = () => { if (!done) { done = true; res(); } }; a.addEventListener('canplaythrough', go, { once:true }); a.addEventListener('canplay', go, { once:true }); setTimeout(go, 4000); try { a.load(); } catch (e) {} });
        if (tok !== this.ttsTok) return;
        const lead = (cold ? 600 : 150) - (Date.now() - t0);   // time the speaker has had to wake up since this request began
        if (lead > 0) await sleep(lead);
        if (tok !== this.ttsTok) return;
        try { a.currentTime = 0; } catch (e) {}
        await a.play();
        this.ttsOpen = true;
        if (tok === this.ttsTok) this.setState({ ttsBusy:false });
      } catch (e) {
        if (tok !== this.ttsTok) return;
        this.ttsFail(e); this.say(text, key, rate, undefined, after);
      }
    };
    ttsFail = (e) => {
      this.setState({ ttsBusy:false });
      if (this.ttsWarned) return; this.ttsWarned = true;
      this.setState({ aiErr:'The Qwen voice did not work (' + ((e && e.message) || 'unknown problem').replace(/\.$/, '') + '), so this browser\'s voice is used for now. Settings has a Test connection button.' });
    };
    say = (text, key, rate, voice, after) => {
      const file = voice ? null : this.nativeFile(text);      // a chosen voice (the voice sample in Settings) is always the browser voice
      if (!file) { this.sayTTS(text, key, rate, voice, after); return; }
      this.stopNative();
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      let a = null;
      const fallback = () => { if (a && this.nativeAudio === a) { this.nativeAudio = null; this.sayTTS(text, key, rate, voice, after); } };
      try {
        a = new Audio(file);
        a.playbackRate = rate || this.state.speed || 1;
        try { a.preservesPitch = true; } catch (e) {}
        this.nativeAudio = a;
        a.addEventListener('error', fallback);
        if (after) a.addEventListener('ended', () => { if (this.nativeAudio === a) after(); });
        const pr = a.play(); if (pr && pr.catch) pr.catch(fallback);
      } catch (e) { fallback(); return; }
      this.setState({ playing:key });
      this.later(() => { if (this.state.playing === key) this.setState({ playing:null }); }, 1400);
    };
    sayTTS = (text, key, rate, voice, after) => {
      this.stopNative();
      try {
        if (window.speechSynthesis) {
          const zh = voice || pickVoice(this.state.voiceId);
          if (allVoices().length && !zh) this.setState({ noVoice:true });
          this.speakWhenReady((ss) => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = zh ? zh.lang : 'zh-CN'; u.rate = rate || this.state.speed || 1;
            if (zh) u.voice = zh;
            if (after) { const tk = this.sayTok; u.onend = () => { if (tk === this.sayTok) after(); }; }
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
    startExam = (mode) => { if (!EXAMBANK) return; this.exBegin({ mode, sec:mode === 'reading' ? 'reading' : mode === 'writing' ? 'writing' : 'listening', results:{} }); };
    exBegin = (base) => {
      const exm = Object.assign({}, base, { stage:'run', qs:examQs(base.sec), ans:{}, picks:{}, typed:{}, i:0, plays:{}, confirm:false, endAt:Date.now() + EXAM_MIN[base.sec] * 60000 });
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
    exPick = (v) => {
      const m = this.state.exm; if (!m || m.stage !== 'run') return;
      const q = m.qs[m.i];
      if (q.kind === 'order') {   // writing part 1: tap the words in turn; tap one again to take it back
        const picks = (m.picks && m.picks[q.id]) || [];
        this.exSetPicks(q, picks.indexOf(v) >= 0 ? picks.filter(x => x !== v) : picks.concat([v]));
        return;
      }
      const ans = Object.assign({}, m.ans); ans[q.id] = v; this.exPatch({ ans, confirm:false });
    };
    exSetPicks = (q, picks) => {
      const m = this.state.exm; if (!m) return;
      const ans = Object.assign({}, m.ans);
      if (picks.length) ans[q.id] = picks.map(k => q.opts[k].label).join(''); else delete ans[q.id];
      this.exPatch({ picks:Object.assign({}, m.picks, { [q.id]:picks }), ans, confirm:false });
    };
    exClearPicks = () => { const m = this.state.exm; if (m && m.stage === 'run') this.exSetPicks(m.qs[m.i], []); };
    exType = (e) => {   // writing part 2: the character is typed
      const m = this.state.exm; if (!m || m.stage !== 'run') return;
      const q = m.qs[m.i]; const raw = String(e.target.value || ''); const val = raw.replace(/\s/g, '');
      const ans = Object.assign({}, m.ans); if (val) ans[q.id] = val; else delete ans[q.id];
      this.exPatch({ ans, typed:Object.assign({}, m.typed, { [q.id]:raw }), confirm:false });
    };
    exGo = (i) => { const m = this.state.exm; if (!m) return; try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} this.exPatch({ i:Math.max(0, Math.min(m.qs.length - 1, i)), confirm:false }); };
    exPlay = () => {
      const m = this.state.exm; if (!m) return;
      const q = m.qs[m.i]; if (!q.audio) return;
      const used = m.plays[q.id] || 0; if (used >= 2) return;
      this.ttsUnlock();
      const plays = Object.assign({}, m.plays); plays[q.id] = used + 1;
      this.exPatch({ plays });
      this.speakLines(q.audio, 'exq');
    };
    // several lines in a row (a conversation); the second voice is pitched higher where the browser allows it
    speakLines = (lines, key) => {
      const files = lines.map(l => this.nativeFile(l.text, l.pitch < 0.95 ? 'm' : ''));
      if (files.length && files.every(Boolean)) { this.speakFiles(lines, files, key); return; }
      if (ttsModeNow() === 'qwen') { this.speakLinesQwen(lines, key); return; }
      this.speakLinesBrowser(lines, key);
    };
    // exam conversations with the Qwen voices: a woman and a man, the same on every device (the browser voice differs from device to device)
    ttsUrl = async (text, voice) => {
      const ck = voice + '|' + text; let c = this.ttsCache[ck];
      if (!c || c.exp < Date.now()) { c = this.ttsCache[ck] = { url:await aliTTS(text, voice), exp:Date.now() + 20 * 3600000 }; }
      return c.url;
    };
    // a conversation from recordings (one <audio> element, so a phone that allowed the first line allows the rest)
    speakFiles = async (lines, files, key) => {
      this.stopNative(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      const tok = ++this.ttsTok;
      this.setState({ playing:key });
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      try {
        if (!this.ttsEl) this.ttsEl = new Audio();
        const a = this.ttsEl;
        for (let i = 0; i < files.length; i++) {
          await new Promise((res, rej) => { a.onended = res; a.onerror = () => rej(new Error('the recording could not be played')); a.src = files[i]; a.playbackRate = this.state.speed || 1; try { a.preservesPitch = true; } catch (e) {} const pr = a.play(); if (pr && pr.catch) pr.catch(rej); });
          if (tok !== this.ttsTok) return;
          if (i < files.length - 1) await sleep(250);
        }
        if (tok === this.ttsTok && this.state.playing === key) this.setState({ playing:null });
      } catch (e) {
        if (tok !== this.ttsTok) return;
        if (this.state.playing === key) this.setState({ playing:null });
        if (ttsModeNow() === 'qwen') this.speakLinesQwen(lines, key); else this.speakLinesBrowser(lines, key);
      }
    };
    speakLinesQwen = async (lines, key) => {
      this.stopNative(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      const tok = ++this.ttsTok;
      this.setState({ playing:key });
      const voiceFor = (l) => (l.pitch > 1.05 ? 'Maia' : l.pitch < 0.95 ? 'Kai' : ttsVoiceNow());
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      try {
        this.wakeAudio();
        if (!this.ttsEl) this.ttsEl = new Audio();
        const a = this.ttsEl;
        for (let i = 0; i < lines.length; i++) {
          const url = await this.ttsUrl(lines[i].text, voiceFor(lines[i]));
          if (tok !== this.ttsTok) return;
          await new Promise((res, rej) => { a.onended = res; a.onerror = () => rej(new Error('the audio could not be played')); a.src = url; a.playbackRate = this.state.speed || 1; try { a.preservesPitch = true; } catch (e) {} a.play().catch(rej); });
          if (tok !== this.ttsTok) return;
          if (i < lines.length - 1) await sleep(250);
        }
        if (tok === this.ttsTok && this.state.playing === key) this.setState({ playing:null });
      } catch (e) {
        if (tok !== this.ttsTok) return;
        this.ttsFail(e); this.speakLinesBrowser(lines, key);
      }
    };
    speakLinesBrowser = (lines, key) => {
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
        if (qRight(q, m.ans[q.id])) { correct += 1; byPart[q.part].c += 1; } else wrong.push({ n:n + 1, q, yours:m.ans[q.id] });
      });
      const res = { sec:m.sec, correct, total:m.qs.length, byPart, wrong, auto:!!auto };
      const results = Object.assign({}, m.results); results[m.sec] = res;
      if (m.sec === 'writing') {   // practice only: it is saved in the history but never counts toward the seal or the next level
        const entry = { at:Date.now(), mode:'writing', w:correct, wt:m.qs.length };
        this.setState({ exm:Object.assign({}, m, { stage:'result', results }), exams:this.state.exams.concat([entry]).slice(-20), dayMin:this.state.dayMin + 10, xp:this.state.xp + Math.round(correct * 2), dayXp:this.state.dayXp + Math.round(correct * 2) });
        try { window.scrollTo(0, 0); } catch (e) {}
        return;
      }
      if (m.mode === 'full' && m.sec === 'listening') { this.exPatch({ stage:'break', results }); return; }
      const entry = { at:Date.now(), mode:m.mode, l:results.listening ? results.listening.correct : null, r:results.reading ? results.reading.correct : null, lt:results.listening ? results.listening.total : null, rt:results.reading ? results.reading.total : null };
      if (LVL.passedList(this.state.exams.concat([entry]))) LVL.markPassed(LV);   // passing both sections (together or one at a time) opens the next level straight away
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
        let kept = '';
        if (last && last.who === 'me') {
          if (memOn()) (p.remember || []).forEach(f => { const t = cleanFact(f); if (t && !kept && !memFacts().some(x => x.t.toLowerCase() === t.toLowerCase())) { kept = t; memAdd(t); } });
          next[next.length - 1] = Object.assign({}, last, { judged:true, fb:p.fb, mem:kept || undefined });   // the judgement is about the learner's last line
          this.lsnJudge(next[next.length - 2], p.understood);
        }
        this.setState({ aim:next.concat([msg]), aiBusy:false, memFacts:memFacts().slice() });
        const n = next.length + 1;
        this.sayAi(p.zh, 'aim' + next.length, this.lsnRate(), () => this.aiHandsFree(n));
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
    aiMic = (auto) => {
      this.ttsUnlock(); try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}   // the reply that follows a spoken turn starts outside a tap
      if (this.state.asrMode === 'alibaba') { this.aiRecord(auto === true); return; }
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
    // listening level: Mingming's lines get faster and longer when you keep up, and easier when you do not
    lsnRate = () => Math.max(0.6, Math.min(1.5, (this.state.speed || 1) * LSN_LEVELS[lsnLvl() - 1].factor));
    lsnJudge = (prev, understood) => {   // prev: the Mingming line the learner has just answered
      if (!lsnAuto() || !prev || prev.who !== 'ai') return;
      const missed = understood === false || !!prev.slow;
      const needed = !!prev.rev || (prev.plays || 0) >= 2;
      let note = '';
      if (missed) {
        LSN.ok = 0; LSN.miss = (LSN.miss || 0) + 1;
        if (LSN.miss >= 2 && lsnLvl() > 1) { LSN.lvl = lsnLvl() - 1; LSN.miss = 0; note = 'A little easier now: listening level ' + lsnLvl() + ' of 5.'; }
      } else if (needed || understood !== true) { LSN.ok = 0; }
      else {
        LSN.miss = 0; LSN.ok = (LSN.ok || 0) + 1;
        if (LSN.ok >= 3 && lsnLvl() < 5) { LSN.lvl = lsnLvl() + 1; LSN.ok = 0; note = 'You kept up: listening level ' + lsnLvl() + ' of 5.'; }
      }
      saveLsn(); this.setState({ lsnLvl:lsnLvl(), lsnNote:note });
    };
    lsnStep = (d) => { LSN.lvl = Math.max(1, Math.min(5, lsnLvl() + d)); LSN.ok = 0; LSN.miss = 0; saveLsn(); this.setState({ lsnLvl:lsnLvl(), lsnNote:'' }); };
    lsnAutoToggle = () => { prefSet('lsnAuto', !lsnAuto()); this.setState({ lsnAuto:lsnAuto(), lsnNote:'' }); };
    aiPlay = (k) => {
      const a = this.state.aim.slice(); const m = a[k]; if (!m) return;
      a[k] = Object.assign({}, m, { plays:(m.plays || 0) + 1 }); this.setState({ aim:a });
      this.sayAi(m.zh, 'aim' + k, this.lsnRate());
    };
    aiSlower = (k) => {   // plays the line again, slower; this counts as "not caught"
      const a = this.state.aim.slice(); const m = a[k]; if (!m) return;
      a[k] = Object.assign({}, m, { slow:true, plays:(m.plays || 0) + 1 }); this.setState({ aim:a });
      this.sayAi(m.zh, 'aim' + k, Math.max(0.6, this.lsnRate() * 0.75));
    };
    // hands-free: when Mingming has finished speaking, the microphone opens by itself
    aiHandsFree = (n) => {
      setTimeout(() => {
        const S = this.state;
        if (!S.handsFree || S.screen !== 'speak' || S.aim.length !== n || S.aiBusy || S.aiListen || S.asrBusy || !S.aiOn || !this.voiceOnlyOn()) return;
        this.aiMic(true);
      }, 500);
    };
    aiHfToggle = () => {
      AICFG.handsFree = !this.state.handsFree; saveAiCfg(); prefSet('handsFree', !!AICFG.handsFree); this.setState({ handsFree:!!AICFG.handsFree });
      const S = this.state, last = S.aim[S.aim.length - 1];
      if (S.handsFree && last && last.who === 'ai' && !S.aiBusy && !S.aiListen && this.voiceOnlyOn()) this.aiMic(true);
    };
    // ----- API keys that follow the person: only when switched on, and only as an encrypted blob (secrets.js) -----
    // The passphrase stays on the person's devices (AICFG.syncPass, never synced). The server holds scrambled text it cannot read.
    keyVal = () => ({ key:AICFG.key || null, aliKey:aliCfg().key || null, aliWs:aliCfg().ws || '' });
    secretsChanged = () => { this.secretsPush(); };
    secretsPush = async () => {
      if (!prefGet('syncKeys', false)) return;
      const SX = window.ShanluSecrets;
      if (!SX || !SX.available() || !AICFG.syncPass) return;   // nothing leaves the device without a passphrase
      try {
        const sealed = await SX.seal(this.keyVal(), AICFG.syncPass);   // sealed even when empty, so removing a key reaches the other devices too
        PERSON.secrets = { v:sealed, at:Date.now() }; savePerson();
      } catch (e) { this.setState({ keyMsg:(e && e.message) || 'Could not encrypt the keys.' }); }
    };
    // keys that arrived from another device become this device's keys (encrypted: with the passphrase; the older plain copy: as it is)
    secretsOpen = async () => {
      const sec = PERSON.secrets && PERSON.secrets.v;
      if (!prefGet('syncKeys', false) || !sec || typeof sec !== 'object') return;
      const SX = window.ShanluSecrets;
      let v = null;
      if (SX && SX.isSealed(sec)) {
        if (!AICFG.syncPass) { this.setState({ keyLock:'need' }); return; }
        try { v = await SX.open(sec, AICFG.syncPass); } catch (e) { if (e && e.code === 'wrong') this.setState({ keyLock:'wrong' }); return; }
      } else if ('key' in sec || 'aliKey' in sec) { v = sec; }   // the older way: stored without a passphrase (the Settings screen offers to encrypt it)
      else return;
      if (v.key) AICFG.key = v.key; else delete AICFG.key;
      if (v.aliKey) AICFG.ali = Object.assign({ model:'qwen-flash' }, AICFG.ali, { key:v.aliKey, ws:v.aliWs || '' }); else delete AICFG.ali;
      const am = PERSON.prefs.aliModel; if (am && am.v !== undefined && AICFG.ali) AICFG.ali.model = am.v;
      saveAiCfg();
      this.setState({ keyLock:'', aiOn:aiReadyNow(), aliOn:!!aliCfg().key, aiProvider:aiProviderNow(), asrMode:asrModeNow(), ttsMode:ttsModeNow() });
    };
    keySyncToggle = () => {
      const on = !prefGet('syncKeys', false);
      prefSet('syncKeys', on);
      if (on) { this.setState({ syncKeys:true, keyPassInput:'', keyMsg:'', keyChanging:false }); if (AICFG.syncPass) this.secretsPush(); else this.secretsOpen(); }
      else {
        PERSON.secrets = { v:null, at:Date.now() }; savePerson();   // a newer empty copy takes the keys off the server
        delete AICFG.syncPass; saveAiCfg();
        this.setState({ syncKeys:false, keyLock:'', keyPassInput:'', keyMsg:'', keyChanging:false });
      }
    };
    keyChange = () => { this.setState({ keyChanging:true, keyPassInput:'', keyMsg:'' }); };
    keyPassGo = async () => {
      const SX = window.ShanluSecrets, pass = this.state.keyPassInput || '';
      if (!SX || !SX.available()) { this.setState({ keyMsg:'This browser cannot encrypt here (it needs a secure https page).' }); return; }
      if (pass.length < SX.MIN_LENGTH) { this.setState({ keyMsg:'The passphrase needs at least ' + SX.MIN_LENGTH + ' characters.' }); return; }
      const sec = PERSON.secrets && PERSON.secrets.v;
      this.setState({ keyBusy:true, keyMsg:'' });
      if (SX.isSealed(sec) && !this.state.keyChanging) {   // keys are already saved by another device: this passphrase must open them
        try { await SX.open(sec, pass); } catch (e) { this.setState({ keyBusy:false, keyMsg:'That passphrase does not open the saved keys.' }); return; }
        AICFG.syncPass = pass; saveAiCfg();
        await this.secretsOpen();
        this.setState({ keyBusy:false, keyPassInput:'', keyMsg:'Unlocked. Your keys are on this device now.' });
      } else {   // the first device, an older unencrypted copy, or a new passphrase
        AICFG.syncPass = pass; saveAiCfg();
        await this.secretsPush();
        this.setState({ keyBusy:false, keyPassInput:'', keyChanging:false, keyLock:'', keyMsg:'Saved, encrypted. On your other devices, enter the same passphrase once.' });
      }
    };
    // what arrived from the person's other devices becomes the live setting here
    personApply = () => {
      const g = (k) => (PERSON.prefs[k] ? PERSON.prefs[k].v : undefined);
      [['voiceOnly', 'voiceOnly'], ['handsFree', 'handsFree'], ['ttsMode', 'ttsMode'], ['ttsVoice', 'ttsVoice'], ['asr', 'asr'], ['provider', 'provider'], ['claudeModel', 'model']].forEach(p => { if (g(p[0]) !== undefined) AICFG[p[1]] = g(p[0]); });
      if (g('aliModel') !== undefined && AICFG.ali) AICFG.ali.model = g('aliModel');
      saveAiCfg();
      if (PERSON.lsn && PERSON.lsn.v) { LSN.lvl = PERSON.lsn.v.lvl || 1; LSN.ok = PERSON.lsn.v.ok || 0; LSN.miss = PERSON.lsn.v.miss || 0; }
      this.setState({ aiVoiceOnly:AICFG.voiceOnly !== false, handsFree:AICFG.handsFree === true, ttsMode:ttsModeNow(), ttsVoice:ttsVoiceNow(), asrMode:asrModeNow(), aiProvider:aiProviderNow(), aiOn:aiReadyNow(), aliOn:!!aliCfg().key,
        aiModel:AICFG.model || this.state.aiModel, aliModelInput:aliCfg().model || this.state.aliModelInput, lsnLvl:lsnLvl(), lsnAuto:lsnAuto(), memOn:memOn(), memFacts:memFacts(), syncKeys:prefGet('syncKeys', false) === true });
      this.secretsOpen();   // API keys (only if switched on): opened with the passphrase kept on this device
      this.settingsApply(true);
    };
    // Bring this device's settings in line with the person's saved ones. Study level and the reading style need a fresh page, which happens at most once per tab session.
    settingsApply = (fromSync) => {
      const g = (k) => (PERSON.prefs[k] ? PERSON.prefs[k].v : undefined);
      this.fromPerson = true;
      try { const sp = {}; SETTING_KEYS.forEach(k => { const v = g('set.' + k); if (v !== undefined && v !== this.state[k]) sp[k] = v; }); if (Object.keys(sp).length) this.setState(sp); }
      finally { this.fromPerson = false; }
      if (!fromSync) return;   // at start-up only the plain settings are applied; the page is never reloaded before anything has synced
      let guard = false; try { guard = sessionStorage.getItem('shanlu-setreload') === '1'; } catch (e) {}
      if (guard) return;
      let reload = false;
      const er = g('erhua');
      if ((er === 'on' || er === 'off') && er !== (ERHUA_ON ? 'on' : 'off')) { try { localStorage.setItem(ERHUA_KEY, er); reload = true; } catch (e) {} }
      const lv = g('level');
      if (typeof lv === 'number' && lv !== LV && (lv === 0 ? (LVL.unlockedLevels ? LVL.unlockedLevels().length : 0) >= 2 : lv >= 1 && LVL.unlocked(lv))) { try { localStorage.setItem('shanlu-level', String(lv)); reload = true; } catch (e) {} }
      if (reload) { try { sessionStorage.setItem('shanlu-setreload', '1'); } catch (e) {} this.persistNow(); try { location.reload(); } catch (e) {} }
    };
    // Settings chosen before they travelled: file them as the oldest value, so a later choice on any device wins.
    settingsSeed = () => {
      let changed = false;
      const S = this.state;
      Object.keys(SETTING_DEFAULT).forEach(k => { if (!PERSON.prefs['set.' + k] && S[k] !== undefined && S[k] !== SETTING_DEFAULT[k]) { PERSON.prefs['set.' + k] = { v:S[k], at:1 }; changed = true; } });
      if (!PERSON.prefs.erhua && ERHUA_ON) { PERSON.prefs.erhua = { v:'on', at:1 }; changed = true; }
      if (!PERSON.prefs.level && LV !== 1) { PERSON.prefs.level = { v:LV, at:1 }; changed = true; }
      if (changed) savePerson(false);
    };
    personTimer = null; personAt = 0;
    personChanged = () => {   // a change was made here: send it to the group's server soon, but not on every tap
      clearTimeout(this.personTimer);
      this.personTimer = setTimeout(() => {
        if (!FR || !FR.enabled() || !FR.identity()) return;
        if (Date.now() - this.personAt < 45000) { this.personChanged(); return; }
        this.personAt = Date.now();
        this.friendsProgressSync().catch(() => {});
      }, 20000);
    };
    // what Mingming remembers (follows the person)
    setRetention = (r) => { prefSet('retention', r); this.setState({ retTick:(this.state.retTick || 0) + 1 }); };
    toggleTones = () => { prefSet('tonesOptional', !tonesOptional()); this.setState({ retTick:(this.state.retTick || 0) + 1 }); };
    memRemember = (t) => { const c = cleanFact(t); if (c && memOn()) memAdd(c); this.setState({ memFacts:memFacts() }); };
    memToggle = () => { prefSet('memOn', !memOn()); this.setState({ memOn:memOn() }); };
    memForget = (i) => { const f = memFacts()[i]; if (f) memDrop(memKey(f.t)); this.setState({ memFacts:memFacts() }); };
    memClear = () => { memWipe(); this.setState({ memFacts:[] }); };
    // voice only: what the microphone heard is sent by itself (the recognised line stays on screen, with any correction under it)
    voiceOnlyOn = () => { const S = this.state; return !!S.aiVoiceOnly && !S.aiTyping && this.hasMicNow(); };
    hasMicNow = () => (this.state.asrMode === 'alibaba' ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)) : !!(window.webkitSpeechRecognition || window.SpeechRecognition));
    aiAutoSend = () => { if (this.voiceOnlyOn() && (this.state.aiInput || '').trim() && !this.state.aiBusy) this.aiSend(); };
    aiVoToggle = () => {
      if (this.voiceOnlyOn()) { this.setState({ aiTyping:true }); return; }
      AICFG.voiceOnly = true; saveAiCfg(); prefSet('voiceOnly', true); this.setState({ aiVoiceOnly:true, aiTyping:false });
    };
    aiReveal = (k) => { const a = this.state.aim.slice(); if (!a[k]) return; a[k] = Object.assign({}, a[k], { rev:true }); this.setState({ aim:a }); };
    setTtsMode = (m) => {
      if (m === 'qwen' && !aliUsable()) { this.setState({ aliNote:'Save an Alibaba key first, then Qwen can speak for Mingming.' }); return; }
      AICFG.ttsMode = m; saveAiCfg(); prefSet('ttsMode', m); this.ttsWarned = false; this.setState({ ttsMode:ttsModeNow() });
    };
    setTtsVoice = (v) => { AICFG.ttsVoice = v; saveAiCfg(); prefSet('ttsVoice', v); this.setState({ ttsVoice:ttsVoiceNow() }); if (ttsModeNow() === 'qwen') this.sayAi('你好，我是明明。我们说中文吧。', 'ttsdemo'); };
    aiPickAlt = (t) => { this.setState({ aiInput:t, aiAlts:[] }); };
    aiShowSug = () => { const a = this.state.aim.slice(); const i = a.length - 1; if (i < 0 || !a[i].sug) return; a[i] = Object.assign({}, a[i], { sug:Object.assign({}, a[i].sug, { open:true }) }); this.setState({ aim:a }); };
    aiUseSug = () => { const a = this.state.aim; const m = a[a.length - 1]; if (m && m.sug) this.setState({ aiInput:m.sug.zh }); };
    aiSimpler = () => {
      const a = this.state.aim.slice(), i = a.length - 1;
      if (i >= 0 && a[i].who === 'ai') { a[i] = Object.assign({}, a[i], { slow:true }); this.setState({ aim:a }); }
      this.setState({ aiInput:'请再说一遍，慢一点。' }); this.aiSend();
    };
    aiSaveKey = () => {
      const k = (this.state.aiKeyInput || '').trim();
      if (!k) { this.setState({ aiNote:'Paste your API key first.' }); return; }
      AICFG.key = k; AICFG.model = this.state.aiModel; saveAiCfg(); prefSet('claudeModel', AICFG.model); this.secretsChanged();
      this.setState({ aiOn:aiReadyNow(), aiKeyInput:'', aiNote:'Saved on this device.' });
    };
    aiRemoveKey = () => { delete AICFG.key; delete AICFG.model; saveAiCfg(); this.secretsChanged(); this.setState({ aiOn:aiReadyNow(), aiNote:'The key was removed from this device.', aim:[] }); };
    aiSetModel = (m) => { AICFG.model = m; if (AICFG.key) saveAiCfg(); prefSet('claudeModel', m); this.setState({ aiModel:m }); };
    // which service writes Mingming's lines
    viewProvider = (p) => { this.setState({ aiTab:p, aiNote:'', aliNote:'' }); };   // which settings form is shown; nothing else changes
    setProvider = (p) => {
      const has = p === 'alibaba' ? aliUsable() : !!AICFG.key;
      if (!has) return;
      AICFG.provider = p; saveAiCfg(); prefSet('provider', p);
      this.setState({ aiTab:p, aiProvider:aiProviderNow(), aiOn:aiReadyNow(), aim:[], aiNote:'', aliNote:'', aiErr:'' });
    };
    aliSaveKey = () => {
      const k = (this.state.aliKeyInput || '').trim();
      const ws = (this.state.aliWsInput || '').trim();
      const model = (this.state.aliModelInput || '').trim() || 'qwen-flash';
      if (!/^[A-Za-z0-9_-]*$/.test(ws)) { this.setState({ aliNote:'The workspace ID should be letters, numbers, dashes and underscores only. Leave it empty if you are not sure.' }); return; }
      if (!k && !aliCfg().key) { this.setState({ aliNote:'Paste your Alibaba API key first.' }); return; }
      AICFG.ali = { key:k || aliCfg().key, ws, model };
      if (!AICFG.key || AICFG.provider === 'alibaba') { AICFG.provider = 'alibaba'; prefSet('provider', 'alibaba'); }
      saveAiCfg(); prefSet('aliModel', model); this.secretsChanged();
      this.setState({ aliOn:true, aliKeyInput:'', aliModelInput:model, aiTab:'alibaba', aiProvider:aiProviderNow(), aiOn:aiReadyNow(), aliNote:'Saved on this device. Press "Test connection" to check it.' });
    };
    aliRemoveKey = () => {
      delete AICFG.ali; if (AICFG.provider === 'alibaba') { AICFG.provider = 'anthropic'; prefSet('provider', 'anthropic'); } if (AICFG.asr === 'alibaba') { AICFG.asr = 'browser'; prefSet('asr', 'browser'); } saveAiCfg(); this.secretsChanged();
      this.setState({ aliOn:false, aliWsInput:'', aliModelInput:'qwen-flash', aiProvider:aiProviderNow(), aiOn:aiReadyNow(), asrMode:'browser', aliNote:'The Alibaba key was removed from this device.', aim:[] });
    };
    aliPreset = (m) => { this.setState({ aliModelInput:m }); };
    // "Test connection" for the Claude key: a free key check, then one tiny message (so a missing credit or a wrong model name shows up now, not in the middle of a chat)
    aiTestKey = async () => {
      if (!AICFG.key) { this.setState({ aiNote:'Save the key first.' }); return; }
      if (this.state.aiTesting) return;
      this.setState({ aiTesting:true, aiNote:'Testing…' });
      const H = { 'x-api-key':AICFG.key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true', 'content-type':'application/json' };
      const model = AICFG.model || 'claude-haiku-5-5';
      const lines = []; let keyOk = false;
      try {
        const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers:H });
        if (r.ok) { keyOk = true; lines.push('The key is accepted by Anthropic.'); }
        else if (r.status === 401) lines.push('Anthropic rejected the key. Check that all of it was copied, with no spaces.');
        else lines.push('Anthropic answered with an error (' + r.status + ') when checking the key.');
      } catch (e) { lines.push('Could not reach Anthropic from this browser. Check the connection, and that no blocker is stopping api.anthropic.com.'); }
      if (keyOk) {
        try {
          const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:H, body:JSON.stringify({ model, max_tokens:8, messages:[{ role:'user', content:'Reply with the single word OK.' }] }) });
          if (r.ok) lines.push('Chat model (' + model + '): working.');
          else if (r.status === 404) lines.push('Chat model (' + model + '): Anthropic does not know that model name. Pick another model above.');
          else if (r.status === 429) lines.push('Chat model: Anthropic says too many requests right now. Try again in a minute.');
          else if (r.status === 400 || r.status === 402 || r.status === 403) lines.push('Chat model: refused, which usually means the API account has no credit yet (add some at console.anthropic.com).');
          else lines.push('Chat model: Anthropic had a problem (' + r.status + ').');
        } catch (e) { lines.push('Chat model: could not reach Anthropic.'); }
      }
      this.setState({ aiTesting:false, aiNote:lines.join(' ') });
    };
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
      if (m === 'alibaba' && !aliUsable()) { this.setState({ aliNote:'Save an Alibaba key first, then you can use it to hear you.' }); return; }
      AICFG.asr = m; saveAiCfg(); prefSet('asr', m); this.setState({ asrMode:asrModeNow() });
    };
    // recording for Alibaba's recogniser: stops by itself after a pause once you have spoken (or when you tap again)
    recStop = null;
    aiRecord = async (auto) => {
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
          if (!heard && !manual) { this.setState({ aiListen:false, aiErr:auto ? '' : 'I did not hear anything. Check your microphone, then try again.' }); return; }
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
          if ((heard && now - lastVoice > 1500) || now - t0 > 30000 || (!heard && now - t0 > (auto ? 12000 : 8000))) stop(false);
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
          let gist = SYNCCFG.gist || null, created = false, personBack = null;
          for (const n of LVLS) {
            const st = readStore(n) || {};
            const rr = await window.ShanluSync.round({ token:SYNCCFG.token, gistId:gist, state:st, file:window.ShanluSync.fileFor(n), person:personBack ? null : PERSON });
            gist = rr.gistId; created = created || rr.created; if (rr.person) personBack = rr.person;
            lsSet(storeKey(n), JSON.stringify(window.ShanluSync.applyMerged(st, rr.merged)));
          }
          r = { gistId:gist, created, person:personBack };
          const tmp = Object.assign({}, this.state, readSplit());
          fillWs(tmp.ws);
          carryOverErhua(tmp);
          patch = {}; SPLIT.forEach(k => { patch[k] = tmp[k]; });
        } else {
          r = await window.ShanluSync.round({ token:SYNCCFG.token, gistId:SYNCCFG.gist || null, state:this.state, file:window.ShanluSync.fileFor(LV), person:PERSON });
          const bumped = (r.merged.epoch || 0) > (this.state.epoch || 0);
          let next = rollDay(Object.assign({}, this.state, r.merged, bumped ? { mem0:null } : {}));
          carryOverErhua(next);
          patch = window.ShanluSync.pick(next);
          patch.rq = this.cleanQueue(patch.rq, patch.ws, patch.lrn);
          patch.ws = fillWs(patch.ws);
          if (bumped) patch.mem0 = next.mem0;
        }
        SYNCCFG.gist = r.gistId; SYNCCFG.at = Date.now(); saveSyncCfg();
        // the person's own settings (listening level, what Mingming remembers, chat preferences) come back through the gist too
        if (r.person && window.ShanluSync.samePerson && !window.ShanluSync.samePerson(r.person, PERSON)) { PERSON = r.person; savePerson(false); this.personApply(); }
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
    // "Test connection" for the GitHub token: one read-only request, so a wrong, expired or under-permissioned token shows up now
    syncTest = async () => {
      if (!SYNCCFG.token || this.state.syncTesting || !window.ShanluSync) return;
      this.noSync = true; this.setState({ syncTesting:true, syncBad:false, syncMsg:'Testing…' }); this.noSync = false;
      let bad = false, msg = '';
      try {
        const api = window.ShanluSync.gistApi(SYNCCFG.token);
        const info = await api.check();
        const gid = SYNCCFG.gist || await api.find();
        msg = 'GitHub accepts the token.';
        if (typeof info.scopes === 'string' && !/(^|[\s,])gist(,|$)/.test(info.scopes)) { bad = true; msg = 'GitHub accepts the token, but it does not have the gist permission, so it cannot save your progress. Make a new token with the gist box ticked.'; }
        else {
          if (info.expires) { const d = new Date(info.expires.replace(' UTC', 'Z').replace(' ', 'T')); if (!isNaN(d)) msg += ' It expires ' + d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + '.'; }
          msg += gid ? ' Your private progress gist is there.' : ' No progress gist yet; it is created at the first sync.';
        }
      } catch (e) { bad = true; msg = (e && e.message) || 'The test failed.'; }
      this.noSync = true; this.setState({ syncTesting:false, syncBad:bad, syncMsg:msg }); this.noSync = false;
    };
    syncDisconnect = () => { SYNCCFG = {}; saveSyncCfg(); clearTimeout(this.syncTimer); this.setState({ syncOn:false, syncAt:0, syncMsg:'This device is disconnected. Your progress here is kept.', syncBad:false }); };
    toggleErhua = () => {
      this.persistNow();
      try { localStorage.setItem(ERHUA_KEY, ERHUA_ON ? 'off' : 'on'); } catch (e) {}
      prefSet('erhua', ERHUA_ON ? 'off' : 'on');
      try { location.reload(); } catch (e) {}
    };
    setVoice = (id) => { this.setState({ voiceId:id }); };
    refreshVoices = () => { this.setState({ vtick:this.state.vtick + 1 }); };
    toggleAllVoices = () => { this.setState({ vall:!this.state.vall }); };

    // ----- review -----
    flip = () => { this.setState({ rflip:!this.state.rflip }); };
    toggleRpy = () => { this.setState({ rpy:!this.state.rpy }); };   // a peek at this card only: it is switched off again for the next card
    // every answer is logged: [time, word, skill (s/p/h), grade (a/h/g/e), kind (f flip, c choice, t typed, a audio)]; the newest 800 are kept
    logAnswer = (zh, dim, r, kind) => { const e = [Date.now(), zh, dim === 'prod' ? 'p' : dim === 'hear' ? 'h' : 's', { again:'a', hard:'h', good:'g', easy:'e' }[r], kind]; return (this.state.rlog || []).concat([e]).slice(-800); };
    lapsed = {}; rvKey = null;
    // the card on top of the queue: which kind of card it is. Stable for a given card (a hash), so a re-render does not change it.
    rKind = (it) => {
      const S = this.state; const m = itemOf(it);
      if (m.t === 'l') { const e = S.lrn[m.zh] || { st:-1 }; return e.st < 0 ? 'intro' : e.st === 0 ? 'choice' : 'type'; }
      if (m.t === 'p') return 'type';
      if (m.t === 'h') return 'audio';
      const share = typeof window.SHANLU_AUTO_SHARE === 'number' ? window.SHANLU_AUTO_SHARE : 35;   // (the browser tests set it to 0)
      return (strHash(m.zh) + Math.floor(Date.now() / 864e5) + S.rstep * 7) % 100 < share ? 'choice' : 'flip';   // about a third of recognition cards are checked for you
    };
    rQuestion = (it, kind) => {
      const m = itemOf(it); const ex = pickEx(m.zh);
      const q = kind === 'choice' ? qMeaning(m.zh) : kind === 'audio' ? qHearMeaning(m.zh) : m.t === 'l' ? qTypePinyin(m.zh, ex) : qSayIt(m.zh, ex);
      return Object.assign(q, { rv:true, rit:it, reportUrl:report('Review card for ' + m.zh, m.zh + ' ' + BANK[m.zh].py + ' ' + BANK[m.zh].en) });
    };
    // one answer: changes the word's memory (or its learning step) and the log; returns what the queue should do next
    rGrade = (it, r, kind) => {
      const S = this.state; const m = itemOf(it); const zh = m.zh;
      const patch = { rlog:[] }; let again = false, at = 0, done = true, gain = { again:0, hard:2, good:4, easy:5 }[r];
      let ws = S.ws; const from = wMastery(S.ws[zh]);
      if (staleNew(it, S.ws, S.lrn)) return { rlog:[], ws:S.ws, from, to:from, gain:0, again:false, at:0, done:true };   // already learned: nothing to grade, nothing to reset
      if (m.t === 'l') {
        const e = S.lrn[zh] || { st:-1, m:0 }; const lrn = Object.assign({}, S.lrn);
        if (e.st < 0) { lrn[zh] = { st:0, m:e.m || 0, at:Date.now() }; at = 3; done = false; gain = 0; }   // met it: the first recall comes a few cards later
        else if (r === 'good' || r === 'easy') {
          if (e.st + 1 >= LEARN_STEPS) {   // recalled twice: it graduates with a real interval and now counts in "words in memory"
            const cur = S.ws[zh]; const miss = (e.m || 0) > 0;
            ws = Object.assign({}, S.ws); ws[zh] = { see:{ s:miss ? 1 : 1.5, t:Date.now(), d:5 }, hear:cur.hear, prod:{ s:miss ? 0.6 : 1, t:Date.now(), d:5 } };
            delete lrn[zh]; gain = 5;
          } else { lrn[zh] = { st:e.st + 1, m:e.m || 0, at:Date.now() }; again = true; gain = 3; done = false; }
        } else { lrn[zh] = { st:0, m:(e.m || 0) + 1, at:Date.now() }; at = 2; done = false; gain = 0; }
        patch.lrn = lrn;
        if (e.st >= 0) patch.rlog = this.logAnswer(zh, m.t === 'l' && e.st >= 1 ? 'prod' : 'see', r, kind);
      } else {
        const dim = m.t === 'p' ? 'prod' : m.t === 'h' ? 'hear' : 'see';
        const key = zh + '#' + dim;
        const cur = S.ws[zh]; const next = { see:cur.see, hear:cur.hear, prod:cur.prod };
        next[dim] = bump(cur[dim], r, { relearn:!!this.lapsed[key] && r !== 'again' });
        if (r === 'again') this.lapsed[key] = true;
        ws = Object.assign({}, S.ws); ws[zh] = next;
        if (r === 'again') again = true;
        patch.rlog = this.logAnswer(zh, dim, r, kind);
      }
      patch.ws = ws; patch.from = from; patch.to = wMastery(ws[zh]); patch.gain = gain; patch.again = again; patch.at = at; patch.done = done;
      return patch;
    };
    // after an answer: take the card off the queue (or put it back), count it, and finish the session when the queue is empty
    rAdvance = (g) => {
      const S = this.state;
      if (!S.rq.length) return;
      const it = S.rq[0];
      g = g || this.rLast || { ws:S.ws, lrn:S.lrn, rlog:[], gain:0, done:true, again:false, at:0, from:wMastery(S.ws[itemOf(it).zh]), to:wMastery(S.ws[itemOf(it).zh]), rate:null };   // (no grade kept: just move on, never throw)
      const q = S.rq.slice(1).filter(z => BANK[itemOf(z).zh] && !staleNew(z, g.ws, g.lrn || S.lrn));
      if (g.again) q.push(it); else if (g.at) q.splice(Math.min(g.at, q.length), 0, it);
      const counts = Object.assign({}, S.rcounts); if (g.rate) counts[g.rate] = (counts[g.rate] || 0) + 1;
      const finished = q.length === 0;
      this.rvKey = null; this.rLast = null;
      if (g.rate) { try { const t = ymd(new Date()); let d = null; try { d = JSON.parse(localStorage.getItem('shanlu-achday')); } catch (e) {} if (!d || d.d !== t) d = { d:t, n:0 }; d.n++; if (d.n >= 100) this.achEv.rev100 = 1; localStorage.setItem('shanlu-achday', JSON.stringify(d)); } catch (e) {} }
      if (finished) { const c = (counts.again || 0) + (counts.hard || 0) + (counts.good || 0) + (counts.easy || 0); if (c >= 10 && !counts.again && !counts.hard) this.achEv.perfect = 1; }
      this.setState({
        rq:q, rflip:false, rpy:false, rdone:S.rdone + (g.done && !g.again ? 1 : 0), rstep:S.rstep + 1, rrun:g.rate ? ((g.rate === 'again' || g.rate === 'hard') ? 0 : (S.rrun || 0) + 1) : (S.rrun || 0), rmiss:(g.rate === 'again' || g.rate === 'hard') && (S.rmiss || []).indexOf(itemOf(it).zh) < 0 ? (S.rmiss || []).concat(itemOf(it).zh).slice(0, 8) : (S.rmiss || []), rxp:S.rxp + g.gain, rcomplete:finished, rcounts:counts,
        xp:S.xp + g.gain, dayXp:S.dayXp + g.gain, dayMin:S.dayMin + (finished ? Math.max(1, Math.round(S.rtotal * 0.5)) : 0),
        ws:g.ws, lrn:g.lrn || S.lrn, rlog:g.rlog.length ? g.rlog : S.rlog, woff:0, rlast:g.rate ? { zh:itemOf(it).zh, from:g.from, to:g.to } : S.rlast,
        qchecked:false, qchoice:null, qtyped:'', qcorrect:false, qfeed:''
      });
      if (finished && onbRead().s === 'go') this.onbSet({ s:'done', d:ymd(new Date()) });   // the Start here session is over
    };
    // a self-graded flip card (or the introduction of a new word)
    rate = (r) => {
      const S = this.state;
      if (!S.rq.length) return;
      const it = S.rq[0];
      const g = this.rGrade(it, r, 'f'); g.rate = itemOf(it).t === 'l' ? null : r;
      this.rAdvance(g);
    };
    rIntroDone = () => { const S = this.state; if (!S.rq.length) return; const g = this.rGrade(S.rq[0], 'good', 'f'); g.rate = null; this.rAdvance(g); };
    // an auto-checked card (choice, audio or typed): graded the moment it is checked; Continue moves on
    rAnswer = (q, ok, grade, feed) => {
      const S = this.state; if (!S.rq.length) return;
      const r = ok ? 'good' : (grade === 'hard' ? 'hard' : 'again');
      const kind = q.type === 'listen' ? 'a' : q.type === 'mc' ? 'c' : 't';
      const g = this.rGrade(S.rq[0], r, kind); g.rate = itemOf(S.rq[0]).t === 'l' ? null : r;
      this.rLast = g;
      this.setState({ qchecked:true, qcorrect:ok, qfeed:feed });
    };
    // stop part-way: what is answered is already saved card by card; the rest simply stays due. With some cards done you get the normal summary.
    endSession = () => {
      const S = this.state; if (!S.rq.length || S.rcomplete) return;
      this.rvKey = null; this.rLast = null;
      if (!S.rdone) { this.setState({ rq:[], rtotal:0, rflip:false, rpy:false, qchecked:false, qchoice:null, qtyped:'', qfeed:'' }); return; }
      this.setState({ rq:[], rtotal:S.rdone, rcomplete:true, rflip:false, rpy:false, qchecked:false, qchoice:null, qtyped:'', qfeed:'', dayMin:S.dayMin + Math.max(1, Math.round(S.rdone * 0.5)) });
      if (onbRead().s === 'go') this.onbSet({ s:'done', d:ymd(new Date()) });
    };
    practiceAnyway = () => {
      const q = buildQueue(this.state.ws, true, this.state.lrn);
      this.lapsed = {}; this.rvKey = null;
      this.setState({ rq:q, rtotal:q.length, rdone:0, rxp:0, rcomplete:false, rflip:false, rpy:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null, rrun:0, rmiss:[], qchecked:false, qchoice:null, qtyped:'', qfeed:'' });
    };

    // ----- quiz engine (tests and grammar practice) -----
    quizQs = [];
    qs = () => this.quizQs;
    curQ = () => this.quizQs[this.state.qi] || this.quizQs[0];
    startQuiz = (mode, lessonIdx) => {
      const list = mode === 'grammar' ? prepGrammar(LESSONS[lessonIdx === undefined ? this.state.glesson : lessonIdx]) : buildTest(this.state);
      if (!list.length) return;
      this.quizQs = list;
      this.rvKey = null; this.setState({ screen:'quiz', qmode:mode, qi:0, qpicked:[], qtyped:'', qchoice:null, qfeed:'', qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0-9\s.,!?]/g, '');
    canCheck = () => {
      const S = this.state; const q = this.curQ();
      if (!q) return false;
      if (q.type === 'type' || q.type === 'cloze' || q.type === 'write') return this.norm(S.qtyped).length > 0 || (q.type === 'write' && S.qtyped.trim().length > 0);
      if (q.type === 'order') return S.qpicked.length === q.tiles.length;
      return S.qchoice !== null;
    };
    check = () => {
      const S = this.state;
      if (S.qchecked || S.qbusy || !this.canCheck()) return;
      const q = this.curQ();
      if (q.type === 'write') { this.checkWrite(q); return; }
      let ok = false, grade = 'again', feed = '';
      if (q.type === 'type' || q.type === 'cloze') { const r = checkTyped(q, S.qtyped); ok = !!r.ok; grade = ok ? 'good' : (r.grade || 'again'); feed = r.note || ''; }
      else if (q.type === 'listen' || q.type === 'mc') ok = S.qchoice === q.correct;
      else if (q.type === 'order') ok = S.qpicked.map(id => q.tiles[id]).join('|') === q.toks.join('|');
      else if (q.type === 'spot') ok = S.qchoice === q.spot;
      if (q.rv) { this.rAnswer(q, ok, grade, feed); return; }   // a Review card: the answer goes to the word's memory and the review log, not to a test score
      if (q.pt) this.gptRecord(q.pt, 'r', ok, grade, q.gpool);   // a grammar-review card: the point's own memory moves on
      const gain = ok ? 10 + Math.min(S.qcombo, 4) * 2 : 0;
      const combo = ok ? S.qcombo + 1 : 0;
      const res = S.qres.slice(); res[S.qi] = ok;
      const patch = { qfeed:feed, qchecked:true, qcorrect:ok, qscore:S.qscore + (ok ? 1 : 0), qcombo:combo, qbest:Math.max(S.qbest, combo), qxp:S.qxp + gain, qgain:gain, qres:res, xp:S.xp + gain, dayXp:S.dayXp + gain };
      if (q.word && q.dim && S.ws[q.word]) {
        const cur = S.ws[q.word];
        const ws = Object.assign({}, S.ws);
        ws[q.word] = { see:cur.see, hear:cur.hear, prod:cur.prod };
        ws[q.word][q.dim] = bump(cur[q.dim], ok ? 'good' : (grade === 'hard' ? 'hard' : 'again'));
        patch.ws = ws;
        patch.rlog = this.logAnswer(q.word, q.dim, ok ? 'good' : (grade === 'hard' ? 'hard' : 'again'), q.type === 'listen' ? 'a' : q.type === 'mc' ? 'c' : 't');
      }
      this.setState(patch);
    };
    next = () => {
      const S = this.state;
      if (this.curQ() && this.curQ().rv) { this.rAdvance(); return; }
      const total = this.quizQs.length;
      if (S.qi + 1 >= total) {
        const patch = { qdone:true };
        const pct = Math.round(S.qscore / total * 100);
        if (S.qmode === 'test') {
          const hist = S.testHistory.concat([{ date:new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' }), score:pct }]).slice(-5);
          patch.testHistory = hist; patch.tdone = true; patch.dayMin = S.dayMin + (S.tdone ? 0 : 3);
        } else if (S.qmode === 'greview') {
          patch.gdone = true; patch.grdone = true; patch.dayMin = S.dayMin + (S.gdone ? 0 : 4);   // the daily Grammar review task is its own flag, so a lesson does not tick it
        } else {
          const L = LESSONS[S.glesson];
          const gres = Object.assign({}, S.gres); gres[L.id] = Math.max(gres[L.id] || 0, pct);
          patch.gres = gres; patch.gdone = true; patch.dayMin = S.dayMin + (S.gdone ? 0 : 4);
        }
        this.setState(patch);
      } else {
        this.setState({ qi:S.qi + 1, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qfeed:'', qerr:'', qbusy:false });
      }
    };
    primary = () => { if (this.state.qchecked) this.next(); else this.check(); };
    // keyboard for Review words (the global key listener calls this). Returns true when it used the key.
    //   flip card: Space/Enter show the answer, then 1-4 rate (Space/Enter = Good); before showing: 1-4 rate it straight away (Y = Good, N = Again), P = pinyin; H / S hear the word / sentence
    //   new word: Space/Enter = got it.  Choice and listening cards: 1-4 or A-D answers at once, Enter or Space continues, P or R plays.  Typed cards: the box is already focused, Enter checks, Enter continues
    //   result screens: Enter presses the main button
    kbReview = (e) => {
      const S = this.state; const k = e.key; const lk = String(k).toLowerCase();
      const go = k === ' ' || k === 'Enter';
      if (S.rcomplete || !S.rq.length) { if (go) { const b = document.querySelector('.rev .res-act .btn.pri'); if (b) { b.click(); return true; } } return false; }
      const kind = this.rKind(S.rq[0]);
      if (kind === 'flip') {
        if (!S.rflip) {
          if (go) this.flip(); else if ('1234'.indexOf(k) >= 0 && k.length === 1) this.rate(['again', 'hard', 'good', 'easy'][Number(k) - 1]); else if (lk === 'y') this.rate('good'); else if (lk === 'n') this.rate('again'); else if (lk === 'p') this.toggleRpy(); else return false;
        } else if ('1234'.indexOf(k) >= 0 && k.length === 1) this.rate(['again', 'hard', 'good', 'easy'][Number(k) - 1]);
        else if (go) this.rate('good');
        else if (lk === 'h') this.sayAi(itemOf(S.rq[0]).zh, 'word');
        else if (lk === 's') { const zh = itemOf(S.rq[0]).zh; const l = EXS[zh]; if (l && l.length) this.sayAi(l[(strHash(zh) + Math.floor(Date.now() / 864e5) + S.rstep) % l.length].zh, 'ex'); }
        else return false;
        return true;
      }
      if (kind === 'intro') { if (go) { this.rIntroDone(); return true; } return false; }
      if (S.qchecked) { if (go) { this.next(); return true; } return false; }
      const q = this.curQ();
      if (q && q.options && (kind === 'choice' || kind === 'audio')) {
        const i = '1234'.indexOf(k) >= 0 && k.length === 1 ? Number(k) - 1 : 'abcd'.indexOf(lk) >= 0 && lk.length === 1 ? 'abcd'.indexOf(lk) : -1;
        if (i >= 0 && q.options[i]) { this.setState({ qchoice:q.options[i].id }); this.check(); return true; }   // one key answers: pick and check together
        if (kind === 'audio' && (lk === 'p' || lk === 'r')) { this.sayAi(q.audio || '', 'q'); return true; }
        if (go) { this.check(); return true; }
      } else if (go) { this.check(); return true; }
      return false;
    };
    // a typed card: put the cursor in the answer box so the whole session can be done from the keyboard (only where there is a real keyboard and mouse)
    // sounds follow what just changed on screen: an answer being marked, a card rated, a session finished
    sfxWatch() {
      try {
        const S = this.state; const p = this._sx;
        const rc = S.rcounts || {};
        const cur = { chk:S.qchecked, ok:S.qcorrect, rc:S.rcomplete, qd:S.qdone, step:S.rstep, again:rc.again || 0, pos:(rc.hard || 0) + (rc.good || 0) + (rc.easy || 0) };
        this._sx = cur;
        if (!p) return;
        if (cur.chk && !p.chk) { SFX.play(cur.ok ? 'ok' : 'bad'); return; }
        if (cur.rc && !p.rc) { SFX.play('done'); return; }
        if (cur.qd && !p.qd) { SFX.play('done'); return; }
        if (cur.step > p.step && !p.chk) { if (cur.again > p.again) SFX.play('bad'); else if (cur.pos > p.pos) SFX.play('ok'); }
      } catch (e) {}
    }
    // ---- Journey ----
    // numbers for the achievements
    jyCounts() {
      const o = { n:0, stamps:0, total:JWORLD ? JWORLD.order.length : 0, dish:0, attr:0, cult:0, cities:0, sv:0, svTotal:0, svRegions:0 };
      try {
        const st = jyRead(); if (!st || !JWORLD) return o;
        o.n = st.seen.length; o.stamps = Object.keys(st.done || {}).filter(id => JWORLD.byRegion[id]).length;
        const have = {}; st.seen.forEach(id => { have[id] = 1; const s = JWORLD.byStop[id]; if (!s) return; if (s.k === 'D') o.dish++; else if (s.k === 'A') o.attr++; else if (s.k === 'C') o.cult++; });
        const sl = SOUV.filter(x => JWORLD.byStop[x.stop]); o.svTotal = sl.length; o.sv = sl.filter(x => have[x.stop]).length;   // the souvenirs found by unlocking the stop that hides them
        const byR = {}; sl.forEach(x => { (byR[x.rid] = byR[x.rid] || []).push(x); }); o.svRegions = Object.keys(byR).filter(r => byR[r].length > 1 && byR[r].every(x => have[x.stop])).length;
        Object.keys(JWORLD.byCity).forEach(cid => { const C = JWORLD.byCity[cid]; if (C.stops.length > 1 && C.stops.every(x => have[x.id])) o.cities++; });
      } catch (e) {}
      return o;
    }
    // make sure a saved journey exists and points at a region (the first look, or after the stop lists changed)
    jyEnsure() {
      if (!JWORLD) return null;
      const cur = jyRead();
      const st = JY.ensure(JWORLD, cur, cur ? JY.rngFor(cur) : Math.random);
      if (!cur) st.sd = Math.random().toString(36).slice(2, 10);   // this journey's own seed (see journey.js rngFor)
      if (!cur || st.reg !== cur.reg || !cur.ms) prefSet('jy', st);
      return st;
    }
    // spend the XP: unlock the next stop
    jyTravel = () => {
      if (!JWORLD) return;
      const S = this.state; const st0 = this.jyEnsure(); if (!st0 || !st0.reg) return;
      if (JY.meter(totalXp(S), st0).ready < 1) return;
      const from = st0.seen.length ? st0.seen[st0.seen.length - 1] : null;
      const r = JY.step(JWORLD, st0, JY.rngFor(st0), ymd(new Date()));
      if (!r.stop) return;
      prefSet('jy', r.st);
      this.friendsTick();
      SFX.play(r.ev.indexOf('stamp') >= 0 || r.ev.indexOf('arrive') >= 0 ? 'fly' : 'ok');
      // a flight shows on the map of the whole country; a ride or a walk shows on the map of the region you are in
      const flew = r.ev.indexOf('arrive') >= 0;
      const playMode = this.jyMotionOk() ? (flew ? 'fly' : (r.ev.indexOf('city') >= 0 ? 'leg' : 'walk')) : '';
      this.setState({ jyPlay:playMode, jyPlayStamp:r.ev.indexOf('stamp') >= 0, jyRv:{ id:r.stop.id, ev:r.ev, region:r.region, next:r.next, from, k:(this.jyK = ((this.jyK || 0) + 1) % 2) }, jyOpen:null, jyTab:'map', jySel:null, jyFilter:'all', jyReg:flew || !JMAP.regions[r.stop.rid] ? null : r.stop.rid });
      try { window.scrollTo(0, 0); } catch (e) {}
      if (playMode) this.jyPlayRun(playMode);
      this.checkMilestones();
    };
    // The travel moment: pay, take off, land, postcard, stamp. It plays once per trip and never loops. Any tap or key skips to the finished picture.
    jyMotionOk = () => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    jyPlayRun = (mode) => {
      const t0 = (this.jyPlayAt = Date.now());
      clearTimeout(this.jyPlayTimer); clearTimeout(this.jyPlaneTimer); if (this.jyPlayOff) this.jyPlayOff();
      this.jyPlayTimer = setTimeout(() => this.jyPlayEnd(t0), ({ fly:5600, leg:3900, walk:1900 })[mode] || 1900);
      const skip = () => this.jyPlayEnd(t0);
      const arm = setTimeout(() => { document.addEventListener('pointerdown', skip); document.addEventListener('keydown', skip); }, 450);
      this.jyPlayOff = () => { clearTimeout(arm); document.removeEventListener('pointerdown', skip); document.removeEventListener('keydown', skip); this.jyPlayOff = null; };
      if (mode === 'walk') return;
      // the trail draws for exactly the length of its path, so the plane and the red line stay together
      requestAnimationFrame(() => { try { const p = document.querySelector(mode === 'fly' ? '.jy-map .jy-arc.new' : '.jy-map .jy-leg'); if (p && p.getTotalLength) p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1); } catch (e) {} });
      this.jyPlaneTimer = setTimeout(() => { if (this.jyPlayAt === t0) this.jyPlane(mode, t0); }, mode === 'fly' ? 1000 : 700);
    };
    jyPlayEnd = (t0) => {
      if (t0 !== this.jyPlayAt) return;
      clearTimeout(this.jyPlayTimer); clearTimeout(this.jyPlaneTimer); if (this.jyPlayOff) this.jyPlayOff();
      if (this.state.jyPlay) this.setState({ jyPlay:'' });
    };
    // a plane glides along the new route with the same easing as the line that draws behind it
    jyPlane = (mode, t0) => {
      const svg = document.querySelector('.jy-map'); if (!svg) return;
      const path = svg.querySelector(mode === 'fly' ? '.jy-arc.new' : '.jy-leg');
      if (!path || !path.getTotalLength) return;
      const L = path.getTotalLength(); const dur = mode === 'fly' ? 2000 : 1200; const start = performance.now();
      const ease = (x) => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 18; i++) { t = (lo + hi) / 2; const bx = 3 * t * Math.pow(1 - t, 2) * .45 + 3 * t * t * (1 - t) * .3 + t * t * t; if (bx < x) lo = t; else hi = t; } return 3 * t * Math.pow(1 - t, 2) * .05 + 3 * t * t * (1 - t) * 1 + t * t * t; };
      const step = (now) => {
        const pl = document.querySelector('.jy-map .jy-plane');   // looked up each frame: the page may redraw while the plane flies
        if (!pl) return;
        if (this.jyPlayAt !== t0 || !this.state.jyPlay) { pl.setAttribute('opacity', '0'); return; }
        const k = Math.min(1, (now - start) / dur); const e = ease(k);
        const p = path.getPointAtLength(L * e), q = path.getPointAtLength(Math.min(L, L * e + 1.5));
        const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
        const sc = mode === 'fly' ? .8 + .5 * Math.sin(Math.PI * k) : 1;
        pl.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ') scale(' + sc.toFixed(2) + ')');
        pl.setAttribute('opacity', k < 1 ? '1' : '0');
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    // ---- onboarding ----
    onbSet = (p) => { prefSet('onb', Object.assign({}, onbRead(), p)); this.setState({ onbV:(this.state.onbV || 0) + 1 }); };
    onbSkipStart = () => this.onbSet({ s:'skip' });
    // the first session: five fixed words go into the learning phase, then Review runs them (introduction, a choice, then typing)
    onbStartPath = () => {
      const S = this.state;
      if (onbRead().s === 'go' && !S.rcomplete && S.rq.length) { this.onbSet({ w:Date.now() }); this.go('review'); return; }
      const lrn = Object.assign({}, S.lrn); const wl = Object.assign({}, S.wlearned);
      START_WORDS.forEach(z => { if (BANK[z] && !(S.ws[z].see.s > 0) && !lrn[z]) { lrn[z] = { st:-1, m:0, at:Date.now() }; wl[z] = true; } });
      this.setState(this.webCredit({ lrn, wlearned:wl, lrnNote:'' }));
      this.onbSet({ w:Date.now(), s:'go' });
      this.go('review'); this.reviewMore();
    };
    onbOpenGuide = () => { this.go('guide'); };
    // ---- the first-visit flow ----
    // intro pop-up -> the free first flight on the Journey -> five guide cards -> where to start -> name and friends (or stay a guest) -> Home with Start here
    obIntroGo = () => { this.onbSet({ p:'fly' }); this.go('journey'); };
    obFlySkip = () => this.onbSet({ p:'done', w:Date.now() });
    obBackOpen = () => this.setState({ obBack:true, frErr:'', frMsg:'' });
    obBackClose = () => this.setState({ obBack:false, frErr:'' });
    // back on a new device: the personal link from the first device (Friends > "Copy my link") brings the progress here
    obBackGo = async () => {
      await this.friendsSignInLink();
      if (FR && FR.identity && FR.identity()) { this.setState({ obBack:false }); this.onbSet({ p:'done', w:Date.now() }); this.go('home'); }
    };
    obBackFile = () => { try { const el = document.getElementById('import-file'); if (el) el.click(); } catch (e) {} };
    obCardGo = (d) => {
      const n = this.state.obCard + d;
      if (n < 0) return;
      if (n > 4) { this.onbSet({ p:'level' }); this.setState({ obCard:0 }); return; }
      this.setState({ obCard:n });
    };
    obGuideSkip = () => { this.onbSet({ p:'level' }); this.setState({ obCard:0 }); };
    obPickLvl = (k) => this.setState({ obLvl:k });
    obLevelGo = () => this.onbSet({ p:'me', l:this.state.obLvl === 'new' ? 'new' : 'some', ts:this.state.obLvl === 'test' ? 1 : 0 });   // test out: the name step comes first, then the check (the first-visit steps end when words are skipped)
    obMeBack = () => this.onbSet({ p:'level' });
    obJoinToggle = () => this.setState({ obJoin:!this.state.obJoin });
    obMeGo = async (guest) => {
      const S = this.state; if (S.obBusy) return;
      const name = String(S.obName || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      const join = !guest && S.obJoin && !!FR && FR.enabled() && !FR.identity();
      if (join && !name) { this.setState({ obErr:'Type your first name to join the group, or stay a guest.' }); return; }
      if (!guest && name) prefSet('name', name);
      this.setState({ mins:S.obGoal || S.mins, obErr:'' });
      if (join) {
        this.setState({ obBusy:true });
        try { await FR.join(name); await this.friendsPush({}); await this.friendsRefresh(true); }
        catch (e) { this.setState({ obBusy:false, obErr:((e && e.message) || 'Could not join the group.') + ' Try again, or stay a guest and join later from Friends.' }); return; }
        this.setState({ obBusy:false });
      }
      const test = !!onbRead().ts;
      this.onbSet({ p:'done', w:Date.now(), ts:0 });
      this.go('home');
      if (test) this.pcOpen('onb', 1);
    };
    obSoundsGo = () => { const l = (PYC.lessons || [])[0]; this.onbSet({ px:Date.now() }); if (l) this.pyOpenId(l.id); else this.go('pinyin'); };
    obSoundsLater = () => this.onbSet({ px:Date.now() });
    // ---- the level check ("test out", placement.js): pick the highest level you know, answer a short ladder of questions, start higher ----
    plData = () => ({ max:LVL.MAX_LEVEL, words:(n) => window['HSK' + n + '_WORDS'] || [], grammar:(n) => (window['HSK' + n + '_GRAMMAR'] || {}).lessons || [] });
    pcOpen = (from, claim) => {
      if (!window.ShanluPlacement) return;
      const c = claim || Math.max(1, ALL ? TOPL : LV);
      this.setState({ pcs:{ step:'claim', claim:Math.max(1, Math.min(LVL.MAX_LEVEL, c)), from:from || 'menu', run:null, py:false } });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    pcPick = (n) => { if (this.state.pcs) this.setState({ pcs:Object.assign({}, this.state.pcs, { claim:n }) }); };
    pcStart = () => {
      const p = this.state.pcs; if (!p || !window.ShanluPlacement) return;
      const run = window.ShanluPlacement.newRun(p.claim, this.plData());
      this.setState({ pcs:Object.assign({}, p, { step:run.done ? 'result' : 'ask', run }) });
    };
    pcAnswer = (i) => {
      const p = this.state.pcs; if (!p || p.step !== 'ask' || !p.run || p.run.done) return;
      window.ShanluPlacement.answer(p.run, i);
      this.setState({ pcs:Object.assign({}, p, { step:p.run.done ? 'result' : 'ask' }) });
    };
    pcPyToggle = () => { const p = this.state.pcs; if (p) this.setState({ pcs:Object.assign({}, p, { py:!p.py }) }); };
    pcCancel = () => this.setState({ pcs:null });
    // nothing passed: start at HSK 1. In the first-visit steps that person is most likely new to Chinese, so the "sounds of Chinese" card is offered
    pcStartLow = () => { const p = this.state.pcs; if (p && p.from === 'onb') this.onbSet({ l:'new' }); this.setState({ pcs:null }); };
    pcRetry = () => { const p = this.state.pcs; if (p) this.setState({ pcs:Object.assign({}, p, { step:'claim', run:null }) }); };
    // save the result: the words of the levels that passed go into those levels' own saves (as "probably known", 20 a day), the level opens,
    // and the page reloads on All levels so the skipped words can come back in Review
    pcApply = () => {
      const p = this.state.pcs; const PL = window.ShanluPlacement;
      if (!p || !p.run || !p.run.outcome || p.run.outcome.passedTop < 1 || !PL) { this.setState({ pcs:null }); return; }
      const out = p.run.outcome;
      this.persistNow();
      const plan = PL.seedPlan(p.run, this.plData(), Date.now());
      let probably = 0;
      Object.keys(plan).forEach(k => {
        const n = Number(k); const st = readStore(n) || {};
        const ws = Object.assign({}, st.ws || {});
        PL.applyPlan(ws, plan[k]);
        Object.keys(plan[k]).forEach(z => { if (plan[k][z].pk && ws[z] && ws[z].see && ws[z].see.pk) probably++; });
        st.ws = ws;
        lsSet(storeKey(n), JSON.stringify(st));
      });
      const placed = Math.max(LVL.placed(), out.passedTop);
      prefSet('placed', placed);
      const stay = ALL || LV >= out.placedAt;   // someone already at or past that level stays where they are
      const view = stay ? (ALL ? 0 : LV) : 0;
      if (view === 0 && !ALL) {   // All levels starts from the highest level's save: give that save the streak and settings (not the XP, which every save adds up on its own)
        const S0 = this.state; const st = readStore(out.placedAt) || {};
        ['streak', 'lastActive', 'activity', 'mins', 'nlimit', 'theme', 'sys', 'voiceId', 'speed', 'ascView'].forEach(k => { if (st[k] === undefined && S0[k] !== undefined) st[k] = S0[k]; });
        lsSet(storeKey(out.placedAt), JSON.stringify(st));
      }
      try { localStorage.setItem('shanlu-level', String(view)); localStorage.setItem('shanlu-rebase', '1'); localStorage.setItem('shanlu-placed-msg', JSON.stringify({ at:out.placedAt, top:out.passedTop, n:probably, perDay:PL.PER_DAY })); } catch (e) {}
      prefSet('level', view);
      this.frozen = true; clearTimeout(this.saveTimer);   // the leaving page must not write its old progress over the new words
      this.setState({ pcs:null });
      window.location.reload();
    };
    // a person who is new and has nothing yet starts on the Journey (with the intro pop-up) rather than Home
    onbBoot = () => {
      const S = this.state; const onb = onbRead();
      if (ONB_OFF() || LV !== 1 || onb.w || onb.p === 'done' || S.screen !== 'home' || totalXp(S) > 0) return;
      const started = Object.keys(S.ws || {}).some(z => S.ws[z] && S.ws[z].see && S.ws[z].see.s > 0);
      if (started || Object.keys(S.lrn || {}).length) return;
      this.go('journey');
    };
    onbFlight = () => { this.go('journey'); };
    jyCloseCard = () => this.setState({ jyRv:null, jyOpen:null });
    jyOpenStop = (id) => { SFX.play('ok'); this.setState({ jyOpen:id, jyRv:null }); try { window.scrollTo(0, 0); } catch (e) {} };
    jyShowReg = (id) => this.setState({ jyTab:'map', jyReg:id, jySel:null, jyFilter:'all', jyOpen:null, jyRv:null });
    jyBack = () => this.setState({ jyReg:null, jySel:null, jyFilter:'all' });
    jyTabSet = (t) => this.setState({ jyTab:t, jyFilter:'all', jyMoreN:40 });
    jyFilterSet = (f) => this.setState({ jyFilter:f, jySel:null, jyMoreN:40 });
    jySvFilterSet = (f) => this.setState({ jySvFilter:f, jySvSel:null });
    jySvPick = (id) => { SFX.play('ok'); this.setState({ jySvSel:id }); setTimeout(() => { try { const el = document.querySelector('.sv-detail'); if (el && el.scrollIntoView) el.scrollIntoView({ block:'nearest', behavior:'smooth' }); } catch (e) {} }, 40); };

    pcVals(S) {
      const p = S.pcs; const PL = window.ShanluPlacement; const MAX = LVL.MAX_LEVEL;
      const cum = []; let tot = 0; for (let n = 1; n <= MAX; n++) { tot += (window['HSK' + n + '_WORDS'] || []).length; cum[n] = Math.round(tot / 10) * 10; }
      const v = {
        pcShow:!!p, pcClaimShow:!!p && p.step === 'claim', pcAskShow:false, pcResultShow:false,
        pcClaims:Array.from({ length:MAX }, (_, i) => i + 1).map(n => ({ t:'HSK ' + n, d:n === 1 ? 'The first ' + cum[1].toLocaleString('en-US') + ' words' : 'HSK 1 to ' + n + ', about ' + cum[n].toLocaleString('en-US') + ' words in all', cls:'obm-opt' + (p && p.claim === n ? ' on' : ''), pressed:p && p.claim === n ? 'true' : 'false', fn:() => this.pcPick(n) })),
        pcStart:this.pcStart, pcCancel:this.pcCancel, pcRetry:this.pcRetry, pcCancelText:p && p.from === 'onb' ? 'Skip, start at HSK 1' : 'Not now',
        pcLabel:'', pcPctN:0, pcPct:'0%', pcIsWord:false, pcIsGrammar:false, pcZh:'', pcPy:'', pcPyOn:false, pcPyText:'', pcPyToggle:this.pcPyToggle, pcPrompt:'', pcOpts:[], pcDontKnow:() => this.pcAnswer(-1),
        pcResHead:'', pcResLead:'', pcResPlaced:false, pcResWords:'', pcResGo:this.pcCancel, pcResGoText:'', pcResRetry:false,
        pcOpenMenu:() => this.pcOpen('menu')
      };
      if (!p || !PL || !p.run) return v;
      if (p.step === 'ask' && !p.run.done) {
        const it = PL.current(p.run); const pr = PL.progress(p.run);
        if (it) Object.assign(v, {
          pcAskShow:true, pcLabel:pr.label + ' · ' + pr.n + ' of ' + pr.of, pcPctN:pr.pct, pcPct:pr.pct + '%',
          pcIsWord:it.k === 'v', pcIsGrammar:it.k === 'g', pcZh:it.zh || '', pcPy:it.py || '', pcPyOn:!!p.py, pcPyText:p.py ? 'Hide pinyin' : 'Show pinyin', pcPrompt:it.prompt || '',
          pcOpts:it.opts.map((o, i) => ({ t:o, cls:it.k === 'g' ? 'zh' : '', fn:() => this.pcAnswer(i) }))
        });
      }
      if (p.step === 'result' && p.run.outcome) {
        const o = p.run.outcome; const placed = o.passedTop >= 1;
        const range = o.passedTop > 1 ? 'HSK 1 to ' + o.passedTop : 'HSK 1';
        let words = 0; for (let n = 1; n <= o.passedTop; n++) words += (window['HSK' + n + '_WORDS'] || []).length;
        Object.assign(v, {
          pcResultShow:true, pcResPlaced:placed,
          pcResHead:placed ? (o.passedTop >= MAX ? 'You know every level here' : 'You are ready for HSK ' + o.placedAt) : 'Start at HSK 1',
          pcResLead:placed ? 'You passed the check for ' + range + (o.passedTop >= MAX ? ', the highest level on the site so far.' : ', so you can start at HSK ' + o.placedAt + '.') : 'We could not confirm a level this time. That is fine: HSK 1 starts from the first words, and you can run the check again any time from Settings.',
          pcResWords:'About ' + words.toLocaleString('en-US') + ' words are marked probably known. They come back in Review, ' + PL.PER_DAY + ' a day starting tomorrow, and one you miss goes back to learning. We open All levels so they show up.',
          pcResGo:placed ? this.pcApply : this.pcStartLow, pcResGoText:placed ? 'Start at HSK ' + o.placedAt : (p.from === 'onb' ? 'Start at HSK 1' : 'Close'), pcResRetry:!placed
        });
      }
      return v;
    }

    jyView(S) {
      const base = { isJourney:S.screen === 'journey', jySyncBad:!!S.syncBadMsg && !!(FR && FR.identity && FR.identity()), jySyncText:'This device could not sync with your other devices: ' + (S.syncBadMsg || '') + ' Open Friends and tap Sync now.', jyOff:false, jyOn:false, xpTotalText:totalXp(S).toLocaleString('en-US'), xpTip:'Your coins, from everything you study on every level. Spend them on the Journey.', goJourney:() => this.go('journey'), navJourney:'nav' + (S.screen === 'journey' ? ' on' : ''), xpPillCls:'pill xpp', jyPingShow:false, jyReadyShow:false, jyReadyN:0, jyReadyLabel:'' };
      if (!JWORLD || !JMAP) return Object.assign(base, { jyOff:S.screen === 'journey' });
      const st = jyRead() || JY.fresh();   // only read here;
      base.xpTotalText = coinBalance(S, st).toLocaleString('en-US');
      const xp = totalXp(S); const mt = JY.meter(xp, st); const bal = coinBalance(S, st); base.xpTotalText = bal.toLocaleString('en-US');
      const META = JY.META;
      const rName = (id) => (JWORLD.byRegion[id] ? JWORLD.byRegion[id].en : (META[id] ? META[id][1] : id));
      const R = st.reg ? JWORLD.byRegion[st.reg] : null;
      base.jyReadyShow = mt.ready > 0 && !!R; base.xpPillCls = 'pill xpp' + (mt.ready > 0 && R ? ' ready' : ''); base.jyPingShow = !!S.jyPing && S.screen !== 'journey' && !!R && mt.ready > 0; base.jyReadyN = mt.ready; base.jyReadyLabel = mt.ready + (mt.ready === 1 ? ' stop' : ' stops') + ' ready on the Journey';
      if (S.screen !== 'journey') return base;
      const have = {}; st.seen.forEach(id => { have[id] = 1; });
      const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
      const out = Object.assign(base, { jyOn:true, jyFlip:S.jyRv && S.jyRv.k ? 'kb' : 'ka', jyPlayCls:S.jyPlay ? 'jy-playing jyp-' + S.jyPlay + (S.jyPlayStamp ? ' jyp-st' : '') : '', jyPlayOn:!!S.jyPlay, jyPlayFly:S.jyPlay === 'fly', jyPlayLeg:S.jyPlay === 'leg' });

      // friends: the people in your group who have started travelling. Looking at one shows their map and passport in place of yours.
      const fMembers = S.fr && S.fr.members ? S.fr.members.filter(m => m.id !== S.fr.me && m.stats && m.stats.jy && m.stats.jy.n > 0) : [];
      const fm = S.jyFriend ? fMembers.find(m => m.id === S.jyFriend) : null;
      const vs = fm ? { done:fm.stats.jy.done || {}, reg:fm.stats.jy.here || null, started:!!fm.stats.jy.here } : st;   // the journey being looked at
      const stampCount = (j) => Object.keys(j.done || {}).filter(id => JWORLD.byRegion[id]).length;
      // where someone is now: the city of the stop they reached last (or just the region, if their device has not shared that yet)
      const hereOf = (j) => {
        const stop = j.at ? JWORLD.byStop[j.at] : null; const C = stop ? JWORLD.byCity[stop.cid] : null; const rid = stop ? stop.rid : (j.here && JWORLD.byRegion[j.here] ? j.here : '');
        if (!rid) return null;
        const place = C ? (C.muni ? C.en : C.en + ', ' + rName(rid)) : rName(rid);
        let xy = null; const mr = JMAP.regions[rid];
        if (C && C.lat != null && mr && mr.cd) xy = JY.projectCountry(C.lat, C.lon); else if (mr && mr.cc) xy = mr.cc;
        return { place, rid, stop:stop && stop.k !== 'P' && stop.k !== 'T' ? stop.en : '', xy };
      };
      const fWhere = (m) => hereOf(m.stats.jy);
      Object.assign(out, { jyMine:!fm, jyFriendMode:!!fm, jyFriendsShow:!fm && fMembers.length > 0,
        jyFriends:fMembers.map((m, i) => { const w = fWhere(m); return { name:m.name, initial:window.ShanluFriends.initial(m.name), cls:'c' + (i % 4), sub:(w ? 'Now in ' + w.place + (w.stop ? ' · at ' + w.stop : '') + ' · ' : '') + plural(m.stats.jy.n, 'stop', 'stops') + ' · ' + plural(stampCount(m.stats.jy), 'stamp', 'stamps'),
          open:() => { SFX.play('ok'); this.setState({ jyFriend:m.id, jyTab:'map', jyReg:null, jySel:null, jyOpen:null, jyRv:null }); try { window.scrollTo(0, 0); } catch (e) {} } }; }),
        jyFriendBack:() => this.setState({ jyFriend:null, jyTab:'map' }), jyDots:[], jyHasDots:false });
      // everyone's place on the country map (you and your friends), spread out a little where several are in the same city
      if (!fm) {
        const raw = [];
        const me = st.started && st.seen.length ? hereOf({ here:st.reg, at:st.seen[st.seen.length - 1] }) : null;
        if (me && me.xy) raw.push({ w:me, name:'You', initial:'You', cls:'me', open:() => this.jyShowReg(st.reg) });
        fMembers.forEach((m, i) => { const w = fWhere(m); if (w && w.xy) raw.push({ w, name:m.name, initial:window.ShanluFriends.initial(m.name), cls:'c' + (i % 4), open:() => this.setState({ jyFriend:m.id, jyTab:'map', jyReg:null, jySel:null, jyOpen:null, jyRv:null }) }); });
        const groups = {}; raw.forEach(r => { const k = Math.round(r.w.xy[0] / 9) + ',' + Math.round(r.w.xy[1] / 9); (groups[k] = groups[k] || []).push(r); });
        const dots = [];
        Object.keys(groups).forEach(k => { const g = groups[k]; g.forEach((r, j) => { const a = g.length > 1 ? j * 2 * Math.PI / g.length - Math.PI / 2 : 0; const rad = g.length > 1 ? 8 : 0; dots.push({ x:Math.round((r.w.xy[0] + Math.cos(a) * rad) * 10) / 10, y:Math.round((r.w.xy[1] + Math.sin(a) * rad) * 10) / 10, initial:r.initial === 'You' ? '我' : r.initial, cls:r.cls, label:(r.name === 'You' ? 'You are' : r.name + ' is') + ' in ' + r.w.place, open:r.open }); }); });
        out.jyHasDots = dots.length > 1 || (dots.length === 1 && fMembers.length > 0); out.jyDots = out.jyHasDots ? dots : [];
      }
      if (fm) { const fw = fWhere(fm); Object.assign(out, { jyFriendName:fm.name, jyFriendSub:(fw ? 'Now in ' + fw.place + ' · ' : '') + plural(fm.stats.jy.n, 'stop', 'stops') + ' · ' + stampCount(fm.stats.jy) + ' of ' + Object.keys(JY.META).length + ' regions stamped' }); }

      // where you are and the XP bar
      const done = !R;
      if (done) { Object.assign(out, { jyNowLabel:'Every region stamped', jyNowZh:'完', jyNowEn:'The whole map is yours', jyNowSub:'You finished the Journey. More stops can be added later.' }); }
      else if (!st.started) Object.assign(out, { jyNowLabel:'Next flight', jyNowZh:R.zh, jyNowEn:R.en, jyNowSub:'Fly in to ' + (R.air ? R.air.en + (R.air.code ? '' : '') : R.cities[0].en) + '.' });
      else {
        const rs = JY.regionStats(JWORLD, st, R.id); const C = st.cur && JWORLD.byCity[st.cur];
        Object.assign(out, { jyNowLabel:'Exploring', jyNowZh:R.zh, jyNowEn:R.en, jyNowSub:rs.got + ' of ' + rs.total + ' stops' + (C ? ' · now in ' + C.en : '') });
      }
      // a picture of the region you are in (or about to fly to) on top of the card: the same province photo its airport stop shows
      { const a0 = R ? (R.cities[0].air || R.cities[0].first) : null; const hero = a0 && JMEDIA[a0.id] && JMEDIA[a0.id].u ? JMEDIA[a0.id] : null;
        Object.assign(out, { jyHeroShow:!!hero, jyHeroUrl:hero ? hero.u : '', jyHeroAlt:hero ? (hero.a || R.en) : '', jyHeroCredit:hero ? hero.c : '' }); }
      // three lines about a region: on its airport card, and under its map
      const introOf = (RR) => (RR && RR.intro && RR.intro.length === 3 ? [{ k:'The land', t:RR.intro[0] }, { k:'The table', t:RR.intro[1] }, { k:'Good to know', t:RR.intro[2] }] : []);
      out.jyPct = (done ? 100 : mt.pct) + '%'; out.jyPctNum = done ? 100 : mt.pct;
      out.jyMeterCls = 'jy-meter' + (mt.ready > 0 && !done ? ' ready' : ''); out.jyMeterText = done ? 'Journey complete' : mt.ready > 0 ? plural(mt.ready, 'stop', 'stops') + ' ready' : mt.into + ' of ' + mt.nextCost + ' coins for the next stop';
      out.jyXpTotal = bal.toLocaleString('en-US') + ' coins to spend · ' + xp.toLocaleString('en-US') + ' earned in total';
      out.jyGoOff = done || mt.ready < 1; out.jyGoText = done ? 'All done' : mt.ready > 0 ? (st.n === 0 ? 'Take your first flight (free)' : st.started ? 'Travel to the next stop' : 'Board the flight') : mt.toGo + ' more coins to go';
      out.jyTravel = this.jyTravel;

      // the tint follows the region on screen: the one being looked at, else the one you are in
      const focusId = fm ? null : (S.jyReg || st.reg);
      out.jyHue = focusId && META[focusId] ? (JWORLD.byRegion[focusId] ? JWORLD.byRegion[focusId].hue : META[focusId][2]) : 205;

      // the card: a stop just unlocked, or one opened from the map or the list
      const rv = fm ? null : S.jyRv; const cardId = fm ? null : (rv ? rv.id : S.jyOpen); const stop = cardId ? JWORLD.byStop[cardId] : null;
      out.jyCardShow = !!stop;
      if (stop) {
        const CR = JWORLD.byRegion[stop.rid], CC = JWORLD.byCity[stop.cid];
        const banners = [];
        if (rv) {
          const ev = rv.ev;
          if (ev.indexOf('arrive') >= 0) banners.push({ t:'Welcome to ' + CR.en + '!', d:st.n === 1 ? 'Your first flight is on the house. From here on, each new stop costs coins, and studying earns them.' : 'You have landed. Your journey here begins at the airport.' });
          if (ev.indexOf('city') >= 0 && ev.indexOf('arrive') < 0) banners.push({ t:'New city: ' + CC.en, d:'Its stops will unlock one by one.' });
          if (ev.indexOf('muni') >= 0) banners.push({ t:CC.muni + ' is its own municipality.', d:(CR.munis && CR.munis[CC.muni]) || (CC.muni + ' is a municipality of its own, not part of ' + CR.en + '.') });
          if (ev.indexOf('citydone') >= 0 && ev.indexOf('stamp') < 0) banners.push({ t:CC.en + ' complete!', d:'You have seen every stop here. Its city stamp is in your passport.' });
          if (ev.indexOf('stamp') >= 0) banners.push({ t:CR.en + ' complete!', d:'Your passport is stamped.' + (rv.next ? ' Next flight: ' + rName(rv.next) + '.' : '') });
          if (ev.indexOf('all') >= 0) banners.push({ t:'Every region stamped!', d:'You have been everywhere. Well travelled.' });
        }
        Object.assign(out, { jyBanners:banners, jyBannerShow:banners.length > 0, jyStampShow:!!rv && rv.ev.indexOf('stamp') >= 0, jyKindCls:'k' + stop.k + (stop.sp ? ' sp' : ''),
          jyIsT:stop.k === 'T', jyIsA:stop.k === 'A', jyIsD:stop.k === 'D', jyIsC:stop.k === 'C', jyIsP:stop.k === 'P', jyKindLabel:(stop.sp ? '★ Must-see · ' : '') + stop.kind, jyPlace:CR.en + ' · ' + CC.en + (CC.muni ? ' (' + CC.muni + ' municipality)' : ''), jyCardZh:stop.zh, jyCardPy:stop.py, jyCardEn:stop.en, jyCardNote:stop.note, jyHasFun:!!stop.fun, jyCardFun:stop.fun,
          jyHasWords:stop.k === 'P', jyWords:'机场 jīchǎng airport · 护照 hùzhào passport · 登机牌 dēngjīpái boarding pass · 行李 xíngli luggage',
          jySay:() => this.say(stop.zh, 'jy:' + stop.id), jyCloseCard:this.jyCloseCard, jyCloseText:rv ? 'Keep exploring' : 'Close',
          jyMapBtn:!!JMAP.regions[stop.rid], jyOnMap:() => this.setState({ jyTab:'map', jyReg:stop.rid, jySel:[stop.id], jyFilter:'all', jyRv:null, jyOpen:null }) });
        // how you got here: a boarding pass, a ticket between two cities, or a walk (only on a stop just reached)
        const hp = rv ? JY.hop(JWORLD, st, rv.from, stop.id, rv.ev) : null;
        const kmT = (n) => n.toLocaleString('en-US');
        out.jyTkFly = !!hp && hp.mode === 'fly'; out.jyTkRide = !!hp && hp.mode === 'ride'; out.jyTkWalk = !!hp && hp.mode === 'walk';
        if (hp && hp.mode === 'fly') Object.assign(out, { jyTkFromCode:hp.from ? hp.from.code || '···' : '家', jyTkFromZh:hp.from ? hp.from.zh : '', jyTkFromPy:hp.from ? hp.from.py : 'jiā · home',
          jyTkToCode:hp.to.code || '···', jyTkToZh:hp.to.zh, jyTkToPy:hp.to.py, jyTkToEn:hp.to.en, jyTkNo:'SL ' + String(hp.no).padStart(3, '0'), jyTkDate:hp.date,
          jyTkHasKm:hp.km > 0, jyTkKm:'约 ' + kmT(hp.km) + ' 公里', jyTkKmEn:'about ' + kmT(hp.km) + ' km',
          jyTkLabel:'Boarding pass: ' + (hp.from ? hp.from.en : 'home') + ' to ' + hp.to.en + (hp.km ? ', about ' + kmT(hp.km) + ' km' : '') });
        if (hp && hp.mode === 'ride') Object.assign(out, { jyTkFromZh:hp.from.zh, jyTkFromPy:hp.from.py, jyTkFromEn:hp.from.en, jyTkToZh:hp.to.zh, jyTkToPy:hp.to.py, jyTkToEn:hp.to.en, jyTkNo:'第 ' + hp.no + ' 站', jyTkNoEn:'Stop ' + hp.no,
          jyTkHasKm:hp.km > 0, jyTkKm:(hp.dir ? '往' + hp.dir[0] + '，' : '') + '约 ' + kmT(hp.km) + ' 公里', jyTkKmPy:(hp.dir ? 'wǎng ' + hp.dir[1] + ', ' : '') + 'yuē ' + kmT(hp.km) + ' gōnglǐ', jyTkKmEn:'about ' + kmT(hp.km) + ' km' + (hp.dir ? ' to the ' + hp.dir[2] : '') + ', in a straight line',
          jyTkLabel:'Ticket: ' + hp.from.en + ' to ' + hp.to.en + (hp.km ? ', about ' + kmT(hp.km) + ' km' : '') });
        if (hp && hp.mode === 'walk') Object.assign(out, { jyTkWalkText:'On foot in ' + hp.to.en, jyTkWalkN:'stop ' + hp.inCity + ' of ' + hp.ofCity + ' here' });
        // a souvenir hidden in this stop: it appears the moment the stop is unlocked, and again whenever the stop is opened
        const sv = SV_BY_STOP[stop.id] && have[stop.id] ? SV_BY_STOP[stop.id] : null;
        out.jySvCardShow = !!sv;
        if (sv) Object.assign(out, { jySvCardCls:rv ? 'new' : '', jySvCardTitle:rv ? 'You found a souvenir!' : 'A souvenir was hidden here', jySvCardImg:svImg(sv), jySvCardZh:sv.zh, jySvCardPy:sv.py, jySvCardEn:sv.en, jySvCardStory:sv.story,
          jySvCardShelf:() => { SFX.play('ok'); this.setState({ jyTab:'shelf', jySvSel:sv.id, jySvFilter:'all', jyRv:null, jyOpen:null, jyFilter:'all' }); try { window.scrollTo(0, 0); } catch (e) {} } });
        // a sentence to say at this stop
        const sy = JY.sayFor(stop);
        Object.assign(out, { jySayTag:sy.tag, jySayZh:sy.zh, jySayPy:sy.py, jySayEn:sy.en, jySayIt:() => this.say(sy.zh, 'jysay:' + stop.id) });
        // stamps earned by this stop: the city is finished, or the stop is a must-see
        const cityDone = !!rv && rv.ev.indexOf('citydone') >= 0 && rv.ev.indexOf('stamp') < 0;
        Object.assign(out, { jyCityStampShow:cityDone, jyCityStampZh:CC.zh, jyCityStampCls:CC.zh.length > 4 ? 'long' : CC.zh.length === 4 ? 'l4' : '', jyCityStampEn:CC.en, jyCityStampHue:CR.hue, jyStarNote:!!rv && stop.sp });
        const intro = stop.k === 'P' ? introOf(CR) : [];
        Object.assign(out, { jyIntroShow:intro.length > 0, jyIntro:intro, jyIntroTitle:CR.en + ' in three lines', jyIntroCount:plural(CR.cities.length, 'city', 'cities') + ' · ' + CR.stops.length + ' stops · ' + plural(CR.stops.filter(x => x.sp).length, 'must-see', 'must-sees') + ' to find' });
        // a finished region: an album of its pictures, the must-sees first
        const stamped = !!rv && rv.ev.indexOf('stamp') >= 0;
        const pics = stamped ? CR.stops.filter(x => x.k !== 'P' && JMEDIA[x.id] && JMEDIA[x.id].u).sort((a, b) => (b.sp ? 1 : 0) - (a.sp ? 1 : 0)).slice(0, 6) : [];
        Object.assign(out, { jyAlbumShow:pics.length >= 3, jyAlbum:pics.map(x => ({ url:JMEDIA[x.id].u, alt:x.en })), jyAlbumTitle:'Your ' + CR.en + ' album' });
        const ph = JMEDIA[stop.id];
        out.jyHasPhoto = !!(ph && ph.u); out.jyNoPhoto = !out.jyHasPhoto; out.jyPhotoUrl = ph ? ph.u : ''; out.jyPhotoAlt = ph && ph.a ? ph.a : stop.en; out.jyPhotoCredit = ph ? ph.c : '';
        // the airport card already shows the province picture: don't show the same one twice
        if (out.jyHeroShow && out.jyPhotoUrl === out.jyHeroUrl) out.jyHeroShow = false;
        if (rv && rv.ev.indexOf('stamp') >= 0) {
          Object.assign(out, { jyStampHue:CR.hue, jyStampZh:CR.zh, jyStampEn:CR.en, jyStampCode:CR.air && CR.air.code ? CR.air.code : '', jyStampDate:st.done[CR.id] || '' });
        }
      }

      // tabs
      const tabNow = fm && (S.jyTab === 'stops' || S.jyTab === 'food' || S.jyTab === 'shelf') ? 'map' : S.jyTab;
      out.jyTabs = (fm ? [['map', 'Map'], ['pass', 'Passport']] : [['map', 'Map'], ['stops', 'Postcards'], ['food', 'Food'], ['pass', 'Passport'], ['shelf', 'Shelf']]).map(t => ({ label:t[1], cls:tabNow === t[0] ? 'on' : '', fn:() => this.jyTabSet(t[0]) }));
      out.jyIsMap = tabNow === 'map'; out.jyIsStops = tabNow === 'stops'; out.jyIsFood = tabNow === 'food'; out.jyIsPass = tabNow === 'pass'; out.jyIsShelf = tabNow === 'shelf';
      // the souvenir shelf (your own journey only): found when the stop that hides it is unlocked; the rest show as dark shapes with their region
      if (tabNow === 'shelf' && !fm) {
        const list = SOUV.filter(x => JWORLD.byStop[x.stop]); const got = list.filter(x => have[x.stop]); const fl = S.jySvFilter || 'all';
        const sel = S.jySvSel ? list.find(x => x.id === S.jySvSel) : null;
        out.jySvSub = got.length + ' of ' + list.length + ' found';
        out.jySvChips = [['all', 'All', list.length], ['found', 'Found', got.length], ['hidden', 'Hidden', list.length - got.length]].map(c => ({ label:c[1], count:c[2], cls:fl === c[0] ? 'on' : '', fn:() => this.jySvFilterSet(c[0]) }));
        const shown = list.filter(x => fl === 'all' || (fl === 'found') === !!have[x.stop]);
        out.jySvItems = shown.map(x => { const has = !!have[x.stop]; const RR = JWORLD.byRegion[x.rid];
          return { cls:(has ? 'got' : 'hid') + (sel && sel.id === x.id ? ' sel' : ''), img:svImg(x), name:has ? x.en : 'Hidden', zh:has ? x.zh : '?', label:has ? x.en + ', found' : 'A hidden souvenir in ' + (RR ? RR.en : 'China'), open:() => this.jySvPick(x.id) }; });
        out.jySvNone = shown.length === 0; out.jySvNoneText = fl === 'found' ? 'Nothing here yet. Travel on: each region hides a few souvenirs in its stops.' : 'You have found them all.';
        out.jySvSelShow = !!sel;
        if (sel) { const has = !!have[sel.stop]; const RR = JWORLD.byRegion[sel.rid]; const SP = JWORLD.byStop[sel.stop];
          Object.assign(out, { jySvSelCls:has ? 'got' : 'hid', jySvSelImg:svImg(sel), jySvSelZh:has ? sel.zh : '？', jySvSelPy:has ? sel.py : '', jySvSelEn:has ? sel.en : 'A hidden souvenir',
            jySvSelStory:has ? sel.story : 'Hidden in a stop somewhere in ' + (RR ? RR.en : 'China') + '. Keep travelling there to find it.', jySvSelFound:has, jySvSelWhere:has ? 'Found at ' + SP.en + ' · ' + (RR ? RR.en : '') : '',
            jySvSelGo:() => this.jyOpenStop(sel.stop), jySvSelClose:() => this.setState({ jySvSel:null }), jySvSelLabel:has ? sel.en + ', ' + sel.story : 'A hidden souvenir in ' + (RR ? RR.en : 'China') }); }
      }
      const FILT = [['all', 'All'], ['S', '★ Must-see'], ['T', 'Cities'], ['A', 'Attractions'], ['D', 'Dishes'], ['C', 'Culture'], ['P', 'Airports']];
      const filterChips = (stopsSeen) => FILT.map(f => ({ label:f[1], count:f[0] === 'all' ? stopsSeen.length : stopsSeen.filter(s => f[0] === 'S' ? s.sp : s.k === f[0]).length, cls:S.jyFilter === f[0] ? 'on' : '', fn:() => this.jyFilterSet(f[0]) }));
      const pass = (s) => S.jyFilter === 'all' || (S.jyFilter === 'S' ? s.sp : s.k === S.jyFilter);
      const rowOf = (s, cls) => ({ kind:(s.sp ? '★ ' : '') + ({ T:'City', A:'Sight', D:'Dish', C:'Culture', P:'Airport' })[s.k], zh:s.zh, en:s.en, where:JWORLD.byRegion[s.rid].en + ' · ' + JWORLD.byCity[s.cid].en, cls:(cls || '') + (s.sp ? ' sp' : ''), open:() => this.jyOpenStop(s.id) });

      // map: the whole map, or one region with its pins
      out.jyCountry = !!fm || !S.jyReg || !JMAP.regions[S.jyReg]; out.jyProv = !out.jyCountry;
      if (out.jyCountry) {
        const regs = Object.keys(JMAP.regions);
        const status = (id) => vs.done[id] ? 'done' : (vs.reg === id && vs.started ? 'here' : (vs.reg === id && !fm ? 'next' : 'none'));
        const mk = (id) => {
          const has = !!JWORLD.byRegion[id]; const m = JMAP.regions[id]; const en = rName(id); const stt = has ? status(id) : 'none';
          const hue = has ? JWORLD.byRegion[id].hue : META[id][2];
          const word = stt === 'done' ? 'stamped' : stt === 'here' ? (fm ? 'there now' : 'you are here') : stt === 'next' ? 'next flight' : has ? 'not visited yet' : 'coming soon';
          return { id, cls:stt + (has ? '' : ' na') + (JY.SMALL.indexOf(id) >= 0 && id !== 'singapore' ? ' tiny' : ''), hue, d:m.cd || '', m:m.cm || '', hasM:!!m.cm, label:en + ', ' + word, en, open:has && !fm ? () => this.jyShowReg(id) : () => {} };
        };
        out.jyMapRegions = regs.filter(id => JMAP.regions[id].cd && id !== 'singapore').map(mk);
        // the flights so far: an arc from each region to the next one flown to (the newest one draws itself)
        out.jyArcs = [];
        if (!fm) {
          const airXY = (rid) => { const RR = JWORLD.byRegion[rid]; const a = RR && (RR.cities[0].air || RR.cities[0].first); if (!a) return null; const xy = JY.projectCountry(a.lat, a.lon); return [Math.max(4, Math.min(346, xy[0])), Math.max(4, Math.min(286, xy[1]))]; };
          const rr = JY.regionRoute(JWORLD, st);
          for (let i = 1; i < rr.length; i++) {
            const a = airXY(rr[i - 1]), b = airXY(rr[i]); if (!a || !b) continue;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 2) continue;
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.min(34, len * 0.28);
            const r1 = (n) => Math.round(n * 10) / 10;
            out.jyArcs.push({ d:'M' + r1(a[0]) + ' ' + r1(a[1]) + ' Q' + r1(mx) + ' ' + r1(my) + ' ' + r1(b[0]) + ' ' + r1(b[1]), len:Math.ceil(len * 1.25), cls:rv && rv.ev.indexOf('arrive') >= 0 && i === rr.length - 1 ? 'new' : '' });
          }
        }
        out.jyCHereShow = false;
        if (!fm && vs.started && vs.seen && vs.seen.length) { const ls = JWORLD.byStop[vs.seen[vs.seen.length - 1]]; const lc = ls && JWORLD.byCity[ls.cid]; if (lc) { const xy = JY.projectCountry(lc.lat, lc.lon); out.jyCHereShow = true; out.jyCHereX = Math.round(Math.max(6, Math.min(344, xy[0])) * 10) / 10; out.jyCHereY = Math.round(Math.max(6, Math.min(284, xy[1])) * 10) / 10; } }
        out.jySmall = JY.SMALL.map(id => Object.assign(mk(id), { d:JMAP.insets[id] || '' }));
      } else {
        const id = S.jyReg; const RR = JWORLD.byRegion[id]; const mp = JMAP.regions[id];
        const seenHere = RR.stops.filter(s => have[s.id]);
        Object.assign(out, { jyProvZh:RR.zh, jyProvEn:RR.en, jyProvCount:st.done[id] ? 'Stamped · ' + seenHere.length + ' stops' : seenHere.length + ' of ' + RR.stops.length + ' stops', jyBack:this.jyBack,
          jyProvD:mp.d, jyProvM:mp.m || '', jyProvHasM:!!mp.m, jyProvLabel:'Map of ' + RR.en + ' with ' + plural(seenHere.length, 'stop', 'stops') + ' found so far', jyFilters:filterChips(seenHere) });
        out.jyProvIntro = introOf(RR); out.jyProvIntroShow = out.jyProvIntro.length > 0;
        // pins: place each seen stop, then merge the ones that touch
        const pts = seenHere.filter(pass).map(s => { const ll = JY.pinLatLon(JWORLD, s); const xy = JY.project(mp, ll[0], ll[1]); return { s, x:xy[0], y:xy[1] }; });
        const groups = [];
        pts.forEach(p => { const g = groups.find(q => Math.hypot(q.x - p.x, q.y - p.y) < 11); if (g) { g.items.push(p); g.x = g.items.reduce((a, b) => a + b.x, 0) / g.items.length; g.y = g.items.reduce((a, b) => a + b.y, 0) / g.items.length; } else groups.push({ x:p.x, y:p.y, items:[p] }); });
        const sel = S.jySel || [];
        out.jyPins = groups.map(g => {
          const ids = g.items.map(i => i.s.id); const one = g.items.length === 1; const s = g.items[0].s;
          const x = Math.round(Math.max(8, Math.min(352, g.x)) * 10) / 10, y = Math.round(Math.max(8, Math.min(292, g.y)) * 10) / 10;
          return { x, y, isCluster:!one, count:g.items.length, isCity:one && s.k === 'T', isAttr:one && s.k === 'A', isDish:one && s.k === 'D', isCult:one && s.k === 'C', isAir:one && s.k === 'P',
            cls:(one ? 'k' + s.k + (s.sp ? ' sp' : '') : 'kx' + (g.items.some(i => i.s.sp) ? ' sp' : '')) + (ids.some(i => sel.indexOf(i) >= 0) ? ' sel' : ''), label:one ? s.kind + ': ' + s.en : plural(g.items.length, 'stop', 'stops') + ' close together',
            tap:one ? () => this.jyOpenStop(s.id) : () => this.setState({ jySel:ids }) };
        });
        // the route so far: a line through the cities in the order you reached them; the newest leg draws itself and a dot rides along it
        {
          const r1 = (n) => Math.round(n * 10) / 10;
          const cxy = (cid) => { const C = JWORLD.byCity[cid]; const xy = JY.project(mp, C.lat, C.lon); return [r1(Math.max(8, Math.min(352, xy[0]))), r1(Math.max(8, Math.min(292, xy[1])))]; };
          const cr = JY.cityRoute(JWORLD, st, id).filter(c => JWORLD.byCity[c]).map(cxy);
          out.jyRouteShow = cr.length > 1; out.jyRouteD = cr.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
          const newLeg = !!rv && rv.ev.indexOf('city') >= 0 && rv.ev.indexOf('arrive') < 0 && JWORLD.byStop[rv.id] && JWORLD.byStop[rv.id].rid === id && cr.length > 1;
          out.jyLegShow = newLeg;
          if (newLeg) { const a = cr[cr.length - 2], b = cr[cr.length - 1]; Object.assign(out, { jyLegD:'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1], jyLegLen:Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1, jyLegX1:a[0], jyLegY1:a[1], jyLegX2:b[0], jyLegY2:b[1] }); }
          const last = st.reg === id && st.started && st.seen.length ? JWORLD.byStop[st.seen[st.seen.length - 1]] : null;
          out.jyHereShow = !!last && last.rid === id;
          if (out.jyHereShow) { const p = cxy(last.cid); out.jyHereX = p[0]; out.jyHereY = p[1]; }
        }
        const selStops = sel.map(i => JWORLD.byStop[i]).filter(Boolean);
        out.jySelShow = selStops.length > 1 || (selStops.length === 1 && !S.jyOpen && !S.jyRv); out.jySelRows = selStops.map(s => rowOf(s));
        out.jyProvKey = seenHere.length ? 'Square: city · triangle: sight · circle: dish · diamond: culture · plane: airport · gold ring: a must-see. The dotted line is your route and the ripple is where you are. A numbered circle is several stops close together: tap it.' : 'Nothing here yet. Stops show up on the map as you unlock them.';
      }

      // stops: everything unlocked, newest first
      {
        const all = st.seen.slice().reverse().map(i => JWORLD.byStop[i]).filter(Boolean);
        const shown = all.filter(pass);
        out.jyFilters = out.jyFilters || filterChips(all);
        if (S.jyTab === 'stops') out.jyFilters = filterChips(all);
        // every stop you have reached is a postcard: its photo (or its name, where there is no photo yet), gold for a must-see
        const KN = { T:'City', A:'Sight', D:'Dish', C:'Culture', P:'Airport' };
        out.jyCards = S.jyTab === 'stops' ? shown.slice(0, S.jyMoreN).map(s => { const ph = JMEDIA[s.id]; const has = !!(ph && ph.u); const RR = JWORLD.byRegion[s.rid];
          return { kind:(s.sp ? '★ ' : '') + KN[s.k], zh:s.zh, en:s.en, where:JWORLD.byCity[s.cid].en + ' · ' + RR.en, hue:RR.hue, cls:'k' + s.k + (s.sp ? ' sp' : '') + (s.zh.length > 6 ? ' long' : ''), hasPhoto:has, noPhoto:!has, url:has ? ph.u : '', label:'Postcard: ' + s.en + ', ' + JWORLD.byCity[s.cid].en + (s.sp ? ', a must-see' : ''), open:() => this.jyOpenStop(s.id) }; }) : [];
        out.jyMoreShow = shown.length > S.jyMoreN; out.jyMore = () => this.setState({ jyMoreN:S.jyMoreN + 40 });
        out.jyStopsNote = all.length ? plural(shown.length, 'postcard', 'postcards') + (S.jyFilter === 'all' ? ', newest first. Tap one to read it again.' : ' of this kind, newest first.') : 'No postcards yet. Every stop you reach sends one here.';
      }

      // food diary: everything from the dish lists that you have found, written up as one menu per city (the newest city first)
      {
        const order = [], byC = {};
        st.seen.forEach(i => { const s = JWORLD.byStop[i]; if (!s || s.k !== 'D') return; if (!byC[s.cid]) { byC[s.cid] = []; order.push(s.cid); } byC[s.cid].push(s); });
        const G = [['菜', 'cài', 'Dishes', ['dish', 'near']], ['饮料', 'yǐnliào', 'Drinks', ['drink']], ['特产', 'tèchǎn', 'Local specialties', ['buy', 'ask']]];
        const tally = [0, 0, 0];
        const tables = order.slice().reverse().map(cid => {
          const C = JWORLD.byCity[cid], mine = byC[cid], total = C.stops.filter(x => x.k === 'D').length;
          const groups = G.map((g, gi) => { const items = mine.filter(x => g[3].indexOf(JY.sayKind(x)) >= 0); tally[gi] += items.length;
            return { zh:g[0], py:g[1], en:g[2], items:items.map(x => ({ zh:x.zh, py:x.py, en:x.en, cls:x.sp ? 'sp' : '', label:x.en + (x.sp ? ', a must-see' : ''), open:() => this.jyOpenStop(x.id) })) }; }).filter(g => g.items.length);
          return { zh:C.zh, py:C.py, en:C.en, hue:JWORLD.byRegion[C.rid].hue, sub:mine.length === total ? 'All ' + total + ' found' : mine.length + ' of ' + total + ' found', groups };
        });
        out.jyTables = S.jyTab === 'food' ? tables : []; out.jyFoodNone = tables.length === 0;
        out.jyFoodSub = tables.length ? plural(tally[0], 'dish', 'dishes') + ' · ' + plural(tally[1], 'drink', 'drinks') + ' · ' + plural(tally[2], 'local specialty', 'local specialties') + ', in ' + plural(tables.length, 'city', 'cities') : 'Nothing on your table yet. Every dish you find on your travels is written down here, one menu per city.';
      }

      // passport: stamped regions first (in the order earned), then the one you are in, then the rest
      {
        const ids = Object.keys(META).filter(id => JMAP.regions[id]);
        const rank = (id) => (vs.done[id] ? '0' + vs.done[id] : (vs.reg === id && vs.started ? '1' : (JWORLD.byRegion[id] ? '2' : '3')) + rName(id));
        const sorted = ids.slice().sort((a, b) => (rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0));
        const stamped = ids.filter(id => vs.done[id]).length;
        out.jyPassTitle = fm ? fm.name + '\'s passport' : 'Passport'; out.jyPassSub = stamped + ' of ' + ids.length + ' regions stamped';
        // the regions not visited yet stay folded away, so the passport shows what you have, not a wall of blanks
        const blank = sorted.filter(id => !vs.done[id] && !(vs.reg === id && vs.started)).length;
        const showAll = !!S.jyPassAll || blank === sorted.length;
        out.jyPassMoreShow = blank > 0 && blank < sorted.length; out.jyPassMoreText = S.jyPassAll ? 'Hide the regions still to visit' : 'Show the ' + plural(blank, 'region', 'regions') + ' still to visit';
        out.jyPassMore = () => this.setState({ jyPassAll:!S.jyPassAll });
        out.jyPassExtra = !fm;
        if (!fm) {
          const cs = JY.cityStamps(JWORLD, st).reverse(); const nCities = Object.keys(JWORLD.byCity).length;
          const curC = st.started && st.cur && JWORLD.byCity[st.cur] && !cs.some(c => c.cid === st.cur) ? JWORLD.byCity[st.cur] : null;
          out.jyCityStamps = (curC ? [{ C:curC, here:true }] : []).concat(cs.map(c => ({ C:JWORLD.byCity[c.cid], here:false }))).map(o => {
            const got = o.C.stops.filter(x => have[x.id]).length;
            return { zh:o.C.zh, en:o.C.en, hue:JWORLD.byRegion[o.C.rid].hue, cls:(o.here ? 'here' : 'got') + (o.C.zh.length > 4 ? ' long' : o.C.zh.length === 4 ? ' l4' : ''), sub:o.here ? got + ' / ' + o.C.stops.length : '', label:o.C.en + (o.here ? ', ' + got + ' of ' + o.C.stops.length + ' stops seen' : ', city stamp'), open:() => this.jyShowReg(o.C.rid) };
          });
          out.jyCityNone = out.jyCityStamps.length === 0; out.jyCitySub = cs.length + ' of ' + nCities + ' cities · see every stop in a city to earn its stamp';
          const ms = JY.mustSeen(JWORLD, st).reverse(); const nStar = Object.keys(JWORLD.byStop).filter(k => JWORLD.byStop[k].sp).length;
          out.jyStarStamps = ms.map(x => ({ zh:x.zh, en:x.en, label:'Must-see: ' + x.en, open:() => this.jyOpenStop(x.id) }));
          out.jyStarNone = ms.length === 0; out.jyStarSub = ms.length + ' of ' + nStar + ' must-sees · the best of each region';
          out.jyPassSub += ' · ' + plural(cs.length, 'city stamp', 'city stamps') + ' · ' + plural(ms.length, 'must-see', 'must-sees');
        }
        out.jyStamps = sorted.filter(id => showAll || vs.done[id] || (vs.reg === id && vs.started)).map(id => {
          const has = !!JWORLD.byRegion[id]; const RR = JWORLD.byRegion[id]; const got = !!vs.done[id]; const here = !got && vs.reg === id && vs.started;
          return { hue:has ? RR.hue : META[id][2], cls:got ? 'got' : here ? 'here' : 'empty', zh:got || here ? (has ? RR.zh : META[id][0]) : '?', en:got || here ? rName(id) : 'Not yet', code:got || here ? (has && RR.air ? RR.air.code : '') : '', date:got ? vs.done[id] : here ? 'In progress' : '',
            label:got ? rName(id) + ', stamped' : here ? rName(id) + ', in progress' : 'Not visited yet', open:has && (got || here) && !fm ? () => this.jyShowReg(id) : () => {} };
        });
      }
      return out;
    }

    // what the achievements are measured by: this view's numbers plus every other level's saved copy
    achEv = {};   // things that happened just now (a perfect session, studying at night...): set where they happen, used once by checkMilestones
    achMetrics() {
      const S = this.state; const today = ymd(new Date());
      const started = (w) => !!w && DIMS.some(k => w[k] && w[k].s > 0);
      const m = { streak:(S.lastActive === today || S.lastActive === daysAgo(1)) ? S.streak : 0, words:memOf(S.ws).words, lessons:LESSONS.filter(L => (S.gres[L.id] || 0) >= 80).length,
        gmastered:Object.keys(S.gpt || {}).filter(id => gptInfo(S.gpt[id]).mastered).length, exams:LVL.passedList(S.exams || []) ? 1 : 0, gwrote:0, topic:false, goalRun:0, lv:{}, ev:{}, frMembers:0, frLeader:false, jy:this.jyCounts(), pathStops:0, pathUnits:0, pathLevels:0, fullDay:false, pyDone:0, pyTotal:0, meanings:0, scenes:0, scenesAll:false, clips:0, hubs:0 };
      let words = 0, lessons = 0, gm = 0, scenesSaved = 0, clipsSaved = 0, hubsSaved = 0;
      for (let n = 1; n <= LVL.MAX_LEVEL; n++) {
        const W = window['HSK' + n + '_WORDS'], G = window['HSK' + n + '_GRAMMAR'], B = window['HSK' + n + '_WEBS'];
        if (!W) continue;
        const st = readStore(n); if (!st) { m.lv[n] = { started:0, total:W.length, lessonsDone:0, lessonsTotal:G ? (G.lessons || []).length : 0 }; continue; }
        const ws = st.ws || {};
        try { words += memOf(fillWs(JSON.parse(JSON.stringify(ws)))).words; } catch (e) {}
        const L = G ? (G.lessons || []) : [];
        const lessonsDone = L.filter(l => ((st.gres || {})[l.id] || 0) >= 80).length; lessons += lessonsDone;
        m.lv[n] = { started:W.filter(w => started(ws[w.zh])).length, total:W.length, lessonsDone, lessonsTotal:L.length };
        Object.keys(st.gpt || {}).forEach(id => { const e = st.gpt[id]; if (gptInfo(e).mastered) gm++; if (e && (e.wok || 0) >= 1) m.gwrote++; });
        scenesSaved += Object.keys(st.sres || {}).filter(id => st.sres[id]).length; clipsSaved += (st.clipBest || []).filter(x => x > 0).length;
        if (B) hubsSaved += (B.hubs || []).filter(h => (h.words || []).length > 0 && h.words.every(w => started(ws[w.zh]))).length;
        if (B && (B.topics || []).some(t => (t.words || []).length > 0 && t.words.every(zh => started(ws[zh])))) m.topic = true;
      }
      m.words = Math.max(m.words, Math.round(words)); m.lessons = Math.max(m.lessons, lessons); m.gmastered = Math.max(m.gmastered, gm);
      // the Path (this view's levels), the Pinyin course, scenes, clips and word families
      { let stops = 0, units = 0, lvls = 0;
        PATH_LVLS.forEach(lv => { let all = true; (PATH_U[lv] || []).forEach(u => { let d = 0; u.stops.forEach(st => { if (stopState(S, st) === 'done') { stops++; d++; } }); if (u.stops.length && d === u.stops.length) units++; else all = false; }); if (all && (PATH_U[lv] || []).length) lvls++; });
        m.pathStops = stops; m.pathUnits = units; m.pathLevels = lvls; }
      m.pyTotal = (PYC.lessons || []).length; m.pyDone = (PYC.lessons || []).filter(l => pyDoneAt(l.id)).length;
      m.scenes = Math.max(scenesSaved, Object.keys(S.sres || {}).filter(id => S.sres[id]).length); m.scenesAll = HAS_SCRIPTS && SCEN.length > 0 && SCEN.every(sc => S.sres[sc.id]);
      m.meanings = Object.keys(S.mbest || {}).filter(z => S.mbest[z] >= 2).length;
      m.clips = Math.max(clipsSaved, (S.clipBest || []).filter(x => x > 0).length); m.hubs = Math.max(hubsSaved, HUBS.filter(h => h.words.length && h.words.every(w => started(S.ws[w.zh]))).length);
      { const grOpen = (() => { const greg = gptReg(); return Object.keys(greg).filter(id => gptOpen(S, id)).length; })();
        m.fullDay = S.pbase != null && pathDoneCount(S) > S.pbase && !!S.rcomplete && (!grOpen || !!S.grdone); }
      m.gwrote = Math.max(m.gwrote, Object.keys(S.gpt || {}).filter(id => ((S.gpt[id] || {}).wok || 0) >= 1).length);
      // days in a row at (or over) the daily goal, counted back from today (or from yesterday if today is not done yet)
      try {
        const stores = readAllStores();
        const dayMin = (d) => stores.reduce((a, st) => a + (window.ShanluSync.dayMinutes(st, d) || (st.day === d ? (st.dayMin || 0) : 0)), 0);
        const goal = Math.max(1, S.mins || 1);
        let n = dayMin(today) >= goal ? 0 : 1, run = 0;
        for (; n < 60 && dayMin(daysAgo(n)) >= goal; n++) run++;
        m.goalRun = run;
      } catch (e) {}
      if (S.fr && S.fr.members && window.ShanluFriends) {
        m.frMembers = S.fr.members.length;
        const rows = S.fr.members.map(x => window.ShanluFriends.boardRow(x, today, S.fr.me)); const me = rows.filter(r => r.isMe)[0]; const others = rows.filter(r => !r.isMe);
        m.frLeader = !!me && me.minutes > 0 && others.length > 0 && others.every(r => me.minutes > r.minutes);
      }
      return m;
    }
    // earned milestones: a toast the first time, remembered in the person's saved preferences
    checkMilestones() {
      try {
        if (this.frozen) return;
        const have = prefGet('ach', {}) || {};
        if (MILESTONES.every(x => have[x.id])) return;
        const m = this.achMetrics(); m.ev = this.achEv; this.achEv = {};
        const fresh = MILESTONES.filter(x => !have[x.id] && x.test(m));
        if (!fresh.length) return;
        const next = Object.assign({}, have); const now = Date.now(); fresh.forEach(x => { next[x.id] = now; });
        prefSet('ach', next);
        if (!this.msStarted) { this.msStarted = true; if (fresh.length > 3) return; }   // the first look in a visit that finds a pile of them (an older learner, a new device) records them quietly instead of showering old news
        this.msStarted = true;
        this.setState({ msQueue:(this.state.msQueue || []).concat(fresh.map(x => ({ icon:x.icon, title:x.title, desc:x.desc }))) });
        SFX.play('ach');
        this.msArm();
      } catch (e) {}
    }
    // a milestone toast leaves by itself after a few seconds (the next one in line then shows)
    msArm() {
      clearTimeout(this.msTimer);
      this.msTimer = setTimeout(() => { const q = (this.state.msQueue || []).slice(1); this.setState({ msQueue:q }); if (q.length) this.msArm(); }, 6500);
    }
    focusTyped() {
      try {
        const S = this.state; if ((S.screen !== 'review' && S.screen !== 'quiz') || S.qchecked) return;
        if (!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
        if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('py-tryi')) return;   // typing in the tutorial's practice box
        const el = document.getElementById('answer-input');
        if (el && !el.readOnly && document.activeElement !== el) el.focus({ preventScroll:true });
      } catch (err) {}
    }
    pick = (id) => { const S = this.state; if (S.qchecked || S.qpicked.indexOf(id) >= 0) return; this.setState({ qpicked:S.qpicked.concat([id]) }); };
    unpick = (id) => { const S = this.state; if (S.qchecked) return; this.setState({ qpicked:S.qpicked.filter(x => x !== id) }); };
    // ----- grammar review: points, not lessons -----
    startGrammarReview = () => {
      const S = this.state;
      const levels = S.grvLv ? [S.grvLv] : LVLS.slice();
      const list = gptSession(S, levels, 8, aiReadyNow());
      if (!list.length) return;
      this.quizQs = list;
      this.rvKey = null; this.setState({ screen:'quiz', qmode:'greview', glast:null, qi:0, qpicked:[], qtyped:'', qchoice:null, qfeed:'', qerr:'', qbusy:false, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false });
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    // one answer about a point: its memory (recognise or write) moves on, with spaced repetition like a word
    gptRecord = (pid, dim, ok, grade, pool) => {
      const S = this.state; const e0 = S.gpt[pid] || {};
      const e = Object.assign({ rn:0, rok:0, wn:0, wok:0 }, e0);
      const key = dim === 'w' ? 'w' : 'r'; const cur = e[key] || { s:0 };
      const from = gptInfo(e0)[key === 'w' ? 'wm' : 'rm'];
      e[key] = bump(cur, ok ? 'good' : (grade === 'hard' ? 'hard' : 'again'));
      e[key + 'n'] = (e[key + 'n'] || 0) + 1; if (ok) e[key + 'ok'] = (e[key + 'ok'] || 0) + 1;
      if (pool !== undefined) e.li = pool;
      e.at = Date.now();
      const reg = gptReg()[pid]; const to = gptInfo(e)[key === 'w' ? 'wm' : 'rm'];
      this.setState({ gpt:Object.assign({}, S.gpt, { [pid]: e }), glast:{ title:reg ? reg.title : 'This point', dim:key === 'w' ? 'writing' : 'recognising', from, to } });
    };
    // a sentence written from scratch: quick local checks, then the AI says whether it is right
    checkWrite = async (q) => {
      const S = this.state; if (S.qchecked || S.qbusy) return;
      const text = (S.qtyped || '').trim(); if (!text) return;
      if (writeSame(q, text)) { this.writeDone(q, true, 'That is the model answer.', '', ''); return; }
      const local = writeLocal(q, text);
      if (local) { this.writeDone(q, false, local, q.model, ''); return; }
      this.setState({ qbusy:true, qerr:'' });
      try { const r = await gAiCheck(q, text); this.writeDone(q, r.verdict === 'pass', r.reason, r.verdict === 'pass' ? '' : (r.better || q.model), r.by === 'qwen' ? 'Checked by Qwen, which is a little less strict than Claude.' : ''); }
      catch (e) { this.setState({ qbusy:false, qerr:(e && e.message) || 'Could not check it.' }); }
    };
    writeDone = (q, ok, reason, better, note) => {
      const S = this.state;
      q.reveal = ok ? q.model : (better || q.model);
      q.explain = (ok ? 'A model answer: ' + q.model : (better && better !== q.model ? 'A model answer: ' + q.model : ''));
      const res = S.qres.slice(); res[S.qi] = ok;
      const gain = ok ? 12 : 0;
      this.setState({ qbusy:false, qerr:'', qchecked:true, qcorrect:ok, qfeed:(reason || '') + (note ? ' ' + note : ''), qscore:S.qscore + (ok ? 1 : 0), qres:res, qxp:S.qxp + gain, qgain:gain, xp:S.xp + gain, dayXp:S.dayXp + gain });
      this.gptRecord(q.pt, 'w', ok);
    };
    exitQuiz = () => { this.setState({ screen:this.state.qmode === 'greview' ? 'greview' : isG(this.state.qmode) ? 'grammar' : 'testlobby', qdone:false }); };
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
    pickScenario = (i) => { this.setState({ sidx:i, sturn:0, sdone:false, sview:'chat' }); try { window.scrollTo(0, 0); } catch (e) {} };
    spBack = () => { this.setState({ sview:'pick' }); try { window.scrollTo(0, 0); } catch (e) {} };

    // ----- the learning path and its stop lesson -----
    pathLevel = () => { const S = this.state; return S.plv && PATH_LVLS.indexOf(S.plv) >= 0 ? S.plv : pathFirstOpen(S); };
    pathSetLevel = (n) => { this.setState({ plv:n, pstop:'', plNote:'', plAlt:'' }); };
    pathUnitToggle = (id, open) => { const pu = Object.assign({}, this.state.pu); pu[id] = open; this.setState({ pu }); };
    pathSelect = (id) => { this.setState({ pstop:id, plNote:'', plAlt:'' }); };
    pathClose = () => { this.setState({ pstop:'', plNote:'', plAlt:'' }); };
    // open a stop: a word stop starts its lesson (unless the daily limit or the waiting words say wait), a grammar stop opens its lesson
    pathStart = (id) => {
      const S = this.state; const hit = STOP_BY[id]; if (!hit) return;
      const st = hit.st;
      if (st.k === 'g') { this.setState({ pstop:'', plNote:'', plAlt:'', ggopen:null, gq:'', glesson:LESSON_AT[st.g] }); this.go('grammar'); return; }
      if (st.k === 's') { this.setState({ pstop:'', plNote:'', plAlt:'', aiMode:false, sidx:SCEN_AT[st.s], sturn:0, sdone:false, sview:'chat' }); this.go('speak'); return; }
      const words = stopWords(st);
      const fresh = words.filter(z => !wStarted(S, z)); const known = words.filter(z => wStarted(S, z));
      if (fresh.length) {
        const lim = limitOf(S);
        if (Object.keys(S.wlearned).length + fresh.length > lim) { this.setState({ pstop:id, plNote:'That would go past your limit of ' + lim + ' new words for today. Raise the limit in Settings, or come back tomorrow.', plAlt:'settings' }); return; }
        if (this.lrnRoom() < fresh.length) { this.setState({ pstop:id, plNote:'You already have ' + lrnLive(S.ws, S.lrn).length + ' new words waiting. Learn those in Review first, then come back for these.', plAlt:'review' }); return; }
      }
      const steps = plBuild(fresh.length ? fresh : words, fresh.length ? known : []);
      this.setState({ screen:'plesson', pstop:'', plNote:'', plAlt:'', pl:{ id, steps, i:0, pick:null, checked:false, ok:0, bad:0, missed:{}, fresh, replay:!fresh.length, leave:false, done:false, gain:0 } });
      try { window.scrollTo(0, 0); } catch (e) {}
      this.plSay(steps[0]);
    };
    pathAlt = () => { const a = this.state.plAlt; this.setState({ pstop:'', plNote:'', plAlt:'' }); this.go(a === 'review' ? 'review' : 'voice'); };
    plSay = (st) => { if (st && (st.t === 'meet' || (st.t === 'q' && st.kind === 'hear'))) this.sayAi(st.zh, 'pl'); };
    plHear = () => { const pl = this.state.pl; const st = pl && pl.steps[pl.i]; if (st) this.sayAi(st.zh, 'pl'); };
    plHearEx = () => { const pl = this.state.pl; const st = pl && pl.steps[pl.i]; if (!st) return; const ex = st.t === 'meet' ? EX[st.zh] : st.ex; if (ex && ex.zh) this.sayAi(ex.zh, 'plx'); };
    plPick = (zh) => {
      const S = this.state; const pl = S.pl; const st = pl && pl.steps[pl.i];
      if (!st || st.t !== 'q' || pl.checked) return;
      const ok = zh === st.zh; const steps = pl.steps.slice(); const missed = Object.assign({}, pl.missed);
      let okN = pl.ok, badN = pl.bad;
      if (!st.again) { if (ok) okN++; else badN++; }
      if (!ok) {
        if (st.ph === 'final') missed[st.zh] = 'final'; else if (!missed[st.zh]) missed[st.zh] = 'try';
        if (!st.again) steps.splice(Math.min(pl.i + 4, steps.length), 0, Object.assign({}, st, { again:true, opts:shuffle(st.opts) }));   // it comes back once, a few questions later
      }
      SFX.play(ok ? 'ok' : 'bad');
      this.setState({ pl:Object.assign({}, pl, { steps, pick:zh, checked:true, ok:okN, bad:badN, missed }) });
      this.sayAi(st.kind === 'cloze' && st.ex ? st.ex.zh : st.zh, 'pl');
    };
    plNext = () => {
      const S = this.state; const pl = S.pl; if (!pl || pl.done) return;
      const cur = pl.steps[pl.i];
      if (cur.t === 'q' && !pl.checked) return;
      const i = pl.i + 1;
      if (i >= pl.steps.length) { this.plFinish(); return; }
      this.setState({ pl:Object.assign({}, pl, { i, pick:null, checked:false }) });
      this.plSay(pl.steps[i]);
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    // the end: the new words go into Review (a word missed in the checkpoint will be introduced there again first)
    plFinish = () => {
      const S = this.state; const pl = S.pl; if (!pl || pl.done) return;
      const first = !prefGet('pth.' + pl.id, 0); const now = Date.now();
      const lrn = Object.assign({}, S.lrn); const wl = Object.assign({}, S.wlearned);
      pl.fresh.forEach(zh => { lrn[zh] = { st:pl.missed[zh] === 'final' ? -1 : 0, m:0, at:now }; wl[zh] = true; });
      prefSet('pth.' + pl.id, now);
      const patch = { lrn, wlearned:wl, webCredited:true, lrnNote:'', pl:Object.assign({}, pl, { done:true, gain:first ? STOP_COINS : 0 }) };
      if (first) { patch.xp = S.xp + STOP_COINS; patch.dayXp = S.dayXp + STOP_COINS; patch.dayMin = S.dayMin + Math.max(2, Math.round(pl.steps.length / 5)); }
      SFX.play('done');
      this.setState(patch);
      try { window.scrollTo(0, 0); } catch (e) {}
    };
    plClose = () => {
      const pl = this.state.pl; if (!pl) return;
      if (pl.done || pl.i === 0) { this.setState({ screen:'path', pl:null }); return; }
      this.setState({ pl:Object.assign({}, pl, { leave:true }) });
    };
    plStay = () => { const pl = this.state.pl; if (pl) this.setState({ pl:Object.assign({}, pl, { leave:false }) }); };
    plLeave = () => { this.setState({ screen:'path', pl:null }); try { window.scrollTo(0, 0); } catch (e) {} };
    plAfter = () => {   // the stop that comes next on the path
      const S = this.state; const pl = S.pl; const hit = pl && STOP_BY[pl.id];
      const nx = hit ? pathNext(S, hit.lv) : null;
      this.setState({ screen:'path', pl:null });
      if (nx) this.pathStart(nx.st.id);
    };

    // ----- the account page -----
    acctEditOpen = () => { this.setState({ acctEdit:true, acctNameIn:prefGet('name', '') }); };
    acctCancel = () => { this.setState({ acctEdit:false }); };
    acctSave = () => {
      const v = String(this.state.acctNameIn || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      prefSet('name', v);
      this.setState({ acctEdit:false });
    };
    acctVals = (S, c) => {
      const name = String(prefGet('name', '') || '');
      const keys = Object.keys(S.activity || {}).filter(k => S.activity[k]).sort();
      let since = '';
      if (keys.length) { const d = new Date(keys[0] + 'T12:00:00'); if (!isNaN(d.getTime())) since = d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
      let stopsDone = 0, stopsAll = 0;
      PATH_LVLS.forEach(n => (PATH_U[n] || []).forEach(u => u.stops.forEach(st => { stopsAll++; if (stopState(S, st) === 'done') stopsDone++; })));
      const gPassed = LESSONS.filter(L => (S.gres[L.id] || 0) >= 80).length;
      const stat = (label, value) => ({ label, value });
      const links = [
        { glyph:'设', title:'Settings and sync', sub:'Keep one progress on every device, choose the level and the voice, saved data and backups.', go:() => this.go('voice') },
        { glyph:'友', title:'Friends', sub:'Study totals shared with your group.', go:() => this.go('friends'), show:!!(FR && FR.enabled()) },
        { glyph:'成', title:'Achievements', sub:'What you have earned and what is ahead.', go:() => this.go('ach') },
        { glyph:'问', title:'How Shanlu works', sub:'The daily loop and where your progress lives.', go:() => this.go('guide'), show:!!c.guide }
      ].filter(x => x.show !== false);
      return {
        isAcct:S.screen === 'acct', acctShowName:!S.acctEdit,
        acctName:name || 'Learner', acctInitial:name ? name.charAt(0).toUpperCase() : '学', acctHasName:!!name,
        acctSub:c.level + (since ? ' · studying since ' + since : ''),
        acctEditing:!!S.acctEdit, acctNameIn:String(S.acctNameIn || ''), onAcctName:(e) => this.setState({ acctNameIn:e.target.value }),
        acctEditOpen:this.acctEditOpen, acctCancel:this.acctCancel, acctSave:this.acctSave,
        devOpen:!!S.devOpen, devExpanded:S.devOpen ? 'true' : 'false', devToggleText:S.devOpen ? 'Hide' : 'Show', toggleDev:() => this.setState({ devOpen:!this.state.devOpen }),
        acctStamps:[1, 2, 3, 4].filter(n => n <= (LVL.MAX_LEVEL || 4)).map(n => { const done = !!LVL.levelPassed(n); const cur = !done && n === LV; return { zh:'一二三四五六'.charAt(n - 1), cls:done ? 'got' : (cur ? 'cur' : 'no'), label:done ? 'HSK ' + n + ' passed' : (cur ? 'In progress' : 'Ahead') }; }),
        acctStats:[
          stat('Day streak', String(c.streak)), stat('Coins', c.coins), stat('Words in memory', String(c.mem)), stat('Words started', c.started + ' of ' + c.total),
          stat('Path stops done', PATH_LVLS.length ? stopsDone + ' of ' + stopsAll : 'None yet'), stat('Grammar lessons passed', gPassed + ' of ' + LESSONS.length)
        ],
        acctLinks:links
      };
    };

    // what the Path and the stop lesson show (the same keys every time, empty when the screen is not open)
    pathVals = (S) => {
      const sh0 = { kick:'', title:'', isDone:false, isW:false, isG:false, words:[], sub:'', cta:'', go:() => {}, hasNote:false, note:'', hasAlt:false, altText:'', hasBest:false, best:'' };
      const out = {
        isPath:S.screen === 'path', isPlesson:S.screen === 'plesson',
        pthHas:PATH_LVLS.length > 0, pthNone:!PATH_LVLS.length, pthHasTabs:PATH_LVLS.length > 1, pthTabs:[], pthSub:'', pthPct:'0%', pthName:'', pthBlurb:'', pthKCls:'', pthHasHero:false, pthHeroImg:'', pthHasTag:false, pthTag:'', pthRailPct:'0%',
        pthHasNext:false, pthAllDone:false, pthNextKick:'', pthNextTitle:'', pthNextSub:'', pthNextWords:'', pthNextBtn:'', pthNextGo:() => {},
        pthUnits:[], pthSheet:false, pthSh:sh0, pthClose:this.pathClose, pthAlt:this.pathAlt,
        pthSummit:false, smt:{ cls:'', title:'', sub:'', btn:'', go:() => {}, locked:false, unlocked:false, passed:false, early:() => {}, art:artUri('summit'), pct:'0%', hint:'' }
      };
      if (S.screen === 'path') {
        const lv = this.pathLevel(); const us = PATH_U[lv] || []; const nxt = pathNext(S, lv);
        let nTotal = 0, nDone = 0, wTotal = 0, wStart = 0;
        us.forEach(u => u.stops.forEach(st => { nTotal++; if (stopState(S, st) === 'done') nDone++; stopWords(st).forEach(z => { wTotal++; if (wStarted(S, z)) wStart++; }); }));
        out.pthName = 'HSK ' + lv + ' path'; out.pthBlurb = (PATH[lv] || {}).blurb || '';
        const th = (PATH[lv] || {}).theme || null;     // the look of this level: a day in a city (HSK 1), a rail line (HSK 2), a semester of chapters (HSK 3), a year of 24 solar terms (HSK 4)
        if (th) {
          out.pthKCls = 'k-' + th.kind; out.pthName = th.name; out.pthBlurb = th.blurb; out.pthHasTag = true; out.pthTag = 'HSK ' + lv + ' · ' + th.tag;
          out.pthHeroImg = PSCENE[th.hero] || ''; out.pthHasHero = !!out.pthHeroImg;
        }
        out.pthTabs = PATH_LVLS.map(n => ({ label:'HSK ' + n, cls:n === lv ? 'on' : '', fn:() => this.pathSetLevel(n) }));
        out.pthSub = nDone + ' of ' + nTotal + ' stops done · ' + wStart + ' of ' + wTotal + ' words started';
        out.pthPct = (nTotal ? Math.round(nDone / nTotal * 100) : 0) + '%';
        out.pthAllDone = !nxt && nTotal > 0;
        // the summit: the level exam is the last stop of the path. It opens when the path is nearly done (80%); passing it plants the flag and opens the next level
        if (EXAMBANK && !ALL && lv === LV) {
          const frac = nTotal ? nDone / nTotal : 0, passed = LVL.levelPassed(LV), open = passed || frac >= 0.8;
          out.pthSummit = true;
          out.smt = {
            cls:passed ? 'passed' : open ? 'open' : 'locked', passed, locked:!open, unlocked:open, title:LVN + ' level exam',
            sub:passed ? LVN + ' is behind you.' + (LV < LVL.MAX_LEVEL ? ' HSK ' + (LV + 1) + ' is open.' : '') : open ? 'You are near the top. Pass listening and reading (' + LVL.PASS_PCT + '% in each) to plant the flag' + (LV < LVL.MAX_LEVEL ? ' and open HSK ' + (LV + 1) + '.' : '.') : 'The summit opens when the path is 80% done. You are at ' + Math.round(frac * 100) + '%.',
            btn:passed ? 'Take it again' : 'See the exam', go:() => this.go('exam'), early:() => this.go('exam'), art:artUri('summit'), pct:Math.round(frac * 100) + '%', hint:open ? '' : 'Open it early'
          };
        }
        if (nxt) {
          const ws = stopWords(nxt.st); const state = stopState(S, nxt.st);
          out.pthHasNext = true; out.pthNextKick = 'Next on your path · Unit ' + (nxt.ui + 1) + ': ' + nxt.u.title;
          out.pthNextTitle = stopTitle(nxt.st);
          out.pthNextSub = nxt.st.k === 'w' ? ws.length + ' words:' : nxt.st.k === 's' ? 'Say it out loud with Mingming, ' + (SCEN[SCEN_AT[nxt.st.s]].you.length) + ' turns' : 'A grammar lesson, about 4 minutes';
          out.pthNextWords = nxt.st.k === 'w' ? ws.slice(0, 4).join(' · ') + (ws.length > 4 ? ' …' : '') : '';
          out.pthNextBtn = nxt.st.k === 'g' ? 'Open the lesson' : nxt.st.k === 's' ? 'Step into the scene' : state === 'part' ? 'Continue' : 'Start';
          out.pthNextGo = () => this.pathStart(nxt.st.id);
        }
        const unitDone = us.map(u => u.stops.every(st => stopState(S, st) === 'done'));
        if (th && (th.kind === 'rail' || th.kind === 'terms')) out.pthRailPct = (us.length > 1 ? Math.round(Math.min(unitDone.filter(Boolean).length, us.length - 1) / (us.length - 1) * 100) : 0) + '%';
        const seenGroup = {};
        out.pthUnits = us.map((u, ui) => {
          const states = u.stops.map(st => stopState(S, st));
          const tu = th && th.units ? th.units[u.id] : null;
          const grp = th && th.groups ? th.groups.find(g => { const a = us.findIndex(x => x.id === g.from), b = us.findIndex(x => x.id === g.to); return a >= 0 && ui >= a && ui <= b; }) : null;
          const first = !!grp && !seenGroup[grp.id]; if (grp) seenGroup[grp.id] = 1;
          const gN = grp ? us.filter((x, xi) => { const a = us.findIndex(y => y.id === grp.from), b = us.findIndex(y => y.id === grp.to); return xi >= a && xi <= b; }).length : 0;
          const th0 = th ? th.kind : '';
          const lines = th0 === 'story' && tu && tu.lines ? tu.lines : [];
          const nd = states.filter(x => x === 'done').length;
          const open = S.pu[u.id] !== undefined ? S.pu[u.id] : (!!nxt && (ui === nxt.ui || ui === nxt.ui + 1));
          return {
            id:u.id, num:th0 === 'rail' && tu ? tu.ch : th0 === 'terms' && tu ? tu.zh : ui + 1, numCls:th0 === 'rail' ? 'zh big' : th0 === 'terms' ? 'zh term' : '', title:u.title, blurb:u.blurb, prog:nd + ' of ' + u.stops.length, open, cls:(nd === u.stops.length ? 'done' : nxt && ui === nxt.ui ? 'cur' : ''),
            trailStyle:tu && PTILE[tu.tile] ? 'background-image:url("' + PTILE[tu.tile] + '"),linear-gradient(180deg,' + ((tu.bg || (grp && grp.bg) || ['#EDF0EC', '#EDF0EC'])[0]) + ',' + ((tu.bg || (grp && grp.bg) || ['#EDF0EC', '#EDF0EC'])[1]) + ')' : '',
            hasKick:!!tu && th0 !== '' && th0 !== 'day', kick:!tu ? '' : th0 === 'day' ? '' : th0 === 'rail' ? 'Station ' + (ui + 1) + ' · ' + tu.py : th0 === 'terms' ? tu.py + ' · ' + tu.en + ' · c. ' + tu.date : 'Chapter ' + (ui + 1) + ' · ' + (tu.place || ''),
            hasScene:(th0 === 'day' || th0 === 'terms') && !!tu && !!tu.scene, scene:tu && tu.scene || '',
            hasBand:first, bandImg:grp && PSCENE[grp.scene] || '', bandZh:grp && grp.zh || '', bandTitle:grp ? (grp.sub ? grp.title + ' · ' + grp.sub : grp.title) : '', bandSub:'', bandN:gN + (gN === 1 ? ' unit' : ' units'), hasBandLine:!!grp && !!grp.line, bandLine:grp && grp.line || '',
            hasDlg:open && lines.length > 0, dlg:lines.map((l, li) => ({ who:l.who, zh:l.zh, py:l.py, en:l.en, cls:l.who === '你' ? 'me' : '', playCls:S.playing === 'pd:' + u.id + li ? 'on' : '', say:() => this.say(l.zh, 'pd:' + u.id + li) })),
            isDone:nd === u.stops.length, toggleText:open ? 'Hide' : 'Show', toggle:() => this.pathUnitToggle(u.id, !open),
            stops:open ? u.stops.map((st, si) => {
              const state = states[si]; const isCur = !!nxt && nxt.st.id === st.id; const ws = stopWords(st);
              const x = PATH_XS[si % PATH_XS.length], xp = PATH_XS[(si + PATH_XS.length - 1) % PATH_XS.length];
              return {
                id:st.id, isW:st.k === 'w', isG:st.k === 'g', isS:st.k === 's', glyph:st.k === 'w' ? ws[0].charAt(0) : st.k === 's' ? '说' : '语', title:stopTitle(st),
                sub:st.k === 'w' ? ws.slice(0, 3).join(' · ') + (ws.length > 3 ? ' …' : '') : st.k === 's' ? SCEN[SCEN_AT[st.s]].sub : 'Grammar',
                meta:st.k === 'w' ? ws.length + ' words' + (state === 'part' ? ' · ' + ws.filter(z => wStarted(S, z)).length + ' started' : '') : st.k === 's' ? (state === 'done' ? 'Said it' : 'Speak · ' + SCEN[SCEN_AT[st.s]].you.length + ' turns') : (state === 'done' ? 'Passed' : state === 'part' ? 'Best ' + (S.gres[st.g] || 0) + '%' : 'Lesson'),
                cls:(state === 'done' ? 'done' : isCur ? 'cur' : state === 'part' ? 'part' : '') + (st.k === 'g' ? ' g' : st.k === 's' ? ' sp' : '') + (S.pstop === st.id ? ' sel' : ''),
                state, isDone:state === 'done', isCur, nodeStyle:'left:' + x + '%',
                labelStyle:x <= 50 ? 'left:calc(' + x + '% + 50px);width:calc(' + (100 - x) + '% - 58px);text-align:left' : 'right:calc(' + (100 - x) + '% + 50px);width:calc(' + x + '% - 58px);text-align:right',
                hasLink:si > 0, curve:'M ' + xp + ' 0 C ' + xp + ' 52 ' + x + ' 52 ' + x + ' 104', linkCls:states[si - 1] === 'done' ? 'on' : '',
                aria:stopTitle(st) + ', ' + (state === 'done' ? 'done' : isCur ? 'next' : state === 'part' ? 'started' : 'not started'),
                pick:() => this.pathSelect(st.id)
              };
            }) : []
          };
        });
        const hit = S.pstop ? STOP_BY[S.pstop] : null;
        if (hit) {
          const st = hit.st; const state = stopState(S, st); const ws = stopWords(st);
          const L = st.k === 'g' ? LESSONS[LESSON_AT[st.g]] : null; const SC = st.k === 's' ? SCEN[SCEN_AT[st.s]] : null;
          out.pthSheet = true;
          out.pthSh = {
            kick:'Unit ' + (hit.ui + 1) + ': ' + hit.u.title + ' · Stop ' + (hit.si + 1) + ' of ' + hit.u.stops.length,
            title:stopTitle(st), isW:st.k === 'w', isG:st.k === 'g', isS:st.k === 's', isDone:state === 'done',
            goalList:SC ? SC.goals.map(t => ({ t })) : [],
            words:ws.map(z => ({ zh:z, py:BANK[z].py, en:BANK[z].en, mark:wStarted(S, z) ? 'learned' : '', cls:wStarted(S, z) ? 'on' : '' })),
            sub:SC ? 'You say your lines out loud and Mingming answers. About 5 minutes. Nothing listens to you, so it is practice, not a test.' : L ? L.catBlurb || L.cat || '' : (state === 'done' ? 'You have met these words. Practise them again whenever you like.' : 'About ' + Math.max(3, Math.round(ws.filter(z => !wStarted(S, z)).length * 0.8 + 1)) + ' minutes. You meet the words, answer a few easy questions, then they join your Review.'),
            cta:st.k === 's' ? (state === 'done' ? 'Say it again' : 'Step into the scene') : st.k === 'g' ? (state === 'done' ? 'Open the lesson again' : 'Open the lesson') : state === 'done' ? 'Practise again' : state === 'part' ? 'Continue' : 'Start',
            go:() => this.pathStart(st.id),
            hasNote:!!S.plNote, note:S.plNote, hasAlt:!!S.plAlt, altText:S.plAlt === 'review' ? 'Go to Review' : 'Open Settings',
            hasBest:!!L && (S.gres[L.id] || 0) > 0, best:L ? 'Best score so far: ' + (S.gres[L.id] || 0) + '%. You pass at 80%.' : ''
          };
        }
      }
      return Object.assign(out, this.lessonVals(S));
    };
    lessonVals = (S) => {
      const pl = S.pl;
      const emptyMeet = { zh:'', py:'', en:'', pos:'', exParts:[], exPy:'', exEn:'', hasEx:false, hasNote:false, note:'', hasBuilt:false, built:[], count:'' };
      const emptyQ = { kicker:'', prompt:'', hasBig:false, big:'', bigCls:'', hasSub:false, sub:'', isListen:false };
      const out = {
        plOn:!!pl && S.screen === 'plesson', plInside:!!pl && !pl.done, plTitle:'', plPhase:'', plPct:'0%', plIsMeet:false, plIsQ:false, plIsDone:false, plAsk:false,
        plMeet:emptyMeet, plQuest:emptyQ, plOpts:[], plOptsCls:'', plChecked:false, plFbCls:'', plFbTitle:'', plFbZh:'', plFbPyEn:'', plFbMore:'', plHasFbMore:false,
        plHearCls:S.playing === 'pl' ? 'on' : '', plHearExCls:S.playing === 'plx' ? 'on' : '',
        plNext:this.plNext, plHear:this.plHear, plHearEx:this.plHearEx, plClose:this.plClose, plKeep:this.plStay, plExit:this.plLeave, plAfter:this.plAfter,
        plRes:{ n:0, gain:0, hasGain:false, words:[], hasMissed:false, missedText:'', headline:'', sub:'', replay:false, nextText:'', hasNext:false }
      };
      if (!pl || S.screen !== 'plesson') return out;
      const hit = STOP_BY[pl.id]; const st = pl.steps[pl.i];
      out.plTitle = hit ? stopTitle(hit.st) : ''; out.plAsk = !!pl.leave;
      out.plPct = (pl.done ? 100 : Math.round(pl.i / pl.steps.length * 100)) + '%';
      if (pl.done) {
        out.plIsDone = true;
        const words = hit ? stopWords(hit.st) : [];
        const missed = words.filter(z => pl.missed[z]);
        const nx = hit ? pathNext(S, hit.lv) : null;
        out.plRes = {
          n:pl.fresh.length, gain:pl.gain, hasGain:pl.gain > 0, replay:pl.replay,
          words:words.map(z => ({ zh:z, py:BANK[z].py, en:BANK[z].en, cls:pl.missed[z] ? 'miss' : 'ok' })),
          hasMissed:missed.length > 0, missedText:'Worth another look: ' + missed.join(' · ') + '. Review will bring ' + (missed.length === 1 ? 'it' : 'them') + ' back soon.',
          headline:pl.replay ? 'Practice done' : 'Stop complete',
          sub:pl.replay ? 'Nice. These words were already yours.' : pl.fresh.length + (pl.fresh.length === 1 ? ' new word is' : ' new words are') + ' now in your Review. You will be asked for ' + (pl.fresh.length === 1 ? 'it' : 'them') + ' again soon, which is what makes ' + (pl.fresh.length === 1 ? 'it' : 'them') + ' stay.',
          hasNext:!!nx, nextText:nx ? 'Next: ' + stopTitle(nx.st) : ''
        };
        return out;
      }
      if (st.t === 'meet') {
        const b = BANK[st.zh]; const ex = EX[st.zh] || { zh:'', py:'', en:'' };
        const built = st.zh.length > 1 ? st.zh.split('').map(ch => ({ ch, en:KB[ch] && KB[ch].en ? KB[ch].en : (CHAR_GLOSS[ch] || '') })) : [];
        const parts = ex.zh && ex.zh.indexOf(st.zh) >= 0 ? ex.zh.split(st.zh).reduce((acc, seg, i, arr) => { if (seg) acc.push({ t:seg, cls:'' }); if (i < arr.length - 1) acc.push({ t:st.zh, cls:'hl' }); return acc; }, []) : [{ t:ex.zh, cls:'' }];
        out.plIsMeet = true; out.plPhase = 'Meet the words';
        out.plMeet = { zh:st.zh, py:b.py, en:b.en, pos:POS_NAME[b.pos] || b.pos, exParts:parts, exPy:ex.py, exEn:ex.en, hasEx:!!ex.zh, hasNote:!!NOTE[st.zh], note:NOTE[st.zh] || '',
          hasBuilt:built.some(x => x.en), built:built.map(x => ({ ch:x.ch, en:x.en || '', hasEn:!!x.en })), count:'Word ' + st.n + ' of ' + st.of };
        return out;
      }
      // a question
      out.plIsQ = true; out.plPhase = st.ph === 'final' ? 'Checkpoint' : 'Try it';
      const b = BANK[st.zh];
      const q = { kicker:(st.again ? 'Once more' : st.ph === 'final' ? 'Checkpoint' : 'Try it'), prompt:'', hasBig:false, big:'', bigCls:'', hasSub:false, sub:'', isListen:false };
      if (st.kind === 'mean') { q.prompt = 'What does this word mean?'; q.hasBig = true; q.big = st.zh; q.bigCls = 'zh'; q.hasSub = true; q.sub = b.py; }
      else if (st.kind === 'hear') { q.prompt = 'Which word did you hear?'; q.isListen = true; }
      else if (st.kind === 'rev') { q.prompt = 'Which word means “' + b.en + '”?'; }
      else { q.prompt = 'Which word fits the gap?'; q.hasBig = true; q.big = st.ex.zh.replace(st.zh, '＿＿'); q.bigCls = 'zh sm'; q.hasSub = true; q.sub = st.ex.en; }
      out.plQuest = q;
      out.plOpts = st.opts.map(zh => {
        const o = BANK[zh]; const isAns = zh === st.zh; const picked = pl.pick === zh;
        const cls = pl.checked ? (isAns ? 'right' : picked ? 'wrong' : '') : '';
        return st.kind === 'mean'
          ? { label:o.en, sub:'', hasSub:false, lcls:'', cls, pick:() => this.plPick(zh) }
          : { label:zh, sub:st.kind === 'cloze' ? '' : o.py, hasSub:st.kind !== 'cloze', lcls:'zh', cls, pick:() => this.plPick(zh) };
      });
      out.plOptsCls = (pl.checked ? 'locked' : '') + (out.plOpts.length === 3 ? ' pl-three' : '');
      if (pl.checked) {
        const ok = pl.pick === st.zh;
        out.plChecked = true; out.plFbCls = ok ? 'good' : 'bad';
        out.plFbTitle = ok ? ['Yes!', 'Right.', 'Nice.', 'Exactly.'][(pl.i + st.zh.length) % 4] : 'Not quite';
        out.plFbZh = st.zh; out.plFbPyEn = b.py + ' · ' + b.en;
        out.plHasFbMore = !ok && !st.again; out.plFbMore = 'You will see this one again in a moment.';
      }
      return out;
    };

    // ----- word webs and word memory -----
    applyRating = (zh, r, dims) => {
      const cur = this.state.ws[zh];
      const next = { see:cur.see, hear:cur.hear, prod:cur.prod };
      dims.forEach(k => { next[k] = bump(cur[k], r); });
      const ws = Object.assign({}, this.state.ws);
      ws[zh] = next;
      return { ws, from:wMastery(cur), to:wMastery(next) };
    };
    // Adding a word does not mean learning it. It enters a short learning phase in Review: meet it, recall it a few cards later, recall it again
    // (typed) before the session ends. Only then does it get a real interval and count in "words in memory". Adding earns no streak or minutes.
    // Adding new words from Word webs (a topic, a group, one word, a gap) counts towards the daily goal "Learn N new words with their relatives":
    // once the day's added words reach the goal, that task is ticked. (Adding words earns no minutes or XP: only recalling them in Review does.)
    webCredit = (patch) => {
      const S = this.state; const wl = patch.wlearned;
      if (!wl || S.webCredited || patch.webCredited) return patch;
      const prev = Object.keys(S.wlearned || {}).length;
      const left = BANK_KEYS.filter(z => !(S.ws[z].see.s > 0) && !(S.lrn || {})[z] && !(S.wlearned || {})[z]).length + prev;
      const need = Math.max(1, Math.min(4, limitOf(S), left));
      if (Object.keys(wl).length >= need) patch.webCredited = true;
      return patch;
    };
    lrnRoom = () => Math.max(0, LRN_MAX - lrnLive(this.state.ws, this.state.lrn).length);
    toLearning = (zh, known) => { const l = Object.assign({}, this.state.lrn); l[zh] = { st:known ? 0 : -1, m:0, at:Date.now() }; return l; };
    learnWord = (zh) => {
      const S = this.state;
      if (S.wlearned[zh] || S.lrn[zh] || S.ws[zh].see.s > 0 || Object.keys(S.wlearned).length >= limitOf(S)) return;
      if (!this.lrnRoom()) { this.setState({ lrnNote:'You already have ' + LRN_MAX + ' new words waiting. Learn those in Review first, then add more.' }); return; }
      const wl = Object.assign({}, S.wlearned); wl[zh] = true;
      this.setState(this.webCredit({ lrn:this.toLearning(zh, false), wlearned:wl, lrnNote:'' }));
    };
    rateWeb = (zh, ok) => {
      const S = this.state;
      if (S.wrated[zh]) return;
      const wasNew = !(S.ws[zh].see.s > 0) && !S.lrn[zh];
      if (wasNew && !S.wlearned[zh] && Object.keys(S.wlearned).length >= limitOf(S)) return;
      const wr = Object.assign({}, S.wrated); wr[zh] = true;
      if (wasNew) {   // a word met here for the first time still has to be recalled in Review ("I knew it" skips the introduction)
        if (!this.lrnRoom()) { this.setState({ lrnNote:'You already have ' + LRN_MAX + ' new words waiting. Learn those in Review first, then add more.' }); return; }
        const wl = Object.assign({}, S.wlearned); wl[zh] = true;
        this.setState(this.webCredit({ lrn:this.toLearning(zh, ok), wlearned:wl, wrated:wr, lrnNote:'' }));
        return;
      }
      const res = this.applyRating(zh, ok ? 'good' : 'again', ['see']);
      const wd = Object.assign({}, S.wdelta); wd[zh] = { from:res.from, to:res.to };
      this.setState({ ws:res.ws, wrated:wr, wdelta:wd, xp:S.xp + (ok ? 3 : 1), dayXp:S.dayXp + (ok ? 3 : 1) });
    };
    setLimit = (n) => { this.setState({ nlimit:n }); };
    // Adds every still-new word in a list (a shared-character group or a topic) to the learning phase, as many as there is room for.
    learnMany = (list) => {
      const S = this.state;
      const lim = limitOf(S);
      const wl = Object.assign({}, S.wlearned);
      const lrn = Object.assign({}, S.lrn);
      let room = this.lrnRoom();
      let n = 0;
      list.forEach(zh => {
        if (wl[zh] || lrn[zh] || S.ws[zh].see.s > 0 || Object.keys(wl).length >= lim || room <= 0) return;
        lrn[zh] = { st:-1, m:0, at:Date.now() }; wl[zh] = true; room--; n++;
      });
      if (!n) { if (!this.lrnRoom()) this.setState({ lrnNote:'You already have ' + LRN_MAX + ' new words waiting. Learn those in Review first, then add more.' }); return; }
      this.setState(this.webCredit({ lrn, wlearned:wl, lrnNote:'' }));
    };
    reviewMore = () => {
      const clean = lrnPrune(this.state.ws, this.state.lrn);
      if (Object.keys(clean).length !== Object.keys(this.state.lrn || {}).length) this.setState({ lrn:clean });   // drop "learning" entries of words that are already learned
      const q = buildQueue(this.state.ws, false, clean);
      if (!q.length) return;
      this.lapsed = {}; this.rvKey = null;
      this.setState({ rq:q, rtotal:q.length, rdone:0, rxp:0, rcomplete:false, rflip:false, rpy:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null, rrun:0, rmiss:[], qchecked:false, qchoice:null, qtyped:'', qfeed:'' });
    };
    nextEx = (zh) => { const n = Object.assign({}, this.state.wexn); n[zh] = ((n[zh] || 0) + 1) % EXS[zh].length; this.setState({ wexn:n }); };
    toggleEx = (key) => { const x = Object.assign({}, this.state.wex); x[key] = !x[key]; this.setState({ wex:x }); };
    revealWord = (zh) => { const r = Object.assign({}, this.state.wreveal); r[zh] = true; this.setState({ wreveal:r }); };
    gapPick = (zh) => {
      const S = this.state;
      if (S.gfpick !== null) return;
      const g = HUBS[S.whub].gaps[S.gfq];
      const ok = zh === g.ans;
      if (!(S.ws[g.ans].see.s > 0)) {   // not recalled before: it is a hint that the word is worth learning, not proof it is known
        const patch = { gfpick:zh, xp:S.xp + (ok ? 2 : 0) };
        if (!S.lrn[g.ans] && this.lrnRoom()) { patch.lrn = this.toLearning(g.ans, ok); const wl = Object.assign({}, S.wlearned); wl[g.ans] = true; patch.wlearned = wl; }
        this.setState(this.webCredit(patch)); return;
      }
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
    playClip = () => { this.ttsUnlock(); this.sayAi(CLIPS[this.state.dclip].zh, 'clip', this.state.drate); this.setState({ dplays:this.state.dplays + 1 }); };
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
    nextClip = () => {
      const S = this.state; const mix = window.SHANLU_MEAN_MIX == null ? 0.25 : window.SHANLU_MEAN_MIX;
      // now and then a Dictation clip turns into "what does it mean?", checked by the AI (only when a key is saved)
      const toMean = S.lmode === 'dict' && S.aiOn && CLIPS.length > 3 && Math.random() < mix;
      this.newClip(Object.assign({ dplays:0, dtyped:'', dchecked:false, dmarks:[], dreveal:0, mtyped:'', mchecked:false, mbusy:false, mres:null, merr:'', mpeek:0 }, toMean ? { lmode:'mean', mmix:true } : {}));
    };
    // ----- Meaning: say what the clip means in English -----
    setMean = () => this.setState({ lmode:'mean', mmix:false });
    nextMean = () => {
      const back = this.state.mmix;
      this.newClip({ dplays:0, mtyped:'', mchecked:false, mbusy:false, mres:null, merr:'', mpeek:0, mmix:false, dtyped:'', dchecked:false, dmarks:[], dreveal:0, lmode:back ? 'dict' : 'mean' });
    };
    mFinish = (verdict, reason, by) => {
      const S = this.state; const clip = CLIPS[S.dclip]; if (!clip || (S.mchecked && !(S.mres && S.mres.verdict === 'self'))) return;   // a self-rated answer may still be settled once
      const peeked = S.mpeek > 0; const n = clip.words.length;
      const patch = { mchecked:true, mbusy:false, merr:'', mres:{ verdict, reason:reason || '', by:by || '', peeked } };
      const gain = peeked ? 0 : verdict === 'pass' ? n : verdict === 'close' ? Math.ceil(n / 2) : 0;
      if (!peeked && verdict === 'pass') {   // understanding the whole clip counts for the hearing skill of its words
        let wsNext = S.ws;
        clip.words.forEach(w => { if (wsNext[w.zh]) { const cur = wsNext[w.zh]; wsNext = Object.assign({}, wsNext); wsNext[w.zh] = { see:cur.see, hear:bump(cur.hear, 'good'), prod:cur.prod }; } });
        patch.ws = wsNext;
      }
      const score = verdict === 'pass' ? 2 : verdict === 'close' ? 1 : 0;
      if (score) { const mb = Object.assign({}, S.mbest); mb[clip.zh] = Math.max(mb[clip.zh] || 0, peeked ? 1 : score); patch.mbest = mb; }
      if (!S.ldone) { patch.ldone = true; patch.dayMin = S.dayMin + 4; }
      patch.xp = S.xp + gain; patch.dayXp = S.dayXp + gain;
      this.setState(patch);
    };
    checkMean = async () => {
      const S = this.state; if (S.mchecked || S.mbusy) return;
      const clip = CLIPS[S.dclip]; const text = S.mtyped.trim(); if (!clip || !text) return;
      if (/[一-鿿]/.test(text)) { this.setState({ merr:'Answer in English: what does the clip mean?' }); return; }
      const local = meanLocal(clip, text);
      if (local) { this.mFinish(local.verdict, '', ''); return; }
      if (!S.aiOn) { this.setState({ mchecked:true, mres:{ verdict:'self', reason:'', by:'', peeked:S.mpeek > 0 }, merr:'' }); return; }
      this.setState({ mbusy:true, merr:'' });
      const idx = S.dclip;
      let r;
      try { r = await mAiCheck(clip, text); }
      catch (e) { if (this.state.dclip === idx) this.setState({ mbusy:false, merr:e.message || 'The check did not work. Try again.' }); return; }
      if (this.state.dclip !== idx || this.state.mchecked) return;
      this.mFinish(r.verdict, r.reason, r.by);
    };
    mSelfRate = (right) => this.mFinish(right ? 'pass' : 'fix', '', 'self');
    playTone = () => {
      const S = this.state;
      let idx = S.tidx;
      if (idx === null || S.tpick !== null) { idx = Math.floor(Math.random() * 4); this.setState({ tidx:idx, tpick:null }); }
      this.ttsUnlock(); this.sayAi(TONES[idx].zh, 'tone', 0.8);
    };
    playPair = () => {
      const S = this.state; const list = PAIR_LIST(); if (!list.length) return;
      let idx = S.t2idx;
      if (idx === null || idx >= list.length || (S.t2a !== null && S.t2b !== null)) {
        do { idx = Math.floor(Math.random() * list.length); } while (list.length > 1 && idx === S.t2idx);
        this.setState({ t2idx:idx, t2a:null, t2b:null });
      }
      this.ttsUnlock(); this.sayAi(list[idx].zh, 'tone2', 0.8);
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

    pyVals(S, navCls) {
      const lessons = PYC.lessons || [];
      const doneN = lessons.filter(l => pyDoneAt(l.id)).length;
      const out = {
        isPinyin:S.screen === 'pinyin', navPinyin:navCls('pinyin'), goPinyin:this.goPinyin,
        typShow:S.typOpen || !typSeen(), typLinkShow:typSeen() && !S.typOpen, typIn:S.typIn, typOut:S.typIn.trim() ? toMarks(S.typIn) : 'Your tone marks appear here',
        onTypIn:(e) => this.setState({ typIn:e.target.value }), typDone:this.typDone, typCourse:this.typCourse, typToggle:this.typToggle,
        pyIsList:false, pyIsLesson:false, pyIsChart:false, pySummary:'', pyPct:'0%', pyLessons:[], pyOpenChart:() => { this.setState({ pyView:'chart', pyInfo:null }); try { window.scrollTo(0, 0); } catch (e) {} }, pyBack:this.pyBack,
        pyLessonNo:'', pyGlyph:'', pyTitle:'', pyBlocks:[], pyFootWait:false, pyFootWaitText:'', pyCanFinish:false, pyFinish:this.pyFinish, pyFinishText:'', pyIsDone:false, pyDoneText:'', pyHasNext:false, pyNext:this.pyNext, pyNextText:'', pyNextCls:'',
        pyInis:[], pyChartNote:'', pySylls:[], pyHasInfo:false, pyInfoZh:'', pyInfoPy:'', pyInfoEn:''
      };
      if (S.screen !== 'pinyin') return out;
      const view = S.pyView;
      out.pyIsList = view === 'list'; out.pyIsLesson = view === 'lesson' && !!lessons[S.pyLs]; out.pyIsChart = view === 'chart';
      out.pySummary = doneN + ' of ' + lessons.length + ' lessons done';
      out.pyPct = Math.round(doneN / Math.max(1, lessons.length) * 100) + '%';
      const pyFirst = lessons.findIndex(l => !pyDoneAt(l.id));
      out.pyLessons = lessons.map((l, i) => ({ glyph:l.glyph, title:(i + 1) + '. ' + l.title, blurb:l.blurb + ' About ' + l.mins + ' min.', cls:pyDoneAt(l.id) ? 'done' : (i === pyFirst ? 'next' : ''), state:pyDoneAt(l.id) ? 'Done' : 'Start', open:() => this.pyOpen(i) }));
      out.pySounds = [['妈', 'mā'], ['麻', 'má'], ['马', 'mǎ'], ['骂', 'mà']].map(([zh, py]) => Object.assign({ zh, py }, { cls:S.playing === 'pys:' + zh ? 'on' : '', play:() => this.pySay(zh, 'pys:' + zh) }));
      const play = (text, key) => ({ cls:S.playing === key ? 'on' : '', play:() => this.pySay(text, key) });
      if (out.pyIsLesson) {
        const les = lessons[S.pyLs];
        let nq = 0, na = 0;
        const none = { isP:false, isTip:false, isParts:false, isSay:false, isGroups:false, isPair:false, isTable:false, isTones:false, isTyping:false, isCheck:false, x:'', items:[], qs:[], rows:[], tones:[], title:'', hasTitle:false, h0:'', h1:'', a:{}, b:{} };
        out.pyBlocks = les.blocks.map((b, bi) => {
          const o = Object.assign({}, none);
          if (b.t === 'p') { o.isP = true; o.x = b.x; }
          else if (b.t === 'tip') { o.isTip = true; o.x = b.x; }
          else if (b.t === 'parts') { o.isParts = true; o.items = b.items.map(it => ({ h:it.h, x:it.x })); }
          else if (b.t === 'say') {
            o.isSay = true; o.title = b.title || ''; o.hasTitle = !!b.title;
            o.items = b.items.map((it, i) => Object.assign({ zh:it.zh, py:it.py, en:it.en, split:it.split || '', hasSplit:!!it.split }, play(it.say || it.zh, 'py:' + les.id + ':' + bi + ':' + i)));
          }
          else if (b.t === 'groups') {
            o.isGroups = true;
            o.items = b.items.map((g, gi) => ({ h:g.h, note:g.note || '', hasNote:!!g.note,
              cells:g.cells.map((c, ci) => Object.assign({ s:c.s, zh:c.zh, py:c.py, en:c.en }, play(c.zh, 'py:' + les.id + ':' + bi + ':' + gi + ':' + ci))) }));
          }
          else if (b.t === 'pair') {
            o.isPair = true; o.title = b.title || '';
            o.a = Object.assign({ zh:b.a.zh, py:b.a.py, en:b.a.en }, play(b.a.zh, 'py:' + les.id + ':' + bi + ':a'));
            o.b = Object.assign({ zh:b.b.zh, py:b.b.py, en:b.b.en }, play(b.b.zh, 'py:' + les.id + ':' + bi + ':b'));
          }
          else if (b.t === 'table') { o.isTable = true; o.h0 = b.head[0]; o.h1 = b.head[1]; o.rows = b.rows.map(r => ({ c0:r[0], c1:r[1] })); }
          else if (b.t === 'tones') { o.isTones = true; o.tones = TONE_PANEL.map(t => Object.assign({ name:t.name, desc:t.desc, path:t.path, zh:t.zh, py:t.py, en:t.en }, play(t.zh, 'py:tone' + t.n))); }
          else if (b.t === 'typing') { o.isTyping = true; }
          else if (b.t === 'check') {
            o.isCheck = true;
            o.qs = b.qs.map((q, qi) => {
              const key = les.id + ':' + bi + ':' + qi; const ans = S.pyAns[key]; nq++; if (ans !== undefined) na++;
              return { q:q.q, answered:ans !== undefined, verdict:ans === q.a ? 'Right.' : 'Not quite.', whyCls:ans === q.a ? 'right' : 'wrong', why:q.why,
                opts:q.o.map((label, oi) => ({ label, cls:ans === undefined ? '' : 'lock ' + (oi === q.a ? 'right' : oi === ans ? 'wrong' : ''), pick:() => this.pyPick(key, oi) })) };
            });
          }
          return o;
        });
        const done = pyDoneAt(les.id) > 0;
        out.pyLessonNo = 'Lesson ' + (S.pyLs + 1) + ' of ' + lessons.length; out.pyGlyph = les.glyph; out.pyTitle = les.title;
        out.pyCanFinish = !done && na >= nq;
        out.pyFinishText = 'Finish lesson (+' + PY_COINS + ' coins)';
        out.pyFootWait = !done && na < nq; out.pyFootWaitText = 'Answer the questions above to finish this lesson (' + na + ' of ' + nq + ').';
        out.pyIsDone = done; out.pyDoneText = 'Lesson done' + (S.pyGain ? ' · ' + S.pyGain : '');
        const hasNext = S.pyLs + 1 < lessons.length;
        out.pyHasNext = done || !hasNext; out.pyNextText = hasNext ? 'Next: ' + lessons[S.pyLs + 1].title : 'Back to all lessons'; out.pyNextCls = done ? 'pri' : '';
      }
      if (out.pyIsChart) {
        const by = pyChartBy(); const cur = by[S.pyIni] || {};
        out.pyInis = PY_INIS.map(i => ({ label:i === '·' ? 'none' : i, cls:S.pyIni === i ? 'on' : '', pick:() => this.pyChartIni(i) }));
        const names = Object.keys(cur).sort();
        out.pyChartNote = (S.pyIni === 'y' ? 'y is how a syllable that starts with an i or ü sound is written (yi, ya, yue). ' : S.pyIni === 'w' ? 'w is how a syllable that starts with a u sound is written (wu, wo, wei). ' : S.pyIni === '·' ? 'Syllables with no initial: they start straight with the final. ' : '')
          + names.length + ' syllable' + (names.length === 1 ? '' : 's') + ' with this initial in HSK 1 to 4.';
        out.pySylls = names.map(n => ({ name:n.replace(/v/g, 'ü'), tones:[1, 2, 3, 4].map(t => {
          const e = cur[n][t]; const key = e ? 'py:chart:' + e.key : '';
          if (!e) return { cls:'off', mark:toMarks(n + t), zh:'·', label:n + t + ': no character in the lists', play:() => {} };
          return { cls:S.playing === key ? 'on' : '', mark:toMarks(n + t), zh:e.c, label:'Hear ' + toMarks(n + t) + ' (' + e.c + ')', play:() => { this.setState({ pyInfo:{ zh:e.c, py:toMarks(n + t), en:e.e + (e.w ? ' (in ' + e.w + ')' : '') } }); this.pySay(e.c, key); } };
        }) }));
        out.pyHasInfo = !!S.pyInfo; out.pyInfoZh = S.pyInfo ? S.pyInfo.zh : ''; out.pyInfoPy = S.pyInfo ? S.pyInfo.py : ''; out.pyInfoEn = S.pyInfo ? S.pyInfo.en : '';
      }
      return out;
    }

    // ----- pinyin course and the typing tutorial -----
    pySay = (text, key) => { try { this.say(text, key, 0.85); } catch (e) {} };
    goPinyin = () => { this.setState({ pyView:'list' }); this.go('pinyin'); };
    pyOpen = (i) => { this.setState({ pyView:'lesson', pyLs:i, pyAns:{}, pyGain:'' }); try { window.scrollTo(0, 0); } catch (e) {} };
    pyOpenId = (id) => { const i = (PYC.lessons || []).findIndex(l => l.id === id); this.setState({ pyView:i >= 0 ? 'lesson' : 'list', pyLs:Math.max(0, i), pyAns:{}, pyGain:'' }); this.go('pinyin'); };
    pyBack = () => { this.setState({ pyView:'list', pyGain:'' }); try { window.scrollTo(0, 0); } catch (e) {} };
    pyPick = (key, i) => { const S = this.state; if (S.pyAns[key] !== undefined) return; this.setState({ pyAns:Object.assign({}, S.pyAns, { [key]:i }) }); };
    pyFinish = () => {
      const S = this.state; const les = (PYC.lessons || [])[S.pyLs]; if (!les || pyDoneAt(les.id)) return;
      prefSet('pyc.' + les.id, Date.now());
      this.setState({ xp:S.xp + PY_COINS, dayXp:S.dayXp + PY_COINS, dayMin:S.dayMin + (les.mins || 3), pyGain:'+' + PY_COINS + ' coins' });
    };
    pyNext = () => { const S = this.state; const n = S.pyLs + 1; if (n < (PYC.lessons || []).length) this.pyOpen(n); else this.pyBack(); };
    pyChartIni = (ini) => { this.setState({ pyIni:ini, pyInfo:null }); };
    typToggle = () => { this.setState({ typOpen:!this.state.typOpen }); };
    typMarkSeen = () => { if (!typSeen()) prefSet('typT', Date.now()); };
    typDone = () => { this.typMarkSeen(); this.setState({ typOpen:false }); };
    typCourse = () => { this.typMarkSeen(); this.setState({ typOpen:false }); this.pyOpenId('typing'); };

    // ----- keeping the saved progress safe, offline and installable -----
    persistAsked = false;
    // Ask the browser not to clear this site's saved data (Chrome and Firefox may say yes; Safari decides on its own, mostly for installed apps).
    // The prompt (Firefox shows one) comes only once there is some progress to protect.
    ensurePersist = async (ask) => {
      try {
        if (!navigator.storage || !navigator.storage.persisted) return;
        let ok = await navigator.storage.persisted();
        if (!ok && ask && !this.persistAsked && navigator.storage.persist) { this.persistAsked = true; ok = await navigator.storage.persist(); }
        if (!!ok !== this.state.storagePersisted) this.setState({ storagePersisted:!!ok });
      } catch (e) {}
    };
    // one small card on Home at most: install the app (it protects the saved data and works offline), or make a backup when nothing syncs
    tipNow = () => {
      const S = this.state;
      if (S.screen !== 'home') return null;
      const t = tipRead(), day = 864e5, now = Date.now();
      const installDue = !isStandalone() && (isIos() || !!installEvt) && now - (t.install || 0) > 14 * day;
      const synced = !!((FR && FR.enabled() && FR.identity()) || SYNCCFG.token);
      const backupDue = !synced && now - (t.lastBackup || 0) > 14 * day && now - (t.backup || 0) > 7 * day;
      if (!installDue && !backupDue) return null;
      const words = memOf(S.ws).words;
      if (installDue && (words >= 5 || S.streak >= 2)) return { id:'install' };
      if (backupDue && words >= 20) return { id:'backup' };
      return null;
    };
    tipDismiss = () => { const t = this.tipNow(); if (t) tipStore(t.id, Date.now()); this.setState({ tipTick:(this.state.tipTick || 0) + 1 }); };
    tipInstall = async () => {
      if (installEvt) { try { installEvt.prompt(); await installEvt.userChoice; } catch (e) {} installEvt = null; }
      tipStore('install', Date.now()); this.setState({ tipTick:(this.state.tipTick || 0) + 1 });
    };
    // a new version was downloaded in the background (sw.js): switch to it when the person says so
    swReg = null; updating = false;
    updateNow = () => {
      this.persistNow(); this.updating = true;
      const w = this.swReg && this.swReg.waiting;
      if (w) w.postMessage('skip-waiting'); else { try { location.reload(); } catch (e) {} }
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
        tipStore('lastBackup', Date.now());
        this.setState({ tipTick:(this.state.tipTick || 0) + 1 });
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
      const synced = (FR && FR.enabled() && FR.identity()) || SYNCCFG.token;
      if (window.confirm((synced ? 'Your progress is also saved by sync, so this resets it on your other devices too, the next time they sync. ' : '') + (ALL ? 'Delete the progress of every level shown here (' + LVLS.map(n => 'HSK ' + n).join(' and ') + ') in this browser? Export it first if you want a copy.' : 'Delete all progress in this browser? Export it first if you want a copy.'))) {
        // A reset starts a new "epoch": the empty start is saved with a newer time stamp than any old progress, so syncing spreads the reset
        // to the other devices instead of bringing the old progress back (see merge() in sync.js).
        try {
          const SY = window.ShanluSync;
          (ALL ? LVLS : [LV]).forEach(n => { const st = readStore(n) || {}; lsSet(storeKey(n), JSON.stringify({ epoch:SY ? SY.nextEpoch(st.epoch) : 0 })); });
          if (ALL) localStorage.removeItem(KEY);
        } catch (e) {}
        this.frozen = true; clearTimeout(this.saveTimer);
        window.location.reload();
      }
    };
    // the level lock is a person's setting (saved with the rest, see level.js); the page reloads so the level list is worked out again
    setLock = (open) => {
      if (LVL.softLock() === open) return;
      prefSet('softLock', open); this.persistNow();
      try { window.location.reload(); } catch (e) {}
    };
    switchLevel = (n) => {
      if (n === LV) return;
      this.persistNow();
      try { localStorage.setItem('shanlu-level', String(n)); } catch (e) {}
      prefSet('level', n);
      window.location.reload();
    };
    toggleTheme = () => { this.setState({ theme:this.state.theme === 'dark' ? 'light' : 'dark' }); };

    aiVals() {
      const S = this.state;
      const aiEff = S.aiMode || !HAS_SCRIPTS;   // without practice scripts, Speak is the AI conversation only
      const quiet = !S.szh && !S.spy && !S.sen;
      const hasMic0 = S.asrMode === 'alibaba' ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)) : !!(window.webkitSpeechRecognition || window.SpeechRecognition);
      const vo = !!S.aiVoiceOnly && !S.aiTyping && hasMic0;   // voice only: Mingming's lines are heard, not read, until you tap Show text
      const lastAiIdx = (() => { for (let i = S.aim.length - 1; i >= 0; i--) if (S.aim[i].who === 'ai') return i; return -1; })();
      const msgs = S.aim.map((m, k) => ({
        who:m.who, isAi:m.who === 'ai', zh:m.zh, py:m.py, en:m.en,
        showZh:vo ? (m.who === 'me' || !!m.rev) : S.szh, showPy:vo ? (!!m.py && (m.who === 'me' || !!m.rev)) : S.spy && !!m.py, showEn:vo ? (!!m.rev && !!m.en && m.who === 'ai') : S.sen && !!m.en && m.who === 'ai',
        canReveal:vo && m.who === 'ai' && !m.rev, reveal:() => this.aiReveal(k), canSlow:vo && m.who === 'ai' && k === lastAiIdx, slower:() => this.aiSlower(k),
        hasMem:!!m.mem, memText:m.mem || '',
        quiet:vo ? (m.who === 'ai' && !m.rev) : quiet, quietText:m.who === 'ai' ? 'Listen to Mingming' : 'You said it', pc:S.playing === 'aim' + k ? 'on' : '', play:() => this.aiPlay(k),
        hasOutside:m.outside.length > 0, outsideText:'Not in this site\'s ' + (TOPL <= 2 ? 'HSK 1 or HSK 2' : LV_NAMES.slice(0, -1).join(', ') + ' or ' + LV_NAMES[LV_NAMES.length - 1]) + ' lists, so no pinyin: ' + m.outside.join(' '),
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
        retOpts:[[0.9, '90% (recommended)'], [0.85, '85%'], [0.8, '80%']].map(o => ({ label:o[1], cls:Math.abs(retention() - o[0]) < 0.001 ? 'on' : '', fn:() => this.setRetention(o[0]) })),
        tonesLabel:tonesOptional() ? 'Optional (beginner)' : 'Required', tonesCls:tonesOptional() ? '' : 'on', toggleTones:this.toggleTones,
        personSyncOn:!!(FR && FR.enabled() && FR.identity()), personSyncOff:!(FR && FR.enabled() && FR.identity()),
        keySyncCls:S.syncKeys ? 'on' : '', keySyncLabel:S.syncKeys ? 'On: my keys follow me' : 'Off: keys stay on each device', keySyncToggle:this.keySyncToggle,
        ...(() => {
          const SX = window.ShanluSecrets, sec = PERSON.secrets && PERSON.secrets.v;
          const sealed = !!(sec && SX && SX.isSealed(sec)), plain = !!(sec && !sealed && typeof sec === 'object' && (sec.key || sec.aliKey));
          const ready = !!AICFG.syncPass && S.keyLock !== 'wrong';
          const mode = !S.syncKeys ? 'off' : ready ? 'ready' : sealed ? 'unlock' : 'set';
          const ask = mode === 'set' || mode === 'unlock' || (mode === 'ready' && !!S.keyChanging);
          const msg = S.keyMsg || (mode === 'unlock' ? (S.keyLock === 'wrong' ? 'The passphrase on this device no longer opens the saved keys (it was changed on another device). Enter the new one.' : 'Your keys are saved, encrypted. Enter your passphrase to use them on this device.') : (mode === 'set' && plain ? 'Your keys are stored on the server the older way, without a passphrase. Set one now to encrypt them.' : ''));
          return { keyOn:S.syncKeys === true, keyAsk:ask, keyReady:mode === 'ready' && !S.keyChanging, keyMsgShow:!!msg, keyMsgText:msg,
            keyPassInput:S.keyPassInput || '', onKeyPassInput:(e) => this.setState({ keyPassInput:e.target.value }), keyPassGo:this.keyPassGo, keyChange:this.keyChange,
            keyAskHint:mode === 'unlock' ? 'Your key passphrase' : 'Choose a passphrase (8+ characters)', keyGoLabel:S.keyBusy ? 'One moment…' : mode === 'unlock' ? 'Unlock my keys' : mode === 'ready' ? 'Change passphrase' : 'Encrypt and save my keys' };
        })(),
        lsnLine:'Listening level ' + S.lsnLvl + ' of 5 · ' + LSN_LEVELS[S.lsnLvl - 1].name, lsnEasier:() => this.lsnStep(-1), lsnHarder:() => this.lsnStep(1), lsnAutoLabel:'Auto-adjust: ' + (S.lsnAuto ? 'on' : 'off'), lsnAutoToggle:this.lsnAutoToggle,
        lsnNote:S.lsnNote, hasLsnNote:!!S.lsnNote, aiHfLabel:'Hands-free: ' + (S.handsFree ? 'on' : 'off'), aiHfToggle:this.aiHfToggle,
        memOnLabel:S.memOn ? 'On: Mingming remembers' : 'Off: nothing is kept', memCls:S.memOn ? 'on' : '', memToggle:this.memToggle, memClear:this.memClear, hasMemFacts:S.memFacts.length > 0, noMemFacts:S.memFacts.length === 0,
        memList:S.memFacts.map((f, i) => ({ t:f.t, d:f.d || '', forget:() => this.memForget(i) })),
        aiVo:vo, aiNotVo:!vo, aiVoToggleLabel:vo ? 'Type instead' : 'Voice only', aiVoToggle:this.aiVoToggle, aiCanVo:hasMic0,
        ttsOpts:[['qwen', 'Alibaba Qwen voice (needs an Alibaba key or the group\'s shared AI)'], ['browser', 'This browser\'s own voice']].map(o => ({ label:o[1], cls:S.ttsMode === o[0] ? 'on' : '', fn:() => this.setTtsMode(o[0]) })),
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
        hasRelay:relayShown().show, relayText:relayShown().text,
        aliSet:S.aliOn, aliUnset:!S.aliOn, aliKeyInput:S.aliKeyInput, onAliKeyInput:(e) => this.setState({ aliKeyInput:e.target.value }),
        aliWsInput:S.aliWsInput, onAliWsInput:(e) => this.setState({ aliWsInput:e.target.value }), aliModelInput:S.aliModelInput, onAliModelInput:(e) => this.setState({ aliModelInput:e.target.value }),
        aliModelOpts:ALI_MODELS.map(m => ({ label:m[1], cls:S.aliModelInput === m[0] ? 'on' : '', fn:() => this.aliPreset(m[0]) })),
        aliCanUse:S.aliOn && S.aiProvider !== 'alibaba', aiCanUse:!!AICFG.key && S.aiProvider === 'alibaba', useAli:() => this.setProvider('alibaba'), useAnth:() => this.setProvider('anthropic'),
        aiTestKey:this.aiTestKey, aiTestLabel:S.aiTesting ? 'Testing…' : 'Test connection', aliSaveKey:this.aliSaveKey, aliRemoveKey:this.aliRemoveKey, aliTest:this.aliTest, aliTestLabel:S.aliTesting ? 'Testing…' : 'Test connection', aliNote:S.aliNote, hasAliNote:!!S.aliNote,
        asrOpts:[['browser', 'This browser\'s own recogniser'], ['alibaba', 'Alibaba Qwen3-ASR (needs an Alibaba key or the group\'s shared AI)']].map(o => ({ label:o[1], cls:S.asrMode === o[0] ? 'on' : '', fn:() => this.setAsr(o[0]) }))
      };
    }

    examVals() {
      const S = this.state, m = S.exm;
      const secName = (s) => (s === 'listening' ? 'Listening' : s === 'writing' ? 'Writing' : 'Reading');
      const hist = (S.exams || []).slice(-5).reverse().map(h => {
        const pts = (h.l != null ? secPts(h.l, h.lt || 20) : 0) + (h.r != null ? secPts(h.r, h.rt || 20) : 0);
        const what = h.mode === 'full' ? 'Full exam' : h.mode === 'writing' ? 'Writing practice' : secName(h.mode);
        const parts = [];
        if (h.l !== null && h.l !== undefined) parts.push('Listening ' + h.l + '/' + (h.lt || 20));
        if (h.r !== null && h.r !== undefined) parts.push('Reading ' + h.r + '/' + (h.rt || 20));
        if (h.w !== null && h.w !== undefined) parts.push('Writing ' + h.w + '/' + (h.wt || 10));
        return { text:new Date(h.at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' · ' + what, score:h.mode === 'full' ? pts + ' / 200' : parts.join(' '), detail:h.mode === 'full' ? parts.join(' · ') : '' };
      });
const chartAll = (S.exams || []).filter(h => h.mode === 'full').slice(-6).map(h => { const pts = (h.l != null ? secPts(h.l, h.lt || 20) : 0) + (h.r != null ? secPts(h.r, h.rt || 20) : 0); const pct = Math.round(pts / 2); return { pct, label:pct + '%', date:new Date(h.at).toLocaleDateString('en-US', { month:'short', day:'numeric' }), barH:Math.round(pct * 1.6) + 'px', cls:pct >= 60 ? 'pass' : '' }; });
      const v = {
        examAvailable:!!EXAMBANK, exHome:!m, exRun:!!m && m.stage === 'run', exBreak:!!m && m.stage === 'break', exResult:!!m && m.stage === 'result',
        startFull:() => this.startExam('full'), startListening:() => this.startExam('listening'), startReading:() => this.startExam('reading'), startWriting:() => this.startExam('writing'), examHasWriting:HAS_WRITING,
        histChart:chartAll, hasChart:chartAll.length > 0, chartNote:chartAll.length > 1 ? (chartAll[chartAll.length - 1].pct >= chartAll[0].pct ? '+' : '') + (chartAll[chartAll.length - 1].pct - chartAll[0].pct) + ' points since ' + chartAll[0].date : 'Your first full exam is on the chart.',
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
        const picks = (m.picks && m.picks[q.id]) || [];
        const taken = {};
        if (q.kind === 'match') m.qs.forEach(o => { if (o.part === q.part && o.id !== q.id && m.ans[o.id] !== undefined) taken[m.ans[o.id]] = true; });
        Object.assign(v, {
          exSection:secName(m.sec) + ' · Part ' + PART[q.part].n, exInst:PART[q.part].inst, exN:m.i + 1, exTotal:m.qs.length,
          exTimer:Math.floor(left / 60000) + ':' + pad(Math.floor(left / 1000) % 60), exTimerCls:left < 60000 ? 'warn' : '',
          exListen:!!q.audio, exPlaysLeft:2 - used, exCanPlay:used < 2, exPlayDis:used < 2 ? 'false' : 'true', exPlayCls:S.playing === 'exq' ? 'on' : '', exPlay:this.exPlay,
          exHasPic:!!q.pic && !exPhoto(q.pic), exPic:q.pic || '', exHasPhoto:!!exPhoto(q.pic), exPhoto:exPhoto(q.pic) ? exPhoto(q.pic).u : '', exPhotoAlt:exPhoto(q.pic) ? exPhoto(q.pic).a : '', exHasText:!!q.text, exText:q.text || '',
          exHasHint:!!q.hint, exHint:q.hint ? 'Pinyin: ' + q.hint : '', exIsType:q.kind === 'type', exTypedVal:(m.typed && m.typed[q.id]) || '', exType:this.exType,
          exIsOrder:q.kind === 'order', exBuilt:picks.map(k => q.opts[k].label).join('') || '＿＿＿＿', exClear:this.exClearPicks, exCanClear:picks.length > 0,
          exOpts:q.opts.map((o, k) => ({ letter:(q.kind === 'tf' || q.kind === 'order') ? '' : LETTERS[k], label:o.label, emo:!!o.emoji, hasImg:!!(o.emoji && exPhoto(o.label)), noImg:!(o.emoji && exPhoto(o.label)), img:o.emoji && exPhoto(o.label) ? exPhoto(o.label).u : '', alt:o.emoji && exPhoto(o.label) ? exPhoto(o.label).a : '', big:(q.kind === 'pic' || o.emoji) ? 'true' : '',
            cls:((q.kind === 'order' ? picks.indexOf(o.v) >= 0 : chosen === o.v) ? 'on ' : '') + (taken[o.v] ? 'used ' : ''), pick:() => this.exPick(o.v) })),
          exOptsCls:'k-' + q.kind, exPal:m.qs.map((o, k) => ({ n:k + 1, cls:(k === m.i ? 'cur ' : '') + (m.ans[o.id] !== undefined ? 'done' : ''), go:() => this.exGo(k) })),
          exPrev:() => this.exGo(m.i - 1), exNext:() => this.exGo(m.i + 1), exCanPrev:m.i > 0, exCanNext:m.i < m.qs.length - 1,
          exSubmit:() => this.exSubmit(false), exSubmitLabel:'Submit ' + secName(m.sec).toLowerCase(), exOpen:m.qs.filter(o => m.ans[o.id] === undefined).length,
          hasConfirm:!!m.confirm, exConfirmMsg:m.qs.filter(o => m.ans[o.id] === undefined).length + ' question(s) are unanswered. Press submit again to finish anyway.'
        });
      }
      if (m.stage === 'result') {
        const secs = ['listening', 'reading', 'writing'].filter(s => m.results[s]).map(s => {
          const r = m.results[s]; const pct = Math.round(100 * r.correct / r.total);
          return { name:secName(s), text:r.correct + ' of ' + r.total, pts:secPts(r.correct, r.total) + ' / 100', pct:pct + '%', ok:pct >= LVL.PASS_PCT, cls:pct >= LVL.PASS_PCT ? 'good' : 'low', auto:r.auto,
            parts:Object.keys(r.byPart).map(p => ({ name:'Part ' + PART[p].n, score:r.byPart[p].c + ' / ' + r.byPart[p].t, cls:r.byPart[p].c === r.byPart[p].t ? 'good' : '' })) };
        });
        const total = ['listening', 'reading'].reduce((n, s) => n + (m.results[s] ? secPts(m.results[s].correct, m.results[s].total) : 0), 0);
        const seal = m.mode !== 'writing' && secs.length > 0 && secs.every(s => s.ok);
        const wrong = [];
        ['listening', 'reading', 'writing'].forEach(s => { if (m.results[s]) m.results[s].wrong.forEach(w => wrong.push(w)); });
        Object.assign(v, {
          exSecs:secs, exFull:m.mode === 'full', exSingle:m.mode !== 'full', exTotal200:total + ' / 200', exPassReal:total >= 120,
          exVerdict:m.mode === 'writing' ? 'Writing is practice here. The site cannot mark handwriting, so it is not part of the 200 points or the seal.' : m.mode === 'full' ? (total >= 120 ? 'At or above 120 of 200, the pass mark of the official ' + LVN + ' test.' : 'Below 120 of 200, the pass mark of the official ' + LVN + ' test.') : 'One section only. The official pass mark is on the total of both sections.',
          exUnlock:seal && m.mode === 'full' && LV < LVL.MAX_LEVEL, exUnlockText:'You passed the ' + LVN + ' level exam. HSK ' + (LV + 1) + ' is now open.', exUnlockGo:() => this.switchLevel(LV + 1), exUnlockGoText:'Go to HSK ' + (LV + 1),
          exSeal:seal, exNoSeal:!seal, exSealText:m.mode === 'writing' ? 'Writing practice does not count toward the seal. The seal needs ' + LVL.PASS_PCT + '% in listening and in reading.' : seal ? (m.mode === 'full' ? 'You reached ' + LVL.PASS_PCT + '% in every section. That is this site\'s bar for the ' + LVN + ' seal.' : 'You reached ' + LVL.PASS_PCT + '% in the section you took. Take the full exam to open the next level.') : 'The seal here needs 80% in every section. Review the questions below and try again.',
          exWrong:wrong.map(w => ({ n:w.n, part:'Part ' + PART[w.q.part].n, zh:w.q.rev.zh, py:w.q.rev.py, en:w.q.rev.en, pic:w.q.rev.pic || '', hasPic:!!w.q.rev.pic && !exPhoto(w.q.rev.pic), hasPhoto:!!exPhoto(w.q.rev.pic), photo:exPhoto(w.q.rev.pic) ? exPhoto(w.q.rev.pic).u : '', photoAlt:exPhoto(w.q.rev.pic) ? exPhoto(w.q.rev.pic).a : '',
            right:w.q.right, yours:w.yours === undefined ? 'No answer' : (w.q.kind === 'order' || w.q.kind === 'type') ? String(w.yours) : (w.q.opts.find(o => o.v === w.yours) || { label:'' }).label })), hasWrong:wrong.length > 0, perfect:wrong.length === 0,
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

      // the end-of-session celebration: how it went, in words that fit
      const rc = S.rcounts || {}; const rcN = (rc.again || 0) + (rc.hard || 0) + (rc.good || 0) + (rc.easy || 0);
      const rcAccN = rcN ? Math.round(((rc.good || 0) + (rc.easy || 0)) / rcN * 100) : 0;
      const rcAcc = rcAccN + '%';
      const rcPick = (list) => list[(S.rtotal + (S.rdone || 0)) % list.length];
      const rcHead = rcAccN >= 90 ? rcPick(['Flawless focus!', 'Superb session!', 'That was sharp!']) : rcAccN >= 70 ? rcPick(['Great session!', 'Nicely done!', 'Solid work!']) : rcAccN >= 40 ? rcPick(['Session complete!', 'Good effort, that counts!', 'You showed up, and it shows!']) : rcPick(['Done, and the misses are the learning', 'Tough one, and you finished it', 'Hard words are where memory grows']);
      const rcSub = rcAccN >= 90 ? 'Almost everything stuck. Those words will come back after longer gaps.' : rcAccN >= 70 ? 'Most of it is sticking. The ones you missed will be back soon.' : 'Words you missed will come back sooner. Seeing them again is how they stick.';
      const active = S.screen === 'quiz' ? (S.qmode === 'greview' ? 'greview' : isG(S.qmode) ? 'grammar' : 'testlobby') : S.screen === 'plesson' ? 'path' : S.screen;
      const navCls = (k) => 'nav' + (active === k ? ' on' : '');
      // onboarding: who sees what (the browser tests run without it; see ONB_OFF)
      const onb = onbRead(); const onbOn = !ONB_OFF() && LV === 1;
      const noProg = totalXp(S) === 0 && startedCount === 0 && Object.keys(S.lrn || {}).length === 0;
      const flown = (() => { const j = jyRead(); return !!(j && j.seen && j.seen.length); })();   // the first flight has happened
      const guideAvail = true;   // the reference page is always one tap away
      // the first-visit flow: which step is on screen ('' once it is over, or for anyone with progress)
      const flowOn = onbOn && noProg && !onb.w && onb.p !== 'done';
      let obPh = flowOn ? (onb.p || 'intro') : '';
      if (obPh === 'fly' && flown) obPh = 'guide';
      // each card shows a real screenshot of the screen it talks about (tour/*.jpg, made by tools/make-tour-shots.js); w and h are its size in pixels
      const obCards = [
        { zh:'见', tag:'Meet', title:'Meet a few words at a time', body:'The Path winds through small stops: a handful of related words, then a Grammar lesson, then Speaking practice. You meet each word, then try it. Meeting a word is not the same as knowing it.', chips:['Path', 'Grammar', 'Speaking', 'Archive'], img:'tour/path.jpg', w:748, h:760, alt:'The Path: a winding trail of word stops, grammar stops and speaking stops, some done and some still ahead' },
        { zh:'记', tag:'Recall', title:'Review brings them back in time', body:'Pick the meaning, then type it. Review returns each word just as you are about to forget it. Be honest with the buttons: Again, Hard, Good or Easy.', chips:['Review', 'My words'], img:'tour/review.jpg', w:748, h:802, alt:'A Review card showing a word, its meaning and the Again, Hard, Good and Easy buttons' },
        { zh:'用', tag:'Use', title:'Then use them', body:'Grammar lessons, listening and speaking practice. Today on Home plans a short session around your daily goal.', chips:['Grammar', 'Listening', 'Speak'], img:'tour/today.jpg', w:748, h:722, alt:'Today on Home: the daily goal, the plan button and more ways to study' },
        { zh:'路', tag:'Coins and Journey', title:'Coins take you somewhere real', body:'Everything you study earns coins. Spend them travelling to places across China, and collect passport stamps and souvenirs along the way. Your first stop was free, and you have already taken it.', chips:['Journey', 'Passport stamps', 'Souvenirs'], img:'tour/journey.jpg', w:748, h:847, alt:'A map of China with stamped regions and flight lines, a passport page of stamps and a shelf of souvenirs' },
        { zh:'友', tag:'Yours to keep', title:'Saved here, shared only if you say so', body:'Your progress lives in this browser, with a backup and sync in Settings. A friends group only ever sees your study totals.', chips:['Backup', 'Sync', 'Friends'], img:'tour/friends.jpg', w:748, h:723, alt:'The Friends board: three people with their minutes this week and streaks' }
      ];
      const obC = obCards[Math.max(0, Math.min(4, S.obCard || 0))];
      const frOn = !!(FR && FR.enabled());
      const pyN = (PYC.lessons || []).filter(l => pyDoneAt(l.id)).length;
      const obSoundsShow = onbOn && S.screen === 'home' && !flowOn && onb.l === 'new' && !onb.px && pyN === 0 && (PYC.lessons || []).length > 0 && noProg;
      const startShow = onbOn && S.screen === 'home' && !flowOn && ((!onb.s && noProg) || (onb.s === 'go' && !S.rcomplete));
      const startGoing = onb.s === 'go' && S.rq.length > 0 && !S.rcomplete;
      const startWords = START_WORDS.filter(z => BANK[z]).map(z => ({ zh:z, py:BANK[z].py, en:BANK[z].en.split(',')[0] }));
      const startDoneShow = onbOn && onb.s === 'done' && onb.d === ymd(new Date()) && S.rcomplete;   // the end of the first session: what to do next
      // phones: five tabs, each opening a section whose screens are one tap away in a strip under the header
      const GROUPS = [['home', ['home']], ['learn', ['path', 'library']], ['review', ['review', 'greview', 'testlobby']], ['talk', ['listen', 'speak']], ['journey', ['journey']]];
      const SUBOF = { words:'library', grammar:'library', web:'library', pinyin:'library', exam:'path' };   // pages reached from another page of the same tab: that page stays lit
      const BRANCH = ['acct', 'friends', 'ach', 'voice', 'guide'];   // reached from the Account page (the avatar) or the quiet "You" links, not from a tab
      const SUBLABEL = { path:'Path', library:'Library', review:'Words', greview:'Grammar', testlobby:'Test', listen:'Listening', speak:'Speaking', home:'Today', journey:'Journey' };
      const curScreen = S.screen === 'quiz' ? (S.qmode === 'greview' ? 'greview' : isG(S.qmode) ? 'grammar' : 'testlobby') : S.screen === 'plesson' ? 'path' : S.screen;
      const hlScreen = SUBOF[curScreen] || curScreen;
      const navGroup = BRANCH.indexOf(curScreen) >= 0 ? '' : (GROUPS.find(g => g[1].indexOf(hlScreen) >= 0) || GROUPS[0])[0];
      const inBranch = BRANCH.indexOf(curScreen) >= 0;
      const gcls = (id) => 'nav' + (navGroup === id ? ' on' : '');
      const subnavItems = ((GROUPS.find(g => g[0] === navGroup) || [0, []])[1]).map(id => [id, SUBLABEL[id]]);

      // friends board
      const frIdent = FR && FR.enabled() ? FR.identity() : null;
      const frToday = ymd(new Date());
      const frRows = S.fr ? window.ShanluFriends.sortRows(S.fr.members.map(m => window.ShanluFriends.boardRow(m, frToday, S.fr.me)), S.frSort) : [];
      const frWeekMin = frRows.reduce((a, r) => a + r.minutes, 0);
      const frBarMax = Math.max(100, ...frRows.map(r => r.minutes));
      const frMe = frRows.find(r => r.isMe), frLead = frRows.slice().sort((p, q) => q.minutes - p.minutes)[0];
      const frNudge = frMe && frLead && !frLead.isMe && frLead.minutes > frMe.minutes ? (frLead.minutes - frMe.minutes) + ' min behind ' + frLead.name : (frMe && frLead && frLead.isMe && frRows.length > 1 ? 'You lead this week' : '');
      const frGoal = Math.max(1, frRows.length) * 100;
      const frAgo = S.frAt ? Math.max(0, Math.round((Date.now() - S.frAt) / 60000)) : 0;
      const frSorts = [['week', 'This week'], ['streak', 'Streak'], ['mem', 'In memory']];
      const frVals = {
        frJoined:!!frIdent, frNotJoined:!!(FR && FR.enabled()) && !frIdent, frOff:!(FR && FR.enabled()),
        frName:S.frName, frErr:S.frErr, frHasErr:!!S.frErr, frMsg:S.frMsg, frHasMsg:!!S.frMsg, frBusy:S.frBusy, frJoinText:S.frBusy ? 'Joining…' : 'Join group',
        onFrName:(e) => this.setState({ frName:e.target.value }), friendsJoin:this.friendsJoin, frLinkIn:S.frLinkIn, onFrLink:(e) => this.setState({ frLinkIn:e.target.value }), friendsSignInLink:this.friendsSignInLink, frSignText:S.frLinkBusy ? 'Signing in…' : 'Sign in with my link',
        frLoaded:!!S.fr, frWaiting:!!frIdent && !S.fr, frMine:frIdent ? frIdent.name : '', frGroup:frIdent ? frIdent.group : '',
        frNudge, frHasNudge:!!frNudge, frNudgeSub:frNudge.indexOf('behind') > 0 ? 'A short session closes the gap.' : 'Keep it up. The week resets on Monday.',
        frWeekMin, frGoal, frGoalPct:Math.min(100, Math.round(frWeekMin / frGoal * 100)) + '%', frGoalText:frWeekMin + ' of ' + frGoal + ' min',
        frSortOpts:frSorts.map(x => ({ label:x[1], cls:S.frSort === x[0] ? 'on' : '', fn:() => this.setState({ frSort:x[0] }) })),
        frRows:frRows.map((r, i) => ({
          name:r.name, initial:r.initial, avCls:'c' + (i % 4), isMe:r.isMe, you:r.isMe ? 'You' : r.name, hasLv:r.level > 0, lvTag:'HSK ' + r.level, lvCls:'cur l' + r.level,
          rank:i + 1, barW:Math.min(100, Math.round(r.minutes / frBarMax * 100)) + '%', strip:r.week.map(m => ({ cls:m > 0 ? 'on' : '' })), studied:r.studiedToday, cls:r.isMe ? 'me' : '',
          minutes:r.hasStats ? r.minutes + ' min' : 'New', sub:(r.hasStats ? (r.streak > 0 ? r.streak + ' day streak' : 'No streak yet') + ' · ' + r.mem + ' in memory' + (r.jy ? ' · ' + r.jy.n + (r.jy.n === 1 ? ' stop' : ' stops') + ' traveled' : '') : 'Has not shared yet') + (r.isMe && r.cheers > 0 ? ' · ' + r.cheers + (r.cheers === 1 ? ' cheer' : ' cheers') + ' for you' : ''),
          canCheer:!r.isMe, cheerCls:r.cheered ? 'on' : '', hasCheers:r.cheers > 0, cheers:r.cheers, cheerLabel:(r.cheered ? 'You cheered ' : 'Cheer for ') + r.name, cheer:() => this.friendsCheer(r.id)
        })),
        frStudied:frRows.filter(r => r.studiedToday).length, frCount:frRows.length,
        frAvatars:frRows.slice(0, 8).map((r, i) => ({ initial:r.initial, cls:'fav c' + (i % 4) + (r.studiedToday ? ' done' : ' idle'), name:r.name + (r.studiedToday ? ' studied today' : ' has not studied today') })),
        frHomeShow:!!frIdent && !!S.fr && S.screen === 'home', frHomeText:frRows.filter(r => r.studiedToday).length + ' of ' + frRows.length + ' studied today',
        goFriendsHome:() => { this.go('friends'); this.friendsRefresh(false); },
        frSyncText:S.syncBadMsg ? 'Your progress could not sync: ' + S.syncBadMsg : (this.syncInfo && this.syncInfo.ok ? 'Progress last synced on this device ' + (Math.round((Date.now() - this.syncInfo.at) / 60000) < 1 ? 'just now' : Math.round((Date.now() - this.syncInfo.at) / 60000) + ' min ago') + '.' : 'Progress has not synced on this device yet in this session.'),
        frSyncBad:!!S.syncBadMsg, frSyncNow:this.friendsSyncNow, frSyncLabel:S.frSyncing ? 'Syncing…' : 'Sync now',
        frUpdated:S.fr ? (frAgo < 1 ? 'Updated just now' : 'Updated ' + frAgo + ' min ago') : '', frRefresh:() => this.friendsRefresh(true),
        frLinkText:S.frCopied ? 'Copied' : 'Copy my link', frCopy:this.friendsCopyLink, frMyLink:frIdent ? window.ShanluFriends.makeLink(location.href, frIdent) : '',
        frLeaveText:S.frLeaveAsk ? 'Tap again to leave' : 'Leave group', frLeave:this.friendsLeave, frTest:this.friendsTest, frTestLabel:S.frTesting ? 'Testing…' : 'Test connection',
        frOffText:'The friends board is not set up yet. Add the address of your friends server to config.js (see worker/README.md).'
      };

      // the Achievements page: every achievement by group, earned ones lit, the rest with a hint and (where it makes sense) a bar
      let achItems = [], achSummary = '', achPct = '0%', achNext = [];
      if (S.screen === 'ach') {
        const have = prefGet('ach', {}) || {}; const am = this.achMetrics(); am.ev = {};
        const earnedN = MILESTONES.filter(x => have[x.id]).length;
        achSummary = earnedN + ' of ' + MILESTONES.length + ' earned'; achPct = Math.round(earnedN / MILESTONES.length * 100) + '%';
        const af = S.achf || 'all'; const nextUp = [];
        AGROUPS.forEach(g => {
          const list = MILESTONES.filter(x => x.grp === g); if (!list.length) return;
          const shelf = [];
          list.forEach(x => {
            const got = !!have[x.id]; let pr = null; try { pr = !got && x.prog ? x.prog(am) : null; } catch (e) {}
            const pc = pr && pr[1] > 0 ? Math.max(0, Math.min(100, Math.round(pr[0] / pr[1] * 100))) : 0;
            if (!got && pr && pc > 0 && pc < 100) nextUp.push({ icon:x.icon, title:x.title, sub:x.hint, pc, barTxt:Math.min(pr[0], pr[1]).toLocaleString('en-US') + ' of ' + pr[1].toLocaleString('en-US'), ring:pc + '%' });
            if (af === 'earned' && !got) return; if (af === 'locked' && got) return;
            shelf.push({ isHead:false, isCard:true, cls:got ? 'got' : 'lock', ring:got ? '100%' : pc + '%', icon:x.icon, title:x.title, desc:got ? x.desc : x.hint, hasBar:!!pr && !got, barW:pc + '%', barTxt:pr ? Math.min(pr[0], pr[1]).toLocaleString('en-US') + ' / ' + pr[1].toLocaleString('en-US') : '', state:got ? 'Earned' : 'Not yet' });
          });
          if (!shelf.length) return;
          achItems.push({ isHead:true, head:g, headSub:list.filter(x => have[x.id]).length + ' of ' + list.length, isCard:false });
          shelf.forEach(x => achItems.push(x));
        });
        nextUp.sort((p, q) => q.pc - p.pc);
        achNext = nextUp.slice(0, 3);
      }
      const titles = {
        home:startShow ? ['Welcome to Shanlu', 'Five words, about five minutes. You do not pick anything.'] : ['Today', S.dayMin >= S.mins ? 'Daily goal reached. Anything else is a bonus.' : (S.mins - S.dayMin) + ' min to go for today\'s goal.'],
        review:['Review', 'Words that are due, based on how well you remember them.'],
        library:['Library', 'Everything you can look up: words, grammar, topics and sounds.'],
        greview:['Grammar review', 'A short daily session on the grammar points you have met, weakest first.'],
        testlobby:[LVN + ' test', 'Mixed questions from the words you have started, so you are recalling words, not just recognizing them.'],
        grammar:['Grammar', ALL ? LESSONS.length + ' lessons from every unlocked level, one at a time.' : LV === 1 ? LESSONS.length + ' lessons that cover the HSK 1 grammar outline, one at a time.' : LESSONS.length + ' lessons on the grammar of the ' + LVN + ' words, one at a time.'],
        speak:['Speaking practice', HAS_SCRIPTS ? 'Say a short conversation out loud.' : 'Talk with Mingming, the AI conversation partner.'],
        exam:[ALL ? 'Level exams' : LVN + ' level exam', ALL ? 'Each exam belongs to one level.' : LV === 1 ? 'Pass every section to climb to HSK 2.' : 'Not built yet for ' + LVN + '.'],
        path:['Your path', 'Words and grammar in order, from the basics up. The next stop is always one tap away.'],
        plesson:[S.pl && STOP_BY[S.pl.id] ? stopTitle(STOP_BY[S.pl.id].st) : 'Lesson', 'Meet the words, try them, then check them.'],
        acct:['Account', 'You, your numbers, and the settings behind Shanlu.'],
        web:S.wmode === 'char' ? ['Shared character', 'Words built from the same character, side by side. New words are best learned on your path.'] : S.wmode === 'opp' ? ['Word pairs', 'Opposites and look-alike words, side by side. New words are best learned on your path.'] : ['Topics', 'Every topic, to browse and review. New words are best learned on your path.'],
        words:['My words', 'How well you know each word, and when it needs a refresh.'],
        pinyin:['Pinyin and tones', 'Sounds, tones and the spelling rules, with audio you can tap.'],
        ach:['Achievements', 'Things you have earned, and what is still ahead.'],
        guide:['How Shanlu works', 'The daily loop, what each part is for, and where your progress lives.'],
        journey:['Journey', 'Spend the coins you earn on trips through the Chinese-speaking world.'],
        friends:['Friends', FR && FR.identity() && FR.identity().group ? FR.identity().group + '. Only your study totals are shared.' : 'Study together. Only your study totals are shared.'],
        listen:['Listening lab', HAS_LISTEN ? 'Train your ear for how people really talk, not just how lessons sound.' : 'Not built yet for ' + LVN + '.'],
        voice:['Settings', LV <= 1 ? 'Sync your progress between devices, choose the level and the voice that reads Chinese aloud, and how 儿 endings are shown.' : 'Sync your progress between devices, choose the level and the voice that reads Chinese aloud.'],
        quiz:S.qmode === 'greview' ? ['Grammar review', 'Points you are weakest on come first. Write your own sentence when it asks: that is how a point becomes mastered.'] : S.qmode === 'grammar' ? ['Grammar practice', LESSONS[S.glesson].title] : [LVN + ' test', 'Take your time. Wrong answers show you why.']
      };
      const tt = titles[S.screen];

      // week strip (Monday first)
      const now = new Date();
      const dow = (now.getDay() + 6) % 7;
      const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
        const d = new Date(now); d.setDate(now.getDate() - dow + i);
        const key = ymd(d);
        return { l, cls:S.activity[key] ? 'd' : (key === today ? 't' : ''), img:artUri('lantern', S.activity[key] ? 'on' : 'off') };
      });

      // home
      const C = 2 * Math.PI * 46;
      const ringDash = (Math.min(S.dayMin / S.mins, 1) * C).toFixed(1) + 'px ' + C.toFixed(1) + 'px';
      const nextLesson = Math.max(0, LESSONS.findIndex(L => (S.gres[L.id] || 0) < 80));
      const nextScn = Math.max(0, SCEN.findIndex(sc => !S.sres[sc.id]));
      const grvAllI = (() => { const greg = gptReg(); return Object.keys(greg).filter(id => gptOpen(S, id)).map(id => gptInfo(S.gpt[id])); })();   // grammar points open to review (their lesson is passed)
      const grvOpenToday = grvAllI.length, grvDueToday = grvAllI.filter(i => i.due).length;
      // Today's plan: a step on the Path comes first every day, then the words and grammar points that are due. Everything else is a shortcut under "More ways to study".
      const pathLvNow = PATH_LVLS.length ? pathFirstOpen(S) : 0;
      const pathStep = pathLvNow ? pathNext(S, pathLvNow) : null;   // the next stop of the path, whatever its kind
      const pathDoneToday = Math.max(0, pathDoneCount(S) - (S.pbase == null ? pathDoneCount(S) : S.pbase));
      const stopMeta = (st) => st.k === 'w' ? (() => { const n = stopWords(st).filter(z => !wStarted(S, z)).length; return n === 1 ? '1 new word' : n + ' new words'; })() : st.k === 's' ? 'Speaking scene' : 'Grammar lesson';
      const dueWordsN = BANK_KEYS.filter(zh => { const i = winfo(S.ws[zh], 0); return i.started && i.dueN <= 0; }).length;   // the same count My words shows: words, not the cards left in this session
      const planRows = [];
      if (pathStep || pathDoneToday > 0) planRows.push({ glyph:'路', title:pathDoneToday > 0 ? 'Path: ' + (pathDoneToday === 1 ? 'a step' : pathDoneToday + ' steps') + ' done' : 'Path: ' + stopTitle(pathStep.st), meta:pathDoneToday > 0 ? (pathStep ? 'Next: ' + stopTitle(pathStep.st) : 'You have walked the whole path') : stopMeta(pathStep.st), done:pathDoneToday > 0,
        run:pathStep ? () => { this.go('path'); this.setState({ pstop:pathStep.st.id }); } : () => this.go('path') });
      if (dueWordsN > 0 || S.rq.length > 0 || S.rcomplete) planRows.push({ glyph:'词', title:'Review words', meta:dueWordsN > 0 ? dueWordsN + (S.rcomplete ? ' still due' : ' due') : 'All caught up', done:S.rcomplete && dueWordsN === 0,
        run:() => { if (!S.rq.length && dueWordsN > 0) this.reviewMore(); this.go('review'); } });
      if (grvOpenToday > 0) planRows.push({ glyph:'复', title:'Grammar review', meta:grvDueToday > 0 ? grvDueToday + ' due' : 'Weakest points first', done:!!S.grdone, run:() => this.startGrammarReview() });
      const tasks = planRows.map(t => ({ glyph:t.glyph, title:t.title, meta:t.meta, done:t.done, open:!t.done, cls:t.done ? 'done' : '', go:t.run }));
      const moreWays = [
        pathStep && pathDoneToday > 0 ? { glyph:'路', label:'Another stop', sub:stopTitle(pathStep.st), cls:'', fn:() => { this.go('path'); this.setState({ pstop:pathStep.st.id }); } } : null,
        HAS_LISTEN ? { glyph:'听', label:'Listening', sub:'Dictation drill', cls:S.ldone ? 'done' : '', fn:() => this.go('listen') } : null,
        HAS_SCRIPTS ? { glyph:'说', label:'Speak', sub:(SCEN[nextScn] || NO_SC).title, cls:S.spokeToday ? 'done' : '', fn:() => { this.setState({ sidx:nextScn, sturn:0, sdone:false, sview:'chat' }); this.go('speak'); } } : null,
        { glyph:'语', label:'Grammar lesson', sub:LESSONS[nextLesson].title, cls:'', fn:() => { this.setState({ ggopen:null, gq:'', glesson:nextLesson }); this.go('grammar'); } },
        testReady ? { glyph:'测', label:'Test', sub:'Mixed questions', cls:S.tdone ? 'done' : '', fn:() => this.go('testlobby') } : null,
        { glyph:'书', label:'Library', sub:'Look things up', cls:'', fn:() => this.go('library') }
      ].filter(Boolean);
      const minOpts = [10, 20, 30, 45].map(m => ({ label:m + ' min', cls:S.mins === m ? 'on' : '', fn:() => this.setState({ mins:m }) }));
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
      const youLabel = (t) => ({ left:t === trD ? 'max(72px, ' + apct(t.you.x, t.w) + ')' : apct(t.you.x, t.w), top:apct(t.you.y, t.h), cls:t === trD ? 'c' : '', kind:'you', text:'You are here', sub:startedCount + ' word' + (startedCount === 1 ? '' : 's') + ' kept', hasSub:true });
      const trailAlt = 'Mountain trail: ' + startedCount + ' of ' + totalW + ' words learned on the way to the ' + LVN + ' level exam';
      const nextM = AS.nextMilestone(startedCount, totalW);
      const toGo = nextM - startedCount;
      const prevM = [0].concat(AS.MILESTONES).filter(m => m < nextM).pop();
      const allStarted = startedCount >= totalW;
      const studiedToday = S.lastActive === today;
      const minsLeft = Math.max(0, S.mins - S.dayMin);
      const ascCta = dueWordsN > 0 ? { text:'Review ' + dueWordsN + ' due word' + (dueWordsN === 1 ? '' : 's'), to:'review' }
        : (minsLeft > 0 ? { text:'Study ' + minsLeft + ' more minute' + (minsLeft === 1 ? '' : 's'), to:(startedCount >= totalW ? 'testlobby' : 'web') } : (startedCount >= totalW ? { text:'Test yourself', to:'testlobby' } : { text:'Learn new words', to:'web' }));
      // Today: one big button that starts the next open step of the plan, a greeting that follows the time of day
      const nextOpenTask = tasks.find(t => t.open), anyTaskDone = tasks.some(t => t.done);
      const planGo = nextOpenTask ? nextOpenTask.go : () => this.go(ascCta.to);
      const planGoText = nextOpenTask ? (anyTaskDone ? 'Continue today\'s plan' : 'Start today\'s plan') : ascCta.text;
      const hourNow = new Date().getHours();
      const greet = hourNow >= 5 && hourNow < 12 ? ['早上好', 'zǎoshang hǎo', 'Good morning'] : hourNow >= 12 && hourNow < 18 ? ['下午好', 'xiàwǔ hǎo', 'Good afternoon'] : ['晚上好', 'wǎnshang hǎo', 'Good evening'];
      // the climb card (desktop right column): how far up this level's path you are
      const climbN = PATH_LVLS.length && !ALL && PATH_U[LV] ? (() => { let t = 0, d = 0; PATH_U[LV].forEach(u => u.stops.forEach(st => { t++; if (stopState(S, st) === 'done') d++; })); return t ? Math.round(d / t * 100) : 0; })() : overall;
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
        name:t.name, count:t.got + ' of ' + t.tot + ' words' + (t.clear ? ' · clear' : ''), clear:t.clear, near:t.near, nearText:(t.tot - t.got) + ' to clear', ring:Math.round(t.got / Math.max(1, t.tot) * 100) + '%', ringTxt:Math.round(t.got / Math.max(1, t.tot) * 100),
        cls:t.near ? 'near' : '', art:AS.mist({ frac:t.got / t.tot, idx:t.i, dark:ascDark, w:212, h:84 }), go:() => openTopic(t.i)
      }));

      // review
      const rit = S.rq.length ? S.rq[0] : bankKeys[0];
      const rzh = itemOf(rit).zh;
      const rkind = S.rq.length ? this.rKind(rit) : 'flip';
      const rAuto = rkind === 'choice' || rkind === 'audio' || rkind === 'type';
      if (S.screen === 'review' && S.rq.length && rAuto) {   // an auto-checked card is a one-question quiz: the Review screen reuses the quiz card
        const key = rit + '|' + S.rstep;
        if (this.rvKey !== key || !this.quizQs[0] || !this.quizQs[0].rv) { this.rvKey = key; this.quizQs = [this.rQuestion(rit, rkind)]; }
      }
      const rflipV = S.rflip || rkind === 'intro';
      // Review plays the word by itself where there is something to hear: a new word, a listening card, and a flip card once it is turned over.
      // The front of a flip card stays silent: it asks you to recall, and hearing the word first would give half of it away.
      {
        let autoKey = '', autoText = '', autoSlot = 'word';
        if (S.screen === 'review' && S.rq.length && !S.rcomplete) {
          if (rkind === 'intro') { autoKey = rit + '|' + S.rstep + '|i'; autoText = rzh; }
          else if (rkind === 'flip' && S.rflip) { autoKey = rit + '|' + S.rstep + '|b'; autoText = rzh; }
          else if (rkind === 'audio' && this.quizQs[0] && this.quizQs[0].audio) { autoKey = rit + '|' + S.rstep + '|a'; autoText = this.quizQs[0].audio; autoSlot = 'q'; }
        }
        if (autoKey !== this.autoKey) {
          this.autoKey = autoKey;
          if (autoKey && autoText && prefGet('autoplay', true) !== false) setTimeout(() => { if (this.autoKey === autoKey) this.sayAi(autoText, autoSlot); }, 200);
        }
      }
      const lrnCount = lrnLive(S.ws, S.lrn).length;
      const cal = (() => { let fN = 0, fOk = 0, aN = 0, aOk = 0; (S.rlog || []).slice(-300).forEach(e => { const ok = e[3] === 'g' || e[3] === 'e'; if (e[4] === 'f') { fN++; if (ok) fOk++; } else { aN++; if (ok) aOk++; } }); return { fN, fOk, aN, aOk }; })();
      const calText = cal.fN >= 6 && cal.aN >= 6
        ? 'Honesty check: you marked ' + Math.round(100 * cal.fOk / cal.fN) + '% of your flip cards Good or Easy. On the cards the site checked for you (' + cal.aN + ' recently) you got ' + Math.round(100 * cal.aOk / cal.aN) + '% right.' +
          (100 * cal.fOk / cal.fN - 100 * cal.aOk / cal.aN >= 15 ? ' Your self-ratings may be a little generous: when unsure, tap Again or Hard.' : '')
        : '';
      const rw = BANK[rzh];
      const rexL = EXS[rzh]; const rex = rexL[(strHash(rzh) + Math.floor(Date.now() / 864e5) + S.rstep) % rexL.length];
      const cinfo = winfo(S.ws[rzh], 0);
      const card = Object.assign({ zh:rw.zh, py:rw.py, en:rw.en, stage:cinfo.chipCls, stageLabel:cinfo.mLabel, sizeCls:rw.zh.length > 1 ? 'two' : '', exZh:rex.zh, exPy:rex.py, exEn:rex.en, hasNote:!!NOTE[rzh], note:NOTE[rzh] || '', reportUrl:report('Review card for ' + rw.zh, rex.zh + ' (' + rex.py + ') ' + rex.en) }, cinfo);
      const rates = [
        { key:'again', label:'Again', cls:'again' },
        { key:'hard', label:'Hard', cls:'' },
        { key:'good', label:'Good', cls:'' },
        { key:'easy', label:'Easy', cls:'easy' }
      ].map(r => Object.assign({}, r, { hint:r.key === 'again' ? 'Later today' : fmtInterval(bump(S.ws[rzh].see, r.key, { relearn:!!this.lapsed[rzh + '#see'] }).s), fn:() => this.rate(r.key) }));
      let nextDueText = '';
      if (startedCount > 0) {
        const soon = infos.filter(i => i.started).sort((a, b) => a.dueN - b.dueN)[0];
        nextDueText = 'Next word to review: ' + soon.due.toLowerCase() + '.';
      }

      // quiz
      const qs = this.quizQs.length ? this.quizQs : [{ type:'mc', kicker:'', prompt:'', options:[], correct:'', reveal:'', explain:'' }];
      const q0 = qs[Math.min(S.qi, qs.length - 1)];
      const isTyped = q0.type === 'type' || q0.type === 'cloze' || q0.type === 'write';
      const isListen = q0.type === 'listen';
      const isChoice = isListen || q0.type === 'mc';
      const isOrder = q0.type === 'order';
      const isSpot = q0.type === 'spot';
      const q = {
        kicker:q0.kicker, prompt:q0.prompt, big:q0.big || '', hasBig:!!q0.big, bigCls:(q0.big || '').length > 3 ? 'sm' : '',
        sub:q0.sub || '', hasSub:!!q0.sub, placeholder:q0.placeholder || '', bigZh:q0.bigCls !== 'en', bigEn:q0.bigCls === 'en',
        isTyped, isPyType:q0.type === 'type' || q0.type === 'cloze', isListen, isChoice, isOrder, isSpot, reveal:q0.reveal, explain:q0.explain, revealPy:q0.py || '', hasRevealPy:!!q0.py,
        reportUrl:q0.type === 'write'
          // a sentence written by the learner: the report carries what was typed and what the checker said, so a wrong verdict can be looked into
          ? report('Grammar practice question ' + (S.qi + 1) + ' (Write it)', 'Write it: ' + q0.big + ' (' + q0.gtitle + ')', 'Model answer: ' + q0.model + '\nWhat I typed: ' + (S.qtyped || '') +
              '\nVerdict: ' + (S.qchecked ? (S.qcorrect ? 'marked right' : 'marked wrong') : 'not checked yet') + (S.qfeed ? '\nWhat the checker said: ' + S.qfeed : ''))
          : report((isG(S.qmode) ? 'Grammar practice' : 'Test') + ' question ' + (S.qi + 1), q0.prompt + ' / ' + q0.reveal)
      };
      const opts = (isChoice ? q0.options : []).map((o, oi) => {
        let cls = '';
        if (S.qchecked) { if (o.id === q0.correct) cls = 'right'; else if (o.id === S.qchoice) cls = 'wrong'; }
        else if (o.id === S.qchoice) cls = 'sel';
        return { label:o.label, k:oi + 1, cls, lcls:isListen && !q0.optsLatin ? 'zh' : '', pick:() => { if (!this.state.qchecked) this.setState({ qchoice:o.id }); } };
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
      const resSub = S.qmode === 'greview' ? 'Each point you answered has moved on in its own memory. Check the tracker to see which are strong and which are mastered.' : S.qmode === 'grammar'
        ? (acc >= 80 ? 'Lesson passed. It now counts toward your grammar progress.' : 'You need 80% to pass a lesson. Read the explanation again and have another go.')
        : 'Your score is saved to the list of recent tests.';
      const resGain = S.qmode === 'greview' ? 'Grammar review saved' : S.qmode === 'grammar' ? (acc >= 80 ? 'Lesson passed' : 'Not passed yet (80% needed)') : 'Test saved to your history';

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
      const wchips = sc.words.map(x => ({ zh:x.zh, py:x.py, play:() => this.sayAi(x.zh, 'w' + x.zh) }));
      const scenarios = SCEN.map((x, i) => ({ glyph:x.glyph, title:x.title, sub:x.sub, state:S.sres[x.id] ? 'Done' : (i === S.sidx ? 'Now' : 'Open'), cls:(S.sres[x.id] ? 'done ' : '') + (i === S.sidx ? 'cur' : ''), fn:() => this.pickScenario(i) }));

      // word webs and word memory
      const webCount = Object.keys(S.wlearned).length;
      const capReached = webCount >= limitOf(S);
      // a word in its learning phase counts as added (no Add button), but not as learned: it is not "in memory" until it has been recalled in Review
      const mini = (zh) => { const i = winfo(S.ws[zh], 0); return S.lrn[zh] && !i.started ? Object.assign({}, i, { lv:'learning', mLabel:'Learning', chipCls:'learning', started:true, recallText:'In your next Review', due:'Learn it in Review' }) : i; };
      // "Show example": the word's own example sentence (the same checked sentences used in My words and the tests)
      const exOf = (zh) => { const l = EXS[zh]; const e = l ? l[(S.wexn[zh] || 0) % l.length] : null; return e ? { zh:e.zh, py:e.py, en:e.en } : { zh:'', py:'', en:'' }; };
      const exFor = (zh, avail) => {
        const e = exOf(zh);
        const open = avail && !!S.wex[zh];
        return { hasExBtn:avail && !!e.zh, exOpen:open, exLabel:open ? 'Hide example' : 'Show example', exToggle:() => this.toggleEx(zh),
          exZh:e.zh, exPy:e.py, exEn:e.en, exPlay:() => this.sayAi(e.zh, 'x' + zh), exPc:pc('x' + zh),
          hasExMore:(EXS[zh] || []).length > 1, exNext:() => this.nextEx(zh), exCount:(((S.wexn[zh] || 0) % (EXS[zh] || [0]).length) + 1) + ' of ' + (EXS[zh] || []).length, hasExNote:!!NOTE[zh], exNote:NOTE[zh] || '' };
      };
      const dlt = (zh) => { const d = S.wdelta[zh]; return d ? { hasDelta:true, deltaText:'Mastery ' + d.from + '% → ' + d.to + '%', deltaCls:d.to >= d.from ? 'up' : 'down' } : { hasDelta:false, deltaText:'', deltaCls:'' }; };
      // Library pages: words are shown to read. "Study view" covers one side; tapping a covered side shows it for that entry only.
      const cvMode = S.wcover === 'en' || S.wcover === 'zh' ? S.wcover : 'all';
      const coverOf = (key) => { const open = cvMode === 'all' || !!(S.wpeek || {})[key]; return { showZh:open || cvMode !== 'zh', hideZh:!open && cvMode === 'zh', showEn:open || cvMode !== 'en', hideEn:!open && cvMode === 'en', peek:() => this.setState({ wpeek:Object.assign({}, S.wpeek, { [key]:true }) }) }; };
      const dotOf = (info) => info.lv === 'new' ? '' : (info.lv === 'learning' ? 'a' : 'g');
      const stackOf = (zhs) => { let l = 0, k = 0, n = 0; zhs.forEach(z => { const i = mini(z); if (i.lv === 'new') n++; else if (i.lv === 'learning') l++; else k++; }); const t = zhs.length || 1; return { l, k, n, kw:(k / t * 100).toFixed(1) + '%', lw:(l / t * 100).toFixed(1) + '%', label:k + ' known, ' + l + ' learning, ' + n + ' new' }; };
      const wordRow = (zh, key) => {
        const b = BANK[zh]; const info = mini(zh); const isNew = info.lv === 'new'; const ex = exOf(zh);
        return Object.assign({}, info, lvInfo(zh), {
          zh, py:b.py, en:b.en, cls:isNew ? 'new' : 'ok', dot:dotOf(info), notNew:!isNew, isNew, canAdd:isNew && !capReached, capHit:isNew && capReached,
          pc:pc('w' + zh), play:() => this.sayAi(zh, 'w' + zh), learn:() => this.learnWord(zh),
          hasEx:!!ex.zh, exZh:ex.zh, exPy:ex.py, exEn:ex.en, exPlay:() => this.sayAi(ex.zh, 'x' + zh), exPc:pc('x' + zh),
          hasExMore:(EXS[zh] || []).length > 1, exNext:() => this.nextEx(zh), exCount:(((S.wexn[zh] || 0) % (EXS[zh] || [0]).length) + 1) + ' of ' + (EXS[zh] || []).length, hasExNote:!!NOTE[zh], exNote:NOTE[zh] || ''
        }, coverOf(key || zh));
      };
      const coverOpts = [['all', 'Show all'], ['en', 'Cover English'], ['zh', 'Cover Chinese']].map(x => ({ label:x[1], cls:cvMode === x[0] ? 'on' : '', fn:() => this.setState({ wcover:x[0], wpeek:{} }) }));
      const hubNow = HUBS[S.whub];
      // the family, grouped by where the shared character sits (first, last, elsewhere) so the pattern shows: 学 + something, something + 学
      const hubPos = (w) => w.parts[0][0] === hubNow.hub ? 0 : (w.parts[1][0] === hubNow.hub ? 1 : 2);
      const hubGrpNames = [hubNow.hub + ' at the start', hubNow.hub + ' at the end', 'Related words'];
      const hubSorted = hubNow.words.map((w, i) => ({ w, i, g:hubPos(w) })).sort((a, b) => a.g - b.g || a.i - b.i);
      const hubCards = hubSorted.map((x, k) => {
        const w = x.w; const r = wordRow(w.zh); const hz = hubNow.hub;
        const hideP = (c) => (r.hideZh && c !== hz) ? '?' : c;
        return Object.assign(r, { showGrp:k === 0 || hubSorted[k - 1].g !== x.g, grpLabel:hubGrpNames[x.g] + ' (' + hubSorted.filter(y => y.g === x.g).length + ')',
          p1w:w.parts[0][0], p2w:w.parts[1][0],
          p1c:hideP(w.parts[0][0]), p1n:r.hideEn ? '·' : w.parts[0][1], p1cls:w.parts[0][0] === hz ? 'hub' : '',
          p2c:hideP(w.parts[1][0]), p2n:r.hideEn ? '·' : w.parts[1][1], p2cls:w.parts[1][0] === hz ? 'hub' : '',
          reportUrl:report('Word web card', w.zh + ' (' + BANK[w.zh].py + ') ' + BANK[w.zh].en + '; parts ' + w.parts.map(p => p[0] + '=' + p[1]).join(', '))
        }, exFor(w.zh, r.showZh && r.showEn));
      });
      const hubNewN = hubNow.words.filter(w => mini(w.zh).lv === 'new').length;
      const hubSum = hubNow.words.length + ' words share it' + (hubNewN > 0 ? ' · ' + hubNewN + ' not in My words yet' : ' · all in My words');
      const hubTiles = HUBS.map((h, i) => { const st = stackOf(h.words.map(w => w.zh)); return { zh:h.hub, n:h.words.length, label:h.hub + ', ' + h.words.length + ' words' + (st.n === 0 ? ', all started' : ''), cls:(S.whub === i ? 'on ' : '') + (st.n === 0 ? 'done' : (st.k + st.l > 0 ? 'part' : '')), fn:() => this.setState({ whub:i, gfq:0, gfpick:null, wpeek:{} }) }; });
      const hubStack = stackOf(hubNow.words.map(w => w.zh));
      const gapNow = hubNow.gaps[S.gfq % hubNow.gaps.length];
      const gapDone = S.gfpick !== null;
      const gapOpts = seededShuffle(gapNow.opts, GAP_SEED + S.whub * 131 + (S.gfq % hubNow.gaps.length) * 17).map(zh => ({ zh, py:BANK[zh].py, cls:!gapDone ? '' : (zh === gapNow.ans ? 'right' : (zh === S.gfpick ? 'wrong' : '')), fn:() => this.gapPick(zh) }));
      const fillLine = !gapDone ? '' : (S.gfpick === gapNow.ans ? 'Right. ' : 'Not quite. ') + gapNow.ans + ' (' + BANK[gapNow.ans].py + ') means ' + BANK[gapNow.ans].en + '.';
      const oppTabsAll = [['all', 'All', OPPS.length], ['opp', 'Opposites', OPPS.filter(o => !o.pair).length], ['pair', 'Partners', OPPS.filter(o => o.pair).length]];
      const oppTabs = !OPPS.some(o => o.pair) ? [] : oppTabsAll.filter(t => t[2] > 0).map(t => ({ label:t[1], n:t[2], cls:S.wopptab === t[0] ? 'on' : '', fn:() => this.setState({ wopptab:t[0] }) }));
      const oppSorted = OPPS.filter(o => S.wopptab === 'opp' ? !o.pair : (S.wopptab === 'pair' ? !!o.pair : true)).map((o, i) => ({ o, i })).sort((x, y) => (x.o.pair ? 1 : 0) - (y.o.pair ? 1 : 0) || x.i - y.i);
      const oppRows = oppSorted.map(({ o }, k) => {
        const A = BANK[o.a]; const B = BANK[o.b];
        const key = o.a + '|' + o.b;
        const ra = wordRow(o.a, key); const rb = wordRow(o.b, key);
        const side = (r, p) => ({ [p + 'zh']:r.zh, [p + 'py']:r.py, [p + 'en']:r.en, [p + 'Dot']:r.dot, [p + 'Status']:r.mLabel, [p + 'Pc']:r.pc, [p + 'Play']:r.play, [p + 'ShowZh']:r.showZh, [p + 'HideZh']:r.hideZh, [p + 'ShowEn']:r.showEn, [p + 'HideEn']:r.hideEn });
        const open = ra.showZh && ra.showEn;
        const exAvail = open && !!(exOf(o.a).zh || exOf(o.b).zh);
        const isPair = !!o.pair; const prevPair = k > 0 && !!oppSorted[k - 1].o.pair;
        return Object.assign({
          note:o.note, peek:ra.peek,
          showGrp:k === 0 || isPair !== prevPair, grpLabel:isPair ? 'Partners (' + oppSorted.filter(y => !!y.o.pair).length + ')' : 'Opposites (' + oppSorted.filter(y => !y.o.pair).length + ')',
          aAddLabel:open ? 'Add ' + A.zh : 'Add left word', bAddLabel:open ? 'Add ' + B.zh : 'Add right word',
          hasExBtn:exAvail, exOpen:exAvail && !!S.wex[A.zh + B.zh], exLabel:(exAvail && S.wex[A.zh + B.zh]) ? 'Hide examples' : 'Show examples', exToggle:() => this.toggleEx(A.zh + B.zh),
          aExZh:exOf(A.zh).zh, aExPy:exOf(A.zh).py, aExEn:exOf(A.zh).en, bExZh:exOf(B.zh).zh, bExPy:exOf(B.zh).py, bExEn:exOf(B.zh).en,
          aExPlay:() => this.sayAi(exOf(A.zh).zh, 'x' + A.zh), bExPlay:() => this.sayAi(exOf(B.zh).zh, 'x' + B.zh), aExPc:pc('x' + A.zh), bExPc:pc('x' + B.zh),
          canAddA:ra.canAdd, canAddB:rb.canAdd, hasAdd:ra.canAdd || rb.canAdd,
          canAddBoth:ra.canAdd && rb.canAdd && (limitOf(S) - webCount >= 2),
          learnA:() => this.learnWord(A.zh), learnB:() => this.learnWord(B.zh), learnBoth:() => this.learnMany([A.zh, B.zh]),
          capHit:(ra.capHit || rb.capHit),
          reportUrl:report('Pairs and opposites', A.zh + ' / ' + B.zh + ': ' + o.note)
        }, side(ra, 'a'), side(rb, 'b'));
      });
      const topicNow = TOPICS[S.wtopic];
      const topicChips = topicNow.words.map(zh => wordRow(zh));
      const topicStack = stackOf(topicNow.words);
      const grpTopics = TOPICS.map((t, i) => i).filter(i => TOPICS[i].group === topicNow.group);
      const topicKick = topicNow.group + ' · topic ' + (grpTopics.indexOf(S.wtopic) + 1) + ' of ' + grpTopics.length;
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
      const rowsAll = BANK_KEYS.map(zh => Object.assign({ zh, py:BANK[zh].py, en:BANK[zh].en, pc:pc('w' + zh), play:() => this.sayAi(zh, 'w' + zh) }, winfo(S.ws[zh], S.woff)));
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
      // Library: look a word up by Chinese, pinyin or English
      const libQ = S.screen === 'library' ? String(S.lq || '').trim().toLowerCase() : '', libPlain = toneless(libQ);
      const libMatches = !libQ ? [] : rowsAll.filter(r => r.zh.indexOf(libQ) >= 0 || r.en.toLowerCase().indexOf(libQ) >= 0 || (libPlain.length > 0 && toneless(r.py).indexOf(libPlain) >= 0)).slice(0, 8)
        .map(r => ({ zh:r.zh, py:r.py, en:r.en, play:r.play, pc:r.pc, open:() => { this.go('words'); this.setState({ wq:r.zh, wshow:40 }); } }));
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
      // grammar review panel and tracker
      const greg = gptReg();
      const grvLevels = S.grvLv && LVLS.indexOf(S.grvLv) >= 0 ? [S.grvLv] : LVLS.slice();
      const grvRowsAll = Object.keys(greg).filter(id => grvLevels.indexOf(greg[id].level) >= 0).map(id => {
        const info = gptInfo(S.gpt[id]); const pt = greg[id]; const open = gptOpen(S, id);
        return { id, info, pt, open, rank:(!open ? 20 : (info.started ? (info.due ? 0 : 1) : 2) + (info.mastered ? 5 : 0)) + (info.started ? info.rm / 1000 : 0) };
      }).sort((a, b) => a.rank - b.rank);
      const grvOpenN = grvRowsAll.filter(r => r.open).length;
      const lessonName = (lid) => { const l = LESSONS.find(x => x.id === lid); return l ? l.title : ''; };
      const grvStart = grvRowsAll.filter(r => r.open && r.info.started).length, grvDue = grvRowsAll.filter(r => r.open && r.info.due).length, grvMastered = grvRowsAll.filter(r => r.open && r.info.mastered).length;
      const wordsDueN = S.rq.length > 0 && !S.rcomplete ? S.rq.length : 0, revBadgeN = wordsDueN + grvDue;   // the Review tab counts words and grammar points together
      const grvCanWrite = aiReadyNow();
      const grvRows = (S.grvAll ? grvRowsAll : grvRowsAll.slice(0, 12)).map(r => ({
        title:r.pt.title, lv:'HSK ' + r.pt.level, hasLv:LVLS.length > 1, rw:r.open ? r.info.rm + '%' : '0%', ww:r.open ? r.info.wm + '%' : '0%', label:r.open ? r.info.label : 'Locked: pass the lesson "' + lessonName(r.pt.lesson) + '"', cls:r.open ? r.info.state + (r.info.due ? ' due' : '') : 'locked',
        rtxt:r.open ? r.info.rm + '%' : '–', wtxt:!r.open ? '–' : r.pt.write.length ? (r.info.wm > 0 ? r.info.wm + '%' : 'not yet') : '–'
      }));
      const grvLvChips = (LVLS.length > 1 ? [{ label:'All', n:0 }].concat(LVLS.map(n => ({ label:'HSK ' + n, n }))) : []).map(c => ({ label:c.label, cls:(S.grvLv || 0) === c.n ? 'on' : '', fn:() => this.setState({ grvLv:c.n }) }));
      const lessonBest = S.gres[L.id];
      // how a lesson is built decides how its formula is drawn: word order gets role colours; frames, add-ons and pick-one lists stay plain, with only the key word marked
      const slotRole = (t) => /^(subject|pronoun|owner)/i.test(t) ? 'who' : /^(time|place|where|when|how long)/i.test(t) ? 'when' : /^(verb|action|adjective|degree|how well|result|how)/i.test(t) ? 'does' : /^(object|thing|noun|amount|number|measure|owner or)/i.test(t) ? 'thing' : '';
      const shapeOf = (() => {
        const ft = L.formula.map(f => f.t).join(' ');
        if (/…/.test(L.title) && /因为|所以|不但|如果|只要|除了|先|越|虽然|一边/.test(ft)) return { k:'frame', label:'Frame with blanks', hint:'The red words are the frame. Fill the gaps with your own words.' };
        if (L.formula.length <= 3 && L.formula.some(f => /Sentence|Statement|Situation/.test(f.t))) return { k:'add', label:'One small add-on', hint:'Take a sentence you already have and add this.' };
        if (/\//.test(ft) && L.formula.some(f => f.k) && L.formula.length <= 3) return { k:'pick', label:'Pick one', hint:'Several words fit here. The examples show when to use each.' };
        return { k:'slots', label:'Word order', hint:'Each colour is a job in the sentence: who, when or where, what is done, and to what.' };
      })();
      const lesson = {
        kick:(L.cat ? L.cat + ' · ' : '') + 'Lesson ' + (S.glesson + 1) + ' of ' + LESSONS.length, hasLvTag:ALL, lvTag:'HSK ' + LESSON_LV[L.id], lvCls:(LESSON_LV[L.id] === TOPL ? 'cur' : 'old') + ' l' + LESSON_LV[L.id], title:L.title, pickLabel:(S.glesson + 1) + ' · ' + L.title,
        formula:L.formula.map(f => ({ t:f.t, cls:(f.k ? 'k ' : '') + (f.z ? 'zh ' : '') + (!f.k && shapeOf.k === 'slots' ? slotRole(f.t) : (!f.k && shapeOf.k !== 'slots' ? 'open' : '')), sep:f.sep, hasSep:f.sep !== '' })),
        explOpen:!S.explHide, explExpanded:S.explHide ? 'false' : 'true', explToggleText:S.explHide ? 'Show' : 'Hide', toggleExpl:() => this.setState({ explHide:!this.state.explHide }),
        shapeCls:'sh-' + shapeOf.k, shapeLabel:shapeOf.label, shapeHint:shapeOf.hint,
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
        focusCls:(S.exm && (S.exm.stage === 'run' || S.exm.stage === 'break') && S.screen === 'exam') || (S.screen === 'quiz' && !S.qdone) || (S.screen === 'plesson' && S.pl && !S.pl.done) ? 'focus' : '',
        scrCls:'scr-' + S.screen + (S.screen === 'review' || S.screen === 'listen' || S.screen === 'speak' || (S.screen === 'plesson' && S.pl && !S.pl.done) ? ' am' : ''),   // am = app mode on a phone: these screens fill the screen and do not scroll as a page
        gHomeCls:gcls('home'), gLearnCls:gcls('learn'), gReviewCls:gcls('review'), gTalkCls:gcls('talk'), gJourneyCls:gcls('journey'),
        gHome:() => this.goGroup('home'), gLearn:() => this.goGroup('learn'), gReview:() => this.goGroup('review'), gTalk:() => this.goGroup('talk'), gJourney:() => this.goGroup('journey'),
        gLearnOpen:navGroup === 'learn', gReviewOpen:navGroup === 'review', gTalkOpen:navGroup === 'talk',
        acctMiniCls:inBranch ? 'on' : '', hasBack:inBranch && curScreen !== 'acct',
        hasSubnav:subnavItems.length > 1,
        subnav:subnavItems.map(o => { const n = o[0] === 'review' ? wordsDueN : o[0] === 'greview' ? grvDue : 0; return { label:o[1], cls:hlScreen === o[0] ? 'on' : '', fn:() => this.go(o[0]), hasN:n > 0, n }; }),
        inLib:['words', 'grammar', 'web', 'pinyin'].indexOf(S.screen) >= 0, goLibrary:() => this.go('library'), isLibrary:S.screen === 'library',
        youFriends:!!(FR && FR.enabled()), youFriendsCls:'ylink' + (curScreen === 'friends' ? ' on' : ''), youSetCls:'ylink' + (curScreen === 'voice' ? ' on' : ''), youGuideCls:'ylink' + (curScreen === 'guide' ? ' on' : ''), youAchCls:'ylink' + (curScreen === 'ach' ? ' on' : ''),
        goSettings:() => this.go('voice'), goAch:() => this.go('ach'),
        goStreak:() => this.go('home'), goMem:() => this.go('words'),
        homeHero:!startShow, planGo, planGoText, greetZh:greet[0], greetPy:greet[1], greetEn:greet[2], moreWays, climbPct:climbN + '%', climbN, climbTitle:'Climb to ' + (ALL ? 'the top' : 'the HSK ' + LV + ' summit'),
        climbNote:ALL ? 'Each level has its own exam, at the top of its path.' : EXAMBANK ? (LVL.levelPassed(LV) ? LVN + ' is behind you.' : climbN >= 80 ? 'The exam is waiting at the top of your path.' : 'The ' + LVN + ' exam sits at the top of your path. It opens at 80%.') : 'The exam for ' + LVN + ' is not built yet.',
        artToday:artUri('banner', 'today'), artLibrary:artUri('banner', 'library'), artReview:artUri('banner', 'review'), artTalk:artUri('banner', 'talk'), artJourney:artUri('banner', 'journey'), artPath:artUri('banner', 'path'), artSummit:artUri('summit'),
        mingWave:artUri('ming', 'wave'), mingThink:artUri('ming', 'think'), mingCheer:artUri('ming', 'cheer'), mingSleep:artUri('ming', 'sleep'), mingThumbs:artUri('ming', 'thumbs'),
        hasTopArt:!!TOPKEY[S.screen], topCls:TOPKEY[S.screen] ? 'arted' : '',
        topArt:TOPKEY[S.screen] ? artUri('banner', TOPKEY[S.screen]) : '',
        libTiles:(() => {
          const pyL = PYC.lessons || [], pyD = pyL.filter(l => pyDoneAt(l.id)).length;
          const nxtL = LESSONS.find(L => (S.gres[L.id] || 0) < 80);
          const nxtPy = pyL.find(l => !pyDoneAt(l.id));
          const pct = (n, d) => Math.round(n / Math.max(1, d) * 100);
          const stMap = {}; bankKeys.forEach((zh, i) => { stMap[zh] = infos[i].started; });
          const countSet = (list) => { const set = new Set(); list.forEach(zh => { if (stMap[zh] !== undefined) set.add(zh); }); return { n:set.size, st:[...set].filter(zh => stMap[zh]).length }; };
          const hubC = countSet(HUBS.flatMap(h => h.words.map(w => w.zh))), oppC = countSet(OPPS.flatMap(o => [o.a, o.b]));
          const hubStarted = hubC.st, hubWordsN = hubC.n, oppStarted = oppC.st, oppWordsN = oppC.n;
          const openWeb = (mode) => { this.go('web'); this.setState({ wmode:mode }); };
          return [
            { key:'words', glyph:'词', title:'Words', line:startedCount + ' of ' + rowsAll.length + ' started', sub:memNow.words + ' in memory' + (dueAllN > 0 ? ', ' + dueAllN + ' due' : ''), pct:pct(startedCount, rowsAll.length) + '%', fn:() => this.go('words') },
            { key:'grammar', glyph:'语', title:'Grammar lessons', line:gramPassed + ' of ' + LESSONS.length + ' passed', sub:nxtL ? 'Next: ' + nxtL.title.split(':')[0] : 'All passed', pct:pct(gramPassed, LESSONS.length) + '%', fn:() => this.go('grammar') },
            { key:'topics', glyph:'题', title:'Topics', line:mistClear + ' of ' + TOPICS.length + ' topics finished', sub:'Words grouped by theme', pct:pct(mistClear, TOPICS.length) + '%', fn:() => openWeb('topic') },
            { key:'char', glyph:'字', title:'Shared character', line:HUBS.length + ' characters', sub:hubStarted + ' of ' + hubWordsN + ' words started', pct:pct(hubStarted, hubWordsN) + '%', fn:() => openWeb('char') },
            { key:'opp', glyph:'对', title:'Word pairs', line:OPPS.length + ' pairs', sub:oppStarted + ' of ' + oppWordsN + ' words started', pct:pct(oppStarted, oppWordsN) + '%', fn:() => openWeb('opp') },
            { key:'pinyin', glyph:'音', title:'Pinyin and tones', line:pyD + ' of ' + pyL.length + ' lessons done', sub:nxtPy ? 'Next: ' + nxtPy.title : 'All done', pct:pct(pyD, pyL.length) + '%', fn:() => this.go('pinyin') }
          ];
        })(),
        wodShow:rowsAll.length > 0, ...(() => {
          if (!rowsAll.length) return {};
          const d = new Date(); const di = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
          const w = rowsAll[(di * 7919) % rowsAll.length]; const ex = exFor(w.zh, true); const isNew = !w.started;
          return { wodZh:w.zh, wodPy:w.py, wodEn:w.en, wodPlay:w.play, wodPc:w.pc, wodHasEx:!!ex.exZh, wodExZh:ex.exZh || '', wodExPy:ex.exPy || '', wodExEn:ex.exEn || '', wodCanAdd:isNew, wodAdd:() => this.learnWord(w.zh) };
        })(),
        lq:S.lq || '', onLq:(e) => this.setState({ lq:e.target.value }), lqHas:libMatches.length > 0, lqNone:!!libQ && libMatches.length === 0, lqRows:libMatches,
        libBannerShow:(prefGet('sv', {}).library || 0) < 4,
        themeCls:dark ? 't-dark' : 't-light', themeLabel:dark ? 'Switch to light' : 'Switch to dark', toggleTheme:this.toggleTheme,
        noVoice:S.noVoice, week,
        ...(() => {
          const tp = this.tipNow();
          let swOn = false; try { swOn = !!(navigator.serviceWorker && navigator.serviceWorker.controller); } catch (e) {}
          const meta = document.querySelector('meta[name="shanlu-version"]');
          return { saveFail:S.saveFail, saveInfo:S.saveInfo || '', swReady:S.swReady, updateNow:this.updateNow,
            tipShow:!!tp, tipIsInstall:!!tp && tp.id === 'install', tipIsBackup:!!tp && tp.id === 'backup', tipCanPrompt:!!installEvt, tipIosHow:isIos() && !installEvt, tipDismiss:this.tipDismiss, tipInstall:this.tipInstall,
            storageText:S.storagePersisted === true ? 'Protected: the browser has agreed to keep this site\'s saved data.' : S.storagePersisted === false ? 'Not protected: the browser may clear this site\'s saved data when space is short or after a long time unused. A backup or sync keeps your progress safe.' : 'Not known on this browser.',
            installedText:isStandalone() ? 'Opened as an installed app.' : 'Opened in the browser. Installing it (Share, then Add to Home Screen on iPhone) gives a full-screen app and protects the saved data.',
            versionText:(meta && meta.content ? 'Version ' + meta.content : 'Version unknown') + (swOn ? ', works offline.' : ', offline copy not active.') };
        })(),
        gapLine, examParts, navExam:navCls('exam'), goExam:() => this.go('exam'), isExam:S.screen === 'exam' && !!EXAMBANK, isExamNA:S.screen === 'exam' && !EXAMBANK,

        ...this.pyVals(S, navCls),
        // word webs and word memory
        navWeb:navCls('web'), goWeb:() => this.go('web'), isWeb:S.screen === 'web',
        navWords:navCls('words'), goWords:() => this.go('words'), isWords:S.screen === 'words',
        friendsOn:!!(FR && FR.enabled()), navFriends:navCls('friends'), isFriends:S.screen === 'friends',
        goFriends:() => { this.go('friends'); this.friendsRefresh(false); },
        ...frVals,
        ...this.pathVals(S),
        ...this.acctVals(S, { level:LVN, streak:streakShown, coins:totalXp(S).toLocaleString('en-US'), mem:memNow.words, started:startedCount, total:bankKeys.length, guide:guideAvail }),
        ...this.jyView(S),
        isWChar:S.wmode === 'char', isWOpp:S.wmode === 'opp', isWTopic:S.wmode === 'topic',
        wCharCls:S.wmode === 'char' ? 'on' : '', wOppCls:S.wmode === 'opp' ? 'on' : '', wTopicCls:S.wmode === 'topic' ? 'on' : '',
        setWChar:() => this.setState({ wmode:'char' }), setWOpp:() => this.setState({ wmode:'opp' }), setWTopic:() => this.setState({ wmode:'topic' }),
        coverOpts, oppTabs, hasOppTabs:oppTabs.length > 0,
        topicKick, topicLearnN:topicStack.l, topicKnownN:topicStack.k, topicNewN:topicStack.n, topicKnownW:topicStack.kw, topicLearnW:topicStack.lw, topicStackLabel:topicStack.label,
        hubLearnN:hubStack.l, hubKnownN:hubStack.k, hubNewN:hubStack.n, hubKnownW:hubStack.kw, hubLearnW:hubStack.lw, hubStackLabel:hubStack.label,
        topicPrevName:TOPICS[(S.wtopic + TOPICS.length - 1) % TOPICS.length].name, topicNextName:TOPICS[(S.wtopic + 1) % TOPICS.length].name,
        hubPrevName:HUBS[(S.whub + HUBS.length - 1) % HUBS.length].hub, hubNextName:HUBS[(S.whub + 1) % HUBS.length].hub,
        hubPrev:() => this.setState({ whub:(S.whub + HUBS.length - 1) % HUBS.length, gfq:0, gfpick:null, wpeek:{} }), hubNext:() => this.setState({ whub:(S.whub + 1) % HUBS.length, gfq:0, gfpick:null, wpeek:{} }),
        webCountText:limitOf(S) === Infinity ? webCount + ' added today' : webCount + ' of ' + S.nlimit + ' added today', capNote:capReached, capCount:S.nlimit, capOpts,
        hubHasNew:hubNew > 0 && !capReached && this.lrnRoom() > 0, hubAddAllText:(hubNew <= this.lrnRoom() ? 'Add all ' + hubNew : 'Add ' + this.lrnRoom() + ' of ' + hubNew) + ' new word' + (hubNew === 1 ? '' : 's'), hubAddAll:() => this.learnMany(hubNow.words.map(w => w.zh)),
        topicHasNew:topicNew > 0 && !capReached && this.lrnRoom() > 0, topicAddAllText:(topicNew <= this.lrnRoom() ? 'Add all ' + topicNew : 'Add ' + this.lrnRoom() + ' of ' + topicNew) + ' new word' + (topicNew === 1 ? '' : 's'), topicAddAll:() => this.learnMany(topicNow.words),
        moreDue:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft > 0, hasMoreDue:dueLeft > 0, reviewMore:this.reviewMore,
        moreDueText:'Review ' + dueLeft + ' word' + (dueLeft === 1 ? '' : 's'), dueLeftText:dueLeft + ' word' + (dueLeft === 1 ? ' is' : 's are') + ' still due.', topicProgress:topicStarted + ' of ' + topicNow.words.length + ' started',
        hubCards, hubSum, hubTiles, hubZh:hubNow.hub, hubPy:hubNow.py, hubEn:hubNow.en,
        fillEn:gapNow.en, fillZh:gapNow.zh, gapOpts, gapDone, gapOptsCls:gapDone ? 'locked' : '', fillLine, gapNext:this.gapNext,
        fillReport:report('Which word fits?', gapNow.zh + ' = ' + gapNow.ans + ' / ' + gapNow.en),
        oppRows, topicChips, topicOpts, topicGroups, topicName:topicNow.name, wtq:S.wtq, onTopicSearch:(e) => this.setState({ wtq:e.target.value }), topicNoMatch, topicPos:(S.wtopic + 1) + ' of ' + TOPICS.length, topicMenuOpen:S.wtmenu ? 'true' : 'false', topicMenuShow:S.wtmenu, toggleTopicMenu:() => this.setState({ wtmenu:!this.state.wtmenu }), topicPrev:() => this.pickTopic((S.wtopic + TOPICS.length - 1) % TOPICS.length), topicNext:() => this.pickTopic((S.wtopic + 1) % TOPICS.length), tsZh:topicNow.sentence.zh, tsPy:topicNow.sentence.py, tsEn:topicNow.sentence.en,
        tsReport:report('Topic sentence', topicNow.sentence.zh + ' ' + topicNow.sentence.en),
        topicCta:topicNow.cta, goTopic:() => this.go(topicNow.to),
        lrnBanner:lrnLive(S.ws, S.lrn).length > 0 || !!S.lrnNote, lrnBannerText:S.lrnNote || (lrnLive(S.ws, S.lrn).length + ' new word' + (lrnLive(S.ws, S.lrn).length === 1 ? ' is' : 's are') + ' waiting in Review. Adding a word does not mean you know it yet: Review will have you recall it.'), goLearn:() => { this.go('review'); if (!this.state.rq.length || this.state.rcomplete) this.reviewMore(); },
        hasGlast:S.qmode === 'greview' && !!S.glast, glastText:S.glast ? S.glast.title + ', ' + S.glast.dim + ': ' + S.glast.from + '% → ' + S.glast.to + '%' : '', glastCls:S.glast && S.glast.to < S.glast.from ? 'down' : 'up',
        hasRlast:!!S.rlast, rlastText:S.rlast ? S.rlast.zh + ': mastery ' + S.rlast.from + '% → ' + S.rlast.to + '%' : '', rlastCls:S.rlast && S.rlast.to < S.rlast.from ? 'down' : 'up',
        gardenStages:lvKeys.map(k => ({ key:k, label:({ new:'New', learning:'Learning', familiar:'Familiar', strong:'Strong', mastered:'Mastered' })[k], n:lvCount[k], cls:S.wfilter === k ? 'on' : '', fn:() => this.setState({ wfilter:S.wfilter === k ? 'all' : k, wshow:40 }) })),
        thirstCls:dueAllN > 0 ? '' : 'ok', thirstTitle:dueAllN > 0 ? dueAllN + (dueAllN === 1 ? ' word is thirsty' : ' words are thirsty') : 'The garden is watered', thirstSub:dueAllN > 0 ? 'A short review waters them before they fade.' : 'Nothing is due right now.',
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
        setDict:() => this.setState({ lmode:'dict', mmix:false }), setTone:() => this.setState({ lmode:'tone' }),
        // Meaning: say what the clip means
        isMean:S.lmode === 'mean', lMeanCls:S.lmode === 'mean' ? 'on' : '', setMean:this.setMean,
        mStep:S.mchecked ? 'Now read it, then listen again' : (S.dplays === 0 ? 'Listen without help' : 'Say what it means'),
        mMixTag:S.mmix, mTyped:S.mtyped, mInpCls:S.mchecked ? 'locked' : '',
        onMType:(e) => { if (!this.state.mchecked && !this.state.mbusy) this.setState({ mtyped:e.target.value, merr:'' }); },
        onMEnter:(e) => { if (e.key === 'Enter') { if (this.state.mchecked && !(this.state.mres && this.state.mres.verdict === 'self')) this.nextMean(); else this.checkMean(); } },
        mNotChecked:!S.mchecked, mChecked:S.mchecked, mBusy:S.mbusy, mCheckText:S.mbusy ? 'Checking…' : 'Check my answer',
        mCheckCls:S.mtyped.trim() && !S.mbusy ? '' : 'dis', mCheckAria:S.mtyped.trim() && !S.mbusy ? 'false' : 'true', checkMean:this.checkMean,
        hasMErr:!!S.merr, mErr:S.merr, nextMean:this.nextMean, mNextText:S.mmix ? 'Back to Dictation' : 'Next clip',
        mCanPeek:!S.mchecked && S.mpeek < 2, mPeekLabel:S.mpeek === 0 ? 'Peek at the pinyin' : 'Peek at the characters', mPeek:() => this.setState({ mpeek:Math.min(2, this.state.mpeek + 1) }),
        mShowPy:S.mpeek >= 1 || S.mchecked, mShowZh:S.mpeek >= 2 || S.mchecked, mPy:clip.py, mZh:clip.zh, mModel:clip.en,
        mHasRes:!!S.mres, mVerdict:!S.mres ? '' : ({ pass:'Right', close:'Close', fix:'Not quite', self:'Check it yourself' })[S.mres.verdict], mVerdictCls:!S.mres ? '' : ({ pass:'ok', close:'close', fix:'miss', self:'' })[S.mres.verdict],
        mSelfPending:!!S.mres && S.mres.verdict === 'self', mSelfYes:() => this.mSelfRate(true), mSelfNo:() => this.mSelfRate(false),
        mHasReason:!!S.mres && !!S.mres.reason, mReason:S.mres ? S.mres.reason : '',
        mPeeked:!!S.mres && S.mres.peeked && S.mres.verdict !== 'self', mBy:S.mres && S.mres.by && S.mres.by !== 'self' ? 'Checked by ' + S.mres.by + '.' : '', mHasBy:!!S.mres && !!S.mres.by && S.mres.by !== 'self',
        mNoAi:!S.aiOn,
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
        clearPlay:() => { this.ttsUnlock(); this.sayAi(clip.zh, 'clear', 0.7); }, naturalPlay:() => { this.ttsUnlock(); this.sayAi(clip.zh, 'nat', 1.1); },
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
        title:tt[0], subtitle:tt[1], subShow:!(['home', 'path', 'library', 'review', 'greview', 'testlobby', 'listen', 'speak', 'journey', 'words', 'web', 'grammar', 'pinyin'].indexOf(S.screen) >= 0) || (prefGet('sv', {})[S.screen] || 0) < 3 || startShow,
        obIntroShow:obPh === 'intro' && !S.obBack, obBackShow:obPh === 'intro' && !!S.obBack, obFlyShow:obPh === 'fly' && S.screen === 'journey',
        obGuideShow:obPh === 'guide' && !S.jyPlay, obLevelShow:obPh === 'level', obMeShow:obPh === 'me',
        obIntroGo:this.obIntroGo, obFlySkip:this.obFlySkip, obBackOpen:this.obBackOpen, obBackClose:this.obBackClose, obBackGo:this.obBackGo, obBackFile:this.obBackFile, obFrOn:frOn,
        obLinkIn:S.frLinkIn, onObLink:(e) => this.setState({ frLinkIn:e.target.value }), obLinkText:S.frLinkBusy ? 'Signing in…' : 'Bring my progress here', obHasErr:!!S.frErr, obErrText:S.frErr,
        obCZh:obC.zh, obCTag:obC.tag, obCTitle:obC.title, obCBody:obC.body, obCChips:obC.chips, obCCount:((S.obCard || 0) + 1) + ' of 5', obCArt:'a' + (S.obCard || 0), obCShot:'aspect-ratio:' + obC.w + '/' + obC.h, obCImg:'background-image:url(' + obC.img + ')', obCAlt:obC.alt,
        obCDots:obCards.map((_, i) => ({ cls:'obm-dot' + (i === (S.obCard || 0) ? ' on' : '') })), obCPrev:(S.obCard || 0) > 0, obCBtn:(S.obCard || 0) === 4 ? 'Choose where to start' : 'Next', obCardNext:() => this.obCardGo(1), obCardPrev:() => this.obCardGo(-1), obGuideSkip:this.obGuideSkip,
        obLvlOpts:[['new', 'I am brand new to Chinese', 'Start with the sounds of Chinese (pinyin and tones, about 30 minutes), then your first words.', 'Recommended if Chinese is new to you'], ['some', 'I know a little', 'Go straight to HSK 1 words. The pinyin course is always there if you want it.', '']].map(([k, t, d, tag]) => ({ k, t, d, tag, hasTag:!!tag, cls:'obm-opt' + (S.obLvl === k ? ' on' : ''), pressed:S.obLvl === k ? 'true' : 'false', fn:() => this.obPickLvl(k) })), obLevelGo:this.obLevelGo,
        obName:S.obName, onObName:(e) => this.setState({ obName:e.target.value }), obFrShow:frOn && !(FR && FR.identity()), obJoinChk:S.obJoin ? 'true' : 'false', obJoinCls:'obm-chk' + (S.obJoin ? ' on' : ''), obJoinToggle:this.obJoinToggle,
        obGoals:[10, 20, 30, 45].map(m => ({ label:m + ' min', cls:(S.obGoal || S.mins) === m ? 'on' : '', fn:() => this.setState({ obGoal:m }) })), obHasMeErr:!!S.obErr, obMeErr:S.obErr, obMeBusy:S.obBusy, obGoText:S.obBusy ? 'Joining…' : ((S.obJoin && frOn && !(FR && FR.identity())) ? 'Save and join the group' : 'Save and start'), obMeGo:() => this.obMeGo(false), obGuideGo:() => this.obMeGo(true), obMeBack:this.obMeBack,
        guideLevels:[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ n, h:(46 + n * 22) + 'px', cls:'gd-rg' + (n <= 4 ? ' on' : '') })),
        obSoundsShow, obSoundsGo:this.obSoundsGo, obSoundsLater:this.obSoundsLater, pyTotal:(PYC.lessons || []).length,
        startShow, startWords, startGoing, startFresh:!startGoing, startBtnText:startGoing ? 'Continue my first session' : 'Learn my first 5 words', startDoneShow, guideAvail, isGuide:S.screen === 'guide',
        onbSkipStart:this.onbSkipStart, onbStartPath:this.onbStartPath, onbOpenGuide:this.onbOpenGuide, onbFlight:this.onbFlight,
        onbFlightShow:startDoneShow && !flown, guideSideCls:'linkbtn guide-link' + (S.screen === 'guide' ? ' on' : ''),
        isAch:S.screen === 'ach', achSummary:achSummary, achPct:achPct, achItems:achItems, achNext, hasAchNext:achNext.length > 0,
        achFilters:[['all', 'All'], ['earned', 'Earned'], ['locked', 'Not yet']].map(([k, l]) => ({ label:l, cls:(S.achf || 'all') === k ? 'on' : '', fn:() => this.setState({ achf:k }) })),
        navHome:navCls('home'), navPath:navCls('path'), goPath:() => this.go('path'), navAcct:active === 'acct' ? 'on' : '', goAcct:() => this.go('acct'), navReview:navCls('review'), navTest:navCls('testlobby'), navGrv:navCls('greview'), navGrammar:navCls('grammar'), navSpeak:navCls('speak'),
        goHome:() => this.go('home'), goReview:() => this.go('review'), goTest:() => this.go('testlobby'), goGrv:() => this.go('greview'), goGrammar:() => this.go('grammar'), goSpeak:() => this.go('speak'),
        hasDue:revBadgeN > 0, dueCount:revBadgeN,
        exTitle:LVN + ' mock exam',
        exIntro:LV === 1 ? 'Built like the official HSK 1 sample papers: 20 listening and 20 reading questions in four parts each, about 35 minutes. No hints and no pinyin while you answer. Each exam is drawn from a bank of 120+ questions, so it is different every time.' : LV === 4 ? 'Built like the HSK 4 sample papers of the 2012 test: 45 listening questions in three parts and 40 reading questions in three parts, about 75 minutes. Every question has four choices. No hints and no pinyin while you answer (the real paper has pinyin). Writing is separate practice. Each exam is drawn from a bank of 150+ questions, so it is different every time.' : LV === 3 ? 'Built like the HSK 3 sample papers of the 2012 test: 40 listening questions in four parts and 30 reading questions in three parts, about 65 minutes. No hints and no pinyin while you answer (the real paper has pinyin). Writing is separate practice. Each exam is drawn from a bank of 130+ questions, so it is different every time.' : 'Built like the HSK 2 sample papers of the 2012 test: 35 listening and 25 reading questions in four parts each, about 47 minutes. No hints and no pinyin while you answer (the real paper has pinyin). Each exam is drawn from a bank of 140+ questions, so it is different every time.',
        exListenT:'Listening · ' + EXAM_N.listening + ' questions · ' + EXAM_MIN.listening + ' min',
        exListenD:LV === 1 ? 'Part 1: does the picture match? Part 2: pick the picture for a sentence. Part 3: match five conversations to pictures. Part 4: a conversation, a question, three answers. Each clip can be played twice.' : LV === 4 ? 'Part 1 (10): does the sentence match the passage? Part 2 (15): a short conversation, a question, four answers. Part 3 (20): a longer conversation, a question, four answers. Each clip can be played twice.' : LV === 3 ? 'Part 1 (10): match conversations to pictures. Part 2 (10): does the sentence match the passage? Part 3 (10): a short conversation, a question, three answers. Part 4 (10): a longer conversation, a question, three answers. Each clip can be played twice.' : 'Part 1 (10): does the picture match the sentence? Part 2 (10): match conversations to pictures. Part 3 (10): a short conversation, a question, three answers. Part 4 (5): a longer conversation, a question, three answers. Each clip can be played twice.',
        exWriteT:HAS_WRITING ? 'Writing · ' + EXAM_N.writing + ' questions · ' + EXAM_MIN.writing + ' min · practice' : '',
        exWriteD:(LV === 4 ? 'Part 1 (10): tap the words in the right order. Part 2 (5): type the missing character.' : 'Part 1 (5): tap the words in the right order. Part 2 (5): type the missing character.') + ' Practice only: it does not count toward the 200 points or the seal.',
        exReadT:'Reading · ' + EXAM_N.reading + ' questions · ' + EXAM_MIN.reading + ' min',
        exReadD:LV === 1 ? 'Part 1: does the picture match the words? Part 2: match five sentences to pictures. Part 3: match five questions to answers. Part 4: fill five blanks from a word list.' : LV === 4 ? 'Part 1 (10): fill blanks from word lists. Part 2 (10): put three pieces in the right order to make a sentence. Part 3 (20): read a passage and answer a question with four choices.' : LV === 3 ? 'Part 1 (10): choose the reply that fits each sentence. Part 2 (10): fill blanks from a word list. Part 3 (10): read a passage and answer a question.' : 'Part 1 (5): match sentences to pictures. Part 2 (5): fill blanks from a word list. Part 3 (5): do two sentences mean the same? Part 4 (10): match questions to answers.',
        exCreditsOn:Object.keys(EXAM_MEDIA).length > 0, exCredits:Object.keys(EXAM_MEDIA).map(k => ({ a:EXAM_MEDIA[k].a, c:EXAM_MEDIA[k].c })),
        exNote:LV === 4 ? 'The real test has no pictures in the sample papers I followed, and none here. This layout follows the 2012 (HSK 2.0) HSK 4 sample papers (45 listening, 40 reading, 15 writing questions). I could not find the layout of the 2025 HSK band 4 exam, so it may differ. Listening gets 35 minutes because you press play yourself. The real writing section is written by hand; here you tap and type, and the site cannot judge a hand-written character or a free sentence.' : LV === 1 ? 'The real test has pictures; here ' + EX_PICNOTE + '. The official 2025 test is said to have 20 listening questions (about 12 minutes of audio) and 20 reading questions (20 minutes); the part-by-part layout above is from the official sample papers and I could not confirm every detail of the 2025 version. Listening gets 15 minutes here because you press play yourself.' : LV === 3 ? 'The real test has pictures; here ' + EX_PICNOTE + '. This layout follows the 2012 (HSK 2.0) sample papers. I could not find the layout of the 2025 HSK band 3 exam, so it may differ. Listening gets 35 minutes because you press play yourself. The real writing section is written by hand; here you tap and type, and the site cannot judge a hand-written character.' : 'The real test has pictures; here ' + EX_PICNOTE + '. This layout follows the 2012 (HSK 2.0) sample papers. I could not find the layout of the 2025 HSK band 2 exam, so it may differ. Listening gets 25 minutes because you press play yourself.',
        exScore:(LV === 1 ? 'Each question is worth 5 points, so each section is out of 100 and the total out of 200.' : LV === 4 ? 'Each section is worth 100 points, shared evenly by its questions (listening about 2.2 points a question, reading 2.5), so the total is out of 200. Writing practice is not scored in points.' : LV === 3 ? 'Each section is worth 100 points, shared evenly by its questions (listening 2.5 points a question, reading about 3.3), so the total is out of 200. Writing practice is not scored in points.' : 'Each section is worth 100 points, shared evenly by its questions (listening about 2.9 points a question, reading 4), so the total is out of 200.') + ' The official ' + LVN + ' pass mark is ' + (LV >= 3 ? '180 of 300, which is 60% and so 120 of the 200 here' : '120 of 200') + ' (I am not sure whether the 2025 version changed it). This site\'s ' + LVN + ' seal is stricter: ' + LVL.PASS_PCT + '% in every section of one full exam, and it opens ' + (LV < LVL.MAX_LEVEL ? 'HSK ' + (LV + 1) : 'the next level') + '.',
        chatVocab:KNOWN_LISTS + ' vocabulary only', lvName:LVN, nextLvName:'HSK ' + (TOPL + 1), lvIs1:TOPL === 1, lvIs2:TOPL !== 1, hasExamCard:!!EXAMBANK, noExamCard:!EXAMBANK,
        examCardTitle:ALL ? 'Level exams' : EXAMBANK ? LVN + ' level exam' : LVN + ' progress', examCardNote:ALL ? 'Each level has its own exam. Switch to that level in the header to take it; passing it opens the next level. The rings show your progress across all the levels shown here.' : EXAMBANK ? (LVL.levelPassed(LV) ? LVN + ' exam passed.' + (LV < LVL.MAX_LEVEL ? ' HSK ' + (LV + 1) + ' is open.' : '') : (LV < LVL.MAX_LEVEL ? 'Pass the full exam (' + LVL.PASS_PCT + '% in listening and in reading) to open HSK ' + (LV + 1) + '. The rings show how ready you are.' : 'Reach ' + LVL.PASS_PCT + '% in listening and in reading to pass.')) : 'The ' + LVN + ' level exam, listening lab and practice scripts are not built yet. These rings show the parts that are.',
        examBtnText:'See the ' + LVN + ' level exam',
        examNaTitle:ALL ? 'Level exams are taken one level at a time' : LVN + ' mock exam: not built yet',
        examNaText:ALL ? 'Each mock exam belongs to one level. Switch to that level in the header, take its exam there, and passing it opens the next level. Everything else on this page mixes all the levels you have unlocked.' : 'The mock exam is modelled on the official HSK 1 sample papers and exists for HSK 1 only so far. For ' + LVN + ', the Tests screen gives mixed questions from the words you have started, and Grammar has practice for every lesson.',
        lvLabel:ALL ? 'All levels' : 'HSK ' + LV, lvMenuOpen:!!S.lvMenu, lvMenuToggle:() => this.setState({ lvMenu:!S.lvMenu }),
        lvItems:Array.from({ length:LVL.MAX_LEVEL }, (_, i) => i + 1).concat([0]).map(n => {
          if (n === 0) { const openAll = LVL.unlockedLevels().length >= 2; return { label:'All levels', sub:openAll ? 'Every level you have opened, together' : 'Opens when two levels are unlocked', cls:(ALL ? 'on' : '') + (openAll ? '' : ' locked'), isOn:ALL, fn:() => { this.setState({ lvMenu:false }); if (openAll) this.switchLevel(0); else this.setState({ lvMsg:99 }); } }; }
          const open = LVL.unlocked(n);
          let sub = 'Locked: pass the HSK ' + (n - 1) + ' exam';
          if (open) {
            let got = 0; const tot = (window['HSK' + n + '_WORDS'] || []).length;
            try { const ws = n === LV && !ALL ? S.ws : ((readStore(n) || {}).ws || {}); Object.keys(ws).forEach(z => { if (ws[z] && ws[z].see && ws[z].see.s > 0) got++; }); } catch (e) {}
            sub = got + ' of ' + tot + ' words in memory';
          }
          return { label:'HSK ' + n, sub, cls:(!ALL && LV === n ? 'on' : '') + (open ? '' : ' locked'), isOn:!ALL && LV === n, fn:() => { this.setState({ lvMenu:false }); if (open) this.switchLevel(n); else this.setState({ lvMsg:n }); } };
        }),
        lvMsgShow:S.lvMsg > 0 && (S.lvMsg === 99 ? LVL.unlockedLevels().length < 2 : !LVL.unlocked(S.lvMsg)) ? true : false, lvMsgText:S.lvMsg === 99 ? 'All levels shows every level you have unlocked together, so it needs at least two. Pass the HSK 1 level exam (at least ' + LVL.PASS_PCT + '% in listening and in reading; each section can be taken separately) to unlock HSK 2. Already know HSK 1? Check your level (about 3 minutes) to start higher, or take the exam to earn its seal. You can also set all levels open in Settings.' : 'HSK ' + S.lvMsg + ' is locked. It opens when you pass the HSK ' + (S.lvMsg - 1) + ' level exam: at least ' + LVL.PASS_PCT + '% in listening and ' + LVL.PASS_PCT + '% in reading (each section can be taken separately and retaken). Already know HSK ' + (S.lvMsg - 1) + '? Check your level (about 3 minutes) to start higher, or take the exam to earn its seal. You can also set all levels open in Settings.',
        lvMsgGo:() => { const tgt = S.lvMsg === 99 ? 1 : S.lvMsg - 1; this.setState({ lvMsg:0 }); if (LV === tgt) this.go('exam'); else { try { localStorage.setItem('shanlu-level', String(tgt)); } catch (e) {} prefSet('level', tgt); window.location.reload(); } },
        lvMsgClose:() => this.setState({ lvMsg:0 }), lvMsgGoText:LV === (S.lvMsg === 99 ? 1 : S.lvMsg - 1) ? 'Go to the HSK ' + LV + ' exam' : 'Open HSK ' + (S.lvMsg === 99 ? 1 : S.lvMsg - 1),
        lvNote:'You are studying ' + LVN + '. Each level keeps its own progress on this device and its own copy when you sync. ' + (LVL.softLock() ? 'The lock is set to open: every level can be studied, and passing an exam only earns that level\'s seal.' : 'A level opens when you pass the exam of the level before it: at least ' + LVL.PASS_PCT + '% in listening and ' + LVL.PASS_PCT + '% in reading. You can sit each section on its own and retake it; your best result for each section counts. If you already know a level, check your level below to start higher (the check opens levels but earns no seal), or take the level exam. A lock on a button means it is not open yet.'),
        lockOpts:[[false, 'Locked until the exam is passed'], [true, 'All levels open']].map(o => ({ label:o[1], cls:LVL.softLock() === o[0] ? 'on' : '', fn:() => this.setLock(o[0]) })),
        isHome:S.screen === 'home', isVoice:S.screen === 'voice', isReview:S.screen === 'review', isLobby:S.screen === 'testlobby', isGrammar:S.screen === 'grammar', isGrv:S.screen === 'greview', isSpeak:S.screen === 'speak', isQuiz:S.screen === 'quiz',

        // home
        ringDash, todayLine:titles.home[1], tasks, minOpts, dayMin:S.dayMin, mins:S.mins, skills, wordTarget:bankKeys.length, wmTotal:startedCount, wm,
        wMastered:(wm.mastered / bankKeys.length * 100).toFixed(1) + '%', wFamiliar:(wm.familiar / bankKeys.length * 100).toFixed(1) + '%', wLearning:(wm.learning / bankKeys.length * 100).toFixed(1) + '%',
        stairs, sysNote:sd.note,
        todayShort:S.dayMin + ' of ' + S.mins + ' min' + (S.mins > S.dayMin ? ' · ' + (S.mins - S.dayMin) + ' to go' : ' · done'),
        webCapOpen:S.webCapOpen, toggleCapOpen:() => this.setState({ webCapOpen:!S.webCapOpen }),
        ascTrail:ascV === 'trail', ascStairs:ascV === 'stairs', ascHasSys:false,
        ascTrailCls:ascV === 'trail' ? 'on' : '', ascStairsCls:ascV === 'stairs' ? 'on' : '',
        setAscTrail:() => this.setState({ ascView:'trail' }), setAscStairs:() => this.setState({ ascView:'stairs' }),
        ascSub:ascV === 'trail' ? 'Every word you learn moves you along the path.' : 'Pass each level exam to move on to the next level.',
        trailD:{ src:trD.src, alt:trailAlt, labels:asLabels(trD).concat([youLabel(trD)]) }, trailP:{ src:trP.src, alt:trailAlt, labels:asLabels(trP).concat(trP.hideYou ? [] : [youLabel(trP)]) },
        cairnBig:allStarted ? 'All ' + totalW + ' started' : toGo + ' word' + (toGo === 1 ? '' : 's') + ' to go',
        cairnSub:allStarted ? 'Take the level exam when you feel ready.' : startedCount + ' of ' + nextM + '. A few cards and it is yours.', cairnPct:(allStarted ? 100 : Math.round((startedCount - prevM) / (nextM - prevM) * 100)) + '%',
        fireBig:streakShown > 0 ? streakShown + ' day' + (streakShown === 1 ? '' : 's') : 'No streak yet',
        fireSub:studiedToday ? 'You studied today. Come back tomorrow to keep it going.' : (streakShown > 0 ? 'Study today to keep the streak going.' : 'Study today to start one.'),
        todayBig:S.dayMin + ' of ' + S.mins + ' min', todaySub:minsLeft > 0 ? minsLeft + ' more minute' + (minsLeft === 1 ? '' : 's') + ' closes today\'s ring.' : 'Today\'s ring is closed. Anything else is a bonus.', todayPct:Math.min(100, Math.round(S.dayMin / Math.max(1, S.mins) * 100)) + '%',
        trailCta:() => this.go(ascCta.to), trailCtaText:ascCta.text,
        trailNote:'Levels are placed on the path, not to scale. The path counts the ' + LVN + ' words you have started; grammar, listening and speaking count towards the level exam.',
        mistClearText:mistClear + ' of ' + TOPICS.length + ' fully started', mistTiles, mistHasNear:!!nearBest, mistOpen:S.wmist, toggleMist:() => this.setState({ wmist:!this.state.wmist }), mistToggleText:S.wmist ? 'Hide the topic map' : 'Show all ' + TOPICS.length + ' topics',
        mistNearText:nearBest ? 'Finish ' + nearBest.name + ' (' + (nearBest.tot - nearBest.got) + ' to go)' : '', mistNearGo:() => nearBest && openTopic(nearBest.i),
        mistNote:'A topic is fully started when you have started every word in it.',
        sys2Cls:S.sys === '2.0' ? 'on' : '', sys3Cls:S.sys === '3.0' ? 'on' : '',
        setSys2:() => this.setState({ sys:'2.0' }), setSys3:() => this.setState({ sys:'3.0' }),

        // review
        msShow:(S.msQueue || []).length > 0, msIcon:(S.msQueue || [])[0] ? S.msQueue[0].icon : '', msTitle:(S.msQueue || [])[0] ? S.msQueue[0].title : '', msDesc:(S.msQueue || [])[0] ? S.msQueue[0].desc : '', msMore:(S.msQueue || []).length > 1 ? '+' + (S.msQueue.length - 1) + ' more' : '', msClose:() => { const q = (this.state.msQueue || []).slice(1); this.setState({ msQueue:q }); if (q.length) this.msArm(); else clearTimeout(this.msTimer); },
        dgPct:Math.min(100, Math.round(S.dayMin / Math.max(1, S.mins) * 100)) + '%', dgText:S.dayMin >= S.mins ? 'Daily goal reached. Everything now is a bonus.' : 'Daily goal: ' + S.dayMin + ' of ' + S.mins + ' min', dgDone:S.dayMin >= S.mins,
        autoplayLabel:prefGet('autoplay', true) !== false ? 'Words play by themselves. Turn off' : 'Words wait for a tap. Turn on', autoplayToggle:() => { prefSet('autoplay', prefGet('autoplay', true) === false); this.setState({ soundTick:(this.state.soundTick || 0) + 1 }); },
        soundOn:prefGet('sound', true) !== false, soundLabel:prefGet('sound', true) !== false ? 'Sounds are on. Turn off' : 'Sounds are off. Turn on', soundToggle:() => { const on = prefGet('sound', true) !== false; prefSet('sound', !on); this.setState({ soundTick:(this.state.soundTick || 0) + 1 }); if (!on) SFX.play('ok', true); }, soundTest:() => SFX.play('ok', true), soundTestDone:() => SFX.play('done', true),
        rcHead:rcHead, rcSub:rcSub, rcAcc:rcAcc, rcAccN:rcAccN, rcStreak:streakShown, hasHard:(S.rcounts.hard || 0) > 0, rcConfetti:rcAccN >= 60,
        inReview:!S.rcomplete && S.rq.length > 0, endSession:this.endSession, rcomplete:S.rcomplete, rdone:S.rdone, rtotal:S.rtotal, rxp:S.rxp, rcounts:S.rcounts,
        rPct:(S.rtotal ? Math.round(S.rdone / S.rtotal * 100) : 0) + '%',
        lants:(() => { const lit = S.rtotal ? Math.floor(S.rdone / S.rtotal * 10) : 0; return Array.from({ length:10 }, (_, i) => ({ cls:i < lit ? 'lit' : (i === lit ? 'now' : '') })); })(),
        rmissList:(S.rmiss || []).map(zh => ({ zh })), hasRmiss:(S.rmiss || []).length > 0,
        rrunShow:(S.rrun || 0) >= 3, rrunText:(S.rrun || 0) + ' right in a row',
        emptyNew:!S.rcomplete && S.rq.length === 0 && startedCount === 0 && lrnCount === 0,
        newWaiting:!S.rcomplete && S.rq.length === 0 && lrnCount > 0, newWaitingText:lrnCount + ' new word' + (lrnCount === 1 ? ' is' : 's are') + ' waiting. Meet them, then recall them a few cards later and once more before you finish: about ' + Math.max(2, Math.round(lrnCount * 1.2)) + ' minutes.', newWaitingBtn:'Learn ' + lrnCount + ' new word' + (lrnCount === 1 ? '' : 's'),
        hasLrnMore:S.rcomplete && lrnCount > 0, lrnMoreText:'Learn ' + lrnCount + ' new word' + (lrnCount === 1 ? '' : 's'),
        hasCalib:!!calText, calText,
        caughtUp:!S.rcomplete && S.rq.length === 0 && startedCount > 0 && dueLeft === 0 && lrnCount === 0, nextDueText, practiceAnyway:this.practiceAnyway,
        card, flip:this.flip, rflip:rflipV, flipCls:rflipV ? 'flip' : '', flipLabel:rflipV ? 'Flip the card back' : 'Show the answer',
        kbHint:S.rcomplete ? '' : rkind === 'flip' ? (S.rflip ? 'Keys: 1 Again · 2 Hard · 3 Good · 4 Easy · Space = Good · H hear word · S hear sentence' : 'Keys: Space show answer · 1 Again · 2 Hard · 3 Good · 4 Easy · P pinyin') : rkind === 'intro' ? 'Keys: Space or Enter = got it' : S.qchecked ? 'Keys: Space or Enter = continue' : rkind === 'type' ? 'Keys: type your answer, Enter to check' : rkind === 'audio' ? 'Keys: 1-4 to answer · P play again' : 'Keys: 1-4 to answer',
        rIsFlip:rkind === 'flip' || rkind === 'intro', rIsAuto:rAuto, rIsIntro:rkind === 'intro', rIsPlain:rkind === 'flip', rIntroDone:this.rIntroDone,
        cardAnim:S.rstep % 2 === 0 ? 'ea' : 'eb', showAnswerBtn:!S.rflip && rkind === 'flip', rates, rateGrid:rates, qfeed:S.qfeed, hasQfeed:!!S.qfeed,
        rpyShow:S.rpy && !rflipV && rkind === 'flip', toggleRpy:this.toggleRpy, pyBtnText:S.rpy ? 'Hide pinyin' : 'Show pinyin', quickNo:rates[0], quickYes:rates[2],
        playWord:() => this.sayAi(rw.zh, 'word'), playWordCls:pc('word') ? 'ink' : '',
        playEx:() => this.sayAi(rex.zh, 'ex'), playExCls:pc('ex') ? 'ink' : '',

        // lobby
        startTest:() => this.startQuiz('test'), testReady, testBlocked:!testReady,
        testInfo:(Math.min(10, Math.max(5, BANK_KEYS.filter(zh => DIMS.some(k => S.ws[zh][k].s > 0)).length))) + ' questions · about 4 minutes',
        recent:S.testHistory.map((r, i, a) => ({ date:r.date, score:r.score, h:Math.round(r.score * 1.4) + 'px', cls:i === a.length - 1 ? 'last' : '' })),
        hasRecent:S.testHistory.length > 0, noRecent:S.testHistory.length === 0,

        // grammar
        grvLvChips, hasGrvChips:grvLvChips.length > 0, grvSub:grvOpenN + ' of ' + grvRowsAll.length + ' points open · ' + grvStart + ' started · ' + grvDue + ' due · ' + grvMastered + ' mastered',
        grvStartLabel:grvOpenN === 0 ? 'Pass a grammar lesson to unlock' : grvDue > 0 ? 'Review ' + grvDue + ' due, and more' : 'Start grammar review', grvStart:() => (grvOpenN === 0 ? this.go('grammar') : this.startGrammarReview()), grvGoReview:() => this.go('greview'), 
        grvNote:grvOpenN === 0 ? 'Grammar points join this review once you pass their lesson (80% or more in the lesson practice), just as words join Review words once you have learned them.' : grvCanWrite ? 'It also asks you to write your own sentence. Claude checks it, and that is how a point becomes mastered.' : 'Add an AI key in Settings to unlock writing your own sentences. Without one you can still review, but no point can reach Mastered.',
        grvToggleLabel:S.grvOpen ? 'Hide tracker' : 'Show tracker', grvToggle:() => this.setState({ grvOpen:!S.grvOpen }), grvOpen:!!S.grvOpen, grvRows,
        grvMoreShow:!!S.grvOpen && grvRowsAll.length > 12, grvMoreLabel:S.grvAll ? 'Show fewer' : 'Show all ' + grvRowsAll.length, grvMore:() => this.setState({ grvAll:!S.grvAll }),
        lessonGroups, gramNoMatch, gq:S.gq, onGramSearch:(e) => this.setState({ gq:e.target.value }), lesson, gramPickOpen:S.gramPick ? 'true' : 'false', gramListCls:S.gramPick ? 'open' : '', toggleGramPick:() => this.setState({ gramPick:!S.gramPick }),
        startGrammar:() => this.startQuiz('grammar'),

        // speak
        spPick:S.sview === 'pick', spChat:S.sview !== 'pick', spBack:this.spBack,
        spCards:SCEN.map((x, i) => { const im = SSCN[x.id]; return { glyph:x.glyph, title:x.title, sub:x.sub, turns:x.you.length + ' turns', img:im ? 'background-color:' + im.c + ';background-image:url("' + im.u + '")' : '', state:S.sres[x.id] ? 'Done' : '', cls:S.sres[x.id] ? 'done' : '', fn:() => this.pickScenario(i), aria:x.title + (S.sres[x.id] ? ', done' : '') }; }),
        spDoneText:SCEN.filter(x => S.sres[x.id]).length + ' of ' + SCEN.length + ' places visited',
        stageStyle:SSCN[sc.id] ? '--sc:' + SSCN[sc.id].c + ';--scene:url("' + SSCN[sc.id].u + '")' : '', stageCls:SSCN[sc.id] ? 'staged' : '',
        aiStageStyle:S.aiScn >= 0 && SCEN[S.aiScn] && SSCN[SCEN[S.aiScn].id] ? '--sc:' + SSCN[SCEN[S.aiScn].id].c + ';--scene:url("' + SSCN[SCEN[S.aiScn].id].u + '")' : '', aiStageCls:S.aiScn >= 0 && SCEN[S.aiScn] && SSCN[SCEN[S.aiScn].id] ? 'staged' : '',
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
        onEnter:(e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && !e.repeat) this.primary(); },
        playQ:() => this.sayAi(q0.audio || '', 'q'), listenCls:pc('q'),
        showCheck:!S.qchecked, checkLabel:S.qbusy ? 'Checking…' : 'Check', hasQerr:!!S.qerr, qerr:S.qerr || '', checkCls:(canCheck && !S.qbusy) ? '' : 'dis', checkAria:canCheck ? 'false' : 'true', check:this.check,
        qchecked:S.qchecked, qcorrect:S.qcorrect, qwrong:!S.qcorrect, fbCls:S.qcorrect ? 'good' : 'bad',
        fbTitle:S.qcorrect ? (S.qcombo >= 3 ? S.qcombo + ' in a row!' : ['Correct', 'Nice', 'Right on', 'Spot on', 'Exactly', 'Yes'][(S.qi + S.rstep) % 6]) : (S.qfeed && /Right sounds|real word|check the tone|is a word too|only part of the word/.test(S.qfeed) ? 'So close' : 'Not quite'),
        next:this.next, nextLabel:S.qi + 1 >= total ? 'See results' : 'Continue',
        qcombo:S.qcombo, comboCls:S.qcombo >= 2 ? 'on' : '', exitQuiz:this.exitQuiz,
        resTitle, resSub, resScore:S.qscore + '/' + total, qbest:S.qbest, resGain,
        again:() => (S.qmode === 'greview' ? this.startGrammarReview() : this.startQuiz(S.qmode)),

        // footer
        exportData:this.exportData, importData:this.importData, resetAll:this.resetAll, goVoice:this.goVoice,
        ...this.voiceVals(),
        ...this.examVals(),
        ...this.aiVals(),
        ...this.pcVals(S),
        obTestCls:'obm-opt' + (S.obLvl === 'test' ? ' on' : ''), obTestPressed:S.obLvl === 'test' ? 'true' : 'false', obTestPick:() => this.obPickLvl('test'),
        lvMsgCheck:() => { const m = S.lvMsg; this.setState({ lvMsg:0 }); this.pcOpen('menu', m === 99 || !m ? 1 : m - 1); },
        pcNoteShow:!!S.pcNote, pcNoteText:S.pcNote, pcNoteClose:() => this.setState({ pcNote:'' }),
        syncOn:S.syncOn, syncOff:!S.syncOn, syncBusy:S.syncBusy, syncMsg:S.syncMsg, hasSyncMsg:!!S.syncMsg, syncMsgCls:S.syncBad ? 'bad' : 'good',
        syncInput:S.syncInput, onSyncInput:(e) => this.setState({ syncInput:e.target.value }), syncConnect:this.syncConnect, syncNow:() => this.syncNow(true), syncTest:this.syncTest, syncTestLabel:S.syncTesting ? 'Testing…' : 'Test connection', syncDisconnect:this.syncDisconnect,
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
  onPersonChange = () => { try { app.personChanged(); } catch (e) {} };
  app.testApi = { staleNew, comparePinyin, toneInfo, checkTyped, qSayIt, bump, buildQueue, itemOf, retK, retention, segHsk, aiPinyin };   // for the browser tests
  window.shanlu = app;
  // an exam photo that does not load (offline, blocked, removed) is dropped and its emoji shows instead
  document.addEventListener('error', (ev) => {
    const t = ev.target;
    const u = t && t.tagName === 'IMG' && t.getAttribute && t.getAttribute('data-exu');
    if (u && !exBad[u]) { exBad[u] = 1; app.setState({ exBadN:Object.keys(exBad).length }); }
  }, true);
  try { if (app.jyEnsure()) app.setState({ jyTick:1 }); } catch (e) {}   // the Journey points at a first region from the first visit, so the free first flight is waiting
  window.addEventListener('error', (ev) => { if (ev && ev.error) showErr(ev.error, 'run'); });
  window.addEventListener('unhandledrejection', (ev) => { if (ev && ev.reason && ev.reason.message && !/fetch|network|Failed to|aborted|AbortError|NotAllowed/i.test(ev.reason.message)) showErr(ev.reason, 'run'); });
  // app mode (a phone): the chat scrolls inside its own box, so keep the newest line in view
  if (window.MutationObserver && window.matchMedia) {
    const amQuery = window.matchMedia('(max-width:700px)'); let amQueued = false;
    new MutationObserver(() => {
      if (amQueued || !amQuery.matches) return;
      amQueued = true;
      requestAnimationFrame(() => { amQueued = false; document.querySelectorAll('.app.am .msgs').forEach(el => { if (el._amN !== el.children.length) { el._amN = el.children.length; el.scrollTop = el.scrollHeight; } }); });
    }).observe(document.body, { childList:true, subtree:true });
  }

  // keyboard: Space flips a review card, 1-4 rate it; in the exam, arrows move and A-F or 1-6 choose
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const S = app.state;
    if (S.screen === 'review') {
      if (e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return; }   // holding a key must not race through cards
      if ((e.key === ' ' || e.key === 'Enter') && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return;   // a focused button handles its own Space and Enter
      if (app.kbReview(e)) e.preventDefault();
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
  document.addEventListener('click', (e) => { try { if (window.shanlu && window.shanlu.state.lvMenu && !(e.target.closest && e.target.closest('.lvmenu'))) window.shanlu.setState({ lvMenu:false }); } catch (err) {} });
  document.addEventListener('keydown', (e) => { try { if (e.key === 'Escape' && window.shanlu && window.shanlu.state.lvMenu) window.shanlu.setState({ lvMenu:false }); if (e.key === 'Escape' && window.shanlu && window.shanlu.state.pstop) window.shanlu.pathClose(); } catch (err) {} });
  // after a mouse click on a Review button, drop the focus so Space and Enter go to the card, not back to that button
  document.addEventListener('click', (e) => { try { const b = e.target && e.target.closest && e.target.closest('.rev button'); if (b && e.detail > 0) b.blur(); } catch (err) {} });
  window.addEventListener('pagehide', () => { app.persistNow(); app.friendsPush({ minGap:2 * 60 * 1000, keepalive:true }); });
  app.settingsSeed();
  app.settingsApply();
  app.friendsBoot();
  app.onbBoot();
  // a failed save raises the banner; the next successful save clears it
  onSaveState = (bad) => { try { app.setState({ saveFail:bad, saveInfo:bad ? saveInfo : '' }); } catch (e) {} };
  if (saveFailed) onSaveState(true);
  app.ensurePersist(false);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; try { app.setState({ tipTick:(app.state.tipTick || 0) + 1 }); } catch (e2) {} });
  window.addEventListener('appinstalled', () => { installEvt = null; });
  // the offline copy (sw.js): a new version waits until the person taps Reload, so a page never mixes old and new files
  if ('serviceWorker' in navigator && !window.SHANLU_NO_SW && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.protocol + '//' + location.hostname)) {
    const start = () => navigator.serviceWorker.register('sw.js').then((reg) => {
      app.swReg = reg;
      const ready = () => { if (navigator.serviceWorker.controller) app.setState({ swReady:true }); };
      if (reg.waiting) ready();
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') ready(); }); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { reg.update().catch(() => {}); } catch (e) {} } });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (app.updating) { try { location.reload(); } catch (e) {} } });
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  }
  if (SYNCCFG.token) setTimeout(() => app.syncNow(false), 1200);
  // coming back to the app (switching from another app or device): pick up what the other devices did, at most once a minute
  let lastBack = 0;
  document.addEventListener('visibilitychange', () => { try { if (document.visibilityState === 'visible' && Date.now() - lastBack > 60000 && FR && FR.identity && FR.identity()) { lastBack = Date.now(); app.friendsProgressSync().catch(() => {}); } } catch (e) {} });
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
