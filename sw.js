/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'ce652ff131';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=ce652ff131",
  "vendor/morphdom-umd.min.js?v=ce652ff131",
  "runtime.js?v=ce652ff131",
  "config.js?v=ce652ff131",
  "friends.js?v=ce652ff131",
  "level.js?v=ce652ff131",
  "placement.js?v=ce652ff131",
  "data/hsk1-words.js?v=ce652ff131",
  "data/hsk1-grammar.js?v=ce652ff131",
  "data/hsk1-webs.js?v=ce652ff131",
  "data/hsk1-speak.js?v=ce652ff131",
  "data/hsk1-listen.js?v=ce652ff131",
  "data/hsk1-exam.js?v=ce652ff131",
  "data/hsk1-erhua.js?v=ce652ff131",
  "data/lexicon.js?v=ce652ff131",
  "data/char-glosses.js?v=ce652ff131",
  "data/hsk2-preview.js?v=ce652ff131",
  "data/hsk3-preview.js?v=ce652ff131",
  "data/hsk4-preview.js?v=ce652ff131",
  "data/hsk5-preview.js?v=ce652ff131",
  "data/hsk2-words.js?v=ce652ff131",
  "data/hsk2-speak.js?v=ce652ff131",
  "data/hsk2-listen.js?v=ce652ff131",
  "data/hsk2-exam.js?v=ce652ff131",
  "data/hsk2-grammar.js?v=ce652ff131",
  "data/hsk2-webs.js?v=ce652ff131",
  "data/hsk3-words.js?v=ce652ff131",
  "data/hsk3-speak.js?v=ce652ff131",
  "data/hsk3-listen.js?v=ce652ff131",
  "data/hsk3-exam.js?v=ce652ff131",
  "data/hsk3-grammar.js?v=ce652ff131",
  "data/hsk3-webs.js?v=ce652ff131",
  "data/hsk4-words.js?v=ce652ff131",
  "data/hsk4-speak.js?v=ce652ff131",
  "data/hsk4-listen.js?v=ce652ff131",
  "data/hsk4-exam.js?v=ce652ff131",
  "data/hsk4-grammar.js?v=ce652ff131",
  "data/hsk4-webs.js?v=ce652ff131",
  "data/hsk5-words.js?v=ce652ff131",
  "data/hsk5-speak.js?v=ce652ff131",
  "data/hsk5-listen.js?v=ce652ff131",
  "data/hsk5-exam.js?v=ce652ff131",
  "data/hsk5-grammar.js?v=ce652ff131",
  "data/hsk5-webs.js?v=ce652ff131",
  "ascent.js?v=ce652ff131",
  "secrets.js?v=ce652ff131",
  "sync.js?v=ce652ff131",
  "data/audio-manifest.js?v=ce652ff131",
  "jyscene.js?v=ce652ff131",
  "journey.js?v=ce652ff131",
  "stampart.js?v=ce652ff131",
  "feastart.js?v=ce652ff131",
  "feastscene.js?v=ce652ff131",
  "feastthemes.js?v=ce652ff131",
  "feastthemes2.js?v=ce652ff131",
  "data/journey.js?v=ce652ff131",
  "data/journey-map.js?v=ce652ff131",
  "data/journey-media.js?v=ce652ff131",
  "data/souvenirs.js?v=ce652ff131",
  "erhua.js?v=ce652ff131",
  "pinyin.js?v=ce652ff131",
  "data/pinyin-course.js?v=ce652ff131",
  "data/pinyin-chart.js?v=ce652ff131",
  "data/exam-media.js?v=ce652ff131",
  "data/exam-art.js?v=ce652ff131",
  "data/neutral-alt.js?v=ce652ff131",
  "data/path-scenes.js?v=ce652ff131",
  "data/speak-scenes.js?v=ce652ff131",
  "data/art.js?v=ce652ff131",
  "data/path.js?v=ce652ff131",
  "app.js?v=ce652ff131",
  "styles.css?v=ce652ff131",
  "fonts/bricolage-latin-ext.woff2",
  "fonts/bricolage-latin.woff2",
  "fonts/noto-serif-sc-500.woff2",
  "fonts/noto-serif-sc-700.woff2",
  "fonts/sourcesans-latin-ext.woff2",
  "fonts/sourcesans-latin.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "manifest.webmanifest"
];   // addresses relative to this file, as the page requests them (with ?v=)

const SIZES = {"index.html":259606,"boot-check.js?v=ce652ff131":5966,"vendor/morphdom-umd.min.js?v=ce652ff131":12165,"runtime.js?v=ce652ff131":5515,"config.js?v=ce652ff131":405,"friends.js?v=ce652ff131":12135,"level.js?v=ce652ff131":6123,"placement.js?v=ce652ff131":10785,"data/hsk1-words.js?v=ce652ff131":196551,"data/hsk1-grammar.js?v=ce652ff131":125845,"data/hsk1-webs.js?v=ce652ff131":66528,"data/hsk1-speak.js?v=ce652ff131":15703,"data/hsk1-listen.js?v=ce652ff131":21501,"data/hsk1-exam.js?v=ce652ff131":31376,"data/hsk1-erhua.js?v=ce652ff131":2395,"data/lexicon.js?v=ce652ff131":4945,"data/char-glosses.js?v=ce652ff131":20086,"data/hsk2-preview.js?v=ce652ff131":7777,"data/hsk3-preview.js?v=ce652ff131":22270,"data/hsk4-preview.js?v=ce652ff131":35946,"data/hsk5-preview.js?v=ce652ff131":59071,"data/hsk2-words.js?v=ce652ff131":111924,"data/hsk2-speak.js?v=ce652ff131":16960,"data/hsk2-listen.js?v=ce652ff131":32734,"data/hsk2-exam.js?v=ce652ff131":51948,"data/hsk2-grammar.js?v=ce652ff131":112471,"data/hsk2-webs.js?v=ce652ff131":47374,"data/hsk3-words.js?v=ce652ff131":318373,"data/hsk3-speak.js?v=ce652ff131":19052,"data/hsk3-listen.js?v=ce652ff131":55657,"data/hsk3-exam.js?v=ce652ff131":84397,"data/hsk3-grammar.js?v=ce652ff131":163260,"data/hsk3-webs.js?v=ce652ff131":102435,"data/hsk4-words.js?v=ce652ff131":681301,"data/hsk4-speak.js?v=ce652ff131":19752,"data/hsk4-listen.js?v=ce652ff131":97490,"data/hsk4-exam.js?v=ce652ff131":105199,"data/hsk4-grammar.js?v=ce652ff131":180251,"data/hsk4-webs.js?v=ce652ff131":139093,"data/hsk5-words.js?v=ce652ff131":1311261,"data/hsk5-speak.js?v=ce652ff131":26686,"data/hsk5-listen.js?v=ce652ff131":169932,"data/hsk5-exam.js?v=ce652ff131":188028,"data/hsk5-grammar.js?v=ce652ff131":246217,"data/hsk5-webs.js?v=ce652ff131":187837,"ascent.js?v=ce652ff131":13144,"secrets.js?v=ce652ff131":3605,"sync.js?v=ce652ff131":19251,"data/audio-manifest.js?v=ce652ff131":641917,"jyscene.js?v=ce652ff131":42327,"journey.js?v=ce652ff131":24675,"stampart.js?v=ce652ff131":63410,"feastart.js?v=ce652ff131":43900,"feastscene.js?v=ce652ff131":42123,"feastthemes.js?v=ce652ff131":24542,"feastthemes2.js?v=ce652ff131":27066,"data/journey.js?v=ce652ff131":366786,"data/journey-map.js?v=ce652ff131":213513,"data/journey-media.js?v=ce652ff131":392929,"data/souvenirs.js?v=ce652ff131":145718,"erhua.js?v=ce652ff131":6311,"pinyin.js?v=ce652ff131":2120,"data/pinyin-course.js?v=ce652ff131":18822,"data/pinyin-chart.js?v=ce652ff131":27967,"data/exam-media.js?v=ce652ff131":1855,"data/exam-art.js?v=ce652ff131":113483,"data/neutral-alt.js?v=ce652ff131":5359,"data/path-scenes.js?v=ce652ff131":280647,"data/speak-scenes.js?v=ce652ff131":296008,"data/art.js?v=ce652ff131":25281,"data/path.js?v=ce652ff131":135883,"app.js?v=ce652ff131":548379,"styles.css?v=ce652ff131":272327,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
// every stored file must have the size this version expects: a stale copy from a network cache (a site update still spreading) is fetched again
// under a changed address; if it is still wrong the install fails, so the old version keeps running and the next check tries again
const sizeOf = (res) => res.clone().arrayBuffer().then((b) => b.byteLength);
const fetchRight = (u) => {
  const want = SIZES[u];
  const get = (addr) => fetch(new Request(addr, { cache: 'reload' })).then((r) => (r.ok ? r : Promise.reject(new Error('HTTP ' + r.status + ' ' + addr))));
  return get(u).then((r) => sizeOf(r).then((n) => (n === want ? r : get(u + (u.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now()).then((r2) => sizeOf(r2).then((n2) => (n2 === want ? r2 : Promise.reject(new Error('wrong size ' + u + ' ' + n2 + ' not ' + want))))))));
};
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((u) => fetchRight(u).then((r) => cache.put(new Request(u), r)))))
      .then(() => self.skipWaiting())   // the new copy takes over at once, so a phone stuck on a bad copy gets the good one on its next start
      .catch((err) => caches.delete(CACHE).then(() => { throw err; }))
  );
});

self.addEventListener('message', (event) => { if (event.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('shanlu-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // opening the site (any address of it, with or without ?level=): the stored page, which names exactly the stored scripts
  if (req.mode === 'navigate' && /\/grammar-check-test\.html$/.test(url.pathname)) return;   // the checker-comparison page is a separate page: straight from the network
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(new URL('index.html', self.registration.scope).href)).then((hit) => hit || fetch(req)));
    return;
  }
  // a file of this version: from the stored copy
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(req)).then((hit) => hit || fetch(req)));
});
