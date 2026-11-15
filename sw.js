/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'da73bcd68d';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=da73bcd68d",
  "vendor/morphdom-umd.min.js?v=da73bcd68d",
  "runtime.js?v=da73bcd68d",
  "config.js?v=da73bcd68d",
  "friends.js?v=da73bcd68d",
  "level.js?v=da73bcd68d",
  "placement.js?v=da73bcd68d",
  "data/hsk1-words.js?v=da73bcd68d",
  "data/hsk1-grammar.js?v=da73bcd68d",
  "data/hsk1-webs.js?v=da73bcd68d",
  "data/hsk1-speak.js?v=da73bcd68d",
  "data/hsk1-listen.js?v=da73bcd68d",
  "data/hsk1-exam.js?v=da73bcd68d",
  "data/hsk1-erhua.js?v=da73bcd68d",
  "data/lexicon.js?v=da73bcd68d",
  "data/char-glosses.js?v=da73bcd68d",
  "data/hsk2-preview.js?v=da73bcd68d",
  "data/hsk3-preview.js?v=da73bcd68d",
  "data/hsk4-preview.js?v=da73bcd68d",
  "data/hsk2-words.js?v=da73bcd68d",
  "data/hsk2-speak.js?v=da73bcd68d",
  "data/hsk2-listen.js?v=da73bcd68d",
  "data/hsk2-exam.js?v=da73bcd68d",
  "data/hsk2-grammar.js?v=da73bcd68d",
  "data/hsk2-webs.js?v=da73bcd68d",
  "data/hsk3-words.js?v=da73bcd68d",
  "data/hsk3-speak.js?v=da73bcd68d",
  "data/hsk3-listen.js?v=da73bcd68d",
  "data/hsk3-exam.js?v=da73bcd68d",
  "data/hsk3-grammar.js?v=da73bcd68d",
  "data/hsk3-webs.js?v=da73bcd68d",
  "data/hsk4-words.js?v=da73bcd68d",
  "data/hsk4-speak.js?v=da73bcd68d",
  "data/hsk4-listen.js?v=da73bcd68d",
  "data/hsk4-exam.js?v=da73bcd68d",
  "data/hsk4-grammar.js?v=da73bcd68d",
  "data/hsk4-webs.js?v=da73bcd68d",
  "ascent.js?v=da73bcd68d",
  "secrets.js?v=da73bcd68d",
  "sync.js?v=da73bcd68d",
  "data/audio-manifest.js?v=da73bcd68d",
  "jyscene.js?v=da73bcd68d",
  "journey.js?v=da73bcd68d",
  "stampart.js?v=da73bcd68d",
  "feastart.js?v=da73bcd68d",
  "feastscene.js?v=da73bcd68d",
  "feastthemes.js?v=da73bcd68d",
  "feastthemes2.js?v=da73bcd68d",
  "data/journey.js?v=da73bcd68d",
  "data/journey-map.js?v=da73bcd68d",
  "data/journey-media.js?v=da73bcd68d",
  "data/souvenirs.js?v=da73bcd68d",
  "erhua.js?v=da73bcd68d",
  "pinyin.js?v=da73bcd68d",
  "data/pinyin-course.js?v=da73bcd68d",
  "data/pinyin-chart.js?v=da73bcd68d",
  "data/exam-media.js?v=da73bcd68d",
  "data/exam-art.js?v=da73bcd68d",
  "data/neutral-alt.js?v=da73bcd68d",
  "data/path-scenes.js?v=da73bcd68d",
  "data/speak-scenes.js?v=da73bcd68d",
  "data/art.js?v=da73bcd68d",
  "data/path.js?v=da73bcd68d",
  "app.js?v=da73bcd68d",
  "styles.css?v=da73bcd68d",
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

const SIZES = {"index.html":251521,"boot-check.js?v=da73bcd68d":5966,"vendor/morphdom-umd.min.js?v=da73bcd68d":12165,"runtime.js?v=da73bcd68d":5515,"config.js?v=da73bcd68d":405,"friends.js?v=da73bcd68d":12085,"level.js?v=da73bcd68d":5557,"placement.js?v=da73bcd68d":10785,"data/hsk1-words.js?v=da73bcd68d":196551,"data/hsk1-grammar.js?v=da73bcd68d":125845,"data/hsk1-webs.js?v=da73bcd68d":66524,"data/hsk1-speak.js?v=da73bcd68d":15703,"data/hsk1-listen.js?v=da73bcd68d":21501,"data/hsk1-exam.js?v=da73bcd68d":31376,"data/hsk1-erhua.js?v=da73bcd68d":2265,"data/lexicon.js?v=da73bcd68d":2689,"data/char-glosses.js?v=da73bcd68d":13345,"data/hsk2-preview.js?v=da73bcd68d":7777,"data/hsk3-preview.js?v=da73bcd68d":22270,"data/hsk4-preview.js?v=da73bcd68d":35946,"data/hsk2-words.js?v=da73bcd68d":111924,"data/hsk2-speak.js?v=da73bcd68d":16960,"data/hsk2-listen.js?v=da73bcd68d":32734,"data/hsk2-exam.js?v=da73bcd68d":51948,"data/hsk2-grammar.js?v=da73bcd68d":112471,"data/hsk2-webs.js?v=da73bcd68d":47370,"data/hsk3-words.js?v=da73bcd68d":318373,"data/hsk3-speak.js?v=da73bcd68d":19052,"data/hsk3-listen.js?v=da73bcd68d":55657,"data/hsk3-exam.js?v=da73bcd68d":84397,"data/hsk3-grammar.js?v=da73bcd68d":163260,"data/hsk3-webs.js?v=da73bcd68d":102429,"data/hsk4-words.js?v=da73bcd68d":681354,"data/hsk4-speak.js?v=da73bcd68d":19752,"data/hsk4-listen.js?v=da73bcd68d":97490,"data/hsk4-exam.js?v=da73bcd68d":105197,"data/hsk4-grammar.js?v=da73bcd68d":180251,"data/hsk4-webs.js?v=da73bcd68d":139086,"ascent.js?v=da73bcd68d":13144,"secrets.js?v=da73bcd68d":3605,"sync.js?v=da73bcd68d":19251,"data/audio-manifest.js?v=da73bcd68d":641917,"jyscene.js?v=da73bcd68d":42327,"journey.js?v=da73bcd68d":24675,"stampart.js?v=da73bcd68d":63410,"feastart.js?v=da73bcd68d":43900,"feastscene.js?v=da73bcd68d":42123,"feastthemes.js?v=da73bcd68d":24542,"feastthemes2.js?v=da73bcd68d":27066,"data/journey.js?v=da73bcd68d":366786,"data/journey-map.js?v=da73bcd68d":213513,"data/journey-media.js?v=da73bcd68d":392929,"data/souvenirs.js?v=da73bcd68d":145718,"erhua.js?v=da73bcd68d":6316,"pinyin.js?v=da73bcd68d":2120,"data/pinyin-course.js?v=da73bcd68d":18822,"data/pinyin-chart.js?v=da73bcd68d":21938,"data/exam-media.js?v=da73bcd68d":1855,"data/exam-art.js?v=da73bcd68d":113483,"data/neutral-alt.js?v=da73bcd68d":2649,"data/path-scenes.js?v=da73bcd68d":180823,"data/speak-scenes.js?v=da73bcd68d":233932,"data/art.js?v=da73bcd68d":25281,"data/path.js?v=da73bcd68d":80001,"app.js?v=da73bcd68d":538388,"styles.css?v=da73bcd68d":254124,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
