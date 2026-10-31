"""Which HSK level a build or check is for. Set LEVEL=2 in the environment (default 1).

Level 1 content lives in content/; level 2 content in content/l2/. Data files are data/hsk1-*.js and data/hsk2-*.js.
Sentences of level N may use the words of every level up to N, so the pinyin engine is given the lists of all of them.
"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')
LEVEL = int(os.environ.get('LEVEL', '1'))
CONTENT = C if LEVEL == 1 else os.path.join(C, 'l2')
OFFICIAL_FILES = {1: 'hsk1-official-300.txt', 2: 'hsk2-official-197.txt'}


def read_list(n):
    return [l.strip() for l in open(os.path.join(C, OFFICIAL_FILES[n]), encoding='utf-8') if l.strip()]


def official():            # the words learned at this level
    return read_list(LEVEL)


def known():               # every word a sentence of this level may use
    out = []
    for n in range(1, LEVEL + 1):
        out += read_list(n)
    return out


def data_path(name):
    return os.path.join(ROOT, 'data', 'hsk%d-%s.js' % (LEVEL, name))
