#!/usr/bin/env python3
"""Build data/hsk1-grammar.js from content/grammar-*.json.

Lessons are written with Chinese + English only. Pinyin, word tiles ("put the words in order"), toneless answers for
fill-in questions and the position of the wrong word in "spot the mistake" are all generated here, then checked:
  - a fill-in blank must be a whole word and appear once in its sentence
  - a "spot the mistake" word must be a word of the wrong sentence
  - a multiple-choice answer must point at an option, and the correct option must equal the lesson sentence

Run:  python3 tools/build-grammar.py
"""
import glob, json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pinyin_engine import Engine, P_MAP
import levelcfg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')
CJK = re.compile(r'[一-鿿]')


def toneless(py):
    s = unicodedata.normalize('NFD', py)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[\s'/-]", '', s).lower().replace('ü', 'u')


def die(msg):
    sys.exit('build-grammar: ' + msg)


def main():
    LV = levelcfg.LEVEL
    eng = Engine(levelcfg.known())
    lessons_in = []
    for path in sorted(glob.glob(os.path.join(levelcfg.CONTENT, 'grammar-*.json'))):
        lessons_in += json.load(open(path, encoding='utf-8'))
    ids = [L['id'] for L in lessons_in]
    if len(ids) != len(set(ids)):
        die('duplicate lesson ids')

    def sent(zh, en):
        py, toks = eng.sentence(zh)
        return dict(zh=zh, py=py, en=en), toks

    lessons = []
    for L in lessons_in:
        lid = L['id']
        formula, first = [], True
        for item in L['formula']:
            key = item.startswith('*')
            res = item.startswith('=')
            text = item.lstrip('*=')
            formula.append(dict(t=text, k=key, z=bool(CJK.search(text)), sep='' if first else ('=' if res else '+')))
            first = False
        examples = [sent(e['zh'], e['en'])[0] for e in L['examples']]
        qs = []
        for n, q in enumerate(L['q'], 1):
            where = '%s q%d' % (lid, n)
            t = q['t']
            s, toks = sent(q['zh'], q['en'])
            out = dict(sentence=s, explain=q.get('explain', ''))
            if t == 'order':
                if not 3 <= len(toks) <= 9:
                    die('%s: order sentence has %d words' % (where, len(toks)))
                out.update(type='order', kicker='Build it', prompt='Put the words in order: ' + q['en'], toks=toks, reveal=q['zh'])
            elif t == 'cloze':
                b = q['blank']
                if b not in toks:
                    die('%s: blank %r is not a whole word of %r (words: %s)' % (where, b, q['zh'], '/'.join(toks)))
                if q['zh'].count(b) != 1:
                    die('%s: blank %r appears %d times in %r' % (where, b, q['zh'].count(b), q['zh']))
                acc = {toneless(eng.word_py(b)), b}
                if b.endswith('儿'):
                    acc.add(toneless(eng.word_py(b)).replace('r', 'er', 1) if toneless(eng.word_py(b)).endswith('r') else toneless(eng.word_py(b)))
                out.update(type='cloze', kicker='Fill it', prompt='Type the missing word', big=q['zh'].replace(b, '___', 1), sub=q['en'],
                           placeholder='Pinyin or character', accepts=sorted(acc), reveal='%s · %s' % (b, eng.word_py(b)))
            elif t == 'spot':
                wtoks = eng.word_tokens(q['wrong'])
                if q['remove'] not in wtoks or q['wrong'].count(q['remove']) != 1:
                    die('%s: %r is not a single word of %r (words: %s)' % (where, q['remove'], q['wrong'], '/'.join(wtoks)))
                punct = q['wrong'][-1] if q['wrong'][-1] in P_MAP else ''
                out.update(type='spot', kicker='Spot the mistake', prompt='Tap the word that does not belong', tokens=wtoks, punct=punct,
                           spot=wtoks.index(q['remove']), reveal=q['zh'], levelOnly=[q['wrong']])
            elif t == 'mc':
                opts = q['options']
                if q['zh'] not in opts or opts[q['correct']] != q['zh']:
                    die('%s: the correct option must equal the lesson sentence %r' % (where, q['zh']))
                ids_ = 'abcd'
                out.update(type='mc', kicker='Choose', prompt=q['prompt'], options=[dict(id=ids_[i], label=o) for i, o in enumerate(opts)],
                           correct=ids_[q['correct']], reveal=q['zh'], levelOnly=[o for o in opts if o != q['zh']])
            else:
                die('%s: unknown question type %r' % (where, t))
            qs.append(out)
        lessons.append(dict(id=lid, title=L['title'], covers=L['covers'], formula=formula, explain=L['explain'], examples=examples,
                            mistakes=L.get('mistakes', []), q=qs))

    out_path = levelcfg.data_path('grammar')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('/* HSK %d grammar lessons for Shanlu. GENERATED by tools/build-grammar.py from the grammar-*.json files of this level. Do not edit by hand.\n' % LV)
        if LV == 1:
            f.write(' * Structure follows the grammar outline of the November 2025 HSK 3.0 exam syllabus (level 1, band 1, 70 points, taken from a third-party\n')
            f.write(' * transcription, not the official PDF). Explanations were written by AI and cross-checked against the Chinese Grammar Wiki\n')
        else:
            f.write(' * The points are NOT the official numbered list. They are chosen from the grammar of the HSK %d words and from the Chinese Grammar Wiki list of\n' % LV)
            f.write(' * HSK 2 points (content/l2/grammar-outline.txt). Explanations were written by AI and cross-checked against the Chinese Grammar Wiki\n')
        f.write(' * where noted in CONTENT-CHECKS.md. They have NOT been reviewed by a human teacher. */\n')
        f.write('window.HSK%d_GRAMMAR = { lessons: [' % LV + '\n' + ',\n'.join(json.dumps(l, ensure_ascii=False) for l in lessons) + '\n] };\n')
    covered = sorted({p for l in lessons for p in l['covers']})
    if LV == 1:
        NP = 70
    else:
        NP = len([l for l in open(os.path.join(levelcfg.CONTENT, 'grammar-outline.txt'), encoding='utf-8') if l.strip()])
    missing = [p for p in range(1, NP + 1) if p not in covered]
    print('wrote %s: %d lessons, %d exercises, outline points covered: %d of %d%s' % (
        out_path, len(lessons), sum(len(l['q']) for l in lessons), len(covered), NP, (' (missing %s)' % missing) if missing else ''))
    if missing:
        sys.exit(1)

if __name__ == '__main__':
    main()
