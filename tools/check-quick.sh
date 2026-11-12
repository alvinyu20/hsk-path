#!/bin/sh
# Runs only the checks a change needs, so a small change does not pay for the whole suite.
#
#   sh tools/check-quick.sh content /path/to/complete.json   # words, sentences, grammar, review packets (no browser)
#   sh tools/check-quick.sh ui                               # version stamp + unit tests + worker tests + the friends/offline-copy/policy browser tests + ONE browser pass at HSK 1 (plain style) + the HSK 2 and HSK 3 browser passes; for changes to app.js, index.html, styles.css
#   sh tools/check-quick.sh l2 /path/to/complete.json        # only HSK 2: build, sentence checks and the HSK 2 browser pass (for changes to content/l2)
#   sh tools/check-quick.sh l3 /path/to/complete.json        # only HSK 3: build, sentence checks and the HSK 3 browser pass (for changes to content/l3)
#   sh tools/check-quick.sh full /path/to/complete.json      # everything (use before a bigger release or when unsure)
set -e
cd "$(dirname "$0")/.."
# last CMD...: run a command, show only its last line, and stop everything if it fails (a pipe into tail would hide the failure)
last() { _o=$(mktemp); if "$@" > "$_o" 2>&1; then tail -n 1 "$_o"; rm -f "$_o"; else cat "$_o"; rm -f "$_o"; echo "FAILED: $*"; exit 1; fi; }
MODE="${1:-ui}"
DATASET="${2:-../hsk-dataset/complete.json}"
case "$MODE" in
  content) sh tools/check-all.sh "$DATASET" --no-browser ;;
  ui)
    node tools/build-site.js --check
    last node tools/test-sync.js
    last node tools/test-secrets.js
    last node tools/test-ascent.js
    last node tools/test-topics.js
    python3 tools/build-path.py --check | tail -n 1
    last node tools/test-path.js
    last node tools/test-friends.js
    python3 tools/build-journey.py --check
    last node tools/test-journey.js
    last node tools/test-journey-media.js
    last env NODE_PATH="$(npm root -g)" node tools/test-souvenirs.js
    last node tools/test-char-glosses.js
    last node tools/test-readings.js
    last node tools/test-audio.js
    last node tools/test-lrn-stale.js
    last node tools/test-write-local.js
    last node tools/test-queue-cap.js
    last python3 tools/build-char-glosses.py --check
    last node tools/test-journey-media-wikis.js
    last node tools/test-exam-media.js
    last node tools/test-pinyin.js
    python3 tools/check-pinyin-course.py | tail -n 1
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-journey.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-onboarding.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-pinyin.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-path.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-review-audio.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-distractors.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-redesign.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-exam-media.js
    (cd worker && [ -d node_modules ] && node test.mjs | tail -1) || true
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-friends.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-pwa.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-lab-voice.js
    last env NODE_PATH="$(npm root -g)" node tools/smoke-test-audio.js
    NODE_PATH="$(npm root -g)" node tools/smoke-test.js
    NODE_PATH="$(npm root -g)" node tools/smoke-test-l2.js
    NODE_PATH="$(npm root -g)" node tools/smoke-test-l3.js
    echo "ui checks passed (plain style only; run 'full' to also check the 儿-style pass and the content)" ;;
  l2)
    last env LEVEL=2 python3 -W ignore tools/build-words.py
    last env LEVEL=2 python3 -W ignore tools/build-grammar.py
    last env LEVEL=2 python3 -W ignore tools/check-grammar-vocab.py
    last env LEVEL=2 python3 -W ignore tools/build-webs.py
    last env LEVEL=2 python3 -W ignore tools/build-speech.py
    last env LEVEL=2 python3 -W ignore tools/build-exam.py
    node tools/dump-sentences.js 2 > /tmp/shanlu-sentences-l2.json
    python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l2.json --level 2 --dataset "$DATASET"
    node tools/dump-sentences.js 2 --plain > /tmp/shanlu-sentences-l2-plain.json
    python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l2-plain.json --level 2 --dataset "$DATASET" --plain
    NODE_PATH="$(npm root -g)" node tools/smoke-test-l2.js ;;
  l3)
    last env LEVEL=3 python3 -W ignore tools/build-words.py
    last env LEVEL=3 python3 -W ignore tools/build-grammar.py
    last env LEVEL=3 python3 -W ignore tools/check-grammar-vocab.py
    last env LEVEL=3 python3 -W ignore tools/build-webs.py
    last env LEVEL=3 python3 -W ignore tools/build-speech.py
    last env LEVEL=3 python3 -W ignore tools/build-exam.py
    node tools/dump-sentences.js 3 > /tmp/shanlu-sentences-l3.json
    python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l3.json --level 3 --dataset "$DATASET"
    LEVEL=3 python3 -W ignore tools/check-ties.py /tmp/shanlu-sentences-l3.json
    node tools/dump-sentences.js 3 --plain > /tmp/shanlu-sentences-l3-plain.json
    python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l3-plain.json --level 3 --dataset "$DATASET" --plain
    NODE_PATH="$(npm root -g)" node tools/smoke-test-l3.js ;;
  full) sh tools/check-all.sh "$DATASET" ;;
  *) echo "usage: check-quick.sh content|ui|l2|l3|full [dataset]"; exit 2 ;;
esac
