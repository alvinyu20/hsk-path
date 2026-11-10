#!/usr/bin/env python3
"""Checks the recordings without listening: a speech recogniser listens to each one and we compare what it HEARD with the text we MEANT.

  python3 tools/verify-audio.py [--only index|trial2|all] [--limit N]      (writes audio/verify.json; the "Audio verify" workflow runs it)

Recogniser: FunASR paraformer-zh (open model, Chinese, downloaded on first use; no key, no cost). Statuses per recording:
  ok          the recogniser wrote exactly the text we meant (儿 and punctuation ignored)
  homophone   different characters but the same syllables (toneless), e.g. it picked 事 for 是: the sounds are right
  differs     different syllables: the recording probably sounds wrong (a swallowed or changed sound such as 如果 heard as 书果, a cut-off word, extra noise)
Limits, so nobody trusts it too far: a recogniser is helped by context and can "fix" a bad sound in a sentence; it does NOT check tones (it only
sees the characters it chose); numerals it writes as digits are skipped. So "ok" is good news but not proof, and "differs" means listen to this one.
audio/verify.json keeps only what needs a look: {"model","when","checked","ok","homophone":{key:heard},"differs":{key:heard},"trial2":{file:{heard,status}}}.
"""
import argparse, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
HAN = re.compile(r'[一-鿿]')


def han(s):
    return ''.join(c for c in s if HAN.match(c) and c != '儿')


def syl_sets(text):
    from pypinyin import pinyin, Style
    return [set(x) for x in pinyin(text, style=Style.NORMAL, heteronym=True)]


def syl_heard(text):
    from pypinyin import lazy_pinyin
    return lazy_pinyin(text)


def judge(meant, heard):
    """-> 'ok' | 'homophone' | 'differs' | 'skip'"""
    if re.search(r'[0-9]', heard):
        return 'skip'
    m, h = han(meant), han(heard)
    if m == h:
        return 'ok'
    if len(m) == len(h):
        sets, got = syl_sets(m), syl_heard(h)
        if all(g in s for g, s in zip(got, sets)):
            return 'homophone'
    return 'differs'


class Asr:
    def __init__(self):
        from funasr import AutoModel
        self.m = AutoModel(model='paraformer-zh', disable_update=True)

    def __call__(self, mp3):
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, 'a.wav')
            r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '16000', wav], capture_output=True)
            if r.returncode != 0:
                return ''
            res = self.m.generate(input=wav)
        return (res[0].get('text', '') if res else '') or ''


def items(only):
    out = []   # (group, key, text, file)
    if only in ('index', 'all'):
        idx = json.load(open(os.path.join(AUDIO, 'index.json'), encoding='utf-8'))
        for k, f in idx.items():
            p = os.path.join(AUDIO, f)
            if os.path.exists(p):
                out.append(('index', k, k[2:] if k.startswith('m|') else k, p))
    if only in ('trial2', 'all'):
        tj = os.path.join(AUDIO, 'trial2', 'trial2.json')
        if os.path.exists(tj):
            d = json.load(open(tj, encoding='utf-8'))
            for v in d['variants']:
                for i, r in enumerate(v['results']):
                    if r.get('file'):
                        out.append(('trial2', r['file'], d['texts'][i], os.path.join(AUDIO, 'trial2', r['file'])))
    return out


def main(asr=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='all'); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    todo = items(a.only)
    if a.limit:
        todo = todo[:a.limit]
    asr = asr or Asr()
    path = os.path.join(AUDIO, 'verify.json')
    old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    res = {'model': 'funasr paraformer-zh', 'when': time.strftime('%Y-%m-%d'), 'checked': 0, 'ok': 0, 'skipped': 0, 'homophone': {}, 'differs': {}, 'trial2': {}}
    if a.only == 'index':
        res['trial2'] = old.get('trial2', {})
    if a.only == 'trial2':   # keep the main results when only the trial is re-checked
        for k in ('checked', 'ok', 'skipped', 'homophone', 'differs'):
            res[k] = old.get(k, res[k])
    t0 = time.time()
    for n, (group, key, meant, p) in enumerate(todo):
        try:
            heard = asr(p)
        except Exception as e:
            print('  asr failed for', key, repr(e)); continue
        st = judge(meant, heard)
        if group == 'trial2':
            res['trial2'][key] = {'heard': heard, 'status': st}
            continue
        res['checked'] += 1
        if st == 'ok':
            res['ok'] += 1
        elif st == 'skip':
            res['skipped'] += 1
        else:
            res[st][key] = heard
        if (n + 1) % 100 == 0:
            print('  %d / %d  (%.0f s)' % (n + 1, len(todo), time.time() - t0), flush=True)
    json.dump(res, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    print('checked %d: %d ok, %d same sounds, %d DIFFER, %d skipped' % (res['checked'], res['ok'], len(res['homophone']), len(res['differs']), res['skipped']))
    for g in ('trial2',):
        for f, r in sorted(res[g].items()):
            print('  trial2 %-18s %-10s heard: %s' % (f, r['status'], r['heard']))
    for k, h in list(res['differs'].items())[:40]:
        print('  DIFFERS %s  heard: %s' % (k, h))


if __name__ == '__main__':
    main()
