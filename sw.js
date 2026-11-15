/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'e0a3b0d9ad';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=e0a3b0d9ad",
  "vendor/morphdom-umd.min.js?v=e0a3b0d9ad",
  "runtime.js?v=e0a3b0d9ad",
  "config.js?v=e0a3b0d9ad",
  "friends.js?v=e0a3b0d9ad",
  "level.js?v=e0a3b0d9ad",
  "placement.js?v=e0a3b0d9ad",
  "data/hsk1-words.js?v=e0a3b0d9ad",
  "data/hsk1-grammar.js?v=e0a3b0d9ad",
  "data/hsk1-webs.js?v=e0a3b0d9ad",
  "data/hsk1-speak.js?v=e0a3b0d9ad",
  "data/hsk1-listen.js?v=e0a3b0d9ad",
  "data/hsk1-exam.js?v=e0a3b0d9ad",
  "data/hsk1-erhua.js?v=e0a3b0d9ad",
  "data/lexicon.js?v=e0a3b0d9ad",
  "data/char-glosses.js?v=e0a3b0d9ad",
  "data/hsk2-preview.js?v=e0a3b0d9ad",
  "data/hsk3-preview.js?v=e0a3b0d9ad",
  "data/hsk4-preview.js?v=e0a3b0d9ad",
  "data/hsk2-words.js?v=e0a3b0d9ad",
  "data/hsk2-speak.js?v=e0a3b0d9ad",
  "data/hsk2-listen.js?v=e0a3b0d9ad",
  "data/hsk2-exam.js?v=e0a3b0d9ad",
  "data/hsk2-grammar.js?v=e0a3b0d9ad",
  "data/hsk2-webs.js?v=e0a3b0d9ad",
  "data/hsk3-words.js?v=e0a3b0d9ad",
  "data/hsk3-speak.js?v=e0a3b0d9ad",
  "data/hsk3-listen.js?v=e0a3b0d9ad",
  "data/hsk3-exam.js?v=e0a3b0d9ad",
  "data/hsk3-grammar.js?v=e0a3b0d9ad",
  "data/hsk3-webs.js?v=e0a3b0d9ad",
  "data/hsk4-words.js?v=e0a3b0d9ad",
  "data/hsk4-speak.js?v=e0a3b0d9ad",
  "data/hsk4-listen.js?v=e0a3b0d9ad",
  "data/hsk4-exam.js?v=e0a3b0d9ad",
  "data/hsk4-grammar.js?v=e0a3b0d9ad",
  "data/hsk4-webs.js?v=e0a3b0d9ad",
  "ascent.js?v=e0a3b0d9ad",
  "secrets.js?v=e0a3b0d9ad",
  "sync.js?v=e0a3b0d9ad",
  "data/audio-manifest.js?v=e0a3b0d9ad",
  "jyscene.js?v=e0a3b0d9ad",
  "journey.js?v=e0a3b0d9ad",
  "stampart.js?v=e0a3b0d9ad",
  "feastart.js?v=e0a3b0d9ad",
  "feastscene.js?v=e0a3b0d9ad",
  "feastthemes.js?v=e0a3b0d9ad",
  "feastthemes2.js?v=e0a3b0d9ad",
  "data/journey.js?v=e0a3b0d9ad",
  "data/journey-map.js?v=e0a3b0d9ad",
  "data/journey-media.js?v=e0a3b0d9ad",
  "data/souvenirs.js?v=e0a3b0d9ad",
  "erhua.js?v=e0a3b0d9ad",
  "pinyin.js?v=e0a3b0d9ad",
  "data/pinyin-course.js?v=e0a3b0d9ad",
  "data/pinyin-chart.js?v=e0a3b0d9ad",
  "data/exam-media.js?v=e0a3b0d9ad",
  "data/exam-art.js?v=e0a3b0d9ad",
  "data/neutral-alt.js?v=e0a3b0d9ad",
  "data/path-scenes.js?v=e0a3b0d9ad",
  "data/speak-scenes.js?v=e0a3b0d9ad",
  "data/art.js?v=e0a3b0d9ad",
  "data/path.js?v=e0a3b0d9ad",
  "app.js?v=e0a3b0d9ad",
  "styles.css?v=e0a3b0d9ad",
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

const SIZES = {"index.html":248948,"boot-check.js?v=e0a3b0d9ad":5966,"vendor/morphdom-umd.min.js?v=e0a3b0d9ad":12165,"runtime.js?v=e0a3b0d9ad":5515,"config.js?v=e0a3b0d9ad":405,"friends.js?v=e0a3b0d9ad":12085,"level.js?v=e0a3b0d9ad":5557,"placement.js?v=e0a3b0d9ad":10785,"data/hsk1-words.js?v=e0a3b0d9ad":196551,"data/hsk1-grammar.js?v=e0a3b0d9ad":125845,"data/hsk1-webs.js?v=e0a3b0d9ad":66524,"data/hsk1-speak.js?v=e0a3b0d9ad":15703,"data/hsk1-listen.js?v=e0a3b0d9ad":21501,"data/hsk1-exam.js?v=e0a3b0d9ad":31376,"data/hsk1-erhua.js?v=e0a3b0d9ad":2265,"data/lexicon.js?v=e0a3b0d9ad":2689,"data/char-glosses.js?v=e0a3b0d9ad":13345,"data/hsk2-preview.js?v=e0a3b0d9ad":7777,"data/hsk3-preview.js?v=e0a3b0d9ad":22270,"data/hsk4-preview.js?v=e0a3b0d9ad":35946,"data/hsk2-words.js?v=e0a3b0d9ad":111924,"data/hsk2-speak.js?v=e0a3b0d9ad":16960,"data/hsk2-listen.js?v=e0a3b0d9ad":32734,"data/hsk2-exam.js?v=e0a3b0d9ad":51948,"data/hsk2-grammar.js?v=e0a3b0d9ad":112471,"data/hsk2-webs.js?v=e0a3b0d9ad":47370,"data/hsk3-words.js?v=e0a3b0d9ad":318373,"data/hsk3-speak.js?v=e0a3b0d9ad":19052,"data/hsk3-listen.js?v=e0a3b0d9ad":55657,"data/hsk3-exam.js?v=e0a3b0d9ad":84397,"data/hsk3-grammar.js?v=e0a3b0d9ad":163260,"data/hsk3-webs.js?v=e0a3b0d9ad":102429,"data/hsk4-words.js?v=e0a3b0d9ad":681354,"data/hsk4-speak.js?v=e0a3b0d9ad":19752,"data/hsk4-listen.js?v=e0a3b0d9ad":97490,"data/hsk4-exam.js?v=e0a3b0d9ad":105197,"data/hsk4-grammar.js?v=e0a3b0d9ad":180251,"data/hsk4-webs.js?v=e0a3b0d9ad":139086,"ascent.js?v=e0a3b0d9ad":13144,"secrets.js?v=e0a3b0d9ad":3605,"sync.js?v=e0a3b0d9ad":19251,"data/audio-manifest.js?v=e0a3b0d9ad":641917,"jyscene.js?v=e0a3b0d9ad":42327,"journey.js?v=e0a3b0d9ad":24675,"stampart.js?v=e0a3b0d9ad":63410,"feastart.js?v=e0a3b0d9ad":43900,"feastscene.js?v=e0a3b0d9ad":42123,"feastthemes.js?v=e0a3b0d9ad":24542,"feastthemes2.js?v=e0a3b0d9ad":27066,"data/journey.js?v=e0a3b0d9ad":366786,"data/journey-map.js?v=e0a3b0d9ad":213513,"data/journey-media.js?v=e0a3b0d9ad":392929,"data/souvenirs.js?v=e0a3b0d9ad":145718,"erhua.js?v=e0a3b0d9ad":6316,"pinyin.js?v=e0a3b0d9ad":2120,"data/pinyin-course.js?v=e0a3b0d9ad":18822,"data/pinyin-chart.js?v=e0a3b0d9ad":21938,"data/exam-media.js?v=e0a3b0d9ad":1855,"data/exam-art.js?v=e0a3b0d9ad":113483,"data/neutral-alt.js?v=e0a3b0d9ad":2649,"data/path-scenes.js?v=e0a3b0d9ad":180823,"data/speak-scenes.js?v=e0a3b0d9ad":233932,"data/art.js?v=e0a3b0d9ad":25281,"data/path.js?v=e0a3b0d9ad":80001,"app.js?v=e0a3b0d9ad":532214,"styles.css?v=e0a3b0d9ad":249213,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
