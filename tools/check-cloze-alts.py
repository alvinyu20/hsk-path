#!/usr/bin/env python3
"""Checks content/cloze-alts.tsv: other words a learner may type in the gap of a "Fill it" sentence.

Each row is: answer (the gap word), other word, verdict (also / wrong), sentence, teaching note.
  - the sentence must be one of the answer word's example sentences, usable as a Fill it question
    (the word appears once, and is its own token), so the row really reaches the learner;
  - the other word must be on the word lists at that level or lower (a learner can only type words they know),
    and differ from the answer;
  - no row twice, and no word both "also" and "wrong" for the same sentence;
  - the note must be English with the Chinese only as examples (it must contain some Latin letters).
Run after tools/build-words.py for every level (it reads data/hsk*-words.js). Exit 1 on any problem.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TSV = os.path.join(ROOT, 'content', 'cloze-alts.tsv')


def load_words(level):
    path = os.path.join(ROOT, 'data', 'hsk%d-words.js' % level)
    if not os.path.exists(path):
        return None
    out = []
    for line in open(path, encoding='utf-8'):
        line = line.strip().rstrip(',')
        if line.startswith('{"zh"'):
            out.append(json.loads(line))
    return out


def main():
    level_of, examples = {}, {}   # word -> first level; (word, sentence) -> (level, example)
    n = 1
    while True:
        ws = load_words(n)
        if ws is None:
            break
        for w in ws:
            level_of.setdefault(w['zh'], n)
            for e in [w['ex']] + w.get('more', []):
                examples.setdefault((w['zh'], e['zh']), (n, e))
        n += 1
    if not level_of:
        sys.exit('no data/hsk*-words.js found: run tools/build-words.py first')

    errors, seen, verdicts = [], set(), {}
    rows = 0
    for i, line in enumerate(open(TSV, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        p = line.split('\t')
        where = 'cloze-alts.tsv line %d' % i
        if len(p) != 5 or any(not x.strip() for x in p):
            errors.append('%s: expected 5 filled columns, got %r' % (where, p))
            continue
        word, other, v, sent, note = p
        rows += 1
        if v not in ('also', 'wrong'):
            errors.append('%s: verdict must be also or wrong, not %r' % (where, v))
        hit = examples.get((word, sent))
        if not hit:
            errors.append('%s: %r is not an example sentence of %s' % (where, sent, word))
            continue
        lv, ex = hit
        if sent.count(word) != 1 or word not in ex.get('toks', []):
            errors.append('%s: %r cannot be a Fill it question for %s (the word must appear once, as its own word)' % (where, sent, word))
        if other == word:
            errors.append('%s: the other word is the answer itself' % where)
        elif other not in level_of:
            errors.append('%s: %s is not on any word list' % (where, other))
        elif level_of[other] > lv:
            errors.append('%s: %s is HSK %d, above this HSK %d sentence' % (where, other, level_of[other], lv))
        key = (word, sent, other)
        if key in seen:
            errors.append('%s: %s for %s in %r is listed twice' % (where, other, word, sent))
        seen.add(key)
        verdicts.setdefault(key, set()).add(v)
        if not re.search('[A-Za-z]{3}', note):
            errors.append('%s: the note should be English' % where)
    for (word, sent, other), vs in verdicts.items():
        if len(vs) > 1:
            errors.append('%s is both also and wrong for %s in %r' % (other, word, sent))
    for e in errors:
        print('ERROR', e)
    print('cloze-alts: %d rows, %d sentences, %d problems' % (rows, len({(w, s) for w, s, _ in seen}), len(errors)))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
