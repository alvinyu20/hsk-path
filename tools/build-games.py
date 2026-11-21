#!/usr/bin/env python3
"""Builds data/games.js (window.SHANLU_GAMES) from the Minigames content and checks it.

Tell them apart (content/tellapart.json for HSK 1, content/lN/tellapart.json for HSK N): sets of 2 or 3 grammar words or patterns that
are easy to mix up. Each card is a sentence with the gap in square brackets, e.g. "我去[过]北京。"; the gap word must be one of the set's options.
  set:  id, title, opts (2 or 3), needs (lesson ids that must be passed first, from this level or below), means (one line per option:
        what it means, shown when it is picked by mistake), items
  item: zh (with exactly one [gap]), en, why, also (optional: other options that are just as right here)
Checked: ids unique across levels, lesson ids exist, one gap per sentence and it is an option, `also` are options, and every word
of the sentence is on the lists of its level or below (the same rule as tools/check-grammar-vocab.py).

Run: python3 tools/build-games.py [--check]   (--check: build in memory and compare with data/games.js; exit 1 if it differs)"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pinyin_engine import Engine
import levelcfg

ROOT = levelcfg.ROOT
C = levelcfg.C
CJK = re.compile(r'[一-鿿]')
GAP = re.compile(r'\[([^\]]+)\]')
OUT = os.path.join(ROOT, 'data', 'games.js')
errors = []


def err(m):
    errors.append(m)


def level_dir(n):
    return C if n == 1 else os.path.join(C, 'l%d' % n)


def known(n):
    out = []
    for k in range(1, n + 1):
        out += levelcfg.read_list(k)
    return out


def extra_words():
    p = os.path.join(C, 'allowed-extra.tsv'); s = set()
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            w = line.split('\t')[0].strip()
            if w and not w.startswith('#'):
                s.add(w)
    return s


def lesson_ids(n):
    ids = {}   # id -> [level, short title (the part before the colon)]
    for k in range(1, n + 1):
        for f in glob.glob(os.path.join(level_dir(k), 'grammar-*.json')):
            for L in json.load(open(f, encoding='utf-8')):
                ids[L['id']] = [k, L['title'].split(':')[0].strip()]
    return ids


def main():
    extra = extra_words()
    out = {'tellapart': {}}
    seen = set()
    for n in range(1, 6):
        p = os.path.join(level_dir(n), 'tellapart.json')
        if not os.path.exists(p):
            continue
        words = known(n); allowed = set(words); chars = set(''.join(allowed))
        os.environ['LEVEL'] = str(n)   # the engine reads lexicon-words.tsv entries up to this level (慢慢 mànmàn is an HSK 2 entry)
        eng = Engine(words); lids = lesson_ids(n)
        sets = []
        for S in json.load(open(p, encoding='utf-8')):
            sid = S['id']; where = 'HSK %d %s' % (n, sid)
            if sid in seen:
                err(where + ': the id is used twice')
            seen.add(sid)
            opts = S['opts']
            if not 2 <= len(opts) <= 3 or len(set(opts)) != len(opts):
                err(where + ': needs 2 or 3 different options')
            for lid in S['needs']:
                if lid not in lids:
                    err(where + ': lesson %s is not a lesson of HSK %d or below' % (lid, n))
            if sorted(S['means']) != sorted(opts):
                err(where + ': `means` needs one line for each option')
            items = []
            for i, it in enumerate(S['items'], 1):
                w = '%s card %d' % (where, i)
                gaps = GAP.findall(it['zh'])
                if len(gaps) != 1:
                    err(w + ': needs exactly one [gap]'); continue
                a = gaps[0]
                if a not in opts:
                    err(w + ': the gap %s is not an option' % a)
                also = it.get('also', [])
                for x in also:
                    if x not in opts or x == a:
                        err(w + ': also %s must be another option' % x)
                full = GAP.sub(r'\1', it['zh'])
                pre, post = it['zh'].split('[' + a + ']')
                for t in eng.word_tokens(full):
                    if not CJK.search(t) or t in allowed or t in extra:
                        continue
                    if len(t) <= 4 and all(c in chars for c in t):
                        continue
                    err(w + ': %s is not on the lists of HSK %d or below (%s)' % (t, n, full))
                if not it.get('en') or not it.get('why'):
                    err(w + ': needs en and why')
                py, _ = eng.sentence(full)

                def part_py(z, first):
                    # the pinyin of the words before and after the gap (shown before you answer, so the gap word's pinyin is not given away);
                    # the part after the gap is not a new sentence, so it starts in lower case unless its first word is a name (Zhōngguó)
                    if not CJK.search(z):
                        return ''
                    q = eng.sentence(z)[0]
                    if not first:
                        t0 = next((t for t in eng.word_tokens(z) if CJK.search(t)), '')
                        if t0 and eng.word_py(t0)[:1].islower():
                            q = q[:1].lower() + q[1:]
                    return q
                lw = []
                for t in eng.word_tokens(full):
                    if t in allowed and t not in lw and t != a:
                        lw.append(t)
                items.append({'w': lw, 'zh': full, 'pre': pre, 'post': post, 'a': a, 'also': also, 'en': it['en'], 'why': it['why'], 'py': py,
                              'preQ': part_py(pre, True), 'postQ': part_py(post, False)})
            if len(items) < 6:
                err(where + ': needs at least 6 cards (has %d)' % len(items))
            sets.append({'id': sid, 'lv': n, 'title': S['title'], 'opts': opts, 'optPy': [eng.word_py(o).split(' / ')[0] for o in opts],
                         'means': [S['means'][o] for o in opts], 'needs': S['needs'],
                         'needT': [lids[x][1] if x in lids else x for x in S['needs']], 'needL': [lids[x][0] if x in lids else n for x in S['needs']], 'items': items})
        out['tellapart'][str(n)] = sets
    if errors:
        print('\n'.join(errors)); print('%d problem(s)' % len(errors)); sys.exit(1)
    js = '// generated by tools/build-games.py from content/tellapart.json and content/l*/tellapart.json: do not edit by hand\nwindow.SHANLU_GAMES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != js:
            print('data/games.js is out of date: run python3 tools/build-games.py'); sys.exit(1)
        print('games data up to date'); return
    open(OUT, 'w', encoding='utf-8').write(js)
    print('wrote data/games.js: %s' % ', '.join('HSK %s %d sets / %d cards' % (k, len(v), sum(len(s['items']) for s in v)) for k, v in out['tellapart'].items()))


if __name__ == '__main__':
    main()
