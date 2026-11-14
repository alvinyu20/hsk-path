/* Friends board: the browser side of worker/worker.js. No page code in here, so tools/test-friends.js can run it too.
 * Identity: there is no sign-in. Joining (just a first name) gives a secret key that is kept on this device (localStorage) and can be carried to
 * another device as a link (#me=id.key). The key sits in the part of the address after "#", which browsers never send to the website host.
 * Only study totals are ever sent (see statsFor in app.js); the server also throws away everything else. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluFriends = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STORE = 'shanlu-friends';          // { id, key, name, group }  lives only on this device
  const DAY_MS = 864e5;

  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parseDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  const daysBetween = (a, b) => { const x = parseDay(a), y = parseDay(b); return x && y ? Math.round((y - x) / DAY_MS) : 0; };

  // A friend's week of minutes (oldest first, ending on THEIR last sync day) lined up with today: older days drop off the left.
  function shiftWeek(last7, asOf, today) {
    const diff = Math.max(0, Math.min(7, daysBetween(asOf, today)));
    const week = (last7 || []).slice(0, 7);
    while (week.length < 7) week.unshift(0);
    return week.slice(diff).concat(new Array(diff).fill(0));
  }
  // A streak only counts if the person studied today or yesterday.
  function effectiveStreak(stats, today) {
    if (!stats || !stats.lastActive) return 0;
    return daysBetween(stats.lastActive, today) <= 1 ? stats.streak : 0;
  }
  const weekTotal = (week) => week.reduce((a, b) => a + b, 0);
  const initial = (name) => (Array.from(String(name || '?').trim())[0] || '?').toUpperCase();

  // One row of the board, ready to show. `today` is this device's local date.
  function boardRow(m, today, meId) {
    const st = m.stats || null;
    const week = st ? shiftWeek(st.last7, st.asOf, today) : [0, 0, 0, 0, 0, 0, 0];
    return {
      id: m.id, name: m.name, initial: initial(m.name), isMe: m.id === meId, hasStats: !!st,
      week, minutes: weekTotal(week), studiedToday: week[6] > 0, streak: st ? effectiveStreak(st, today) : 0, mem: st ? st.mem : 0,
      level: st && st.levels && st.levels.length ? st.levels[st.levels.length - 1] : 0, passed: st && st.passed ? st.passed : [],
      cheers: m.cheers || 0, cheered: !!m.cheered, updated: m.updated || 0, jy: st && st.jy && st.jy.n > 0 ? st.jy : null,
    };
  }
  function sortRows(rows, by) {
    const key = { week: 'minutes', streak: 'streak', mem: 'mem' }[by] || 'minutes';
    return rows.slice().sort((a, b) => (b[key] - a[key]) || (b.minutes - a.minutes) || a.name.localeCompare(b.name));
  }

  // "#me=id.key" (come back on another device) in the address. (Invite links, #join=CODE, are gone: joining is open.)
  function parseHash(hash) {
    const h = String(hash || '').replace(/^#/, '');
    const m = /(?:^|&)me=([0-9a-f]{16})\.([0-9a-f]{48})(?:&|$)/.exec(h);
    if (m) return { me: { id: m[1], key: m[2] } };
    return {};
  }
  const makeLink = (base, who) => String(base).replace(/#.*$/, '') + '#me=' + who.id + '.' + who.key;

  // ---- saving the progress bundle on the server ----
  // Small bundles are sent as plain JSON ({"v":1,"levels":...}). A big one (many levels) is gzipped and sent as {"v":2,"gz":"<base64>"} so it
  // stays far below the server's size cap; both forms are read back. Gzip needs CompressionStream (all current browsers, Node 18+).
  const GZ_FROM = 150000;   // characters of JSON from which it is worth compressing
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
  const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined';
  async function pipeThrough(u8, stream) {
    const w = stream.writable.getWriter(); w.write(u8); w.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  }
  async function encodeProgress(bundle, opts) {
    const text = JSON.stringify(bundle);
    if (!(opts && opts.noGzip) && text.length >= GZ_FROM && canGzip()) {
      const gz = await pipeThrough(new TextEncoder().encode(text), new CompressionStream('gzip'));
      return JSON.stringify({ v: 2, gz: b64(gz) });
    }
    return text;
  }
  async function decodeProgress(p) {
    if (p && p.v === 2 && typeof p.gz === 'string') {
      if (!canGzip()) throw Object.assign(new Error('This browser cannot unpack your saved progress.'), { code: 'no_gzip' });
      return JSON.parse(new TextDecoder().decode(await pipeThrough(unb64(p.gz), new DecompressionStream('gzip'))));
    }
    return p;
  }

  function make(opts) {
    const o = opts || {};
    const storage = o.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const doFetch = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof self !== 'undefined' ? self : undefined) : null);
    const baseUrl = () => String((o.url ? o.url() : (typeof window !== 'undefined' && window.SHANLU_FRIENDS_URL) || '') || '').replace(/\/+$/, '');
    const enabled = () => !!baseUrl();
    const identity = () => { try { const v = JSON.parse(storage.getItem(STORE)); return v && v.id && v.key ? v : null; } catch (e) { return null; } };
    const save = (v) => { try { storage.setItem(STORE, JSON.stringify(v)); } catch (e) {} };
    const forget = () => { try { storage.removeItem(STORE); } catch (e) {} };
    let gzRefused = false;

    async function call(method, path, body, auth, extra, raw) {
      if (!enabled()) throw Object.assign(new Error('The friends board is not set up.'), { code: 'off' });
      const headers = { 'Content-Type': 'application/json' };
      if (auth) headers.Authorization = 'Bearer ' + auth.id + '.' + auth.key;
      let res;
      try { res = await doFetch(baseUrl() + path, Object.assign({ method, headers, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) }, extra || {})); }
      catch (e) { throw Object.assign(new Error('Could not reach the friends board. Check your connection. If it is fine, the server may not allow this site: its ALLOWED_ORIGINS setting must be exactly ' + (typeof location !== 'undefined' ? location.origin : 'the site address') + '.'), { code: 'network' }); }
      let json = null; try { json = await res.json(); } catch (e) {}
      if (!res.ok) throw Object.assign(new Error(messageFor(json && json.error, res.status)), { code: (json && json.error) || ('http_' + res.status), status: res.status, json });
      return json;
    }
    const messageFor = (code, status) => ({
      ai_limit: 'You have used all of today\'s AI allowance.', ai_busy: 'The group has used up the shared AI for today.', ai_off: 'The shared AI is switched off for you.', ai_not_set_up: 'The shared AI is not switched on yet.', upstream: 'The AI service had a problem.',
      bad_invite: 'The friends server is closed to new people right now (it has an INVITE_CODE set). Ask Alvin to remove it.', name_needed: 'Type your first name.', group_full: 'This group is full.',
      joining_is_off: 'Joining is switched off for now.', slow_down: 'Too many wrong codes from this network. Try again in an hour.', conflict: 'Your progress changed on another device while saving.', bad_progress: 'The server did not accept the saved progress format.', unauthorized: 'This device is not signed in to the group any more.', too_big: 'That was too big to send.',
    }[code] || (status === 429 ? 'The friends board is busy. Try again later.' : 'The friends board had a problem. Try again later.'));

    return {
      enabled, identity, forget, baseUrl,
      async join(name) { const r = await call('POST', '/api/join', { name }); save({ id: r.id, key: r.key, name: r.name, group: r.group }); return r; },
      // coming back on another device with a #me link: check the key really works before keeping it
      async restore(who) { const g = await call('GET', '/api/group', undefined, who); const me = g.members.find((m) => m.id === who.id); save({ id: who.id, key: who.key, name: me ? me.name : '', group: g.group.name }); return g; },
      async group() { const id = identity(); if (!id) throw Object.assign(new Error('Not joined.'), { code: 'not_joined' }); const g = await call('GET', '/api/group', undefined, id); save(Object.assign({}, id, { group: g.group.name })); return g; },
      async push(stats, extra) { const id = identity(); if (!id) return null; return call('PUT', '/api/me', { stats }, id, extra); },
      // your own saved progress, kept on the server so every device of yours ends up the same
      // `updated` is the server's version number of the saved copy; hand it back as `base` when saving and the server refuses (412, code 'conflict')
      // if another device saved in between, so the caller can merge again instead of overwriting.
      async getProgress() {
        const id = identity(); const r = await call('GET', '/api/me/progress', undefined, id);
        if (r && r.progress) r.progress = await decodeProgress(r.progress);
        return r;
      },
      async putProgress(bundle, o) {
        const id = identity(); const opt = o || {};
        const q = opt.base !== undefined && opt.base !== null ? '?base=' + Math.max(0, Math.floor(Number(opt.base) || 0)) : '';
        let body = await encodeProgress(bundle, { noGzip: gzRefused });
        try { return await call('PUT', '/api/me/progress' + q, body, id, opt.extra, true); }
        catch (e) {
          // a server that was set up before the compressed format existed answers 400: send the plain form instead (and remember it for this session)
          if (e.status === 400 && body.indexOf('{"v":2,') === 0) { gzRefused = true; return call('PUT', '/api/me/progress' + q, JSON.stringify(bundle), id, opt.extra, true); }
          throw e;
        }
      },
      // for the "Test connection" button: can this browser reach the server, and (if joined) does the server still accept this device's key?
      async ping() {
        const t0 = Date.now();
        await call('GET', '/api/health');
        const ms = Date.now() - t0, id = identity();
        if (!id) return { reachable: true, signedIn: null, ms };
        try { const g = await call('GET', '/api/group', undefined, id); return { reachable: true, signedIn: true, group: g.group && g.group.name, ms }; }
        catch (e) { if (e.status === 401) return { reachable: true, signedIn: false, ms }; throw e; }
      },
      async rename(name) { const id = identity(); const r = await call('PUT', '/api/me', { name }, id); save(Object.assign({}, id, { name: r.name })); return r; },
      // the shared AI: the Worker holds the Alibaba key, counts each call against the person's daily allowance and passes the answer back
      async aiStatus() { return call('GET', '/api/ai/status', undefined, identity()); },
      async aiChat(feature, body) { return call('POST', '/api/ai/chat', { feature, body }, identity()); },
      async aiTts(text, voice) { return call('POST', '/api/ai/tts', { text, voice }, identity()); },
      async cheer(to) { return call('POST', '/api/cheer', { to }, identity()); },
      async leave() { const id = identity(); if (id) { try { await call('DELETE', '/api/me', undefined, id); } catch (e) { if (e.status !== 401) throw e; } } forget(); },
    };
  }

  return { make, encodeProgress, decodeProgress, GZ_FROM, shiftWeek, effectiveStreak, weekTotal, boardRow, sortRows, parseHash, makeLink, initial, ymd, daysBetween, STORE };
});
