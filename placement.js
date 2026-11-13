/* Shanlu level check ("test out"): works out which HSK levels a person already knows, from a short multiple-choice check.
 * No page needed: this file only builds questions, runs the ladder and plans the words to mark as "probably known" (app.js shows it and saves it).
 *
 * The ladder goes from the top: the person says the highest level they think they know (the claim).
 *   1. The claimed level: 16 questions (12 words, 4 grammar). Pass = 12 right (75%). Every question has "I don't know" so guessing does not pay.
 *   2. Pass: a light check of every level below it, one after another (6 word questions, 4 right). The first one that fails ends the check there.
 *      Fail: step down one level and ask 10 questions (8 words, 2 grammar; 8 right), again and again until a level passes or HSK 1 fails.
 *   A stage ends as soon as its result cannot change (enough right, or too many missed to reach the pass mark).
 * The result is the highest level N such that levels 1 to N all passed (0 = none). The person is placed at N + 1 (at most the top level).
 * Nothing is certified: the level exam still earns the seal. Words of levels 1 to N are marked "probably known" (a short memory with a release date, so only
 * PER_DAY of them come back in Review each day and a slip is caught there); words answered right in the check are marked known outright.
 *
 * ShanluPlacement.newRun(claim, data, rng)  data = { max, words(level) -> [{zh,py,en,pos}], grammar(level) -> [lesson with q / qx] }
 * ShanluPlacement.current(run) -> the question (or null when done); .answer(run, index or -1 for "I don't know"); run.done / run.outcome when finished
 * ShanluPlacement.seedPlan(run, data, now, rng) -> { level: { word: { s, t, d, pk? } } }: the "see" memory to add for each word
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ShanluPlacement = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var FULL = { vocab: 12, grammar: 4, need: 12 };
  var STEP = { vocab: 8, grammar: 2, need: 8 };
  var LIGHT = { vocab: 6, grammar: 0, need: 4 };
  var PER_DAY = 20;            // probably-known words that come back in Review each day
  var KNOWN_S = 6;             // a word answered right in the check: next Review in about 6 days
  var PROBABLY_S = 0.5;        // a probably-known word: not yet confirmed, so a short memory; one right answer in Review lifts it (see bump in app.js)
  var DAY = 864e5;

  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // the first meaning of a word, without the notes in brackets: "two (before a measure word)" -> "two"
  function gloss(en) { return String(en || '').split(';')[0].replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); }
  function glossOk(en) { if (/[:：]/.test(String(en || ''))) return false; var g = gloss(en); return g.length >= 2 && g.length <= 38; }
  var STOP = { to: 1, a: 1, an: 1, the: 1, of: 1, be: 1, for: 1, in: 1, on: 1, at: 1, and: 1, or: 1, it: 1, is: 1, one: 1, someone: 1, something: 1, s: 1 };
  function tokens(g) { return g.toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !STOP[w]; }); }
  function overlaps(a, b) { var ta = tokens(a), tb = tokens(b); return ta.some(function (w) { return tb.indexOf(w) >= 0; }); }

  // n words spread over the whole level (one from each slice of the list), each with three wrong meanings: same kind of word first, never a shared word
  function vocabItems(level, words, n, rng, used) {
    var pool = words.filter(function (w) { return glossOk(w.en); });
    var out = [], size = pool.length / n;
    for (var i = 0; i < n && pool.length >= 4; i++) {
      var lo = Math.floor(i * size), hi = Math.max(lo + 1, Math.floor((i + 1) * size));
      var slice = shuffle(pool.slice(lo, hi).filter(function (w) { return !used[w.zh]; }), rng);
      if (!slice.length) continue;
      var w = slice[0], g = gloss(w.en);
      var cands = shuffle(pool.filter(function (x) { return x.zh !== w.zh && gloss(x.en).toLowerCase() !== g.toLowerCase() && !overlaps(gloss(x.en), g); }), rng);
      var same = cands.filter(function (x) { return x.pos === w.pos; }), other = cands.filter(function (x) { return x.pos !== w.pos; });
      var wrong = [], seen = {}; seen[g.toLowerCase()] = 1;
      same.concat(other).forEach(function (x) { var gx = gloss(x.en); if (wrong.length < 3 && !seen[gx.toLowerCase()] && !wrong.some(function (y) { return overlaps(y, gx); })) { seen[gx.toLowerCase()] = 1; wrong.push(gx); } });
      if (wrong.length < 3) continue;
      var opts = shuffle([g].concat(wrong), rng);
      used[w.zh] = 1;
      out.push({ k: 'v', lv: level, zh: w.zh, py: w.py, opts: opts, ans: opts.indexOf(g) });
    }
    return out;
  }

  // n "which sentence is correct" questions from n different grammar points
  function grammarItems(level, lessons, n, rng, used) {
    if (!n) return [];
    var byPt = {};
    (lessons || []).forEach(function (l) { (l.q || []).concat(l.qx || []).forEach(function (q) {
      if (q.type !== 'mc' || !q.options || q.options.length < 2 || !q.reveal || !q.pt) return;
      var labels = q.options.map(function (o) { return o.label; });
      if (labels.indexOf(q.reveal) < 0) return;
      (byPt[q.pt] = byPt[q.pt] || []).push(q);
    }); });
    var pts = shuffle(Object.keys(byPt), rng), out = [];
    for (var i = 0; i < pts.length && out.length < n; i++) {
      var q = shuffle(byPt[pts[i]].filter(function (x) { return !used['g:' + x.reveal]; }), rng)[0];
      if (!q) continue;
      used['g:' + q.reveal] = 1;
      var opts = shuffle(q.options.map(function (o) { return o.label; }), rng);
      out.push({ k: 'g', lv: level, prompt: q.prompt, opts: opts, ans: opts.indexOf(q.reveal), pt: q.pt });
    }
    return out;
  }

  function buildStage(level, cfg, data, rng, used) {
    var v = vocabItems(level, data.words(level) || [], cfg.vocab, rng, used);
    var g = grammarItems(level, data.grammar(level) || [], cfg.grammar, rng, used);
    return shuffle(v.concat(g), rng);
  }

  function startStage(run, level, phase) {
    var cfg = phase === 'full' ? FULL : phase === 'step' ? STEP : LIGHT;
    run.phase = phase; run.level = level; run.items = buildStage(level, cfg, run.data, run.rng, run.used);
    run.i = 0; run.ok = 0;
    run.need = Math.min(cfg.need, run.items.length);   // a level with too few questions cannot ask for more right answers than there are
    if (!run.items.length) endStage(run, false);
  }
  function finish(run, top) {
    run.done = true;
    run.outcome = { passedTop: top, placedAt: top >= 1 ? Math.min(top + 1, run.data.max) : 1, claim: run.claim, log: run.log };
  }
  function nextLight(run) {
    if (run.lightTodo.length) startStage(run, run.lightTodo.shift(), 'light'); else finish(run, run.passedTop);
  }
  function endStage(run, pass) {
    run.log.push({ level: run.level, phase: run.phase, pass: pass, ok: run.ok, of: run.items.length });
    if (run.phase === 'light') {
      if (pass) nextLight(run); else finish(run, run.level - 1);   // the levels below were checked first, so they passed
      return;
    }
    if (pass) {
      run.passedTop = run.level;
      run.lightTodo = []; for (var l = 1; l < run.level; l++) run.lightTodo.push(l);
      nextLight(run);
    } else if (run.level > 1) startStage(run, run.level - 1, 'step');
    else finish(run, 0);
  }

  function newRun(claim, data, rng) {
    var run = { claim: claim, data: data, rng: rng || Math.random, used: {}, log: [], confirmed: {}, passedTop: 0, lightTodo: [], done: false, outcome: null, answered: 0, level: claim, phase: 'full', items: [], i: 0, ok: 0, need: 0 };
    startStage(run, claim, 'full');
    return run;
  }
  function current(run) { return run.done ? null : run.items[run.i] || null; }
  function answer(run, idx) {
    var it = current(run); if (!it) return run;
    var right = idx === it.ans;
    if (right) { run.ok++; if (it.k === 'v') run.confirmed[it.zh] = it.lv; }
    run.i++; run.answered++;
    var left = run.items.length - run.i;
    if (run.ok >= run.need) endStage(run, true);
    else if (run.ok + left < run.need) endStage(run, false);
    return run;
  }
  // where the person is in the current stage, for the screen: "HSK 3 · question 4 of 16"
  function progress(run) {
    var label = run.phase === 'light' ? 'Quick check · HSK ' + run.level : run.phase === 'step' ? 'Next level down · HSK ' + run.level : 'HSK ' + run.level;
    return { label: label, n: Math.min(run.i + 1, run.items.length), of: run.items.length, pct: run.items.length ? Math.round(100 * run.i / run.items.length) : 0 };
  }

  // The memory to add for each word of the levels that passed. Words are ordered top level first (the ones we are least sure about), shuffled within a level,
  // and given release dates PER_DAY a day starting tomorrow. A word the person already started keeps its own memory (the app skips it).
  function seedPlan(run, data, now, rng) {
    rng = rng || run.rng || Math.random;
    var top = run.outcome ? run.outcome.passedTop : 0, plan = {};
    if (top < 1) return plan;
    var tomorrow = new Date(now); tomorrow.setHours(24, 0, 0, 0);
    var k = 0;
    for (var L = top; L >= 1; L--) {
      plan[L] = {};
      shuffle((data.words(L) || []).map(function (w) { return w.zh; }), rng).forEach(function (zh) {
        if (run.confirmed[zh] === L) { plan[L][zh] = { s: KNOWN_S, t: now, d: 5 }; return; }
        var rel = new Date(tomorrow); rel.setDate(rel.getDate() + Math.floor(k / PER_DAY)); k++;
        plan[L][zh] = { s: PROBABLY_S, t: now, d: 5, pk: rel.getTime() };
      });
    }
    var up = Math.min(top + 1, data.max);   // words answered right on the level just above: known too (that level is open now)
    if (up > top) { plan[up] = {}; Object.keys(run.confirmed).forEach(function (zh) { if (run.confirmed[zh] === up) plan[up][zh] = { s: KNOWN_S, t: now, d: 5 }; }); }
    return plan;
  }
  // add a plan to a saved "ws" (words -> skills). Words the person has already started are left alone. Returns how many words were added.
  function applyPlan(ws, levelPlan) {
    var n = 0;
    Object.keys(levelPlan || {}).forEach(function (zh) {
      var w = ws[zh] || {};
      if (w.see && w.see.s > 0) return;
      ws[zh] = Object.assign({}, w, { see: levelPlan[zh] }); n++;
    });
    return n;
  }

  return { FULL: FULL, STEP: STEP, LIGHT: LIGHT, PER_DAY: PER_DAY, KNOWN_S: KNOWN_S, PROBABLY_S: PROBABLY_S, gloss: gloss, newRun: newRun, current: current, answer: answer, progress: progress, seedPlan: seedPlan, applyPlan: applyPlan, buildStage: buildStage, DAY: DAY };
});
