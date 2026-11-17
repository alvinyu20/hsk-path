#!/usr/bin/env python3
"""Compare the pinyin the site shows for each word of a level with the official list's pinyin.
Usage: python3 tools/audit-official-pinyin.py LEVEL [path/to/complete.json]
  HSK 3, 4, 5: against content/hskN-official-*.tsv (number|word|pinyin|part of speech, or tab-separated).
  HSK 1, 2: there is no official pinyin file here; the dataset's pinyin (complete.json) is used instead (a weaker check).
Prints one line per word that differs (spaces, apostrophes, hyphens and case are ignored)."""
import glob, json, os, re, sys, unicodedata
LV = sys.argv[1] if len(sys.argv) > 1 else '5'
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
os.environ['LEVEL'] = LV
os.environ['PARTIAL'] = '1'
sys.path.insert(0, 'tools')
import levelcfg
from pinyin_engine import Engine

eng = Engine(levelcfg.known())


def norm(s):
    s = unicodedata.normalize('NFC', s.lower())
    return re.sub(r"[\s'\-’·]", '', s)


offs = glob.glob('content/hsk%s-official-*.tsv' % LV)
rows = []
if offs:
    rows = [re.split(r'[|\t]', l.rstrip('\n'))[1:3] for l in open(offs[0], encoding='utf-8') if ('|' in l or '\t' in l) and not l.startswith('#')]
    src = offs[0]
else:
    ds = sys.argv[2] if len(sys.argv) > 2 else '../hsk-dataset/complete.json'
    words = [l.strip() for l in open(glob.glob('content/hsk%s-official-*.txt' % LV)[0], encoding='utf-8') if l.strip() and not l.startswith('#')]
    D = {}
    for e in json.load(open(ds, encoding='utf-8')):
        D.setdefault(e['simplified'], [f['transcriptions']['pinyin'] for f in e.get('forms', [])])
    rows = [[w, ' / '.join(D.get(w, []))] for w in words]
    src = ds + ' (dataset readings; a word passes when the site matches any of them)'
bad = 0
seen = set()
for word, py in rows:
    if word in seen:
        continue
    seen.add(word)
    shown = eng.wpy.get(word)
    if shown is None or not py:
        continue
    alts = [norm(p) for p in py.split(' / ')] if not offs else [norm(py)]
    if norm(shown) not in alts and not any(norm(x) in alts for x in shown.split(' / ')):
        bad += 1
        print('%s\tshown=%s\tlist=%s' % (word, shown, py))
print('HSK %s: %d of %d words differ from %s' % (LV, bad, len(seen), src))
