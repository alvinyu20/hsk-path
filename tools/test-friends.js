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
check(eq(F.parseHash('#join=ABCD-EFGH-JKLM'), { join: 'ABCD-EFGH-JKLM' }) && eq(F.parseHash('#me=' + KEY + '.' + SECRET), { me: { id: KEY, key: SECRET } }), 'invite and personal links are read from the address');
check(eq(F.parseHash('#join=<script>'), {}) && eq(F.parseHash('#me=zz.zz'), {}) && eq(F.parseHash(''), {}) && eq(F.parseHash('#something'), {}), 'anything else in the address is ignored');
check(F.makeLink('https://x.example/app/?a=1#old', { id: KEY, key: SECRET }) === 'https://x.example/app/?a=1#me=' + KEY + '.' + SECRET && F.inviteLink('https://x.example/app/#z', 'CODE') === 'https://x.example/app/#join=CODE', 'links are built on the site address without the old # part');

// the client with a fake server
const store = {}; const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const log = []; let nextStatus = 200, nextJson = {};
const fakeFetch = async (url, o) => { log.push({ url, method: o.method, auth: o.headers.Authorization, body: o.body }); if (nextStatus === 0) throw new Error('offline'); return { ok: nextStatus < 400, status: nextStatus, json: async () => nextJson }; };
(async () => {
  const off = F.make({ storage, fetch: fakeFetch, url: () => '' });
  check(off.enabled() === false && (await off.join('x', 'y').catch((e) => e.code)) === 'off', 'without a server address nothing is sent');
  const c = F.make({ storage, fetch: fakeFetch, url: () => 'https://w.example/' });
  check(c.enabled() && c.identity() === null && (await c.push({}) === null), 'before joining there is no identity and nothing is pushed');
  nextJson = { id: KEY, key: SECRET, name: 'Mei', group: 'Crew' }; nextStatus = 201;
  await c.join('abcd', 'Mei');
  check(log[0].url === 'https://w.example/api/join' && log[0].method === 'POST' && !log[0].auth && c.identity().name === 'Mei' && c.identity().key === SECRET, 'joining posts to the server (no double slash) and keeps the key');
  nextStatus = 200; nextJson = { ok: true };
  await c.push({ a: 1 }, { keepalive: true });
  check(log[1].auth === 'Bearer ' + KEY + '.' + SECRET && log[1].method === 'PUT' && JSON.parse(log[1].body).stats.a === 1, 'later requests carry the key as a bearer header');
  nextStatus = 403; nextJson = { error: 'bad_invite' };
  check((await c.join('x', 'y').catch((e) => e)).message.includes('invite code does not work'), 'a refused invite becomes a clear message');
  nextStatus = 0;
  check((await c.group().catch((e) => e.code)) === 'network', 'no connection is reported as a network problem');
  nextStatus = 401; nextJson = { error: 'unauthorized' };
  check((await c.group().catch((e) => e.status)) === 401, 'a refused key is reported with its status so the app can sign out');
  await c.leave();
  check(c.identity() === null, 'leaving forgets the key even if the server no longer knows it');
  nextStatus = 200; nextJson = { group: { name: 'Crew' }, me: KEY, now: 1, members: [{ id: KEY, name: 'Mei' }] };
  await c.restore({ id: KEY, key: SECRET });
  check(c.identity().name === 'Mei' && c.identity().group === 'Crew', 'a personal link is checked with the server before it is kept');
  console.log(failures ? failures + ' friends unit check(s) failed' : 'all friends unit checks passed');
  process.exit(failures ? 1 : 0);
})();
