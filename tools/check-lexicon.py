"""Fails when a noun-type word from the big HSK dataset is split into separate words in a sentence and nobody has decided it should be.

A learner copies the spacing of the pinyin they see, so word boundaries matter (每天 měitiān, not měi tiān). The pinyin engine only knows the
HSK lists plus content/lexicon-words.tsv, so a natural word outside them is split per character. This check lists every dataset word of
type noun, time, place or localizer (length 2 to 4) that the engine splits, and lets it pass only if it is in
  content/lexicon-words.tsv  (written solid: the engine already joins it, so it never shows up here), or
  content/lexicon-split.tsv  (reviewed: stays split, with the reason).
Verbs and adverbs (在家, 吃饭, 回家 ...) are not checked: whether they are one word is a matter of taste.

Usage: LEVEL=1 python3 tools/check-lexicon.py <dataset complete.json> <sentences.json from tools/dump-sentences.js>
"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import levelcfg
from pinyin_engine import Engine, read_tsv, C

NOUNISH = {'n', 't', 's', 'f', 'nr', 'ns'}


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    ds = json.load(open(sys.argv[1], encoding='utf-8'))
    sents = json.load(open(sys.argv[2], encoding='utf-8'))
    words = {}
    for e in ds:
        w = e['simplified']
        if 2 <= len(w) <= 4 and set(e.get('pos', [])) & NOUNISH:
            words[w] = e['pos']
    split_ok = {r[0] for _, r in read_tsv(os.path.join(C, 'lexicon-split.tsv'))}
    eng = Engine(levelcfg.known())
    found = collections.OrderedDict()
    seen = set()
    for s in sents:
        zh = s['zh']
        if zh in seen:
            continue
        seen.add(zh)
        toks = eng.tokens(zh)
        spans, pos = [], 0
        for t in toks:
            spans.append((pos, pos + len(t), t)); pos += len(t)
        for n in range(2, 5):
            for i in range(len(zh) - n + 1):
                w = zh[i:i + n]
                if w not in words or w in split_ok:
                    continue
                cov = [sp for sp in spans if sp[0] >= i and sp[1] <= i + n]
                if len(cov) >= 2 and sum(len(sp[2]) for sp in cov) == n:
                    found.setdefault(w, []).append(zh)
    for w, v in found.items():
        print('ERROR: %s is split in %d sentence(s), e.g. %s. Add it to content/lexicon-words.tsv (written solid) or to content/lexicon-split.tsv (stays split, with a reason).' % (w, len(v), v[0]))
    print('lexicon check: %d unreviewed split word(s)' % len(found))
    sys.exit(1 if found else 0)


main()
