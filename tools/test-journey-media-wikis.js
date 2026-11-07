/* Tests for the extra dish searches of the photo finder: other-language Wikipedias, Wikidata in Chinese and its Commons category, Commons by pinyin.
 * Wikimedia is pretended.   node tools/test-journey-media-wikis.js */
const J = require('./journey-media');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };

(async () => {
  J.setSlow(false);
  delete process.env.OPENVERSE_CLIENT_ID; delete process.env.OPENVERSE_CLIENT_SECRET;
  const FILES = ['Yue dish.jpg', 'German dish.jpg', 'Cat dish.jpg', 'Pinyin Zhajiangmian.jpg', 'Plant.jpg', 'Wd dish.jpg'];
  const CATS = { 'Yue dish.jpg': ['Cantonese cuisine'], 'German dish.jpg': ['Noodle dishes'], 'Cat dish.jpg': ['Chinese food'], 'Pinyin Zhajiangmian.jpg': ['Noodle dishes'], 'Plant.jpg': ['Some plant'], 'Wd dish.jpg': ['Dishes'] };
  const thumb = (n) => 'https://upload.wikimedia.org/thumb/' + encodeURIComponent(n) + '/500px-' + encodeURIComponent(n);
  const info = (n) => ({ url: 'u', thumburl: thumb(n), extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'P' } } });
  const wikis = {   // host -> title -> page
    'yue.wikipedia.org': { '烧鹅饭': { title: '烧鹅饭', pageimage: 'Yue dish.jpg', thumbnail: { source: thumb('Yue dish.jpg') } } },
    'de.wikipedia.org': { 'German Style Noodles': { title: 'German Style Noodles', pageimage: 'German dish.jpg', thumbnail: { source: thumb('German dish.jpg') } }, 'Plant Soup': { title: 'Plant Soup', pageimage: 'Plant.jpg', thumbnail: { source: thumb('Plant.jpg') } } },
  };
  const seen = [];
  const fake = async (url) => {
    seen.push(url); const u = new URL(url); const t = u.searchParams.get('titles') || ''; const json = (b) => ({ ok: true, status: 200, json: async () => b });
    if (!/wikipedia\.org|wikivoyage\.org|commons\.wikimedia\.org|wikidata\.org/.test(u.hostname)) return { ok: true, status: 200, headers: { get: () => 'image/jpeg' } };
    if (u.hostname === 'www.wikidata.org') {
      if (u.searchParams.get('action') === 'wbsearchentities') return json({ search: u.searchParams.get('language') === 'zh' && u.searchParams.get('search') === '维基菜' ? [{ id: 'Q5', label: '维基菜', description: 'dish' }] : [] });
      return json({ entities: { Q5: { claims: { P373: [{ mainsnak: { datavalue: { value: 'Wikidata dish category' } } }] } } } });
    }
    if (u.hostname === 'commons.wikimedia.org') {
      if (u.searchParams.get('prop') === 'categories') return json({ query: { pages: t.split('|').map((x) => { const n = x.replace(/^(File|Category):/, ''); return { title: x, categories: (/^File:/.test(x) ? CATS[n] || [] : n === 'Some plant' ? ['Plants'] : []).map((c) => ({ title: 'Category:' + c })) }; }) } });
      if (u.searchParams.get('list') === 'categorymembers') return json({ query: { categorymembers: u.searchParams.get('cmtitle') === 'Category:Wikidata dish category' ? [{ title: 'File:Cat dish.jpg' }] : [] } });
      if (u.searchParams.get('list') === 'search') { const q = u.searchParams.get('srsearch'); return json({ query: { search: u.searchParams.get('srnamespace') === '6' && q === 'zhajiangmian' ? [{ title: 'File:Pinyin Zhajiangmian.jpg' }, { title: 'File:Other thing.jpg' }] : [] } }); }
      return json({ query: { pages: [{ imageinfo: [info(t.replace(/^File:/, ''))] }] } });
    }
    if (u.searchParams.get('list') === 'search') return json({ query: { search: [] } });
    if (u.searchParams.get('prop') === 'images') return json({ query: { pages: [{ title: t, images: [] }] } });
    const pagesOf = wikis[u.hostname] || {};
    return json({ query: { pages: t.split('|').map((x) => pagesOf[x] || { title: x, missing: true }) } });
  };
  const stop = (id, zh, en, py) => ({ id, k: 'D', zh, en, py });
  const world = { byCity: {}, regions: [{ id: 'x', zh: '某', en: 'X', cities: [{ first: { id: 'x.a' } }], stops: [
    stop('x.a', '烧鹅饭', 'Roast goose rice', 'Shāo’é fàn'),          // only the Cantonese Wikipedia has it
    stop('x.b', '德式面', 'German Style Noodles', 'Déshì miàn'),      // the German Wikipedia, under the English name
    stop('x.c', '维基菜', 'Zhongwen Only', 'Wéijīcài'),                // Wikidata knows the Chinese label; the item has no picture, only a Commons category
    stop('x.d', '炸酱面', 'Fried sauce thing', 'zhájiàngmiàn'),       // found on Commons by its pinyin
    stop('x.e', '植物汤', 'Plant Soup', 'Zhíwùtāng'),                  // a page whose picture is a plant: refused
  ] }] };
  const r = await J.run({ fetch: fake, world, media: {}, misses: {}, tried: {}, save: false, log: () => {} });
  ok(r.media['x.a'] && /Yue/.test(r.media['x.a'].u) && r.media['x.a'].f === 1, 'the Cantonese Wikipedia is tried with the Chinese name: ' + JSON.stringify(r.media['x.a']));
  ok(r.media['x.b'] && /German/.test(r.media['x.b'].u), 'the German Wikipedia is tried with the English name: ' + JSON.stringify(r.media['x.b']));
  ok(r.media['x.c'] && /Cat%20dish/.test(r.media['x.c'].u), 'a Wikidata item found by its Chinese label gives its Commons category photo: ' + JSON.stringify(r.media['x.c']));
  ok(r.media['x.d'] && /Pinyin%20Zhajiangmian/.test(r.media['x.d'].u) && !/Other%20thing/.test(r.media['x.d'].u), 'Commons is searched by pinyin and the title must hold the pinyin: ' + JSON.stringify(r.media['x.d']));
  ok(!r.media['x.e'], 'a plant picture from another Wikipedia is still refused');
  ok(r.tried['x.a'] === 4, 'finished stops are noted with the new search version');
  ok(!seen.some((x) => /api\.openverse/.test(x)), 'Openverse is not used without a key');
  if (bad) { console.log(bad + ' failed'); process.exit(1); }
  console.log('journey media (other wikis) tests passed');
})().catch((e) => { console.log(e); process.exit(1); });
