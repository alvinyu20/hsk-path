/* Shanlu service worker. GENERATED into sw.js by tools/build-site.js: edit this template, not sw.js.
 *
 * What it does: keeps one complete, matching copy of the site (page, scripts, data, styles, fonts, icons) so the site opens offline
 * and a half-updated mix (new app.js with old data) cannot happen. A new version is downloaded in the background and waits;
 * pages already open keep the scripts they loaded; the next start uses the new copy.
 * What it does not do: it never touches other sites (the Alibaba/Anthropic/GitHub/friends-server calls go straight to the network),
 * and it does not cache recorded audio (Safari asks for audio in byte ranges, which a cache copy answers badly). */
const VERSION = '54cb653098';
const CACHE = 'shanlu-' + VERSION;
const ASSETS = [
  "index.html",
  "boot-check.js?v=49c6ac1223",
  "vendor/morphdom-umd.min.js?v=d5851599ae",
  "runtime.js?v=07e199e42a",
  "config.js?v=9dd5bf4caf",
  "friends.js?v=f51b3f7ce5",
  "level.js?v=1b9a0aa0f9",
  "placement.js?v=8b6f2b8170",
  "data/levels-index.js?v=4054c21807",
  "data/hsk1-erhua.js?v=161afeaf51",
  "data/lexicon.js?v=752b6080ef",
  "data/char-glosses.js?v=070dcbd1b1",
  "data/hsk2-preview.js?v=d6932ab547",
  "data/hsk3-preview.js?v=ea834dcdc3",
  "data/hsk4-preview.js?v=787fe1d892",
  "data/hsk5-preview.js?v=c48ef4111e",
  "ascent.js?v=d89743ce05",
  "secrets.js?v=abc49c1923",
  "sync.js?v=b7b9333e02",
  "data/audio-manifest.js?v=f4f41de08f",
  "jyscene.js?v=1c02bf2fa0",
  "journey.js?v=929106c907",
  "stampart.js?v=94be30f98c",
  "feastart.js?v=84bafd4ee6",
  "feastscene.js?v=e207423bff",
  "feastthemes.js?v=1254a4a6a0",
  "feastthemes2.js?v=2e728d2e25",
  "data/journey.js?v=b1c7f80de3",
  "data/journey-map.js?v=342ace73d8",
  "data/journey-media.js?v=de53596394",
  "data/souvenirs.js?v=d383054bee",
  "erhua.js?v=ac9776341d",
  "pinyin.js?v=32b63a24bf",
  "data/pinyin-course.js?v=d811965144",
  "data/pinyin-chart.js?v=020f946065",
  "data/exam-media.js?v=5719b2b0e0",
  "data/exam-art.js?v=1dace4f934",
  "data/neutral-alt.js?v=5faef19e5b",
  "data/path-scenes.js?v=cabc535d43",
  "data/speak-scenes.js?v=8fc79e5d01",
  "data/art.js?v=1dd8dd9d7b",
  "data/passages.js?v=5ada9a1323",
  "data/path.js?v=925023841f",
  "app.js?v=6726c4877e",
  "data/hsk1-words.js?v=2951ddbd46",
  "data/hsk1-grammar.js?v=9c7c234f4d",
  "data/hsk1-webs.js?v=c55e460971",
  "data/hsk1-speak.js?v=1a0bc4fd8d",
  "data/hsk1-listen.js?v=250a298e10",
  "data/hsk1-exam.js?v=f29670a542",
  "data/hsk2-words.js?v=f24b343438",
  "data/hsk2-grammar.js?v=3bdcfab282",
  "data/hsk2-webs.js?v=a19112d83b",
  "data/hsk2-speak.js?v=f61eb12760",
  "data/hsk2-listen.js?v=028c098051",
  "data/hsk2-exam.js?v=e50c0d2d1e",
  "data/hsk3-words.js?v=b926f66ed7",
  "data/hsk3-grammar.js?v=124e381156",
  "data/hsk3-webs.js?v=8cd2eefb5d",
  "data/hsk3-speak.js?v=82ca84cf78",
  "data/hsk3-listen.js?v=72b80b5541",
  "data/hsk3-exam.js?v=29e8aab26b",
  "data/hsk4-words.js?v=dd870dceb5",
  "data/hsk4-grammar.js?v=1e2dd82126",
  "data/hsk4-webs.js?v=a719c781b1",
  "data/hsk4-speak.js?v=432fbea51b",
  "data/hsk4-listen.js?v=5225ba2a99",
  "data/hsk4-exam.js?v=257a4e159a",
  "data/hsk5-words.js?v=932440eb6a",
  "data/hsk5-grammar.js?v=9652096e29",
  "data/hsk5-webs.js?v=09b4d2f03c",
  "data/hsk5-speak.js?v=f58e180d1a",
  "data/hsk5-listen.js?v=657e83574f",
  "data/hsk5-exam.js?v=a2f534a282",
  "styles.css?v=17beae9db2",
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

const HASHES = {"index.html":"26b11d5d35ccb593d8b575ec1263037ef732dbd9","boot-check.js?v=49c6ac1223":"49c6ac122384c1ea766edf5618046ff7ddb8fa79","vendor/morphdom-umd.min.js?v=d5851599ae":"d5851599ae904d4230127c5ef6136be2f2b52f0d","runtime.js?v=07e199e42a":"07e199e42a6989b858b159ba680d68fc9d5624ec","config.js?v=9dd5bf4caf":"9dd5bf4caf6266a4165495aac677556dd2b1dd1e","friends.js?v=f51b3f7ce5":"f51b3f7ce53043ed4f936d479934f03a4b92b880","level.js?v=1b9a0aa0f9":"1b9a0aa0f9d4b2ab5ac18125caf7bb09b2d94f2d","placement.js?v=8b6f2b8170":"8b6f2b817025063058384d3cadf3fe32369140a8","data/levels-index.js?v=4054c21807":"4054c21807368d630d37030d75354bdd0d8f7ab6","data/hsk1-erhua.js?v=161afeaf51":"161afeaf5182585e4ac557e5e19c74c248d594b3","data/lexicon.js?v=752b6080ef":"752b6080ef38da6e47ffcfb38bef2d75d04b31f8","data/char-glosses.js?v=070dcbd1b1":"070dcbd1b1c02a72ca94f267586c28bbd9e6bd96","data/hsk2-preview.js?v=d6932ab547":"d6932ab5475d9a74e7f322140c29298c73d75d67","data/hsk3-preview.js?v=ea834dcdc3":"ea834dcdc397af40f84d2b6e87d8d52df56a0aff","data/hsk4-preview.js?v=787fe1d892":"787fe1d89204afbfff91eece41638658df4446c5","data/hsk5-preview.js?v=c48ef4111e":"c48ef4111e65b246cd846ad81f4e223a7d4084b1","ascent.js?v=d89743ce05":"d89743ce0587b4bd1bc3b5dd891dbb2f09aec48e","secrets.js?v=abc49c1923":"abc49c1923fa11e02c7a9cb21004da7a44d7606b","sync.js?v=b7b9333e02":"b7b9333e02fac9fe33434ff7716d13d5fc618cc6","data/audio-manifest.js?v=f4f41de08f":"f4f41de08f9938e936f92739bf1b1a58126c6e61","jyscene.js?v=1c02bf2fa0":"1c02bf2fa063fb5268820f430dd2592be6cade7d","journey.js?v=929106c907":"929106c907e2039aea2586bcfcbab19c68d7aa47","stampart.js?v=94be30f98c":"94be30f98cc3acc60c7a3df59bebdfcf9c847a4b","feastart.js?v=84bafd4ee6":"84bafd4ee69f3317f4b84a3871419e7c4bb5d2cd","feastscene.js?v=e207423bff":"e207423bffd21204f952113b45597465c06fdbab","feastthemes.js?v=1254a4a6a0":"1254a4a6a019cef1c797251a654bf8378f0e7e1a","feastthemes2.js?v=2e728d2e25":"2e728d2e25b74aa1257832c5c238599e34d7e7f7","data/journey.js?v=b1c7f80de3":"b1c7f80de36e54525c1d481f1c28850326a7a868","data/journey-map.js?v=342ace73d8":"342ace73d8d5ec873ed1c48c2854c10f88678069","data/journey-media.js?v=de53596394":"de535963940b1adb016029436f81d130cbbca2bc","data/souvenirs.js?v=d383054bee":"d383054beecf1fab20cbbd96869a1798429e57ca","erhua.js?v=ac9776341d":"ac9776341d729c6a30790676c6b2f10f56664755","pinyin.js?v=32b63a24bf":"32b63a24bfb09dddcee818fa19d24589aeaefc94","data/pinyin-course.js?v=d811965144":"d811965144b0708fe950be2a320df8f93f96ed08","data/pinyin-chart.js?v=020f946065":"020f94606548e9e1e4ab64c45948b35d3498a81b","data/exam-media.js?v=5719b2b0e0":"5719b2b0e000fc5ec5264d2131d5594374859a96","data/exam-art.js?v=1dace4f934":"1dace4f934d66d63d5beb068d9bf4d5618f60c24","data/neutral-alt.js?v=5faef19e5b":"5faef19e5b211ee96ed139ee574b2cee45099f4b","data/path-scenes.js?v=cabc535d43":"cabc535d43555b6926b653717767838f60579cb6","data/speak-scenes.js?v=8fc79e5d01":"8fc79e5d0166f580e34f5c71040cfe9fe201bd00","data/art.js?v=1dd8dd9d7b":"1dd8dd9d7bc38ec4858b5b9d4979043a05796a24","data/passages.js?v=5ada9a1323":"5ada9a1323842859b1dd9c8f19bf9e8c28c6b893","data/path.js?v=925023841f":"925023841fb8c3eced351ad94b45e935bcb56470","app.js?v=6726c4877e":"6726c4877edf0ddd14f9039138991b9332790591","data/hsk1-words.js?v=2951ddbd46":"2951ddbd46bdec426dcbc29b5137ce70fe64dc39","data/hsk1-grammar.js?v=9c7c234f4d":"9c7c234f4d08aff9a4e4593d680ba5304d9d78f9","data/hsk1-webs.js?v=c55e460971":"c55e460971e3a1258edcdb9ea07c10ea0683c852","data/hsk1-speak.js?v=1a0bc4fd8d":"1a0bc4fd8d47a1c9fa32c84cc6ba83c94d5b3ef3","data/hsk1-listen.js?v=250a298e10":"250a298e10037c7bc860577388c43deaedb8a28d","data/hsk1-exam.js?v=f29670a542":"f29670a542b3754862f7dc5d693927d0022da821","data/hsk2-words.js?v=f24b343438":"f24b343438e468b32fd68bb3323ea2c9f23b05bc","data/hsk2-grammar.js?v=3bdcfab282":"3bdcfab282913beca4d62e0f5d0867149fbca91d","data/hsk2-webs.js?v=a19112d83b":"a19112d83b28911e3430f2f1ef87bef122e43a54","data/hsk2-speak.js?v=f61eb12760":"f61eb12760341622a8d88110e7e407a486a3e077","data/hsk2-listen.js?v=028c098051":"028c098051a7ba59d591c1ae5f328a43b6cc8782","data/hsk2-exam.js?v=e50c0d2d1e":"e50c0d2d1e8467394d3ed3ba264e45f86e0b9e9f","data/hsk3-words.js?v=b926f66ed7":"b926f66ed7801629cfd44313f9c88b4879521e3e","data/hsk3-grammar.js?v=124e381156":"124e381156eb79949e446c8c82e9f01a19d1fd5a","data/hsk3-webs.js?v=8cd2eefb5d":"8cd2eefb5d5041c2be512abbf5b1b314cbc1e685","data/hsk3-speak.js?v=82ca84cf78":"82ca84cf78b9d4b0af17daf92b906d5ea45352b1","data/hsk3-listen.js?v=72b80b5541":"72b80b5541326961810405025d80c7b887fd1a03","data/hsk3-exam.js?v=29e8aab26b":"29e8aab26b3417e5f8d9d0cad0c90936d513f582","data/hsk4-words.js?v=dd870dceb5":"dd870dceb5764cff1b55da8e690d5d4d37be4350","data/hsk4-grammar.js?v=1e2dd82126":"1e2dd82126917d7dbdbe12b0686e12bdaf593212","data/hsk4-webs.js?v=a719c781b1":"a719c781b1b3eda6abaa227047658c6eb11f930a","data/hsk4-speak.js?v=432fbea51b":"432fbea51b96db161e051aeaae84fdb9788d68b7","data/hsk4-listen.js?v=5225ba2a99":"5225ba2a99f8299391f8c0e6e3ad79224dfdaa4c","data/hsk4-exam.js?v=257a4e159a":"257a4e159ad770d5eabf9ea97a822ee9069b60ff","data/hsk5-words.js?v=932440eb6a":"932440eb6a8c67cd19f6cfa24558d337503c1ea4","data/hsk5-grammar.js?v=9652096e29":"9652096e29b93d3ad6319850c2440547326b59b8","data/hsk5-webs.js?v=09b4d2f03c":"09b4d2f03c2a5d16036f526699dc6b7ca770e8b9","data/hsk5-speak.js?v=f58e180d1a":"f58e180d1a45ba4e9a07585365907795e75f0224","data/hsk5-listen.js?v=657e83574f":"657e83574faec791c243d09a843635aee282a025","data/hsk5-exam.js?v=a2f534a282":"a2f534a282387e2ac833de4391fddd8575f6f8bd","styles.css?v=17beae9db2":"17beae9db2eb3531fe7d5e6bf74e9ed49694e2e9","fonts/bricolage-latin-ext.woff2":"00f8bc232860e097f31a7a1148f33bc8da8ed2d4","fonts/bricolage-latin.woff2":"a6948112649b85af068db8a4c2a9e94aabb1519a","fonts/noto-serif-sc-500.woff2":"cc51f29ac26f4118ad684dd6c0755dd4b4f6ec97","fonts/noto-serif-sc-700.woff2":"0b6ea1ff97e982ed8c28c4032cfef3ffae52c17a","fonts/sourcesans-latin-ext.woff2":"d46ceab2e646d19c1b4738cb57d48983a359f1bc","fonts/sourcesans-latin.woff2":"233db0efd26b2629904fafc9281fb1e7f4641fee","icons/apple-touch-icon.png":"81c20a34ba8350ff3ad7a54c5556ada8839121c4","icons/icon-192.png":"867b61fde3f5a5778db4250d8b278668719a8d1d","icons/icon-512.png":"2008f21435ec1ff3fbf4da378b5f830b5f0ba6ca","icons/icon-maskable-512.png":"45aa4dcc6dbb3d4462de2b058042cf5712b70b38","manifest.webmanifest":"1a604180864c7f46ca44ad2cf29fb22cd8e1fb34"};   // the SHA-1 of each file of this version
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
