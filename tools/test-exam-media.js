// Offline test of tools/exam-media.js: a fake Wikimedia API, no network.
'use strict';
const M = require('./exam-media.js');
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

const files = {   // name -> licence
  'Apple.jpg': 'CC BY-SA 4.0', 'Apple tree diagram.jpg': 'CC BY 2.0', 'Red apple 2.jpg': 'Public domain', 'Apple NC.jpg': 'CC BY-NC 2.0', 'Apple logo.png': 'CC0', 'Green apple.png': 'CC BY 3.0',
  'Apple 4.jpg': 'CC0', 'Apple 5.jpg': 'CC0', 'Apple movie.ogv': 'CC0',
};
const api = {
  page: async (t) => t === 'Apple' ? { query: { pages: [{ title: 'Apple', pageimage: 'Apple.jpg', thumbnail: { source: 'x' } }] } } : { query: { pages: [{ missing: true }] } },
  images: async () => ({ query: { pages: [{ images: Object.keys(files).filter((n) => n !== 'Apple.jpg').map((n) => ({ title: 'File:' + n })) }] } }),
  cfiles: async () => ({ query: { search: [{ title: 'File:Red apple 2.jpg' }, { title: 'File:Commons only.jpg' }] } }),
  file: async (name) => {
    if (name === 'Commons only.jpg') return { query: { pages: [{ imageinfo: [{ thumburl: 'https://upload.wikimedia.org/c.jpg?x=1', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: '<a>Ann</a>' } } }] }] } };
    const lic = files[name];
    return { query: { pages: [{ imageinfo: [{ thumburl: 'https://upload.wikimedia.org/' + encodeURIComponent(name), extmetadata: { LicenseShortName: { value: lic }, Artist: { value: 'Bo' } } }] }] } };
  },
};
(async () => {
  const item = M.ITEMS.find((i) => i[0] === '🍎');
  const c = await M.candidatesFor(api, item, []);
  check(c.length === 4, 'at most 4 candidates (' + c.length + ')');
  check(c[0].n === 'Apple.jpg' && /Wikipedia/.test(c[0].via), 'the page\'s own picture comes first');
  const names = c.map((x) => x.n);
  check(!names.includes('Apple tree diagram.jpg') && !names.includes('Apple logo.png') && !names.includes('Apple movie.ogv'), 'diagrams, logos and video are not proposed');
  check(!names.includes('Apple NC.jpg'), 'a NonCommercial licence is refused');
  check(c.every((x) => /^https:\/\/upload\.wikimedia\.org\/[^?]*$/.test(x.u) && / \/ (CC|Public)/.test(x.c)), 'every candidate has a clean address and a credit line: ' + c[0].c);
  const r = await M.candidatesFor(api, item, ['Apple.jpg']);
  check(!r.map((x) => x.n).includes('Apple.jpg'), 'a rejected file is never proposed again');
  const none = await M.candidatesFor({ page: async () => ({ query: { pages: [{ missing: true }] } }), images: async () => ({}), cfiles: async () => { throw new Error('HTTP 500'); }, file: async () => ({}) }, item, []);
  check(none.length === 0, 'a failing API gives no candidates and no crash');
  const cands = { '🍎': c.map((x) => ({ u: x.u, c: x.c, n: x.n })) };
  const d = M.buildData(cands, { '🍎': 2, '🐶': 1, '🐱': 0 });
  check(Object.keys(d).length === 1 && d['🍎'].u === c[1].u && d['🍎'].a === 'apple', 'picks build the data (candidate 2 of 🍎; no candidates for 🐶; 0 keeps the emoji)');
  check(M.key('✈️') === '✈' && M.ITEMS.every((i) => i[2].length && i[3].length), 'keys drop the variation selector; every item has pages and searches');
  const h = M.sheet(cands);
  check(/Copy my choices/.test(h) && /keep emoji/.test(h) && h.includes(c[0].u), 'the contact sheet lists candidates and has the copy button');
  process.exit(bad ? 1 : 0);
})();
