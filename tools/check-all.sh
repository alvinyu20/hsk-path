#!/bin/sh
# Runs every content check for a level, in order. Stop at the first failure.
#
#   sh tools/check-all.sh /path/to/complete.json            # checks + browser test
#   sh tools/check-all.sh /path/to/complete.json --no-browser
#
# Needs: python3 with pypinyin and jieba, node, and (for the browser test) playwright.
# The dataset is a clone of https://github.com/drkameleon/complete-hsk-vocabulary (file complete.json), used only for checking.
set -e
cd "$(dirname "$0")/.."
# last CMD...: run a command, show only its last line, and stop everything if it fails (a pipe into tail would hide the failure)
last() { _o=$(mktemp); if "$@" > "$_o" 2>&1; then tail -n 1 "$_o"; rm -f "$_o"; else cat "$_o"; rm -f "$_o"; echo "FAILED: $*"; exit 1; fi; }
DATASET="${1:-../hsk-dataset/complete.json}"
LEVEL=1

echo "== 1. build the data files from content/ (pinyin is generated, never typed)"
last python3 -W ignore tools/build-words.py
last python3 -W ignore tools/build-grammar.py
last python3 -W ignore tools/check-grammar-vocab.py
last python3 -W ignore tools/build-webs.py
last python3 -W ignore tools/build-speech.py
last python3 -W ignore tools/build-lexicon.py
last python3 -W ignore tools/build-erhua.py
last python3 -W ignore tools/build-exam.py
last python3 -W ignore tools/build-preview.py "$DATASET"
last python3 -W ignore tools/build-preview.py "$DATASET" 3

echo "== 1b. sync merge and gist round-trip"
last node tools/test-sync.js

last node tools/test-ascent.js
last node tools/test-topics.js
last node tools/test-friends.js

echo "== 2. the meaning rules must still catch the known past mistakes"
python3 tools/check-content.py --selftest

echo "== 3. check every sentence: level, pinyin, Chinese vs English, glosses"
echo "   exam style (with 儿 endings, as the official list prints them)"
node tools/dump-sentences.js $LEVEL > /tmp/shanlu-sentences.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences.json --level $LEVEL --dataset "$DATASET"
echo "   plain style (no 儿 endings, the default): exactly what the learner sees, run through the same checks"
node tools/dump-sentences.js $LEVEL --plain > /tmp/shanlu-sentences-plain.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-plain.json --level $LEVEL --dataset "$DATASET" --plain

echo "   word boundaries: noun-type words must not be split into single characters unless reviewed (content/lexicon-*.tsv)"
LEVEL=1 python3 -W ignore tools/check-lexicon.py "$DATASET" /tmp/shanlu-sentences.json
echo "   word cuts: a sentence that can be cut two equally good ways must be reviewed (content/segment-reviewed.tsv)"
LEVEL=1 python3 -W ignore tools/check-ties.py /tmp/shanlu-sentences.json

echo "== 3b. HSK 2: build the data files and check every sentence at level 2, in both styles"
last env LEVEL=2 python3 -W ignore tools/build-words.py
last env LEVEL=2 python3 -W ignore tools/build-grammar.py
last env LEVEL=2 python3 -W ignore tools/check-grammar-vocab.py
last env LEVEL=2 python3 -W ignore tools/build-webs.py
last env LEVEL=2 python3 -W ignore tools/build-speech.py
last env LEVEL=2 python3 -W ignore tools/build-exam.py
echo "   exam style (with 儿 endings)"
node tools/dump-sentences.js 2 > /tmp/shanlu-sentences-l2.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l2.json --level 2 --dataset "$DATASET"
LEVEL=2 python3 -W ignore tools/check-lexicon.py "$DATASET" /tmp/shanlu-sentences-l2.json
LEVEL=2 python3 -W ignore tools/check-ties.py /tmp/shanlu-sentences-l2.json
echo "   plain style (no 儿 endings, the default)"
node tools/dump-sentences.js 2 --plain > /tmp/shanlu-sentences-l2-plain.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l2-plain.json --level 2 --dataset "$DATASET" --plain

echo "== 3c. HSK 3: build the data files and check every sentence at level 3, in both styles"
last env LEVEL=3 python3 -W ignore tools/build-words.py
last env LEVEL=3 python3 -W ignore tools/build-grammar.py
last env LEVEL=3 python3 -W ignore tools/check-grammar-vocab.py
last env LEVEL=3 python3 -W ignore tools/build-webs.py
last env LEVEL=3 python3 -W ignore tools/build-speech.py
last env LEVEL=3 python3 -W ignore tools/build-exam.py
echo "   exam style (with 儿 endings)"
node tools/dump-sentences.js 3 > /tmp/shanlu-sentences-l3.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l3.json --level 3 --dataset "$DATASET"
LEVEL=3 python3 -W ignore tools/check-lexicon.py "$DATASET" /tmp/shanlu-sentences-l3.json
LEVEL=3 python3 -W ignore tools/check-ties.py /tmp/shanlu-sentences-l3.json
echo "   plain style (no 儿 endings, the default)"
node tools/dump-sentences.js 3 --plain > /tmp/shanlu-sentences-l3-plain.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences-l3-plain.json --level 3 --dataset "$DATASET" --plain

echo "== 4. regenerate the teacher review packet and the list of everything that changes in plain style"
node tools/make-review-packet.js
node tools/erhua-diff.js > review/HSK1-plain-forms.md
python3 tools/make-ai-review-pack.py /tmp/shanlu-sentences-plain.json

if [ "$2" != "--no-browser" ]; then
  echo "== 5. click through every screen in a real browser"
  NODE_PATH="$(npm root -g)" node tools/smoke-test.js
  echo "== 5b. the same again with 儿 endings switched on"
  NODE_PATH="$(npm root -g)" node tools/smoke-test.js --erhua
  echo "== 5c. HSK 2: click through every screen, the exam and the level lock"
  NODE_PATH="$(npm root -g)" node tools/smoke-test-l2.js
  echo "== 5d. the same again with 儿 endings switched on"
  NODE_PATH="$(npm root -g)" node tools/smoke-test-l2.js --erhua
  echo "== 5e. HSK 3: every screen, the exam and the level lock, with all three levels together"
  NODE_PATH="$(npm root -g)" node tools/smoke-test-l3.js
  echo "== 5f. the same again with 儿 endings switched on"
  NODE_PATH="$(npm root -g)" node tools/smoke-test-l3.js --erhua
fi
echo "all checks passed (this does not replace review by a person who reads Chinese)"
