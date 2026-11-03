// Runs the real worker.js against a real (local) D1 database with Miniflare. Run: cd worker && npm install && node test.mjs
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };

export async function makeWorker(bindings = {}) {
  return new Miniflare({
    modules: true, scriptPath: path.join(here, 'worker.js'), compatibilityDate: '2024-09-01', d1Databases: { DB: 'test-db-' + Math.random().toString(36).slice(2) },
    bindings: Object.assign({ INVITE_CODE: 'ABCD-EFGH-JKLM', ADMIN_KEY: 'admin-secret-key', GROUP_NAME: 'Test crew', ALLOWED_ORIGINS: 'https://friends.example' }, bindings),
  });
}
const api = (mf) => async (method, p, { body, token, headers } = {}) => {
  const h = Object.assign({ Origin: 'https://friends.example' }, headers || {});
  if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await mf.dispatchFetch('http://worker.test' + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  let json = null; try { json = await r.json(); } catch (e) {}
  return { status: r.status, json, headers: r.headers };
};
const stats = (extra) => Object.assign({ asOf: '2026-11-02', last7: [0, 10, 20, 0, 30, 15, 25], streak: 4, lastActive: '2026-11-02', mem: 120, levels: [1, 2], passed: [1] }, extra || {});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mf = await makeWorker();
  const call = api(mf);
  check((await call('GET', '/api/health')).json.ok === true, 'health check answers');

  // joining
  check((await call('POST', '/api/join', { body: { invite: 'WRONG', name: 'Mei' } })).status === 403, 'a wrong invite code is refused');
  check((await call('POST', '/api/join', { body: { name: 'Mei' } })).status === 403, 'a missing invite code is refused');
  check((await call('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: '   ' } })).status === 400, 'a blank name is refused');
  check((await call('POST', '/api/join', { body: 'not json' })).status === 400, 'broken JSON is refused');
  check((await call('POST', '/api/join', { body: { invite: 'x'.repeat(5000), name: 'a' } })).status === 413, 'an oversized request is refused');
  const a = await call('POST', '/api/join', { body: { invite: 'abcd efgh-jklm', name: '  Alvin  ' } });
  check(a.status === 201 && /^[0-9a-f]{16}$/.test(a.json.id) && /^[0-9a-f]{48}$/.test(a.json.key) && a.json.name === 'Alvin' && a.json.group === 'Test crew', 'the invite works in any case and spacing, and returns an id, a secret key and the group name');
  const A = a.json.id + '.' + a.json.key;
  const b = await call('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: '<img src=x onerror=alert(1)>Mei\u0007' } });
  check(b.status === 201 && !/[<>\u0007]/.test(b.json.name), 'angle brackets and control characters are removed from names (' + b.json.name + ')');
  const B = b.json.id + '.' + b.json.key;
  check((await call('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: 'x'.repeat(100) } })).json.name.length === 20, 'names are cut to 20 characters');

  // keys
  check((await call('GET', '/api/group')).status === 401, 'the group list needs a key');
  check((await call('GET', '/api/group', { token: a.json.id + '.' + '0'.repeat(48) })).status === 401, 'a wrong key is refused');
  check((await call('GET', '/api/group', { token: 'zzzz.zzzz' })).status === 401, 'a malformed key is refused');
  const g = await call('GET', '/api/group', { token: A });
  check(g.status === 200 && g.json.group.name === 'Test crew' && g.json.me === a.json.id && g.json.members.length === 3, 'with the key the group list shows everyone');
  const raw = JSON.stringify(g.json);
  check(!raw.includes(a.json.key) && !raw.includes('key_hash'), 'the list never contains keys or key hashes');
  const db = await mf.getD1Database('DB');
  const stored = await db.prepare('SELECT key_hash FROM members WHERE id = ?').bind(a.json.id).first();
  check(stored.key_hash !== a.json.key && /^[0-9a-f]{64}$/.test(stored.key_hash), 'the database holds only a hash of the key');

  // stats
  check((await call('PUT', '/api/me', { token: A, body: { stats: stats() } })).status === 200, 'valid study totals are saved');
  check((await call('PUT', '/api/me', { token: A, body: { stats: stats({ last7: [1, 2, 3] }) } })).status === 400, 'totals with the wrong week length are refused');
  check((await call('PUT', '/api/me', { token: A, body: { stats: stats({ asOf: 'yesterday' }) } })).status === 400, 'totals with a bad date are refused');
  check((await call('PUT', '/api/me', { token: A, body: { stats: stats({ mem: 'lots' }) } })).status === 400, 'totals with text where a number belongs are refused');
  check((await call('PUT', '/api/me', { token: A, body: { stats: 'x'.repeat(4000) } })).status === 413, 'a big stats upload is refused');
  await call('PUT', '/api/me', { token: A, body: { stats: Object.assign(stats({ last7: [5000, 0, 0, 0, 0, 0, -9], streak: 99999999, mem: 1e9, levels: [1, 1, 2, 99, 'x'] }), { words: ['secret', 'list'], email: 'a@b.c' }) } });
  const g2 = (await call('GET', '/api/group', { token: B })).json;
  const mine = g2.members.find((m) => m.id === a.json.id).stats;
  check(mine.last7[0] === 1440 && mine.last7[6] === 0 && mine.streak === 9999 && mine.mem === 100000 && JSON.stringify(mine.levels) === '[1,2,9]', 'numbers are clamped to sensible ranges');
  check(!('words' in mine) && !('email' in mine) && JSON.stringify(Object.keys(mine).sort()) === JSON.stringify(['asOf', 'lastActive', 'last7', 'levels', 'mem', 'passed', 'streak', 'v'].sort()), 'anything other than the study totals is thrown away');
  check((await call('PUT', '/api/me', { token: B, body: { stats: stats() } })).status === 200 && (await call('PUT', '/api/me', { token: B, body: { name: 'Mei K' } })).json.name === 'Mei K', 'a person can rename themselves without resending totals');

  // cheers
  check((await call('POST', '/api/cheer', { token: A, body: { to: a.json.id } })).status === 400, 'you cannot cheer yourself');
  check((await call('POST', '/api/cheer', { token: A, body: { to: 'f'.repeat(16) } })).status === 404, 'cheering someone who is not there fails');
  check((await call('POST', '/api/cheer', { token: A, body: { to: b.json.id } })).status === 200 && (await call('POST', '/api/cheer', { token: A, body: { to: b.json.id } })).status === 200, 'a cheer works, and cheering twice is harmless');
  const g3 = (await call('GET', '/api/group', { token: A })).json;
  const mei = g3.members.find((m) => m.id === b.json.id);
  check(mei.cheers === 1 && mei.cheered === true && g3.members.find((m) => m.id === a.json.id).cheered === false, 'a cheer counts once and shows who gave it');

  // progress: a person's own saved progress, readable only with their own key
  const none = await call('GET', '/api/me/progress', { token: A });
  check(none.status === 200 && none.json.progress === null, 'a person with no saved progress gets null');
  const prog = { v: 1, levels: { 1: { ws: { 你: { see: { s: 2, l: 0, t: 5 } } }, exams: [{ at: 1, mode: 'full', l: 18, r: 18 }] } } };
  check((await call('PUT', '/api/me/progress', { token: A, body: prog })).status === 200, 'saved progress is accepted');
  const back = await call('GET', '/api/me/progress', { token: A });
  check(JSON.stringify(back.json.progress) === JSON.stringify(prog) && back.json.updated > 0, 'and comes back exactly as saved');
  check((await call('GET', '/api/me/progress')).status === 401 && (await call('PUT', '/api/me/progress', { body: prog })).status === 401, 'progress needs a key');
  check((await call('PUT', '/api/me/progress', { token: A, body: { hello: 1 } })).status === 400 && (await call('PUT', '/api/me/progress', { token: A, body: 'not json at all' })).status === 400, 'something that is not saved progress is refused');
  check((await call('PUT', '/api/me/progress', { token: A, body: '{"v":1,"levels":{"1":"' + 'x'.repeat(800000) + '"}}' })).status === 413, 'a huge upload is refused');
  check((await call('GET', '/api/me/progress', { token: B })).json.progress === null, 'another person cannot read it and gets their own (empty) progress');
  check(!JSON.stringify((await call('GET', '/api/group', { token: B })).json).includes('exams'), 'the group list never contains anyone\'s progress');
  await call('PUT', '/api/me/progress', { token: A, body: Object.assign({}, prog, { levels: { 1: { ws: {} } } }) });
  check((await call('GET', '/api/me/progress', { token: A })).json.progress.levels[1].ws && Object.keys((await call('GET', '/api/me/progress', { token: A })).json.progress.levels[1]).length === 1, 'a later save replaces the earlier one');

  // admin
  check((await call('GET', '/api/admin/members')).status === 401 && (await call('GET', '/api/admin/members', { headers: { 'X-Admin-Key': 'nope' } })).status === 401, 'the admin list needs the admin key');
  const list = await call('GET', '/api/admin/members', { headers: { 'X-Admin-Key': 'admin-secret-key' } });
  check(list.status === 200 && list.json.members.length === 3 && !JSON.stringify(list.json).includes('key_hash'), 'the admin can list people');
  const gone = await call('DELETE', '/api/admin/members/' + b.json.id, { headers: { 'X-Admin-Key': 'admin-secret-key' } });
  check(gone.status === 200 && (await call('GET', '/api/group', { token: B })).status === 401, 'a removed person loses access');
  check((await call('GET', '/api/group', { token: A })).json.members.length === 2, 'and disappears from the list');

  // leaving
  check((await call('DELETE', '/api/me', { token: A })).status === 200 && (await call('GET', '/api/group', { token: A })).status === 401, 'leaving the group removes the person');
  check((await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE member_id = ?').bind(a.json.id).first()).n === 0, 'leaving also deletes the saved progress');
  check((await call('GET', '/api/nothing', { token: 'x' })).status === 401 && (await call('POST', '/api/nothing')).status === 401, 'unknown routes need a key too');

  // cors
  const ok = await call('GET', '/api/health');
  check(ok.headers.get('access-control-allow-origin') === 'https://friends.example', 'the allowed site gets a CORS header');
  const bad = await call('GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
  check(!bad.headers.get('access-control-allow-origin'), 'another site gets no CORS header');
  const pre = await mf.dispatchFetch('http://worker.test/api/group', { method: 'OPTIONS', headers: { Origin: 'https://friends.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  check(pre.status === 204 && /authorization/i.test(pre.headers.get('access-control-allow-headers')), 'the browser preflight is answered');
  await mf.dispose();

  // limits and switches
  const small = await makeWorker({ MAX_MEMBERS: '2' });
  const c2 = api(small);
  await c2('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: 'a' } }); await c2('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: 'b' } });
  check((await c2('POST', '/api/join', { body: { invite: 'ABCD-EFGH-JKLM', name: 'c' } })).status === 409, 'the group stops at the member limit');
  await small.dispose();
  const off = await makeWorker({ INVITE_CODE: '' });
  check((await api(off)('POST', '/api/join', { body: { invite: '', name: 'a' } })).status === 503, 'joining is off until an invite code is set');
  await off.dispose();
  const open = await makeWorker({ ALLOWED_ORIGINS: '*' });
  check((await api(open)('GET', '/api/health', { headers: { Origin: 'https://anything.example' } })).headers.get('access-control-allow-origin') === '*', 'ALLOWED_ORIGINS=* allows any site');
  await open.dispose();

  console.log(failures ? failures + ' worker check(s) failed' : 'all worker checks passed');
  process.exit(failures ? 1 : 0);
}
