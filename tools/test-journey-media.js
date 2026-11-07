/* Tests for the photo finder (tools/journey-media.js) with Wikimedia pretended, since this workspace cannot reach it.   node tools/test-journey-media.js */
const J = require('./journey-media');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };

(async () => {
  J.setSlow(false);
  const pages = {
    '成都': { title: '成都', pageimage: 'Chengdu.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Chengdu.jpg/640px-Chengdu.jpg' }, coordinates: [{ lat: 30.66, lon: 104.06 }] },
    '宽窄巷子': { title: '宽窄巷子', pageimage: 'Lane.jpg', thumbnail: { source: 'x' }, coordinates: [{ lat: 39.9, lon: 116.4 }] },            // the right name, but in Beijing
    '麻婆豆腐': { title: '麻婆豆腐', pageimage: 'Mapo.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Mapo.jpg/640px-Mapo.jpg' } },
    '火锅': { title: '火锅', pageimage: 'Pot.jpg', thumbnail: { source: 'y' } },                                                                // licence not allowed
    '川剧': { title: '川剧', pageprops: { disambiguation: '' } },
    '熊猫基地': { missing: true },
    '锦里古街': { title: '锦里古街', pageimage: 'Jinli.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Jinli.jpg/500px-Jinli.jpg' }, pageprops: { wikibase_item: 'Q1' } },   // no coordinates on the page, but on Wikidata
    '四川甜皮鸭': { title: '四川甜皮鸭', pageimage: 'Duck.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Duck.jpg/500px-Duck.jpg' } },
    '莜面': { title: '莜面', pageimage: 'Oat_plant.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Oat_plant.jpg/500px-Oat_plant.jpg' } },
    '植物面': { title: '植物面', pageimage: 'Plant2.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Plant2.jpg/500px-Plant2.jpg' } },
    '都江堰': { title: '都江堰', pageimage: 'Map_of_Dujiangyan.svg', thumbnail: { source: 'z' }, coordinates: [{ lat: 31.0, lon: 103.6 }] },
  };
  const files = {
    'Chengdu.jpg': { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/Chengdu.jpg/640px-Chengdu.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane &amp; Co</a>' } } },
    'Mapo.jpg': { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/Mapo.jpg/640px-Mapo.jpg', extmetadata: { LicenseShortName: { value: 'Public domain' }, Artist: { value: 'Someone' } } },
    'Pot.jpg': { url: 'u', extmetadata: { LicenseShortName: { value: 'CC BY-NC 2.0' }, Artist: { value: 'A' } } },
  };
  const enPages = { 'Tea house': { title: 'Tea house', pageimage: 'Tea.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Tea.jpg/500px-Tea.jpg?utm_source=x' }, coordinates: [{ lat: 30.66, lon: 104.06 }] }, 'Broken pic': { title: 'Broken pic', pageimage: 'Broken.jpg', thumbnail: { source: 'x' } } };
  files['Tea.jpg'] = { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/Tea.jpg/500px-Tea.jpg?utm_source=x', extmetadata: { LicenseShortName: { value: 'CC BY 2.0' }, Artist: { value: 'T' } } };
  files['Broken.jpg'] = { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/broken.jpg', extmetadata: { LicenseShortName: { value: 'CC0' }, Artist: { value: 'B' } } };
  files['Jinli.jpg'] = { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/Jinli.jpg/500px-Jinli.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 3.0' }, Artist: { value: 'J' } } };
  files['Duck.jpg'] = { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/Duck.jpg/500px-Duck.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'D' } } };
  const add = (n, lic) => { files[n] = { url: 'u', thumburl: 'https://upload.wikimedia.org/thumb/' + n + '/500px-' + n, extmetadata: { LicenseShortName: { value: lic || 'CC BY 4.0' }, Artist: { value: 'P' } } }; };
  ['Imaginary Dumpling Soup 01.jpg', 'WDN.jpg', 'Ja.jpg', 'Voy.jpg', 'Sichuan_view.jpg'].forEach((n) => add(n));
  ['Oat_plant.jpg', 'Youmian dish.jpg', 'Plant2.jpg', 'Xiaolong steamer.jpg'].forEach((n) => add(n));
  // Commons categories of files, and parents of categories
  const CATS = { 'Mapo.jpg': ['Mapo doufu dishes'], 'Duck.jpg': ['Duck dishes'], 'WDN.jpg': ['Noodle dishes'], 'Ja.jpg': ['Japanese food'], 'Broken.jpg': ['Dishes'], 'Imaginary Dumpling Soup 01.jpg': ['Soups'],
    'Oat plant.jpg': ['Avena sativa'], 'Youmian dish.jpg': ['Chinese noodle dishes'], 'Plant2.jpg': ['Some plant'], 'Soup2.jpg': ['Soups'], 'Other dish.jpg': ['Dishes'], 'Xiaolong steamer.jpg': ['Chinese soup dumplings'], 'Plant.jpg': ['Avena sativa'], 'Unknown.jpg': ['Misc'] };
  const PARENTS = { 'Avena sativa': ['Avena', 'Cereal crops'], 'Some plant': ['Plants by name'], 'Misc': ['Things'] };
  const IMAGES = { '莜面': ['File:Oat_plant.jpg', 'File:Icon.svg', 'File:Youmian dish.jpg'] };
  const calls = [];
  const fake = async (url) => {
    calls.push(url); const u = new URL(url); const t = u.searchParams.get('titles');
    if (u.searchParams.get('prop') === 'categories') return { ok: true, status: 200, json: async () => ({ query: { pages: t.split('|').map((x) => { const nmx = x.replace(/^(File|Category):/, '').replace(/_/g, ' '); const list = /^File:/.test(x) ? CATS[nmx] : PARENTS[nmx]; return { title: x.replace(/_/g, ' '), categories: (list || []).map((c) => ({ title: 'Category:' + c })) }; }) } }) };
    if (u.searchParams.get('prop') === 'images') return { ok: true, status: 200, json: async () => ({ query: { pages: [{ title: t, images: (IMAGES[t] || []).map((x) => ({ title: x })) }] } }) };
    if (u.searchParams.get('action') === 'wbsearchentities') { const q = u.searchParams.get('search'); return { ok: true, status: 200, json: async () => ({ search: q === 'Wikidata Noodle' ? [{ id: 'Q9', label: 'Wikidata Noodle', description: 'a noodle' }] : q === 'Wrong Item Soup' ? [{ id: 'Q8', label: 'Wrong Item Soup', description: 'Wikimedia disambiguation page' }] : [] }) }; }
    if (/wikidata\.org/.test(u.hostname) && u.searchParams.get('action') === 'wbgetentities' && u.searchParams.get('ids') === 'Q9') return { ok: true, status: 200, json: async () => ({ entities: { Q9: { claims: { P18: [{ mainsnak: { datavalue: { value: 'WDN.jpg' } } }] } } } }) };
    if (/wikidata\.org/.test(u.hostname)) return { ok: true, status: 200, json: async () => ({ entities: { Q1: { claims: { P625: [{ mainsnak: { datavalue: { value: { latitude: 30.65, longitude: 104.05 } } } }] } } } }) };
    if (!/wikipedia\.org|wikivoyage\.org|commons\.wikimedia\.org/.test(u.hostname)) return { ok: !/broken/.test(url), status: 200, headers: { get: () => 'image/jpeg' } };   // an image address
    if (u.searchParams.get('list') === 'search' && u.hostname === 'commons.wikimedia.org') { const q = u.searchParams.get('srsearch'); if (/^deepcat:"Chinese cuisine" Xiaolong Special$/.test(q)) return { ok: true, status: 200, json: async () => ({ query: { search: [{ title: 'File:Other dish.jpg' }, { title: 'File:Xiaolong steamer.jpg' }] } }) }; return { ok: true, status: 200, json: async () => ({ query: { search: q === 'Imaginary Dumpling Soup' ? [{ title: 'File:Soup of the day.jpg' }, { title: 'File:Imaginary Dumpling Soup 01.jpg' }, { title: 'File:Imaginary Dumpling Soup map.svg' }] : [] } }) }; }
    if (u.searchParams.get('list') === 'search') { const q = u.searchParams.get('srsearch'); return { ok: true, status: 200, json: async () => ({ query: { search: q === '甜皮鸭' ? [{ title: '四川甜皮鸭' }, { title: '甜皮鸭' }] : [] } }) }; }
    if (u.hostname === 'ja.wikipedia.org') return { ok: true, status: 200, json: async () => ({ query: { pages: [t === '日本菜' ? { title: t, pageimage: 'Ja.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Ja.jpg/500px-Ja.jpg' } } : { title: t, missing: true }] } }) };
    if (u.hostname === 'en.wikivoyage.org') return { ok: true, status: 200, json: async () => ({ query: { pages: [t === 'Voyage Lane' ? { title: t, pageimage: 'Voy.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Voy.jpg/500px-Voy.jpg' }, coordinates: [{ lat: 30.66, lon: 104.05 }] } : { title: t, missing: true }] } }) };
    if (u.hostname === 'zh.wikivoyage.org') return { ok: true, status: 200, json: async () => ({ query: { pages: [{ title: t, missing: true }] } }) };
    if (u.hostname === 'en.wikipedia.org' && (t === 'Sichuan' || t === 'Mapland')) return { ok: true, status: 200, json: async () => ({ query: { pages: [t === 'Sichuan' ? { title: t, pageimage: 'Sichuan_view.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Sichuan_view.jpg/500px-Sichuan_view.jpg' } } : { title: t, pageimage: 'Mapland_location_map.png', thumbnail: { source: 'm' } }] } }) };
    if (u.hostname.startsWith('en.')) return { ok: true, status: 200, json: async () => ({ query: { pages: [enPages[t] || { title: t, missing: true }] } }) };
    const body = u.hostname.startsWith('zh.') ? { query: { pages: [pages[t] || { title: t, missing: true }] } } : { query: { pages: [{ imageinfo: [files[t.replace(/^File:/, '')]] }] } };
    return { ok: true, status: 200, json: async () => body };
  };
  const stop = (id, k, zh, en, lat, lon) => ({ id, k, zh, en, lat, lon, ll: lat == null ? null : [lat, lon] });
  const world = { byCity: {}, regions: [{ id: 'sichuan', stops: [stop('s.a', 'T', '成都', 'Chengdu', 30.67, 104.07), stop('s.b', 'A', '宽窄巷子', 'Wide and Narrow Alley', 30.67, 104.06), stop('s.c', 'D', '麻婆豆腐', 'Mapo tofu'), stop('s.d', 'D', '火锅', 'Hot pot'), stop('s.e', 'C', '川剧', 'Sichuan opera'), stop('s.f', 'A', '熊猫基地', 'Panda base', 30.7, 104.1), stop('s.g', 'A', '都江堰', 'Dujiangyan', 31.0, 103.6), stop('s.h', 'D', '回锅肉', 'Twice-cooked pork'), stop('s.i', 'A', '鹤鸣茶社', 'Tea house', 30.67, 104.06), stop('s.j', 'D', '烂图', 'Broken pic'), stop('s.k', 'A', '锦里古街', 'Jinli Ancient Street', 30.65, 104.05), stop('s.l', 'D', '甜皮鸭', 'Sweet-skin duck'),
    stop('s.m', 'D', '无页汤', 'Imaginary Dumpling Soup'), stop('s.n', 'D', '无页面', 'Wikidata Noodle'), stop('s.o', 'D', '日本菜', 'Japan only dish'), stop('s.p', 'A', '游记巷', 'Voyage Lane', 30.67, 104.06), stop('s.q', 'D', '错项汤', 'Wrong Item Soup'), stop('s.r', 'D', '莜面', 'Oat noodles'), stop('s.w', 'D', '小笼', 'Xiaolong Special'), stop('s.t', 'D', '植物面', 'Plant noodles'), stop('s.u', 'D', '旧图', 'Old picture dish'), stop('s.v', 'D', '好图', 'Good old dish'),
    Object.assign(stop('s.air', 'P', '成都天府国际机场', 'Chengdu Tianfu International Airport'), { ll: null })], zh: '四川', en: 'Sichuan', cities: [{ first: { id: 's.a' } }] },
    { id: 'mapland', zh: '地图国', en: 'Mapland', cities: [{ first: { id: 's.a' } }], stops: [Object.assign(stop('m.air', 'P', '地图机场', 'Map Airport'), { ll: null })] }] };
  const logs = [];
  const r = await J.run({ fetch: fake, world, media: { 's.air': { u: 'https://upload.wikimedia.org/old-airport.jpg', c: 'x', a: 'old' }, 's.u': { u: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Plant.jpg/500px-Plant.jpg', c: 'x', a: 'o' }, 's.v': { u: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Soup2.jpg/500px-Soup2.jpg', c: 'x', a: 'g' } }, misses: {}, tried: {}, save: false, verify: true, log: (m) => logs.push(m) });
  ok(Object.keys(r.media).sort().join() === 'm.air,s.a,s.air,s.c,s.i,s.k,s.l,s.m,s.n,s.o,s.p,s.r,s.v,s.w', 'only the right pictures are kept: ' + Object.keys(r.media));
  ok(/Imaginary/.test(r.media['s.m'].u) && !/map|Soup of the day/.test(r.media['s.m'].u), 'a Commons file search takes the file whose title holds the whole name (not other files, not an svg): ' + (r.media['s.m'] && r.media['s.m'].u));
  ok(r.media['s.n'] && /WDN/.test(r.media['s.n'].u), 'a Wikidata item with exactly that label supplies its picture');
  ok(!r.media['s.q'], 'a Wikidata disambiguation item is not used');
  ok(r.media['s.o'] && /Ja\.jpg/.test(r.media['s.o'].u), 'the Japanese Wikipedia is tried with the Chinese name');
  ok(r.media['s.p'] && /Voy\.jpg/.test(r.media['s.p'].u), 'Wikivoyage is tried with the English name, with the same distance rule');
  ok(r.media['s.air'].r === 1 && /Sichuan_view/.test(r.media['s.air'].u) && r.media['s.air'].a === 'Sichuan', 'an airport shows the province-wide photo, replacing the old airport photo: ' + JSON.stringify(r.media['s.air']));
  ok(r.media['m.air'] && r.media['m.air'].r === 1 && /Chengdu/.test(r.media['m.air'].u), 'when the province page only has a map, the main city photo stands in');
  ok(r.media['s.r'] && /Youmian dish/.test(r.media['s.r'].u) && r.media['s.r'].f === 1, 'a dish whose lead picture is a plant takes another picture from the page that is food: ' + (r.media['s.r'] && r.media['s.r'].u));
  ok(r.media['s.w'] && /Xiaolong/.test(r.media['s.w'].u) && r.media['s.w'].f === 1, 'the dish category search takes a food file that shares the dish\'s words, not an unrelated food file: ' + (r.media['s.w'] && r.media['s.w'].u));
  ok(!r.media['s.t'] && r.misses['s.t'] === 'not a dish photo', 'a dish with only a plant photo gets none: ' + r.misses['s.t']);
  ok(!r.media['s.u'] && r.tried['s.u'] === 2, 'an old dish photo that is not food is dropped and looked up again');
  ok(r.media['s.v'] && r.media['s.v'].f === 1, 'an old dish photo whose categories say food is kept');
  ok(r.tried['s.h'] === 2 && r.tried['s.air'] === 2, 'every finished stop is noted as searched');
  ok(r.media['s.a'].c === 'Jane & Co / CC BY-SA 4.0', 'credit is author and licence, HTML removed: ' + r.media['s.a'].c);
  ok(r.media['s.a'].a === 'Chengdu' && r.media['s.a'].u.startsWith('https://upload.wikimedia.org/'), 'alt text and address');
  ok(/too far/.test(r.misses['s.b']), 'a page far from the stop is refused: ' + r.misses['s.b']);
  ok(/licence/.test(r.misses['s.d']), 'a non-commercial licence is refused: ' + r.misses['s.d']);
  ok(r.misses['s.e'] === 'disambiguation', 'a disambiguation page is refused');
  ok(r.misses['s.f'] === 'no page', 'a missing page is a miss');
  ok(/icon, flag or map/.test(r.misses['s.g']), 'a map or SVG is refused: ' + r.misses['s.g']);
  ok(r.misses['s.h'] === 'no page', 'an unknown name is a miss');
  ok(r.media['s.i'] && r.media['s.i'].u === 'https://upload.wikimedia.org/thumb/Tea.jpg/500px-Tea.jpg', 'a stop with no Chinese page falls back to the English page, and the tracking tail is removed: ' + (r.media['s.i'] && r.media['s.i'].u));
  ok(r.misses['s.j'] === 'image does not load', 'a picture address that does not load is dropped: ' + r.misses['s.j']);
  ok(r.media['s.k'] && /Jinli/.test(r.media['s.k'].u), 'a page without coordinates uses its Wikidata coordinates');
  ok(r.media['s.l'] && /Duck/.test(r.media['s.l'].u), 'a search can find a page whose title contains the whole name');
  // run again: nothing is looked up twice
  const n = calls.length;
  const r2 = await J.run({ fetch: fake, world, media: r.media, misses: r.misses, save: false, log: () => {} });
  ok(calls.length === n && r2.found === 0, 'stops with a photo or a known miss are skipped');
  ok(J.KEEP_LICENCES.test('CC BY 3.0') && J.KEEP_LICENCES.test('CC0') && J.KEEP_LICENCES.test('CC BY-SA 2.0') && !J.KEEP_LICENCES.test('CC BY-NC-SA 4.0') && !J.KEEP_LICENCES.test('CC BY-ND 2.0') && !J.KEEP_LICENCES.test('All rights reserved'), 'licence filter');
  console.log(bad ? bad + ' failed' : 'journey media tests passed');
  process.exit(bad ? 1 : 0);
})();
