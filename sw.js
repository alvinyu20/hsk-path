/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * the page shows "A new version is ready" and switches only when the person taps Reload.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'f62c280f22';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "vendor/morphdom-umd.min.js?v=f62c280f22",
  "runtime.js?v=f62c280f22",
  "config.js?v=f62c280f22",
  "friends.js?v=f62c280f22",
  "level.js?v=f62c280f22",
  "data/hsk1-words.js?v=f62c280f22",
  "data/hsk1-grammar.js?v=f62c280f22",
  "data/hsk1-webs.js?v=f62c280f22",
  "data/hsk1-speak.js?v=f62c280f22",
  "data/hsk1-listen.js?v=f62c280f22",
  "data/hsk1-exam.js?v=f62c280f22",
  "data/hsk1-erhua.js?v=f62c280f22",
  "data/lexicon.js?v=f62c280f22",
  "data/char-glosses.js?v=f62c280f22",
  "data/hsk2-preview.js?v=f62c280f22",
  "data/hsk3-preview.js?v=f62c280f22",
  "data/hsk4-preview.js?v=f62c280f22",
  "data/hsk2-words.js?v=f62c280f22",
  "data/hsk2-speak.js?v=f62c280f22",
  "data/hsk2-listen.js?v=f62c280f22",
  "data/hsk2-exam.js?v=f62c280f22",
  "data/hsk2-grammar.js?v=f62c280f22",
  "data/hsk2-webs.js?v=f62c280f22",
  "data/hsk3-words.js?v=f62c280f22",
  "data/hsk3-speak.js?v=f62c280f22",
  "data/hsk3-listen.js?v=f62c280f22",
  "data/hsk3-exam.js?v=f62c280f22",
  "data/hsk3-grammar.js?v=f62c280f22",
  "data/hsk3-webs.js?v=f62c280f22",
  "data/hsk4-words.js?v=f62c280f22",
  "data/hsk4-speak.js?v=f62c280f22",
  "data/hsk4-listen.js?v=f62c280f22",
  "data/hsk4-exam.js?v=f62c280f22",
  "data/hsk4-grammar.js?v=f62c280f22",
  "data/hsk4-webs.js?v=f62c280f22",
  "ascent.js?v=f62c280f22",
  "secrets.js?v=f62c280f22",
  "sync.js?v=f62c280f22",
  "data/audio-manifest.js?v=f62c280f22",
  "journey.js?v=f62c280f22",
  "data/journey.js?v=f62c280f22",
  "data/journey-map.js?v=f62c280f22",
  "data/journey-media.js?v=f62c280f22",
  "data/souvenirs.js?v=f62c280f22",
  "erhua.js?v=f62c280f22",
  "pinyin.js?v=f62c280f22",
  "data/pinyin-course.js?v=f62c280f22",
  "data/pinyin-chart.js?v=f62c280f22",
  "data/exam-media.js?v=f62c280f22",
  "data/exam-art.js?v=f62c280f22",
  "data/neutral-alt.js?v=f62c280f22",
  "data/path-scenes.js?v=f62c280f22",
  "data/speak-scenes.js?v=f62c280f22",
  "data/art.js?v=f62c280f22",
  "data/path.js?v=f62c280f22",
  "app.js?v=f62c280f22",
  "styles.css?v=f62c280f22",
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

self.addEventListener('install', (event) => {
  // any file that cannot be fetched makes the whole install fail, so the old version keeps running
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
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
