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
DATASET="${1:-../hsk-dataset/complete.json}"
LEVEL=1

echo "== 1. build the data files from content/ (pinyin is generated, never typed)"
python3 -W ignore tools/build-words.py | tail -1
python3 -W ignore tools/build-grammar.py | tail -1
python3 -W ignore tools/build-webs.py | tail -1
python3 -W ignore tools/build-speech.py | tail -1

echo "== 2. the meaning rules must still catch the known past mistakes"
python3 tools/check-content.py --selftest

echo "== 3. check every sentence: level, pinyin, Chinese vs English, glosses"
node tools/dump-sentences.js $LEVEL > /tmp/shanlu-sentences.json
python3 -W ignore tools/check-content.py /tmp/shanlu-sentences.json --level $LEVEL --dataset "$DATASET"

echo "== 4. regenerate the teacher review packet"
node tools/make-review-packet.js

if [ "$2" != "--no-browser" ]; then
  echo "== 5. click through every screen in a real browser"
  NODE_PATH="$(npm root -g)" node tools/smoke-test.js
fi
echo "all checks passed (this does not replace review by a person who reads Chinese)"
