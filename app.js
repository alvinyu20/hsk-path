/* Shanlu: the app logic.
 * State lives in one object. Progress is saved in this browser (localStorage) and can be exported to a file.
 * Content comes from data/hsk1.js. The page template is in index.html and rendered by runtime.js.
 */
(function () {
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
  const retr = (d) => (d.s > 0 ? Math.pow(1 + (19 / 81) * d.l / d.s, -0.5) : 0);
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
    return { s, l:0 };
  };
  const fmtInterval = (s) => (s < 1 ? 'Today' : s < 1.5 ? 'Tomorrow' : s < 45 ? 'In ' + Math.round(s) + ' days' : 'In ' + Math.round(s / 30) + ' months');

  const BANK = {};
  const EX = {};
  WORDS.forEach(w => { BANK[w.zh] = { zh:w.zh, py:w.py, en:w.en, pos:w.pos }; EX[w.zh] = w.ex; });
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
    const recall = started.length ? Math.round(100 * started.reduce((a, k) => a + retr({ s:w[k].s, l:w[k].l + off }), 0) / started.length) : 0;
    const dueN = started.length ? Math.min.apply(null, started.map(k => w[k].s - w[k].l - off)) : 9999;
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

  const PERSIST = ['sys', 'mins', 'theme', 'xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'sres', 'nlimit', 'clipBest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'rlast', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'wdelta', 'wreveal', 'spy', 'sen', 'shint'];

  function freshState() {
    let dark = false;
    try { dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    return {
      screen:'home', sys:'3.0', mins:20, theme:dark ? 'dark' : 'light',
      xp:0, dayXp:0, dayMin:0, streak:0, lastActive:'', activity:{}, day:'',
      gres:{}, sres:{}, nlimit:0, glesson:0, sidx:0, wq:'', wshow:40, clipBest:CLIPS.map(() => 0), misses:{}, testHistory:[],
      ws:blankWs(),
      rq:[], rtotal:0, rflip:false, rdone:0, rstep:0, rxp:0, rcomplete:false, rcounts:{ again:0, hard:0, good:0, easy:0 }, rlast:null,
      qmode:'test', qi:0, qpicked:[], qtyped:'', qchoice:null, qchecked:false, qcorrect:false, qscore:0, qcombo:0, qbest:0, qxp:0, qgain:0, qres:[], qdone:false,
      gdone:false, tdone:false, ldone:false, spokeToday:false, webCredited:false,
      sturn:0, spy:true, sen:true, shint:true, sdone:false,
      woff:0, wsort:'weak', wfilter:'all', wdelta:{}, wrated:{}, gfq:0, gfpick:null, shround:0, shbusy:false,
      wmode:'char', whub:0, wtopic:0, wquiz:false, wlearned:{}, wreveal:{},
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

  function mergeSaved(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    PERSIST.forEach(k => { if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k]; });
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
    const mcQ = (zh) => Object.assign({ type:'mc', kicker:'Meaning', prompt:'What does this word mean?', big:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:EX[zh].zh + ' ' + EX[zh].py + ' (' + EX[zh].en + ')', word:zh, dim:'see' }, choiceOptions(zh, z => BANK[z].en));
    return picks.map((zh, i) => {
      const kind = kinds[(i + offset) % kinds.length];
      const ex = EX[zh];
      if (kind === 'listen') return Object.assign({ type:'listen', kicker:'Listen', prompt:'Which word did you hear?', audio:zh, reveal:zh + ' · ' + BANK[zh].py + ' · ' + BANK[zh].en, explain:ex.zh + ' ' + ex.py + ' (' + ex.en + ')', word:zh, dim:'hear' }, choiceOptions(zh, z => z));
      if (kind === 'type') return { type:'type', kicker:'Type it', prompt:'Type the pinyin for this word', big:zh, placeholder:'Pinyin, for example shui', accepts:pinyinAccepts(BANK[zh].py, ''), reveal:BANK[zh].py + ' · ' + BANK[zh].en, explain:'Tone marks are optional for now. Example: ' + ex.zh + ' ' + ex.py, word:zh, dim:'prod' };
      if (kind === 'cloze' && ex.toks.indexOf(zh) >= 0 && ex.zh.split(zh).length === 2) return { type:'cloze', kicker:'Fill it', prompt:'Type the missing word', big:ex.zh.replace(zh, '___'), sub:ex.en, placeholder:'Pinyin or character', accepts:pinyinAccepts(BANK[zh].py, zh), reveal:zh + ' · ' + BANK[zh].py, explain:ex.py, word:zh, dim:'prod' };
      if (kind === 'order' && ex.toks.length >= 3 && ex.toks.length <= 8) return orderQ(ex.toks, { kicker:'Build it', prompt:'Put the words in order: ' + ex.en, reveal:ex.zh, explain:ex.py });
      return mcQ(zh);
    });
  }

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

    go = (screen) => { this.setState({ screen }); try { window.scrollTo(0, 0); } catch (e) {} };

    // audio (the browser's own text-to-speech; needs a click)
    say = (text, key, rate) => {
      try {
        const ss = window.speechSynthesis;
        if (ss) {
          const voices = ss.getVoices();
          const zh = voices.find(v => /^zh/i.test(v.lang));
          if (voices.length && !zh) this.setState({ noVoice:true });
          ss.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'zh-CN'; u.rate = rate || 0.85;
          if (zh) u.voice = zh;
          ss.speak(u);
        } else {
          this.setState({ noVoice:true });
        }
      } catch (e) {}
      this.setState({ playing:key });
      this.later(() => { if (this.state.playing === key) this.setState({ playing:null }); }, 1400);
    };

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
      ws[zh] = { see:{ s:0.5, l:0 }, hear:cur.hear, prod:cur.prod };
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
        ws[zh] = { see:{ s:0.5, l:0 }, hear:ws[zh].hear, prod:ws[zh].prod };
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
      const rex = EX[rzh];
      const cinfo = winfo(S.ws[rzh], 0);
      const card = Object.assign({ zh:rw.zh, py:rw.py, en:rw.en, stage:cinfo.chipCls, stageLabel:cinfo.mLabel, sizeCls:rw.zh.length > 1 ? 'two' : '', exZh:rex.zh, exPy:rex.py, exEn:rex.en, reportUrl:report('Review card for ' + rw.zh, rex.zh + ' (' + rex.py + ') ' + rex.en) }, cinfo);
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
      for (let k = 0; k <= turns; k++) {
        if (S.sturn >= k) msgs.push({ who:'ai', isAi:true, zh:sc.ai[k].zh, py:sc.ai[k].py, en:sc.ai[k].en, showPy:S.spy, showEn:S.sen, hasNote:false, note:'', noteCls:'', pc:pc('ai' + k), play:() => this.say(sc.ai[k].zh, 'ai' + k) });
        if (k < turns && S.sturn > k) msgs.push({ who:'me', isAi:false, zh:sc.you[k].zh, py:sc.you[k].py, en:sc.you[k].en, showPy:S.spy, showEn:S.sen, hasNote:false, note:'', noteCls:'', pc:'', play:() => {} });
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
        }, info, dlt(w.zh));
      };
      const hubNow = HUBS[S.whub];
      const hubCards = hubNow.words.map(w => cardOf(w, hubNow.hub));
      const hubOpts = HUBS.map((h, i) => ({ zh:h.hub, cls:S.whub === i ? 'on' : '', fn:() => this.setState({ whub:i, gfq:0, gfpick:null }) }));
      const gapNow = hubNow.gaps[S.gfq % hubNow.gaps.length];
      const gapDone = S.gfpick !== null;
      const gapOpts = gapNow.opts.map(zh => ({ zh, py:BANK[zh].py, cls:!gapDone ? '' : (zh === gapNow.ans ? 'right' : (zh === S.gfpick ? 'wrong' : '')), fn:() => this.gapPick(zh) }));
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
          play:() => this.say(zh, 'w' + zh), learn:() => this.learnWord(zh) }, info);
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
      const weak = Object.keys(S.misses).map(zh => ({ zh, n:S.misses[zh] })).sort((a, b) => b.n - a.n).slice(0, 3)
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
        isHome:S.screen === 'home', isReview:S.screen === 'review', isLobby:S.screen === 'testlobby', isGrammar:S.screen === 'grammar', isSpeak:S.screen === 'speak', isQuiz:S.screen === 'quiz',

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
        pyCls:S.spy ? 'on' : '', enCls:S.sen ? 'on' : '',
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
        exportData:this.exportData, importData:this.importData, resetAll:this.resetAll,
        repoUrl:'https://github.com/' + REPO
      };
    }
  }

  const root = document.getElementById('app');
  const tpl = document.getElementById('app-template');
  const app = DCMount(root, tpl, Component);
  window.shanlu = app;

  window.addEventListener('pagehide', () => app.persistNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.persistNow(); else app._schedule(); });
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
  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {}; } catch (e) {}
})();
