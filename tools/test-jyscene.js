/* Tests for the Journey card's road and province scenes (jyscene.js).   node tools/test-jyscene.js */
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'journey.js'));
const J = require(path.join(__dirname, '..', 'journey.js'));
const S = require(path.join(__dirname, '..', 'jyscene.js'));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const W = J.build(window.JOURNEY);
const ids = W.regions.map((r) => r.id || r);
ids.forEach((id) => ok(S.IDS.indexOf(id) >= 0, id + ' has a scene of its own'));
ok(S.IDS.every((id) => ids.indexOf(id) >= 0), 'no scene for a region that does not exist');
const base = { done: 2, mid: 1, next: { kind: 'D', label: 'A dish' }, goal: { kind: 'city', zh: '成', label: '3 left in Chengdu' }, pct: .4, ready: true };
const tags = (s) => { const open = (s.match(/<(?!\/|!)[a-zA-Z][^>]*[^\/]>/g) || []).filter((t) => !/^<(rect|circle|ellipse|path|stop|image)\b/.test(t)).length; const close = (s.match(/<\/[a-zA-Z]+>/g) || []).length; return open - close; };
ids.forEach((id) => {
  const svg = S.svg(id, base, 'test');
  ok(/^<svg /.test(svg) && /<\/svg>$/.test(svg), id + ' is one svg');
  ok(svg.indexOf('undefined') < 0 && svg.indexOf('NaN') < 0, id + ' draws cleanly');
  ok(tags(svg) === 0, id + ' has balanced tags (' + tags(svg) + ')');
  ok(svg.indexOf('url(#jys-' + id + ')') > 0, id + ' has its own sky gradient');
  ok(svg.length < 20000, id + ' stays light (' + svg.length + ' chars)');
  ok(svg.indexOf('<filter') < 0, id + ' uses no filters (they are slow on phones)');
});
// the next stop shows only its kind
['P', 'T', 'A', 'D', 'C'].forEach((k) => { const svg = S.svg('sichuan', Object.assign({}, base, { next: { kind: k, label: 'A ' + k } })); ok(svg.indexOf('A ' + k) > 0 && svg.indexOf('jr-ping') > 0, 'kind ' + k + ' is drawn on the next stop'); });
ok(S.svg('sichuan', Object.assign({}, base, { ready: false })).indexOf('jr-ping') < 0, 'the ring only pulses when a stop is ready');
ok(S.svg('sichuan', Object.assign({}, base, { home: true })).indexOf('You, at home') > 0, 'the first road starts at home');
ok(S.svg('sichuan', Object.assign({}, base, { avatar: 'data:image/svg+xml;charset=utf-8,x' })).indexOf('<image') > 0, 'a chosen souvenir picture stands on the road');
ok(/<svg/.test(S.kindSvg('D')), 'a kind icon can be drawn for the postcard');
if (bad) { console.log(bad + ' jyscene test(s) failed'); process.exit(1); } console.log('jyscene tests ok');
