/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '0442438bef';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=0442438bef",
  "vendor/morphdom-umd.min.js?v=0442438bef",
  "runtime.js?v=0442438bef",
  "config.js?v=0442438bef",
  "friends.js?v=0442438bef",
  "level.js?v=0442438bef",
  "placement.js?v=0442438bef",
  "data/hsk1-words.js?v=0442438bef",
  "data/hsk1-grammar.js?v=0442438bef",
  "data/hsk1-webs.js?v=0442438bef",
  "data/hsk1-speak.js?v=0442438bef",
  "data/hsk1-listen.js?v=0442438bef",
  "data/hsk1-exam.js?v=0442438bef",
  "data/hsk1-erhua.js?v=0442438bef",
  "data/lexicon.js?v=0442438bef",
  "data/char-glosses.js?v=0442438bef",
  "data/hsk2-preview.js?v=0442438bef",
  "data/hsk3-preview.js?v=0442438bef",
  "data/hsk4-preview.js?v=0442438bef",
  "data/hsk5-preview.js?v=0442438bef",
  "data/hsk2-words.js?v=0442438bef",
  "data/hsk2-speak.js?v=0442438bef",
  "data/hsk2-listen.js?v=0442438bef",
  "data/hsk2-exam.js?v=0442438bef",
  "data/hsk2-grammar.js?v=0442438bef",
  "data/hsk2-webs.js?v=0442438bef",
  "data/hsk3-words.js?v=0442438bef",
  "data/hsk3-speak.js?v=0442438bef",
  "data/hsk3-listen.js?v=0442438bef",
  "data/hsk3-exam.js?v=0442438bef",
  "data/hsk3-grammar.js?v=0442438bef",
  "data/hsk3-webs.js?v=0442438bef",
  "data/hsk4-words.js?v=0442438bef",
  "data/hsk4-speak.js?v=0442438bef",
  "data/hsk4-listen.js?v=0442438bef",
  "data/hsk4-exam.js?v=0442438bef",
  "data/hsk4-grammar.js?v=0442438bef",
  "data/hsk4-webs.js?v=0442438bef",
  "data/hsk5-words.js?v=0442438bef",
  "data/hsk5-speak.js?v=0442438bef",
  "data/hsk5-listen.js?v=0442438bef",
  "data/hsk5-exam.js?v=0442438bef",
  "data/hsk5-grammar.js?v=0442438bef",
  "data/hsk5-webs.js?v=0442438bef",
  "ascent.js?v=0442438bef",
  "secrets.js?v=0442438bef",
  "sync.js?v=0442438bef",
  "data/audio-manifest.js?v=0442438bef",
  "jyscene.js?v=0442438bef",
  "journey.js?v=0442438bef",
  "stampart.js?v=0442438bef",
  "feastart.js?v=0442438bef",
  "feastscene.js?v=0442438bef",
  "feastthemes.js?v=0442438bef",
  "feastthemes2.js?v=0442438bef",
  "data/journey.js?v=0442438bef",
  "data/journey-map.js?v=0442438bef",
  "data/journey-media.js?v=0442438bef",
  "data/souvenirs.js?v=0442438bef",
  "erhua.js?v=0442438bef",
  "pinyin.js?v=0442438bef",
  "data/pinyin-course.js?v=0442438bef",
  "data/pinyin-chart.js?v=0442438bef",
  "data/exam-media.js?v=0442438bef",
  "data/exam-art.js?v=0442438bef",
  "data/neutral-alt.js?v=0442438bef",
  "data/path-scenes.js?v=0442438bef",
  "data/speak-scenes.js?v=0442438bef",
  "data/art.js?v=0442438bef",
  "data/path.js?v=0442438bef",
  "app.js?v=0442438bef",
  "styles.css?v=0442438bef",
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

const SIZES = {"index.html":259606,"boot-check.js?v=0442438bef":5966,"vendor/morphdom-umd.min.js?v=0442438bef":12165,"runtime.js?v=0442438bef":5515,"config.js?v=0442438bef":405,"friends.js?v=0442438bef":12135,"level.js?v=0442438bef":6123,"placement.js?v=0442438bef":10785,"data/hsk1-words.js?v=0442438bef":196551,"data/hsk1-grammar.js?v=0442438bef":208049,"data/hsk1-webs.js?v=0442438bef":66528,"data/hsk1-speak.js?v=0442438bef":15703,"data/hsk1-listen.js?v=0442438bef":37488,"data/hsk1-exam.js?v=0442438bef":31376,"data/hsk1-erhua.js?v=0442438bef":2710,"data/lexicon.js?v=0442438bef":4988,"data/char-glosses.js?v=0442438bef":20086,"data/hsk2-preview.js?v=0442438bef":7777,"data/hsk3-preview.js?v=0442438bef":22270,"data/hsk4-preview.js?v=0442438bef":35946,"data/hsk5-preview.js?v=0442438bef":59071,"data/hsk2-words.js?v=0442438bef":111918,"data/hsk2-speak.js?v=0442438bef":16960,"data/hsk2-listen.js?v=0442438bef":54080,"data/hsk2-exam.js?v=0442438bef":51948,"data/hsk2-grammar.js?v=0442438bef":190184,"data/hsk2-webs.js?v=0442438bef":47372,"data/hsk3-words.js?v=0442438bef":318353,"data/hsk3-speak.js?v=0442438bef":19050,"data/hsk3-listen.js?v=0442438bef":78236,"data/hsk3-exam.js?v=0442438bef":84393,"data/hsk3-grammar.js?v=0442438bef":275046,"data/hsk3-webs.js?v=0442438bef":102435,"data/hsk4-words.js?v=0442438bef":681273,"data/hsk4-speak.js?v=0442438bef":19752,"data/hsk4-listen.js?v=0442438bef":121144,"data/hsk4-exam.js?v=0442438bef":105195,"data/hsk4-grammar.js?v=0442438bef":315384,"data/hsk4-webs.js?v=0442438bef":139093,"data/hsk5-words.js?v=0442438bef":1311228,"data/hsk5-speak.js?v=0442438bef":26686,"data/hsk5-listen.js?v=0442438bef":196699,"data/hsk5-exam.js?v=0442438bef":188008,"data/hsk5-grammar.js?v=0442438bef":419284,"data/hsk5-webs.js?v=0442438bef":187837,"ascent.js?v=0442438bef":13144,"secrets.js?v=0442438bef":3605,"sync.js?v=0442438bef":19251,"data/audio-manifest.js?v=0442438bef":641917,"jyscene.js?v=0442438bef":42327,"journey.js?v=0442438bef":24675,"stampart.js?v=0442438bef":63410,"feastart.js?v=0442438bef":43900,"feastscene.js?v=0442438bef":42123,"feastthemes.js?v=0442438bef":24542,"feastthemes2.js?v=0442438bef":27066,"data/journey.js?v=0442438bef":366786,"data/journey-map.js?v=0442438bef":213513,"data/journey-media.js?v=0442438bef":392929,"data/souvenirs.js?v=0442438bef":145718,"erhua.js?v=0442438bef":6311,"pinyin.js?v=0442438bef":2120,"data/pinyin-course.js?v=0442438bef":18822,"data/pinyin-chart.js?v=0442438bef":27967,"data/exam-media.js?v=0442438bef":1855,"data/exam-art.js?v=0442438bef":113483,"data/neutral-alt.js?v=0442438bef":5359,"data/path-scenes.js?v=0442438bef":280647,"data/speak-scenes.js?v=0442438bef":296008,"data/art.js?v=0442438bef":25281,"data/path.js?v=0442438bef":135883,"app.js?v=0442438bef":549467,"styles.css?v=0442438bef":272327,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
