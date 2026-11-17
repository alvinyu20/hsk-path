#!/usr/bin/env python3
"""Add new grammar-review extras, "write your own sentence" prompts and listening clips to one level from batch files.

Usage:
    python3 tools/add-practice-items.py LEVEL batch1.txt [batch2.txt ...]          # check, then add
    python3 tools/add-practice-items.py LEVEL batch1.txt ... --check                # only check, change nothing
Then rebuild and check the level as usual:
    LEVEL=N python3 tools/build-grammar.py ; LEVEL=N python3 tools/build-speech.py ; node tools/build-site.js
    bash tools/check-all.sh ../hsk-dataset/complete.json --no-browser
and make the file for the Chinese AI check:  python3 tools/make-review-delta.py LEVEL <git rev before the change>

One item per line, fields separated by |. Empty lines and lines starting with # are skipped. p is a grammar point id (content/.../gpoints.json).
    p|mc|right sentence|wrong sentence|English|note
    p|cloze|sentence|blank word|English|note                    the blank must be one whole word and appear once
    p|order|sentence|English|note                               3 to 9 words
    p|spot|right sentence|sentence with one extra word|extra word|English|note[|also]
                                                                also: other words (comma separated) whose removal ALSO leaves a correct
                                                                sentence; tapping one of them is then marked right too
    p|w|English prompt|model answer|word(s) the answer must use (comma separated)
    clip|Chinese|English|note 1|note 2                          a listening-lab clip (notes: what to listen for)

The checks here are the cheap structural ones (the build rules). The level, meaning and pinyin checks run in check-all afterwards.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) < 2:
    print(__doc__); sys.exit(2)
LV = args[0]; FILES = args[1:]; CHECK = '--check' in sys.argv
os.environ['LEVEL'] = LV
from pinyin_engine import Engine   # noqa: E402
import levelcfg   # noqa: E402
eng = Engine(levelcfg.known())
C = os.path.join(ROOT, 'content', '' if LV == '1' else 'l' + LV)

more = json.load(open(os.path.join(C, 'gmore.json'), encoding='utf-8'))
points = [p['id'] for p in json.load(open(os.path.join(C, 'gpoints.json'), encoding='utf-8'))]
lis_path = os.path.join(C, 'listening.json')
lis = json.load(open(lis_path, encoding='utf-8'))
seen = set(it['zh'] for it in more)
seen_clip = set(c['zh'] for c in lis['clips'])
new, wnew, cnew, bad = [], [], [], 0


def err(f, n, msg, line):
    global bad
    bad += 1
    print('%s:%d %s :: %s' % (os.path.basename(f), n, msg, line[:100]))


for f in FILES:
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        a = line.split('|')
        if a[0] == 'clip':
            if len(a) != 5:
                err(f, n, 'a clip needs clip|Chinese|English|note|note', line); continue
            if a[1] in seen_clip:
                err(f, n, 'this clip is already there', line); continue
            seen_clip.add(a[1]); cnew.append(dict(zh=a[1], en=a[2], notes=[a[3], a[4]])); continue
        if len(a) < 3 or a[0] not in points:
            err(f, n, 'unknown grammar point %r' % a[0], line); continue
        p, t = a[0], a[1]
        try:
            if t == 'w':
                _, _, pr, zh, needs = line.split('|', 4)
                wnew.append('\t'.join([p, pr, zh, needs])); continue
            if t == 'mc':
                _, _, ok, wrong, en, ex = a
                it = {'p': p, 't': 'mc', 'prompt': 'Which sentence says: ' + en.rstrip('.') + '?', 'options': [ok, wrong], 'correct': 0, 'zh': ok, 'en': en, 'explain': ex}
            elif t == 'cloze':
                _, _, zh, blank, en, ex = a
                it = {'p': p, 't': 'cloze', 'zh': zh, 'en': en, 'blank': blank, 'explain': ex}
                toks = eng.sentence(zh)[1]
                if blank not in toks: err(f, n, 'the blank is not a whole word: ' + '/'.join(toks), line)
                if zh.count(blank) != 1: err(f, n, 'the blank appears %d times' % zh.count(blank), line)
            elif t == 'order':
                _, _, zh, en, ex = a
                it = {'p': p, 't': 'order', 'zh': zh, 'en': en, 'explain': ex}
                toks = eng.sentence(zh)[1]
                if not 3 <= len(toks) <= 9: err(f, n, 'order needs 3 to 9 words, has %d: %s' % (len(toks), '/'.join(toks)), line)
            elif t == 'spot':
                zh, wrong, rem, en, ex = a[2:7]
                also = [w for w in (a[7].split(',') if len(a) > 7 else []) if w]
                it = {'p': p, 't': 'spot', 'zh': zh, 'en': en, 'wrong': wrong, 'remove': rem, 'explain': ex}
                if also: it['also'] = also
                if not any(wrong[:i] + wrong[i + len(rem):] == zh for i in range(len(wrong)) if wrong.startswith(rem, i)):
                    err(f, n, 'removing %s from the wrong sentence must give the right one' % rem, line)
                wt = eng.word_tokens(wrong)
                for w in [rem] + also:
                    if w not in wt or wrong.count(w) != 1: err(f, n, '%s is not a single word of the wrong sentence: %s' % (w, '/'.join(wt)), line)
            else:
                err(f, n, 'unknown type ' + t, line); continue
        except ValueError:
            err(f, n, 'wrong number of fields for ' + t, line); continue
        if it['zh'] in seen:
            err(f, n, 'this sentence is already used', line); continue
        seen.add(it['zh']); new.append(it)

print('checked: %d review items, %d write prompts, %d clips, %d problem(s)' % (len(new), len(wnew), len(cnew), bad))
if bad or CHECK:
    sys.exit(1 if bad else 0)

order = {p: i for i, p in enumerate(points)}
allx = sorted(more + new, key=lambda it: order[it['p']])   # stable: grouped by point, older items first
json.dump(allx, open(os.path.join(C, 'gmore.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(C, 'gmore.json'), 'a', encoding='utf-8').write('\n')
# write prompts go right after the last row of their point
wpath = os.path.join(C, 'gwrite.tsv')
rows = open(wpath, encoding='utf-8').read().rstrip('\n').split('\n')
byp = {}
for w in wnew: byp.setdefault(w.split('\t')[0], []).append(w)
last = {r.split('\t')[0]: i for i, r in enumerate(rows) if r and r[0] != '#'}
out = []
for i, r in enumerate(rows):
    out.append(r)
    for p, idx in list(last.items()):
        if idx == i and p in byp: out += byp.pop(p)
for v in byp.values(): out += v
open(wpath, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
if cnew:
    lis['clips'] += cnew
    json.dump(lis, open(lis_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(lis_path, 'a', encoding='utf-8').write('\n')
print('added %d review items, %d write prompts and %d clips to HSK %s' % (len(new), len(wnew), len(cnew), LV))
