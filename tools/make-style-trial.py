#!/usr/bin/env python3
"""STYLE TRIAL: can a better request make Qwen read like a textbook recording (standard, neutral, no personality, no filler sounds)?

The site's recordings are made with model qwen3-tts-flash, which is sent ONLY {text, voice, language_type}: it has no way to be told how to read.
Alibaba has a sibling model, qwen3-tts-instruct-flash, that takes an `instructions` sentence ("read it like ..."). This script tries it on a few
texts, in a few wordings and voices, next to a plain recording for comparison. Files go in audio/trial2/ with audio/trial2/trial2.json
(a variant the API refuses is listed with the error message instead of a file); review/audio-check.html shows them. Nothing here touches the site's audio list.

  DASHSCOPE_API_KEY=...  python3 tools/make-style-trial.py
Unknown details (so every variant is tried and its answer recorded): whether the instruct model accepts the voice Maia, its price, and whether
`instructions` belongs in "input" or in "parameters" of the request (both are tried)."""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'trial2')
API = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
TEXTS = ['东西', '但是', '如果', '国家', '我喜欢好吃的东西。', '不要在这儿说话。', '我吃过饭了。', '他们在这里住了两天。', '如果明天下雨，我们就不去了。']
LONG = '请用标准普通话朗读，这是给汉语学习者的教学录音。发音和声调必须准确标准，语速平稳适中，音量一致。语气中性平淡，像教材录音，不要有个人情绪、表演、语气词、笑声、叹息、呼吸声或任何多余的声音。'
SHORT = '标准普通话，语气中性平淡，语速平稳，不加感情和语气词。'
SLOW = '标准普通话教材朗读，语速稍慢，每个字都清楚，声调准确，语气中性，没有任何情绪和多余的声音。'
VARIANTS = [   # (id, label, model, voice, instructions)
    ('plain', 'plain (what the site has: qwen3-tts-flash, Maia, no instructions)', 'qwen3-tts-flash', 'Maia', None),
    ('iM-long', 'instruct model, Maia, long instruction', 'qwen3-tts-instruct-flash', 'Maia', LONG),
    ('iM-short', 'instruct model, Maia, short instruction', 'qwen3-tts-instruct-flash', 'Maia', SHORT),
    ('iM-slow', 'instruct model, Maia, slower and clearer', 'qwen3-tts-instruct-flash', 'Maia', SLOW),
    ('iC-long', 'instruct model, Cherry (in case Maia is not allowed), long instruction', 'qwen3-tts-instruct-flash', 'Cherry', LONG),
]


def call(model, voice, text, instructions, key, where):
    inp = {'text': text, 'voice': voice, 'language_type': 'Chinese'}
    body = {'model': model, 'input': inp}
    if instructions:
        if where == 'input':
            inp['instructions'] = instructions; inp['optimize_instructions'] = False
        else:
            body['parameters'] = {'instructions': instructions, 'optimize_instructions': False}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=90) as r:
        j = json.load(r)
    url = j['output']['audio']['url'].replace('http://', 'https://')
    with urllib.request.urlopen(url, timeout=90) as r:
        return r.read()


def make(model, voice, text, instructions, key):
    errs = []
    for where in (['input', 'parameters'] if instructions else ['input']):
        for attempt in range(2):
            try:
                return call(model, voice, text, instructions, key, where), where, None
            except urllib.error.HTTPError as e:
                msg = e.read().decode('utf-8', 'replace')[:300]
                errs.append('%s: %d %s' % (where, e.code, msg))
                if e.code in (401, 403):
                    sys.exit('Alibaba rejected the key (%d): %s' % (e.code, msg))
                if e.code == 429:
                    time.sleep(4 * (attempt + 1)); continue
                break
            except Exception as e:
                errs.append('%s: %r' % (where, e)); time.sleep(2)
    return None, None, ' | '.join(errs)[:500]


def to_mp3(wav, out):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        t.write(wav); p = t.name
    try:
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-af', 'adelay=120:all=1,apad=pad_dur=0.25', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.decode('utf-8', 'replace')[:200])
    finally:
        os.unlink(p)


def main():
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not key:
        sys.exit('Set DASHSCOPE_API_KEY in the environment. Do not paste it into chat or a file.')
    os.makedirs(OUT, exist_ok=True)
    jobs = [(vi, ti) for ti in range(len(TEXTS)) for vi in range(len(VARIANTS))]
    res = {}

    def work(j):
        vi, ti = j; vid, label, model, voice, ins = VARIANTS[vi]
        wav, where, err = make(model, voice, TEXTS[ti], ins, key)
        name = '%s-t%02d.mp3' % (vid, ti)
        if wav:
            to_mp3(wav, os.path.join(OUT, name))
        return j, {'file': name if wav else None, 'where': where, 'error': err}
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        for j, r in ex.map(work, jobs):
            res[j] = r
    data = {'texts': TEXTS,
            'variants': [{'id': v[0], 'label': v[1], 'model': v[2], 'voice': v[3], 'instructions': v[4],
                          'results': [res[(vi, ti)] for ti in range(len(TEXTS))]} for vi, v in enumerate(VARIANTS)]}
    json.dump(data, open(os.path.join(OUT, 'trial2.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for v in data['variants']:
        ok = sum(1 for r in v['results'] if r['file'])
        print('%-9s %d/%d made  %s' % (v['id'], ok, len(TEXTS), (next((r['error'] for r in v['results'] if r['error']), '') or '')[:200]))


if __name__ == '__main__':
    main()
