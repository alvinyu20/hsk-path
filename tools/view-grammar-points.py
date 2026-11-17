#!/usr/bin/env python3
"""Show grammar points with everything already written for them, before writing new practice items (so new ones do not repeat old ones).

Usage:  python3 tools/view-grammar-points.py LEVEL FROM TO      (FROM and TO are 1-based positions in gpoints.json)
Prints, per point: the lesson formula and common mistakes, every lesson exercise, every review extra (X) and every write prompt (W).
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 4:
    print(__doc__); sys.exit(2)
LV, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
C = os.path.join(ROOT, 'content', '' if LV == '1' else 'l' + LV)
pts = json.load(open(os.path.join(C, 'gpoints.json'), encoding='utf-8'))
lessons = {}
for f in sorted(glob.glob(os.path.join(C, 'grammar-*.json'))):
    for l in json.load(open(f, encoding='utf-8')):
        lessons[l['id']] = l
more = json.load(open(os.path.join(C, 'gmore.json'), encoding='utf-8'))
wr = [l.rstrip('\n').split('\t') for l in open(os.path.join(C, 'gwrite.tsv'), encoding='utf-8') if l.strip() and l[0] != '#']
for p in pts[a - 1:b]:
    print('\n## %s  %s' % (p['id'], p['title']))
    shown = set()
    for lid, idx in p['src'].items():
        l = lessons[lid]
        if lid not in shown:
            print('  formula:', ' '.join(l.get('formula', [])), '| mistakes:', ' / '.join(l.get('mistakes', []))[:260]); shown.add(lid)
        for i in idx:
            q = l['q'][i]; print('  L %s: %s = %s' % (q['t'], q['zh'], q.get('en', '')))
    for m in more:
        if m['p'] == p['id']:
            print('  X %s: %s = %s' % (m['t'], m['zh'], m['en']) + ('   (wrong: %s, remove %s%s)' % (m['wrong'], m['remove'], ', also ' + ','.join(m['also']) if m.get('also') else '') if m['t'] == 'spot' else ''))
    for w in wr:
        if w[0] == p['id']:
            print('  W: %s -> %s [%s]' % (w[1], w[2], w[3] if len(w) > 3 else ''))
