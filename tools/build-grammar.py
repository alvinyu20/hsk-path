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


CATS = json.load(open(os.path.join(levelcfg.C, 'categories-grammar.json'), encoding='utf-8'))['categories']
CAT_OF = {}
for _i, _c in enumerate(CATS):
    for _id in _c['lessons']:
        if _id in CAT_OF:
            sys.exit('build-grammar: lesson %s is in two categories' % _id)
        CAT_OF[_id] = _i


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


    def build_q(where, q, pt):
        t = q['t']
        s, toks = sent(q['zh'], q['en'])
        out = dict(sentence=s, explain=q.get('explain', ''))
        if pt:
            out['pt'] = pt
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
        return out

    # points: which exercises belong to which point, the write-your-own prompts, and extra exercises (content/gpoints.json, gwrite.tsv, gmore.json)
    pts_in = json.load(open(os.path.join(levelcfg.CONTENT, 'gpoints.json'), encoding='utf-8')) if os.path.exists(os.path.join(levelcfg.CONTENT, 'gpoints.json')) else []
    PT_OF = {}
    for pt in pts_in:
        for lid_, ix in pt['src'].items():
            for i_ in ix:
                if (lid_, i_) in PT_OF:
                    die('exercise %s q%d is in two points' % (lid_, i_ + 1))
                PT_OF[(lid_, i_)] = pt['id']
    pt_ids = [p_['id'] for p_ in pts_in]
    if len(pt_ids) != len(set(pt_ids)):
        die('duplicate point ids')
    LESSON_OF_PT = {p_['id']: list(p_['src'])[0] for p_ in pts_in}
    for p_ in pts_in:
        for lid_ in p_['src']:
            if lid_ not in ids:
                die('point %s names the lesson %r, which does not exist' % (p_['id'], lid_))
    more_in = []
    mp = os.path.join(levelcfg.CONTENT, 'gmore.json')
    if os.path.exists(mp):
        more_in = json.load(open(mp, encoding='utf-8'))
    MORE_BY_LESSON = {}
    for q_ in more_in:
        if q_.get('p') not in LESSON_OF_PT:
            die('extra exercise %r names an unknown point %r' % (q_.get('zh'), q_.get('p')))
        MORE_BY_LESSON.setdefault(LESSON_OF_PT[q_['p']], []).append(q_)

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
            qs.append(build_q('%s q%d' % (lid, n), q, PT_OF.get((lid, n - 1))))
        qx = [build_q('%s extra%d' % (lid, n), q, q['p']) for n, q in enumerate(MORE_BY_LESSON.get(lid, []), 1)]
        if lid not in CAT_OF:
            die('lesson %s is in no category of content/categories-grammar.json' % lid)
        ci = CAT_OF[lid]
        lessons.append(dict(id=lid, title=L['title'], cat=CATS[ci]['name'], catOrder=ci, catBlurb=CATS[ci]['blurb'], covers=L['covers'], formula=formula, explain=L['explain'], examples=examples,
                            mistakes=L.get('mistakes', []), q=qs, qx=qx))

    # write-your-own prompts: content/gwrite.tsv  =  point id <TAB> English prompt <TAB> a model answer <TAB> words the answer needs (a+b = both, a|b = either; a+b|c = both or c)
    WRITE = {}
    wp = os.path.join(levelcfg.CONTENT, 'gwrite.tsv')
    if os.path.exists(wp):
        for n_, line in enumerate(open(wp, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'):
                continue
            f_ = line.split('\t')
            if len(f_) < 3 or f_[0] not in LESSON_OF_PT:
                die('gwrite.tsv line %d: need "point<TAB>English<TAB>Chinese<TAB>needs" with a known point id' % n_)
            need = f_[3].strip() if len(f_) > 3 else ''
            if need and not any(all(part in f_[2] for part in alt.split('+')) for alt in need.split('|')):
                die('gwrite.tsv line %d: the model answer %r does not satisfy its own needs %r' % (n_, f_[2], need))
            sent(f_[2], f_[1])          # the model answer must be made of words of this level
            WRITE.setdefault(f_[0], []).append(dict(en=f_[1], zh=f_[2], need=need))
    points = []
    for p_ in pts_in:
        nq = sum(len(ix) for ix in p_['src'].values()) + sum(1 for q_ in more_in if q_['p'] == p_['id'])
        points.append(dict(id=p_['id'], title=p_['title'], lesson=LESSON_OF_PT[p_['id']], n=nq, write=WRITE.get(p_['id'], [])))

    out_path = levelcfg.data_path('grammar')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('/* HSK %d grammar lessons for Shanlu. GENERATED by tools/build-grammar.py from the grammar-*.json files of this level. Do not edit by hand.\n' % LV)
        if LV == 1:
            f.write(' * Structure follows the grammar outline of the November 2025 HSK 3.0 exam syllabus (level 1, band 1, 70 points, taken from a third-party\n')
            f.write(' * transcription, not the official PDF). Explanations were written by AI and cross-checked against the Chinese Grammar Wiki\n')
        else:
            f.write(' * The points are NOT the official numbered list. They are chosen from the grammar of the HSK %d words and from the Chinese Grammar Wiki list of\n' % LV)
            f.write(' * HSK %d points (content/l%d/grammar-outline.txt). Explanations were written by AI and cross-checked against the Chinese Grammar Wiki\n' % (LV, LV))
        f.write(' * where noted in CONTENT-CHECKS.md. They have NOT been reviewed by a human teacher. */\n')
        f.write('window.HSK%d_GRAMMAR = { lessons: [' % LV + '\n' + ',\n'.join(json.dumps(l, ensure_ascii=False) for l in lessons) + '\n],\npoints: ' + json.dumps(points, ensure_ascii=False) + ' };\n')
    covered = sorted({p for l in lessons for p in l['covers']})
    if LV == 1:
        NP = 70
    else:
        NP = len([l for l in open(os.path.join(levelcfg.CONTENT, 'grammar-outline.txt'), encoding='utf-8') if l.strip()])
    missing = [p for p in range(1, NP + 1) if p not in covered]
    print('wrote %s: %d lessons, %d exercises (+%d extra), %d review points (%d with write prompts), outline points covered: %d of %d%s' % (
        out_path, len(lessons), sum(len(l['q']) for l in lessons), sum(len(l['qx']) for l in lessons), len(points), sum(1 for p_ in points if p_['write']), len(covered), NP, (' (missing %s)' % missing) if missing else ''))
    if missing:
        sys.exit(1)

if __name__ == '__main__':
    main()
