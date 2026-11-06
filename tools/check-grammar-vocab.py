#!/usr/bin/env python3
"""Checks that the grammar sentences of a level use only words of this level or below.
Covers the lessons (grammar-*.json), the write-your-own prompts (gwrite.tsv) and the extra exercises (gmore.json).
Run:  LEVEL=2 python3 tools/check-grammar-vocab.py      (exit 1 when a word is outside the level)"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pinyin_engine import Engine
import levelcfg

CJK = re.compile(r'[一-鿿]')
allowed = set(levelcfg.known())
chars = set(''.join(allowed))
# a word that is not a list entry of its own is fine when it is built only from characters of the list (up to four of them). Names and units used inside the lessons are listed in content/allowed-extra.tsv (shared with the other checks).
extra = set()
p = os.path.join(levelcfg.C, 'allowed-extra.tsv')
if os.path.exists(p):
    for line in open(p, encoding='utf-8'):
        w = line.split('\t')[0].strip()
        if w and not w.startswith('#'):
            extra.add(w)
eng = Engine(levelcfg.known())


def bad_words(zh):
    out = []
    for t in eng.word_tokens(zh):
        if not CJK.search(t) or t in allowed or t in extra:
            continue
        if len(t) <= 4 and all(c in chars for c in t):   # a compound of known characters (星期五, 每天, 十一月)
            continue
        out.append(t)
    return out


def sentences():
    for f in sorted(glob.glob(os.path.join(levelcfg.CONTENT, 'grammar-*.json'))):
        for L in json.load(open(f, encoding='utf-8')):
            for i, q in enumerate(L['q']):
                yield '%s q%d' % (L['id'], i + 1), q['zh']
                if q.get('wrong'):
                    yield '%s q%d wrong' % (L['id'], i + 1), q['wrong']
    wp = os.path.join(levelcfg.CONTENT, 'gwrite.tsv')
    if os.path.exists(wp):
        for n, line in enumerate(open(wp, encoding='utf-8'), 1):
            f = line.rstrip('\n').split('\t')
            if len(f) >= 3 and not line.startswith('#'):
                yield 'gwrite %s line %d' % (f[0], n), f[2]
    mp = os.path.join(levelcfg.CONTENT, 'gmore.json')
    if os.path.exists(mp):
        for n, q in enumerate(json.load(open(mp, encoding='utf-8')), 1):
            yield 'gmore %s #%d' % (q['p'], n), q['zh']
            if q.get('wrong'):
                yield 'gmore %s #%d wrong' % (q['p'], n), q['wrong']
            for o in q.get('options', []):
                yield 'gmore %s #%d option' % (q['p'], n), o


def main():
    bad = []
    for where, zh in sentences():
        b = bad_words(zh)
        if b:
            bad.append((where, zh, b))
    for w, zh, b in bad:
        print('  %-24s %s   outside the level: %s' % (w, zh, ' '.join(b)))
    print('grammar vocabulary (HSK %d): %s' % (levelcfg.LEVEL, 'ok' if not bad else '%d sentences use words outside the level' % len(bad)))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
