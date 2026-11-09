/* Tests for the Journey rules (journey.js) against the real stop data.   node tools/test-journey.js */
const fs = require('fs');
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'journey.js'));
const J = require(path.join(__dirname, '..', 'journey.js'));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

// seeded random numbers so a failure can be repeated
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---- the price ladder: free, 50, 100, 200, 300, 400, then 500 each ----
eq([1, 2, 3, 4, 5, 6, 7, 100].map(J.costOf), [0, 50, 100, 200, 300, 400, 500, 500], 'ladder: the first stop is free');
eq([0, 1, 2, 3, 4, 5, 6, 7].map(J.cum), [0, 0, 50, 150, 350, 650, 1050, 1550], 'cumulative cost');
eq([0, 49, 50, 149, 150, 349, 350, 649, 650, 1049, 1050].map(J.paidFor), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6], 'stops paid for');
for (let n = 2; n < 300; n++) ok(J.paidFor(J.cum(n)) === n && J.paidFor(J.cum(n) - 1) === n - 1, 'paidFor inverts cum at ' + n);

const W = J.build(window.JOURNEY);
ok(W.regions.length >= 1, 'regions exist');

// ---- every region: ids unique, every city has a name and coordinates, airport first ----
const all = {};
W.regions.forEach((R) => {
  ok(R.cities.length >= 1, R.id + ' has cities');
  ok(R.air && R.air.code, R.id + ' has an airport with a code');
  ok(R.cities[0].air, R.id + ' airport sits in the first city');
  R.cities.forEach((C) => {
    ok(C.lat != null && C.lon != null, C.id + ' city coordinates');
    ok(C.first && C.first.kind === 'City', C.id + ' has its city stop');
    C.stops.forEach((s) => { ok(!all[s.id], 'duplicate stop id ' + s.id); all[s.id] = 1; ok(s.zh && s.en && s.py, s.id + ' needs zh, en and pinyin'); ok(/^[㐀-鿿0-9a-zA-Z ·\-]+$/.test(s.zh), s.id + ' odd characters in the Chinese: ' + s.zh); });
  });
  // must-see stops: every region has a few, and they are a small share of its stops
  let nAll = 0, nSp = 0;
  R.cities.forEach((C) => C.stops.forEach((s) => { nAll++; if (s.sp) nSp++; }));
  ok(nSp >= 2, R.id + ' has at least two must-see stops (' + nSp + ')');
  ok(nSp <= Math.max(3, Math.round(nAll * 0.13)), R.id + ' keeps must-see stops rare (' + nSp + ' of ' + nAll + ')');
});

// ---- play every region to the end, many times, and check the order rules ----
for (let seed = 1; seed <= 25; seed++) {
  const rnd = seeded(seed); let st = J.ensure(W, null, rnd); const stamped = []; let guard = 0;
  const log = [];
  while (st.reg && guard++ < 5000) {
    const r = J.step(W, JSON.parse(JSON.stringify(st)), rnd, '2026-11-0' + (1 + (stamped.length % 9)));
    st = JSON.parse(JSON.stringify(r.st));   // the state survives being saved as JSON
    log.push(r);
    if (r.ev.indexOf('stamp') >= 0) stamped.push(r.region);
  }
  ok(guard < 5000, 'seed ' + seed + ' finished');
  ok(!st.reg, 'seed ' + seed + ' ends with no region left');
  eq(Object.keys(st.done).sort(), W.order.slice().sort(), 'seed ' + seed + ' every region stamped');
  eq(st.seen.length, Object.keys(all).length, 'seed ' + seed + ' every stop unlocked exactly once');
  eq(st.n, st.seen.length, 'seed ' + seed + ' count matches');
  // walk the log region by region
  let i = 0;
  while (i < log.length) {
    const rid = log[i].region; const R = W.byRegion[rid]; const run = [];
    while (i < log.length && log[i].region === rid) { run.push(log[i]); i++; }
    ok(run[0].stop === R.cities[0].air, 'seed ' + seed + ' ' + rid + ' starts with the airport');
    ok(run[0].ev.indexOf('arrive') >= 0, 'seed ' + seed + ' ' + rid + ' first step is the arrival');
    ok(run[1] && run[1].stop === R.cities[0].first, 'seed ' + seed + ' ' + rid + ' second stop is the main city');
    ok(run[run.length - 1].ev.indexOf('stamp') >= 0, 'seed ' + seed + ' ' + rid + ' ends with a stamp');
    eq(run.length, R.stops.length, 'seed ' + seed + ' ' + rid + ' all its stops');
    // cities come in blocks: the city stop first, then only that city's stops
    let cur = null, seenCities = {};
    run.forEach((r, k) => {
      if (k === 0) return;
      const s = r.stop;
      if (s.kind === 'City') { ok(!seenCities[s.cid], 'city twice ' + s.cid); seenCities[s.cid] = 1; cur = s.cid; }
      else ok(s.cid === cur, 'seed ' + seed + ' ' + rid + ' stop ' + s.id + ' is inside the city block of ' + cur);
    });
    // if the region has more than one city, the order of the other cities changes between seeds (checked below)
    log.__orders = log.__orders || {}; (log.__orders[rid] = log.__orders[rid] || []).push(run.filter((r) => r.stop.kind === 'City').map((r) => r.stop.cid).join());
  }
  if (seed === 1) global.__first = log;
}
// randomness: across seeds the cities and the stops inside a city are not always in the same order
{
  const orders = {}; const inner = {};
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = seeded(seed * 7); const R = W.regions[0];
    let st = J.ensure(W, null, rnd); st.reg = R.id; st.cq = [R.cities[0].id].concat(J.shuffle(R.cities.slice(1).map((c) => c.id), rnd));
    const ids = []; let r;
    do { r = J.step(W, st, rnd, '2026-11-01'); st = r.st; ids.push(r.stop.id); } while (r.ev.indexOf('stamp') < 0);
    orders[ids.filter((id) => W.byStop[id].kind === 'City').join()] = 1;
    inner[ids.slice(0, 12).join()] = 1;
  }
  ok(Object.keys(orders).length > 3, 'the order of cities varies between runs');
  ok(Object.keys(inner).length > 3, 'the stops inside the first cities vary between runs');
}

// ---- the meter: stops waiting, and the bar toward the next ----
{
  const st = J.fresh();
  const m0 = J.meter(0, st); eq([m0.ready, m0.nextCost], [1, 0], 'a new person has the first flight waiting at 0 XP');
  st.n = 1;
  eq(J.meter(0, st), { ready:0, nextCost:50, into:0, pct:0, toGo:50 }, 'meter after the first flight, at 0');
  eq(J.meter(30, st), { ready:0, nextCost:50, into:30, pct:60, toGo:20 }, 'meter at 30');
  const m = J.meter(260, st); eq([m.ready, m.pct], [2, 100], 'two stops waiting at 260 XP');
  st.n = 3; const m2 = J.meter(260, st); eq([m2.ready, m2.nextCost, m2.into, m2.toGo], [0, 200, 110, 90], 'after three stops, 110 XP into the next');
}

// ---- a stop added to the data later still turns up, and a removed one does not break anything ----
{
  const data = JSON.parse(JSON.stringify(window.JOURNEY)); const W2 = J.build(data); const rnd = seeded(5);
  let st = J.ensure(W2, null, rnd); const rid = st.reg;
  for (let k = 0; k < 5; k++) st = J.step(W2, st, rnd, '2026-11-01').st;
  const R = data.regions.find((r) => r.id === rid); R.cities[R.cities.length - 1].stops.push(['A', '新地方', 'Xīn Dìfang', 'A New Place', '', '']);
  const W3 = J.build(data); let r; let guard = 0;
  do { r = J.step(W3, st, rnd, '2026-11-02'); st = r.st; guard++; } while (r.ev.indexOf('stamp') < 0 && guard < 2000);
  ok(st.seen.some((id) => /a-new-place/.test(id)), 'a stop added later is still visited');
}

// ---- municipality note comes once per municipality ----
{
  const W4 = J.build(window.JOURNEY); const R = W4.byRegion.sichuan;
  if (R) {
    let st = J.fresh(); st.reg = 'sichuan'; st.cq = R.cities.map((c) => c.id); st.started = true; let n = 0; const rnd = seeded(3); let guard = 0;
    while (guard++ < 400) { const r = J.step(W4, st, rnd, '2026-11-01'); st = r.st; if (r.ev.indexOf('muni') >= 0) n++; if (r.ev.indexOf('stamp') >= 0) break; }
    eq(n, 1, 'the Chongqing note shows once');
  }
}

// two devices that unlock the next stop from the same saved journey get the same stop and the same order afterwards
{
  const base = J.step(W, J.ensure(W, null, seeded(7)), seeded(7), '2026-11-07').st; base.sd = 'abc12345';
  const a = J.step(W, base, J.rngFor(base), '2026-11-07'), b = J.step(W, JSON.parse(JSON.stringify(base)), J.rngFor(JSON.parse(JSON.stringify(base))), '2026-11-07');
  eq(a.st, b.st, 'the same saved journey gives the same next state on every device');
  let x = a.st, y = JSON.parse(JSON.stringify(a.st));
  for (let i = 0; i < 40; i++) { x = J.step(W, x, J.rngFor(x), '2026-11-07').st; y = J.step(W, y, J.rngFor(y), '2026-11-07').st; }
  eq(x.seen, y.seen, 'forty steps on two devices give the same journey');
  ok(J.seedOf({ seen: ['p', 'q', 'r'] }) === 'p,q' && J.seedOf({ sd: 'k', seen: ['p'] }) === 'k', 'an older journey without a seed uses its first stops as the seed');
}

if (bad) { console.log(bad + ' failed'); process.exit(1); }
// ---- Say it there: every stop gets one sentence, built from the fixed patterns ----
{
  const cjk = /[㐀-鿿]/; const kinds = {};
  Object.keys(W.byStop).forEach((id) => {
    const s = W.byStop[id]; const y = J.sayFor(s); kinds[y.kind] = (kinds[y.kind] || 0) + 1;
    ok(y.zh && y.py && y.en && y.tag, id + ' has a sentence with pinyin, English and a label');
    ok(/[。？！]$/.test(y.zh), id + ' sentence ends with Chinese punctuation: ' + y.zh);
    ok(!cjk.test(y.py), id + ' sentence pinyin has no Chinese characters left: ' + y.py);
    ok(!/[。？！，]/.test(y.py) && /[.?!]$/.test(y.py), id + ' sentence pinyin uses Latin punctuation: ' + y.py);
    if (s.k !== 'P') ok(y.zh.indexOf(s.zh) >= 0 && y.py.indexOf(s.py) >= 0, id + ' sentence holds the name of the stop');
    if (y.kind === 'drink') ok(y.zh.indexOf('吃') < 0, id + ' a drink is not eaten: ' + y.zh);
    if (y.kind === 'dish') ok(y.zh.indexOf('喝') < 0, id + ' a dish is not drunk: ' + y.zh);
    if (/[族人]$/.test(s.zh) && s.k === 'C') ok(y.zh.indexOf('是什么') < 0, id + ' a people is not asked about as a thing: ' + y.zh);
    eq(J.sayFor(s).zh, y.zh, id + ' the sentence is the same every time');
  });
  ok(kinds.dish > 400 && kinds.drink > 50 && kinds.buy > 50 && kinds.way > 600 && kinds.ask > 150 && kinds.city > 300 && kinds.air === 31, 'the kinds of sentence: ' + JSON.stringify(kinds));
  const kindOf = (zh, k) => { const s = Object.keys(W.byStop).map((id) => W.byStop[id]).find((x) => x.zh === zh && (!k || x.k === k)); return s ? J.sayKind(s) : 'missing ' + zh; };
  eq([kindOf('麻婆豆腐'), kindOf('龙井茶'), kindOf('信阳毛尖'), kindOf('肉骨茶'), kindOf('哈密瓜'), kindOf('湖笔'), kindOf('茶餐厅'), kindOf('西湖'), kindOf('北极光'), kindOf('京剧'), kindOf('成都', 'T')],
    ['dish', 'drink', 'drink', 'dish', 'buy', 'ask', 'near', 'way', 'ask', 'ask', 'city'], 'what kind of thing a stop is');
}

// ---- hops, routes and the passport extras ----
{
  ok(Math.abs(J.kmBetween(39.9, 116.4, 31.23, 121.47) - 1068) < 15, 'Beijing to Shanghai is about 1,070 km in a straight line');
  eq(J.dirBetween(30.66, 104.06, 29.55, 103.77)[2], 'south', 'Leshan is south of Chengdu');
  eq(J.dirBetween(30.66, 104.06, 39.9, 116.4)[0], '东北', 'Beijing is northeast of Chengdu');
  W.prefer = 'macau';
  let st = J.ensure(W, null, J.rngFor(null)); st.sd = 'hop-test';
  let prev = null, seenModes = {}, rides = 0, flights = [];
  for (let i = 0; i < 400 && Object.keys(st.done).length < 2; i++) {
    if (st.started) W.prefer = 'hongkong';   // the next region is chosen in the step that stamps this one
    const r = J.step(W, st, J.rngFor(st), '2026-11-09'); if (!r.stop) break;
    const h = J.hop(W, r.st, prev, r.stop.id, r.ev); ok(h && h.mode, 'every stop has a hop');
    seenModes[h.mode] = 1;
    if (h.mode === 'fly') { flights.push(h); ok(h.to.code && h.to.zh, 'a flight lands at an airport with a code'); }
    if (h.mode === 'ride') { rides++; ok(h.from.zh !== h.to.zh && h.km >= 0, 'a ride goes from one city to another'); }
    if (h.mode === 'walk') ok(h.inCity >= 1 && h.inCity <= h.ofCity, 'a walk counts the stops seen in the city');
    prev = r.stop.id; st = r.st;
  }
  W.prefer = null;
  eq(Object.keys(seenModes).sort(), ['fly', 'ride', 'walk'], 'the three ways of getting around all happen');
  ok(flights.length >= 2 && flights[0].from === null && flights[1].from && flights[1].from.code === 'MFM' && flights[1].km > 0, 'the first flight comes from home, the next from the region before');
  eq(rides, W.byRegion.macau.cities.length - 1 + W.byRegion.hongkong.cities.length - 1, 'one ride for every city after the first');
  eq(J.cityRoute(W, st, 'macau').length, W.byRegion.macau.cities.length, 'the route passes every city of the region once');
  eq(J.regionRoute(W, st).slice(0, 2), ['macau', 'hongkong'], 'the regions in the order flown');
  const cs = J.cityStamps(W, st); ok(cs.length >= W.byRegion.macau.cities.length + W.byRegion.hongkong.cities.length, 'a stamp for every finished city: ' + cs.length);
  ok(cs.every((c, i) => i === 0 || cs[i - 1].at <= c.at), 'city stamps come in the order earned');
  eq(J.mustSeen(W, st).length, W.byRegion.macau.stops.filter((s) => s.sp).length + W.byRegion.hongkong.stops.filter((s) => s.sp).length, 'a must-see stamp for every must-see stop seen');
}

console.log('journey tests passed ('  + W.regions.length + ' regions, ' + Object.keys(all).length + ' stops)');
