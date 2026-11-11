#!/usr/bin/env python3
"""Make recorded audio with the Qwen voice, once, so the site plays files instead of paying for a voice on every tap.

  DASHSCOPE_API_KEY=...  python3 tools/make-audio.py --scope core [--limit 50] [--workers 2] [--dry-run]
  then:                   python3 tools/build-audio.py

What it does: reads the list from `node tools/audio-texts.js` and asks Alibaba's Qwen-Audio 3.1 flash (qwen-audio-3.1-tts-flash, Model Studio, Singapore) for each text
that has no file yet, with the voice longanhuan_v3.1 and a reading instruction (standard Mandarin, neutral, no personality or filler sounds; see INSTRUCTION below).
It downloads the WAV, pads it with a little silence at the start and end (so a player cannot clip it), turns it into a small mono mp3 with ffmpeg, saves
audio/<hash>.mp3 and records text -> file in audio/index.json. Safe to stop and run again: lines that already have a file are skipped.
The key is read from the environment only; it is never written anywhere.
Voices: --voice-f (the woman: words, sentences, lab, exam women; default longanhuan_v3.1) and --voice-m (the man in exam conversations; default xunanchuan_v3.1,
NOT listened to yet). Key in the manifest: the text itself for the woman, "m|" + text for the man.
Scopes: words, examples, lab, exams, extra (grammar lesson examples and Speak scenarios), core (= words + examples + lab + exams), all.
Redo a line: --redo "你好,谢谢"; --redo "*" makes everything in the scope again (use it after changing voice or the instruction). Re-making files clears
audio/verify.json (the speech-recogniser results describe the old files); run the Audio verify workflow again.
Cost: Qwen-Audio 3.1 is billed per token (input text and output audio), not per character; the price here is unconfirmed. The dry run prints a rough guess;
real use so far: all 988 words (1,689 Chinese characters) cost about 1 cent.
"""
import argparse, concurrent.futures as cf, hashlib, json, os, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
INDEX = os.path.join(AUDIO, 'index.json')
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
API = 'https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
MODEL = 'qwen-audio-3.1-tts-flash'


def synth(text, voice, key):
    if os.environ.get('MAKE_AUDIO_FAKE'):
        return fake_wav()
    ws = os.environ.get('DASHSCOPE_WORKSPACE_ID', '').strip()
    url = ('https://%s.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer' % ws) if ws else API
    body = json.dumps({'model': MODEL, 'input': {'text': text[:600], 'voice': voice, 'format': 'wav', 'sample_rate': 24000, 'instruction': INSTRUCTION}}).encode()
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


def to_mp3(wav, out):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        t.write(wav)
        p = t.name
    try:
        af = ['-af', 'adelay=120:all=1,apad=pad_dur=0.25']   # a little silence before and after, so a player cannot clip the start or the end
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
    ap.add_argument('--voice-f', default='')
    ap.add_argument('--voice-m', default='')
    ap.add_argument('--redo', default='', help='comma-separated texts to make again')
    ap.add_argument('--dry-run', action='store_true', help='only count what would be made and what it would cost')
    a = ap.parse_args()
    a.voice_f = a.voice_f or 'longanhuan_v3.1'
    a.voice_m = a.voice_m or 'xunanchuan_v3.1'
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
    # real use so far: 988 words / 1,689 characters cost about 1 cent (about $0.006 per 1,000 characters); the price list is unconfirmed, so this is only a guide
    print('rough guide only (billed per token, price unconfirmed): about $%.2f' % (chars * 0.006 / 1000))
    if a.dry_run or not todo:
        return
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not key and not os.environ.get('MAKE_AUDIO_FAKE'):
        sys.exit('Set DASHSCOPE_API_KEY (the Alibaba Model Studio key, Singapore) in the environment. Do not paste it into chat or a file.')
    lock = threading.Lock()
    done = [0]; failed = []; made = []
    t0 = time.time()

    def work(e):
        k = key_of(e)
        voice = a.voice_m if e['voice'] == 'm' else a.voice_f
        out = os.path.join(AUDIO, fname(k))
        try:
            wav = synth(e['text'], voice, key)
            to_mp3(wav, out)
        except SystemExit:
            raise
        except Exception as ex:
            with lock:
                failed.append((e['text'], str(ex)))
            return
        with lock:
            index[k] = os.path.basename(out)
            made.append(k)
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
    if made:   # the checker's results (audio/verify.json) describe the OLD files: drop the entries of the re-made ones so the audio-check page never shows them beside new audio
        vp = os.path.join(AUDIO, 'verify.json')
        if os.path.exists(vp):
            v = json.load(open(vp, encoding='utf-8'))
            for b in ('homophone', 'differs', 'extra', 'unsure'):
                for k in made:
                    v.get(b, {}).pop(k, None)
            v['remade'] = v.get('remade', 0) + len(made)   # shown on the check page; Audio verify resets it
            json.dump(v, open(vp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    print('made %d files, %d failed' % (done[0], len(failed)))
    for t, m in failed[:20]:
        print('  FAILED', t, m)
    size = sum(os.path.getsize(os.path.join(AUDIO, f)) for f in set(index.values()) if os.path.exists(os.path.join(AUDIO, f)))
    print('audio/ now holds %d files, %.1f MB' % (len(index), size / 1e6))
    if failed:
        sys.exit(2)


if __name__ == '__main__':
    main()
