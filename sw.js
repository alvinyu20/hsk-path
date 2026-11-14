/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '333c389862';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=333c389862",
  "vendor/morphdom-umd.min.js?v=333c389862",
  "runtime.js?v=333c389862",
  "config.js?v=333c389862",
  "friends.js?v=333c389862",
  "level.js?v=333c389862",
  "placement.js?v=333c389862",
  "data/hsk1-words.js?v=333c389862",
  "data/hsk1-grammar.js?v=333c389862",
  "data/hsk1-webs.js?v=333c389862",
  "data/hsk1-speak.js?v=333c389862",
  "data/hsk1-listen.js?v=333c389862",
  "data/hsk1-exam.js?v=333c389862",
  "data/hsk1-erhua.js?v=333c389862",
  "data/lexicon.js?v=333c389862",
  "data/char-glosses.js?v=333c389862",
  "data/hsk2-preview.js?v=333c389862",
  "data/hsk3-preview.js?v=333c389862",
  "data/hsk4-preview.js?v=333c389862",
  "data/hsk2-words.js?v=333c389862",
  "data/hsk2-speak.js?v=333c389862",
  "data/hsk2-listen.js?v=333c389862",
  "data/hsk2-exam.js?v=333c389862",
  "data/hsk2-grammar.js?v=333c389862",
  "data/hsk2-webs.js?v=333c389862",
  "data/hsk3-words.js?v=333c389862",
  "data/hsk3-speak.js?v=333c389862",
  "data/hsk3-listen.js?v=333c389862",
  "data/hsk3-exam.js?v=333c389862",
  "data/hsk3-grammar.js?v=333c389862",
  "data/hsk3-webs.js?v=333c389862",
  "data/hsk4-words.js?v=333c389862",
  "data/hsk4-speak.js?v=333c389862",
  "data/hsk4-listen.js?v=333c389862",
  "data/hsk4-exam.js?v=333c389862",
  "data/hsk4-grammar.js?v=333c389862",
  "data/hsk4-webs.js?v=333c389862",
  "ascent.js?v=333c389862",
  "secrets.js?v=333c389862",
  "sync.js?v=333c389862",
  "data/audio-manifest.js?v=333c389862",
  "journey.js?v=333c389862",
  "data/journey.js?v=333c389862",
  "data/journey-map.js?v=333c389862",
  "data/journey-media.js?v=333c389862",
  "data/souvenirs.js?v=333c389862",
  "erhua.js?v=333c389862",
  "pinyin.js?v=333c389862",
  "data/pinyin-course.js?v=333c389862",
  "data/pinyin-chart.js?v=333c389862",
  "data/exam-media.js?v=333c389862",
  "data/exam-art.js?v=333c389862",
  "data/neutral-alt.js?v=333c389862",
  "data/path-scenes.js?v=333c389862",
  "data/speak-scenes.js?v=333c389862",
  "data/art.js?v=333c389862",
  "data/path.js?v=333c389862",
  "app.js?v=333c389862",
  "styles.css?v=333c389862",
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

const SIZES = {"index.html":243926,"boot-check.js?v=333c389862":5966,"vendor/morphdom-umd.min.js?v=333c389862":12165,"runtime.js?v=333c389862":5264,"config.js?v=333c389862":405,"friends.js?v=333c389862":12085,"level.js?v=333c389862":5557,"placement.js?v=333c389862":10785,"data/hsk1-words.js?v=333c389862":196551,"data/hsk1-grammar.js?v=333c389862":125845,"data/hsk1-webs.js?v=333c389862":66524,"data/hsk1-speak.js?v=333c389862":15703,"data/hsk1-listen.js?v=333c389862":21501,"data/hsk1-exam.js?v=333c389862":31376,"data/hsk1-erhua.js?v=333c389862":2265,"data/lexicon.js?v=333c389862":2689,"data/char-glosses.js?v=333c389862":13345,"data/hsk2-preview.js?v=333c389862":7777,"data/hsk3-preview.js?v=333c389862":22270,"data/hsk4-preview.js?v=333c389862":35946,"data/hsk2-words.js?v=333c389862":111924,"data/hsk2-speak.js?v=333c389862":16960,"data/hsk2-listen.js?v=333c389862":32734,"data/hsk2-exam.js?v=333c389862":51948,"data/hsk2-grammar.js?v=333c389862":112471,"data/hsk2-webs.js?v=333c389862":47370,"data/hsk3-words.js?v=333c389862":318373,"data/hsk3-speak.js?v=333c389862":19052,"data/hsk3-listen.js?v=333c389862":55657,"data/hsk3-exam.js?v=333c389862":84397,"data/hsk3-grammar.js?v=333c389862":163260,"data/hsk3-webs.js?v=333c389862":102429,"data/hsk4-words.js?v=333c389862":681354,"data/hsk4-speak.js?v=333c389862":19752,"data/hsk4-listen.js?v=333c389862":97490,"data/hsk4-exam.js?v=333c389862":105197,"data/hsk4-grammar.js?v=333c389862":180251,"data/hsk4-webs.js?v=333c389862":139086,"ascent.js?v=333c389862":13144,"secrets.js?v=333c389862":3605,"sync.js?v=333c389862":19251,"data/audio-manifest.js?v=333c389862":641917,"journey.js?v=333c389862":24675,"data/journey.js?v=333c389862":366786,"data/journey-map.js?v=333c389862":213513,"data/journey-media.js?v=333c389862":392929,"data/souvenirs.js?v=333c389862":145718,"erhua.js?v=333c389862":6316,"pinyin.js?v=333c389862":2120,"data/pinyin-course.js?v=333c389862":18822,"data/pinyin-chart.js?v=333c389862":21938,"data/exam-media.js?v=333c389862":1855,"data/exam-art.js?v=333c389862":113483,"data/neutral-alt.js?v=333c389862":2649,"data/path-scenes.js?v=333c389862":180823,"data/speak-scenes.js?v=333c389862":233932,"data/art.js?v=333c389862":25281,"data/path.js?v=333c389862":80001,"app.js?v=333c389862":510183,"styles.css?v=333c389862":208404,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
