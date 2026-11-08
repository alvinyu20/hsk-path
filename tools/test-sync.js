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
const ga = { gpt: { 'g1-svo': { rn: 1, at: 100 }, 'g1-dou': { rn: 4, at: 300 } } }, gb = { gpt: { 'g1-svo': { rn: 3, at: 200 }, 'g1-dou': { rn: 2, at: 50 }, 'g2-1': { rn: 1, at: 10 } } };
const gm = S.merge(ga, gb);
check(gm.gpt['g1-svo'].rn === 3 && gm.gpt['g1-dou'].rn === 4 && gm.gpt['g2-1'].rn === 1, 'grammar point records merge per point, the newest one wins');
check(S.same(gm, S.merge(gb, ga)), 'the grammar point merge is symmetric');
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
  // minutes per day, per device
  const m1 = S.merge({ minLog: { '2026-11-02': 20 }, minDev: { '2026-11-02': { phone: 20 } } }, { minLog: { '2026-11-02': 15 }, minDev: { '2026-11-02': { desk: 15 } } });
  check(S.dayMinutes(m1, '2026-11-02') === 35, 'minutes studied on two devices the same day add up (20 + 15)');
  const m2 = S.merge(m1, { minDev: { '2026-11-02': { phone: 12, desk: 15 } } });
  check(S.dayMinutes(m2, '2026-11-02') === 35 && S.same(S.merge(m1, m1), m1) && S.same(S.merge(m1, { minLog: { '2026-11-02': 15 }, minDev: { '2026-11-02': { desk: 15 } } }), S.merge({ minLog: { '2026-11-02': 15 }, minDev: { '2026-11-02': { desk: 15 } } }, m1)), 'merging again never counts minutes twice, and the order does not matter');
  check(S.dayMinutes({ minLog: { '2026-11-01': 9 } }, '2026-11-01') === 9 && S.dayMinutes({}, '2026-11-01') === 0, 'older saves without per-device numbers still count');
  const many = {}; for (let i = 1; i <= 80; i++) many['2026-01-' + String(i).padStart(2, '0')] = { d: i };
  check(Object.keys(S.merge({ minDev: many }, {}).minDev).length === 60, 'only the last 60 days of minutes are kept');
  // words in their learning phase and the review log
  const ma = S.merge({ ws: { 你好: { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, lrn: { 你好: { st: 0, m: 0, at: 5 }, 谢谢: { st: -1, m: 0, at: 6 } }, rlog: [[10, '你好', 's', 'g', 'c']] },
    { ws: { 你好: { see: { s: 1.5, l: 0, t: 20 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, lrn: { 谢谢: { st: 1, m: 0, at: 4 } }, rlog: [[10, '你好', 's', 'g', 'c'], [20, '你好', 'p', 'a', 't']] });
  check(!ma.lrn['你好'] && ma.lrn['谢谢'].st === 1, 'a word that graduated on one device leaves the learning phase on both; the further-along entry wins');
  check(ma.rlog.length === 2 && S.same(S.merge(ma, ma), ma), 'the review log merges as a union without duplicates');
  const bigLog = []; for (let i = 0; i < 900; i++) bigLog.push([i, 'w', 's', 'g', 'f']);
  check(S.merge({ rlog: bigLog }, {}).rlog.length === 800, 'only the newest 800 answers are kept');
  // the person's own settings and notes (follow them to every device)
  const T = Date.now();
  const pA = { prefs: { voiceOnly: { v: true, at: T - 1000 }, ttsVoice: { v: 'Cherry', at: T - 500 } }, lsn: { v: { lvl: 2, ok: 1, miss: 0 }, at: T - 400 },
    mem: { facts: [{ t: 'learner likes hiking', d: '2026-11-03', at: T - 900 }, { t: 'learner has a cat', d: '2026-11-03', at: T - 800 }], del: {}, cleared: 0 } };
  const pB = { prefs: { voiceOnly: { v: false, at: T - 100 }, handsFree: { v: true, at: T - 50 } }, lsn: { v: { lvl: 3, ok: 0, miss: 0 }, at: T - 10 },
    mem: { facts: [{ t: 'learner likes tea', d: '2026-11-03', at: T - 700 }], del: { 'learner has a cat': T - 300 }, cleared: 0 } };
  const pm = S.mergePerson(pA, pB);
  check(pm.prefs.voiceOnly.v === false && pm.prefs.ttsVoice.v === 'Cherry' && pm.prefs.handsFree.v === true, 'a setting changed later on one device wins; others are kept');
  check(pm.lsn.v.lvl === 3, 'the listening level set last wins');
  check(pm.mem.facts.map(f => f.t).join() === 'learner likes hiking,learner likes tea', 'remembered facts from both devices are kept, and a fact forgotten on one device stays forgotten');
  check(JSON.stringify(S.mergePerson(pA, pB)) === JSON.stringify(S.mergePerson(pB, pA)), 'person data merges the same in either order');
  check(S.samePerson(S.mergePerson(pm, pm), pm) && S.samePerson(S.mergePerson(pm, pA), pm), 'merging again changes nothing');
  const readded = S.mergePerson(pm, { mem: { facts: [{ t: 'learner has a cat', d: '2026-11-04', at: T + 5 }], del: {}, cleared: 0 } });
  check(readded.mem.facts.some(f => f.t === 'learner has a cat'), 'a fact told again after it was forgotten comes back');
  const cleared = S.mergePerson(pm, { mem: { facts: [], del: {}, cleared: T } });
  check(cleared.mem.facts.length === 0 && S.mergePerson(cleared, pA).mem.facts.length === 0, 'Forget everything wipes the older facts on every device');
  const secA = { prefs: {}, secrets: { v: { key: null, aliKey: 'sk-x' }, at: T - 5 } };
  check(S.mergePerson(secA, { prefs: {}, secrets: { v: null, at: T } }).secrets.v === null, 'switching key sharing off (a newer empty copy) removes the keys');
  const many2 = []; for (let i = 0; i < 45; i++) many2.push({ t: 'learner fact number ' + i, d: '', at: T - 1000 + i });
  const capped = S.mergePerson({ mem: { facts: many2, del: {}, cleared: 0 } }, {});
  check(capped.mem.facts.length === 30 && capped.mem.facts[29].t === 'learner fact number 44', 'only the 30 newest facts are kept');
  check(S.samePerson(undefined, {}) && S.samePerson(null, { prefs: {} }), 'empty person data is all the same');

  // ---- compact storage: only started words and dimensions are kept, and the always-zero `l` is dropped ----
  const cs = S.compactWs({ a: { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }, b: { see: { s: 2, l: 0, t: 100, d: 5 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }, c: { see: { s: 0, l: 0, t: 9 }, hear: { s: 1, l: 3, t: 4 }, prod: { s: 0, l: 0 } } });
  check(!cs.a && JSON.stringify(cs.b) === '{"see":{"s":2,"t":100,"d":5}}', 'a word nobody started is not stored, and an unstarted skill and the zero `l` are left out');
  check(cs.c.see && cs.c.see.t === 9 && cs.c.hear.l === 3, 'a skill with a timestamp is kept, and a non-zero `l` (older saves) is kept');
  const old = { ws: { x: { see: { s: 2, l: 0, t: 100 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } }, y: { see: { s: 0, l: 0 }, hear: { s: 0, l: 0 }, prod: { s: 0, l: 0 } } }, xp: 1 };
  const compactNew = { ws: { x: { see: { s: 2, t: 100 } } }, xp: 1 };
  check(S.same(S.merge(old, compactNew), S.merge(compactNew, old)) && !('y' in S.merge(old, compactNew).ws), 'an older device\'s full list and a compact list merge to the same compact result');
  check(S.same(S.merge(old, old), S.merge(compactNew, compactNew)), 'old and compact forms of the same progress are the same progress');
  check(S.merge(compactNew, { ws: {} }).ws.x.see.s === 2, 'a word missing on the other device is not lost');

  // ---- reset (epoch): the newer epoch wins outright, in any order ----
  const E = S.nextEpoch(0);
  const oldProg = { ws: { x: { see: { s: 9, t: 100 } } }, xp: 500, streak: 7, lastActive: '2026-11-03', day: '2026-11-03', epoch: 0, rlog: [[1, 'x', 'see', 'good', 'flip']], exams: [{ at: 5, l: 18, r: 18 }] };
  const reset = { epoch: E };
  const rm1 = S.merge(oldProg, reset), rm2 = S.merge(reset, oldProg);
  check(S.same(rm1, rm2) && rm1.epoch === E && Object.keys(rm1.ws).length === 0 && rm1.xp === 0 && rm1.rlog.length === 0 && rm1.exams.length === 0, 'a reset beats the old progress, whichever side it comes from');
  check(S.same(S.merge(rm1, rm1), rm1) && S.same(S.merge(S.merge(oldProg, reset), oldProg), rm1), 'merging the old progress in again after a reset changes nothing (merge stays a join)');
  const after = Object.assign({}, S.merge(reset, reset), { ws: { y: { see: { s: 1, t: 900 } } }, xp: 4 });
  const mm = S.merge(after, oldProg);
  check(mm.epoch === E && mm.xp === 4 && mm.ws.y && !mm.ws.x, 'study done after a reset is kept and the old progress stays gone');
  check(S.nextEpoch(E) > E && S.nextEpoch(Date.now() + 1e9) > Date.now() + 1e9, 'a new epoch is always later than the one it replaces, even when the clock is behind');
  const store = { xp: 5, ws: { x: {} }, theme: 'dark', rlog: [[1]] };
  const applied = S.applyMerged(store, S.merge(reset, reset));
  check(applied.theme === 'dark' && Object.keys(applied.ws).length === 0 && applied.rlog.length === 0 && applied.epoch === E, 'applying a merged reset clears the synced keys and keeps the device\'s own');

  // ---- the person\'s settings travel through the gist too ----
  const ghp = fakeGithub();
  const p1 = { prefs: { ttsVoice: { v: 'Kai', at: 100 } }, lsn: { v: { lvl: 3, ok: 1, miss: 0 }, at: 100 }, mem: { facts: [], del: {}, cleared: 0 } };
  const p2 = { prefs: { retention: { v: 0.85, at: 200 } }, mem: { facts: [{ t: 'likes tea', d: '2026-11-01', at: 150 }], del: {}, cleared: 0 } };
  let pr = await S.round({ token: 'good', state: a, person: p1, fetch: ghp.fetchFn });
  check(pr.created && pr.person.prefs.ttsVoice.v === 'Kai' && ghp.gists[pr.gistId].files[S.PERSON_FILE], 'the first device saves its settings in their own file in the gist');
  pr = await S.round({ token: 'good', state: b, person: p2, fetch: ghp.fetchFn });
  check(pr.person.prefs.ttsVoice.v === 'Kai' && pr.person.prefs.retention.v === 0.85 && pr.person.mem.facts.length === 1 && pr.person.lsn.v.lvl === 3, 'the second device gets the first one\'s settings and adds its own');
  const gpers = JSON.parse(ghp.gists[pr.gistId].files[S.PERSON_FILE].content).person;
  check(S.samePerson(gpers, pr.person), 'the gist holds the merged settings');
  const callsBefore = ghp.calls.length;
  pr = await S.round({ token: 'good', gistId: pr.gistId, state: pr.merged, person: pr.person, fetch: ghp.fetchFn });
  check(!pr.wrote && ghp.calls.slice(callsBefore).every(c => c.startsWith('GET')), 'a round with nothing new in the progress or the settings writes nothing');
  const nop = await S.round({ token: 'good', gistId: pr.gistId, state: pr.merged, fetch: ghp.fetchFn });
  check(nop.person === null, 'without settings passed in, the settings file is left alone');
  // the Settings "Test connection" check: read-only, tells a good token from a bad one, and reads the permission list when GitHub shows it
  const hdr = (o) => ({ get: (n) => (o[n.toLowerCase()] === undefined ? null : o[n.toLowerCase()]) });
  const mk = (status, headers) => async (url, o) => ({ ok: status < 400, status, headers: hdr(headers || {}), json: async () => [] });
  const okTok = await S.gistApi('t', mk(200, { 'x-oauth-scopes': 'gist', 'github-authentication-token-expiration': '2027-01-02 10:00:00 UTC' })).check();
  check(okTok.scopes === 'gist' && /^2027-01-02/.test(okTok.expires), 'the token check returns the permissions and the expiry date GitHub reports');
  const noHdr = await S.gistApi('t', async () => ({ ok: true, status: 200, json: async () => [] })).check();
  check(noHdr.scopes === null && noHdr.expires === null, 'the token check still works when the browser cannot read those headers');
  const badTok = await S.gistApi('t', mk(401)).check().catch(e => e);
  check(badTok.kind === 'auth' && /rejected the token/.test(badTok.message), 'a rejected token is reported as such');
  // the Journey: the journey with more stops wins, whatever the save times say
  const jyBig = { prefs: { jy: { v: { n: 15, seen: new Array(15).fill('a'), reg: 'neimenggu' }, at: T - 5000 } } };
  const jyNew = { prefs: { jy: { v: { n: 0, seen: [], reg: 'sichuan' }, at: T + 5000 } } };   // a fresh device that just opened the Journey, saved later
  check(S.mergePerson(jyBig, jyNew).prefs.jy.v.reg === 'neimenggu' && S.mergePerson(jyNew, jyBig).prefs.jy.v.reg === 'neimenggu', 'a journey with more stops is never replaced by a newer, emptier one');
  const jyTieA = { prefs: { jy: { v: { n: 3, seen: ['a', 'b', 'c'], reg: 'x' }, at: T } } }, jyTieB = { prefs: { jy: { v: { n: 3, seen: ['a', 'b', 'c'], reg: 'y' }, at: T + 1 } } };
  check(S.mergePerson(jyTieA, jyTieB).prefs.jy.v.reg === 'y' && JSON.stringify(S.mergePerson(jyTieA, jyTieB)) === JSON.stringify(S.mergePerson(jyTieB, jyTieA)), 'with the same number of stops the newer save wins, in either order');
  const jyRestart = { prefs: { jy: { v: { n: 0, seen: [], reg: 'neimenggu', rs: 1 }, at: T - 9000 } } };
  check(S.mergePerson(jyBig, jyRestart).prefs.jy.v.reg === 'neimenggu' && S.mergePerson(jyRestart, jyBig).prefs.jy.v.rs === 1, 'a deliberate restart beats an older journey with more stops, in either order');
  check(S.mergePerson(jyRestart, { prefs: { jy: { v: { n: 4, seen: ['a', 'b', 'c', 'd'], reg: 'neimenggu', rs: 1 }, at: T - 8000 } } }).prefs.jy.v.n === 4, 'after a restart the journey with more stops wins again');
  check(S.mergePerson(jyBig, { prefs: {} }).prefs.jy.v.n === 15 && S.mergePerson({ prefs: {} }, jyBig).prefs.jy.v.n === 15, 'a device with no journey takes the other one');

  const offTok = await S.gistApi('t', async () => { throw new Error('x'); }).check().catch(e => e);
  check(offTok.kind === 'network', 'an unreachable GitHub is reported as a network problem');
  let wrote = false;
  await S.gistApi('t', async (u, o) => { if (o.method !== 'GET') wrote = true; return { ok: true, status: 200, headers: hdr({}), json: async () => [] }; }).check();
  check(!wrote, 'the check only reads');
  console.log(failures ? failures + ' check(s) failed' : 'all sync checks passed');
  process.exit(failures ? 1 : 0);
})();
