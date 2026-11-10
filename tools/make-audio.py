#!/usr/bin/env python3
"""Make recorded audio with the Qwen voice, once, so the site plays files instead of paying for a voice on every tap.

  DASHSCOPE_API_KEY=...  python3 tools/make-audio.py --scope core [--limit 50] [--workers 3] [--dry-run]
  then:                   python3 tools/build-audio.py

What it does: reads the list from `node tools/audio-texts.js`, asks qwen3-tts-flash (Alibaba Model Studio, Singapore) for each text that has no file yet,
downloads the WAV, turns it into a small mono mp3 with ffmpeg, saves audio/<hash>.mp3 and records text -> file in audio/index.json.
Safe to stop and run again: lines that already have a file are skipped. The key is read from the environment only; it is never written anywhere.
Engine (--engine): audio31 (default) = Alibaba Qwen-Audio 3.1 flash with the voice longanhuan_v3.1 and a reading instruction (standard Mandarin, neutral, no personality or
filler sounds); it was judged clearly better than qwen3 (Maia) in the style trial. The man's voice (xunanchuan_v3.1, for 男 lines in exam conversations) is NOT tried yet.
qwen3 = the old qwen3-tts-flash with Maia/Kai and no instruction. Every file is padded with a little silence at the start and end. Billing for audio31 is per token
(price unconfirmed; the dry run prints a rough guess). Voices: --voice-f (the woman) and --voice-m (the man in exam conversations). Key in the manifest: the text itself for the woman,
"m|" + text for the man.
Scopes: words, examples, lab, exams, extra (grammar lesson examples and Speak scenarios), core (= words + examples + lab + exams), all.
Redo a line: delete its entry from audio/index.json (and its file) and run again; or --redo "你好,谢谢"; --redo "*" makes everything in the scope again (use it after changing voice).
Cost: $0.10 per 10,000 billed characters, each Chinese character counted as 2 (checked against Alibaba's price table only through secondary sources).
"""
import argparse, concurrent.futures as cf, hashlib, json, os, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
INDEX = os.path.join(AUDIO, 'index.json')
API = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
MODEL = 'qwen3-tts-flash'
CORE = {'words', 'examples', 'lab', 'exams'}


def key_of(e):
    return ('m|' if e['voice'] == 'm' else '') + e['text']


def fname(k):
    return hashlib.sha1(k.encode('utf-8')).hexdigest()[:14] + '.mp3'


def zh_chars(s):
    return sum(1 for c in s if '一' <= c <= '鿿')


def fake_wav():
    # test only (MAKE_AUDIO_FAKE=1): a short quiet tone, so the pipeline can be checked without the network
    import struct, math, io, wave
    b = io.BytesIO()
    with wave.open(b, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
        w.writeframes(b''.join(struct.pack('<h', int(3000 * math.sin(i / 20))) for i in range(7200)))
    return b.getvalue()


INSTRUCTION = ('请用标准普通话朗读，这是给汉语学习者的教学录音。发音和声调必须准确标准，语速平稳适中，音量一致。'
               '语气中性平淡，像教材录音，不要有个人情绪、表演、语气词、笑声、叹息、呼吸声或任何多余的声音。')
API31 = 'https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
MODEL31 = 'qwen-audio-3.1-tts-flash'


def synth31(text, voice, key):
    if os.environ.get('MAKE_AUDIO_FAKE'):
        return fake_wav()
    ws = os.environ.get('DASHSCOPE_WORKSPACE_ID', '').strip()
    url = ('https://%s.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer' % ws) if ws else API31
    body = json.dumps({'model': MODEL31, 'input': {'text': text[:600], 'voice': voice, 'format': 'wav', 'sample_rate': 24000, 'instruction': INSTRUCTION}}).encode()
    last = ''
    for attempt in range(7):
        req = urllib.request.Request(url, data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                j = json.load(r)
            with urllib.request.urlopen(j['output']['audio']['url'].replace('http://', 'https://'), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:200]
            last = '%d %s' % (e.code, msg)
            if e.code in (401, 403):
                sys.exit('Alibaba rejected the key (%d): %s' % (e.code, msg))
            if e.code == 429:
                time.sleep(6 * (attempt + 1)); continue
            if e.code in (400, 404):
                raise RuntimeError(last)   # voice or model refused: retrying will not help
            time.sleep(2 * (attempt + 1))
        except Exception as e:
            time.sleep(2 * (attempt + 1)); last = repr(e)
    raise RuntimeError(last)


def synth(text, voice, key):
    if os.environ.get('MAKE_AUDIO_FAKE'):
        return fake_wav()
    body = json.dumps({'model': MODEL, 'input': {'text': text[:600], 'voice': voice, 'language_type': 'Chinese'}}).encode()
    for attempt in range(5):
        req = urllib.request.Request(API, data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.load(r)
            url = j['output']['audio']['url'].replace('http://', 'https://')
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:200]
            if e.code in (401, 403):
                sys.exit('Alibaba rejected the key (%d): %s' % (e.code, msg))
            if e.code == 400 and ('quota' in msg.lower() or 'FreeTier' in msg):
                sys.exit('The free quota is used up: ' + msg)
            wait = 4 * (attempt + 1) if e.code == 429 else 2 * (attempt + 1)
            time.sleep(wait)
            last = '%d %s' % (e.code, msg)
        except Exception as e:   # network hiccup, bad JSON, expired link
            time.sleep(2 * (attempt + 1))
            last = repr(e)
    raise RuntimeError(last)


def to_mp3(wav, out, pad=False):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        t.write(wav)
        p = t.name
    try:
        af = ['-af', 'adelay=120:all=1,apad=pad_dur=0.25'] if pad else []   # pad: a little silence before and after, so a player cannot clip the start or the end
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p] + af + ['-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError('ffmpeg: ' + r.stderr.decode('utf-8', 'replace')[:200])
    finally:
        os.unlink(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scope', default='core')
    ap.add_argument('--limit', type=int, default=0, help='make at most this many new files (0 = no limit)')
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--engine', default='audio31', choices=['audio31', 'qwen3'])
    ap.add_argument('--voice-f', default='')
    ap.add_argument('--voice-m', default='')
    ap.add_argument('--redo', default='', help='comma-separated texts to make again')
    ap.add_argument('--dry-run', action='store_true', help='only count what would be made and what it would cost')
    a = ap.parse_args()
    a.voice_f = a.voice_f or ('longanhuan_v3.1' if a.engine == 'audio31' else 'Maia')
    a.voice_m = a.voice_m or ('xunanchuan_v3.1' if a.engine == 'audio31' else 'Kai')
    scopes = CORE if a.scope == 'core' else ({'words', 'examples', 'lab', 'exams', 'extra'} if a.scope == 'all' else set(a.scope.split(',')))
    texts = json.loads(subprocess.run(['node', os.path.join(ROOT, 'tools', 'audio-texts.js')], capture_output=True, check=True, cwd=ROOT).stdout)
    texts = [e for e in texts if e['group'] in scopes]
    os.makedirs(AUDIO, exist_ok=True)
    index = json.load(open(INDEX, encoding='utf-8')) if os.path.exists(INDEX) else {}
    redo = {t.strip() for t in a.redo.split(',') if t.strip()}
    todo = []
    for e in texts:
        k = key_of(e)
        have = k in index and os.path.exists(os.path.join(AUDIO, index[k]))
        if have and e['text'] not in redo and '*' not in redo:
            continue
        todo.append(e)
    pending = len(todo)
    if a.limit:
        todo = todo[:a.limit]
    chars = sum(zh_chars(e['text']) for e in todo)
    print('%d texts in scope, %d already have a file, %d without one%s: making %d, which is %d Chinese characters'
          % (len(texts), len(texts) - pending, pending, ' (limit %d)' % a.limit if a.limit else '', len(todo), chars))
    if a.engine == 'qwen3':
        print('qwen3 price: %d billed characters, about $%.3f' % (chars * 2, chars * 2 / 1e4 * 0.1))
    else:
        secs = chars * 0.4 + len(todo) * 0.4
        print('audio31 is billed per token, price NOT confirmed: roughly %.0f s of audio; if audio is 50 tokens/s at $1.87 per million tokens that is about $%.2f' % (secs, secs * 50 * 1.87 / 1e6))
    if a.dry_run or not todo:
        return
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not key and not os.environ.get('MAKE_AUDIO_FAKE'):
        sys.exit('Set DASHSCOPE_API_KEY (the Alibaba Model Studio key, Singapore) in the environment. Do not paste it into chat or a file.')
    lock = threading.Lock()
    done = [0]; failed = []
    t0 = time.time()

    def work(e):
        k = key_of(e)
        voice = a.voice_m if e['voice'] == 'm' else a.voice_f
        out = os.path.join(AUDIO, fname(k))
        try:
            wav = (synth31 if a.engine == 'audio31' else synth)(e['text'], voice, key)
            to_mp3(wav, out, pad=(a.engine == 'audio31'))
        except SystemExit:
            raise
        except Exception as ex:
            with lock:
                failed.append((e['text'], str(ex)))
            return
        with lock:
            index[k] = os.path.basename(out)
            done[0] += 1
            if done[0] % 25 == 0:
                tmp = INDEX + '.tmp'
                json.dump(index, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
                os.replace(tmp, INDEX)
                print('  %d / %d  (%.0f s)' % (done[0], len(todo), time.time() - t0), flush=True)

    try:
        with cf.ThreadPoolExecutor(max_workers=max(1, a.workers)) as ex:
            list(ex.map(work, todo))
    finally:
        tmp = INDEX + '.tmp'
        json.dump(index, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
        os.replace(tmp, INDEX)
    print('made %d files, %d failed' % (done[0], len(failed)))
    for t, m in failed[:20]:
        print('  FAILED', t, m)
    size = sum(os.path.getsize(os.path.join(AUDIO, f)) for f in set(index.values()) if os.path.exists(os.path.join(AUDIO, f)))
    print('audio/ now holds %d files, %.1f MB' % (len(index), size / 1e6))
    if failed:
        sys.exit(2)


if __name__ == '__main__':
    main()
