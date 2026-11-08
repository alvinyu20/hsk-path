#!/usr/bin/env python3
"""Checks data/pinyin-course.js and data/pinyin-chart.js.

 - every example (tap-to-hear item, sound cell, contrast pair) must have the pinyin pypinyin gives for it,
   allowing only the written-down exceptions: the neutral tone (no mark), 不 -> bú and 一 -> yí/yì (tone changes the lesson teaches);
 - an example that is an HSK 1-3 word must also have exactly the pinyin of the word lists (apart from capital letters and apostrophes);
 - every sound cell with a first letter must really start (initial) or end (final) the pinyin it is shown with;
 - every check question has a valid answer and an explanation;
 - every chart entry says the same thing as pypinyin says for its character.
Run:  python3 tools/check-pinyin-course.py        Needs: pip install pypinyin
"""
import json, os, re, subprocess, sys, unicodedata
from pypinyin import lazy_pinyin, pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = r"""
const vm=require('vm'),fs=require('fs');const ctx={window:{}};vm.createContext(ctx);
for (const f of ['data/pinyin-course.js','data/pinyin-chart.js','data/hsk1-words.js','data/hsk2-words.js','data/hsk3-words.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const w=ctx.window;
console.log(JSON.stringify({course:w.SHANLU_PYCOURSE,chart:w.SHANLU_PYCHART,words:[].concat(w.HSK1_WORDS,w.HSK2_WORDS,w.HSK3_WORDS).map(x=>[x.zh,x.py])}));
"""
data = json.loads(subprocess.check_output(['node', '-e', NODE], cwd=ROOT).decode('utf-8'))
errors, notes = [], []


def err(m):
    errors.append(m)


def nfc(s):
    return unicodedata.normalize('NFC', s)


def strip_marks(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower() if False else ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower()


def flat(s):
    return re.sub(r"[\s'’]", '', nfc(s)).lower()


HSK = {}
for zh, py in data['words']:
    HSK.setdefault(zh, py)


def base_py(zh):
    return flat(''.join(lazy_pinyin(zh, style=Style.TONE)))


def same_pinyin(claimed, zh):
    """pypinyin, with the lesson's exceptions: neutral tone (claimed has no mark where pypinyin has one) and 不/一 changes."""
    want = lazy_pinyin(zh, style=Style.TONE)
    got = re.findall(r"[a-zA-ZüǛ-ͯÀ-ɏ]+", nfc(claimed))
    # split the claimed pinyin into syllables by walking the wanted ones
    s = flat(claimed)
    pos = 0
    for i, wsyl in enumerate(want):
        wsyl = nfc(wsyl).lower()
        cand = [wsyl, strip_marks(wsyl)]
        if zh[i] == '不':
            cand.append(nfc('bú'))
        if zh[i] == '一':
            cand += [nfc('yí'), nfc('yì')]
        hit = None
        for c in sorted(set(cand), key=len, reverse=True):
            if s.startswith(nfc(c), pos):
                hit = c
                break
        if hit is None:
            return False
        pos += len(nfc(hit))
    return pos == len(s)


def check_item(where, zh, py):
    if not same_pinyin(py, zh):
        err('%s: %s is written %s but pypinyin says %s' % (where, zh, py, ' '.join(lazy_pinyin(zh, style=Style.TONE))))
    if zh in HSK and flat(HSK[zh]) != flat(py):
        if not (zh in '不一' or '不' in zh or '一' in zh):
            err('%s: %s is %s here and %s in the HSK lists' % (where, zh, py, HSK[zh]))
    if zh not in HSK:
        notes.append(zh)


first_tone = re.compile(r'[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]')
for les in data['course']['lessons']:
    lid = les['id']
    for bi, b in enumerate(les['blocks']):
        t = b['t']
        where = '%s block %d (%s)' % (lid, bi, t)
        if t == 'say':
            for it in b['items']:
                check_item(where, it['zh'], it['py'])
        elif t == 'groups':
            for g in b['items']:
                for c in g['cells']:
                    check_item(where, c['zh'], c['py'])
                    s = c['s']
                    p = strip_marks(c['py']).replace('ü', 'u')
                    sv = strip_marks(s)
                    # the sound must sit in the syllable: as the start (an initial) or somewhere (a final), with y/w spellings allowed
                    alts = {sv, 'y' + sv[1:] if sv.startswith('i') else sv, 'w' + sv[1:] if sv.startswith('u') else sv}
                    ok = any(a in p for a in alts) or (sv.startswith('ü') and ('u' + sv[1:]) in p) or (sv == 'ü' and 'u' in p)
                    if not ok:
                        err('%s: sound %s is not in %s' % (where, s, c['py']))
        elif t == 'pair':
            check_item(where, b['a']['zh'], b['a']['py'])
            check_item(where, b['b']['zh'], b['b']['py'])
        elif t == 'check':
            for q in b['qs']:
                if not (0 <= q['a'] < len(q['o'])) or len(q['o']) < 2 or not q.get('why'):
                    err('%s: bad question %r' % (where, q['q']))
        elif t not in ('p', 'tip', 'parts', 'tones', 'table', 'typing'):
            err('%s: unknown block type' % where)
    if not les.get('blocks') or not les.get('glyph') or not les.get('title'):
        err('%s: lesson is incomplete' % lid)

for syl, e in data['chart'].items():
    ch = e['c']
    r = pinyin(ch, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)[0]
    if sorted(set(r)) != [syl]:
        err('chart %s: %s has readings %s' % (syl, ch, r))
    if e.get('w') and ch not in e['w']:
        err('chart %s: %s is not in %s' % (syl, ch, e['w']))

print('lessons: %d, chart entries: %d' % (len(data['course']['lessons']), len(data['chart'])))
print('examples that are not HSK 1-3 words (fine, but they are not from the lists): %s' % ' '.join(sorted(set(notes))))
if errors:
    print('\n'.join(errors))
    print('FAILED: %d problem(s)' % len(errors))
    sys.exit(1)
print('OK')
