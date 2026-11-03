/* Sync: merges the progress of two devices, and talks to a private GitHub gist that holds one copy.
 * The merge is a "join": merging A into B and B into A gives the same result, so devices can sync in any order.
 * Same code runs in the browser and in tools/test-sync.js. Nothing here touches the page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DIMS = ['see', 'hear', 'prod'];
  // progress that is merged between devices; device preferences (theme, voice, hint switches, daily goal, new-word limit) stay local
  const SYNC_KEYS = ['xp', 'dayXp', 'dayMin', 'streak', 'lastActive', 'activity', 'day', 'gres', 'sres', 'clipBest', 'misses', 'testHistory', 'ws',
    'rq', 'rtotal', 'rdone', 'rxp', 'rcomplete', 'rcounts', 'gdone', 'tdone', 'ldone', 'spokeToday', 'webCredited', 'wlearned', 'wrated', 'sdone', 'exams', 'aiDays', 'minLog', 'minDev'];
  const FILE = 'shanlu-progress.json';   // HSK 1 progress (the original file name)
  const fileFor = (level) => (level > 1 ? 'shanlu-progress-hsk' + level + '.json' : FILE);   // each level keeps its own file in the same gist
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
  function mergeWs(a, b) {
    const out = {};
    const keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(k => { keys[k] = true; });
    Object.keys(keys).forEach(z => {
      const x = (a || {})[z] || {}, y = (b || {})[z] || {};
      const w = {};
      DIMS.forEach(d => { w[d] = pickDim(x[d], y[d]); });
      out[z] = w;
    });
    return out;
  }
  function unionObj(a, b) { const o = Object.assign({}, a || {}); Object.keys(b || {}).forEach(k => { if (b[k]) o[k] = b[k]; }); return o; }
  function maxObj(a, b) { const o = Object.assign({}, a || {}); Object.keys(b || {}).forEach(k => { o[k] = Math.max(o[k] || 0, b[k] || 0); }); return o; }

  // merge two progress objects (each holding SYNC_KEYS). Returns a new object.
  function merge(a, b) {
    a = a || {}; b = b || {};
    const out = {};
    out.ws = mergeWs(a.ws, b.ws);
    out.xp = maxNum(a.xp, b.xp);
    out.activity = unionObj(a.activity, b.activity);
    // streak belongs to whichever device was active most recently
    const la = a.lastActive || '', lb = b.lastActive || '';
    out.lastActive = la > lb ? la : lb;
    out.streak = la === lb ? maxNum(a.streak, b.streak) : (la > lb ? a.streak || 0 : b.streak || 0);
    out.gres = maxObj(a.gres, b.gres);
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
  // key order must not matter when deciding whether two progress objects are the same
  const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
  const same = (a, b) => canon(a) === canon(b);

  // ---- GitHub gist transport (fetch is passed in so tests can fake it) ----
  function gistApi(token, fetchFn, file) {
    const NAME = file || FILE;
    const f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(typeof self !== 'undefined' ? self : undefined) : null);
    const headers = () => ({ 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' });
    async function call(method, path, body) {
      let res;
      try { res = await f('https://api.github.com' + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined }); }
      catch (e) { const err = new Error('Could not reach GitHub. Check your connection.'); err.kind = 'network'; throw err; }
      if (res.status === 401) { const err = new Error('GitHub rejected the token. Make a new one and paste it again.'); err.kind = 'auth'; throw err; }
      if (res.status === 403 || res.status === 429) { const err = new Error('GitHub said slow down or the token lacks the gist permission.'); err.kind = 'limit'; throw err; }
      if (res.status === 404) { const err = new Error('Not found'); err.kind = 'missing'; throw err; }
      if (!res.ok) { const err = new Error('GitHub error ' + res.status); err.kind = 'http'; throw err; }
      return res.json();
    }
    return {
      async find() {
        for (let page = 1; page <= 5; page++) {
          const list = await call('GET', '/gists?per_page=100&page=' + page);
          const hit = list.find(g => g.files && Object.keys(g.files).some(n => /^shanlu-progress/.test(n)));   // the same gist holds every level's file
          if (hit) return hit.id;
          if (list.length < 100) break;
        }
        return null;
      },
      async create(payload) {
        const g = await call('POST', '/gists', { description: DESCRIPTION, public: false, files: { [NAME]: { content: JSON.stringify(payload) } } });
        return g.id;
      },
      async read(id) {
        const g = await call('GET', '/gists/' + id);
        const file = g.files && g.files[NAME];
        if (!file) return null;
        if (file.truncated) throw Object.assign(new Error('The saved progress is too large to read.'), { kind: 'http' });
        try { return JSON.parse(file.content); } catch (e) { return null; }
      },
      async write(id, payload) { await call('PATCH', '/gists/' + id, { files: { [NAME]: { content: JSON.stringify(payload) } } }); }
    };
  }

  // One round: find or create the gist, read it, merge, write back if the merge added something. Returns { merged, wrote, gistId }.
  async function round(opts) {
    const api = gistApi(opts.token, opts.fetch, opts.file);
    const local = pick(opts.state);
    let id = opts.gistId || null;
    if (!id) id = await api.find();
    if (!id) {
      id = await api.create({ v: 1, savedAt: Date.now(), state: local });
      return { merged: local, wrote: true, gistId: id, created: true };
    }
    let remote;
    try { remote = await api.read(id); }
    catch (e) { if (e.kind === 'missing') { id = await api.find(); if (!id) { id = await api.create({ v: 1, savedAt: Date.now(), state: local }); return { merged: local, wrote: true, gistId: id, created: true }; } remote = await api.read(id); } else throw e; }
    const remoteState = remote && remote.state ? remote.state : {};
    const merged = merge(local, remoteState);
    const wrote = !same(merged, merge(remoteState, remoteState));
    if (wrote) await api.write(id, { v: 1, savedAt: Date.now(), state: merged });
    return { merged, wrote, gistId: id, created: false };
  }

  return { SYNC_KEYS, FILE, fileFor, DESCRIPTION, merge, pick, round, gistApi, mergeWs, same, dayMinutes };
});
