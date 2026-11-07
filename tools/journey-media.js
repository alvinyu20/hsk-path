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
 *      If neither gives anything: the search below, then the Japanese Wikipedia (same Chinese names), Wikivoyage (English and Chinese), a Wikidata item whose
 *      English label is exactly the name, and a Commons file search for a file whose title holds the whole name. All held to the same rules.
 *      (Taste Atlas and Wikitravel are not used: their photos are not under an open licence we can verify.)
 *      Airports are different: their photo shows the whole province (the province's Wikipedia picture; failing that the main city's photo), marked "r":1.
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
const TRIED = path.join(__dirname, 'journey-media-tried.json');   // stops already searched with every source, so a re-run does not repeat them
const UA = 'ShanluJourneyMedia/1.0 (https://github.com/alvinyu20/hsk-path; study site photo lookup)';
let SLOW = true;   // tests switch the waiting off with setSlow(false)
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
const loadTried = () => { try { return JSON.parse(fs.readFileSync(TRIED, 'utf8')); } catch (e) { return {}; } };
const loadMisses = () => { try { return JSON.parse(fs.readFileSync(MISS, 'utf8')); } catch (e) { return {}; } };

const HOSTS = { voyen: 'https://en.wikivoyage.org', voyzh: 'https://zh.wikivoyage.org' };   // Wikivoyage pictures are Commons files too, so they get the same licence check

function makeApi(doFetch) {
  const get = async (base, params) => {
    const url = base + '?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params)).toString();
    for (let tries = 0; tries < 6; tries++) {
      const res = await doFetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) {   // told to slow down: wait as long as asked, or longer each time
        const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        await new Promise((r) => setTimeout(r, (ra > 0 && ra < 120 ? ra * 1000 : 2000 * (tries + 1) * (tries + 1)) * (SLOW ? 1 : 0.001)));
        continue;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    }
    throw new Error('Too many retries for ' + url);
  };
  return {
    page: (title, lang) => get((HOSTS[lang || 'zh'] || ('https://' + lang + '.wikipedia.org')) + '/w/api.php', { action: 'query', titles: title, redirects: '1', prop: 'pageimages|coordinates|pageprops', piprop: 'name|thumbnail', pithumbsize: String(WIDTH), ppprop: 'disambiguation|wikibase_item', colimit: '1' }),
    search: (text, lang) => get('https://' + lang + '.wikipedia.org/w/api.php', { action: 'query', list: 'search', srsearch: text, srnamespace: '0', srlimit: '5', srprop: '' }),
    cats: (titles) => get('https://commons.wikimedia.org/w/api.php', { action: 'query', titles: titles.join('|'), prop: 'categories', cllimit: 'max' }),
    images: (title, lang) => get((HOSTS[lang] || ('https://' + lang + '.wikipedia.org')) + '/w/api.php', { action: 'query', titles: title, redirects: '1', prop: 'images', imlimit: '40' }),
    wdsearch: (text) => get('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: text, language: 'en', uselang: 'en', type: 'item', limit: '5' }),
    cfiles: (text) => get('https://commons.wikimedia.org/w/api.php', { action: 'query', list: 'search', srsearch: text, srnamespace: '6', srlimit: '8', srprop: '' }),
    wikidata: (qid) => get('https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: qid, props: 'claims', languages: 'en' }),
    file: (name) => get('https://commons.wikimedia.org/w/api.php', { action: 'query', titles: 'File:' + name, prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|mime', iiurlwidth: String(WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName|Credit|UsageTerms' }),
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
    let c = page.coordinates && page.coordinates[0];
    if (!c && page.pageprops && page.pageprops.wikibase_item) {   // the page has no coordinates of its own: take them from its Wikidata item
      const w = await api.wikidata(page.pageprops.wikibase_item).catch(() => null);
      const ent = w && w.entities && w.entities[page.pageprops.wikibase_item];
      const v = ent && ent.claims && ent.claims.P625 && ent.claims.P625[0] && ent.claims.P625[0].mainsnak && ent.claims.P625[0].mainsnak.datavalue && ent.claims.P625[0].mainsnak.datavalue.value;
      if (v && typeof v.latitude === 'number') c = { lat: v.latitude, lon: v.longitude };
    }
    if (!c) return { miss: 'no coordinates' };
    const ll = stop.ll || (stop.lat != null ? [stop.lat, stop.lon] : null);   // stops without their own coordinates are measured from their city
    if (ll && km(ll[0], ll[1], c.lat, c.lon) > 60) return { miss: 'too far (' + Math.round(km(ll[0], ll[1], c.lat, c.lon)) + ' km)' };
  }
  const name = page.pageimage;
  if (!name || !page.thumbnail) return { miss: 'no picture' };
  const first = await fileEntry(api, name, stop.en, { fallback: page.thumbnail.source, dish: stop.k === 'D' });
  if (first.entry || stop.k !== 'D' || first.miss !== 'not a dish photo') return first;
  // the lead picture is not the dish (a plant, an ingredient): look through the page's other pictures for one that is
  const im = await api.images(page.title || title, lang).catch(() => null);
  const ip = im && im.query && im.query.pages && im.query.pages[0];
  const cands = ((ip && ip.images) || []).map((x) => nm(x.title)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n) && !NOT_A_PHOTO.test(n) && n !== nm(name)).slice(0, 30);
  if (!cands.length) return first;
  const fl = await foodFlags(api, cands).catch(() => ({}));
  for (const n of cands.filter((n) => fl[n]).slice(0, 2)) { const r = await fileEntry(api, n, stop.en, { dish: true, checked: true }); if (r.entry) return r; }
  return first;
}

const NOT_A_PHOTO = /\.(svg|gif|ogg|ogv|webm|pdf|tiff?)$|^(Flag[ _]|Coat[ _]|Map[ _]|Location[ _]|Locator|Emblem[ _]|Logo[ _]|Commons-logo|Wikimedia)/i;

// One Commons file: refuses icons, maps and anything but the four open licences; builds the credit line "Author / licence".
// o.ll = [lat, lon] makes a file that carries its own coordinates prove it is near the stop.
async function fileEntry(api, name, alt, o) {
  o = o || {};
  if (NOT_A_PHOTO.test(name)) return { miss: 'icon, flag or map' };
  const f = await api.file(name);
  const fp = f && f.query && f.query.pages && f.query.pages[0];
  const info = fp && fp.imageinfo && fp.imageinfo[0];
  if (!info) return { miss: 'no file info' };
  const fc = fp.coordinates && fp.coordinates[0];
  if (o.ll && fc && km(o.ll[0], o.ll[1], fc.lat, fc.lon) > 60) return { miss: 'too far (' + Math.round(km(o.ll[0], o.ll[1], fc.lat, fc.lon)) + ' km)' };
  const meta = info.extmetadata || {};
  const licence = strip(meta.LicenseShortName && meta.LicenseShortName.value);
  if (!KEEP_LICENCES.test(licence)) return { miss: 'licence ' + (licence || 'unknown') };
  const artist = strip(meta.Artist && meta.Artist.value) || strip(meta.Credit && meta.Credit.value) || 'Wikimedia Commons';
  const credit = (artist.length > 70 ? artist.slice(0, 67) + '...' : artist) + ' / ' + licence;
  const u = String(info.thumburl || o.fallback || '').replace(/\?.*$/, '');   // the tracking tail adds nothing
  if (!u) return { miss: 'no file info' };
  if (o.dish && !o.checked) { const fl = await foodFlags(api, [name]).catch(() => null); if (!fl || !fl[name]) return { miss: 'not a dish photo' }; }
  return { entry: Object.assign({ u, c: credit, a: alt }, o.dish ? { f: 1 } : {}) };
}

// Is this Commons file a picture of a prepared dish? A dish's Wikipedia page often leads with the plant, animal or ingredient (oats for oat noodles),
// so for dishes the file's Commons categories (and their parents) must name food, and must not name plants, animals or farming.
const FOOD_CAT = /\b(foods?|dish(es)?|cuisines?|cooking|meals?|noodles?|dumplings?|soups?|stews?|congee|porridge|breads?|buns?|cakes?|pastr(y|ies)|pancakes?|snacks?|desserts?|tofu|hot ?pots?|barbecue|kebabs?|skewers?|baozi|jiaozi|mantou|breakfast|delicacies|sweets|confection(ery)?|pudding|biscuits?|cookies?|bakery|sandwich(es)?|pickled|sausages?|sauces?|roast(ed)?|fried|braised|steamed|grilled|street food|cuisine)\b/i;
const NOT_FOOD_CAT = /\b(taxa|taxon|species|plants?|flora|crops?|botanical|botany|trees?|flowers?|vegetation|agriculture|farms?|farming|fields?|fauna|animals?|fish of|fishes|birds?|mammals?|insects?|aquaculture|fishing|vineyards?|plantations?)\b/i;
const nm = (t) => String(t || '').replace(/^(File|Category):/, '').replace(/_/g, ' ').trim();
async function foodFlags(api, names) {   // names -> { name: true|false }
  const out = {}, l1 = {};
  const catsOf = async (titles) => {   // 'File:x' or 'Category:x' titles -> { title without prefix: [category names] }
    const res = {};
    for (let i = 0; i < titles.length; i += 40) {
      const q = await api.cats(titles.slice(i, i + 40)).catch(() => null);
      ((q && q.query && q.query.pages) || []).forEach((p) => { res[nm(p.title)] = (p.categories || []).map((c) => nm(c.title)); });
    }
    return res;
  };
  const c1 = await catsOf(names.map((n) => 'File:' + nm(n)));
  const need = {};
  names.forEach((n) => {
    const cs = c1[nm(n)] || []; l1[n] = cs;
    if (cs.some((c) => NOT_FOOD_CAT.test(c))) out[n] = false;
    else if (cs.some((c) => FOOD_CAT.test(c))) out[n] = true;
    else cs.forEach((c) => { need[c] = 1; });
  });
  const parents = Object.keys(need).length ? await catsOf(Object.keys(need).map((c) => 'Category:' + c)) : {};
  names.forEach((n) => {
    if (out[n] !== undefined) return;
    const ps = [].concat(...l1[n].map((c) => parents[c] || []));
    out[n] = !ps.some((c) => NOT_FOOD_CAT.test(c)) && ps.some((c) => FOOD_CAT.test(c));
  });
  return out;
}

const isPlace = (stop) => stop.k === 'T' || stop.k === 'A' || stop.k === 'P';
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
const hasWhole = (title, name) => (' ' + norm(title) + ' ').includes(' ' + norm(name) + ' ');   // whole words, so "Tai" never matches "Taiwan"

// Wikidata: an item whose English label is exactly the stop's name and that has a picture. Places must also lie within 60 km.
async function viaWikidata(api, stop) {
  const q = await api.wdsearch(stop.en).catch(() => null);
  const hits = ((q && q.search) || []).filter((h) => norm(h.label) === norm(stop.en) && !/disambiguation/i.test(h.description || '')).slice(0, 3);
  let last = { miss: 'no wikidata item' };
  for (const h of hits) {
    const w = await api.wikidata(h.id).catch(() => null);
    const cl = w && w.entities && w.entities[h.id] && w.entities[h.id].claims;
    const claim = (p) => cl && cl[p] && cl[p][0] && cl[p][0].mainsnak && cl[p][0].mainsnak.datavalue && cl[p][0].mainsnak.datavalue.value;
    const img = claim('P18');
    if (typeof img !== 'string') continue;
    if (isPlace(stop)) {
      const c = claim('P625');
      if (!c || typeof c.latitude !== 'number') { last = { miss: 'no coordinates' }; continue; }
      if (stop.ll && km(stop.ll[0], stop.ll[1], c.latitude, c.longitude) > 60) { last = { miss: 'too far' }; continue; }
    }
    const r = await fileEntry(api, img, stop.en, { dish: stop.k === 'D' });
    if (r.entry) return r; last = r;
  }
  return last;
}

// Commons itself: a file whose title holds the stop's whole English (or Chinese) name. Names that are too short or generic are not trusted.
async function viaCommons(api, stop) {
  let last = { miss: 'no commons file' };
  for (const name of [stop.en, stop.zh]) {
    const n = norm(name); const zhName = /[\u4e00-\u9fff]/.test(name || '');
    if (!n || (zhName ? n.length < 3 : n.length < 6)) continue;
    if (isPlace(stop) && !zhName && (n.length < 10 || n.indexOf(' ') < 0)) continue;   // a place needs a distinctive name, since it cannot be checked against a page
    const q = await api.cfiles(name).catch(() => null);
    const titles = ((q && q.query && q.query.search) || []).map((h) => String(h.title || '').replace(/^File:/, '')).filter((t) => /\.(jpe?g|png|webp)$/i.test(t) && hasWhole(t.replace(/\.[a-z]+$/i, ''), name)).slice(0, 3);
    for (const t of titles) {
      const r = await fileEntry(api, t, stop.en, { ll: isPlace(stop) ? stop.ll : null, dish: stop.k === 'D' });
      if (r.entry) return r; last = r;
    }
  }
  return last;
}

// The Chinese Wikipedia first (exact Chinese name); when that gives nothing usable, the English page for the English name, held to the same rules.
// Then, still with the same rules: a search, the Japanese Wikipedia (it shares the Chinese names), Wikivoyage, Wikidata, and a Commons file search.
async function lookup(api, stop) {
  const zh = await tryPage(api, stop, 'zh', stop.zh);
  if (zh.entry || !stop.en) return zh;
  const en = await tryPage(api, stop, 'en', stop.en);
  if (en.entry) return en;
  // a search, but only pages whose title contains the stop's whole name, and held to the same rules (places must lie within 60 km)
  for (const [lang, name] of [['zh', stop.zh], ['en', stop.en]]) {
    if (!name || name.length < 2) continue;
    const q = await api.search(name, lang).catch(() => null);
    const hits = (q && q.query && q.query.search) || [];
    const low = name.toLowerCase();
    const cands = hits.map((h) => h.title).filter((t) => t.toLowerCase().includes(low) && t.toLowerCase() !== low).slice(0, 2);
    for (const t of cands) { const r = await tryPage(api, stop, lang, t); if (r.entry) return r; }
  }
  for (const [lang, name] of [['ja', stop.zh], ['voyen', stop.en], ['voyzh', stop.zh]]) {
    const r = await tryPage(api, stop, lang, name).catch(() => null);
    if (r && r.entry) return r;
  }
  const wd = await viaWikidata(api, stop); if (wd.entry) return wd;
  const cm = await viaCommons(api, stop); if (cm.entry) return cm;
  return zh;
}

// Airports: one photo for the whole province (its own Wikipedia page, never a map, flag or the airport itself); failing that, the main city's photo.
const PROVINCE_PAGES = { anhui: ['安徽省', 'Anhui'], fujian: ['福建省', 'Fujian'], gansu: ['甘肃省', 'Gansu'], guangdong: ['广东省', 'Guangdong'], guangxi: ['广西壮族自治区', 'Guangxi'], guizhou: ['贵州省', 'Guizhou'], hainan: ['海南省', 'Hainan'], hebei: ['河北省', 'Hebei'], heilongjiang: ['黑龙江省', 'Heilongjiang'], henan: ['河南省', 'Henan'], hongkong: ['香港', 'Hong Kong'], hubei: ['湖北省', 'Hubei'], hunan: ['湖南省', 'Hunan'], jiangsu: ['江苏省', 'Jiangsu'], jiangxi: ['江西省', 'Jiangxi'], jilin: ['吉林省', 'Jilin'], liaoning: ['辽宁省', 'Liaoning'], macau: ['澳门', 'Macau'], neimenggu: ['内蒙古自治区', 'Inner Mongolia'], ningxia: ['宁夏回族自治区', 'Ningxia'], qinghai: ['青海省', 'Qinghai'], shaanxi: ['陕西省', 'Shaanxi'], shandong: ['山东省', 'Shandong'], shanxi: ['山西省', 'Shanxi'], sichuan: ['四川省', 'Sichuan'], singapore: ['新加坡', 'Singapore'], taiwan: ['台湾', 'Taiwan'], xinjiang: ['新疆维吾尔自治区', 'Xinjiang'], xizang: ['西藏自治区', 'Tibet'], yunnan: ['云南省', 'Yunnan'], zhejiang: ['浙江省', 'Zhejiang'] };
async function regionPhoto(api, R) {
  const t = PROVINCE_PAGES[R.id] || [R.zh, R.en];
  for (const [lang, title] of [['zh', t[0]], ['en', t[1]]]) {
    const q = await api.page(title, lang).catch(() => null);
    const page = q && q.query && q.query.pages && q.query.pages[0];
    if (!page || page.missing || !page.pageimage || !page.thumbnail) continue;
    if (/\b(map|location|locator|flag|emblem|logo|seal|skyline|montage|collage)\b/i.test(page.pageimage.replace(/[_.]/g, ' '))) continue;
    const r = await fileEntry(api, page.pageimage, R.en, { fallback: page.thumbnail.source });
    if (r.entry) { r.entry.r = 1; return r; }
  }
  return { miss: 'no province photo' };
}

function writeMedia(media) {
  const keys = Object.keys(media).sort();
  const body = keys.map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(media[k])).join(',\n');
  const head = '/* Photos for Journey stops, filled in by the "Journey photos" GitHub Action (tools/journey-media.js): id -> { u: image address, c: credit line, a: alt text }.\n * Only public-domain and CC BY / CC BY-SA pictures from Wikimedia Commons are used. A stop without an entry shows its characters on a coloured tile. */\n';
  fs.writeFileSync(OUT, head + 'window.JOURNEY_MEDIA = {' + (keys.length ? '\n' + body + '\n' : '') + '};\n');
}

async function run(opts) {
  const o = Object.assign({ fetch: globalThis.fetch, region: '', limit: 300, retryMisses: false, world: null, media: null, misses: null, tried: null, concurrency: 3, log: console.log, save: true, verify: false }, opts || {});
  const W = o.world || loadWorld();
  const media = o.media || loadMedia(), misses = o.misses || loadMisses(), tried = o.tried || loadTried();
  const saveAll = () => { writeMedia(media); fs.writeFileSync(MISS, JSON.stringify(misses, null, 0) + '\n'); fs.writeFileSync(TRIED, JSON.stringify(tried, null, 0) + '\n'); };
  const api = makeApi(o.fetch);
  let todo = [];
  const JY = require(path.join(ROOT, 'journey.js'));
  // dish photos found before the food check existed: keep the ones whose categories say food, send the rest back to be looked up again
  const dishes = [];
  W.regions.forEach((R) => R.stops.forEach((s) => { if (s.k === 'D' && media[s.id] && !media[s.id].f && (!o.region || R.id === o.region)) dishes.push(s.id); }));
  if (dishes.length) {
    const fileOf = (u) => { const m = /\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//.exec(u) || /\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)$/.exec(u); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } };
    const named = dishes.filter((id) => fileOf(media[id].u));
    const fl = await foodFlags(api, Array.from(new Set(named.map((id) => fileOf(media[id].u))))).catch((e) => { o.log('  food check failed: ' + e.message); return null; });
    let kept = 0, dropped = 0;
    if (fl) named.forEach((id) => { if (fl[fileOf(media[id].u)]) { media[id].f = 1; kept++; } else { delete media[id]; delete tried[id]; delete misses[id]; dropped++; } });
    o.log('Dish photos checked: ' + kept + ' show a dish, ' + dropped + ' do not and will be looked up again.');
  }
  const regionOf = {};
  W.regions.forEach((R) => {
    if (o.region && R.id !== o.region) return;
    R.stops.forEach((s) => {
      regionOf[s.id] = R;
      if (s.k === 'P') { if (!(media[s.id] && media[s.id].r) && (o.retryMisses || !tried[s.id])) { s.ll = null; todo.push(s); } return; }   // an airport's photo shows the whole province
      if (!media[s.id] && (o.retryMisses ? !tried[s.id] : !misses[s.id])) { s.ll = JY.pinLatLon(W, s); todo.push(s); }
    });
  });
  todo = todo.slice(0, o.limit);
  o.log('Looking up ' + todo.length + ' stops' + (o.region ? ' in ' + o.region : '') + '.');
  let found = 0, missed = 0, next = 0, failed = 0; const provinces = {};
  const worker = async () => {
    while (next < todo.length) {
      const stop = todo[next++];
      try {
        let r;
        if (stop.k === 'P') {
          const R = regionOf[stop.id]; provinces[R.id] = provinces[R.id] || regionPhoto(api, R);
          r = await provinces[R.id];
          if (!r.entry) { const c = R.cities[0] && R.cities[0].first && media[R.cities[0].first.id]; if (c) r = { entry: { u: c.u, c: c.c, a: R.en, r: 1 } }; }
        } else r = await lookup(api, stop);
        if (r.entry && o.verify) { const v = await o.fetch(r.entry.u, { method: 'HEAD', headers: { 'User-Agent': UA } }).catch(() => null); if (!v || !v.ok || !/^image\//.test((v.headers && v.headers.get && v.headers.get('content-type')) || '')) { delete r.entry; r.miss = 'image does not load'; } }
        if (r.entry) { media[stop.id] = r.entry; delete misses[stop.id]; found++; } else { misses[stop.id] = r.miss; missed++; }
        tried[stop.id] = 1;
      } catch (e) { failed++; o.log('  error for ' + stop.id + ': ' + e.message); }
      if ((found + missed) % 50 === 0 && o.save) saveAll();
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency, Math.max(1, todo.length)) }, worker));
  if (o.save) saveAll();
  o.log('Photos found: ' + found + '. No usable photo: ' + missed + '. Errors (tried again next time): ' + failed + '. Total with a photo: ' + Object.keys(media).length + '.');
  return { media, misses, tried, found, missed, failed };
}

module.exports = { setSlow: (v) => { SLOW = v; }, run, lookup, makeApi, strip, km, KEEP_LICENCES, writeMedia };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : ''; };
  run({ region: arg('region'), limit: Number(arg('limit')) || 300, retryMisses: process.argv.includes('--retry-misses'), verify: true }).catch((e) => { console.error(e); process.exit(1); });
}
