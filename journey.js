/* The Journey: the rules of travelling through the Chinese-speaking world, with no screen code in it so they can be tested on their own.
 *
 * XP buys stops. The very first stop (the flight in) is free. After that the stops cost 100, 150, 200, 250 XP and 250 XP for every stop after that.
 * Inside a region the order is: the main airport, then the city that airport serves, then that city's other stops one at a time in random order,
 * then each other city of the region in random order (the city itself first, then its stops in random order). When the last stop of a region is
 * unlocked the region is stamped in the passport and the next region is picked at random (the next flight).
 *
 * State (plain JSON, saved as the person's "jy" preference):
 *   n      stops unlocked so far (all regions)
 *   reg    region the person is in, or heading to (null once every region is stamped)
 *   started  false until the airport of `reg` is unlocked (the flight in)
 *   cq     city ids still to come in this region, in the order they will unlock (the main city first)
 *   cur    city being explored now (null between cities)
 *   sq     stop ids still to come in the current city, in the order they will unlock
 *   seen   every stop id unlocked, in order
 *   done   { regionId: 'YYYY-MM-DD' } stamped regions
 *   arr    { regionId: 'YYYY-MM-DD' } when the person landed in a region
 *   ms     { name: 1 } municipalities whose "this is its own municipality" note has been shown
 */
(function (root) {
  const LADDER = [100, 150, 200, 250];
  const FLAT = 250;
  // the very first stop (the first flight in) is free, so a new person is welcomed at 0 XP; after that the ladder starts
  const costOf = (k) => (k <= 1 ? 0 : k - 1 <= LADDER.length ? LADDER[k - 2] : FLAT);
  const cum = (n) => { if (n <= 1) return 0; const m = n - 1; if (m <= LADDER.length) { let s = 0; for (let i = 0; i < m; i++) s += LADDER[i]; return s; } return LADDER.reduce((a, b) => a + b, 0) + (m - LADDER.length) * FLAT; };
  // how many stops the given lifetime XP has paid for
  const paidFor = (xp) => { let n = 0; while (cum(n + 1) <= xp && n < 100000) n++; return n; };

  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  function shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }


  // the 31 regions: Chinese name, English name, background hue (0-360; neighbours kept far apart). Region files may be missing for some while the lists are written.
  const META = {
    anhui:['安徽', 'Anhui', 120], fujian:['福建', 'Fujian', 350], gansu:['甘肃', 'Gansu', 350], guangdong:['广东', 'Guangdong', 35], guangxi:['广西', 'Guangxi', 150], guizhou:['贵州', 'Guizhou', 290],
    hainan:['海南', 'Hainan', 165], hebei:['河北', 'Hebei', 195], heilongjiang:['黑龙江', 'Heilongjiang', 215], henan:['河南', 'Henan', 75], hubei:['湖北', 'Hubei', 300], hunan:['湖南', 'Hunan', 85],
    neimenggu:['内蒙古', 'Inner Mongolia', 95], jiangsu:['江苏', 'Jiangsu', 280], jiangxi:['江西', 'Jiangxi', 175], jilin:['吉林', 'Jilin', 140], liaoning:['辽宁', 'Liaoning', 320], ningxia:['宁夏', 'Ningxia', 170],
    qinghai:['青海', 'Qinghai', 205], shaanxi:['陕西', 'Shaanxi', 55], shandong:['山东', 'Shandong', 25], shanxi:['山西', 'Shanxi', 250], sichuan:['四川', 'Sichuan', 8], xinjiang:['新疆', 'Xinjiang', 30],
    xizang:['西藏', 'Tibet (Xizang)', 285], yunnan:['云南', 'Yunnan', 215], zhejiang:['浙江', 'Zhejiang', 235], taiwan:['台湾', 'Taiwan', 45], hongkong:['香港', 'Hong Kong', 330], macau:['澳门', 'Macau', 355], singapore:['新加坡', 'Singapore', 130]
  };
  const SMALL = ['hongkong', 'macau', 'singapore'];

  // ---- the world: regions, cities, stops, indexed by id ----
  // data.regions[]: { id, zh, py, en, hue, air:{ zh, py, en, code, lat, lon, note, fun }, cities:[ { id, zh, py, en, lat, lon, note, fun, muni, stops:[[kind, zh, py, en, note, fun, lat, lon]] } ] }
  // kind letters in the data: A attraction, D dish, C culture
  const KINDS = { A:'Attraction', D:'Dish', C:'Culture', T:'City', P:'Airport' };
  function build(data) {
    const W = { regions:[], byRegion:{}, byCity:{}, byStop:{}, order:[] };
    (data.regions || []).forEach((r) => {
      const R = { id:r.id, zh:r.zh, py:r.py, en:r.en, hue:r.hue != null ? r.hue : (META[r.id] ? META[r.id][2] : 200), muni:r.muni || '', muniNote:r.muniNote || '', air:r.air, cities:[], stops:[] };
      const used = {};
      const add = (c, kind, zh, py, en, note, fun, lat, lon) => {
        let id = r.id + '.' + slug(kind + ' ' + en); if (used[id]) { let k = 2; while (used[id + '-' + k]) k++; id += '-' + k; } used[id] = 1;
        const s = { id, rid:r.id, cid:c.id, kind:KINDS[kind], k:kind, zh, py, en, note:note || '', fun:fun || '', lat:lat == null ? null : lat, lon:lon == null ? null : lon };
        c.stops.push(s); R.stops.push(s); W.byStop[id] = s; return s;
      };
      (r.cities || []).forEach((cd, ci) => {
        const C = { id:r.id + '.' + cd.id, key:cd.id, rid:r.id, zh:cd.zh, py:cd.py, en:cd.en, lat:cd.lat, lon:cd.lon, muni:cd.muni || '', stops:[], first:null, main:ci === 0 };
        R.cities.push(C); W.byCity[C.id] = C;
        if (ci === 0 && r.air) { C.air = add(C, 'P', r.air.zh, r.air.py, r.air.en + (r.air.code ? ' (' + r.air.code + ')' : ''), r.air.note, r.air.fun, r.air.lat == null ? cd.lat : r.air.lat, r.air.lon == null ? cd.lon : r.air.lon); C.air.code = r.air.code || ''; }
        C.first = add(C, 'T', cd.zh, cd.py, cd.en, cd.note, cd.fun, cd.lat, cd.lon);
        (cd.stops || []).forEach((s) => add(C, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]));
      });
      W.regions.push(R); W.byRegion[R.id] = R; W.order.push(R.id);
    });
    return W;
  }

  function fresh() { return { v:1, n:0, reg:null, started:false, cq:[], cur:null, sq:[], seen:[], done:{}, arr:{}, ms:{} }; }
  const clone = (st) => JSON.parse(JSON.stringify(st));

  // choose the next region at random from those not yet stamped; set up its city queue (the main city always first)
  function aim(W, st, rnd) {
    const left = W.order.filter((id) => !st.done[id]);
    if (!left.length) { st.reg = null; st.started = false; st.cq = []; st.cur = null; st.sq = []; return null; }
    const id = left[Math.floor(rnd() * left.length)];
    const R = W.byRegion[id];
    st.reg = id; st.started = false; st.cur = null; st.sq = [];
    st.cq = [R.cities[0].id].concat(shuffle(R.cities.slice(1).map((c) => c.id), rnd));
    return id;
  }
  // make sure the state points somewhere (first visit, or after the world changed)
  function ensure(W, st, rnd) {
    st = clone(st || fresh()); if (!st.ms) st.ms = {};
    if (st.reg && !W.byRegion[st.reg]) { st.reg = null; st.started = false; }
    if (!st.reg && Object.keys(st.done).length < W.order.length) aim(W, st, rnd);
    return st;
  }

  const seenSet = (st) => { const o = {}; st.seen.forEach((id) => { o[id] = 1; }); return o; };

  // unlock the next stop. Returns { st, stop, ev:[...], region, next } where ev holds: 'arrive' (flight in), 'city', 'citydone', 'muni', 'stamp', 'all'
  function step(W, st0, rnd, today) {
    const st = ensure(W, st0, rnd);
    if (!st.reg) return { st, stop:null, ev:[], region:null, next:null };
    const R = W.byRegion[st.reg]; const ev = []; let stop = null;
    const have = seenSet(st);
    const live = (ids) => ids.filter((id) => W.byStop[id] && !have[id]);
    st.sq = live(st.sq);
    st.cq = st.cq.filter((id) => W.byCity[id]);
    if (!st.started) {
      const main = R.cities[0];
      stop = main.air || main.first;   // a region without an airport arrives in its main city
      st.started = true; st.arr[R.id] = today; ev.push('arrive');
      if (!main.air) { st.cq = st.cq.filter((id) => id !== main.id); st.cur = main.id; st.sq = shuffle(live(main.stops.map((s) => s.id).filter((id) => id !== stop.id)), rnd); ev.push('city'); if (main.muni && !st.ms[main.muni]) { st.ms[main.muni] = 1; ev.push('muni'); } }
    } else if (st.sq.length) {
      stop = W.byStop[st.sq.shift()];
    } else {
      let cid = null;
      while (st.cq.length && !cid) { const c = st.cq.shift(); if (W.byCity[c]) cid = c; }
      if (cid) {
        const C = W.byCity[cid]; stop = C.first; st.cur = cid;
        st.sq = shuffle(live(C.stops.map((s) => s.id).filter((id) => id !== C.first.id && (!C.air || id !== C.air.id))), rnd);
        ev.push('city'); if (C.muni && !st.ms[C.muni]) { st.ms[C.muni] = 1; ev.push('muni'); }
      } else {
        // nothing queued: pick up anything in this region not yet seen (content added since), else the region is finished
        const rest = live(R.stops.map((s) => s.id));
        if (rest.length) { st.sq = shuffle(rest, rnd); stop = W.byStop[st.sq.shift()]; }
      }
    }
    let next = null, region = R.id;
    if (stop) {
      st.seen.push(stop.id); st.n++;
      const have2 = seenSet(st);
      if (st.sq.length === 0 && st.cur && W.byCity[st.cur] && ev.indexOf('citydone') < 0) ev.push('citydone');
      if (st.sq.length === 0 && st.cq.length === 0) {
        const rest = R.stops.filter((s) => !have2[s.id]);
        if (rest.length) { st.sq = shuffle(rest.map((s) => s.id), rnd); }
        else { st.done[R.id] = today; ev.push('stamp'); st.cur = null; next = aim(W, st, rnd); if (!next) ev.push('all'); }
      }
    }
    return { st, stop, ev, region, next };
  }

  // what the XP bar shows: stops waiting to be unlocked, XP into the next one, and its price
  function meter(xp, st) {
    const paid = paidFor(xp), ready = Math.max(0, paid - st.n);
    const nextCost = costOf(st.n + 1), into = Math.max(0, xp - cum(st.n));
    const into2 = ready > 0 ? nextCost : Math.min(nextCost, into);
    return { ready, nextCost, into:into2, pct:nextCost ? Math.round(100 * into2 / nextCost) : 100, toGo:Math.max(0, cum(st.n + 1) - xp) };
  }

  function regionStats(W, st, rid) {
    const R = W.byRegion[rid]; if (!R) return null;
    const have = seenSet(st); const total = R.stops.length; const got = R.stops.filter((s) => have[s.id]).length;
    const byKind = { Attraction:[0, 0], Dish:[0, 0], Culture:[0, 0], City:[0, 0], Airport:[0, 0] };
    R.stops.forEach((s) => { byKind[s.kind][1]++; if (have[s.id]) byKind[s.kind][0]++; });
    return { got, total, byKind, done:!!st.done[rid], here:st.reg === rid && st.started, citiesDone:R.cities.filter((c) => c.stops.every((s) => have[s.id])).length };
  }

  // pin position on a region map; a stop without coordinates of its own sits near its city, nudged by a fixed amount so pins do not pile up
  function pinLatLon(W, s) {
    if (s.lat != null && s.lon != null) return [s.lat, s.lon];
    const C = W.byCity[s.cid]; if (!C) return [30, 105];
    const h = hash(s.id); const ang = (h % 360) * Math.PI / 180; const rad = s.k === 'T' ? 0 : 0.04 + ((h >>> 9) % 100) / 100 * 0.09;
    return [C.lat + Math.sin(ang) * rad, C.lon + Math.cos(ang) * rad * 1.1];
  }
  function project(mp, lat, lon) {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [mp.tx + mp.k * lo, mp.ty - mp.k * Math.log(Math.tan(Math.PI / 4 + la / 2))];
  }

  const api = { META, SMALL, LADDER, FLAT, costOf, cum, paidFor, build, fresh, ensure, step, meter, regionStats, pinLatLon, project, shuffle, slug, KINDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ShanluJourney = api;
})(typeof window !== 'undefined' ? window : globalThis);
