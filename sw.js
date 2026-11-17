/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'f6da0e6963';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=f6da0e6963",
  "vendor/morphdom-umd.min.js?v=f6da0e6963",
  "runtime.js?v=f6da0e6963",
  "config.js?v=f6da0e6963",
  "friends.js?v=f6da0e6963",
  "level.js?v=f6da0e6963",
  "placement.js?v=f6da0e6963",
  "data/hsk1-words.js?v=f6da0e6963",
  "data/hsk1-grammar.js?v=f6da0e6963",
  "data/hsk1-webs.js?v=f6da0e6963",
  "data/hsk1-speak.js?v=f6da0e6963",
  "data/hsk1-listen.js?v=f6da0e6963",
  "data/hsk1-exam.js?v=f6da0e6963",
  "data/hsk1-erhua.js?v=f6da0e6963",
  "data/lexicon.js?v=f6da0e6963",
  "data/char-glosses.js?v=f6da0e6963",
  "data/hsk2-preview.js?v=f6da0e6963",
  "data/hsk3-preview.js?v=f6da0e6963",
  "data/hsk4-preview.js?v=f6da0e6963",
  "data/hsk5-preview.js?v=f6da0e6963",
  "data/hsk2-words.js?v=f6da0e6963",
  "data/hsk2-speak.js?v=f6da0e6963",
  "data/hsk2-listen.js?v=f6da0e6963",
  "data/hsk2-exam.js?v=f6da0e6963",
  "data/hsk2-grammar.js?v=f6da0e6963",
  "data/hsk2-webs.js?v=f6da0e6963",
  "data/hsk3-words.js?v=f6da0e6963",
  "data/hsk3-speak.js?v=f6da0e6963",
  "data/hsk3-listen.js?v=f6da0e6963",
  "data/hsk3-exam.js?v=f6da0e6963",
  "data/hsk3-grammar.js?v=f6da0e6963",
  "data/hsk3-webs.js?v=f6da0e6963",
  "data/hsk4-words.js?v=f6da0e6963",
  "data/hsk4-speak.js?v=f6da0e6963",
  "data/hsk4-listen.js?v=f6da0e6963",
  "data/hsk4-exam.js?v=f6da0e6963",
  "data/hsk4-grammar.js?v=f6da0e6963",
  "data/hsk4-webs.js?v=f6da0e6963",
  "data/hsk5-words.js?v=f6da0e6963",
  "data/hsk5-speak.js?v=f6da0e6963",
  "data/hsk5-listen.js?v=f6da0e6963",
  "data/hsk5-exam.js?v=f6da0e6963",
  "data/hsk5-grammar.js?v=f6da0e6963",
  "data/hsk5-webs.js?v=f6da0e6963",
  "ascent.js?v=f6da0e6963",
  "secrets.js?v=f6da0e6963",
  "sync.js?v=f6da0e6963",
  "data/audio-manifest.js?v=f6da0e6963",
  "jyscene.js?v=f6da0e6963",
  "journey.js?v=f6da0e6963",
  "stampart.js?v=f6da0e6963",
  "feastart.js?v=f6da0e6963",
  "feastscene.js?v=f6da0e6963",
  "feastthemes.js?v=f6da0e6963",
  "feastthemes2.js?v=f6da0e6963",
  "data/journey.js?v=f6da0e6963",
  "data/journey-map.js?v=f6da0e6963",
  "data/journey-media.js?v=f6da0e6963",
  "data/souvenirs.js?v=f6da0e6963",
  "erhua.js?v=f6da0e6963",
  "pinyin.js?v=f6da0e6963",
  "data/pinyin-course.js?v=f6da0e6963",
  "data/pinyin-chart.js?v=f6da0e6963",
  "data/exam-media.js?v=f6da0e6963",
  "data/exam-art.js?v=f6da0e6963",
  "data/neutral-alt.js?v=f6da0e6963",
  "data/path-scenes.js?v=f6da0e6963",
  "data/speak-scenes.js?v=f6da0e6963",
  "data/art.js?v=f6da0e6963",
  "data/path.js?v=f6da0e6963",
  "app.js?v=f6da0e6963",
  "styles.css?v=f6da0e6963",
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

const SIZES = {"index.html":260980,"boot-check.js?v=f6da0e6963":5966,"vendor/morphdom-umd.min.js?v=f6da0e6963":12165,"runtime.js?v=f6da0e6963":5515,"config.js?v=f6da0e6963":405,"friends.js?v=f6da0e6963":12135,"level.js?v=f6da0e6963":6123,"placement.js?v=f6da0e6963":10785,"data/hsk1-words.js?v=f6da0e6963":196551,"data/hsk1-grammar.js?v=f6da0e6963":208049,"data/hsk1-webs.js?v=f6da0e6963":66528,"data/hsk1-speak.js?v=f6da0e6963":15703,"data/hsk1-listen.js?v=f6da0e6963":37488,"data/hsk1-exam.js?v=f6da0e6963":31376,"data/hsk1-erhua.js?v=f6da0e6963":2710,"data/lexicon.js?v=f6da0e6963":5016,"data/char-glosses.js?v=f6da0e6963":20086,"data/hsk2-preview.js?v=f6da0e6963":7777,"data/hsk3-preview.js?v=f6da0e6963":22270,"data/hsk4-preview.js?v=f6da0e6963":35946,"data/hsk5-preview.js?v=f6da0e6963":59071,"data/hsk2-words.js?v=f6da0e6963":111918,"data/hsk2-speak.js?v=f6da0e6963":16960,"data/hsk2-listen.js?v=f6da0e6963":54080,"data/hsk2-exam.js?v=f6da0e6963":51948,"data/hsk2-grammar.js?v=f6da0e6963":190184,"data/hsk2-webs.js?v=f6da0e6963":47372,"data/hsk3-words.js?v=f6da0e6963":318353,"data/hsk3-speak.js?v=f6da0e6963":19050,"data/hsk3-listen.js?v=f6da0e6963":78236,"data/hsk3-exam.js?v=f6da0e6963":84393,"data/hsk3-grammar.js?v=f6da0e6963":275046,"data/hsk3-webs.js?v=f6da0e6963":102435,"data/hsk4-words.js?v=f6da0e6963":681273,"data/hsk4-speak.js?v=f6da0e6963":19752,"data/hsk4-listen.js?v=f6da0e6963":121144,"data/hsk4-exam.js?v=f6da0e6963":105195,"data/hsk4-grammar.js?v=f6da0e6963":315384,"data/hsk4-webs.js?v=f6da0e6963":139093,"data/hsk5-words.js?v=f6da0e6963":1311216,"data/hsk5-speak.js?v=f6da0e6963":26686,"data/hsk5-listen.js?v=f6da0e6963":196699,"data/hsk5-exam.js?v=f6da0e6963":188008,"data/hsk5-grammar.js?v=f6da0e6963":419475,"data/hsk5-webs.js?v=f6da0e6963":187633,"ascent.js?v=f6da0e6963":13144,"secrets.js?v=f6da0e6963":3605,"sync.js?v=f6da0e6963":19251,"data/audio-manifest.js?v=f6da0e6963":641917,"jyscene.js?v=f6da0e6963":42327,"journey.js?v=f6da0e6963":24675,"stampart.js?v=f6da0e6963":63410,"feastart.js?v=f6da0e6963":43900,"feastscene.js?v=f6da0e6963":42123,"feastthemes.js?v=f6da0e6963":24542,"feastthemes2.js?v=f6da0e6963":27066,"data/journey.js?v=f6da0e6963":366786,"data/journey-map.js?v=f6da0e6963":213513,"data/journey-media.js?v=f6da0e6963":392929,"data/souvenirs.js?v=f6da0e6963":145718,"erhua.js?v=f6da0e6963":6311,"pinyin.js?v=f6da0e6963":2120,"data/pinyin-course.js?v=f6da0e6963":18822,"data/pinyin-chart.js?v=f6da0e6963":27967,"data/exam-media.js?v=f6da0e6963":1855,"data/exam-art.js?v=f6da0e6963":113483,"data/neutral-alt.js?v=f6da0e6963":5359,"data/path-scenes.js?v=f6da0e6963":280647,"data/speak-scenes.js?v=f6da0e6963":296008,"data/art.js?v=f6da0e6963":25281,"data/path.js?v=f6da0e6963":135834,"app.js?v=f6da0e6963":554876,"styles.css?v=f6da0e6963":273461,"fonts/bricolage-latin-ext.woff2":5664,"fonts/bricolage-latin.woff2":63300,"fonts/noto-serif-sc-500.woff2":118412,"fonts/noto-serif-sc-700.woff2":120812,"fonts/sourcesans-latin-ext.woff2":5912,"fonts/sourcesans-latin.woff2":22096,"icons/apple-touch-icon.png":1715,"icons/icon-192.png":3031,"icons/icon-512.png":12236,"icons/icon-maskable-512.png":8375,"manifest.webmanifest":653};   // the exact size of each file of this version
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
