/* Unit test for the learning path data (data/path.js, built from content/path.json by tools/build-path.py).
 * Checks, for every level the path covers, in both styles of the site (plain forms and 儿 endings):
 *   - every word of the level sits in exactly one stop, and no stop names a word the level does not have
 *   - no stop has more than 8 words; stop ids are unique
 *   - every grammar lesson of the level sits in exactly one stop
 *   - the first stops are the basics (the order is a design choice, so only a few anchors are pinned)
 * Usage: node tools/test-path.js */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

const load = (erhua) => {
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  ['data/hsk1-words.js', 'data/hsk1-grammar.js', 'data/hsk1-webs.js', 'data/hsk1-speak.js', 'data/hsk1-listen.js', 'data/hsk1-exam.js', 'data/hsk1-erhua.js',
   'data/hsk2-words.js', 'data/hsk2-grammar.js', 'data/hsk2-webs.js', 'data/hsk2-speak.js', 'data/hsk2-listen.js', 'data/hsk2-exam.js',
   'data/hsk3-words.js', 'data/hsk3-grammar.js', 'data/hsk3-webs.js', 'data/hsk3-speak.js', 'data/hsk3-listen.js', 'data/hsk3-exam.js', 'data/path.js'].forEach(run);
  const E = require(path.join(root, 'erhua.js'));
  const er = E.make(ctx.HSK1_ERHUA);
  if (!erhua) er.apply(ctx);      // plain style: the site rewrites its words before the app starts
  // what app.js does with the path's lists
  const plainWords = (arr) => {
    if (erhua) return arr;
    const out = [];
    arr.forEach(z => { if (er.twins.indexOf(z) >= 0) return; const q = er.zh(z); if (out.indexOf(q) < 0) out.push(q); });
    return out;
  };
  return { ctx, plainWords };
};

for (const erhua of [false, true]) {
  const style = erhua ? '儿 endings' : 'plain forms';
  const { ctx, plainWords } = load(erhua);
  for (const n of [1, 2, 3]) {
    const P = ctx.SHANLU_PATH[n];
    const tag = 'HSK ' + n + ' (' + style + ')';
    check(!!P && P.units.length > 0, tag + ': has a path');
    const words = ctx['HSK' + n + '_WORDS'].map(w => w.zh);
    const have = new Set(words);
    const seen = {}; const missing = []; let biggest = 0; const ids = new Set(); let dupId = 0; const gSeen = {};
    P.units.forEach(u => u.stops.forEach(st => {
      if (ids.has(st.id)) dupId++; ids.add(st.id);
      if (st.k === 'w') {
        const ws = plainWords(st.w);
        biggest = Math.max(biggest, ws.length);
        ws.forEach(z => { if (!have.has(z)) missing.push(z); seen[z] = (seen[z] || 0) + 1; });
      } else gSeen[st.g] = (gSeen[st.g] || 0) + 1;
    }));
    check(missing.length === 0, tag + ': every word in a stop is a word of the level' + (missing.length ? ' (' + missing.join(' ') + ')' : ''));
    const notIn = words.filter(z => !seen[z]); const twice = Object.keys(seen).filter(z => seen[z] > 1);
    check(notIn.length === 0, tag + ': every word of the level is in a stop' + (notIn.length ? ' (' + notIn.join(' ') + ')' : ''));
    check(twice.length === 0, tag + ': no word is taught twice' + (twice.length ? ' (' + twice.join(' ') + ')' : ''));
    check(biggest <= 8, tag + ': no stop has more than 8 words (largest ' + biggest + ')');
    check(dupId === 0, tag + ': stop ids are unique');
  }
}

// grammar lessons: the path must hold every lesson of its level once. The ids come from the grammar data itself.
{
  const { ctx } = load(false);
  for (const n of [1, 2, 3]) {
    const G = ctx['HSK' + n + '_GRAMMAR'];
    const list = Array.isArray(G) ? G : (G.lessons || G.items || []);
    const ids = list.map(l => l.id);
    const inPath = {}; ctx.SHANLU_PATH[n].units.forEach(u => u.stops.forEach(st => { if (st.k === 'g') inPath[st.g] = (inPath[st.g] || 0) + 1; }));
    const lost = ids.filter(i => !inPath[i]); const twice = Object.keys(inPath).filter(i => inPath[i] > 1); const stray = Object.keys(inPath).filter(i => ids.indexOf(i) < 0);
    check(ids.length > 0, 'HSK ' + n + ': the grammar data lists its lessons (' + ids.length + ')');
    check(lost.length === 0 && twice.length === 0 && stray.length === 0, 'HSK ' + n + ': every grammar lesson is on the path once' + (lost.length ? ' missing ' + lost.join(' ') : '') + (twice.length ? ' twice ' + twice.join(' ') : '') + (stray.length ? ' unknown ' + stray.join(' ') : ''));
  }
  // anchors of the order: hello comes before anything else, numbers before time, and each level starts with a word stop
  const first = ctx.SHANLU_PATH[1].units[0].stops[0];
  check(first.k === 'w' && first.w.indexOf('你好') >= 0, 'HSK 1 starts with 你好');
  const flat = (n) => [].concat.apply([], ctx.SHANLU_PATH[n].units.map(u => u.stops));
  const at = (n, z) => flat(n).findIndex(st => st.k === 'w' && st.w.indexOf(z) >= 0);
  check(at(1, '你好') < at(1, '三') && at(1, '三') < at(1, '星期'), 'HSK 1: greetings, then numbers, then days of the week');
  check(ctx.SHANLU_PATH[2].units[0].stops[0].k === 'w' && ctx.SHANLU_PATH[3].units[0].stops[0].k === 'w', 'HSK 2 and HSK 3 start with a word stop');
}

// the themed look (content/path-theme.json -> data/path.js theme; pictures in data/path-scenes.js)
{
  const { ctx } = load(false);
  vm.runInContext(fs.readFileSync(path.join(root, 'data/path-scenes.js'), 'utf8'), ctx, { filename: 'data/path-scenes.js' });
  const scenes = ctx.SHANLU_PATH_SCENES || {};
  const KINDS = { 1: 'day', 2: 'rail', 3: 'story' };
  for (const n of [1, 2, 3]) {
    const P = ctx.SHANLU_PATH[n], th = P.theme;
    check(!!th && th.kind === KINDS[n], 'HSK ' + n + ': the path has its theme (' + KINDS[n] + ')');
    if (!th) continue;
    const ids = P.units.map(u => u.id);
    check(ids.every(i => th.units[i]) && Object.keys(th.units).length === ids.length, 'HSK ' + n + ': every unit has a theme entry, and no other');
    const pics = [th.hero].concat((th.groups || []).map(g => g.scene));
    check(pics.every(k => scenes[k] && /^data:image\/svg\+xml/.test(scenes[k])), 'HSK ' + n + ': every picture of the theme exists (' + pics.join(', ') + ')');
    const tiles = ctx.SHANLU_PATH_TILES || {};
    check(ids.every(i => tiles[th.units[i].tile]) && ids.every(i => (th.units[i].bg || (th.groups.find(g => ids.indexOf(g.from) <= ids.indexOf(i) && ids.indexOf(i) <= ids.indexOf(g.to)) || {}).bg || []).length === 2), 'HSK ' + n + ': every unit has a trail wallpaper and two background colours')
    const flat = [].concat.apply([], (th.groups || []).map(g => ids.slice(ids.indexOf(g.from), ids.indexOf(g.to) + 1)));
    check(!th.groups.length || flat.join() === ids.join(), 'HSK ' + n + ': the groups cover the units once, in order');
    if (th.kind === 'rail') check(ids.every(i => th.units[i].ch && th.units[i].py), 'HSK 2: every station has a character and pinyin');
    if (th.kind === 'day') check(ids.every(i => /^\d{1,2}:\d\d$/.test(th.units[i].time) && th.units[i].scene), 'HSK 1: every unit has a time and a scene line');
    if (th.kind === 'story') {
      const L = ids.map(i => th.units[i].lines);
      check(L.every(l => l && l.length === 2 && l.every(x => x.zh && x.py && x.en && /^[\u4e00-\u9fff]$/.test(x.who))), 'HSK 3: every chapter has two chat lines with Chinese, pinyin and English');
      check(L.every(l => l.every(x => !/[\u4e00-\u9fff]/.test(x.py) && /[a-zāáǎàēéěèīíǐìōóǒòūúǔùü]/i.test(x.py))), 'HSK 3: the pinyin of the chat lines is written in letters');
    }
  }
}

if (failures) { console.log(failures + ' failed'); process.exit(1); }
console.log('path data tests passed');
