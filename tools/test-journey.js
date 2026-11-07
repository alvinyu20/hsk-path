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

if (bad) { console.log(bad + ' failed'); process.exit(1); }
console.log('journey tests passed (' + W.regions.length + ' regions, ' + Object.keys(all).length + ' stops)');
