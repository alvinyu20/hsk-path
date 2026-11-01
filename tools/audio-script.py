#!/usr/bin/env python3
"""Write the list of everything the site reads aloud, as a script for a native speaker to record.

Usage:  node tools/dump-sentences.js 2 --plain > /tmp/s.json
        python3 tools/audio-script.py 2 /tmp/s.json            # writes review/audio-script-hsk2.tsv
Columns: priority, text (the file name), pinyin, english, where.  Priority 1 = the words themselves, 2 = their first example sentence,
3 = every other sentence. Record in that order: the words cover the most use for the least work.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    level = int(sys.argv[1])
    sents = json.load(open(sys.argv[2], encoding='utf-8'))
    src = open(os.path.join(ROOT, 'data', 'hsk%d-words.js' % level), encoding='utf-8').read()
    words = json.loads(src[src.index('[', src.index('window.')):src.rindex(']') + 1])
    rows, seen = [], set()
    def add(pri, zh, py, en, where):
        if zh in seen:
            return
        seen.add(zh)
        rows.append((pri, zh, py, en, where))
    for w in words:
        add(1, w['zh'], w.get('py', ''), w.get('en', ''), 'word')
    first = {}
    for s in sents:
        w = s.get('word')
        if w and w not in first and s['where'].startswith('word:'):
            first[w] = s
    for s in first.values():
        add(2, s['zh'], s['py'], s['en'], s['where'])
    for s in sents:
        add(3, s['zh'], s['py'], s['en'], s['where'])
    out = os.path.join(ROOT, 'review', 'audio-script-hsk%d.tsv' % level)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('priority\ttext\tpinyin\tenglish\twhere\n')
        for r in rows:
            f.write('\t'.join(str(x).replace('\t', ' ') for x in r) + '\n')
    n = [sum(1 for r in rows if r[0] == k) for k in (1, 2, 3)]
    print('wrote %s: %d words, %d first example sentences, %d other sentences' % (os.path.relpath(out, ROOT), *n))


if __name__ == '__main__':
    main()
