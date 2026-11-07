/* Tests for the photo finder (tools/journey-media.js) with Wikimedia pretended, since this workspace cannot reach it.   node tools/test-journey-media.js */
const J = require('./journey-media');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };

(async () => {
  const pages = {
    '成都': { title: '成都', pageimage: 'Chengdu.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Chengdu.jpg/640px-Chengdu.jpg' }, coordinates: [{ lat: 30.66, lon: 104.06 }] },
    '宽窄巷子': { title: '宽窄巷子', pageimage: 'Lane.jpg', thumbnail: { source: 'x' }, coordinates: [{ lat: 39.9, lon: 116.4 }] },            // the right name, but in Beijing
    '麻婆豆腐': { title: '麻婆豆腐', pageimage: 'Mapo.jpg', thumbnail: { source: 'https://upload.wikimedia.org/thumb/Mapo.jpg/640px-Mapo.jpg' } },
    '火锅': { title: '火锅', pageimage: 'Pot.jpg', thumbnail: { source: 'y' } },                                                                // licence not allowed
    '川剧': { title: '川剧', pageprops: { disambiguation: '' } },
    '熊猫基地': { missing: true },
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
  const calls = [];
  const fake = async (url) => {
    calls.push(url); const u = new URL(url); const t = u.searchParams.get('titles');
    if (!/wikipedia\.org|commons\.wikimedia\.org/.test(u.hostname)) return { ok: !/broken/.test(url), status: 200, headers: { get: () => 'image/jpeg' } };   // an image address
    if (u.hostname.startsWith('en.')) return { ok: true, status: 200, json: async () => ({ query: { pages: [enPages[t] || { title: t, missing: true }] } }) };
    const body = u.hostname.startsWith('zh.') ? { query: { pages: [pages[t] || { title: t, missing: true }] } } : { query: { pages: [{ imageinfo: [files[t.replace(/^File:/, '')]] }] } };
    return { ok: true, status: 200, json: async () => body };
  };
  const stop = (id, k, zh, en, lat, lon) => ({ id, k, zh, en, lat, lon, ll: lat == null ? null : [lat, lon] });
  const world = { byCity: {}, regions: [{ id: 'sichuan', stops: [stop('s.a', 'T', '成都', 'Chengdu', 30.67, 104.07), stop('s.b', 'A', '宽窄巷子', 'Wide and Narrow Alley', 30.67, 104.06), stop('s.c', 'D', '麻婆豆腐', 'Mapo tofu'), stop('s.d', 'D', '火锅', 'Hot pot'), stop('s.e', 'C', '川剧', 'Sichuan opera'), stop('s.f', 'A', '熊猫基地', 'Panda base', 30.7, 104.1), stop('s.g', 'A', '都江堰', 'Dujiangyan', 31.0, 103.6), stop('s.h', 'D', '回锅肉', 'Twice-cooked pork'), stop('s.i', 'A', '鹤鸣茶社', 'Tea house', 30.67, 104.06), stop('s.j', 'D', '烂图', 'Broken pic')] }] };
  const logs = [];
  const r = await J.run({ fetch: fake, world, media: {}, misses: {}, save: false, verify: true, log: (m) => logs.push(m) });
  ok(r.found === 3 && Object.keys(r.media).sort().join() === 's.a,s.c,s.i', 'only the right pictures are kept: ' + Object.keys(r.media));
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
  // run again: nothing is looked up twice
  const n = calls.length;
  const r2 = await J.run({ fetch: fake, world, media: r.media, misses: r.misses, save: false, log: () => {} });
  ok(calls.length === n && r2.found === 0, 'stops with a photo or a known miss are skipped');
  ok(J.KEEP_LICENCES.test('CC BY 3.0') && J.KEEP_LICENCES.test('CC0') && J.KEEP_LICENCES.test('CC BY-SA 2.0') && !J.KEEP_LICENCES.test('CC BY-NC-SA 4.0') && !J.KEEP_LICENCES.test('CC BY-ND 2.0') && !J.KEEP_LICENCES.test('All rights reserved'), 'licence filter');
  console.log(bad ? bad + ' failed' : 'journey media tests passed');
  process.exit(bad ? 1 : 0);
})();
