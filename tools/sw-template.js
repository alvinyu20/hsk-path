/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '__VERSION__';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = __ASSETS__;   // addresses relative to this file, as the page requests them (with ?v=)

const HASHES = __HASHES__;   // the SHA-1 of each file of this version
// every stored file must have the content this version expects: a stale copy from a network cache (a site update still spreading) is fetched
// again under a changed address; if it is still wrong the install fails, so the old version keeps running and the next check tries again.
// A file that did not change since the version already stored (same address, same content) is copied from that copy, not downloaded.
const hex = (buf) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
const shaOf = (res) => res.clone().arrayBuffer().then((b) => crypto.subtle.digest('SHA-1', b)).then(hex);
const fetchRight = (u) => {
  const want = HASHES[u];
  const get = (addr) => fetch(new Request(addr, { cache: 'reload' })).then((r) => (r.ok ? r : Promise.reject(new Error('HTTP ' + r.status + ' ' + addr))));
  return get(u).then((r) => shaOf(r).then((h) => (h === want ? r : get(u + (u.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now()).then((r2) => shaOf(r2).then((h2) => (h2 === want ? r2 : Promise.reject(new Error('wrong content ' + u))))))));
};
// the same file in an earlier offline copy, if its content is exactly right
const reuse = (u) => caches.keys().then((keys) => keys.filter((k) => k.indexOf('shanlu-') === 0 && k !== CACHE).reduce((p, k) => p.then((hit) => hit || caches.open(k).then((c) => c.match(new Request(u))).then((r) => (r ? shaOf(r).then((h) => (h === HASHES[u] ? r : null)) : null))), Promise.resolve(null)));
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((u) => (u === 'index.html' ? Promise.resolve(null) : reuse(u)).then((old) => old || fetchRight(u)).then((r) => cache.put(new Request(u), r)))))
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
