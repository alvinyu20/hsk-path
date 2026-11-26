#!/usr/bin/env python3
"""Where the recordings live (B4). Imported by make-audio.py and build-audio.py; run it to download recordings (see below).

Until audio/r2.json exists, every recording is a file in audio/ in this repo, which GitHub Pages serves with the site.
The "Audio to R2" workflow (.github/workflows/audio-r2.yml) copies them to a Cloudflare R2 bucket and writes audio/r2.json:
  {"base": "https://pub-<id>.r2.dev/", "only": false}
  - base: the bucket's public address. The site plays <base>audio/<file> (build-audio.py writes it into data/audio-manifest.js as SHANLU_AUDIO_BASE).
  - only: false while the files are still in the repo as well (nothing else changes); true once the workflow has taken them out of the repo.
    Then audio/index.json is the record of what exists, new recordings go straight to the bucket, and a tool that needs the sound itself
    (verify-audio.py, eval-pitch.js, test-pitch) downloads it first:

  python3 tools/audiostore.py fetch [N]      download the recordings that are not in audio/ yet (only the first N with a number)
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')


def remote():
    """audio/r2.json as a dict, or None while the recordings only live in the repo"""
    p = os.path.join(AUDIO, 'r2.json')
    if not os.path.exists(p):
        return None
    r = json.load(open(p, encoding='utf-8'))
    if not str(r.get('base', '')).startswith('https://'):
        raise SystemExit('audio/r2.json: "base" must be the https address of the bucket')
    if not r['base'].endswith('/'):
        r['base'] += '/'
    return r


def only_remote():
    r = remote()
    return bool(r and r.get('only'))


def have(file):
    """is there a recording in this file? Once the files have left the repo, audio/index.json is the record (the caller checks the index)."""
    return only_remote() or os.path.exists(os.path.join(AUDIO, file))


def fetch(limit=0):
    r = remote()
    if not r:
        print('audio/r2.json does not exist: the recordings are in audio/ already'); return 0
    idx = json.load(open(os.path.join(AUDIO, 'index.json'), encoding='utf-8'))
    todo = sorted({f for f in idx.values() if not os.path.exists(os.path.join(AUDIO, f))})
    if limit:
        todo = todo[:limit]
    bad = 0
    for i, f in enumerate(todo):
        try:
            with urllib.request.urlopen(r['base'] + 'audio/' + f, timeout=30) as resp:
                data = resp.read()
            open(os.path.join(AUDIO, f), 'wb').write(data)
        except Exception as e:
            bad += 1
            print('could not download', f, e)
        if (i + 1) % 500 == 0:
            print('%d of %d' % (i + 1, len(todo)))
    print('downloaded %d recordings (%d failed)' % (len(todo) - bad, bad))
    return 1 if bad else 0


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'fetch':
        sys.exit(fetch(int(sys.argv[2]) if len(sys.argv) > 2 else 0))
    print(__doc__)
