#!/usr/bin/env node
/* Unit tests for sync.js: the merge must be symmetric and idempotent, and a full round must work against a fake GitHub.
 * Usage: node tools/test-sync.js */
const S = require('../sync.js');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };

const a = { ws: { x: { see: { s: 2, l: 0, t: 100 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }, y: { see: { s: 1, l: 0, t: 500 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, xp: 50, streak: 3, lastActive: '2026-10-30', day: '2026-10-30', rq: ['a', 'b'], rtotal: 2, activity: { '2026-10-30': true }, gres: { l1: 60 }, misses: { x: 2 }, clipBest: [1, 0, 3], testHistory: [{ date: 'Oct 30', score: 70, at: 5 }], wlearned: { p: true } };
const b = { ws: { x: { see: { s: 5, l: 0, t: 200 }, hear: { s: 1, l: 0, t: 50 }, prod: { s: 0, l: 0 } } }, xp: 80, streak: 2, lastActive: '2026-10-29', day: '2026-10-30', rq: ['b', 'c'], rtotal: 3, activity: { '2026-10-29': true }, gres: { l1: 90, l2: 80 }, misses: { x: 1, z: 4 }, clipBest: [0, 2, 1, 4], testHistory: [{ date: 'Oct 29', score: 80, at: 3 }], wlearned: { q: true } };
const m1 = S.merge(a, b), m2 = S.merge(b, a);
check(S.same(m1, m2), 'merge is symmetric');
check(S.same(S.merge(m1, m1), m1), 'merge is idempotent');
check(S.same(S.merge(S.merge(a, b), b), m1), 'merging the same device twice changes nothing');
check(m1.ws.x.see.s === 5 && m1.ws.x.hear.s === 1 && m1.ws.y.see.s === 1, 'per word and per skill, the more recent review wins');
check(m1.xp === 80 && m1.streak === 3 && m1.lastActive === '2026-10-30', 'xp is the larger, the streak follows the device active most recently');
check(m1.gres.l1 === 90 && m1.gres.l2 === 80 && m1.misses.z === 4 && m1.misses.x === 2, 'best lesson scores and miss counts keep the larger value');
check(m1.clipBest.join() === '1,2,3,4', 'listening best scores merge per clip');
check(m1.rq.join() === 'b', 'a word reviewed on either device is out of today\'s queue');
check(Object.keys(m1.wlearned).sort().join() === 'p,q' && Object.keys(m1.activity).length === 2, 'today\'s added words and active days are united');
check(m1.testHistory.length === 2 && m1.testHistory[0].at === 3, 'test history keeps every attempt, oldest first');
const blank = { ws: { x: { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, xp: 0 };
check(S.same(S.merge(blank, a).ws, S.merge(a, blank).ws) && S.merge(blank, a).ws.x.see.s === 2, 'a new blank device takes everything from the other');
const newerDay = Object.assign({}, a, { day: '2026-10-31', rq: ['q'], dayXp: 9 });
check(S.merge(newerDay, b).day === '2026-10-31' && S.merge(newerDay, b).rq.join() === 'q' && S.merge(newerDay, b).dayXp === 9, 'a newer day replaces an older one');

// a fake GitHub that keeps one gist in memory
function fakeGithub() {
  const gists = {}; let n = 0; const calls = [];
  const fetchFn = async (url, opt) => {
    const path = url.replace('https://api.github.com', ''); const method = opt.method; calls.push(method + ' ' + path);
    if ((opt.headers.Authorization || '') !== 'Bearer good') return { ok: false, status: 401, json: async () => ({}) };
    if (method === 'GET' && path.startsWith('/gists?')) return { ok: true, status: 200, json: async () => Object.keys(gists).map(id => ({ id, files: gists[id].files })) };
    if (method === 'POST' && path === '/gists') { const id = 'g' + (++n); const body = JSON.parse(opt.body); if (body.public !== false) throw new Error('gist must be secret'); gists[id] = { files: {} }; Object.keys(body.files).forEach(nm => { gists[id].files[nm] = { content: body.files[nm].content }; }); return { ok: true, status: 201, json: async () => ({ id }) }; }
    const m = path.match(/^\/gists\/(\w+)$/);
    if (m && method === 'GET') return gists[m[1]] ? { ok: true, status: 200, json: async () => ({ id: m[1], files: gists[m[1]].files }) } : { ok: false, status: 404, json: async () => ({}) };
    if (m && method === 'PATCH') { const fl = JSON.parse(opt.body).files; Object.keys(fl).forEach(nm => { gists[m[1]].files[nm] = { content: fl[nm].content }; }); return { ok: true, status: 200, json: async () => ({}) }; }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  return { fetchFn, gists, calls };
}
(async () => {
  const gh = fakeGithub();
  let r = await S.round({ token: 'good', state: a, fetch: gh.fetchFn });
  check(r.created && r.gistId && gh.calls.some(c => c === 'POST /gists'), 'first device creates a private gist');
  r = await S.round({ token: 'good', gistId: null, state: b, fetch: gh.fetchFn });
  check(!r.created && S.same(r.merged, S.merge(a, b)) && r.wrote, 'second device finds the gist, merges and writes back');
  const stored = JSON.parse(gh.gists[r.gistId].files[S.FILE].content).state;
  check(S.same(stored, S.merge(a, b)), 'the gist holds the merged progress');
  const before = gh.calls.length;
  r = await S.round({ token: 'good', gistId: r.gistId, state: r.merged, fetch: gh.fetchFn });
  check(!r.wrote && gh.calls.slice(before).every(c => c.startsWith('GET')), 'a sync with nothing new does not write');
  let err = null; try { await S.round({ token: 'bad', state: a, fetch: gh.fetchFn }); } catch (e) { err = e; }
  check(err && err.kind === 'auth', 'a rejected token is reported as an auth problem');
  gh.gists[r.gistId] && delete gh.gists[r.gistId];
  r = await S.round({ token: 'good', gistId: 'g1', state: a, fetch: gh.fetchFn });
  check(r.created, 'if the gist was deleted, a new one is made');
  // each level keeps its own file in the same gist
  const l2a = { ws: { 机场: { see: { s: 3, l: 0, t: 300 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, xp: 10 };
  const l2b = { ws: { 地铁: { see: { s: 2, l: 0, t: 400 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, xp: 20 };
  const f2 = S.fileFor(2);
  check(S.fileFor(1) === S.FILE && f2 !== S.FILE && /hsk2/.test(f2), 'HSK 1 keeps the original file name and HSK 2 has its own');
  const gh2 = fakeGithub();
  r = await S.round({ token: 'good', state: a, fetch: gh2.fetchFn, file: S.fileFor(1) });
  const gid = r.gistId;
  const l1Before = gh2.gists[gid].files[S.FILE].content;
  r = await S.round({ token: 'good', state: l2a, fetch: gh2.fetchFn, file: f2 });
  check(!r.created && r.gistId === gid && gh2.gists[gid].files[f2], 'HSK 2 finds the HSK 1 gist and adds its own file to it');
  check(gh2.gists[gid].files[S.FILE].content === l1Before, 'syncing HSK 2 leaves the HSK 1 file untouched');
  r = await S.round({ token: 'good', state: l2b, fetch: gh2.fetchFn, file: f2 });
  check(S.same(r.merged.ws, S.merge(l2a, l2b).ws) && r.merged.ws['机场'] && r.merged.ws['地铁'], 'a second device merges HSK 2 progress through its own file');
  r = await S.round({ token: 'good', state: b, fetch: gh2.fetchFn, file: S.fileFor(1) });
  check(!r.merged.ws['机场'] && S.same(r.merged, S.merge(a, b)), 'HSK 1 sync does not pick up HSK 2 words');
  const gh3 = fakeGithub();
  r = await S.round({ token: 'good', state: l2a, fetch: gh3.fetchFn, file: f2 });
  const gid3 = r.gistId;
  r = await S.round({ token: 'good', state: a, fetch: gh3.fetchFn, file: S.fileFor(1) });
  check(!r.created && r.gistId === gid3 && gh3.gists[gid3].files[S.FILE] && gh3.gists[gid3].files[f2], 'if HSK 2 syncs first, HSK 1 later joins the same gist');
  console.log(failures ? failures + ' check(s) failed' : 'all sync checks passed');
  process.exit(failures ? 1 : 0);
})();
