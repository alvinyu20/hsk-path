/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '9a70aae0ae';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=9a70aae0ae",
  "vendor/morphdom-umd.min.js?v=9a70aae0ae",
  "runtime.js?v=9a70aae0ae",
  "config.js?v=9a70aae0ae",
  "friends.js?v=9a70aae0ae",
  "level.js?v=9a70aae0ae",
  "placement.js?v=9a70aae0ae",
  "data/hsk1-words.js?v=9a70aae0ae",
  "data/hsk1-grammar.js?v=9a70aae0ae",
  "data/hsk1-webs.js?v=9a70aae0ae",
  "data/hsk1-speak.js?v=9a70aae0ae",
  "data/hsk1-listen.js?v=9a70aae0ae",
  "data/hsk1-exam.js?v=9a70aae0ae",
  "data/hsk1-erhua.js?v=9a70aae0ae",
  "data/lexicon.js?v=9a70aae0ae",
  "data/char-glosses.js?v=9a70aae0ae",
  "data/hsk2-preview.js?v=9a70aae0ae",
  "data/hsk3-preview.js?v=9a70aae0ae",
  "data/hsk4-preview.js?v=9a70aae0ae",
  "data/hsk5-preview.js?v=9a70aae0ae",
  "data/hsk2-words.js?v=9a70aae0ae",
  "data/hsk2-speak.js?v=9a70aae0ae",
  "data/hsk2-listen.js?v=9a70aae0ae",
  "data/hsk2-exam.js?v=9a70aae0ae",
  "data/hsk2-grammar.js?v=9a70aae0ae",
  "data/hsk2-webs.js?v=9a70aae0ae",
  "data/hsk3-words.js?v=9a70aae0ae",
  "data/hsk3-speak.js?v=9a70aae0ae",
  "data/hsk3-listen.js?v=9a70aae0ae",
  "data/hsk3-exam.js?v=9a70aae0ae",
  "data/hsk3-grammar.js?v=9a70aae0ae",
  "data/hsk3-webs.js?v=9a70aae0ae",
  "data/hsk4-words.js?v=9a70aae0ae",
  "data/hsk4-speak.js?v=9a70aae0ae",
  "data/hsk4-listen.js?v=9a70aae0ae",
  "data/hsk4-exam.js?v=9a70aae0ae",
  "data/hsk4-grammar.js?v=9a70aae0ae",
  "data/hsk4-webs.js?v=9a70aae0ae",
  "data/hsk5-words.js?v=9a70aae0ae",
  "data/hsk5-speak.js?v=9a70aae0ae",
  "data/hsk5-listen.js?v=9a70aae0ae",
  "data/hsk5-exam.js?v=9a70aae0ae",
  "data/hsk5-grammar.js?v=9a70aae0ae",
  "data/hsk5-webs.js?v=9a70aae0ae",
  "ascent.js?v=9a70aae0ae",
  "secrets.js?v=9a70aae0ae",
  "sync.js?v=9a70aae0ae",
  "data/audio-manifest.js?v=9a70aae0ae",
  "jyscene.js?v=9a70aae0ae",
  "journey.js?v=9a70aae0ae",
  "stampart.js?v=9a70aae0ae",
  "feastart.js?v=9a70aae0ae",
  "feastscene.js?v=9a70aae0ae",
  "feastthemes.js?v=9a70aae0ae",
  "feastthemes2.js?v=9a70aae0ae",
  "data/journey.js?v=9a70aae0ae",
  "data/journey-map.js?v=9a70aae0ae",
  "data/journey-media.js?v=9a70aae0ae",
  "data/souvenirs.js?v=9a70aae0ae",
  "erhua.js?v=9a70aae0ae",
  "pinyin.js?v=9a70aae0ae",
  "data/pinyin-course.js?v=9a70aae0ae",
  "data/pinyin-chart.js?v=9a70aae0ae",
  "data/exam-media.js?v=9a70aae0ae",
  "data/exam-art.js?v=9a70aae0ae",
  "data/neutral-alt.js?v=9a70aae0ae",
  "data/path-scenes.js?v=9a70aae0ae",
  "data/speak-scenes.js?v=9a70aae0ae",
  "data/art.js?v=9a70aae0ae",
  "data/path.js?v=9a70aae0ae",
  "app.js?v=9a70aae0ae",
  "styles.css?v=9a70aae0ae",
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

const SIZES = {"index.html":259606,"boot-check.js?v=9a70aae0ae":5966,"vendor/morphdom-umd.min.js?v=9a70aae0ae":12165,"runtime.js?v=9a70aae0ae":5515,"config.js?v=9a70aae0ae":405,"friends.js?v=9a70aae0ae":12135,"level.js?v=9a70aae0ae":6123,"placement.js?v=9a70aae0ae":10785,"data/hsk1-words.js?v=9a70aae0ae":196551,"data/hsk1-grammar.js?v=9a70aae0ae":208049,"data/hsk1-webs.js?v=9a70aae0ae":66528,"data/hsk1-speak.js?v=9a70aae0ae":15703,"data/hsk1-listen.js?v=9a70aae0ae":37488,"data/hsk1-exam.js?v=9a70aae0ae":31376,"data/hsk1-erhua.js?v=9a70aae0ae":2710,"data/lexicon.js?v=9a70aae0ae":4967,"data/char-glosses.js?v=9a70aae0ae":20086,"data/hsk2-preview.js?v=9a70aae0ae":7777,"data/hsk3-preview.js?v=9a70aae0ae":22270,"data/hsk4-preview.js?v=9a70aae0ae":35946,"data/hsk5-preview.js?v=9a70aae0ae":59071,"data/hsk2-words.js?v=9a70aae0ae":111924,"data/hsk2-speak.js?v=9a70aae0ae":16960,"data/hsk2-listen.js?v=9a70aae0ae":54080,"data/hsk2-exam.js?v=9a70aae0ae":51948,"data/hsk2-grammar.js?v=9a70aae0ae":190477,"data/hsk2-webs.js?v=9a70aae0ae":47374,"data/hsk3-words.js?v=9a70aae0ae":318373,"data/hsk3-speak.js?v=9a70aae0ae":19052,"data/hsk3-listen.js?v=9a70aae0ae":78302,"data/hsk3-exam.js?v=9a70aae0ae":84397,"data/hsk3-grammar.js?v=9a70aae0ae":275475,"data/hsk3-webs.js?v=9a70aae0ae":102435,"data/hsk4-words.js?v=9a70aae0ae":681301,"data/hsk4-speak.js?v=9a70aae0ae":19752,"data/hsk4-listen.js?v=9a70aae0ae":121146,"data/hsk4-exam.js?v=9a70aae0ae":105199,"data/hsk4-grammar.js?v=9a70aae0ae":315861,"data/hsk4-webs.js?v=9a70aae0ae":139093,"data/hsk5-words.js?v=9a70aae0ae":1311261,"data/hsk5-speak.js?v=9a70aae0ae":26686,"data/hsk5-listen.js?v=9a70aae0ae":196703,"data/hsk5-exam.js?v=9a70aae0ae":188028,"data/hsk5-grammar.js?v=9a70aae0ae":419286,"data/hsk5-webs.js?v=9a70aae0ae":187837,"ascent.js?v=9a70aae0ae":13144,"secrets.js?v=9a70aae0ae":3605,"sync.js?v=9a70aae0ae":19251,"data/audio-manifest.js?v=9a70aae0ae":641917,"jyscene.js?v=9a70aae0ae":42327,"journey.js?v=9a70aae0ae":24675,"stampart.js?v=9a70aae0ae":63410,"feastart.js?v=9a70aae0ae":43900,"feastscene.js?v=9a70aae0ae":42123,"feastthemes.js?v=9a70aae0ae":24542,"feastthemes2.js?v=9a70aae0ae":27066,"data/journey.js?v=9a70aae0ae":366786,"data/journey-map.js?v=9a70aae0ae":213513,"data/journey-media.js?v=9a70aae0ae":392929,"data/souvenirs.js?v=9a70aae0ae":145718,"erhua.js?v=9a70aae0ae":6311,"pinyin.js?v=9a70aae0ae":2120,"data/pinyin-course.js?v=9a70aae0ae":18822,"data/pinyin-chart.js?v=9a70aae0ae":27967,"data/exam-media.js?v=9a70aae0ae":1855,"data/exam-art.js?v=9a70aae0ae":113483,"data/neutral-alt.js?v=9a70aae0ae":5359,"data/path-scenes.js?v=9a70aae0ae":280647,"data/speak-scenes.js?v=9a70aae0ae":296008,"data/art.js?v=9a70aae0ae":25281,"data/path.js?v=9a70aae0ae":135883,"app.js?v=9a70aae0ae":549467,"styles.css?v=9a70aae0ae":272327,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
