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
 *   ALI_KEY          secret   OPTIONAL. An Alibaba Model Studio (Qwen, Singapore) API key. With it, everyone in the group can use the AI features
 *                             (Mingming chat, answer checking, voice recognition, voice) without a key of their own: the app sends the request here
 *                             and the Worker adds the key. Leave it out and the AI stays bring-your-own-key.
 *   ALI_WS           text     optional, your Model Studio workspace ID if your key needs one (see the Alibaba section in the app's Settings)
 *   AI_DAILY_LIMIT   text     optional, default 200: AI calls per person per day, counted across every AI feature (a chat turn, an answer check, a voice
 *                             recognition and a spoken line are one each). 0 switches the shared AI off.
 *   AI_GLOBAL_DAILY_LIMIT text optional, default 1000: AI calls per day for the whole group together (a safety ceiling for your Alibaba bill)
 *   AI_TIMEZONE      text     optional, default America/Los_Angeles: the day for the AI limit starts and ends at midnight in this time zone
 *   VAPID_PUBLIC_KEY secret   OPTIONAL, for phone reminders (Web Push). Make the pair with  node tools/make-vapid-keys.js  (it prints both).
 *   VAPID_PRIVATE_KEY secret  OPTIONAL, the private half. Without both, the reminder switch in the app says reminders are not set up.
 *   VAPID_SUBJECT    text     optional, a mailto: address or the site address, sent to the push services so they can reach you about problems
 * Binding: a D1 database named DB.
 * Cron trigger (only for reminders): every hour, for example  7 * * * *  . Each run sends the reminders due in that hour of each person's own time zone.
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

// ---- shared AI (the relay to Alibaba Qwen) ----
const AI_FEATURES = ['chat', 'grammar', 'meaning', 'asr', 'tts', 'ask'];            // what a call is counted under (the admin report shows each)
const AI_CHAT_MODELS = ['qwen-flash', 'qwen-plus'], AI_ASR_MODEL = 'qwen3-asr-flash', AI_TTS_MODEL = 'qwen3-tts-flash';
const AI_VOICES = ['Cherry', 'Serena', 'Maia', 'Neil', 'Kai'];
const AI_MAX_TOKENS = 800, AI_CHAT_BYTES = 60000, AI_ASR_BYTES = 1500000, AI_TTS_CHARS = 600, AI_KEEP_DAYS = 90;
const aiTz = (env) => { const z = String(env.AI_TIMEZONE || 'America/Los_Angeles'); try { new Intl.DateTimeFormat('en-CA', { timeZone: z }); return z; } catch (e) { return 'America/Los_Angeles'; } };
const aiDay = (env, now) => new Intl.DateTimeFormat('en-CA', { timeZone: aiTz(env), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
const aiNum = (x, dflt) => { const n = parseInt(x, 10); return Number.isFinite(n) && n >= 0 ? n : dflt; };
const aiLimits = (env) => ({ person: aiNum(env.AI_DAILY_LIMIT, 200), group: aiNum(env.AI_GLOBAL_DAILY_LIMIT, 1000) });
const aiBase = (env) => { const ws = String(env.ALI_WS || '').trim(); return /^[A-Za-z0-9-]{3,60}$/.test(ws) ? 'https://' + ws + '.ap-southeast-1.maas.aliyuncs.com' : 'https://dashscope-intl.aliyuncs.com'; };

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, stats TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS cheers (from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (from_id, to_id))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS progress (member_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS join_fails (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS invites (code_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, used_at INTEGER)'),
      // shared AI: calls counted per person, per day and per feature; and the people the admin has switched off
      env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_usage (member_id TEXT NOT NULL, day TEXT NOT NULL, feature TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (member_id, day, feature))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_block (member_id TEXT PRIMARY KEY, at INTEGER NOT NULL)'),
      // "Ask about this": answers shared by everyone in the group (the same first question about the same screen is answered once), and the report queue
      // (cards the AI or a person thinks are wrong, and AI answers a person thinks are wrong). The queue goes to Alvin's DeepSeek reviews.
      env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_ask (k TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL, by TEXT NOT NULL, n INTEGER NOT NULL, bad INTEGER NOT NULL, created_at INTEGER NOT NULL, used_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT NOT NULL, at INTEGER NOT NULL, why TEXT NOT NULL, k TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, ctx TEXT NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL)'),
      // phone reminders (Web Push): one row per phone or browser that switched them on. hour = local hour to remind, tz = its time zone,
      // n / streak = words due by then and the streak (sent by the app on each visit), studied = the last local day the app was used, sent = the last day reminded
      env.DB.prepare('CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, member_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, hour INTEGER NOT NULL, tz TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, studied TEXT, sent TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
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
  // the picture a person chose: a souvenir id such as panda-plush. Only that plain shape is kept, so nothing else can be tucked in.
  if (typeof s.av === 'string' && /^[a-z0-9-]{1,32}$/.test(s.av)) out.av = s.av;
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

// ---- phone reminders (Web Push, RFC 8030): the message is encrypted for the phone (RFC 8291, aes128gcm) and signed with the VAPID key (RFC 8292) ----
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const b = atob(t + '='.repeat((4 - t.length % 4) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; a.forEach((x) => { out.set(x, i); i += x.length; }); return out; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function pushEncrypt(p256dh, auth, text) {
  const uaPub = unb64u(p256dh), secret = unb64u(auth);
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey));
  const theirs = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return cat(head, asPub, ct);
}
async function vapidHeader(env, endpoint) {
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  const jwk = { kty: 'EC', crv: 'P-256', d: String(env.VAPID_PRIVATE_KEY).trim(), x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o) => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: String(env.VAPID_SUBJECT || 'https://alvinyu20.github.io/hsk-path/') });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return 'vapid t=' + unsigned + '.' + b64u(sig) + ', k=' + String(env.VAPID_PUBLIC_KEY).trim();
}
const pushReady = (env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
// sends one message; a phone that has switched reminders off (404/410) is removed
async function pushSend(env, row, msg) {
  const body = await pushEncrypt(row.p256dh, row.auth, JSON.stringify(msg));
  const r = await fetch(row.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(env, row.endpoint), TTL: '43200', Urgency: 'normal', Topic: 'shanlu-daily', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body });
  if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(row.endpoint).run();
  return r.status;
}
const localParts = (tz, now) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const g = (t) => (f.find((x) => x.type === t) || {}).value;
  return { day: g('year') + '-' + g('month') + '-' + g('day'), hour: Number(g('hour')) % 24 };
};
const reminderText = (row) => ({
  title: 'Time for Chinese',
  body: row.n > 0 ? row.n + ' word' + (row.n === 1 ? ' is' : 's are') + ' ready for review.' + (row.streak > 1 ? ' Keep your ' + row.streak + '-day streak going.' : '')
    : (row.streak > 1 ? 'A few minutes today keeps your ' + row.streak + '-day streak going.' : 'A few minutes of Chinese today?'),
  url: './#review', tag: 'shanlu-daily'
});
// the cron trigger: everyone whose reminder hour it is now (in their own time zone), who has not used the app today and was not reminded today
async function pushTick(env, now) {
  if (!pushReady(env) || !env.DB) return { sent: 0 };
  await ensureSchema(env);
  const rows = (await env.DB.prepare('SELECT p.*, m.stats AS stats FROM push_subs p JOIN members m ON m.id = p.member_id').all()).results;
  let sent = 0;
  for (const row of rows) {
    let lp; try { lp = localParts(row.tz, now); } catch (e) { continue; }
    if (lp.hour !== row.hour || row.sent === lp.day || row.studied === lp.day) continue;
    let st = null; try { st = row.stats ? JSON.parse(row.stats) : null; } catch (e) { st = null; }
    if (st && st.lastActive === lp.day) continue;
    await env.DB.prepare('UPDATE push_subs SET sent = ? WHERE endpoint = ?').bind(lp.day, row.endpoint).run();
    try { const code = await pushSend(env, row, reminderText(row)); if (code >= 200 && code < 300) sent++; } catch (e) {}
  }
  return { sent };
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
    if (path === '/api/admin/ai' && req.method === 'GET') {
      // today's calls per person and feature, and the totals of the last 7 days (to see whether the limit fits)
      const lim = aiLimits(env), day = aiDay(env, now), from = aiDay(env, now - 6 * DAY_MS);
      const today = (await env.DB.prepare('SELECT u.member_id AS id, COALESCE(m.name, \'(left)\') AS name, u.feature AS feature, u.n AS n FROM ai_usage u LEFT JOIN members m ON m.id = u.member_id WHERE u.day = ? ORDER BY u.member_id, u.feature').bind(day).all()).results;
      const week = (await env.DB.prepare('SELECT day, SUM(n) AS n, COUNT(DISTINCT member_id) AS people FROM ai_usage WHERE day >= ? GROUP BY day ORDER BY day').bind(from).all()).results;
      const blocked = (await env.DB.prepare('SELECT member_id AS id FROM ai_block').all()).results.map((r) => r.id);
      return reply(req, env, { on: !!env.ALI_KEY, day, tz: aiTz(env), limit: lim.person, group_limit: lim.group, today, week, blocked });
    }
    if (path === '/api/admin/reports' && req.method === 'GET') {
      // the report queue: ?status=open (default), sent or all
      const st = url.searchParams.get('status') || 'open';
      const rows = (await (st === 'all' ? env.DB.prepare('SELECT r.*, COALESCE(m.name, \'(left)\') AS name FROM ai_reports r LEFT JOIN members m ON m.id = r.member_id ORDER BY r.id')
        : env.DB.prepare('SELECT r.*, COALESCE(m.name, \'(left)\') AS name FROM ai_reports r LEFT JOIN members m ON m.id = r.member_id WHERE r.status = ? ORDER BY r.id').bind(st)).all()).results;
      return reply(req, env, { reports: rows });
    }
    if (path === '/api/admin/reports/mark' && req.method === 'POST') {
      // {ids:[...], status:'sent'|'open'|'done'}: the reports workflow marks what it has put into a review pack
      let doc = null; try { doc = await req.json(); } catch (e) { doc = null; }
      const ids = doc && Array.isArray(doc.ids) ? doc.ids.map((x) => Math.floor(Number(x))).filter((x) => x > 0).slice(0, 500) : [];
      const st = doc && ['sent', 'open', 'done'].includes(doc.status) ? doc.status : 'sent';
      for (const id of ids) await env.DB.prepare('UPDATE ai_reports SET status = ? WHERE id = ?').bind(st, id).run();
      return reply(req, env, { ok: true, marked: ids.length, status: st });
    }
    if (path === '/api/admin/ask' && req.method === 'GET') {
      // the shared answers, most used first (to see what people ask)
      const rows = (await env.DB.prepare('SELECT k, kind, title, q, by, n, bad, created_at, used_at FROM ai_ask ORDER BY n DESC, used_at DESC LIMIT 200').all()).results;
      return reply(req, env, { answers: rows });
    }
    const aiOff = /^\/api\/admin\/ai\/([0-9a-f]{16})$/.exec(path);
    if (aiOff && (req.method === 'POST' || req.method === 'DELETE')) {
      // POST switches this person's shared AI off, DELETE switches it back on
      if (req.method === 'POST') await env.DB.prepare('INSERT INTO ai_block (member_id, at) VALUES (?, ?) ON CONFLICT(member_id) DO NOTHING').bind(aiOff[1], now).run();
      else await env.DB.prepare('DELETE FROM ai_block WHERE member_id = ?').bind(aiOff[1]).run();
      return reply(req, env, { ok: true, blocked: req.method === 'POST' });
    }
    const del = /^\/api\/admin\/members\/([0-9a-f]{16})$/.exec(path);
    if (del && req.method === 'DELETE') {
      await env.DB.batch([env.DB.prepare('DELETE FROM cheers WHERE from_id = ? OR to_id = ?').bind(del[1], del[1]), env.DB.prepare('DELETE FROM push_subs WHERE member_id = ?').bind(del[1]), env.DB.prepare('DELETE FROM progress WHERE member_id = ?').bind(del[1]), env.DB.prepare('DELETE FROM ai_block WHERE member_id = ?').bind(del[1]), env.DB.prepare('DELETE FROM members WHERE id = ?').bind(del[1])]);
      return reply(req, env, { ok: true });
    }
    return fail(req, env, 404, 'not_found');
  }

  const me = await whoAmI(req, env);
  if (!me) return fail(req, env, 401, 'unauthorized');

  // ---- shared AI: the app sends its Qwen requests here; the Worker adds the key, counts the call and passes the answer back ----
  if (path.startsWith('/api/ai/')) {
    const lim = aiLimits(env), day = aiDay(env, now);
    const blocked = !!(await env.DB.prepare('SELECT 1 AS x FROM ai_block WHERE member_id = ?').bind(me.id).first());
    const usedBy = async () => (await env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM ai_usage WHERE member_id = ? AND day = ?').bind(me.id, day).first()).n;
    if (path === '/api/ai/status' && req.method === 'GET') {
      const used = await usedBy();
      return reply(req, env, { on: !!env.ALI_KEY && lim.person > 0 && !blocked, blocked, used, limit: lim.person, left: Math.max(0, lim.person - used), day, tz: aiTz(env) });
    }
    // "Ask about this": the shared answers and the report queue (nothing here counts against the AI allowance)
    if (path === '/api/ai/ask' && req.method === 'GET') {
      const k = url.searchParams.get('k') || '';
      if (!/^[0-9a-f]{40,64}$/.test(k)) return fail(req, env, 400, 'bad_request');
      const row = await env.DB.prepare('SELECT a, by, n, created_at FROM ai_ask WHERE k = ? AND bad = 0').bind(k).first();
      if (!row) return reply(req, env, { hit: null });
      await env.DB.prepare('UPDATE ai_ask SET n = n + 1, used_at = ? WHERE k = ?').bind(now, k).run();
      let a = null; try { a = JSON.parse(row.a); } catch (e) { a = null; }
      return reply(req, env, { hit: a ? { a, by: row.by, n: row.n + 1, at: row.created_at } : null });
    }
    if ((path === '/api/ai/ask' && req.method === 'PUT') || (path === '/api/ai/report' && req.method === 'POST')) {
      const text = await req.text();
      if (text.length > 16000) return fail(req, env, 413, 'too_big');
      let doc = null; try { doc = JSON.parse(text); } catch (e) { doc = null; }
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return fail(req, env, 400, 'bad_json');
      const str = (x, n) => String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
      const k = str(doc.k, 64);
      if (k && !/^[0-9a-f]{40,64}$/.test(k)) return fail(req, env, 400, 'bad_request');
      if (path === '/api/ai/ask') {
        const a = doc.a && typeof doc.a === 'object' && !Array.isArray(doc.a) ? doc.a : null;
        if (!k || !a || typeof a.answer !== 'string' || !a.answer.trim()) return fail(req, env, 400, 'bad_request');
        const keep = { answer: str(a.answer, 2000), examples: (Array.isArray(a.examples) ? a.examples : []).slice(0, 3).map((e) => ({ zh: str(e && e.zh, 120), en: str(e && e.en, 200) })), card_wrong: !!a.card_wrong, card_note: str(a.card_note, 400) };
        await env.DB.prepare('INSERT INTO ai_ask (k, kind, title, q, a, by, n, bad, created_at, used_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?) ON CONFLICT(k) DO NOTHING')
          .bind(k, str(doc.kind, 40), str(doc.title, 200), str(doc.q, 300), JSON.stringify(keep), str(doc.by, 30), now, now).run();
        return reply(req, env, { ok: true });
      }
      // a report: why = card (a person thinks the card is wrong), answer (a person thinks the AI's answer is wrong) or ai (the AI thinks the card is wrong)
      const why = ['card', 'answer', 'ai'].includes(doc.why) ? doc.why : '';
      if (!why) return fail(req, env, 400, 'bad_request');
      const since = now - DAY_MS;
      const mine = (await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_reports WHERE member_id = ? AND at > ?').bind(me.id, since).first()).n;
      if (mine >= 40) return fail(req, env, 429, 'slow_down');
      // the same thing reported again (same answer or screen, same reason, still open) is not queued twice
      if (k && (await env.DB.prepare('SELECT 1 AS x FROM ai_reports WHERE k = ? AND why = ? AND status = \'open\'').bind(k, why).first())) return reply(req, env, { ok: true, dup: true });
      await env.DB.prepare('INSERT INTO ai_reports (member_id, at, why, k, kind, title, ctx, q, a, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'open\')')
        .bind(me.id, now, why, k || null, str(doc.kind, 40), str(doc.title, 200), str(doc.ctx, 4000), str(doc.q, 300), str(doc.a, 2400), str(doc.note, 600)).run();
      if (why === 'answer' && k) await env.DB.prepare('UPDATE ai_ask SET bad = 1 WHERE k = ?').bind(k).run();   // a shared answer someone doubts is not handed out again
      return reply(req, env, { ok: true }, 201);
    }
    const isChat = path === '/api/ai/chat', isTts = path === '/api/ai/tts';
    if ((isChat || isTts) && req.method === 'POST') {
      if (!env.ALI_KEY || lim.person <= 0) return fail(req, env, 503, 'ai_not_set_up');
      if (blocked) return fail(req, env, 403, 'ai_off');
      const text = await req.text();
      if (text.length > AI_ASR_BYTES) return fail(req, env, 413, 'too_big');
      let doc = null; try { doc = JSON.parse(text); } catch (e) { doc = null; }
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return fail(req, env, 400, 'bad_json');
      let feature = '', upstreamUrl = '', upstreamBody = null;
      if (isChat) {
        feature = String(doc.feature || '');
        const b = doc.body;
        if (!['chat', 'grammar', 'meaning', 'asr', 'ask'].includes(feature) || !b || typeof b !== 'object' || !Array.isArray(b.messages) || b.messages.length < 1 || b.messages.length > 40) return fail(req, env, 400, 'bad_request');
        if (feature === 'asr' ? b.model !== AI_ASR_MODEL : !AI_CHAT_MODELS.includes(b.model)) return fail(req, env, 400, 'bad_model');
        if (feature !== 'asr' && text.length > AI_CHAT_BYTES) return fail(req, env, 413, 'too_big');
        upstreamBody = { model: b.model, messages: b.messages, stream: false };
        if (feature !== 'asr') upstreamBody.max_tokens = Math.max(1, Math.min(AI_MAX_TOKENS, Math.round(Number(b.max_tokens)) || 300));
        if (b.response_format && b.response_format.type === 'json_object') upstreamBody.response_format = { type: 'json_object' };
        if (feature === 'asr' && b.asr_options && typeof b.asr_options === 'object') upstreamBody.asr_options = { enable_itn: false, language: b.asr_options.language === 'zh' ? 'zh' : undefined };
        upstreamUrl = aiBase(env) + '/compatible-mode/v1/chat/completions';
      } else {
        feature = 'tts';
        const t = typeof doc.text === 'string' ? doc.text.trim().slice(0, AI_TTS_CHARS) : '';
        if (!t) return fail(req, env, 400, 'bad_request');
        upstreamBody = { model: AI_TTS_MODEL, input: { text: t, voice: AI_VOICES.includes(doc.voice) ? doc.voice : 'Maia', language_type: 'Chinese' } };
        upstreamUrl = aiBase(env) + '/api/v1/services/aigc/multimodal-generation/generation';
      }
      // count first, in one statement that also checks both limits, so two calls at once cannot both slip under
      const ins = await env.DB.prepare('INSERT INTO ai_usage (member_id, day, feature, n) SELECT ?1, ?2, ?3, 1 WHERE (SELECT COALESCE(SUM(n), 0) FROM ai_usage WHERE member_id = ?1 AND day = ?2) < ?4 AND (SELECT COALESCE(SUM(n), 0) FROM ai_usage WHERE day = ?2) < ?5 ON CONFLICT(member_id, day, feature) DO UPDATE SET n = n + 1')
        .bind(me.id, day, feature, lim.person, lim.group).run();
      if (!ins.meta || ins.meta.changes !== 1) {
        const mine = await usedBy();
        return fail(req, env, 429, mine >= lim.person ? 'ai_limit' : 'ai_busy');
      }
      const refund = () => env.DB.prepare('UPDATE ai_usage SET n = MAX(0, n - 1) WHERE member_id = ? AND day = ? AND feature = ?').bind(me.id, day, feature).run();
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25000);
      let up, data = null;
      try {
        up = await fetch(upstreamUrl, { method: 'POST', signal: ctl.signal, headers: { Authorization: 'Bearer ' + env.ALI_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(upstreamBody) });
        try { data = await up.json(); } catch (e) { data = null; }
      } catch (e) { await refund(); return reply(req, env, { error: 'upstream', upstream: 0, detail: 'no answer' }, 502); } finally { clearTimeout(timer); }
      if (!up.ok) {
        await refund();
        const detail = String((data && ((data.error && (data.error.message || data.error.code)) || data.message || data.code)) || '').slice(0, 200);
        return reply(req, env, { error: 'upstream', upstream: up.status, detail }, 502);
      }
      const used = await usedBy();
      // old usage rows are dropped now and then (about one call in fifty), so the table stays small
      if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM ai_usage WHERE day < ?').bind(aiDay(env, now - AI_KEEP_DAYS * DAY_MS)).run();
      return reply(req, env, { ai: { used, limit: lim.person, left: Math.max(0, lim.person - used) }, data });
    }
    return fail(req, env, 404, 'not_found');
  }

  // ---- phone reminders ----
  if (path === '/api/push' && req.method === 'GET') {
    const mine = (await env.DB.prepare('SELECT hour, tz FROM push_subs WHERE member_id = ?').bind(me.id).all()).results;
    return reply(req, env, { key: pushReady(env) ? String(env.VAPID_PUBLIC_KEY).trim() : null, subs: mine.length });
  }
  if (path === '/api/push' && (req.method === 'PUT' || req.method === 'DELETE')) {
    const body = await readJson(req, 2048);
    if (body.tooBig) return fail(req, env, 413, 'too_big');
    if (body.bad) return fail(req, env, 400, 'bad_json');
    const v = body.value; const ep = String(v.endpoint || '');
    const hostOk = PUSH_HOSTS.test(ep) || (env.PUSH_TEST_HOST && ep.startsWith(String(env.PUSH_TEST_HOST)));
    if (!hostOk || ep.length > 800) return fail(req, env, 400, 'bad_endpoint');
    if (req.method === 'DELETE') { await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND member_id = ?').bind(ep, me.id).run(); return reply(req, env, { ok: true }); }
    if (!pushReady(env)) return fail(req, env, 503, 'push_not_set_up');
    const b64ok = (x, lo, hi) => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x) && x.length >= lo && x.length <= hi;
    if (!b64ok(v.p256dh, 80, 100) || !b64ok(v.auth, 16, 32)) return fail(req, env, 400, 'bad_keys');
    const tz = String(v.tz || ''); try { localParts(tz, now); } catch (e) { return fail(req, env, 400, 'bad_tz'); }
    const hour = Number.isInteger(v.hour) && v.hour >= 0 && v.hour <= 23 ? v.hour : 19;
    const int = (x, hi) => (Number.isFinite(x) ? Math.max(0, Math.min(hi, Math.round(x))) : 0);
    const studied = typeof v.studied === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.studied) ? v.studied : null;
    await env.DB.prepare('INSERT INTO push_subs (endpoint, member_id, p256dh, auth, hour, tz, n, streak, studied, sent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?) ' +
      'ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, hour = excluded.hour, tz = excluded.tz, n = excluded.n, streak = excluded.streak, studied = COALESCE(excluded.studied, push_subs.studied), updated_at = excluded.updated_at')
      .bind(ep, me.id, v.p256dh, v.auth, hour, tz, int(v.n, 99999), int(v.streak, 99999), studied, now, now).run();
    // at most 5 phones or browsers per person: the ones not seen for longest go
    await env.DB.prepare('DELETE FROM push_subs WHERE member_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE member_id = ? ORDER BY updated_at DESC LIMIT 5)').bind(me.id, me.id).run();
    return reply(req, env, { ok: true });
  }
  if (path === '/api/push/test' && req.method === 'POST') {
    if (!pushReady(env)) return fail(req, env, 503, 'push_not_set_up');
    const rows = (await env.DB.prepare('SELECT * FROM push_subs WHERE member_id = ? ORDER BY updated_at DESC LIMIT 5').bind(me.id).all()).results;
    if (!rows.length) return fail(req, env, 404, 'no_subscription');
    const out = [];
    for (const row of rows) { try { out.push(await pushSend(env, row, { title: 'Reminders are on', body: 'This is how your daily Chinese reminder will look.', url: './', tag: 'shanlu-test' })); } catch (e) { out.push(0); } }
    return reply(req, env, { ok: out.some((c) => c >= 200 && c < 300), status: out });
  }

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
    await env.DB.batch([env.DB.prepare('DELETE FROM cheers WHERE from_id = ? OR to_id = ?').bind(me.id, me.id), env.DB.prepare('DELETE FROM push_subs WHERE member_id = ?').bind(me.id), env.DB.prepare('DELETE FROM progress WHERE member_id = ?').bind(me.id), env.DB.prepare('DELETE FROM ai_block WHERE member_id = ?').bind(me.id), env.DB.prepare('DELETE FROM members WHERE id = ?').bind(me.id)]);
    return reply(req, env, { ok: true });
  }

  return fail(req, env, 404, 'not_found');
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); } catch (e) { return fail(req, env, 500, 'server_error'); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pushTick(env, event && event.scheduledTime ? event.scheduledTime : Date.now()).catch(() => null));
  },
};
