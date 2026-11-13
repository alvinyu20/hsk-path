/* The level check's engine (placement.js) on the real word and grammar data: question building, the ladder, early stops, who gets placed where, and the
 * plan for the "probably known" words.   node tools/test-placement.js */
const path = require('path');
global.window = {};
for (let n = 1; n <= 4; n++) { require(path.join('..', 'data', 'hsk' + n + '-words.js')); require(path.join('..', 'data', 'hsk' + n + '-grammar.js')); }
const P = require('../placement.js');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
const data = { max: 4, words: (n) => window['HSK' + n + '_WORDS'] || [], grammar: (n) => (window['HSK' + n + '_GRAMMAR'] || {}).lessons || [] };
const seeded = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// a person who knows each word of level L with chance know[L] (a word they do not know: half the time "I don't know", half a guess)
const sit = (claim, know, seed) => {
  const rng = seeded(seed), r2 = seeded(seed + 7);
  const run = P.newRun(claim, data, rng); let guard = 0, asked = 0;
  while (!run.done && guard++ < 200) {
    const q = P.current(run); asked++;
    const knows = r2() < (know[q.lv] || 0);
    P.answer(run, knows ? q.ans : (r2() < 0.5 ? -1 : Math.floor(r2() * q.opts.length)));
  }
  return { run, asked };
};

// ---- questions ----
{
  const run = P.newRun(3, data, seeded(1));
  const items = run.items;
  check(items.length === 16 && items.filter((x) => x.k === 'v').length === 12 && items.filter((x) => x.k === 'g').length === 4, 'the first stage has 12 word and 4 grammar questions: ' + items.length);
  check(items.every((x) => x.lv === 3), 'every question is from the claimed level');
  const v = items.filter((x) => x.k === 'v');
  check(v.every((x) => x.opts.length === 4 && new Set(x.opts).size === 4 && x.ans >= 0 && x.ans < 4), 'a word question has four different meanings and one right answer');
  const w = (n) => data.words(n).find((x) => x.zh === v[0].zh);
  check(v[0].opts[v[0].ans] === P.gloss(w(3).en), 'the right option is the first meaning of the word: ' + v[0].zh + ' = ' + v[0].opts[v[0].ans]);
  check(v.every((x) => !/[:(]/.test(x.opts.join('|'))), 'no notes in brackets or odd glosses in the options');
  check(new Set(v.map((x) => x.zh)).size === 12, 'no word is asked twice');
  const g = items.filter((x) => x.k === 'g');
  check(g.every((x) => x.opts.length >= 2 && x.ans >= 0 && new Set(g.map((y) => y.pt)).size === g.length), 'grammar questions come from different points, each with its right answer');
  // the words are spread over the whole list, not the first lessons
  const idx = v.map((x) => data.words(3).findIndex((y) => y.zh === x.zh));
  check(Math.max.apply(null, idx) > data.words(3).length * 0.7 && Math.min.apply(null, idx) < data.words(3).length * 0.3, 'words are spread over the level: positions ' + idx.sort((a, b) => a - b).join(','));
}

// ---- the ladder ----
{
  let r = sit(3, { 1: 1, 2: 1, 3: 1, 4: 0 }, 11);
  check(r.run.done && r.run.outcome.passedTop === 3 && r.run.outcome.placedAt === 4, 'knows 1-3 and claims 3: placed at HSK 4 ' + JSON.stringify(r.run.outcome.log.map((x) => x.level + x.phase[0] + (x.pass ? '+' : '-'))));
  check(r.run.log.length === 3 && r.run.log[0].phase === 'full' && r.run.log[1].phase === 'light' && r.run.log[1].level === 1 && r.run.log[2].level === 2, 'a pass is followed by a light check of HSK 1 then HSK 2');
  check(r.asked === 12 + 4 + 4, 'a person who knows it all is asked only what is needed (12 + 4 + 4, each stage stops once the pass mark is reached): ' + r.asked);
  r = sit(4, { 1: 1, 2: 1, 3: 0, 4: 0 }, 12);
  check(r.run.outcome.passedTop === 2 && r.run.outcome.placedAt === 3, 'claims 4, knows 1-2: steps down to HSK 3 (fail) then HSK 2 (pass): placed at HSK 3 ' + JSON.stringify(r.run.log.map((x) => x.level + x.phase[0] + (x.pass ? '+' : '-'))));
  check(r.run.log[1].phase === 'step' && r.run.log[1].level === 3, 'the step-down stage is the level below the claim');
  r = sit(4, { 1: 1, 2: 1, 3: 1, 4: 1 }, 13);
  check(r.run.outcome.passedTop === 4 && r.run.outcome.placedAt === 4, 'knows everything: placed at the top level, not past it');
  r = sit(2, { 1: 0, 2: 0 }, 14);
  check(r.run.outcome.passedTop === 0 && r.run.outcome.placedAt === 1, 'a beginner who claims HSK 2: nothing passes, starts at HSK 1');
  check(r.asked < 16 + 10, 'a stage ends as soon as it cannot be passed (a beginner is not asked everything): ' + r.asked);
  r = sit(3, { 1: 1, 2: 0, 3: 1 }, 15);
  check(r.run.outcome.passedTop === 1, 'passes the claimed level but fails the light check of HSK 2: placed after HSK 1 only ' + JSON.stringify(r.run.log.map((x) => x.level + x.phase[0] + (x.pass ? '+' : '-'))));
  r = sit(1, { 1: 1 }, 16);
  check(r.run.outcome.passedTop === 1 && r.run.outcome.placedAt === 2 && r.run.log.length === 1, 'claims HSK 1 and passes: no light check needed, placed at HSK 2');
}

// ---- how often people are placed right (simulated: 200 sittings each) ----
{
  const tally = (claim, know) => { const t = {}; for (let s = 0; s < 200; s++) { const r = sit(claim, know, 1000 + s).run.outcome.passedTop; t[r] = (t[r] || 0) + 1; } return t; };
  const t1 = tally(3, { 1: 0.95, 2: 0.9, 3: 0.85 });
  check((t1[3] || 0) >= 170, 'someone who knows 85-95% of HSK 1-3 is placed past HSK 3 at least 85% of the time: ' + JSON.stringify(t1));
  const t2 = tally(3, { 1: 0.5, 2: 0.4, 3: 0.3 });
  check(((t2[3] || 0) + (t2[2] || 0)) <= 20, 'someone who knows 30-50% claims HSK 3 and is rarely placed past 2: ' + JSON.stringify(t2));
  const t3 = tally(4, { 1: 0.2, 2: 0.1, 3: 0.05, 4: 0 });
  check((t3[0] || 0) >= 190, 'a near-beginner who claims HSK 4 is almost always started at HSK 1: ' + JSON.stringify(t3));
}

// ---- the plan for words ----
{
  const r = sit(3, { 1: 1, 2: 1, 3: 1 }, 21);
  const now = new Date(2026, 10, 13, 15, 0, 0).getTime();
  const plan = P.seedPlan(r.run, data, now, seeded(5));
  check(Object.keys(plan).map(Number).sort().join() === '1,2,3,4', 'words are planned for the passed levels and the confirmed ones of the level above: ' + Object.keys(plan));
  const all = [].concat.apply([], [1, 2, 3].map((n) => Object.keys(plan[n])));
  check(all.length === data.words(1).length + data.words(2).length + data.words(3).length, 'every word of the passed levels is planned: ' + all.length);
  const probably = [].concat.apply([], [1, 2, 3].map((n) => Object.values(plan[n]))).filter((d) => d.pk);
  const known = [].concat.apply([], [1, 2, 3, 4].map((n) => Object.values(plan[n] || {}))).filter((d) => !d.pk);
  check(known.length === Object.keys(r.run.confirmed).length && known.every((d) => d.s === P.KNOWN_S), 'words answered right in the check are known, not "probably": ' + known.length);
  check(probably.every((d) => d.s === P.PROBABLY_S && d.t === now), 'the rest are short memories');
  const days = {}; probably.forEach((d) => { days[d.pk] = (days[d.pk] || 0) + 1; });
  const keys = Object.keys(days).map(Number).sort((a, b) => a - b);
  check(keys.slice(0, -1).every((k) => days[k] === 20) && days[keys[keys.length - 1]] <= 20, 'exactly 20 words a day, the last day may be short (' + keys.length + ' days, last day ' + days[keys[keys.length - 1]] + ')');
  const first = new Date(keys[0]);
  check(first.getHours() === 0 && first.getDate() === 14, 'the first words come back the next day, from midnight: ' + first.toString().slice(0, 24));
  check(keys.every((k, i) => i === 0 || Math.round((k - keys[i - 1]) / 864e5) === 1), 'one release date per day');
  // the highest passed level is released first
  const lvOf = {}; [1, 2, 3].forEach((n) => Object.keys(plan[n]).forEach((z) => { lvOf[z] = n; }));
  const firstDay = Object.keys(plan[3]).filter((z) => plan[3][z].pk === keys[0]).length;
  check(firstDay > 0, 'the highest level passed comes first: ' + firstDay + ' of the first day are HSK 3');
  // applying to a saved word list leaves started words alone
  const ws = { [Object.keys(plan[1])[0]]: { see: { s: 9, t: 1, d: 3 } } };
  const n = P.applyPlan(ws, plan[1]);
  check(n === Object.keys(plan[1]).length - 1 && ws[Object.keys(plan[1])[0]].see.s === 9, 'a word the person already started keeps its own memory');
  const none = P.seedPlan(sit(2, { 1: 0, 2: 0 }, 22).run, data, now, seeded(6));
  check(Object.keys(none).length === 0, 'nothing is planned when no level passed');
}

console.log(failures ? failures + ' FAILED' : 'all passed');
process.exit(failures ? 1 : 0);
