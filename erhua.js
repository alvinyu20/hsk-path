/* The "儿 endings" switch. The official HSK 1 list prints some words with a northern 儿 ending (面条儿, 这儿, 哪儿 ...).
 * Many speakers, especially in the south and in Taiwan, say 面条 and 这里 instead. In plain mode (the default) this module rewrites the
 * loaded content before the app starts: words, sentences, pinyin and dictation keys all use the plain forms.
 * The table comes from content/erhua.tsv (data/hsk1-erhua.js). The same code runs in the browser and in tools/dump-sentences.js,
 * so the checks see exactly what the learner sees. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluErhua = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LETTER = /[A-Za-zÀ-ɏḀ-ỿ]/;

  // Replace `from` with `to` only where it is not part of a longer pinyin syllable run; also handles a capital first letter.
  function swapPinyin(s, from, to) {
    let out = s;
    [[from, to], [from.charAt(0).toUpperCase() + from.slice(1), to.charAt(0).toUpperCase() + to.slice(1)]].forEach(([f, t]) => {
      let i = 0, res = '';
      for (;;) {
        const j = out.indexOf(f, i);
        if (j < 0) { res += out.slice(i); break; }
        const before = j > 0 ? out.charAt(j - 1) : '';
        const after = out.charAt(j + f.length);
        const ok = !(before && LETTER.test(before)) && !(after && LETTER.test(after));
        res += out.slice(i, j) + (ok ? t : f);
        i = j + f.length;
      }
      out = res;
    });
    return out;
  }
  const toneless = (py) => py.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function make(table) {
    const pairs = table.pairs;
    const overrides = {};
    table.overrides.forEach(o => { overrides[o.from] = o.to; });
    const zhSwaps = pairs.map(p => [p.official, p.plain]).concat([['玩儿', '玩']]);
    zhSwaps.sort((a, b) => b[0].length - a[0].length);
    // toneless pinyin as typed by a learner: "nar" and the spelled-out "naer" both stand for 哪儿
    const keySwaps = [];
    pairs.forEach(p => {
      const off = toneless(p.officialPy), pl = toneless(p.plainPy);
      keySwaps.push([off, pl], [off.replace(/r$/, 'er'), pl]);
    });
    const twins = pairs.filter(p => p.twin).map(p => p.official);
    const toPlain = {};
    pairs.forEach(p => { toPlain[p.official] = p.plain; });

    const zh = (s) => {
      if (Object.prototype.hasOwnProperty.call(overrides, s)) return overrides[s];
      // "这儿 / 这里" and "在哪儿 or 在哪里" would turn into the same word twice, so they collapse to one
      let t = s.replace(/(在?)([这那哪])儿( \/ | or )\1\2里/g, '$1$2里');
      zhSwaps.forEach(([f, p]) => { if (t.indexOf(f) >= 0) t = t.split(f).join(p); });
      return t;
    };
    const py = (s) => { let t = s; pairs.forEach(p => { t = swapPinyin(t, p.officialPy, p.plainPy); }); return t; };
    const key = (s) => { let t = s; keySwaps.forEach(([f, p]) => { t = swapPinyin(t, f, p); }); return t; };

    // typed answers: the plain form first, and the 儿 form is still accepted, because it is not wrong
    const accepts = (arr) => {
      const out = [];
      arr.forEach(a => { const p = /^[a-z]+$/.test(a) ? key(a) : zh(a); out.push(p); if (a !== p) out.push(a); });
      return out.filter((x, i) => out.indexOf(x) === i);
    };

    // deep copy with every string rewritten; "py" fields are pinyin, "key" fields are toneless pinyin, the rest is Chinese or English prose
    function walk(v, k) {
      // prose can hold both kinds at once ("哪儿 · nǎr"); the tone-marked pinyin swap only matches exact 儿 forms, so it is safe on any string
      if (typeof v === 'string') return k === 'py' ? py(v) : k === 'key' ? key(v) : py(zh(v));
      if (Array.isArray(v) && k === 'accepts') return accepts(v);
      if (Array.isArray(v)) return v.map(x => walk(x, k));
      if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(kk => { o[kk] = walk(v[kk], kk); }); return o; }
      return v;
    }
    const uniq = (arr, f) => { const seen = {}; return arr.filter(x => { const id = f ? f(x) : x; if (seen[id]) return false; seen[id] = true; return true; }); };

    // Rewrites the HSK 1 data on `win` in place. Returns the list of dropped words.
    function apply(win) {
      const words = (win.HSK1_WORDS || []).filter(w => twins.indexOf(w.zh) < 0);
      win.HSK1_WORDS = walk(words);
      if (win.HSK1_GRAMMAR) win.HSK1_GRAMMAR = walk(win.HSK1_GRAMMAR);
      if (win.HSK1_SPEAK) {
        win.HSK1_SPEAK = walk(win.HSK1_SPEAK);
        win.HSK1_SPEAK.scenarios.forEach(s => { s.words = uniq(s.words, w => w.zh); });
      }
      if (win.HSK1_LISTEN) win.HSK1_LISTEN = walk(win.HSK1_LISTEN);
      if (win.HSK1_EXAM) win.HSK1_EXAM = walk(win.HSK1_EXAM);
      if (win.HSK1_WEBS) {
        // the 儿 word of a twin pair is dropped, so the plain twin keeps its own entry (and its own character parts)
        const w0 = JSON.parse(JSON.stringify(win.HSK1_WEBS));
        w0.hubs.forEach(h => { h.words = h.words.filter(x => twins.indexOf(x.zh) < 0); });
        w0.topics.forEach(t => { t.words = t.words.filter(z => twins.indexOf(z) < 0); });
        const w = walk(w0);
        w.hubs.forEach(h => {
          h.words = uniq(h.words, x => x.zh);
          h.gaps.forEach(g => { g.opts = uniq(g.opts); });
        });
        w.topics.forEach(t => { t.words = uniq(t.words); });
        w.opps = uniq(w.opps, o => o.a + '|' + o.b);
        win.HSK1_WEBS = w;
      }
      return twins;
    }
    return { apply, zh, py, toPlain, twins, pairs };
  }

  return { make };
});
