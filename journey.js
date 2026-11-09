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
  const LADDER = [50, 100, 200, 300, 400];
  const FLAT = 500;
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
      const R = { id:r.id, zh:r.zh, py:r.py, en:r.en, hue:r.hue != null ? r.hue : (META[r.id] ? META[r.id][2] : 200), muni:r.muni || '', munis:r.munis || {}, air:r.air, cities:[], stops:[] };
      const used = {};
      const add = (c, kind, zh, py, en, note, fun, lat, lon, sp) => {
        let id = r.id + '.' + slug(kind + ' ' + en); if (used[id]) { let k = 2; while (used[id + '-' + k]) k++; id += '-' + k; } used[id] = 1;
        const s = { id, rid:r.id, cid:c.id, kind:KINDS[kind], k:kind, zh, py, en, note:note || '', fun:fun || '', lat:lat == null ? null : lat, lon:lon == null ? null : lon, sp:!!sp };
        c.stops.push(s); R.stops.push(s); W.byStop[id] = s; return s;
      };
      (r.cities || []).forEach((cd, ci) => {
        const C = { id:r.id + '.' + cd.id, key:cd.id, rid:r.id, zh:cd.zh, py:cd.py, en:cd.en, lat:cd.lat, lon:cd.lon, muni:cd.muni || '', stops:[], first:null, main:ci === 0 };
        R.cities.push(C); W.byCity[C.id] = C;
        if (ci === 0 && r.air) { C.air = add(C, 'P', r.air.zh, r.air.py, r.air.en + (r.air.code ? ' (' + r.air.code + ')' : ''), r.air.note, r.air.fun, r.air.lat == null ? cd.lat : r.air.lat, r.air.lon == null ? cd.lon : r.air.lon); C.air.code = r.air.code || ''; }
        C.first = add(C, 'T', cd.zh, cd.py, cd.en, cd.note, cd.fun, cd.lat, cd.lon);
        (cd.stops || []).forEach((s) => add(C, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8]));
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
    const id = W.prefer && left.indexOf(W.prefer) >= 0 ? W.prefer : left[Math.floor(rnd() * left.length)];   // W.prefer is for tests only
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
  // A place on the country map (the 350 x 290 one in data/journey-map.js): the same Albers equal-area cone the outlines were drawn with
  // (centre 105 E, 36 N, parallels 27 and 45), with the scale and shift fitted to the outlines (317 of 331 cities fall inside their own region).
  const AL = (() => { const d = Math.PI / 180, s0 = Math.sin(27 * d), n = (s0 + Math.sin(45 * d)) / 2, c = 1 + s0 * (2 * n - s0), r0 = Math.sqrt(c) / n;
    const fw = (lo, la) => { const r = Math.sqrt(c - 2 * n * Math.sin(la)) / n; return [r * Math.sin(lo * n), r0 - r * Math.cos(lo * n)]; };
    return { d, fw, ctr: fw(0, 36 * d) }; })();
  function projectCountry(lat, lon) {
    const p = AL.fw((lon - 105) * AL.d, lat * AL.d);
    return [190 + 438 * (p[0] - AL.ctr[0]), 149.5 - 438 * (p[1] - AL.ctr[1])];
  }
  function project(mp, lat, lon) {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [mp.tx + mp.k * lo, mp.ty - mp.k * Math.log(Math.tan(Math.PI / 4 + la / 2))];
  }

  // The random choices of a step come from the journey itself (its seed and how many stops are unlocked), not from Math.random, so two devices that
  // unlock the next stop from the same saved journey end up with the same stop and the same order of what follows.
  function seedOf(st) { return (st && st.sd) || ((st && st.seen) || []).slice(0, 2).join(',') || (st && st.reg) || 'journey'; }
  function rngFor(st) {
    let a = hash(seedOf(st) + ':' + ((st && st.n) || 0)) || 1;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- hops: how you got to a stop (a flight into a region, a ride between two cities, a walk inside a city) ----
  const DIRS = [['北', 'běi', 'north'], ['东北', 'dōngběi', 'northeast'], ['东', 'dōng', 'east'], ['东南', 'dōngnán', 'southeast'], ['南', 'nán', 'south'], ['西南', 'xīnán', 'southwest'], ['西', 'xī', 'west'], ['西北', 'xīběi', 'northwest']];
  // straight-line distance in km and the compass direction from the first place to the second
  function kmBetween(la1, lo1, la2, lo2) { const d = Math.PI / 180, a = Math.sin((la2 - la1) * d / 2) ** 2 + Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin((lo2 - lo1) * d / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))); }
  function dirBetween(la1, lo1, la2, lo2) { const d = Math.PI / 180, y = Math.sin((lo2 - lo1) * d) * Math.cos(la2 * d), x = Math.cos(la1 * d) * Math.sin(la2 * d) - Math.sin(la1 * d) * Math.cos(la2 * d) * Math.cos((lo2 - lo1) * d); const b = (Math.atan2(y, x) / d + 360) % 360; return DIRS[Math.round(b / 45) % 8]; }
  const roundKm = (k) => (k < 20 ? Math.round(k) : k < 200 ? Math.round(k / 5) * 5 : Math.round(k / 10) * 10);
  const placeOf = (C, code) => ({ zh:C.zh, py:C.py, en:C.en, code:code || '' });
  // fromId is the stop you were at before (null on the very first flight); ev is the list of events step() returned
  function hop(W, st, fromId, toId, ev) {
    const to = W.byStop[toId]; if (!to) return null; const from = fromId ? W.byStop[fromId] : null;
    const TC = W.byCity[to.cid], TR = W.byRegion[to.rid]; ev = ev || [];
    const have = seenSet(st); const inCity = TC.stops.filter((s) => have[s.id]).length;
    if (ev.indexOf('arrive') >= 0) {
      const FR = from ? W.byRegion[from.rid] : null; const main = TR.cities[0]; const ta = main.air || main.first;
      const o = { mode:'fly', to:placeOf(main, ta.code), toRegion:{ zh:TR.zh, en:TR.en }, from:null, km:0, dir:null, no:Object.keys(st.arr || {}).length, date:(st.arr || {})[TR.id] || '' };
      if (FR && FR.id !== TR.id) { const fm = FR.cities[0], fa = fm.air || fm.first; o.from = placeOf(fm, fa.code); o.fromRegion = { zh:FR.zh, en:FR.en }; o.km = roundKm(kmBetween(fa.lat, fa.lon, ta.lat, ta.lon)); o.dir = dirBetween(fa.lat, fa.lon, ta.lat, ta.lon); }
      return o;
    }
    if (ev.indexOf('city') >= 0 && from && from.cid !== to.cid && W.byCity[from.cid]) {
      const FC = W.byCity[from.cid]; const k = kmBetween(FC.lat, FC.lon, TC.lat, TC.lon);
      return { mode:'ride', from:placeOf(FC), to:placeOf(TC), km:roundKm(k), dir:k >= 3 ? dirBetween(FC.lat, FC.lon, TC.lat, TC.lon) : null, no:st.n };
    }
    return { mode:'walk', to:placeOf(TC), inCity, ofCity:TC.stops.length, no:st.n };
  }
  // the cities of a region in the order they were first reached, and the regions in the order they were flown to (both read from `seen`)
  function cityRoute(W, st, rid) { const out = []; st.seen.forEach((id) => { const s = W.byStop[id]; if (s && s.rid === rid && out[out.length - 1] !== s.cid) out.push(s.cid); }); return out; }
  function regionRoute(W, st) { const out = []; st.seen.forEach((id) => { const s = W.byStop[id]; if (s && out[out.length - 1] !== s.rid) out.push(s.rid); }); return out; }
  // passport extras: a stamp for every city whose stops are all seen (in the order earned) and for every must-see stop seen
  function cityStamps(W, st) {
    const at = {}; st.seen.forEach((id, i) => { at[id] = i; }); const out = [];
    Object.keys(W.byCity).forEach((cid) => { const C = W.byCity[cid]; let last = -1; for (let i = 0; i < C.stops.length; i++) { const a = at[C.stops[i].id]; if (a == null) return; if (a > last) last = a; } out.push({ cid, at:last }); });
    return out.sort((a, b) => a.at - b.at);
  }
  function mustSeen(W, st) { return st.seen.map((id) => W.byStop[id]).filter((s) => s && s.sp); }

  // ---- Say it there: one short sentence a traveller would say at this stop, built from a few fixed patterns so the Chinese stays right ----
  // Each pattern: [Chinese, pinyin, English]; X is the stop's name. Which patterns fit depends on what the stop is (a dish, a drink, something you buy, a place, a custom...).
  const P_DISH = [['我想吃X。', 'Wǒ xiǎng chī X.', 'I would like to eat X.'], ['X好吃吗？', 'X hǎochī ma?', 'IS X tasty?'], ['这里有X吗？', 'Zhèlǐ yǒu X ma?', 'Do you have X here?']];
  const P_ORDER = [['来一份X。', 'Lái yí fèn X.', 'One order of X, please.'], ['我要X。', 'Wǒ yào X.', 'I will have X.']];
  const P_DRINK = [['我想喝X。', 'Wǒ xiǎng hē X.', 'I would like to drink X.'], ['X好喝吗？', 'X hǎohē ma?', 'DOES X taste good?'], ['这里有X吗？', 'Zhèlǐ yǒu X ma?', 'Do you have X here?']];
  const P_BUY = [['我想买X。', 'Wǒ xiǎng mǎi X.', 'I would like to buy X.'], ['X多少钱？', 'X duōshǎo qián?', 'How much IS X?'], ['这里有X吗？', 'Zhèlǐ yǒu X ma?', 'Do you have X here?']];
  const P_WAY = [['请问，X怎么走？', 'Qǐngwèn, X zěnme zǒu?', 'Excuse me, how do I get to X?'], ['我想去X。', 'Wǒ xiǎng qù X.', 'I would like to go to X.'], ['X离这里远吗？', 'X lí zhèlǐ yuǎn ma?', 'Is X far from here?'], ['X在哪里？', 'X zài nǎlǐ?', 'Where is X?']];
  const P_LETS = ['我们去X吧！', 'Wǒmen qù X ba!', 'Let us go to X!'];
  const P_TAXI = ['师傅，去X。', 'Shīfu, qù X.', 'Driver, to X, please.'];
  const P_ASK = [['我想了解X。', 'Wǒ xiǎng liǎojiě X.', 'I would like to learn about X.'], ['你能给我介绍一下X吗？', 'Nǐ néng gěi wǒ jièshào yíxià X ma?', 'Could you tell me about X?']];
  const P_WHAT = ['X是什么？', 'X shì shénme?', 'What IS X?'];
  const P_WHO = ['X是谁？', 'X shì shéi?', 'Who is X?'];
  const P_KEEN = ['我对X很感兴趣。', 'Wǒ duì X hěn gǎn xìngqù.', 'I am very interested in X.'];
  const P_NEAR = ['这附近有X吗？', 'Zhè fùjìn yǒu X ma?', 'Is there a X near here?'];
  const P_CITY = [['我到X了！', 'Wǒ dào X le!', 'I have arrived in X!'], ['X，我来了！', 'X, wǒ lái le!', 'X, here I come!'], ['这是我第一次来X。', 'Zhè shì wǒ dì yī cì lái X.', 'This is my first time in X.'], ['X有什么好吃的？', 'X yǒu shénme hǎochī de?', 'What is good to eat in X?']];
  const P_AIR = [['请问，去市区怎么走？', 'Qǐngwèn, qù shìqū zěnme zǒu?', 'Excuse me, how do I get into the city?'], ['我的行李在哪里？', 'Wǒ de xíngli zài nǎlǐ?', 'Where is my luggage?'], ['请问，出租车在哪里？', 'Qǐngwèn, chūzūchē zài nǎlǐ?', 'Excuse me, where are the taxis?']];
  const setOf = (str) => { const o = {}; str.split(' ').forEach((w) => { o[w] = 1; }); return o; };
  // dishes that are drunk, not eaten (喝): by ending, plus teas and spirits whose names do not end in 茶 or 酒, minus the ones that only look like drinks
  const DRINK_END = /(茶|酒|咖啡|豆汁|汤|粥|酸奶|牛奶|骆驼奶|矿泉水|糖水|杏仁露)$/;
  const DRINK_ALSO = setOf('黄山毛峰 霍山黄芽 正山小种 都匀毛尖 信阳毛尖 君山银针 洋河大曲 新加坡司令 衡水老白干 甜沫 头脑');
  const DRINK_NOT = setOf('肉骨茶 鸭血粉丝汤 早茶 泰州早茶');
  // things in the dish lists that you buy rather than order: fruit, nuts, grain, seasonings, herbs
  const BUY_END = /(瓜|葡萄|苹果|梨|杏|桃|柚|荔枝|芒果|椰子|脐橙|蜜橘|蜜桔|柑|草莓|蓝莓|脆李|榴莲|释迦|莲雾|枣|菱|花椒|辣椒|盐|醋|橄榄油|豆豉|虾酱|陈皮|蜂蜜|糖|大米|小米|黄米|富硒米|荞麦|药材|黄精|肉苁蓉|虫草|人参|枸杞|山药|生姜|白姜|萝卜|葱|百合|土豆|芋头|藕|笋|笋干|菜干|萝卜干|板栗|花生|松子|榛子|葡萄干|黄牛|火腿|腊肉|紫菜|松茸|海参|海蜇|榨菜|豆腐乳|豆瓣|牛肉干|猪肉脯|肉干)$/;
  const BUY_NOT = setOf('藜蒿炒腊肉 南阳黄牛');
  // in the dish lists but not food at all: crafts, flowers, animals, festivals. They get the "ask a local" patterns.
  const D_THING = setOf('芜湖铁画 酒泉夜光杯 合浦珍珠 惠山泥人 常州梳篦 南通蓝印花布 瓷器 岫岩玉 抚顺煤精雕刻 阜新玛瑙 土族盘绣 平遥推光漆器 湖笔 水仙花 菏泽牡丹 扎龙鹤 驯鹿 玉树赛马节 黄南酥油花 抚州建昌帮 青海湖裸鲤 鱼皮');
  const D_PLACE = { '茶餐厅':'cha chaan teng', '小贩中心':'hawker center' };
  // whole cuisines and meals: you eat them, but you do not order "one portion" of them
  const NO_ORDER = /(菜|小吃|烧烤|海鲜|点心|早茶|烧腊|素斋|水席|豆腐宴|八大碗|火锅|烤肉|烤串|小菜|黄牛)$/;
  // sights that are not a place you can ask the way to
  const A_THING = setOf('珠江夜游 漓江竹筏 四渡赤水 北极光 乌篷船 龙泉青瓷');
  const SOLEMN = /(纪念|烈士|陵|墓|遗址|会址|旧址|屠杀|遇难|殉难)/;
  const TAXI_END = /(街|路|馆|寺|庙|塔|楼|园|宫|广场|公园|夜市|市场|大厦|中心|教堂|码头|巷|坊|院|阁|祠|堂|站|桥|町|博物院|大学|101)$/;
  const C_PERSON = setOf('陶渊明 刘三姐');
  const C_PEOPLE = /(族|人|疍家|晋商)$/;
  const C_PLAIN = setOf('澳门博彩');   // "I am very interested in..." would read oddly here
  function sayKind(s) {
    if (s.k === 'D') { if (D_PLACE[s.zh]) return 'near'; if (D_THING[s.zh]) return 'ask'; if (!DRINK_NOT[s.zh] && (DRINK_END.test(s.zh) || DRINK_ALSO[s.zh])) return 'drink'; if (BUY_END.test(s.zh) && !BUY_NOT[s.zh]) return 'buy'; return 'dish'; }
    if (s.k === 'A') return A_THING[s.zh] ? 'ask' : 'way';
    if (s.k === 'C') return 'ask';
    return s.k === 'T' ? 'city' : 'air';
  }
  const SAY_TAG = { dish:'At the restaurant', drink:'Ordering a drink', buy:'At the market', near:'Asking a local', ask:'Asking a local', way:'Asking the way', city:'Arriving', air:'At the airport' };
  function sayFor(s) {
    const kind = sayKind(s); let pats;
    if (kind === 'dish') pats = NO_ORDER.test(s.zh) ? P_DISH : P_ORDER.concat(P_DISH);
    else if (kind === 'drink') pats = P_DRINK;
    else if (kind === 'buy') pats = P_BUY;
    else if (kind === 'near') pats = [P_NEAR];
    else if (kind === 'way') pats = P_WAY.concat(SOLEMN.test(s.zh) ? [] : [P_LETS]).concat(TAXI_END.test(s.zh) && !SOLEMN.test(s.zh) ? [P_TAXI] : []);
    else if (kind === 'ask') pats = P_ASK.concat(C_PERSON[s.zh] ? [P_WHO] : C_PEOPLE.test(s.zh) ? [] : [P_WHAT]).concat(C_PLAIN[s.zh] || C_PERSON[s.zh] ? [] : [P_KEEN]);
    else if (kind === 'city') pats = P_CITY;
    else pats = P_AIR;
    const p = pats[(hash('say:' + s.id) >>> 7) % pats.length];
    const en = kind === 'near' ? D_PLACE[s.zh] : s.en.replace(/\s*\([A-Z]{3}\)$/, '');
    const fill = (t, x) => t.split('X').join(x);
    // the English follows the name: "Is mapo tofu tasty?" but "Are shrimp dumplings tasty?"
    const many = /[^su'’]s$/i.test(en); const verb = (t) => t.replace('IS', many ? 'Are' : 'Is').replace('DOES', many ? 'Do' : 'Does').replace(/^How much (Is|Are)/, (m, v) => 'How much ' + v.toLowerCase()).replace(/^What (Is|Are)/, (m, v) => 'What ' + v.toLowerCase());
    return { kind, tag:p === P_TAXI ? 'In a taxi' : SAY_TAG[kind], zh:fill(p[0], s.zh), py:fill(p[1], s.py), en:fill(verb(p[2]), en) };
  }

  const api = { hop, kmBetween, dirBetween, cityRoute, regionRoute, cityStamps, mustSeen, sayFor, sayKind, META, SMALL, LADDER, FLAT, costOf, cum, paidFor, build, fresh, ensure, step, meter, regionStats, pinLatLon, project, projectCountry, shuffle, slug, KINDS, seedOf, rngFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ShanluJourney = api;
})(typeof window !== 'undefined' ? window : globalThis);
