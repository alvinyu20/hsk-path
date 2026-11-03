"""Shared Word web topics (content/topics.json): one list of topics for every level.

A topic lists words from any level. For a level, a topic keeps only the words learned at that level. A topic with fewer than
MIN_WORDS words at a level is hidden, unless it is the only home of one of those words (every word must be in a topic).
The sentence shown with a topic is the one written for the level, or else the nearest lower level's (it may use earlier words).
"""
import json, os
import levelcfg

MIN_WORDS = 3
PATH = os.path.join(levelcfg.C, 'topics.json')


def master():
    return json.load(open(PATH, encoding='utf-8'))['topics']


def sentence_for(t, level):
    for lv in range(level, 0, -1):
        s = t.get('sentences', {}).get(str(lv))
        if s:
            return s, lv
    return None, 0


def for_level(level):
    """The topics of one level: list of dict(name, group, to, cta, words, sentence_zh, sentence_en, order)."""
    official = levelcfg.read_list(level)
    ow = set(official)
    rows = []
    for i, t in enumerate(master()):
        words = [z for z in t['words'] if z in ow]
        if not words:
            continue
        s, lv = sentence_for(t, level)
        if not s:
            raise SystemExit('topic %s has no sentence for level %d' % (t['name'], level))
        rows.append(dict(name=t['name'], group=t['group'], to=t['to'], cta=t['cta'], words=words, sentence=s, order=i))
    keep = [r for r in rows if len(r['words']) >= MIN_WORDS]
    covered = {z for r in keep for z in r['words']}
    for z in official:
        if z in covered:
            continue
        homes = sorted([r for r in rows if z in r['words'] and r not in keep], key=lambda r: (-len(r['words']), r['order']))
        if not homes:
            raise SystemExit('word %s is in no topic' % z)
        keep.append(homes[0])
        covered.update(homes[0]['words'])
    keep.sort(key=lambda r: r['order'])
    return keep
