/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '98b0a41a90';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=49c6ac1223",
  "vendor/morphdom-umd.min.js?v=d5851599ae",
  "runtime.js?v=efad794d1b",
  "config.js?v=9dd5bf4caf",
  "friends.js?v=943820c4bf",
  "level.js?v=6f1b8ee5a7",
  "placement.js?v=8b6f2b8170",
  "data/levels-index.js?v=555110ba5a",
  "data/hsk1-erhua.js?v=161afeaf51",
  "data/lexicon.js?v=0141cc3cf4",
  "data/char-glosses.js?v=3f467cfcff",
  "data/hsk2-preview.js?v=e386a66d12",
  "data/hsk3-preview.js?v=1839728984",
  "data/hsk4-preview.js?v=3876a653e6",
  "data/hsk5-preview.js?v=7cc0706b86",
  "ascent.js?v=d2ca2a4903",
  "secrets.js?v=abc49c1923",
  "sync.js?v=006b724620",
  "data/audio-manifest.js?v=b98041424a",
  "audiolist.js?v=e9406e5d30",
  "jyscene.js?v=2210f9fb22",
  "journey.js?v=f19fa94dd0",
  "stampart.js?v=94be30f98c",
  "feastart.js?v=84bafd4ee6",
  "feastscene.js?v=41bdf943f2",
  "feastthemes.js?v=1254a4a6a0",
  "feastthemes2.js?v=2e728d2e25",
  "data/journey.js?v=b1c7f80de3",
  "data/journey-map.js?v=342ace73d8",
  "data/souvenirs.js?v=d383054bee",
  "erhua.js?v=33f26a7e59",
  "pinyin.js?v=32b63a24bf",
  "data/pinyin-course.js?v=d811965144",
  "data/pinyin-chart.js?v=020f946065",
  "data/exam-media.js?v=5719b2b0e0",
  "data/neutral-alt.js?v=5faef19e5b",
  "data/art.js?v=1dd8dd9d7b",
  "data/passages.js?v=8795d85bd8",
  "numbers.js?v=997b8744e4",
  "data/games.js?v=81a4332979",
  "data/confusers.js?v=2d21e34783",
  "data/path.js?v=8ede33779e",
  "pitch.js?v=16ceaf9821",
  "app.js?v=4484c405b9",
  "data/hsk1-words.js?v=3b25e91807",
  "data/hsk1-grammar.js?v=481050e5a7",
  "data/hsk1-webs.js?v=42cedb4560",
  "data/hsk1-speak.js?v=f9adf791ad",
  "data/hsk1-listen.js?v=250a298e10",
  "data/hsk1-exam.js?v=41fdbf162f",
  "data/hsk2-words.js?v=6a51d4396b",
  "data/hsk2-grammar.js?v=ae6b55baf3",
  "data/hsk2-webs.js?v=23d3cb03c3",
  "data/hsk2-speak.js?v=cadeceb7bf",
  "data/hsk2-listen.js?v=028c098051",
  "data/hsk2-exam.js?v=343eb00a0e",
  "data/hsk3-words.js?v=485e257b3f",
  "data/hsk3-grammar.js?v=2f4e796d1a",
  "data/hsk3-webs.js?v=413242a34f",
  "data/hsk3-speak.js?v=ed7af49707",
  "data/hsk3-listen.js?v=72b80b5541",
  "data/hsk3-exam.js?v=887b6a91ac",
  "data/hsk4-words.js?v=9ebcc5a250",
  "data/hsk4-grammar.js?v=8c535c3fc2",
  "data/hsk4-webs.js?v=8ff64ecd02",
  "data/hsk4-speak.js?v=deae152b68",
  "data/hsk4-listen.js?v=5225ba2a99",
  "data/hsk4-exam.js?v=018596a707",
  "data/hsk5-words.js?v=1e54d78599",
  "data/hsk5-grammar.js?v=cd8a3a9d5d",
  "data/hsk5-webs.js?v=c3a7725f04",
  "data/hsk5-speak.js?v=73d5a24b6f",
  "data/hsk5-listen.js?v=f7beda13a4",
  "data/hsk5-exam.js?v=5658d7a4a1",
  "data/path-scenes.js?v=cabc535d43",
  "data/speak-scenes.js?v=8fc79e5d01",
  "data/exam-art.js?v=fe9c38d6ea",
  "data/journey-media.js?v=de53596394",
  "styles.css?v=d3430ee7be",
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

const HASHES = {"index.html":"3306255b5c7473b4893faacab01221586487b016","boot-check.js?v=49c6ac1223":"49c6ac122384c1ea766edf5618046ff7ddb8fa79","vendor/morphdom-umd.min.js?v=d5851599ae":"d5851599ae904d4230127c5ef6136be2f2b52f0d","runtime.js?v=efad794d1b":"efad794d1b68672fc7491e3ff2668232b6bb9a37","config.js?v=9dd5bf4caf":"9dd5bf4caf6266a4165495aac677556dd2b1dd1e","friends.js?v=943820c4bf":"943820c4bfa3826925d118ce2b81168b958509f7","level.js?v=6f1b8ee5a7":"6f1b8ee5a7d1c7d0b28229e5f500ea98bc3f1043","placement.js?v=8b6f2b8170":"8b6f2b817025063058384d3cadf3fe32369140a8","data/levels-index.js?v=555110ba5a":"555110ba5ad5228f5e9089376f06626e6997753c","data/hsk1-erhua.js?v=161afeaf51":"161afeaf5182585e4ac557e5e19c74c248d594b3","data/lexicon.js?v=0141cc3cf4":"0141cc3cf4d2b82c83fce123839854c3c62b939c","data/char-glosses.js?v=3f467cfcff":"3f467cfcff7cb702adf10d2237e07f85eda49602","data/hsk2-preview.js?v=e386a66d12":"e386a66d1200c27d84891076e4c2ec315413c1e8","data/hsk3-preview.js?v=1839728984":"18397289844426846feb861d0e1decb0d42deecf","data/hsk4-preview.js?v=3876a653e6":"3876a653e67c7dfe726771a85329fcc5efd3e12a","data/hsk5-preview.js?v=7cc0706b86":"7cc0706b86498a7686bea7190644593355aeef96","ascent.js?v=d2ca2a4903":"d2ca2a49035c644ee27b2a30d45ae6834c098d46","secrets.js?v=abc49c1923":"abc49c1923fa11e02c7a9cb21004da7a44d7606b","sync.js?v=006b724620":"006b724620f096712aeba27b0944cf07b53192fc","data/audio-manifest.js?v=b98041424a":"b98041424ab45cf0c7048fa70bf67e619fb29055","audiolist.js?v=e9406e5d30":"e9406e5d305dc7d59c72dcde60c7fcdab2e49aca","jyscene.js?v=2210f9fb22":"2210f9fb22b3921a7d9f973cd6640fd88c633283","journey.js?v=f19fa94dd0":"f19fa94dd04f184aa64d228578e8b84c40e794f7","stampart.js?v=94be30f98c":"94be30f98cc3acc60c7a3df59bebdfcf9c847a4b","feastart.js?v=84bafd4ee6":"84bafd4ee69f3317f4b84a3871419e7c4bb5d2cd","feastscene.js?v=41bdf943f2":"41bdf943f2f2e41807742ee00bd9730a0c6fd8eb","feastthemes.js?v=1254a4a6a0":"1254a4a6a019cef1c797251a654bf8378f0e7e1a","feastthemes2.js?v=2e728d2e25":"2e728d2e25b74aa1257832c5c238599e34d7e7f7","data/journey.js?v=b1c7f80de3":"b1c7f80de36e54525c1d481f1c28850326a7a868","data/journey-map.js?v=342ace73d8":"342ace73d8d5ec873ed1c48c2854c10f88678069","data/souvenirs.js?v=d383054bee":"d383054beecf1fab20cbbd96869a1798429e57ca","erhua.js?v=33f26a7e59":"33f26a7e59d35835fdead3e9f8346ab3e11162c8","pinyin.js?v=32b63a24bf":"32b63a24bfb09dddcee818fa19d24589aeaefc94","data/pinyin-course.js?v=d811965144":"d811965144b0708fe950be2a320df8f93f96ed08","data/pinyin-chart.js?v=020f946065":"020f94606548e9e1e4ab64c45948b35d3498a81b","data/exam-media.js?v=5719b2b0e0":"5719b2b0e000fc5ec5264d2131d5594374859a96","data/neutral-alt.js?v=5faef19e5b":"5faef19e5b211ee96ed139ee574b2cee45099f4b","data/art.js?v=1dd8dd9d7b":"1dd8dd9d7bc38ec4858b5b9d4979043a05796a24","data/passages.js?v=8795d85bd8":"8795d85bd8bdda70aec533ab0e4c671e163397da","numbers.js?v=997b8744e4":"997b8744e462ddbc3bbd1416f8f9e42169d56c2c","data/games.js?v=81a4332979":"81a433297924246607d4d962235e6c362c047b95","data/confusers.js?v=2d21e34783":"2d21e347835840c13fbda5b76b1565b29cf3feee","data/path.js?v=8ede33779e":"8ede33779e30245d8405b4dc6c9efed1f2f000e5","pitch.js?v=16ceaf9821":"16ceaf9821272377753eb5ed9478a004104aa36b","app.js?v=4484c405b9":"4484c405b9ccc736208d66c3c8240431dc54b6c8","data/hsk1-words.js?v=3b25e91807":"3b25e91807f5968f2025a7b2179a22deea890798","data/hsk1-grammar.js?v=481050e5a7":"481050e5a7d47aa5d2332789cf12ea7ce0afc70e","data/hsk1-webs.js?v=42cedb4560":"42cedb45608b409f9428b89cf790611c230f5e23","data/hsk1-speak.js?v=f9adf791ad":"f9adf791ad17e40a666349abf3ccf496831ec254","data/hsk1-listen.js?v=250a298e10":"250a298e10037c7bc860577388c43deaedb8a28d","data/hsk1-exam.js?v=41fdbf162f":"41fdbf162f12a94d0e9756b7a273e57b3c0264b1","data/hsk2-words.js?v=6a51d4396b":"6a51d4396b81003cfcc5b3537b1d2a103d91e3cb","data/hsk2-grammar.js?v=ae6b55baf3":"ae6b55baf37aff0c8341607745b9fcb131d85a21","data/hsk2-webs.js?v=23d3cb03c3":"23d3cb03c3d5df2f642422dbb4a18d15b8c0ef3c","data/hsk2-speak.js?v=cadeceb7bf":"cadeceb7bfdbdcfec24ce84e23222070cdc9052c","data/hsk2-listen.js?v=028c098051":"028c098051a7ba59d591c1ae5f328a43b6cc8782","data/hsk2-exam.js?v=343eb00a0e":"343eb00a0eb34a7edabe06788ec6690c5c2844b5","data/hsk3-words.js?v=485e257b3f":"485e257b3f7dfb31b89a68b09ae8c58fcedc13c0","data/hsk3-grammar.js?v=2f4e796d1a":"2f4e796d1a447a6fc7e440edcf55fbe4f165496f","data/hsk3-webs.js?v=413242a34f":"413242a34faa70199b3759cdc04dd277ba78c0f4","data/hsk3-speak.js?v=ed7af49707":"ed7af49707037a3edf0ebcbfb73d41ab05ceac51","data/hsk3-listen.js?v=72b80b5541":"72b80b5541326961810405025d80c7b887fd1a03","data/hsk3-exam.js?v=887b6a91ac":"887b6a91ac518e5bad95ae522fd6d1862445f022","data/hsk4-words.js?v=9ebcc5a250":"9ebcc5a250ea1c76417e1f623a51fdc156ba0052","data/hsk4-grammar.js?v=8c535c3fc2":"8c535c3fc263cea6218301864afedce8fdf792df","data/hsk4-webs.js?v=8ff64ecd02":"8ff64ecd022f3ff773e58bb0de7faf81e9c4ffe0","data/hsk4-speak.js?v=deae152b68":"deae152b68d674336f7143e153e257e595bf9490","data/hsk4-listen.js?v=5225ba2a99":"5225ba2a99f8299391f8c0e6e3ad79224dfdaa4c","data/hsk4-exam.js?v=018596a707":"018596a70767d5f362bbfed55f1695d75e863864","data/hsk5-words.js?v=1e54d78599":"1e54d78599886f299cf5a5cb2b65216e6fd38489","data/hsk5-grammar.js?v=cd8a3a9d5d":"cd8a3a9d5d809f4265567adcd1d1221fd8081523","data/hsk5-webs.js?v=c3a7725f04":"c3a7725f044c693f1c6365c97dcfc75663f94ca5","data/hsk5-speak.js?v=73d5a24b6f":"73d5a24b6fac6ddb965f2e7ecc47090e76b68b1e","data/hsk5-listen.js?v=f7beda13a4":"f7beda13a4025898a175d702ef14fe26341cd063","data/hsk5-exam.js?v=5658d7a4a1":"5658d7a4a13be6ceaf22f0a882bd92e0c521b57d","data/path-scenes.js?v=cabc535d43":"cabc535d43555b6926b653717767838f60579cb6","data/speak-scenes.js?v=8fc79e5d01":"8fc79e5d0166f580e34f5c71040cfe9fe201bd00","data/exam-art.js?v=fe9c38d6ea":"fe9c38d6ea5055056c55aa18d16188e6034ee2df","data/journey-media.js?v=de53596394":"de535963940b1adb016029436f81d130cbbca2bc","styles.css?v=d3430ee7be":"d3430ee7be47dc3a97ba645e20b47d7a533636f7","fonts/bricolage-latin-ext.woff2":"00f8bc232860e097f31a7a1148f33bc8da8ed2d4","fonts/bricolage-latin.woff2":"a6948112649b85af068db8a4c2a9e94aabb1519a","fonts/noto-serif-sc-500.woff2":"cc51f29ac26f4118ad684dd6c0755dd4b4f6ec97","fonts/noto-serif-sc-700.woff2":"0b6ea1ff97e982ed8c28c4032cfef3ffae52c17a","fonts/sourcesans-latin-ext.woff2":"d46ceab2e646d19c1b4738cb57d48983a359f1bc","fonts/sourcesans-latin.woff2":"233db0efd26b2629904fafc9281fb1e7f4641fee","icons/apple-touch-icon.png":"81c20a34ba8350ff3ad7a54c5556ada8839121c4","icons/icon-192.png":"867b61fde3f5a5778db4250d8b278668719a8d1d","icons/icon-512.png":"2008f21435ec1ff3fbf4da378b5f830b5f0ba6ca","icons/icon-maskable-512.png":"45aa4dcc6dbb3d4462de2b058042cf5712b70b38","manifest.webmanifest":"1a604180864c7f46ca44ad2cf29fb22cd8e1fb34"};   // the SHA-1 of each file of this version
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

// Phone reminders (Web Push, sent by the friends server's hourly cron): show the message; a tap opens Shanlu (or brings an open Shanlu forward).
self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = { body: event.data ? event.data.text() : '' }; }
  const title = String(m.title || 'Time for Chinese').slice(0, 80);
  event.waitUntil(self.registration.showNotification(title, {
    body: String(m.body || 'A few minutes of Chinese today?').slice(0, 200), tag: String(m.tag || 'shanlu-daily'), renotify: false,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: String(m.url || './') }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { open.focus(); if ('navigate' in open && url !== open.url) return open.navigate(url).catch(() => null); return null; }
    return self.clients.openWindow(url);
  }));
});
