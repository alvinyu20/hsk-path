#!/usr/bin/env python3
"""Pull the open "Ask about this" reports from the friends Worker into a review pack (step 3 of the AI help).

The queue (Worker table ai_reports) holds:
  - ai:     the AI, answering a learner, said the card itself looks wrong (its card_note says what);
  - card:   a learner wrote what looks wrong with a card ("Something wrong with this card?");
  - answer: a learner thinks the AI's answer was wrong (that shared answer is no longer handed out).

Writes review/ai-reports/reports-YYYY-MM-DD.md: a pack to paste into DeepSeek or Qwen (as with the other review packs), then hand the reply to
Claude, who checks each claim before changing anything (CLAUDE.md, "DeepSeek review workflow"). With --mark, the reports put in the pack are
marked "sent" on the Worker so the next pack only has new ones.

Usage:  SHANLU_ADMIN_KEY=... python3 tools/pull-ai-reports.py [--mark] [--url https://...workers.dev]
        (the workflow uses --ids-out FILE, commits the pack, then --mark-ids FILE)
The "AI reports" workflow (.github/workflows/ai-reports.yml) runs this every Monday with the repo secret SHANLU_ADMIN_KEY (the Worker's ADMIN_KEY).
"""
import datetime, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WHY = {'ai': 'The AI thinks the card is wrong', 'card': 'A learner says the card is wrong', 'answer': 'A learner thinks the AI\'s explanation is wrong'}
HEAD = '''Hello! These are problem reports from an HSK study site (HSK 1 to 5, the HSK 3.0 syllabus, simplified characters). Learners asked an AI
about a card or a question on the site, and either the AI or the learner thought something was wrong. Please act as a native speaker and Chinese
teacher and judge each one.

For each report, say:
1) Is the site's card (the question, its right answer, the pinyin, the English) actually correct? If not, what exactly should it say?
2) For "the AI's explanation is wrong" reports: is the explanation right or wrong, and why?
3) Should the learner's answer also count as right?

Please judge by natural modern Mandarin. Do not judge word levels (the site uses its own HSK 3.0 lists). Answer report by report, using the numbers.
'''


def worker_url():
    cfg = open(os.path.join(ROOT, 'config.js'), encoding='utf-8').read()
    m = re.search(r"SHANLU_FRIENDS_URL\s*\|\|\s*'(https://[^']+)'", cfg)
    return m.group(1) if m else ''


def call(url, key, method='GET', body=None):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={'X-Admin-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'shanlu-reports'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def pack(reports, day):
    out = [HEAD, '']
    for i, r in enumerate(reports, 1):
        out += ['---', '', '## Report %d: %s' % (i, WHY.get(r['why'], r['why'])), '',
                '**What was on the screen:**', '', '```', r['ctx'].strip(), '```', '']
        if r.get('q'): out += ['**The learner asked:** ' + r['q'], '']
        if r.get('a'): out += ['**The AI answered:** ' + r['a'], '']
        if r.get('note'): out += ['**' + ('What the AI says is wrong' if r['why'] == 'ai' else 'The learner\'s note') + ':** ' + r['note'], '']
    out += ['---', '', '<!-- for Claude: report ids %s, pulled %s; reports from %s -->' % (','.join(str(r['id']) for r in reports), day,
                                                                                   ', '.join(sorted({r.get('name') or '?' for r in reports})))]
    return '\n'.join(out) + '\n'


def main():
    args = sys.argv[1:]
    key = os.environ.get('SHANLU_ADMIN_KEY', '')
    url = args[args.index('--url') + 1] if '--url' in args else worker_url()
    if not key: sys.exit('Set SHANLU_ADMIN_KEY (the Worker\'s ADMIN_KEY).')
    if not url: sys.exit('No Worker address in config.js; pass --url.')
    if '--mark-ids' in args:   # after the pack is safely committed
        f = args[args.index('--mark-ids') + 1]
        if os.path.exists(f): mark(url, key, json.load(open(f)))
        return
    reports = call(url.rstrip('/') + '/api/admin/reports?status=open', key).get('reports', [])
    if not reports:
        print('no open reports'); return
    day = datetime.date.today().isoformat()
    d = os.path.join(ROOT, 'review', 'ai-reports'); os.makedirs(d, exist_ok=True)
    f = os.path.join(d, 'reports-%s.md' % day)
    n = 2
    while os.path.exists(f):
        f = os.path.join(d, 'reports-%s-%d.md' % (day, n)); n += 1
    open(f, 'w', encoding='utf-8').write(pack(reports, day))
    print('wrote %s (%d reports)' % (os.path.relpath(f, ROOT), len(reports)))
    ids = [r['id'] for r in reports]
    if '--ids-out' in args: open(args[args.index('--ids-out') + 1], 'w').write(json.dumps(ids))
    if '--mark' in args: mark(url, key, ids)


def mark(url, key, ids):
    call(url.rstrip('/') + '/api/admin/reports/mark', key, 'POST', {'ids': ids, 'status': 'sent'})
    print('marked %d reports sent' % len(ids))


if __name__ == '__main__':
    main()
