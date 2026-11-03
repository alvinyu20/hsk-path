/* Shanlu friends board: one small Cloudflare Worker + D1 database.
 *
 * What it stores per person: a first name, a few study totals that friends can see (see cleanStats), and that person's own saved progress
 * (so every one of their devices ends up with the same progress). Only the person's own key can read their progress; friends never get it.
 * How people get in: an invite code (a secret you set) is checked once when someone joins. They get back a secret key that the app keeps on their
 * device (and in "their link" for a second device). The key is stored here only as a hash. There are no passwords and no accounts.
 *
 * Setup is in worker/README.md. Everything in this file is one piece so it can be pasted into the Cloudflare dashboard as-is.
 *
 * Settings (Worker "Variables and Secrets"):
 *   INVITE_CODE      secret   the code friends need to join (12+ random letters and numbers)
 *   ADMIN_KEY        secret   lets you list and remove people (a long random string)
 *   GROUP_NAME       text     shown on the Friends screen, for example "Shanlu crew"
 *   ALLOWED_ORIGINS  text     the address of the site, for example https://alvinyu20.github.io  (comma separated; "*" allows any site)
 *   MAX_MEMBERS      text     optional, default 12
 * Binding: a D1 database named DB.
 */

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
const randHex = (bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const DAY_MS = 864e5;
const MAX_PROGRESS = 700000;   // characters: a person's whole saved progress is about 150,000

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, stats TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS cheers (from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (from_id, to_id))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS progress (member_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
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
const reply = (req, env, data, status = 200) => new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, corsHeaders(req, env)) });
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
  return { v: 1, asOf, last7, streak, lastActive, mem, levels: levels(s.levels), passed: levels(s.passed) };
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
    if (!env.INVITE_CODE) return fail(req, env, 503, 'joining_is_off');
    const body = await readJson(req, 2048);
    if (body.tooBig) return fail(req, env, 413, 'too_big');
    if (body.bad) return fail(req, env, 400, 'bad_json');
    const given = normCode(body.value.invite);
    if (!given || !safeEq(await sha256(given), await sha256(normCode(env.INVITE_CODE)))) return fail(req, env, 403, 'bad_invite');
    const name = cleanName(body.value.name);
    if (!name) return fail(req, env, 400, 'name_needed');
    const max = Math.max(1, parseInt(env.MAX_MEMBERS, 10) || 12);
    const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM members').first()).n;
    if (count >= max) return fail(req, env, 409, 'group_full');
    const id = randHex(8), key = randHex(24);
    await env.DB.prepare('INSERT INTO members (id, name, key_hash, created_at, updated_at, stats) VALUES (?, ?, ?, ?, ?, NULL)').bind(id, name, await sha256(key), now, now).run();
    return reply(req, env, { id, key, name, group: String(env.GROUP_NAME || 'Study group') }, 201);
  }

  if (path.startsWith('/api/admin/')) {
    if (!(await isAdmin(req, env))) return fail(req, env, 401, 'unauthorized');
    if (path === '/api/admin/members' && req.method === 'GET') {
      const rows = (await env.DB.prepare('SELECT id, name, created_at, updated_at FROM members ORDER BY created_at').all()).results;
      return reply(req, env, { members: rows });
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
    const body = await readJson(req, 2048);
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
    // the saved text is passed on as it is (no parsing: the free plan allows only 10 ms of CPU per request)
    return new Response('{"progress":' + (row ? row.data : 'null') + ',"updated":' + (row ? row.updated_at : 0) + '}', { status: 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, corsHeaders(req, env)) });
  }

  if (path === '/api/me/progress' && req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_PROGRESS) return fail(req, env, 413, 'too_big');
    if (!/^\{"v":1,"levels":\{/.test(text) || text[text.length - 1] !== '}') return fail(req, env, 400, 'bad_progress');
    await env.DB.prepare('INSERT INTO progress (member_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(me.id, text, now).run();
    return reply(req, env, { ok: true });
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
