/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * the page shows "A new version is ready" and switches only when the person taps Reload.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = 'be6bfe24da';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "vendor/morphdom-umd.min.js?v=be6bfe24da",
  "runtime.js?v=be6bfe24da",
  "config.js?v=be6bfe24da",
  "friends.js?v=be6bfe24da",
  "level.js?v=be6bfe24da",
  "data/hsk1-words.js?v=be6bfe24da",
  "data/hsk1-grammar.js?v=be6bfe24da",
  "data/hsk1-webs.js?v=be6bfe24da",
  "data/hsk1-speak.js?v=be6bfe24da",
  "data/hsk1-listen.js?v=be6bfe24da",
  "data/hsk1-exam.js?v=be6bfe24da",
  "data/hsk1-erhua.js?v=be6bfe24da",
  "data/lexicon.js?v=be6bfe24da",
  "data/char-glosses.js?v=be6bfe24da",
  "data/hsk2-preview.js?v=be6bfe24da",
  "data/hsk3-preview.js?v=be6bfe24da",
  "data/hsk2-words.js?v=be6bfe24da",
  "data/hsk2-speak.js?v=be6bfe24da",
  "data/hsk2-listen.js?v=be6bfe24da",
  "data/hsk2-exam.js?v=be6bfe24da",
  "data/hsk2-grammar.js?v=be6bfe24da",
  "data/hsk2-webs.js?v=be6bfe24da",
  "data/hsk3-words.js?v=be6bfe24da",
  "data/hsk3-speak.js?v=be6bfe24da",
  "data/hsk3-listen.js?v=be6bfe24da",
  "data/hsk3-exam.js?v=be6bfe24da",
  "data/hsk3-grammar.js?v=be6bfe24da",
  "data/hsk3-webs.js?v=be6bfe24da",
  "ascent.js?v=be6bfe24da",
  "secrets.js?v=be6bfe24da",
  "sync.js?v=be6bfe24da",
  "data/audio-manifest.js?v=be6bfe24da",
  "journey.js?v=be6bfe24da",
  "data/journey.js?v=be6bfe24da",
  "data/journey-map.js?v=be6bfe24da",
  "data/journey-media.js?v=be6bfe24da",
  "erhua.js?v=be6bfe24da",
  "pinyin.js?v=be6bfe24da",
  "data/pinyin-course.js?v=be6bfe24da",
  "data/pinyin-chart.js?v=be6bfe24da",
  "data/exam-media.js?v=be6bfe24da",
  "data/neutral-alt.js?v=be6bfe24da",
  "data/path.js?v=be6bfe24da",
  "app.js?v=be6bfe24da",
  "styles.css?v=be6bfe24da",
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
