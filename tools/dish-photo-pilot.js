#!/usr/bin/env node
// Small test (no changes to the site): do Flickr (Creative Commons only) and the Chinese local-government
// open-data portals have photos for dishes that Wikimedia Commons could not give us?
// Runs in the "Dish photo test" GitHub Action (the workspace cannot reach these sites). It writes
// pilot-out/report.html (a contact sheet to look at by eye) and pilot-out/report.json, and touches nothing else.
// Flickr needs a free key in the secret FLICKR_API_KEY. Without it the Flickr part is skipped and says so.
'use strict';
const fs = require('fs');
const path = require('path');

// Flickr licence ids we accept: 4 CC BY, 5 CC BY-SA, 9 CC0, 10 public domain mark. (Not NC, ND, or "all rights reserved".)
const OK_LICENSES = { 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 9: 'CC0', 10: 'Public Domain Mark' };
const PORTALS = [
  ['Shandong public data', 'https://data.sd.gov.cn'],
  ['Heze public data', 'http://hzdata.sd.gov.cn'],
  ['Hangzhou data (Lin\'an food)', 'https://data.hangzhou.gov.cn'],
  ['Qingdao public data', 'https://qddata.sd.gov.cn'],
];
const FOOD_WORDS = /food|dish|cuisine|noodle|rice|soup|pork|beef|chicken|duck|fish|dumpling|cake|bun|tofu|restaurant|meal|snack|lunch|dinner|breakfast|菜|面|饭|汤|饺|肉|鱼|鸡|鸭|饼|糕|小吃|美食|火锅|粥/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function getJson(url, opts) {
  const res = await fetch(url, Object.assign({ signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'ShanluDishPilot/1.0 (study site test)' } }, opts));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// the first word(s) of the English name that are the dish itself, e.g. "Luzhou roast duck"
async function flickrSearch(key, text) {
  const q = new URLSearchParams({
    method: 'flickr.photos.search', api_key: key, format: 'json', nojsoncallback: '1',
    text, license: Object.keys(OK_LICENSES).join(','), sort: 'relevance', content_types: '0', media: 'photos',
    safe_search: '1', per_page: '6', extras: 'license,owner_name,tags,url_m,url_n',
  });
  const j = await getJson('https://api.flickr.com/services/rest/?' + q);
  if (j.stat !== 'ok') throw new Error('Flickr: ' + (j.message || j.stat));
  return (j.photos.photo || []).filter(p => OK_LICENSES[p.license] && (p.url_n || p.url_m)).map(p => ({
    id: p.id, title: p.title, owner: p.ownername, license: OK_LICENSES[p.license], tags: String(p.tags || '').slice(0, 120),
    thumb: p.url_n || p.url_m, page: 'https://www.flickr.com/photos/' + p.owner + '/' + p.id,
    // cheap hint only: does the title/tags mention the dish name, or at least food? A person still has to look.
    hint: nameHit(p, text) ? 'name' : FOOD_WORDS.test(p.title + ' ' + (p.tags || '')) ? 'food' : '',
  }));
}

function nameHit(p, text) {
  const hay = (p.title + ' ' + (p.tags || '')).toLowerCase();
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/^(the|and|with|in|of|style|fried|braised|steamed|stewed)$/.test(w));
  return words.length > 0 && words.filter(w => hay.includes(w)).length >= Math.min(2, words.length);
}

async function flickrForDish(key, d) {
  // try the English name, then the Chinese name; stop at the first query that gives something
  for (const [label, text] of [['english', d.en], ['chinese', d.zh], ['english+china', d.en + ' China food']]) {
    try {
      const hits = await flickrSearch(key, text);
      if (hits.length) return { query: label + ': ' + text, hits };
    } catch (e) { return { error: String(e.message || e), hits: [] }; }
    await sleep(350);
  }
  return { hits: [] };
}

async function probePortal([name, url]) {
  const out = { name, url };
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShanluDishPilot/1.0)' } });
    out.status = res.status;
    out.finalUrl = res.url;
    const html = await res.text();
    out.title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '';
    out.foodLinks = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*(?:美食|菜|餐饮|旅游|文旅)[^<]*)</g)].slice(0, 8).map(m => m[2].trim() + ' -> ' + m[1]);
  } catch (e) {
    out.error = String(e.cause && e.cause.code || e.message || e);
  }
  return out;
}

function html(report) {
  let h = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dish photo test</title>' +
    '<style>body{font:15px system-ui;margin:12px;max-width:900px}h2{margin:22px 0 4px}.d{border-top:1px solid #ccc;padding:8px 0}.row{display:flex;gap:8px;overflow-x:auto}' +
    '.c{flex:0 0 150px;font-size:12px}.c img{width:150px;height:110px;object-fit:cover;border-radius:6px;background:#eee}.n{color:#a00}.b{background:#fee;padding:6px;border-radius:6px}</style>';
  h += '<h1>Dish photo test</h1><p>' + esc(report.summary) + '</p><h2>Government portals</h2>';
  for (const p of report.portals) {
    h += '<div class="b"><b>' + esc(p.name) + '</b> ' + esc(p.url) + ': ' + (p.error ? 'could not connect (' + esc(p.error) + ')' : 'HTTP ' + p.status + ', "' + esc(p.title) + '"') +
      (p.foodLinks && p.foodLinks.length ? '<br>links: ' + p.foodLinks.map(esc).join('<br>') : '') + '</div>';
  }
  h += '<h2>Flickr (Creative Commons only)</h2>';
  if (report.flickrSkipped) h += '<p class="n">' + esc(report.flickrSkipped) + '</p>';
  for (const d of report.dishes) {
    h += '<div class="d"><b>' + esc(d.zh) + '</b> ' + esc(d.py) + ' &middot; ' + esc(d.en) + ' <small>(' + esc(d.region) + ')</small>';
    if (d.error) h += '<br><span class="n">' + esc(d.error) + '</span>';
    else if (!d.hits.length) h += '<br><span class="n">nothing found</span>';
    else {
      h += '<br><small>' + esc(d.query) + '</small><div class="row">';
      for (const p of d.hits) h += '<div class="c"><a href="' + esc(p.page) + '"><img loading="lazy" src="' + esc(p.thumb) + '"></a>' + esc(p.title).slice(0, 70) + '<br>' + esc(p.license) + ' &middot; ' + esc(p.owner) + (p.hint ? '<br><b>[' + p.hint + ']</b>' : '') + '</div>';
      h += '</div>';
    }
    h += '</div>';
  }
  return h;
}

async function main() {
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'dish-pilot-sample.json'), 'utf8'));
  const key = process.env.FLICKR_API_KEY || '';
  const report = { portals: [], dishes: [], flickrSkipped: '' };
  for (const p of PORTALS) report.portals.push(await probePortal(p));
  if (!key) report.flickrSkipped = 'No Flickr key (secret FLICKR_API_KEY is empty), so Flickr was not tested.';
  let withAny = 0, withName = 0, withFood = 0;
  for (const d of sample) {
    const r = key ? await flickrForDish(key, d) : { hits: [] };
    report.dishes.push(Object.assign({}, d, r));
    if (r.hits.length) withAny++;
    if (r.hits.some(h => h.hint === 'name')) withName++;
    if (r.hits.some(h => h.hint === 'name' || h.hint === 'food')) withFood++;
    if (key) await sleep(350);
  }
  const reached = report.portals.filter(p => !p.error && p.status < 400).length;
  report.summary = 'Flickr: ' + withAny + '/' + sample.length + ' dishes got at least one CC-licensed candidate; ' + withName + ' with the dish name in the title or tags; ' +
    withFood + ' with a food-looking title. These are candidates to look at, not accepted photos. Portals: ' + reached + '/' + PORTALS.length + ' reachable from GitHub.';
  fs.mkdirSync('pilot-out', { recursive: true });
  fs.writeFileSync('pilot-out/report.json', JSON.stringify(report, null, 1));
  fs.writeFileSync('pilot-out/report.html', html(report));
  console.log(report.summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Dish photo test\n' + report.summary + '\n\n' +
    report.portals.map(p => '- ' + p.name + ': ' + (p.error ? 'no connection (' + p.error + ')' : 'HTTP ' + p.status)).join('\n') + '\n');
}

module.exports = { nameHit, html, OK_LICENSES };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
