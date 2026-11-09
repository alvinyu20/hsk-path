#!/usr/bin/env python3
"""Writes data/path.js (the learning path) from content/path.json, and checks it.

The path is a list of units, each an ordered list of stops. A stop is a small group of related words (at most 8) or one grammar lesson.
Every word of a level is in exactly one word stop, and every grammar lesson of the level is one grammar stop, so nothing is left out and
nothing is taught twice. Topics (data/hsk*-webs.js) supply the groups; content/path.json supplies the order.

  python3 tools/build-path.py            write data/path.js (and check)
  python3 tools/build-path.py --check    only check; exit 1 if data/path.js is out of date or a rule is broken
  python3 tools/build-path.py --report   also print every unit with its stops and words
"""
import json, math, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_STOP = 8      # most words in one stop
TARGET = 6        # a topic bigger than MAX_STOP is cut evenly into stops of about this size
MIN_STOP = 3      # a topic with fewer words than this is merged with its neighbour (when they fit together)


def load_levels():
    out = subprocess.check_output(['node', '-e', r"""
const vm=require('vm'),fs=require('fs');const ctx={window:{}};vm.createContext(ctx);
const res={};
for(const n of [1,2,3]){
  for(const f of ['words','webs','grammar'])vm.runInContext(fs.readFileSync('data/hsk'+n+'-'+f+'.js','utf8'),ctx);
  const W=ctx.window['HSK'+n+'_WORDS'],T=ctx.window['HSK'+n+'_WEBS'].topics,G=ctx.window['HSK'+n+'_GRAMMAR'].lessons;
  res[n]={words:W.map(w=>w.zh),topics:T.map(t=>({name:t.name,words:t.words})),lessons:G.map(g=>({id:g.id,title:g.title}))};
}
console.log(JSON.stringify(res));
"""], cwd=ROOT).decode('utf-8')
    return json.loads(out)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def build_level(n, cfg, data, problems, report):
    pre = 'h%s' % n
    topics = {t['name']: t['words'] for t in data['topics']}
    lessons = {g['id']: g['title'] for g in data['lessons']}
    place = cfg.get('place', {})
    names = cfg.get('names', {})
    splits = cfg.get('splits', {})

    order = []   # topic names in path order
    for u in cfg['units']:
        for item in u['topics']:
            if isinstance(item, str):
                order.append(item)
    for name in order:
        if name not in topics:
            problems.append('HSK %s: topic "%s" does not exist' % (n, name))
    seen_t = {}
    for name in order:
        seen_t[name] = seen_t.get(name, 0) + 1
    for name in topics:
        if seen_t.get(name, 0) != 1:
            problems.append('HSK %s: topic "%s" is in the path %d times (needs exactly 1)' % (n, name, seen_t.get(name, 0)))
    for w, t in place.items():
        if t not in seen_t:
            problems.append('HSK %s: place says %s goes to "%s", which is not in the path' % (n, w, t))

    assigned = {}   # word -> topic name
    units, used_lessons, ids = [], {}, {}
    for ui, u in enumerate(cfg['units']):
        stops = []
        run = []   # the groups of topics since the last grammar stop (tiny ones merge only inside a run)

        def flush():
            out, pending = [], None
            for g in run:
                if not g['words']:
                    continue
                if pending:
                    if len(pending['words']) + len(g['words']) <= MAX_STOP:
                        g = {'names': pending['names'] + g['names'], 'words': pending['words'] + g['words']}
                    else:
                        out.append(pending)
                    pending = None
                if len(g['words']) < MIN_STOP:
                    if out and len(out[-1]['words']) + len(g['words']) <= MAX_STOP and len(out[-1]['names']) == 1:
                        out[-1] = {'names': out[-1]['names'] + g['names'], 'words': out[-1]['words'] + g['words']}
                    else:
                        pending = g
                else:
                    out.append(g)
            if pending:
                out.append(pending)
            for g in out:
                nm = ' + '.join(g['names'])
                if len(g['names']) > 1:
                    title = names.get(nm)
                    if not title:
                        title = ' & '.join(g['names'])
                        report.append('  note: merged stop "%s" has no name in "names"; using "%s"' % (nm, title))
                    stops.append({'id': '%s.%s' % (pre, '+'.join(slug(x) for x in g['names'])), 'k': 'w', 't': title, 'w': g['words']})
                    continue
                name = g['names'][0]
                ws = g['words']
                if name in splits:
                    spec = splits[name]
                    left = list(ws)
                    for i, s in enumerate(spec):
                        if 'words' in s:
                            part = s['words']
                            for w in part:
                                if w not in left:
                                    problems.append('HSK %s: split "%s" of "%s": %s is not left in the topic' % (n, s['title'], name, w))
                            left = [w for w in left if w not in part]
                        else:
                            part, left = left, []
                        if part:
                            stops.append({'id': '%s.%s.%d' % (pre, slug(name), i + 1), 'k': 'w', 't': s['title'], 'w': part})
                    if left:
                        problems.append('HSK %s: split of "%s" leaves out %s' % (n, name, ' '.join(left)))
                    continue
                k = 1 if len(ws) <= MAX_STOP else int(math.ceil(len(ws) / float(TARGET)))
                base, extra, at = len(ws) // k, len(ws) % k, 0
                for i in range(k):
                    size = base + (1 if i < extra else 0)
                    st = {'id': '%s.%s%s' % (pre, slug(name), '' if k == 1 else '.%d' % (i + 1)), 'k': 'w', 't': name, 'w': ws[at:at + size]}
                    if k > 1:
                        st['p'] = [i + 1, k]
                    stops.append(st)
                    at += size
            del run[:]

        for item in u['topics']:
            if isinstance(item, dict):
                flush()
                gid = item['g']
                if gid not in lessons:
                    problems.append('HSK %s: grammar lesson "%s" does not exist' % (n, gid))
                    continue
                used_lessons[gid] = used_lessons.get(gid, 0) + 1
                stops.append({'id': '%s.g.%s' % (pre, gid), 'k': 'g', 't': lessons[gid], 'g': gid})
                continue
            own = topics.get(item, [])
            words = []
            for w in own:
                if w in assigned or place.get(w, item) != item:
                    continue
                assigned[w] = item
                words.append(w)
            for w, t in place.items():   # words moved in from other topics (or from none): after the topic's own words
                if t == item and w not in assigned:
                    assigned[w] = item
                    words.append(w)
            run.append({'names': [item], 'words': words})
            if not words:
                report.append('  note: topic "%s" has no words left of its own (all are placed elsewhere)' % item)
        flush()
        units.append({'id': '%su%d' % (pre, ui + 1), 'title': u['title'], 'blurb': u['blurb'], 'stops': stops})

    # ---- checks ----
    want = data['words']
    for w in want:
        if w not in assigned:
            problems.append('HSK %s: word %s is in no stop' % (n, w))
    for w in assigned:
        if w not in want:
            problems.append('HSK %s: %s is in a stop but is not a word of this level' % (n, w))
    for g in lessons:
        if used_lessons.get(g, 0) != 1:
            problems.append('HSK %s: grammar lesson "%s" is in the path %d times (needs exactly 1)' % (n, g, used_lessons.get(g, 0)))
    for u in units:
        if not u['stops']:
            problems.append('HSK %s: unit "%s" has no stops' % (n, u['title']))
        for st in u['stops']:
            if st['id'] in ids:
                problems.append('HSK %s: stop id %s is used twice' % (n, st['id']))
            ids[st['id']] = 1
            if st['k'] == 'w' and not (1 <= len(st['w']) <= MAX_STOP):
                problems.append('HSK %s: stop %s has %d words (1 to %d allowed)' % (n, st['id'], len(st['w']), MAX_STOP))

    return {'title': cfg['title'], 'blurb': cfg['blurb'], 'units': units}


def main():
    check = '--check' in sys.argv
    verbose = '--report' in sys.argv
    cfg = json.load(open(os.path.join(ROOT, 'content', 'path.json'), encoding='utf-8'))
    data = load_levels()
    problems, report, out = [], [], {}
    for n in sorted(cfg['levels']):
        out[n] = build_level(int(n), cfg['levels'][n], data[n], problems, report)
    if verbose or True:
        for n in sorted(out):
            nstops = sum(len(u['stops']) for u in out[n]['units'])
            ng = sum(1 for u in out[n]['units'] for s in u['stops'] if s['k'] == 'g')
            nw = sum(len(s['w']) for u in out[n]['units'] for s in u['stops'] if s['k'] == 'w')
            print('HSK %s: %d units, %d stops (%d word stops with %d words, %d grammar stops)' % (n, len(out[n]['units']), nstops, nstops - ng, nw, ng))
        for line in report:
            print(line)
    if verbose:
        for n in sorted(out):
            print('\n=== HSK %s' % n)
            for u in out[n]['units']:
                print('\n-- %s (%d stops)' % (u['title'], len(u['stops'])))
                for s in u['stops']:
                    if s['k'] == 'g':
                        print('   [G] %s' % s['t'])
                    else:
                        part = ' (%d/%d)' % tuple(s['p']) if 'p' in s else ''
                        print('   %2d  %s%s: %s' % (len(s['w']), s['t'], part, ' '.join(s['w'])))
    if problems:
        print('\nPROBLEMS:')
        for p in problems:
            print('  ' + p)
        sys.exit(1)
    text = ('/* The learning path (Learn > Path) for Shanlu. GENERATED by tools/build-path.py from content/path.json. Do not edit by hand.\n'
            ' * Each level: units, each an ordered list of stops. A stop is {id, k:"w", t:title, w:[words], p:[part, parts]?} (a small group of related words)\n'
            ' * or {id, k:"g", t:title, g:lessonId} (one grammar lesson). Every word of the level is in exactly one word stop. */\n'
            'window.SHANLU_PATH = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    target = os.path.join(ROOT, 'data', 'path.js')
    have = open(target, encoding='utf-8').read() if os.path.exists(target) else None
    if check:
        if have != text:
            print('data/path.js is out of date. Run: python3 tools/build-path.py')
            sys.exit(1)
        print('data/path.js is up to date.')
        return
    if have != text:
        open(target, 'w', encoding='utf-8').write(text)
        print('wrote data/path.js')


if __name__ == '__main__':
    main()
