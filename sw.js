/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'ef7b5185d8';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=ef7b5185d8",
  "vendor/morphdom-umd.min.js?v=ef7b5185d8",
  "runtime.js?v=ef7b5185d8",
  "config.js?v=ef7b5185d8",
  "friends.js?v=ef7b5185d8",
  "level.js?v=ef7b5185d8",
  "placement.js?v=ef7b5185d8",
  "data/hsk1-words.js?v=ef7b5185d8",
  "data/hsk1-grammar.js?v=ef7b5185d8",
  "data/hsk1-webs.js?v=ef7b5185d8",
  "data/hsk1-speak.js?v=ef7b5185d8",
  "data/hsk1-listen.js?v=ef7b5185d8",
  "data/hsk1-exam.js?v=ef7b5185d8",
  "data/hsk1-erhua.js?v=ef7b5185d8",
  "data/lexicon.js?v=ef7b5185d8",
  "data/char-glosses.js?v=ef7b5185d8",
  "data/hsk2-preview.js?v=ef7b5185d8",
  "data/hsk3-preview.js?v=ef7b5185d8",
  "data/hsk4-preview.js?v=ef7b5185d8",
  "data/hsk2-words.js?v=ef7b5185d8",
  "data/hsk2-speak.js?v=ef7b5185d8",
  "data/hsk2-listen.js?v=ef7b5185d8",
  "data/hsk2-exam.js?v=ef7b5185d8",
  "data/hsk2-grammar.js?v=ef7b5185d8",
  "data/hsk2-webs.js?v=ef7b5185d8",
  "data/hsk3-words.js?v=ef7b5185d8",
  "data/hsk3-speak.js?v=ef7b5185d8",
  "data/hsk3-listen.js?v=ef7b5185d8",
  "data/hsk3-exam.js?v=ef7b5185d8",
  "data/hsk3-grammar.js?v=ef7b5185d8",
  "data/hsk3-webs.js?v=ef7b5185d8",
  "data/hsk4-words.js?v=ef7b5185d8",
  "data/hsk4-speak.js?v=ef7b5185d8",
  "data/hsk4-listen.js?v=ef7b5185d8",
  "data/hsk4-exam.js?v=ef7b5185d8",
  "data/hsk4-grammar.js?v=ef7b5185d8",
  "data/hsk4-webs.js?v=ef7b5185d8",
  "ascent.js?v=ef7b5185d8",
  "secrets.js?v=ef7b5185d8",
  "sync.js?v=ef7b5185d8",
  "data/audio-manifest.js?v=ef7b5185d8",
  "journey.js?v=ef7b5185d8",
  "stampart.js?v=ef7b5185d8",
  "feastart.js?v=ef7b5185d8",
  "feastscene.js?v=ef7b5185d8",
  "feastthemes.js?v=ef7b5185d8",
  "feastthemes2.js?v=ef7b5185d8",
  "data/journey.js?v=ef7b5185d8",
  "data/journey-map.js?v=ef7b5185d8",
  "data/journey-media.js?v=ef7b5185d8",
  "data/souvenirs.js?v=ef7b5185d8",
  "erhua.js?v=ef7b5185d8",
  "pinyin.js?v=ef7b5185d8",
  "data/pinyin-course.js?v=ef7b5185d8",
  "data/pinyin-chart.js?v=ef7b5185d8",
  "data/exam-media.js?v=ef7b5185d8",
  "data/exam-art.js?v=ef7b5185d8",
  "data/neutral-alt.js?v=ef7b5185d8",
  "data/path-scenes.js?v=ef7b5185d8",
  "data/speak-scenes.js?v=ef7b5185d8",
  "data/art.js?v=ef7b5185d8",
  "data/path.js?v=ef7b5185d8",
  "app.js?v=ef7b5185d8",
  "styles.css?v=ef7b5185d8",
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

const SIZES = {"index.html":250459,"boot-check.js?v=ef7b5185d8":5966,"vendor/morphdom-umd.min.js?v=ef7b5185d8":12165,"runtime.js?v=ef7b5185d8":5515,"config.js?v=ef7b5185d8":405,"friends.js?v=ef7b5185d8":12085,"level.js?v=ef7b5185d8":5557,"placement.js?v=ef7b5185d8":10785,"data/hsk1-words.js?v=ef7b5185d8":196551,"data/hsk1-grammar.js?v=ef7b5185d8":125845,"data/hsk1-webs.js?v=ef7b5185d8":66524,"data/hsk1-speak.js?v=ef7b5185d8":15703,"data/hsk1-listen.js?v=ef7b5185d8":21501,"data/hsk1-exam.js?v=ef7b5185d8":31376,"data/hsk1-erhua.js?v=ef7b5185d8":2265,"data/lexicon.js?v=ef7b5185d8":2689,"data/char-glosses.js?v=ef7b5185d8":13345,"data/hsk2-preview.js?v=ef7b5185d8":7777,"data/hsk3-preview.js?v=ef7b5185d8":22270,"data/hsk4-preview.js?v=ef7b5185d8":35946,"data/hsk2-words.js?v=ef7b5185d8":111924,"data/hsk2-speak.js?v=ef7b5185d8":16960,"data/hsk2-listen.js?v=ef7b5185d8":32734,"data/hsk2-exam.js?v=ef7b5185d8":51948,"data/hsk2-grammar.js?v=ef7b5185d8":112471,"data/hsk2-webs.js?v=ef7b5185d8":47370,"data/hsk3-words.js?v=ef7b5185d8":318373,"data/hsk3-speak.js?v=ef7b5185d8":19052,"data/hsk3-listen.js?v=ef7b5185d8":55657,"data/hsk3-exam.js?v=ef7b5185d8":84397,"data/hsk3-grammar.js?v=ef7b5185d8":163260,"data/hsk3-webs.js?v=ef7b5185d8":102429,"data/hsk4-words.js?v=ef7b5185d8":681354,"data/hsk4-speak.js?v=ef7b5185d8":19752,"data/hsk4-listen.js?v=ef7b5185d8":97490,"data/hsk4-exam.js?v=ef7b5185d8":105197,"data/hsk4-grammar.js?v=ef7b5185d8":180251,"data/hsk4-webs.js?v=ef7b5185d8":139086,"ascent.js?v=ef7b5185d8":13144,"secrets.js?v=ef7b5185d8":3605,"sync.js?v=ef7b5185d8":19251,"data/audio-manifest.js?v=ef7b5185d8":641917,"journey.js?v=ef7b5185d8":24675,"stampart.js?v=ef7b5185d8":63410,"feastart.js?v=ef7b5185d8":43900,"feastscene.js?v=ef7b5185d8":40282,"feastthemes.js?v=ef7b5185d8":24542,"feastthemes2.js?v=ef7b5185d8":27066,"data/journey.js?v=ef7b5185d8":366786,"data/journey-map.js?v=ef7b5185d8":213513,"data/journey-media.js?v=ef7b5185d8":392929,"data/souvenirs.js?v=ef7b5185d8":145718,"erhua.js?v=ef7b5185d8":6316,"pinyin.js?v=ef7b5185d8":2120,"data/pinyin-course.js?v=ef7b5185d8":18822,"data/pinyin-chart.js?v=ef7b5185d8":21938,"data/exam-media.js?v=ef7b5185d8":1855,"data/exam-art.js?v=ef7b5185d8":113483,"data/neutral-alt.js?v=ef7b5185d8":2649,"data/path-scenes.js?v=ef7b5185d8":180823,"data/speak-scenes.js?v=ef7b5185d8":233932,"data/art.js?v=ef7b5185d8":25281,"data/path.js?v=ef7b5185d8":80001,"app.js?v=ef7b5185d8":526300,"styles.css?v=ef7b5185d8":240239,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
