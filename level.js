/* Shanlu: which level this page shows, and which levels are unlocked. Runs before the data files and app.js.
 * The level is chosen in the header or in Settings, saved in this browser, and applied by reloading. A ?level=2 address works too
 * (used by the tests) but only if that level is unlocked. Level 0 means "All levels" (needs two unlocked levels).
 * Unlocking: level N+1 opens when level N's mock exam has been passed: 80% in listening AND 80% in reading. Each section can be sat on its own and
 * retaken: the best saved result of each section counts. That bar is the site's own (stricter than the official 60%); change PASS_PCT to change it.
 * The level check (placement.js) can also open levels: see placed() below. The lock can be switched to "open" in Settings (a person's preference, saved with the rest in 'shanlu-person'): every level opens, and passing the
 * exam only earns the level's seal. */
(function () {
  var LEVEL_KEY = 'shanlu-level';
  var PASSED_KEY = 'shanlu-passed';              // { "1": time } remembered even if that level's progress is later reset
  var PROGRESS_KEYS = { 1: 'shanlu-progress-v1', 2: 'shanlu-progress-v1-l2', 3: 'shanlu-progress-v1-l3', 4: 'shanlu-progress-v1-l4' };
  var MAX_LEVEL = 4;                            // the highest level that is open to learners (a level is added here only after it has passed every check)
  var PASS_PCT = 80;
  var DEFAULT_SIZE = { l: 20, r: 20 };          // exam entries saved before the totals were recorded were HSK 1: 20 + 20 questions

  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // one saved sitting of the mock exam: { mode, l, r, lt, rt } (correct answers and totals per section)
  function passedEntry(e) {
    if (!e || e.mode !== 'full' || e.l == null || e.r == null) return false;
    var lt = e.lt || DEFAULT_SIZE.l, rt = e.rt || DEFAULT_SIZE.r;
    return 100 * e.l / lt >= PASS_PCT && 100 * e.r / rt >= PASS_PCT;
  }
  // the best saved result of each section, as a percentage (-1 = never sat). A full sitting and a single-section sitting both count.
  function bestSections(list) {
    var l = -1, r = -1;
    (list || []).forEach(function (e) {
      if (!e) return;
      if (e.l != null) l = Math.max(l, 100 * e.l / (e.lt || DEFAULT_SIZE.l));
      if (e.r != null) r = Math.max(r, 100 * e.r / (e.rt || DEFAULT_SIZE.r));
    });
    return { l: l, r: r };
  }
  function passedList(list) { var b = bestSections(list); return b.l >= PASS_PCT && b.r >= PASS_PCT; }
  function levelPassed(n) {
    var memo = read(PASSED_KEY) || {};
    if (memo[n]) return true;
    var saved = read(PROGRESS_KEYS[n]);
    var list = saved && Array.isArray(saved.exams) ? saved.exams : [];
    if (passedList(list)) { markPassed(n); return true; }
    return false;
  }
  // "open" lock: every level can be studied; the exam only earns the seal (a person's setting, saved by app.js in 'shanlu-person')
  function softLock() { var p = read('shanlu-person'); return !!(p && p.prefs && p.prefs.softLock && p.prefs.softLock.v === true); }
  function markPassed(n) {
    var memo = read(PASSED_KEY) || {};
    if (!memo[n]) { memo[n] = Date.now(); write(PASSED_KEY, memo); }
  }
  // "placed": the highest level the person tested out of with the level check (a person's setting, saved by app.js as the preference 'placed').
  // Levels up to the one after it are open. It opens levels, it does not count as passing an exam, so it earns no seal.
  function placed() { var p = read('shanlu-person'); var v = p && p.prefs && p.prefs.placed && p.prefs.placed.v; return typeof v === 'number' && v > 0 ? Math.min(Math.floor(v), MAX_LEVEL) : 0; }
  function unlocked(n) { return n <= 1 || (n <= MAX_LEVEL && (softLock() || n <= placed() + 1 || levelPassed(n - 1))); }

  function unlockedLevels() { var out = []; for (var n = 1; n <= MAX_LEVEL; n++) if (unlocked(n)) out.push(n); return out; }

  var wanted = null, level = 1;
  try {
    var q = /[?&]level=(\d)/.exec(location.search);
    if (q) {
      wanted = parseInt(q[1], 10);
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}   // so a later reload does not reapply it
    } else {
      wanted = parseInt(localStorage.getItem(LEVEL_KEY), 10);
    }
  } catch (e) {}
  if (!(wanted >= 0 && wanted <= MAX_LEVEL)) wanted = 1;
  // level 0 is "All levels": every unlocked level together. It needs at least two unlocked levels; otherwise it falls back to HSK 1.
  var all = unlockedLevels();
  if (wanted === 0 && all.length >= 2) {
    level = 0;
  } else {
    level = wanted === 0 ? 1 : wanted;
    while (level > 1 && !unlocked(level)) level--;
  }
  try { localStorage.setItem(LEVEL_KEY, String(level)); } catch (e) {}

  window.SHANLU_LEVEL = level;
  window.SHANLU_LEVELS = level === 0 ? all : [level];   // the levels whose content this page shows
  window.SHANLU_LOCKED = wanted > level && level > 0 ? wanted : 0;   // the level that was asked for but is still locked
  window.ShanluLevel = { MAX_LEVEL: MAX_LEVEL, PASS_PCT: PASS_PCT, passedEntry: passedEntry, passedList: passedList, bestSections: bestSections, softLock: softLock, levelPassed: levelPassed, markPassed: markPassed, unlocked: unlocked, placed: placed, unlockedLevels: unlockedLevels, PROGRESS_KEYS: PROGRESS_KEYS };
  if (document.title) document.title = 'Shanlu · ' + (level === 0 ? 'all levels' : 'HSK ' + level) + ' study path';
})();
