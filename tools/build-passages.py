#!/usr/bin/env python3
"""Builds data/passages.js (the listening passages: short dialogues with questions, a Path stop of kind "l") from content/listening-passages.json.

  python3 tools/build-passages.py           write data/passages.js
  python3 tools/build-passages.py --check   only check; exit 1 if data/passages.js is out of date or a rule is broken

Pinyin is generated (tools/pinyin_engine.py), never typed. Rules checked here (the level, meaning and pinyin checks of every line and question
run in tools/check-content.py through tools/dump-sentences.js):
  - every passage has an id, a level (1 to 5), a title, a scene, 3 to 10 lines spoken by 女 or 男, and 3 to 5 questions
  - every question has 4 different options (the first one in the file is the right one) and a `line` that exists
  - "pending": true (E4) marks a new passage that waits for its review by a Chinese AI (DeepSeek or Qwen, CLAUDE.md "DeepSeek review workflow").
    It is checked like the others but left out of data/passages.js, so the site never shows it. SHANLU_PENDING=1 puts it in, for the sentence checks
    (tools/check-content.py) and the review pack (tools/make-passages-review.py --pending); build again without it afterwards. After the review, delete "pending".
  - "words": the words of the passage's own level that it uses, in the order they appear. tools/build-path.py places the passage on the Path
    right after the stop that teaches the last of them, so a passage only comes once all of its words have been met.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
SRC = os.path.join(ROOT, 'content', 'listening-passages.json')
OUT = os.path.join(ROOT, 'data', 'passages.js')
FILES = {1: 'hsk1-official-300.txt', 2: 'hsk2-official-197.txt', 3: 'hsk3-official-491.txt', 4: 'hsk4-official-990.txt', 5: 'hsk5-official-1579.txt'}


def words_of(n):
    return [l.strip() for l in open(os.path.join(ROOT, 'content', FILES[n]), encoding='utf-8') if l.strip()]


def main():
    check = '--check' in sys.argv
    src = json.load(open(SRC, encoding='utf-8'))
    problems, out, engines, seen = [], {}, {}, set()
    with_pending, pending = os.environ.get('SHANLU_PENDING') == '1', []
    for p in src['passages']:
        pid, lv = p.get('id'), p.get('level')
        where = 'passage %s' % pid
        if not pid or pid in seen: problems.append(where + ': missing or repeated id'); continue
        seen.add(pid)
        if lv not in FILES: problems.append(where + ': level must be 1 to 5'); continue
        for k in ('title', 'scene'):
            if not p.get(k): problems.append(where + ': needs a ' + k)
        if lv not in engines:
            os.environ['LEVEL'] = str(lv)
            from pinyin_engine import Engine
            known = []
            for n in range(1, lv + 1): known += words_of(n)
            engines[lv] = (Engine(known), set(words_of(lv)))
        eng, own = engines[lv]
        lines, qs, used = [], [], []
        if not 3 <= len(p.get('lines', [])) <= 10: problems.append(where + ': needs 3 to 10 lines')
        for i, l in enumerate(p.get('lines', [])):
            if l.get('s') not in ('女', '男'): problems.append('%s line %d: the speaker must be 女 or 男' % (where, i + 1))
            if not l.get('zh') or not l.get('en'): problems.append('%s line %d: needs zh and en' % (where, i + 1)); continue
            py, toks = eng.sentence(l['zh'])
            for t in toks:
                if t in own and t not in used: used.append(t)
            lines.append({'s': l['s'], 'zh': l['zh'], 'py': py, 'en': l['en']})
        if not 3 <= len(p.get('qs', [])) <= 5: problems.append(where + ': needs 3 to 5 questions')
        for j, q in enumerate(p.get('qs', [])):
            w = '%s question %d' % (where, j + 1)
            opts = q.get('opts') or []
            if len(opts) != 4 or len(set(opts)) != 4: problems.append(w + ': needs 4 different options')
            ql = q.get('line'); ql = ql if isinstance(ql, list) else [ql]   # one line, or a list when the answer needs two lines
            if not ql or not all(isinstance(x, int) and 0 <= x < len(p.get('lines', [])) for x in ql) or len(set(ql)) != len(ql): problems.append(w + ': line must point at a line of the passage (or a list of lines)')
            if not q.get('zh') or not q.get('en'): problems.append(w + ': needs zh and en'); continue
            py, toks = eng.sentence(q['zh'])
            for t in toks:
                if t in own and t not in used: used.append(t)
            qs.append({'zh': q['zh'], 'py': py, 'en': q['en'], 'opts': [{'zh': o, 'py': eng.sentence(o)[0]} for o in opts], 'line': q.get('line', 0)})
        if p.get('pending'):
            pending.append(pid)
            if not with_pending: continue
        out.setdefault(str(lv), []).append({'id': pid, 'lv': lv, 'title': p['title'], 'scene': p['scene'], 'lines': lines, 'qs': qs, 'words': used})
    js = ('/* Listening passages for Shanlu: short dialogues, then questions in Chinese (option 0 is the right one; the site shuffles them).\n'
          ' * GENERATED by tools/build-passages.py from content/listening-passages.json. Do not edit by hand.\n'
          ' * Each passage is a Path stop of kind "l", placed after the stop that teaches the last of its "words" (tools/build-path.py).\n'
          ' * AI-written and checked by rules (tools/check-content.py); not reviewed by a person yet. */\n'
          'window.SHANLU_PASSAGES = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
    if problems:
        print('\n'.join(problems)); sys.exit(1)
    old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    n = sum(len(v) for v in out.values())
    if pending: print('%d passages wait for their review and are %s data/passages.js: %s' % (len(pending), 'IN' if with_pending else 'not in', ' '.join(pending)))
    if check:
        if old != js: print('data/passages.js is out of date: run python3 tools/build-passages.py'); sys.exit(1)
        print('passages: %d, up to date' % n); return
    if old != js: open(OUT, 'w', encoding='utf-8').write(js)
    print('wrote data/passages.js: %s' % ', '.join('HSK %s: %d passages' % (k, len(v)) for k, v in sorted(out.items())))


if __name__ == '__main__':
    main()
