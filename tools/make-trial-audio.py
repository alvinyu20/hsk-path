#!/usr/bin/env python3
"""Makes a small TRIAL set of Qwen recordings (about 1 cent) so you can hear how Maia does on whole sentences and on short words,
before spending on the rest. Nothing here goes into the site's audio list: files go to audio/trial/ and audio/trial/trial.json,
and review/audio-check.html shows them at the top.

  DASHSCOPE_API_KEY=...  python3 tools/make-trial-audio.py [--voice Maia]

Sentences: whole example sentences, one recording each (this is what the site plays for an example: it never joins word files together).
Words: the short words that sounded clipped, in two versions each: "pad" (the word, with a little silence before and after, so a player cannot
cut the start or end) and "stop" (the word followed by 。, which usually makes a TTS voice finish the word properly), also with the padding.
The page can also play a sentence word by word from the existing word recordings, to hear what joining them would sound like."""
import argparse, importlib.util, json, os, subprocess, sys, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('make_audio', os.path.join(ROOT, 'tools', 'make-audio.py'))
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
OUT = os.path.join(ROOT, 'audio', 'trial')
WORDS = '东西 但是 国家 如果 上学 不要 关系 回去 了 吗 得 他们'.split()
EXTRA_SENTENCES = 6   # on top of one sentence per trial word


def sentences():
    js = ("global.window={};[1,2,3].forEach(n=>{try{require('./data/hsk'+n+'-words.js')}catch(e){}});"
          "const out=[];[1,2,3].forEach(n=>(window['HSK'+n+'_WORDS']||[]).forEach(w=>{[w.ex].concat(w.more||[]).forEach(e=>e&&e.zh&&out.push({zh:e.zh,py:e.py||'',en:e.en||''}))}));"
          "console.log(JSON.stringify(out))")
    allx = json.loads(subprocess.run(['node', '-e', js], capture_output=True, check=True, cwd=ROOT).stdout)
    chosen, seen = [], set()
    for w in WORDS:
        for e in allx:
            if w in e['zh'] and e['zh'] not in seen and 6 <= len(e['zh']) <= 16:
                chosen.append(e); seen.add(e['zh']); break
    longer = [e for e in allx if e['zh'] not in seen and len(e['zh']) >= 14]
    for e in longer[::max(1, len(longer) // EXTRA_SENTENCES)][:EXTRA_SENTENCES]:
        chosen.append(e); seen.add(e['zh'])
    return chosen


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--voice', default='Maia'); a = ap.parse_args()
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not key and not os.environ.get('MAKE_AUDIO_FAKE'):
        sys.exit('Set DASHSCOPE_API_KEY in the environment. Do not paste it into chat or a file.')
    os.makedirs(OUT, exist_ok=True)
    sents = sentences()
    jobs = []   # (name, text)
    for i, e in enumerate(sents):
        jobs.append(('s%02d' % i, e['zh']))
    for i, w in enumerate(WORDS):
        jobs.append(('w%02d-pad' % i, w)); jobs.append(('w%02d-stop' % i, w + '。'))
    chars = sum(M.zh_chars(t) for _, t in jobs)
    print('%d recordings, %d Chinese characters = about $%.3f' % (len(jobs), chars, chars * 2 / 1e4 * 0.1))

    def work(j):
        name, text = j
        M.to_mp3(M.synth(text, a.voice, key), os.path.join(OUT, name + '.mp3'), pad=True)
        return name
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(work, jobs))
    data = {'voice': a.voice,
            'sentences': [dict(e, file='s%02d.mp3' % i) for i, e in enumerate(sents)],
            'words': [{'zh': w, 'pad': 'w%02d-pad.mp3' % i, 'stop': 'w%02d-stop.mp3' % i} for i, w in enumerate(WORDS)]}
    json.dump(data, open(os.path.join(OUT, 'trial.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('made', len(jobs), 'files in audio/trial/')


if __name__ == '__main__':
    main()
