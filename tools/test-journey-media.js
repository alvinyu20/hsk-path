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
  const calls = [];
  const fake = async (url) => {
    calls.push(url); const u = new URL(url); const t = u.searchParams.get('titles');
    const body = u.hostname.startsWith('zh.') ? { query: { pages: [pages[t] || { title: t, missing: true }] } } : { query: { pages: [{ imageinfo: [files[t.replace(/^File:/, '')]] }] } };
    return { ok: true, status: 200, json: async () => body };
  };
  const stop = (id, k, zh, en, lat, lon) => ({ id, k, zh, en, lat, lon, ll: lat == null ? null : [lat, lon] });
  const world = { byCity: {}, regions: [{ id: 'sichuan', stops: [stop('s.a', 'T', '成都', 'Chengdu', 30.67, 104.07), stop('s.b', 'A', '宽窄巷子', 'Wide and Narrow Alley', 30.67, 104.06), stop('s.c', 'D', '麻婆豆腐', 'Mapo tofu'), stop('s.d', 'D', '火锅', 'Hot pot'), stop('s.e', 'C', '川剧', 'Sichuan opera'), stop('s.f', 'A', '熊猫基地', 'Panda base', 30.7, 104.1), stop('s.g', 'A', '都江堰', 'Dujiangyan', 31.0, 103.6), stop('s.h', 'D', '回锅肉', 'Twice-cooked pork')] }] };
  const logs = [];
  const r = await J.run({ fetch: fake, world, media: {}, misses: {}, save: false, log: (m) => logs.push(m) });
  ok(r.found === 2 && Object.keys(r.media).sort().join() === 's.a,s.c', 'only the right pictures are kept: ' + Object.keys(r.media));
  ok(r.media['s.a'].c === 'Jane & Co / CC BY-SA 4.0', 'credit is author and licence, HTML removed: ' + r.media['s.a'].c);
  ok(r.media['s.a'].a === 'Chengdu' && r.media['s.a'].u.startsWith('https://upload.wikimedia.org/'), 'alt text and address');
  ok(/too far/.test(r.misses['s.b']), 'a page far from the stop is refused: ' + r.misses['s.b']);
  ok(/licence/.test(r.misses['s.d']), 'a non-commercial licence is refused: ' + r.misses['s.d']);
  ok(r.misses['s.e'] === 'disambiguation', 'a disambiguation page is refused');
  ok(r.misses['s.f'] === 'no page', 'a missing page is a miss');
  ok(/icon, flag or map/.test(r.misses['s.g']), 'a map or SVG is refused: ' + r.misses['s.g']);
  ok(r.misses['s.h'] === 'no page', 'an unknown name is a miss');
  // run again: nothing is looked up twice
  const n = calls.length;
  const r2 = await J.run({ fetch: fake, world, media: r.media, misses: r.misses, save: false, log: () => {} });
  ok(calls.length === n && r2.found === 0, 'stops with a photo or a known miss are skipped');
  ok(J.KEEP_LICENCES.test('CC BY 3.0') && J.KEEP_LICENCES.test('CC0') && J.KEEP_LICENCES.test('CC BY-SA 2.0') && !J.KEEP_LICENCES.test('CC BY-NC-SA 4.0') && !J.KEEP_LICENCES.test('CC BY-ND 2.0') && !J.KEEP_LICENCES.test('All rights reserved'), 'licence filter');
  console.log(bad ? bad + ' failed' : 'journey media tests passed');
  process.exit(bad ? 1 : 0);
})();
