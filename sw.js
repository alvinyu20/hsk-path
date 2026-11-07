/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * the page shows "A new version is ready" and switches only when the person taps Reload.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '90c1eaa1d9';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "vendor/morphdom-umd.min.js?v=90c1eaa1d9",
  "runtime.js?v=90c1eaa1d9",
  "config.js?v=90c1eaa1d9",
  "friends.js?v=90c1eaa1d9",
  "level.js?v=90c1eaa1d9",
  "data/hsk1-words.js?v=90c1eaa1d9",
  "data/hsk1-grammar.js?v=90c1eaa1d9",
  "data/hsk1-webs.js?v=90c1eaa1d9",
  "data/hsk1-speak.js?v=90c1eaa1d9",
  "data/hsk1-listen.js?v=90c1eaa1d9",
  "data/hsk1-exam.js?v=90c1eaa1d9",
  "data/hsk1-erhua.js?v=90c1eaa1d9",
  "data/lexicon.js?v=90c1eaa1d9",
  "data/hsk2-preview.js?v=90c1eaa1d9",
  "data/hsk3-preview.js?v=90c1eaa1d9",
  "data/hsk2-words.js?v=90c1eaa1d9",
  "data/hsk2-speak.js?v=90c1eaa1d9",
  "data/hsk2-listen.js?v=90c1eaa1d9",
  "data/hsk2-exam.js?v=90c1eaa1d9",
  "data/hsk2-grammar.js?v=90c1eaa1d9",
  "data/hsk2-webs.js?v=90c1eaa1d9",
  "data/hsk3-words.js?v=90c1eaa1d9",
  "data/hsk3-speak.js?v=90c1eaa1d9",
  "data/hsk3-listen.js?v=90c1eaa1d9",
  "data/hsk3-exam.js?v=90c1eaa1d9",
  "data/hsk3-grammar.js?v=90c1eaa1d9",
  "data/hsk3-webs.js?v=90c1eaa1d9",
  "ascent.js?v=90c1eaa1d9",
  "secrets.js?v=90c1eaa1d9",
  "sync.js?v=90c1eaa1d9",
  "data/audio-manifest.js?v=90c1eaa1d9",
  "journey.js?v=90c1eaa1d9",
  "data/journey.js?v=90c1eaa1d9",
  "data/journey-map.js?v=90c1eaa1d9",
  "data/journey-media.js?v=90c1eaa1d9",
  "erhua.js?v=90c1eaa1d9",
  "app.js?v=90c1eaa1d9",
  "styles.css?v=90c1eaa1d9",
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
