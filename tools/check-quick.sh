#!/bin/sh
# Runs only the checks a change needs, so a small change does not pay for the whole suite.
#
#   sh tools/check-quick.sh content /path/to/complete.json   # words, sentences, grammar, review packets (no browser)
#   sh tools/check-quick.sh ui                               # unit tests + ONE browser pass (plain style); for changes to app.js, index.html, styles.css
#   sh tools/check-quick.sh full /path/to/complete.json      # everything (use before a bigger release or when unsure)
set -e
cd "$(dirname "$0")/.."
MODE="${1:-ui}"
DATASET="${2:-../hsk-dataset/complete.json}"
case "$MODE" in
  content) sh tools/check-all.sh "$DATASET" --no-browser ;;
  ui)
    node tools/test-sync.js | tail -1
    node tools/test-ascent.js | tail -1
    NODE_PATH="$(npm root -g)" node tools/smoke-test.js
    echo "ui checks passed (plain style only; run 'full' to also check the 儿-style pass and the content)" ;;
  full) sh tools/check-all.sh "$DATASET" ;;
  *) echo "usage: check-quick.sh content|ui|full [dataset]"; exit 2 ;;
esac
