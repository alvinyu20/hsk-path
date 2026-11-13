/* Shanlu friends board: one small Cloudflare Worker + D1 database.
 *
 * What it stores per person: a first name, a few study totals that friends can see (see cleanStats), and that person's own saved progress
 * (so every one of their devices ends up with the same progress). Only the person's own key can read their progress; friends never get it.
 * How people get in: anyone who opens the site can join by typing a first name (joining is open; the limits below keep it from being abused). They get
 * back a secret key that the app keeps on their device (and in "their link" for a second device). The key is stored here only as a hash. There are no
 * passwords and no accounts. If you ever want joining to need a code again, set INVITE_CODE (below) and the app's join form will be refused until it is removed.
 *
 * Setup is in worker/README.md. Everything in this file is one piece so it can be pasted into the Cloudflare dashboard as-is.
 *
 * Settings (Worker "Variables and Secrets"):
 *   INVITE_CODE      secret   OPTIONAL. Leave it out and anyone can join. Set it (12+ random letters and numbers) and joining needs that code: the site's own
 *                             join form no longer asks for one, so set it only to close the group to new people
 *   ADMIN_KEY        secret   lets you list and remove people (a long random string)
 *   GROUP_NAME       text     shown on the Friends screen, for example "Shanlu crew"
 *   ALLOWED_ORIGINS  text     the address of the site, for example https://alvinyu20.github.io  (comma separated; "*" allows any site)
 *   MAX_MEMBERS      text     optional, default 12 (raise it if more people will join; the group stops growing at this number)
 * Binding: a D1 database named DB.
 *
 * Safety features (all on by default, nothing to set up):
 *   - joining is rate-limited per network address (8 per hour) and for the whole server (60 per hour), and the group stops at MAX_MEMBERS;
 *   - if INVITE_CODE is set, wrong codes count against the same limit, and "single-use" codes can be made with the admin key (POST /api/admin/invites), valid 7 days;
 *   - saving progress checks the body is real JSON of a known shape, and an optional ?base=<version> makes the save fail with 412 if another
 *     device saved in between (so no device silently overwrites another).
 */

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
const randHex = (bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const DAY_MS = 864e5;
const MAX_PROGRESS = 700000;       // characters, for the compressed form {"v":2,"gz":"..."}; a person's whole saved progress is about 100,000 before compression
const MAX_PROGRESS_PLAIN = 400000; // the plain form is parsed here, so it is held lower (400,000 characters parse in about 2 ms; the free plan allows 10 ms of CPU)
const JOIN_TRIES_PER_IP = 8, JOIN_TRIES_ALL = 60, TRY_WINDOW_MS = 36e5, INVITE_LIFE_MS = 7 * DAY_MS;
const OPEN_JOINS_PER_IP = 20, OPEN_JOINS_ALL = 200;   // open joining: people who joined in the last hour (a household or a class on one network is fine)

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, stats TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS cheers (from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (from_id, to_id))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS progress (member_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS join_fails (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS invites (code_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, used_at INTEGER)'),
    ]).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Key', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (allowed.includes('*')) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const reply = (req, env, data, status = 200) => new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, corsHeaders(req, env)) });
const fail = (req, env, status, error) => reply(req, env, { error }, status);

async function readJson(req, maxBytes) {
  const text = await req.text();
  if (text.length > maxBytes) return { tooBig: true };
  try { const v = JSON.parse(text); return { value: v && typeof v === 'object' ? v : {} }; } catch (e) { return { bad: true }; }
}

function cleanName(x) {
  const s = String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 20).join('');
}

// The only thing a person shares: study totals. Anything else in the request is thrown away.
function cleanStats(s) {
  if (!s || typeof s !== 'object') return null;
  const day = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  const int = (x, lo, hi) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : null);
  const asOf = day(s.asOf);
  const lastActive = s.lastActive ? day(s.lastActive) : '';
  if (!asOf || lastActive === null) return null;
  if (!Array.isArray(s.last7) || s.last7.length !== 7) return null;
  const last7 = s.last7.map((x) => int(x, 0, 1440));
  if (last7.some((x) => x === null)) return null;
  const streak = int(s.streak, 0, 9999);
  const mem = int(s.mem, 0, 100000);
  if (streak === null || mem === null) return null;
  const levels = (a) => (Array.isArray(a) ? Array.from(new Set(a.map((x) => int(x, 1, 9)).filter((x) => x !== null))).sort((p, q) => p - q) : []);
  const out = { v: 1, asOf, last7, streak, lastActive, mem, levels: levels(s.levels), passed: levels(s.passed) };
  const jy = cleanJourney(s.jy);
  if (jy) out.jy = jy;
  return out;
}

// The Journey part of the study totals: how many stops, the regions stamped (with the day), the region being explored, and stops per region.
// Region names are checked against a plain shape, so nothing else can be tucked in.
function cleanJourney(j) {
  if (!j || typeof j !== 'object') return null;
  const id = (x) => (typeof x === 'string' && /^[a-z]{2,16}$/.test(x) ? x : null);
  const n = typeof j.n === 'number' && Number.isFinite(j.n) ? Math.max(0, Math.min(20000, Math.round(j.n))) : null;
  if (n === null) return null;
  const done = {}, per = {};
  let count = 0;
  if (j.done && typeof j.done === 'object') for (const k of Object.keys(j.done)) { if (count++ >= 40) break; const d = j.done[k]; if (id(k) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) done[k] = d; }
  count = 0;
  if (j.per && typeof j.per === 'object') for (const k of Object.keys(j.per)) { if (count++ >= 40) break; const c = j.per[k]; if (id(k) && typeof c === 'number' && Number.isFinite(c)) per[k] = Math.max(0, Math.min(5000, Math.round(c))); }
  // the stop reached last, as an id like sichuan.d-mapo-tofu: friends see which city you are in; it is the game's map, not a real location
  const at = typeof j.at === 'string' && /^[a-z]{2,16}\.[a-z0-9-]{1,90}$/.test(j.at) ? j.at : '';
  return { n, here: id(j.here) || '', at, done, per };
}

async function whoAmI(req, env) {
  const m = /^Bearer ([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await env.DB.prepare('SELECT id, name, key_hash FROM members WHERE id = ?').bind(m[1]).first();
  if (!row) return null;
  return safeEq(await sha256(m[2]), row.key_hash) ? row : null;
}

async function isAdmin(req, env) {
  const given = req.headers.get('X-Admin-Key') || '';
  if (!env.ADMIN_KEY || !given) return false;
  return safeEq(await sha256(given), await sha256(env.ADMIN_KEY));
}

async function handle(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  if (path === '/api/health') return reply(req, env, { ok: true });
  if (!env.DB) return fail(req, env, 500, 'no_database');
  await ensureSchema(env);
  const now = Date.now();

  if (path === '/api/join' && req.method === 'POST') {
    const body = await readJson(req, 2048);
    if (body.tooBig) return fail(req, env, 413, 'too_big');
    if (body.bad) return fail(req, env, 400, 'bad_json');
    // too many tries (wrong codes, or joins when joining is open) from one network, or from everywhere: stop answering for a while
    const ip = (await sha256('ip:' + (req.headers.get('CF-Connecting-IP') || 'unknown'))).slice(0, 16);
    // rows in join_fails are one per wrong code (ip_hash = the network) and, when joining is open, one per join ('j' + the network: a letter that no hex hash starts with)
    const jip = 'j' + ip.slice(0, 15);
    const tries = await env.DB.prepare("SELECT COALESCE(SUM(ip_hash = ?), 0) AS mine, COALESCE(SUM(ip_hash NOT LIKE 'j%'), 0) AS total, COALESCE(SUM(ip_hash = ?), 0) AS jmine, COALESCE(SUM(ip_hash LIKE 'j%'), 0) AS jall FROM join_fails WHERE at > ?").bind(ip, jip, now - TRY_WINDOW_MS).first();
    if (tries.mine >= JOIN_TRIES_PER_IP || tries.total >= JOIN_TRIES_ALL) return fail(req, env, 429, 'slow_down');
    if (!env.INVITE_CODE && (tries.jmine >= OPEN_JOINS_PER_IP || tries.jall >= OPEN_JOINS_ALL)) return fail(req, env, 429, 'slow_down');
    // joining is open unless INVITE_CODE is set (then a standing code, or a single-use code made with the admin key, is needed)
    const open = !env.INVITE_CODE;
    const given = normCode(body.value.invite);
    const codeHash = await sha256(given);
    const isStatic = !open && !!given && safeEq(codeHash, await sha256(normCode(env.INVITE_CODE)));
    let oneTime = false;
    if (!open && !isStatic && given) {
      // a single-use code: marking it used is one statement, so two people cannot both use it
      const used = await env.DB.prepare('UPDATE invites SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND created_at > ?').bind(now, codeHash, now - INVITE_LIFE_MS).run();
      oneTime = !!(used.meta && used.meta.changes === 1);
    }
    if (!open && !isStatic && !oneTime) {
      await env.DB.batch([env.DB.prepare('INSERT INTO join_fails (ip_hash, at) VALUES (?, ?)').bind(ip, now), env.DB.prepare('DELETE FROM join_fails WHERE at < ?').bind(now - TRY_WINDOW_MS)]);
      return fail(req, env, 403, 'bad_invite');
    }
    const release = () => (oneTime ? env.DB.prepare('UPDATE invites SET used_at = NULL WHERE code_hash = ?').bind(codeHash).run() : null);
    const name = cleanName(body.value.name);
    if (!name) { await release(); return fail(req, env, 400, 'name_needed'); }
    const max = Math.max(1, parseInt(env.MAX_MEMBERS, 10) || 12);
    const id = randHex(8), key = randHex(24);
    // the room check and the insert are one statement, so the group can never go over its size
    const ins = await env.DB.prepare('INSERT INTO members (id, name, key_hash, created_at, updated_at, stats) SELECT ?, ?, ?, ?, ?, NULL WHERE (SELECT COUNT(*) FROM members) < ?').bind(id, name, await sha256(key), now, now, max).run();
    if (!ins.meta || ins.meta.changes !== 1) { await release(); return fail(req, env, 409, 'group_full'); }
    if (open) await env.DB.batch([env.DB.prepare('INSERT INTO join_fails (ip_hash, at) VALUES (?, ?)').bind(jip, now), env.DB.prepare('DELETE FROM join_fails WHERE at < ?').bind(now - TRY_WINDOW_MS)]);   // open joining counts every join toward the hourly limit
    return reply(req, env, { id, key, name, group: String(env.GROUP_NAME || 'Study group') }, 201);
  }

  if (path.startsWith('/api/admin/')) {
    if (!(await isAdmin(req, env))) return fail(req, env, 401, 'unauthorized');
    if (path === '/api/admin/members' && req.method === 'GET') {
      const rows = (await env.DB.prepare('SELECT id, name, created_at, updated_at FROM members ORDER BY created_at').all()).results;
      return reply(req, env, { members: rows });
    }
    if (path === '/api/admin/invites' && req.method === 'POST') {
      // a code that works once, for 7 days: send it to one person (the app opens it from  <site>/#join=CODE )
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I, so a code can be read out loud
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      const raw = Array.from(bytes, (b) => letters[b & 31]).join('');
      const code = raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
      await env.DB.prepare('INSERT INTO invites (code_hash, created_at, used_at) VALUES (?, ?, NULL)').bind(await sha256(normCode(code)), now).run();
      return reply(req, env, { code, valid_days: 7 }, 201);
    }
    const del = /^\/api\/admin\/members\/([0-9a-f]{16})$/.exec(path);
    if (del && req.method === 'DELETE') {
      await env.DB.batch([env.DB.prepare('DELETE FROM cheers WHERE from_id = ? OR to_id = ?').bind(del[1], del[1]), env.DB.prepare('DELETE FROM progress WHERE member_id = ?').bind(del[1]), env.DB.prepare('DELETE FROM members WHERE id = ?').bind(del[1])]);
      return reply(req, env, { ok: true });
    }
    return fail(req, env, 404, 'not_found');
  }

  const me = await whoAmI(req, env);
  if (!me) return fail(req, env, 401, 'unauthorized');

  if (path === '/api/group' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT id, name, created_at, updated_at, stats FROM members ORDER BY created_at').all()).results;
    const cheers = (await env.DB.prepare('SELECT from_id, to_id FROM cheers WHERE at > ?').bind(now - DAY_MS).all()).results;
    const members = rows.map((r) => {
      let stats = null;
      try { stats = r.stats ? JSON.parse(r.stats) : null; } catch (e) { stats = null; }
      return { id: r.id, name: r.name, joined: r.created_at, updated: r.updated_at, stats, cheers: cheers.filter((c) => c.to_id === r.id).length, cheered: cheers.some((c) => c.to_id === r.id && c.from_id === me.id) };
    });
    return reply(req, env, { group: { name: String(env.GROUP_NAME || 'Study group') }, me: me.id, now, members });
  }

  if (path === '/api/me' && req.method === 'PUT') {
    const body = await readJson(req, 4096);
    if (body.tooBig) return fail(req, env, 413, 'too_big');
    if (body.bad) return fail(req, env, 400, 'bad_json');
    let name = me.name, stats = null;
    if (body.value.name !== undefined) { name = cleanName(body.value.name); if (!name) return fail(req, env, 400, 'name_needed'); }
    if (body.value.stats !== undefined) { stats = cleanStats(body.value.stats); if (!stats) return fail(req, env, 400, 'bad_stats'); }
    if (stats) await env.DB.prepare('UPDATE members SET name = ?, stats = ?, updated_at = ? WHERE id = ?').bind(name, JSON.stringify(stats), now, me.id).run();
    else await env.DB.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name, me.id).run();
    return reply(req, env, { ok: true, name });
  }

  if (path === '/api/me/progress' && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM progress WHERE member_id = ?').bind(me.id).first();
    // the saved text is passed on as it is (it was checked when it was saved; no parsing here, the free plan allows only 10 ms of CPU per request)
    return new Response('{"progress":' + (row ? row.data : 'null') + ',"updated":' + (row ? row.updated_at : 0) + '}', { status: 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, corsHeaders(req, env)) });
  }

  if (path === '/api/me/progress' && req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_PROGRESS) return fail(req, env, 413, 'too_big');
    // it must be real JSON of one of the two shapes the app sends; anything else would make this person's own next download unreadable
    let doc = null;
    try { doc = JSON.parse(text); } catch (e) { doc = null; }
    const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
    const plain = isObj(doc) && doc.v === 1 && isObj(doc.levels) && (doc.person === undefined || isObj(doc.person));
    const packed = isObj(doc) && doc.v === 2 && typeof doc.gz === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(doc.gz) && Object.keys(doc).length === 2;
    if (!plain && !packed) return fail(req, env, 400, 'bad_progress');
    if (plain && text.length > MAX_PROGRESS_PLAIN) return fail(req, env, 413, 'too_big');
    const base = url.searchParams.get('base');
    if (base !== null) {
      // the app says which saved version it started from; if the stored one is newer, someone else saved in between
      if (!/^\d{1,15}$/.test(base)) return fail(req, env, 400, 'bad_base');
      const b = Number(base), next = Math.max(now, b + 1);
      const res = b === 0
        ? await env.DB.prepare('INSERT INTO progress (member_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(member_id) DO NOTHING').bind(me.id, text, next).run()
        : await env.DB.prepare('UPDATE progress SET data = ?, updated_at = ? WHERE member_id = ? AND updated_at = ?').bind(text, next, me.id, b).run();
      if (!res.meta || res.meta.changes !== 1) return fail(req, env, 412, 'conflict');
      return reply(req, env, { ok: true, updated: next });
    }
    await env.DB.prepare('INSERT INTO progress (member_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET data = excluded.data, updated_at = MAX(excluded.updated_at, progress.updated_at + 1)').bind(me.id, text, now).run();
    const cur = await env.DB.prepare('SELECT updated_at FROM progress WHERE member_id = ?').bind(me.id).first();
    return reply(req, env, { ok: true, updated: cur ? cur.updated_at : now });
  }

  if (path === '/api/cheer' && req.method === 'POST') {
    const body = await readJson(req, 512);
    if (body.tooBig) return fail(req, env, 413, 'too_big');
    if (body.bad) return fail(req, env, 400, 'bad_json');
    const to = String(body.value.to || '');
    if (!/^[0-9a-f]{16}$/.test(to) || to === me.id) return fail(req, env, 400, 'bad_target');
    const target = await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(to).first();
    if (!target) return fail(req, env, 404, 'no_such_member');
    await env.DB.prepare('INSERT INTO cheers (from_id, to_id, at) VALUES (?, ?, ?) ON CONFLICT(from_id, to_id) DO UPDATE SET at = excluded.at').bind(me.id, to, now).run();
    return reply(req, env, { ok: true });
  }

  if (path === '/api/me' && req.method === 'DELETE') {
    await env.DB.batch([env.DB.prepare('DELETE FROM cheers WHERE from_id = ? OR to_id = ?').bind(me.id, me.id), env.DB.prepare('DELETE FROM progress WHERE member_id = ?').bind(me.id), env.DB.prepare('DELETE FROM members WHERE id = ?').bind(me.id)]);
    return reply(req, env, { ok: true });
  }

  return fail(req, env, 404, 'not_found');
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); } catch (e) { return fail(req, env, 500, 'server_error'); }
  },
};
