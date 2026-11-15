/* Tests for the feast table drawings (feastart.js, feastscene.js, feastthemes*.js) against the real dish data.   node tools/test-feast.js */
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'journey.js'));
const J = require(path.join(__dirname, '..', 'journey.js'));
const FE = require(path.join(__dirname, '..', 'feastart.js'));
const F = require(path.join(__dirname, '..', 'feastscene.js'));
require(path.join(__dirname, '..', 'feastthemes.js')); require(path.join(__dirname, '..', 'feastthemes2.js'));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const W = J.build(window.JOURNEY);
const dishes = Object.values(W.byStop).filter((s) => s.k === 'D');
ok(dishes.length >= 700, 'there are dishes to draw: ' + dishes.length);
// every dish classifies to a drawing that exists, and the drawing is real SVG markup
const arch = {};
dishes.forEach((s) => {
  const kind = J.sayKind(s), c = FE.classify(Object.assign({}, s, { kind }), kind);
  ok(c && FE.ARCH[c.arch] !== undefined || typeof FE.draw === 'function', 'classify gives a drawing for ' + s.id);
  const svg = FE.draw(c.arch, c.p);
  ok(typeof svg === 'string' && svg.length > 40 && svg.indexOf('undefined') < 0 && svg.indexOf('NaN') < 0, 'a clean drawing for ' + s.id + ' (' + c.arch + ')');
  ok(c.zone === 'table' || c.zone === 'shelf', 'a zone for ' + s.id);
  arch[c.arch] = (arch[c.arch] || 0) + 1;
});
ok(Object.keys(arch).length >= 50, 'dishes are drawn in ' + Object.keys(arch).length + ' different ways');
// all provinces have a room of their own
W.regions.forEach((r) => { const id = r.id || r; ok(F.THEMES[id], 'a themed room for ' + id); });
const rooms = {};
W.regions.forEach((r) => {
  const id = r.id || r, R = W.byRegion[id], ds = R.stops.filter((s) => s.k === 'D').map((s) => ({ id: s.id, zh: s.zh, py: s.py, en: s.en, kind: J.sayKind(s), sp: !!s.sp }));
  [[0], [3], [ds.length]].forEach((n) => {
    const res = F.scene(id, ds.slice(0, n[0]), 0), w = F.wrap(res, 't', false);
    ok(/^<svg[^>]+viewBox="0 0 680 440"/.test(w) && w.indexOf('undefined') < 0 && w.indexOf('NaN') < 0, id + ' draws cleanly with ' + n[0] + ' dishes');
    ok(res.total === n[0], id + ' reports its dish count');
    if (n[0] === 0) rooms[res.svg] = id;
  });
  const full = F.scene(id, ds, 0);
  ok(full.pages >= 1 && (ds.length <= 18 || full.pages >= 1), id + ' has courses');
  const hits = (full.svg.match(/class="fz-hit"/g) || []).length;
  ok(hits > 0 && hits <= F.TABLE_CAP + F.SHELF_CAP + 2, id + ' shows a sensible number of dishes per course (' + hits + ')');
  // paging reaches every dish exactly once
  const seenIds = new Set(); for (let p = 0; p < full.pages; p++) (F.scene(id, ds, p).svg.match(/data-id="[^"]+"/g) || []).forEach((m) => seenIds.add(m));
  ok(seenIds.size === ds.length, id + ' shows every dish across its courses (' + seenIds.size + ' of ' + ds.length + ')');
});
ok(Object.keys(rooms).length === W.regions.length, 'every province has a room of its own (' + Object.keys(rooms).length + ' of ' + W.regions.length + ')');
ok(/<svg/.test(F.portrait(dishes[0], J.sayKind(dishes[0]))), 'a single dish can be drawn for the popup');
ok(F.wrap(F.scene('sichuan', [], 0), 'o', true).indexOf('viewBox="0 112 680 328"') > 0, 'the full-screen view is cropped to landscape');
if (bad) { console.log(bad + ' feast test(s) failed'); process.exit(1); } console.log('feast tests ok');
