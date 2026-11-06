/* Sync: merges the progress of two devices, and talks to a private GitHub gist that holds one copy.
 * The merge is a "join": merging A into B and B into A gives the same result, so devices can sync in any order.
 * Same code runs in the browser and in tools/test-sync.js. Nothing here touches the page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DIMS = ['see', 'hear', 'prod'];
  // progress that is merged between devices; device preferences (theme, voice, hint switches, daily goal, new-word limit) stay local
  const SYNC_KEYS = ['xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'gpt', 'sres', 'clipBest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'sdone', 'exams', 'aiDays', 'minLog', 'minDev', 'lrn', 'rlog', 'epoch'];
  const FILE = 'shanlu-progress.json';   // HSK 1 progress (the original file name)
  const fileFor = (level) => (level > 1 ? 'shanlu-progress-hsk' + level + '.json' : FILE);   // each level keeps its own file in the same gist
  const PERSON_FILE = 'shanlu-person.json';   // the person's own settings and notes: one file for the whole gist, whatever the level
  const DESCRIPTION = 'Shanlu study progress (private; do not delete)';

  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const maxNum = (a, b) => Math.max(a || 0, b || 0);

  // the dimension that was reviewed most recently wins; without timestamps, the one with more memory strength wins
  function pickDim(a, b) {
    a = a || { s: 0, l: 0 }; b = b || { s: 0, l: 0 };
    if (a.t && b.t) return a.t >= b.t ? a : b;
    if (a.t && !(b.s > 0)) return a;
    if (b.t && !(a.s > 0)) return b;
    return (a.s || 0) >= (b.s || 0) ? a : b;
  }
  // A word nobody has started carries no information, so it is not stored: only started dimensions are kept, and the always-zero `l` is dropped.
  // (Missing words and dimensions mean "not started" everywhere: merge() and the app both fill them in when they need them.)
  const dimBlank = (d) => !d || (!(d.s > 0) && !d.t);
  function compactDim(d) { if (!d.l) { const o = Object.assign({}, d); delete o.l; return o; } return d; }
  function compactWord(w) {
    const o = {}; let any = false;
    DIMS.forEach(k => { if (w && !dimBlank(w[k])) { o[k] = compactDim(w[k]); any = true; } });
    return any ? o : null;
  }
  function compactWs(ws) {
    const out = {};
    Object.keys(ws || {}).forEach(z => { const w = compactWord(ws[z]); if (w) out[z] = w; });
    return out;
  }
  function mergeWs(a, b) {
    const out = {};
    const keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(k => { keys[k] = true; });
    Object.keys(keys).forEach(z => {
      const x = (a || {})[z] || {}, y = (b || {})[z] || {};
      const w = {};
      DIMS.forEach(d => { w[d] = pickDim(x[d], y[d]); });
      const c = compactWord(w);
      if (c) out[z] = c;
    });
    return out;
  }
  function unionObj(a, b) { const o = Object.assign({}, a || {}); Object.keys(b || {}).forEach(k => { if (b[k]) o[k] = b[k]; }); return o; }
  function maxObj(a, b) { const o = Object.assign({}, a || {}); Object.keys(b || {}).forEach(k => { o[k] = Math.max(o[k] || 0, b[k] || 0); }); return o; }

  // merge two progress objects (each holding SYNC_KEYS). Returns a new object.
  // A reset starts a new "epoch" (a timestamp stored with the progress). The side with the newer epoch wins outright, so a reset reaches
  // every device instead of being undone by a device that still holds the old progress. Equal epochs merge as usual.
  function merge(a, b) {
    a = a || {}; b = b || {};
    const ea = a.epoch || 0, eb = b.epoch || 0;
    if (ea !== eb) { const w = ea > eb ? a : b; return merge(w, w); }
    const out = {};
    out.epoch = ea;
    out.ws = mergeWs(a.ws, b.ws);
    out.xp = maxNum(a.xp, b.xp);
    out.activity = unionObj(a.activity, b.activity);
    // streak belongs to whichever device was active most recently
    const la = a.lastActive || '', lb = b.lastActive || '';
    out.lastActive = la > lb ? la : lb;
    out.streak = la === lb ? maxNum(a.streak, b.streak) : (la > lb ? a.streak || 0 : b.streak || 0);
    out.gres = maxObj(a.gres, b.gres);
    // grammar points: each point's own record; the one answered most recently wins (ties settle the same way on every device)
    out.gpt = {};
    Object.keys(Object.assign({}, a.gpt || {}, b.gpt || {})).forEach(id => { const x = (a.gpt || {})[id], y = (b.gpt || {})[id]; out.gpt[id] = !x ? y : !y ? x : ((x.at || 0) !== (y.at || 0) ? ((x.at || 0) > (y.at || 0) ? x : y) : (JSON.stringify(x) >= JSON.stringify(y) ? x : y)); });
    out.sres = unionObj(a.sres, b.sres);
    out.misses = maxObj(a.misses, b.misses);
    const n = Math.max((a.clipBest || []).length, (b.clipBest || []).length);
    out.clipBest = []; for (let i = 0; i < n; i++) out.clipBest.push(maxNum((a.clipBest || [])[i], (b.clipBest || [])[i]));
    // tests and exams: keep every attempt once, newest last
    const seen = {};
    out.testHistory = (a.testHistory || []).concat(b.testHistory || []).filter(h => { const id = JSON.stringify(h); if (seen[id]) return false; seen[id] = true; return true; })
      .sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-5);
    const seenE = {};
    out.exams = (a.exams || []).concat(b.exams || []).filter(h => { const id = JSON.stringify(h); if (seenE[id]) return false; seenE[id] = true; return true; })
      .sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-20);
    out.aiDays = maxObj(a.aiDays, b.aiDays);
    // new words in their learning phase: the further along entry wins; a word that is now started (recalled and graduated on any device) is no longer in it
    out.lrn = {};
    Object.keys(Object.assign({}, a.lrn || {}, b.lrn || {})).forEach(z => {
      const x = (a.lrn || {})[z], y = (b.lrn || {})[z];
      const pick = !x ? y : !y ? x : ((x.st || 0) !== (y.st || 0) ? ((x.st || 0) > (y.st || 0) ? x : y) : ((x.at || 0) >= (y.at || 0) ? x : y));
      const w = out.ws[z];
      if (pick && !(w && w.see && w.see.s > 0)) out.lrn[z] = pick;
    });
    // every answer ever given (compact tuples [time, word, skill, grade, kind]): the union, newest 800 kept
    const seenR = {};
    out.rlog = (a.rlog || []).concat(b.rlog || []).filter(e => { if (!Array.isArray(e)) return false; const id = e[0] + '|' + e[1] + '|' + e[2]; if (seenR[id]) return false; seenR[id] = true; return true; })
      .sort((x, y) => (x[0] - y[0]) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)).slice(-800);
    // minutes studied each day: the larger number of the two devices wins (the same minutes are never counted twice); only the last 60 days are kept
    out.minLog = maxObj(a.minLog, b.minLog);
    Object.keys(out.minLog).sort().slice(0, -60).forEach(k => { delete out.minLog[k]; });
    // minutes per day per device: each device's own number only grows, so the larger one is right; the day's total adds the devices up (dayMinutes)
    out.minDev = {};
    Object.keys(Object.assign({}, a.minDev || {}, b.minDev || {})).sort().slice(-60).forEach(d => { out.minDev[d] = maxObj((a.minDev || {})[d], (b.minDev || {})[d]); });
    // today's progress: same day merges, a newer day replaces an older one
    const da = a.day || '', db = b.day || '';
    out.day = da > db ? da : db;
    const newer = da > db ? a : (db > da ? b : null);
    if (newer) {
      ['dayXp', 'dayMin', 'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'sdone'].forEach(k => { if (newer[k] !== undefined) out[k] = newer[k]; });
    } else {
      out.dayXp = maxNum(a.dayXp, b.dayXp); out.dayMin = maxNum(a.dayMin, b.dayMin);
      out.wlearned = unionObj(a.wlearned, b.wlearned); out.wrated = unionObj(a.wrated, b.wrated);
      ['gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'sdone'].forEach(k => { out[k] = !!(a[k] || b[k]); });
      // words still waiting in today's review on BOTH devices (a word reviewed on either one is done)
      const qa = a.rq || [], qb = b.rq || [];
      out.rq = (a.rq && b.rq) ? qa.filter(z => qb.indexOf(z) >= 0) : (qa.length ? qa : qb);
      out.rcomplete = !!(a.rcomplete || b.rcomplete) || (out.rq.length === 0 && ((a.rtotal || 0) > 0 || (b.rtotal || 0) > 0));
      out.rtotal = Math.max(a.rtotal || 0, b.rtotal || 0); out.rdone = Math.max(a.rdone || 0, b.rdone || 0); out.rxp = Math.max(a.rxp || 0, b.rxp || 0);
      out.rcounts = isObj(a.rcounts) && isObj(b.rcounts) ? maxObj(a.rcounts, b.rcounts) : (a.rcounts || b.rcounts || { again: 0, hard: 0, good: 0, easy: 0 });
    }
    return out;
  }

  // minutes studied on one day, all devices together (older saves without the per-device numbers fall back to minLog)
  const dayMinutes = (st, day) => {
    const per = st && st.minDev && st.minDev[day];
    if (per && typeof per === 'object') return Object.keys(per).reduce((n, k) => n + (per[k] || 0), 0);
    return (st && st.minLog && st.minLog[day]) || 0;
  };

  const pick = (state) => { const o = {}; SYNC_KEYS.forEach(k => { if (state[k] !== undefined) o[k] = state[k]; }); return o; };
  // a saved store with the merged progress applied: every synced key is replaced (a key the merge left out is gone, which a reset needs);
  // keys that stay on the device (theme, voice, hints) are kept
  const applyMerged = (store, merged) => { const o = {}; Object.keys(store || {}).forEach(k => { if (SYNC_KEYS.indexOf(k) < 0) o[k] = store[k]; }); return Object.assign(o, pick(merged)); };
  // the start of a new epoch: later than every epoch this device has seen, and later than now
  const nextEpoch = (seen) => Math.max(Date.now(), (seen || 0) + 1);
  // key order must not matter when deciding whether two progress objects are the same
  const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
  const same = (a, b) => canon(a) === canon(b);

  // ---- GitHub gist transport (fetch is passed in so tests can fake it) ----
  function gistApi(token, fetchFn, file) {
    const NAME = file || FILE;
    const f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(typeof self !== 'undefined' ? self : undefined) : null);
    const headers = () => ({ 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' });
    async function call(method, path, body, wantRes) {
      let res;
      try { res = await f('https://api.github.com' + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined }); }
      catch (e) { const err = new Error('Could not reach GitHub. Check your connection.'); err.kind = 'network'; throw err; }
      if (res.status === 401) { const err = new Error('GitHub rejected the token. Make a new one and paste it again.'); err.kind = 'auth'; throw err; }
      if (res.status === 403 || res.status === 429) { const err = new Error('GitHub said slow down or the token lacks the gist permission.'); err.kind = 'limit'; throw err; }
      if (res.status === 404) { const err = new Error('Not found'); err.kind = 'missing'; throw err; }
      if (!res.ok) { const err = new Error('GitHub error ' + res.status); err.kind = 'http'; throw err; }
      return wantRes ? res : res.json();
    }
    return {
      // A small read-only request for the Settings "Test connection" button: is the token accepted, what may it do, and when does it expire?
      // (scopes and expires are null when the browser is not allowed to read those headers)
      async check() {
        const res = await call('GET', '/gists?per_page=1', undefined, true);
        const get = (n) => { try { return res.headers && res.headers.get ? res.headers.get(n) : null; } catch (e) { return null; } };
        return { scopes: get('x-oauth-scopes'), expires: get('github-authentication-token-expiration') };
      },
      async find() {
        for (let page = 1; page <= 5; page++) {
          const list = await call('GET', '/gists?per_page=100&page=' + page);
          const hit = list.find(g => g.files && Object.keys(g.files).some(n => /^shanlu-progress/.test(n)));   // the same gist holds every level's file
          if (hit) return hit.id;
          if (list.length < 100) break;
        }
        return null;
      },
      async create(payload, person) {
        const files = { [NAME]: { content: JSON.stringify(payload) } };
        if (person) files[PERSON_FILE] = { content: JSON.stringify(person) };
        const g = await call('POST', '/gists', { description: DESCRIPTION, public: false, files });
        return g.id;
      },
      async read(id) { return (await this.readAll(id)).state; },
      // one request returns both files: the level's progress and the person's settings
      async readAll(id) {
        const g = await call('GET', '/gists/' + id);
        const parse = (name) => {
          const file = g.files && g.files[name];
          if (!file) return null;
          if (file.truncated) throw Object.assign(new Error('The saved progress is too large to read.'), { kind: 'http' });
          try { return JSON.parse(file.content); } catch (e) { return null; }
        };
        return { state: parse(NAME), person: parse(PERSON_FILE) };
      },
      async write(id, payload, person) {
        const files = { [NAME]: { content: JSON.stringify(payload) } };
        if (person) files[PERSON_FILE] = { content: JSON.stringify(person) };
        await call('PATCH', '/gists/' + id, { files });
      }
    };
  }

  // One round: find or create the gist, read it, merge, write back if the merge added something. Returns { merged, person, wrote, gistId }.
  // opts.person (optional): the person's settings and notes, merged and saved in their own file in the same gist.
  async function round(opts) {
    const api = gistApi(opts.token, opts.fetch, opts.file);
    const local = pick(opts.state);
    const mine = opts.person || null;
    const fresh = () => ({ v: 1, savedAt: Date.now(), state: local });
    const freshPerson = () => (mine ? { v: 1, savedAt: Date.now(), person: mergePerson(mine, mine) } : null);
    let id = opts.gistId || null;
    if (!id) id = await api.find();
    if (!id) {
      id = await api.create(fresh(), freshPerson());
      return { merged: local, person: mine ? mergePerson(mine, mine) : null, wrote: true, gistId: id, created: true };
    }
    let remote;
    try { remote = await api.readAll(id); }
    catch (e) {
      if (e.kind === 'missing') {
        id = await api.find();
        if (!id) { id = await api.create(fresh(), freshPerson()); return { merged: local, person: mine ? mergePerson(mine, mine) : null, wrote: true, gistId: id, created: true }; }
        remote = await api.readAll(id);
      } else throw e;
    }
    const remoteState = remote.state && remote.state.state ? remote.state.state : {};
    const merged = merge(local, remoteState);
    let wrote = !same(merged, merge(remoteState, remoteState));
    let mergedPerson = null, personFile = null;
    if (mine) {
      const remotePerson = remote.person && remote.person.person ? remote.person.person : {};
      mergedPerson = mergePerson(mine, remotePerson);
      if (!samePerson(mergedPerson, remotePerson)) { wrote = true; personFile = { v: 1, savedAt: Date.now(), person: mergedPerson }; }
    }
    if (wrote) await api.write(id, { v: 1, savedAt: Date.now(), state: merged }, personFile);
    return { merged, person: mergedPerson, wrote, gistId: id, created: false };
  }

  // ---- the person's own settings and notes, which follow them to every device (not study progress, which merge() handles) ----
  // person = { prefs: { name: {v, at} }, lsn: {v, at}, secrets: {v, at}, mem: { facts: [{t, d, at}], del: { text: at }, cleared: at } }
  // Every value is stamped with the time it was set; the newer stamp wins. Deleted notes leave a stamped tombstone so they stay deleted.
  const MEM_MAX = 30, TOMB_DAYS = 90;
  function lww(a, b) {
    if (!isObj(a)) return isObj(b) ? b : undefined;
    if (!isObj(b)) return a;
    if ((a.at || 0) !== (b.at || 0)) return (a.at || 0) > (b.at || 0) ? a : b;
    return JSON.stringify(a.v) >= JSON.stringify(b.v) ? a : b;
  }
  const factKey = (t) => String(t || '').trim().toLowerCase();
  function mergePerson(a, b) {
    a = isObj(a) ? a : {}; b = isObj(b) ? b : {};
    const out = { prefs: {} };
    const names = {};
    Object.keys(a.prefs || {}).concat(Object.keys(b.prefs || {})).forEach(k => { names[k] = true; });
    Object.keys(names).sort().forEach(k => { const r = lww((a.prefs || {})[k], (b.prefs || {})[k]); if (r) out.prefs[k] = r; });
    const lsn = lww(a.lsn, b.lsn); if (lsn) out.lsn = lsn;
    const sec = lww(a.secrets, b.secrets); if (sec) out.secrets = sec;
    const ma = isObj(a.mem) ? a.mem : {}, mb = isObj(b.mem) ? b.mem : {};
    const cleared = maxNum(ma.cleared, mb.cleared);
    const del = maxObj(ma.del, mb.del);
    const byKey = {};
    (ma.facts || []).concat(mb.facts || []).forEach(f => {
      if (!f || typeof f.t !== 'string') return;
      const k = factKey(f.t), cur = byKey[k];
      if (!cur || (f.at || 0) > (cur.at || 0) || ((f.at || 0) === (cur.at || 0) && f.t > cur.t)) byKey[k] = { t: f.t, d: f.d || '', at: f.at || 0 };
    });
    const alive = Object.keys(byKey).map(k => byKey[k]).filter(f => f.at > Math.max(cleared, del[factKey(f.t)] || 0));
    alive.sort((x, y) => (x.at - y.at) || (x.t < y.t ? -1 : x.t > y.t ? 1 : 0));
    const cutoff = Date.now() - TOMB_DAYS * 86400000;
    const keepDel = {}; Object.keys(del).forEach(k => { if (del[k] > cutoff) keepDel[k] = del[k]; });
    out.mem = { facts: alive.slice(-MEM_MAX), del: keepDel, cleared };
    return out;
  }
  function samePerson(a, b) { return JSON.stringify(mergePerson(a, a)) === JSON.stringify(mergePerson(b, b)); }

  return { SYNC_KEYS, FILE, PERSON_FILE, fileFor, DESCRIPTION, merge, pick, round, gistApi, mergeWs, same, dayMinutes, mergePerson, samePerson, compactWs, compactWord, applyMerged, nextEpoch };
});
