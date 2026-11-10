#!/usr/bin/env python3
"""STYLE TRIAL: can a better request make Qwen read like a textbook recording (standard, neutral, no personality, no filler sounds)?

The site's recordings are made with qwen3-tts-flash, which is sent ONLY {text, voice, language_type}: it cannot be told how to read.
First attempt (qwen3-tts-instruct-flash) failed: Alibaba answered "Model not exist" for our Singapore key and endpoint, and its Singapore docs list only
qwen3-tts-flash for that family. The docs name a newer family for Singapore, Qwen-Audio-TTS (qwen-audio-3.0-tts-flash, qwen-audio-3.1-tts-flash),
that takes an `instruction` in `input`, through a different address (.../services/audio/tts/SpeechSynthesizer) and with different voice names.
This script tries those, next to a plain recording for comparison. Files go in audio/trial2/ with audio/trial2/trial2.json (a variant the API refuses is listed
with the error text instead of files); review/audio-check.html shows them. Nothing here touches the site's audio list.

  DASHSCOPE_API_KEY=...  python3 tools/make-style-trial.py          (optional: DASHSCOPE_WORKSPACE_ID=... to use the workspace address)
Unknown (hence every variant is tried and its answer recorded): which voice names the Qwen-Audio models accept for our key (Maia? Cherry? or the long* voices),
and the price (the Singapore docs bill it per token, not per character; a few dozen short clips should still be cents).
A variant is tried on the first text; if Alibaba refuses it, the rest of its texts are skipped with the same error."""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'trial2')
API = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
TEXTS = ['东西', '但是', '如果', '国家', '我喜欢好吃的东西。', '不要在这儿说话。', '我吃过饭了。', '他们在这里住了两天。', '如果明天下雨，我们就不去了。']
LONG = '请用标准普通话朗读，这是给汉语学习者的教学录音。发音和声调必须准确标准，语速平稳适中，音量一致。语气中性平淡，像教材录音，不要有个人情绪、表演、语气词、笑声、叹息、呼吸声或任何多余的声音。'
SHORT = '标准普通话，语气中性平淡，语速平稳，不加感情和语气词。'
SLOW = '标准普通话教材朗读，语速稍慢，每个字都清楚，声调准确，语气中性，没有任何情绪和多余的声音。'
NEW = 'https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
VARIANTS = [   # (id, label, api, model, voice, instructions)
    ('plain', 'plain (what the site has: qwen3-tts-flash, Maia, no instructions)', 'old', 'qwen3-tts-flash', 'Maia', None),
    ('a30-Maia', 'Qwen-Audio 3.0 flash, Maia, long instruction', 'new', 'qwen-audio-3.0-tts-flash', 'Maia', LONG),
    ('a30-Maia-s', 'Qwen-Audio 3.0 flash, Maia, short instruction', 'new', 'qwen-audio-3.0-tts-flash', 'Maia', SHORT),
    ('a30-Cherry', 'Qwen-Audio 3.0 flash, Cherry, long instruction', 'new', 'qwen-audio-3.0-tts-flash', 'Cherry', LONG),
    ('a31-huan', 'Qwen-Audio 3.1 flash, longanhuan_v3.1 (the voice in the docs), long instruction', 'new', 'qwen-audio-3.1-tts-flash', 'longanhuan_v3.1', LONG),
    ('a31-huan-0', 'Qwen-Audio 3.1 flash, longanhuan_v3.1, NO instruction', 'new', 'qwen-audio-3.1-tts-flash', 'longanhuan_v3.1', None),
]


def call(api, model, voice, text, instructions, key):
    if api == 'old':
        url = API; body = {'model': model, 'input': {'text': text, 'voice': voice, 'language_type': 'Chinese'}}
    else:
        ws = os.environ.get('DASHSCOPE_WORKSPACE_ID', '').strip()
        url = ('https://%s.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer' % ws) if ws else NEW
        body = {'model': model, 'input': {'text': text, 'voice': voice, 'format': 'wav', 'sample_rate': 24000}}
        if instructions:
            body['input']['instruction'] = instructions
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=90) as r:
        j = json.load(r)
    aurl = j['output']['audio']['url'].replace('http://', 'https://')
    with urllib.request.urlopen(aurl, timeout=90) as r:
        return r.read()


def make(api, model, voice, text, instructions, key):
    err = ''
    for attempt in range(6):
        try:
            return call(api, model, voice, text, instructions, key), None
        except urllib.error.HTTPError as e:
            err = '%d %s' % (e.code, e.read().decode('utf-8', 'replace')[:300])
            if e.code in (401, 403):
                sys.exit('Alibaba rejected the key (%d): %s' % (e.code, err))
            if e.code == 429:
                time.sleep(6 * (attempt + 1)); continue     # rate limit: wait and try again
            return None, err                                 # 400/404 (model or voice refused): retrying will not help
        except Exception as e:
            err = repr(e); time.sleep(3)
    return None, err


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
    out = []
    for vid, label, api, model, voice, ins in VARIANTS:
        results = []; refused = None
        for ti, text in enumerate(TEXTS):
            if refused:
                results.append({'file': None, 'error': refused}); continue
            wav, err = make(api, model, voice, text, ins, key)
            if wav:
                name = '%s-t%02d.mp3' % (vid, ti)
                to_mp3(wav, os.path.join(OUT, name)); results.append({'file': name, 'error': None})
            else:
                results.append({'file': None, 'error': err})
                if ti == 0 and err and not err.startswith('429'):
                    refused = err      # refused on the first text: skip the rest of this variant
            time.sleep(0.4)
        ok = sum(1 for r in results if r['file'])
        print('%-11s %d/%d made  %s' % (vid, ok, len(TEXTS), (next((r['error'] for r in results if r['error']), '') or '')[:230]), flush=True)
        out.append({'id': vid, 'label': label, 'model': model, 'voice': voice, 'instructions': ins, 'results': results})
    json.dump({'texts': TEXTS, 'variants': out}, open(os.path.join(OUT, 'trial2.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
