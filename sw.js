/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '69f72fdc4e';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=69f72fdc4e",
  "vendor/morphdom-umd.min.js?v=69f72fdc4e",
  "runtime.js?v=69f72fdc4e",
  "config.js?v=69f72fdc4e",
  "friends.js?v=69f72fdc4e",
  "level.js?v=69f72fdc4e",
  "placement.js?v=69f72fdc4e",
  "data/hsk1-words.js?v=69f72fdc4e",
  "data/hsk1-grammar.js?v=69f72fdc4e",
  "data/hsk1-webs.js?v=69f72fdc4e",
  "data/hsk1-speak.js?v=69f72fdc4e",
  "data/hsk1-listen.js?v=69f72fdc4e",
  "data/hsk1-exam.js?v=69f72fdc4e",
  "data/hsk1-erhua.js?v=69f72fdc4e",
  "data/lexicon.js?v=69f72fdc4e",
  "data/char-glosses.js?v=69f72fdc4e",
  "data/hsk2-preview.js?v=69f72fdc4e",
  "data/hsk3-preview.js?v=69f72fdc4e",
  "data/hsk4-preview.js?v=69f72fdc4e",
  "data/hsk5-preview.js?v=69f72fdc4e",
  "data/hsk2-words.js?v=69f72fdc4e",
  "data/hsk2-speak.js?v=69f72fdc4e",
  "data/hsk2-listen.js?v=69f72fdc4e",
  "data/hsk2-exam.js?v=69f72fdc4e",
  "data/hsk2-grammar.js?v=69f72fdc4e",
  "data/hsk2-webs.js?v=69f72fdc4e",
  "data/hsk3-words.js?v=69f72fdc4e",
  "data/hsk3-speak.js?v=69f72fdc4e",
  "data/hsk3-listen.js?v=69f72fdc4e",
  "data/hsk3-exam.js?v=69f72fdc4e",
  "data/hsk3-grammar.js?v=69f72fdc4e",
  "data/hsk3-webs.js?v=69f72fdc4e",
  "data/hsk4-words.js?v=69f72fdc4e",
  "data/hsk4-speak.js?v=69f72fdc4e",
  "data/hsk4-listen.js?v=69f72fdc4e",
  "data/hsk4-exam.js?v=69f72fdc4e",
  "data/hsk4-grammar.js?v=69f72fdc4e",
  "data/hsk4-webs.js?v=69f72fdc4e",
  "data/hsk5-words.js?v=69f72fdc4e",
  "data/hsk5-speak.js?v=69f72fdc4e",
  "data/hsk5-listen.js?v=69f72fdc4e",
  "data/hsk5-exam.js?v=69f72fdc4e",
  "data/hsk5-grammar.js?v=69f72fdc4e",
  "data/hsk5-webs.js?v=69f72fdc4e",
  "ascent.js?v=69f72fdc4e",
  "secrets.js?v=69f72fdc4e",
  "sync.js?v=69f72fdc4e",
  "data/audio-manifest.js?v=69f72fdc4e",
  "jyscene.js?v=69f72fdc4e",
  "journey.js?v=69f72fdc4e",
  "stampart.js?v=69f72fdc4e",
  "feastart.js?v=69f72fdc4e",
  "feastscene.js?v=69f72fdc4e",
  "feastthemes.js?v=69f72fdc4e",
  "feastthemes2.js?v=69f72fdc4e",
  "data/journey.js?v=69f72fdc4e",
  "data/journey-map.js?v=69f72fdc4e",
  "data/journey-media.js?v=69f72fdc4e",
  "data/souvenirs.js?v=69f72fdc4e",
  "erhua.js?v=69f72fdc4e",
  "pinyin.js?v=69f72fdc4e",
  "data/pinyin-course.js?v=69f72fdc4e",
  "data/pinyin-chart.js?v=69f72fdc4e",
  "data/exam-media.js?v=69f72fdc4e",
  "data/exam-art.js?v=69f72fdc4e",
  "data/neutral-alt.js?v=69f72fdc4e",
  "data/path-scenes.js?v=69f72fdc4e",
  "data/speak-scenes.js?v=69f72fdc4e",
  "data/art.js?v=69f72fdc4e",
  "data/path.js?v=69f72fdc4e",
  "app.js?v=69f72fdc4e",
  "styles.css?v=69f72fdc4e",
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

const SIZES = {"index.html":259606,"boot-check.js?v=69f72fdc4e":5966,"vendor/morphdom-umd.min.js?v=69f72fdc4e":12165,"runtime.js?v=69f72fdc4e":5515,"config.js?v=69f72fdc4e":405,"friends.js?v=69f72fdc4e":12135,"level.js?v=69f72fdc4e":6123,"placement.js?v=69f72fdc4e":10785,"data/hsk1-words.js?v=69f72fdc4e":196551,"data/hsk1-grammar.js?v=69f72fdc4e":208098,"data/hsk1-webs.js?v=69f72fdc4e":66528,"data/hsk1-speak.js?v=69f72fdc4e":15703,"data/hsk1-listen.js?v=69f72fdc4e":37488,"data/hsk1-exam.js?v=69f72fdc4e":31376,"data/hsk1-erhua.js?v=69f72fdc4e":2710,"data/lexicon.js?v=69f72fdc4e":4967,"data/char-glosses.js?v=69f72fdc4e":20086,"data/hsk2-preview.js?v=69f72fdc4e":7777,"data/hsk3-preview.js?v=69f72fdc4e":22270,"data/hsk4-preview.js?v=69f72fdc4e":35946,"data/hsk5-preview.js?v=69f72fdc4e":59071,"data/hsk2-words.js?v=69f72fdc4e":111924,"data/hsk2-speak.js?v=69f72fdc4e":16960,"data/hsk2-listen.js?v=69f72fdc4e":54080,"data/hsk2-exam.js?v=69f72fdc4e":51948,"data/hsk2-grammar.js?v=69f72fdc4e":190477,"data/hsk2-webs.js?v=69f72fdc4e":47374,"data/hsk3-words.js?v=69f72fdc4e":318373,"data/hsk3-speak.js?v=69f72fdc4e":19052,"data/hsk3-listen.js?v=69f72fdc4e":78302,"data/hsk3-exam.js?v=69f72fdc4e":84397,"data/hsk3-grammar.js?v=69f72fdc4e":275475,"data/hsk3-webs.js?v=69f72fdc4e":102435,"data/hsk4-words.js?v=69f72fdc4e":681301,"data/hsk4-speak.js?v=69f72fdc4e":19752,"data/hsk4-listen.js?v=69f72fdc4e":121146,"data/hsk4-exam.js?v=69f72fdc4e":105199,"data/hsk4-grammar.js?v=69f72fdc4e":315861,"data/hsk4-webs.js?v=69f72fdc4e":139093,"data/hsk5-words.js?v=69f72fdc4e":1311261,"data/hsk5-speak.js?v=69f72fdc4e":26686,"data/hsk5-listen.js?v=69f72fdc4e":196703,"data/hsk5-exam.js?v=69f72fdc4e":188028,"data/hsk5-grammar.js?v=69f72fdc4e":419286,"data/hsk5-webs.js?v=69f72fdc4e":187837,"ascent.js?v=69f72fdc4e":13144,"secrets.js?v=69f72fdc4e":3605,"sync.js?v=69f72fdc4e":19251,"data/audio-manifest.js?v=69f72fdc4e":641917,"jyscene.js?v=69f72fdc4e":42327,"journey.js?v=69f72fdc4e":24675,"stampart.js?v=69f72fdc4e":63410,"feastart.js?v=69f72fdc4e":43900,"feastscene.js?v=69f72fdc4e":42123,"feastthemes.js?v=69f72fdc4e":24542,"feastthemes2.js?v=69f72fdc4e":27066,"data/journey.js?v=69f72fdc4e":366786,"data/journey-map.js?v=69f72fdc4e":213513,"data/journey-media.js?v=69f72fdc4e":392929,"data/souvenirs.js?v=69f72fdc4e":145718,"erhua.js?v=69f72fdc4e":6311,"pinyin.js?v=69f72fdc4e":2120,"data/pinyin-course.js?v=69f72fdc4e":18822,"data/pinyin-chart.js?v=69f72fdc4e":27967,"data/exam-media.js?v=69f72fdc4e":1855,"data/exam-art.js?v=69f72fdc4e":113483,"data/neutral-alt.js?v=69f72fdc4e":5359,"data/path-scenes.js?v=69f72fdc4e":280647,"data/speak-scenes.js?v=69f72fdc4e":296008,"data/art.js?v=69f72fdc4e":25281,"data/path.js?v=69f72fdc4e":135883,"app.js?v=69f72fdc4e":549467,"styles.css?v=69f72fdc4e":272327,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
