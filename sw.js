/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'c4153340ec';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=c4153340ec",
  "vendor/morphdom-umd.min.js?v=c4153340ec",
  "runtime.js?v=c4153340ec",
  "config.js?v=c4153340ec",
  "friends.js?v=c4153340ec",
  "level.js?v=c4153340ec",
  "placement.js?v=c4153340ec",
  "data/hsk1-words.js?v=c4153340ec",
  "data/hsk1-grammar.js?v=c4153340ec",
  "data/hsk1-webs.js?v=c4153340ec",
  "data/hsk1-speak.js?v=c4153340ec",
  "data/hsk1-listen.js?v=c4153340ec",
  "data/hsk1-exam.js?v=c4153340ec",
  "data/hsk1-erhua.js?v=c4153340ec",
  "data/lexicon.js?v=c4153340ec",
  "data/char-glosses.js?v=c4153340ec",
  "data/hsk2-preview.js?v=c4153340ec",
  "data/hsk3-preview.js?v=c4153340ec",
  "data/hsk4-preview.js?v=c4153340ec",
  "data/hsk2-words.js?v=c4153340ec",
  "data/hsk2-speak.js?v=c4153340ec",
  "data/hsk2-listen.js?v=c4153340ec",
  "data/hsk2-exam.js?v=c4153340ec",
  "data/hsk2-grammar.js?v=c4153340ec",
  "data/hsk2-webs.js?v=c4153340ec",
  "data/hsk3-words.js?v=c4153340ec",
  "data/hsk3-speak.js?v=c4153340ec",
  "data/hsk3-listen.js?v=c4153340ec",
  "data/hsk3-exam.js?v=c4153340ec",
  "data/hsk3-grammar.js?v=c4153340ec",
  "data/hsk3-webs.js?v=c4153340ec",
  "data/hsk4-words.js?v=c4153340ec",
  "data/hsk4-speak.js?v=c4153340ec",
  "data/hsk4-listen.js?v=c4153340ec",
  "data/hsk4-exam.js?v=c4153340ec",
  "data/hsk4-grammar.js?v=c4153340ec",
  "data/hsk4-webs.js?v=c4153340ec",
  "ascent.js?v=c4153340ec",
  "secrets.js?v=c4153340ec",
  "sync.js?v=c4153340ec",
  "data/audio-manifest.js?v=c4153340ec",
  "journey.js?v=c4153340ec",
  "stampart.js?v=c4153340ec",
  "feastart.js?v=c4153340ec",
  "feastscene.js?v=c4153340ec",
  "feastthemes.js?v=c4153340ec",
  "feastthemes2.js?v=c4153340ec",
  "data/journey.js?v=c4153340ec",
  "data/journey-map.js?v=c4153340ec",
  "data/journey-media.js?v=c4153340ec",
  "data/souvenirs.js?v=c4153340ec",
  "erhua.js?v=c4153340ec",
  "pinyin.js?v=c4153340ec",
  "data/pinyin-course.js?v=c4153340ec",
  "data/pinyin-chart.js?v=c4153340ec",
  "data/exam-media.js?v=c4153340ec",
  "data/exam-art.js?v=c4153340ec",
  "data/neutral-alt.js?v=c4153340ec",
  "data/path-scenes.js?v=c4153340ec",
  "data/speak-scenes.js?v=c4153340ec",
  "data/art.js?v=c4153340ec",
  "data/path.js?v=c4153340ec",
  "app.js?v=c4153340ec",
  "styles.css?v=c4153340ec",
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

const SIZES = {"index.html":254237,"boot-check.js?v=c4153340ec":5966,"vendor/morphdom-umd.min.js?v=c4153340ec":12165,"runtime.js?v=c4153340ec":5515,"config.js?v=c4153340ec":405,"friends.js?v=c4153340ec":12085,"level.js?v=c4153340ec":5557,"placement.js?v=c4153340ec":10785,"data/hsk1-words.js?v=c4153340ec":196551,"data/hsk1-grammar.js?v=c4153340ec":125845,"data/hsk1-webs.js?v=c4153340ec":66524,"data/hsk1-speak.js?v=c4153340ec":15703,"data/hsk1-listen.js?v=c4153340ec":21501,"data/hsk1-exam.js?v=c4153340ec":31376,"data/hsk1-erhua.js?v=c4153340ec":2265,"data/lexicon.js?v=c4153340ec":2689,"data/char-glosses.js?v=c4153340ec":13345,"data/hsk2-preview.js?v=c4153340ec":7777,"data/hsk3-preview.js?v=c4153340ec":22270,"data/hsk4-preview.js?v=c4153340ec":35946,"data/hsk2-words.js?v=c4153340ec":111924,"data/hsk2-speak.js?v=c4153340ec":16960,"data/hsk2-listen.js?v=c4153340ec":32734,"data/hsk2-exam.js?v=c4153340ec":51948,"data/hsk2-grammar.js?v=c4153340ec":112471,"data/hsk2-webs.js?v=c4153340ec":47370,"data/hsk3-words.js?v=c4153340ec":318373,"data/hsk3-speak.js?v=c4153340ec":19052,"data/hsk3-listen.js?v=c4153340ec":55657,"data/hsk3-exam.js?v=c4153340ec":84397,"data/hsk3-grammar.js?v=c4153340ec":163260,"data/hsk3-webs.js?v=c4153340ec":102429,"data/hsk4-words.js?v=c4153340ec":681354,"data/hsk4-speak.js?v=c4153340ec":19752,"data/hsk4-listen.js?v=c4153340ec":97490,"data/hsk4-exam.js?v=c4153340ec":105197,"data/hsk4-grammar.js?v=c4153340ec":180251,"data/hsk4-webs.js?v=c4153340ec":139086,"ascent.js?v=c4153340ec":13144,"secrets.js?v=c4153340ec":3605,"sync.js?v=c4153340ec":19251,"data/audio-manifest.js?v=c4153340ec":641917,"journey.js?v=c4153340ec":24675,"stampart.js?v=c4153340ec":63410,"feastart.js?v=c4153340ec":43574,"feastscene.js?v=c4153340ec":39406,"feastthemes.js?v=c4153340ec":24542,"feastthemes2.js?v=c4153340ec":27066,"data/journey.js?v=c4153340ec":366786,"data/journey-map.js?v=c4153340ec":213513,"data/journey-media.js?v=c4153340ec":392929,"data/souvenirs.js?v=c4153340ec":145718,"erhua.js?v=c4153340ec":6316,"pinyin.js?v=c4153340ec":2120,"data/pinyin-course.js?v=c4153340ec":18822,"data/pinyin-chart.js?v=c4153340ec":21938,"data/exam-media.js?v=c4153340ec":1855,"data/exam-art.js?v=c4153340ec":113483,"data/neutral-alt.js?v=c4153340ec":2649,"data/path-scenes.js?v=c4153340ec":180823,"data/speak-scenes.js?v=c4153340ec":233932,"data/art.js?v=c4153340ec":25281,"data/path.js?v=c4153340ec":80001,"app.js?v=c4153340ec":527213,"styles.css?v=c4153340ec":239782,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
