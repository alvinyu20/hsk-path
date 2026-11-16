#!/usr/bin/env python3
"""Compare the pinyin the site will show for each HSK 5 word with the official list's pinyin."""
import os, sys, re, unicodedata
os.chdir('/home/claude/hsk-path')
os.environ['LEVEL'] = '5'
os.environ['PARTIAL'] = '1'
sys.path.insert(0, 'tools')
import levelcfg
from pinyin_engine import Engine

eng = Engine(levelcfg.known())
rows = [l.rstrip('\n').split('|') for l in open('content/hsk5-official-1600.tsv', encoding='utf-8') if '|' in l]


def norm(s):
    s = unicodedata.normalize('NFC', s.lower())
    return re.sub(r"[\s'\-’·]", '', s)


bad = 0
seen = set()
for num, word, py, pos in rows:
    if word in seen:
        continue
    seen.add(word)
    shown = eng.wpy.get(word)
    if shown is None:
        continue
    if norm(shown) != norm(py):
        bad += 1
        print('%s\t%s\tshown=%s\tofficial=%s' % (num, word, shown, py))
print('words with a difference:', bad, 'of', len(seen))
