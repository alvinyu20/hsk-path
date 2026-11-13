// Unit tests for friends.js (the browser side of the friends board) with a fake server and fake storage. Run: node tools/test-friends.js
const F = require('../friends.js');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check(eq(F.shiftWeek([1, 2, 3, 4, 5, 6, 7], '2026-11-03', '2026-11-03'), [1, 2, 3, 4, 5, 6, 7]), 'a week synced today stays as it is');
check(eq(F.shiftWeek([1, 2, 3, 4, 5, 6, 7], '2026-11-01', '2026-11-03'), [3, 4, 5, 6, 7, 0, 0]), 'a week synced 2 days ago slides left and the new days count as 0');
check(eq(F.shiftWeek([1, 2, 3, 4, 5, 6, 7], '2026-10-01', '2026-11-03'), [0, 0, 0, 0, 0, 0, 0]), 'a week synced long ago is empty');
check(eq(F.shiftWeek([5], '2026-11-03', '2026-11-03'), [0, 0, 0, 0, 0, 0, 5]), 'a short week is padded');
check(F.daysBetween('2026-02-28', '2026-03-01') === 1 && F.daysBetween('2026-10-31', '2026-11-02') === 2, 'dates are compared in whole days, across month ends');
check(F.effectiveStreak({ lastActive: '2026-11-03', streak: 5 }, '2026-11-03') === 5 && F.effectiveStreak({ lastActive: '2026-11-02', streak: 5 }, '2026-11-03') === 5, 'a streak counts if you studied today or yesterday');
check(F.effectiveStreak({ lastActive: '2026-11-01', streak: 5 }, '2026-11-03') === 0 && F.effectiveStreak({ lastActive: '', streak: 5 }, '2026-11-03') === 0 && F.effectiveStreak(null, '2026-11-03') === 0, 'an older or missing streak shows as 0');

const member = (id, name, last7, extra) => ({ id, name, joined: 1, updated: 2, stats: { v: 1, asOf: '2026-11-03', last7, streak: 3, lastActive: '2026-11-03', mem: 50, levels: [1, 2], passed: [1] }, cheers: 0, cheered: false, ...(extra || {}) });
const rows = [member('a', 'Ana', [0, 0, 0, 0, 0, 0, 10]), member('b', 'Bo', [10, 10, 10, 10, 10, 10, 10]), { id: 'c', name: 'Cy', stats: null }].map((m) => F.boardRow(m, '2026-11-03', 'a'));
check(rows[0].isMe && rows[0].minutes === 10 && rows[1].minutes === 70 && rows[1].level === 2 && rows[0].studiedToday, 'a board row has the week total, level and "studied today"');
check(rows[2].hasStats === false && rows[2].minutes === 0 && rows[2].streak === 0, 'someone who has not shared yet shows as empty');
check(F.sortRows(rows, 'week').map((r) => r.name).join() === 'Bo,Ana,Cy', 'rows are ordered by minutes this week');
check(F.sortRows([{ name: 'x', minutes: 5, streak: 9, mem: 1 }, { name: 'y', minutes: 50, streak: 1, mem: 99 }], 'streak')[0].name === 'x' && F.sortRows([{ name: 'x', minutes: 5, streak: 9, mem: 1 }, { name: 'y', minutes: 50, streak: 1, mem: 99 }], 'mem')[0].name === 'y', 'rows can be ordered by streak or words in memory');
check(F.initial('  mei') === 'M' && F.initial('') === '?' && F.initial('小明') === '小', 'the avatar letter is the first character');

const KEY = '0123456789abcdef', SECRET = 'f'.repeat(48);
check(eq(F.parseHash('#me=' + KEY + '.' + SECRET), { me: { id: KEY, key: SECRET } }) && eq(F.parseHash('#join=ABCD-EFGH-JKLM'), {}), 'personal links are read from the address, and old invite links are ignored');
check(eq(F.parseHash('#join=<script>'), {}) && eq(F.parseHash('#me=zz.zz'), {}) && eq(F.parseHash(''), {}) && eq(F.parseHash('#something'), {}), 'anything else in the address is ignored');
check(F.makeLink('https://x.example/app/?a=1#old', { id: KEY, key: SECRET }) === 'https://x.example/app/?a=1#me=' + KEY + '.' + SECRET, 'links are built on the site address without the old # part');

// the client with a fake server
const store = {}; const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const log = []; let nextStatus = 200, nextJson = {};
const fakeFetch = async (url, o) => { log.push({ url, method: o.method, auth: o.headers.Authorization, body: o.body }); if (nextStatus === 0) throw new Error('offline'); return { ok: nextStatus < 400, status: nextStatus, json: async () => nextJson }; };
(async () => {
  const off = F.make({ storage, fetch: fakeFetch, url: () => '' });
  check(off.enabled() === false && (await off.join('y').catch((e) => e.code)) === 'off', 'without a server address nothing is sent');
  const c = F.make({ storage, fetch: fakeFetch, url: () => 'https://w.example/' });
  check(c.enabled() && c.identity() === null && (await c.push({}) === null), 'before joining there is no identity and nothing is pushed');
  nextJson = { id: KEY, key: SECRET, name: 'Mei', group: 'Crew' }; nextStatus = 201;
  await c.join('Mei');
  check(log[0].url === 'https://w.example/api/join' && log[0].method === 'POST' && !log[0].auth && c.identity().name === 'Mei' && c.identity().key === SECRET, 'joining posts to the server (no double slash) and keeps the key');
  nextStatus = 200; nextJson = { ok: true };
  await c.push({ a: 1 }, { keepalive: true });
  check(log[1].auth === 'Bearer ' + KEY + '.' + SECRET && log[1].method === 'PUT' && JSON.parse(log[1].body).stats.a === 1, 'later requests carry the key as a bearer header');
  nextStatus = 403; nextJson = { error: 'bad_invite' };
  check((await c.join('y').catch((e) => e)).message.includes('closed to new people'), 'a server closed with INVITE_CODE gives a clear message');
  nextStatus = 0;
  check((await c.group().catch((e) => e.code)) === 'network', 'no connection is reported as a network problem');
  nextStatus = 401; nextJson = { error: 'unauthorized' };
  check((await c.group().catch((e) => e.status)) === 401, 'a refused key is reported with its status so the app can sign out');
  await c.leave();
  check(c.identity() === null, 'leaving forgets the key even if the server no longer knows it');
  nextStatus = 200; nextJson = { group: { name: 'Crew' }, me: KEY, now: 1, members: [{ id: KEY, name: 'Mei' }] };
  await c.restore({ id: KEY, key: SECRET });
  check(c.identity().name === 'Mei' && c.identity().group === 'Crew', 'a personal link is checked with the server before it is kept');
  // saving the progress bundle: small ones as plain JSON, big ones gzipped, a base version for the compare-and-swap, and a fallback for an older server
  const small = { v: 1, levels: { 1: { ws: { 你好: { see: { s: 2, t: 5 } } } } }, person: {} };
  check(await F.encodeProgress(small) === JSON.stringify(small), 'a small bundle is sent as plain JSON');
  const ws = {}; for (let i = 0; i < 4000; i++) ws['词' + i] = { see: { s: 1.5, t: 1730000000000 + i, d: 5 }, hear: { s: 1, t: 1730000000000 + i, d: 5 } };
  const big = { v: 1, levels: { 1: { ws, rlog: [] } }, person: {} };
  const bigText = JSON.stringify(big);
  const packed = await F.encodeProgress(big);
  const packedDoc = JSON.parse(packed);
  check(bigText.length > F.GZ_FROM && packedDoc.v === 2 && typeof packedDoc.gz === 'string' && packed.length < bigText.length / 3, 'a big bundle is gzipped (' + bigText.length + ' characters become ' + packed.length + ')');
  check(JSON.stringify(await F.decodeProgress(packedDoc)) === bigText && JSON.stringify(await F.decodeProgress(small)) === JSON.stringify(small), 'both forms read back exactly');
  nextStatus = 200; nextJson = { progress: packedDoc, updated: 42 };
  const got = await c2().getProgress();
  check(JSON.stringify(got.progress) === bigText && got.updated === 42, 'a download of the compressed form is unpacked for the app');
  function c2() { const x = F.make({ storage, fetch: fakeFetch, url: () => 'https://w.example' }); storage.setItem(F.STORE, JSON.stringify({ id: KEY, key: SECRET, name: 'Mei', group: 'Crew' })); return x; }
  log.length = 0; nextJson = { ok: true, updated: 43 };
  await c2().putProgress(small, { base: 42 });
  check(log[0].method === 'PUT' && log[0].url === 'https://w.example/api/me/progress?base=42' && log[0].body === JSON.stringify(small), 'saving sends the version it started from and the bundle as plain text');
  log.length = 0; await c2().putProgress(small);
  check(log[0].url === 'https://w.example/api/me/progress', 'saving without a version number sends none');
  nextStatus = 412; nextJson = { error: 'conflict' };
  const refused = await c2().putProgress(small, { base: 1 }).catch((e) => e);
  check(refused.status === 412 && refused.code === 'conflict', 'a refused save (another device saved first) is reported as a conflict');
  // an older server answers 400 to the compressed form: the same bundle goes out plain, and the client remembers
  const seen = []; let accept = false;
  const oldServer = async (url, o) => { seen.push(o.body.slice(0, 8)); const ok = o.body.indexOf('{"v":2,') !== 0; return { ok, status: ok ? 200 : 400, json: async () => (ok ? { ok: true } : { error: 'bad_progress' }) }; };
  const cx = F.make({ storage, fetch: oldServer, url: () => 'https://w.example' });
  await cx.putProgress(big, { base: 0 }); await cx.putProgress(big, { base: 0 });
  check(seen.length === 3 && seen[0] === '{"v":2,"' && seen[1] === '{"v":1,"' && seen[2] === '{"v":1,"', 'an older server that refuses the compressed form gets the plain one, and later saves go straight to plain');
  // the "Test connection" check
  const routes = { health: 200, group: 200 };
  const pingFetch = async (url, o) => { const k = /health/.test(url) ? 'health' : 'group'; const st = routes[k]; if (st === 0) throw new Error('offline'); return { ok: st < 400, status: st, json: async () => (st < 400 ? (k === 'group' ? { group: { name: 'Crew' }, members: [{ id: KEY, name: 'Mei' }] } : { ok: true }) : { error: 'unauthorized' }) }; };
  const pingNew = F.make({ storage: { getItem: () => null, setItem() {}, removeItem() {} }, fetch: pingFetch, url: () => 'https://w.example' });
  const p0 = await pingNew.ping();
  check(p0.reachable && p0.signedIn === null && typeof p0.ms === 'number', 'the ping from a device that has not joined only checks the server is reachable');
  const pingIn = F.make({ storage, fetch: pingFetch, url: () => 'https://w.example' }); storage.setItem(F.STORE, JSON.stringify({ id: KEY, key: SECRET, name: 'Mei', group: 'Crew' }));
  const p1 = await pingIn.ping();
  check(p1.signedIn === true && p1.group === 'Crew', 'a joined device is checked against the server and its group name is returned');
  routes.group = 401;
  check((await pingIn.ping()).signedIn === false, 'a key the server no longer accepts is reported as signed out, not as an error');
  routes.health = 0;
  check((await pingIn.ping().catch((e) => e)).message.length > 10, 'an unreachable server is reported as an error');
  console.log(failures ? failures + ' friends unit check(s) failed' : 'all friends unit checks passed');
  process.exit(failures ? 1 : 0);
})();
