#!/usr/bin/env node
/* Finds a photo for each Journey stop on Wikipedia / Wikimedia Commons and writes data/journey-media.js.
 *
 *   node tools/journey-media.js [--region sichuan] [--limit 300] [--retry-misses]
 *
 * The workspace this site is built in cannot reach Wikimedia, so this runs in the "Journey photos" GitHub Action (.github/workflows/journey-media.yml),
 * which can. It is safe to run again and again: stops that already have a photo, or were tried and had none, are skipped.
 *
 * For each stop:
 *   1. Look up the Chinese Wikipedia page with exactly the stop's Chinese name (following redirects). Skip disambiguation pages.
 *   2. For places (cities, sights, airports) the page must have coordinates within 60 km of the stop, so a page that only shares a name is never used.
 *      Dishes and traditions have no coordinates, so they need a page whose picture is a real photo (not an icon), and the first line must not be a disambiguation.
 *   3. Read the licence of the page's main picture on Commons. Only public domain, CC0, CC BY and CC BY-SA are kept; the credit line is
 *      "Author, licence" so the picture can be reused as those licences ask.
 * Entries look like  "sichuan.tPandaBase": { "u": thumbnail address, "c": "Author / CC BY-SA 4.0", "a": alt text }.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'journey-media.js');
const MISS = path.join(__dirname, 'journey-media-misses.json');
const UA = 'ShanluJourneyMedia/1.0 (https://github.com/alvinyu20/hsk-path; study site photo lookup)';
const WIDTH = 500;   // Wikimedia hands out thumbnails only in fixed sizes and rounds up to the next one
const KEEP_LICENCES = /^(public domain|pd\b|cc0|cc[- ]by(?![- ]nc)(?![- ]nd)|cc[- ]by[- ]sa(?![- ]nc)(?![- ]nd))/i;

const km = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) * r / 2), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; };
const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function loadWorld() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'journey.js'), 'utf8'), sandbox);
  const J = require(path.join(ROOT, 'journey.js'));
  return J.build(sandbox.window.JOURNEY);
}
function loadMedia() {
  try { const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(OUT, 'utf8'), sandbox); return sandbox.window.JOURNEY_MEDIA || {}; } catch (e) { return {}; }
}
const loadMisses = () => { try { return JSON.parse(fs.readFileSync(MISS, 'utf8')); } catch (e) { return {}; } };

function makeApi(doFetch) {
  const get = async (base, params) => {
    const url = base + '?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params)).toString();
    for (let tries = 0; tries < 3; tries++) {
      const res = await doFetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (tries + 1))); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    }
    throw new Error('Too many retries for ' + url);
  };
  return {
    page: (title, lang) => get('https://' + (lang || 'zh') + '.wikipedia.org/w/api.php', { action: 'query', titles: title, redirects: '1', prop: 'pageimages|coordinates|pageprops', piprop: 'name|thumbnail', pithumbsize: String(WIDTH), ppprop: 'disambiguation', colimit: '1' }),
    file: (name) => get('https://commons.wikimedia.org/w/api.php', { action: 'query', titles: 'File:' + name, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: String(WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName|Credit|UsageTerms' }),
  };
}

// One page of one Wikipedia: returns { entry } or { miss: 'why' }
async function tryPage(api, stop, lang, title) {
  const q = await api.page(title, lang);
  const page = q && q.query && q.query.pages && q.query.pages[0];
  if (!page || page.missing) return { miss: 'no page' };
  if (page.pageprops && page.pageprops.disambiguation !== undefined) return { miss: 'disambiguation' };
  const places = stop.k === 'T' || stop.k === 'A' || stop.k === 'P';
  if (places) {
    const c = page.coordinates && page.coordinates[0];
    if (!c) return { miss: 'no coordinates' };
    const ll = stop.ll || (stop.lat != null ? [stop.lat, stop.lon] : null);   // stops without their own coordinates are measured from their city
    if (ll && km(ll[0], ll[1], c.lat, c.lon) > 60) return { miss: 'too far (' + Math.round(km(ll[0], ll[1], c.lat, c.lon)) + ' km)' };
  }
  const name = page.pageimage;
  if (!name || !page.thumbnail) return { miss: 'no picture' };
  if (/\.(svg|gif|ogg|ogv|webm)$/i.test(name) || /^(Flag[ _]|Coat[ _]|Map[ _]|Location[ _]|Locator|Emblem[ _]|Logo[ _]|Commons-logo|Wikimedia)/i.test(name)) return { miss: 'icon, flag or map' };
  const f = await api.file(name);
  const info = f && f.query && f.query.pages && f.query.pages[0] && f.query.pages[0].imageinfo && f.query.pages[0].imageinfo[0];
  if (!info) return { miss: 'no file info' };
  const meta = info.extmetadata || {};
  const licence = strip(meta.LicenseShortName && meta.LicenseShortName.value);
  if (!KEEP_LICENCES.test(licence)) return { miss: 'licence ' + (licence || 'unknown') };
  const artist = strip(meta.Artist && meta.Artist.value) || strip(meta.Credit && meta.Credit.value) || 'Wikimedia Commons';
  const credit = (artist.length > 70 ? artist.slice(0, 67) + '...' : artist) + ' / ' + licence;
  const u = String(info.thumburl || page.thumbnail.source).replace(/\?.*$/, '');   // the tracking tail adds nothing
  return { entry: { u, c: credit, a: stop.en } };
}

// The Chinese Wikipedia first (exact Chinese name); when that gives nothing usable, the English page for the English name, held to the same rules.
async function lookup(api, stop) {
  const zh = await tryPage(api, stop, 'zh', stop.zh);
  if (zh.entry || !stop.en) return zh;
  const en = await tryPage(api, stop, 'en', stop.en);
  return en.entry ? en : zh;
}

function writeMedia(media) {
  const keys = Object.keys(media).sort();
  const body = keys.map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(media[k])).join(',\n');
  const head = '/* Photos for Journey stops, filled in by the "Journey photos" GitHub Action (tools/journey-media.js): id -> { u: image address, c: credit line, a: alt text }.\n * Only public-domain and CC BY / CC BY-SA pictures from Wikimedia Commons are used. A stop without an entry shows its characters on a coloured tile. */\n';
  fs.writeFileSync(OUT, head + 'window.JOURNEY_MEDIA = {' + (keys.length ? '\n' + body + '\n' : '') + '};\n');
}

async function run(opts) {
  const o = Object.assign({ fetch: globalThis.fetch, region: '', limit: 300, retryMisses: false, world: null, media: null, misses: null, concurrency: 4, log: console.log, save: true, verify: false }, opts || {});
  const W = o.world || loadWorld();
  const media = o.media || loadMedia(), misses = o.misses || loadMisses();
  const api = makeApi(o.fetch);
  let todo = [];
  const JY = require(path.join(ROOT, 'journey.js'));
  W.regions.forEach((R) => { if (o.region && R.id !== o.region) return; R.stops.forEach((s) => { if (!media[s.id] && (o.retryMisses || !misses[s.id])) { s.ll = JY.pinLatLon(W, s); todo.push(s); } }); });
  todo = todo.slice(0, o.limit);
  o.log('Looking up ' + todo.length + ' stops' + (o.region ? ' in ' + o.region : '') + '.');
  let found = 0, missed = 0, next = 0, failed = 0;
  const worker = async () => {
    while (next < todo.length) {
      const stop = todo[next++];
      try {
        const r = await lookup(api, stop);
        if (r.entry && o.verify) { const v = await o.fetch(r.entry.u, { method: 'HEAD', headers: { 'User-Agent': UA } }).catch(() => null); if (!v || !v.ok || !/^image\//.test((v.headers && v.headers.get && v.headers.get('content-type')) || '')) { delete r.entry; r.miss = 'image does not load'; } }
        if (r.entry) { media[stop.id] = r.entry; delete misses[stop.id]; found++; } else { misses[stop.id] = r.miss; missed++; }
      } catch (e) { failed++; o.log('  error for ' + stop.id + ': ' + e.message); }
      if ((found + missed) % 50 === 0 && o.save) { writeMedia(media); fs.writeFileSync(MISS, JSON.stringify(misses, null, 0) + '\n'); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency, Math.max(1, todo.length)) }, worker));
  if (o.save) { writeMedia(media); fs.writeFileSync(MISS, JSON.stringify(misses, null, 0) + '\n'); }
  o.log('Photos found: ' + found + '. No usable photo: ' + missed + '. Errors (tried again next time): ' + failed + '. Total with a photo: ' + Object.keys(media).length + '.');
  return { media, misses, found, missed, failed };
}

module.exports = { run, lookup, makeApi, strip, km, KEEP_LICENCES, writeMedia };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : ''; };
  run({ region: arg('region'), limit: Number(arg('limit')) || 300, retryMisses: process.argv.includes('--retry-misses'), verify: true }).catch((e) => { console.error(e); process.exit(1); });
}
