"""Fails when a sentence can be cut into words in two equally good ways and nobody has decided which is right.

Word boundaries show up as spaces in the pinyin and as the words you can tap, so a wrong cut is visible to a learner
(有时间 as "yǒushí jiān"). The engine scores a cut by the weight of its words; two cuts that score the same are a tie, and the
engine settles a tie by taking the longer first word. That is usually right (马路 | 上) and sometimes wrong (有时 | 间).
This check finds every sentence where the two ways of settling a tie give different cuts, and lets it pass only if
  content/segment-reviewed.tsv  lists the sentence with the cut a person approved (columns: sentence, words separated by spaces, note).
If the cut is wrong, add the word that should stay whole to content/segment-prefer.tsv instead.

Usage: LEVEL=1 python3 tools/check-ties.py <sentences.json from tools/dump-sentences.js>
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import levelcfg
from pinyin_engine import Engine, read_tsv, C


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    sents = json.load(open(sys.argv[1], encoding='utf-8'))
    reviewed = {}
    rp = os.path.join(C, 'segment-reviewed.tsv')
    if os.path.exists(rp):
        for _, r in read_tsv(rp):
            reviewed[r[0]] = r[1].split() if len(r) > 1 else []
    eng = Engine(levelcfg.known())
    seen, ties, bad = set(), 0, []
    for s in sents:
        zh = s['zh']
        if zh in seen:
            continue
        seen.add(zh)
        a, b = eng.tokens(zh), eng.tokens_right(zh)
        if a == b:
            continue
        ties += 1
        if reviewed.get(zh) != a:
            bad.append((s['where'], zh, a, b, reviewed.get(zh)))
    for where, zh, a, b, ok in bad:
        print('ERROR %s %s' % (where, zh))
        print('   engine cut: %s | the other cut: %s | approved: %s' % (' '.join(a), ' '.join(b), ' '.join(ok) if ok else 'none'))
    print('segmentation ties: %d sentence(s) of %d distinct, %d not reviewed' % (ties, len(seen), len(bad)))
    sys.exit(1 if bad else 0)


main()
