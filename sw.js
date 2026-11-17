/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'b938036ad3';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=b938036ad3",
  "vendor/morphdom-umd.min.js?v=b938036ad3",
  "runtime.js?v=b938036ad3",
  "config.js?v=b938036ad3",
  "friends.js?v=b938036ad3",
  "level.js?v=b938036ad3",
  "placement.js?v=b938036ad3",
  "data/hsk1-words.js?v=b938036ad3",
  "data/hsk1-grammar.js?v=b938036ad3",
  "data/hsk1-webs.js?v=b938036ad3",
  "data/hsk1-speak.js?v=b938036ad3",
  "data/hsk1-listen.js?v=b938036ad3",
  "data/hsk1-exam.js?v=b938036ad3",
  "data/hsk1-erhua.js?v=b938036ad3",
  "data/lexicon.js?v=b938036ad3",
  "data/char-glosses.js?v=b938036ad3",
  "data/hsk2-preview.js?v=b938036ad3",
  "data/hsk3-preview.js?v=b938036ad3",
  "data/hsk4-preview.js?v=b938036ad3",
  "data/hsk5-preview.js?v=b938036ad3",
  "data/hsk2-words.js?v=b938036ad3",
  "data/hsk2-speak.js?v=b938036ad3",
  "data/hsk2-listen.js?v=b938036ad3",
  "data/hsk2-exam.js?v=b938036ad3",
  "data/hsk2-grammar.js?v=b938036ad3",
  "data/hsk2-webs.js?v=b938036ad3",
  "data/hsk3-words.js?v=b938036ad3",
  "data/hsk3-speak.js?v=b938036ad3",
  "data/hsk3-listen.js?v=b938036ad3",
  "data/hsk3-exam.js?v=b938036ad3",
  "data/hsk3-grammar.js?v=b938036ad3",
  "data/hsk3-webs.js?v=b938036ad3",
  "data/hsk4-words.js?v=b938036ad3",
  "data/hsk4-speak.js?v=b938036ad3",
  "data/hsk4-listen.js?v=b938036ad3",
  "data/hsk4-exam.js?v=b938036ad3",
  "data/hsk4-grammar.js?v=b938036ad3",
  "data/hsk4-webs.js?v=b938036ad3",
  "data/hsk5-words.js?v=b938036ad3",
  "data/hsk5-speak.js?v=b938036ad3",
  "data/hsk5-listen.js?v=b938036ad3",
  "data/hsk5-exam.js?v=b938036ad3",
  "data/hsk5-grammar.js?v=b938036ad3",
  "data/hsk5-webs.js?v=b938036ad3",
  "ascent.js?v=b938036ad3",
  "secrets.js?v=b938036ad3",
  "sync.js?v=b938036ad3",
  "data/audio-manifest.js?v=b938036ad3",
  "jyscene.js?v=b938036ad3",
  "journey.js?v=b938036ad3",
  "stampart.js?v=b938036ad3",
  "feastart.js?v=b938036ad3",
  "feastscene.js?v=b938036ad3",
  "feastthemes.js?v=b938036ad3",
  "feastthemes2.js?v=b938036ad3",
  "data/journey.js?v=b938036ad3",
  "data/journey-map.js?v=b938036ad3",
  "data/journey-media.js?v=b938036ad3",
  "data/souvenirs.js?v=b938036ad3",
  "erhua.js?v=b938036ad3",
  "pinyin.js?v=b938036ad3",
  "data/pinyin-course.js?v=b938036ad3",
  "data/pinyin-chart.js?v=b938036ad3",
  "data/exam-media.js?v=b938036ad3",
  "data/exam-art.js?v=b938036ad3",
  "data/neutral-alt.js?v=b938036ad3",
  "data/path-scenes.js?v=b938036ad3",
  "data/speak-scenes.js?v=b938036ad3",
  "data/art.js?v=b938036ad3",
  "data/path.js?v=b938036ad3",
  "app.js?v=b938036ad3",
  "styles.css?v=b938036ad3",
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

const SIZES = {"index.html":260970,"boot-check.js?v=b938036ad3":5966,"vendor/morphdom-umd.min.js?v=b938036ad3":12165,"runtime.js?v=b938036ad3":5515,"config.js?v=b938036ad3":405,"friends.js?v=b938036ad3":12135,"level.js?v=b938036ad3":6123,"placement.js?v=b938036ad3":10785,"data/hsk1-words.js?v=b938036ad3":196551,"data/hsk1-grammar.js?v=b938036ad3":208049,"data/hsk1-webs.js?v=b938036ad3":66528,"data/hsk1-speak.js?v=b938036ad3":15703,"data/hsk1-listen.js?v=b938036ad3":37488,"data/hsk1-exam.js?v=b938036ad3":31376,"data/hsk1-erhua.js?v=b938036ad3":2710,"data/lexicon.js?v=b938036ad3":5016,"data/char-glosses.js?v=b938036ad3":20086,"data/hsk2-preview.js?v=b938036ad3":7777,"data/hsk3-preview.js?v=b938036ad3":22270,"data/hsk4-preview.js?v=b938036ad3":35946,"data/hsk5-preview.js?v=b938036ad3":59071,"data/hsk2-words.js?v=b938036ad3":111918,"data/hsk2-speak.js?v=b938036ad3":16960,"data/hsk2-listen.js?v=b938036ad3":54080,"data/hsk2-exam.js?v=b938036ad3":51948,"data/hsk2-grammar.js?v=b938036ad3":190184,"data/hsk2-webs.js?v=b938036ad3":47372,"data/hsk3-words.js?v=b938036ad3":318353,"data/hsk3-speak.js?v=b938036ad3":19050,"data/hsk3-listen.js?v=b938036ad3":78236,"data/hsk3-exam.js?v=b938036ad3":84393,"data/hsk3-grammar.js?v=b938036ad3":275046,"data/hsk3-webs.js?v=b938036ad3":102435,"data/hsk4-words.js?v=b938036ad3":681273,"data/hsk4-speak.js?v=b938036ad3":19752,"data/hsk4-listen.js?v=b938036ad3":121144,"data/hsk4-exam.js?v=b938036ad3":105195,"data/hsk4-grammar.js?v=b938036ad3":315384,"data/hsk4-webs.js?v=b938036ad3":139093,"data/hsk5-words.js?v=b938036ad3":1311216,"data/hsk5-speak.js?v=b938036ad3":26686,"data/hsk5-listen.js?v=b938036ad3":196699,"data/hsk5-exam.js?v=b938036ad3":188008,"data/hsk5-grammar.js?v=b938036ad3":419475,"data/hsk5-webs.js?v=b938036ad3":187633,"ascent.js?v=b938036ad3":13144,"secrets.js?v=b938036ad3":3605,"sync.js?v=b938036ad3":19251,"data/audio-manifest.js?v=b938036ad3":641917,"jyscene.js?v=b938036ad3":42327,"journey.js?v=b938036ad3":24675,"stampart.js?v=b938036ad3":63410,"feastart.js?v=b938036ad3":43900,"feastscene.js?v=b938036ad3":42123,"feastthemes.js?v=b938036ad3":24542,"feastthemes2.js?v=b938036ad3":27066,"data/journey.js?v=b938036ad3":366786,"data/journey-map.js?v=b938036ad3":213513,"data/journey-media.js?v=b938036ad3":392929,"data/souvenirs.js?v=b938036ad3":145718,"erhua.js?v=b938036ad3":6311,"pinyin.js?v=b938036ad3":2120,"data/pinyin-course.js?v=b938036ad3":18822,"data/pinyin-chart.js?v=b938036ad3":27967,"data/exam-media.js?v=b938036ad3":1855,"data/exam-art.js?v=b938036ad3":113483,"data/neutral-alt.js?v=b938036ad3":5359,"data/path-scenes.js?v=b938036ad3":280647,"data/speak-scenes.js?v=b938036ad3":296008,"data/art.js?v=b938036ad3":25281,"data/path.js?v=b938036ad3":135834,"app.js?v=b938036ad3":552050,"styles.css?v=b938036ad3":273257,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
