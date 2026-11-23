# Notes for Claude: Shanlu (hsk-path)

Read this file first in every session, then `HANDOFF.md` (what's open, what's decided, what to check). It replaces rediscovering the repo. Keep it short and correct: when something here turns out wrong or a new trap is found, fix this file in the same commit.

## What it is
- A static HTML/JS HSK 1–5 study site (HSK 3.0 syllabus). It is served by GitHub Pages from `main`, so **a push to main deploys**. Repo `alvinyu20/hsk-path`.
- The owner is Alvin. He wants a casual tone, honest uncertainty, and plain English in anything user-facing.
- Session history and decisions live in the claude.ai Project docs (`claude/session-*.md`, `claude/deepseek-review-*.md`). The detailed content log is `CONTENT-CHECKS.md`. The user-facing feature list is `README.md`; it is long, so don't read it whole.

## Where things are
| Thing | Files |
|---|---|
| App shell, all screens (template) | `index.html` (~3.2k lines) |
| App logic, state `S`, handlers, `renderVals()` | `app.js` (~6k lines); use grep, don't read it whole |
| Styles | `styles.css` |
| Template runtime (morphdom diff) | `runtime.js` |
| Levels, lock, `MAX_LEVEL`, `PASS_PCT` | `level.js` |
| Mountain trail art (`trail`, `phoneTrail`) | `ascent.js` |
| Journey, Feast, friends, sync, erhua, pinyin | `journey.js`/`jyscene.js`, `feast*.js`, `friends.js`, `sync.js`, `erhua.js`, `pinyin.js` |
| Games (Learn > Games): Tell them apart, Measure words, Quick-fire numbers | `content/tellapart.json`, `content/lN/tellapart.json`, `content/measure-words.json` → `tools/build-games.py` → `data/games.js`; numbers made in `numbers.js` (`tools/test-numbers.js`); code `gmStart`/`gamesVals` in app.js |
| Content (edited by hand: Chinese + English only, no pinyin) | `content/` (HSK 1 at top level, `content/l2..l5/` per level) |
| Generated data the site loads (**never edit by hand**) | `data/hsk*-*.js`, `data/char-glosses.js` |
| Builders, checks, tests | `tools/build-*.py`, `tools/check-*.py`, `tools/test-*.js`, `tools/smoke-test-*.js` |
| Dataset used by checks | `../hsk-dataset/complete.json` |
| AI review packs and replies | `review/` (`review/chinese-ai-new-items/unseenN-HSK*.md`) |

Template syntax: `<sc-if value>`, `<sc-for list as x>`, `{{holes}}`, `data-on-click="handler"`. Handlers and values come from `renderVals()` in app.js. In the browser `window.shanlu` is the app and `app.testApi` is for tests.

## Content file formats
- Words: `content/l5/words-NN.tsv` columns: word, part of speech, English, example Chinese, example English, [note].
- Examples: `examples-*.tsv` columns: word, Chinese, English. The word must appear in the sentence, and the sentence may only use words at or below its level.
- `content/cloze-alts.tsv`: answer, other, `also`|`wrong`, sentence, note. Checked by `tools/check-cloze-alts.py`.
- Grammar fill-ins (`t: cloze` in `grammar-*.json` / `gmore.json`) can list `also`: other words that fit the gap just as well; they are accepted and shown as "also right".
- `content/example-parts.tsv`: grammar examples cut into the formula's colours (`lesson id<TAB>who=我 | k=把 | thing=作业 | does=做完了 | 。`); the pieces must join back into an example of that lesson (`build-grammar.py` dies otherwise). Every example has a line (C4); one without shows uncoloured.
- Speaking scenes (`content/speaking.json`, `content/l*/speaking.json`): a line of yours can have `"alt": {zh, en}` (a second thing you could say); then Mingming's next line must have `alt` too (her answer to it). A scenario with `"bad": "<id>"` is the bad-day version of that one (not listed on its own; Good day / Bad day in the chat). `"scene": "<id>"` borrows another scenario's backdrop. HSK 1 and HSK 5 speaking files are hand-formatted; HSK 2–4 round-trip with `indent=1`.
- `content/char-glosses.tsv`: 30-character limit per meaning. Run `tools/build-char-glosses.py` after editing.
- `content/check-waivers.tsv`: known false alarms; every line needs a reason.
- **Round-trip formats (rewriting the file any other way makes a huge diff):**
  - `content/topics.json` and `content/l*/gmore.json`: `json.dumps(d, ensure_ascii=False, indent=1) + '\n'`
  - `content/path-theme.json`: `indent=2`
  - `content/path.json`: hand-formatted; edit the lines as text.
  - `content/l5/exam-5-writing.json`: does not round-trip; edit it with text replacement only.

## Commands
- Fresh sandbox: the builders need `pip install --break-system-packages pypinyin jieba`. `../hsk-dataset/complete.json` is optional (checks fall back to the official lists): to run one level's steps without it, run the commands of that level in `check-quick.sh` by hand with `--dataset /nonexistent`.
- After **any** site change: `node tools/build-site.js`. It stamps versions and `sw.js` and adds `lang="zh-Hans"` to `.zh` elements. CI runs `--check` and fails if this step was skipped.
- Pick the smallest check that covers the change (`tools/check-quick.sh`, which prints only the last lines):
  - `sh tools/check-quick.sh ui` for app.js, index.html or styles.css
  - `sh tools/check-quick.sh l2|l3|l4|l5 ../hsk-dataset/complete.json` for one level's content
  - `sh tools/check-quick.sh content ../hsk-dataset/complete.json` for content across levels (same as `check-all.sh --no-browser`)
  - `sh tools/check-quick.sh full ../hsk-dataset/complete.json` before a big release
- One browser test: `NODE_PATH="$(npm root -g)" node tools/smoke-test-<name>.js`
- `smoke-test-friends.js` needs `cd worker && npm install` first; without it, it prints "skipped" and exits 0, which looks like a pass.
- Path rebuild order: `build-webs.py`, then `build-path.py` (the path build fails on stale webs).
- After editing `content/preview-hsk*.tsv`: `build-preview.py <dataset> <level>` once per level 2–5 (dataset first; with no level it only builds HSK 2).
- Audio: dry run with `python3 -W ignore tools/make-audio.py --scope all --level N --dry-run`. Record with `gh api -X POST repos/alvinyu20/hsk-path/actions/workflows/audio.yml/dispatches -f ref=main -f 'inputs[scope]=all' -f 'inputs[level]=N'`. **Dispatch one level at a time and wait for it to finish**: runs share a concurrency group, and overlapping runs conflict on `audio/index.json`. Pushing during a run is fine, because its save step rebases.
- Next unseen review round: `python3 tools/make-review-unseen.py <round>`.
- Review packs for other additions: `python3 tools/make-review-parts.py` (colour cuts, look-alikes) and `python3 tools/make-review-additions.py <git ref before the additions>` (new exam items and speaking scenes).
- After editing a `tellapart.json` or `measure-words.json`: `python3 -W ignore tools/build-games.py` (it also does the level check; `--check` in `check-quick.sh ui`).

## Rules that are easy to get wrong
- **Word levels come from the site's own lists** (`content/hsk*-official-*.txt|tsv`), not from DeepSeek or HSK 2.0 memory. Examples: 红 alone is HSK 5, 因为 HSK 2, 作业 HSK 3, 宾馆 HSK 3, 落 HSK 4, 包括 HSK 5, 居然 HSK 5.
- In the plain style the 儿 forms are removed (早点儿 → 早点). `erhua.apply` also rewrites new data fields such as `cl`.
- Path: a word in several topics goes to the first Path topic that has it, unless `place` in `content/path.json` says otherwise. Stops are cut into parts of about 5 words. Adding or splitting topics changes the stop counts that `smoke-test-path.js` and `smoke-test-l5.js` expect.
- Settings rows: open one with `window.shanlu.setSec('<id>')`. The ids are reviews, level, sounds, erhua, voice, ai, sync, data.
- In a test's `setState`, setting `dayMin` resets `minLog`, so set any fake history in a separate call.
- Coins (`xp`) are lifetime earnings, never spent down. Each device's share is kept in `xpDev`/`xpBase` (`mergeCoins` in sync.js). Raise `xp` with a normal `setState` so this device's share counts; when applying synced numbers, set `noSync`/`noMin` so they don't count as earned here.
- Grammar progress is keyed by lesson id (`gres[id]`). To reset everyone's score on a lesson whose content changed, give it a new id (`yijing` → `yijing2`) and rename it in `categories-grammar.json`, `path.json`, the level's `gpoints.json` and `check-waivers.tsv`. Old scores stay as harmless orphans, and sync cannot bring them back.
- First visit: the first session is the first Path stop (`onbStartPath` sets `onb.s = 'go'` and opens the Path on that stop's card via `pathContinue`; `plFinish` pays `FIRST_SESSION_COINS` = 50 and sets `onb.s = 'done', v:'path'`). `START_WORDS` through Review is only a fallback. After the first flight the guide cards wait until the stop page (with the host box) is closed, so tests click `.jy-host-go`.
- Quick sort (`qsOpen`/`qsMark`/`qsApply`, state `qs`): up to 30 unstarted words from where the Path goes next; it writes "probably known" with `ShanluPlacement.applyPlan`, so word stops whose words are all known count as done through `stopState`. Opened by "I know a little" in the first-visit flow (`onb.qs` then keeps Start here on) and from Settings > Level.
- Journey finds: `jyFinds(stop, ev)` says where a stop's finds go (food / stops / pass / shelf). The person setting `jyNew` holds what is still new (tab dots, NEW tags; emptied when that tab is looked at). `jyLand` opens the tab with `jyLandK` set for the arrival animation. Shanlu Air status is `FF_TIERS` / `ffTier` (0 / 3 / 8 / 15 regions). Travel sounds are timed in `jyPlayRun` and cut off on skip.
- The Journey is saved **packed** (`JY.pack`/`JY.unpack` in journey.js: 6-character stop codes in `s`, day string in `d`, `v:2`); read it with `jyRead()` (or `testApi.jyRead()` in tests) and save it with `jySave()`, never `prefSet('jy', …)` or `prefs.jy.v.seen`. Older unpacked saves are still read and get packed when the Journey opens. `test-journey.js` fails if two stops ever share a code.
- Between regions the next region is a secret (`secret`/`VR` in the Journey view): everything shows the region you are still in until you land.
- Souvenir sets are `SV_SETS` in app.js (100 coins once per set, receipt pref `svset.<id>`). Achievement toasts wait while `msBusy()` is true (first-visit flow, quick sort, level check, travel moment, new stop page, region pop-up).
- Recorded audio: `data/audio-manifest.js` lists only the first 7 hex digits of `sha1(key)` per recording (`SHANLU_AUDIO_IDS`); `audiolist.js` works out the file (`audio/<sha1[:14]>.mp3`, key `m|text` for the man's voice). The full text → file map is `audio/index.json`. `window.SHANLU_AUDIO` (text → file) still works for files named any other way and is what tests set.
- Loaded after the first draw (B2): `data/path-scenes.js`, `speak-scenes.js`, `exam-art.js`, `journey-media.js` (`LATER` in `tools/build-site.js`, named in `<meta name="shanlu-data">`, loaded with `ShanluData.load`). In app.js `PSCENE`/`PTILE`/`SSCN`/`EXAM_ART`/`JMEDIA` are `let`s that fill in then; nothing computed at start-up may depend on them. A test that checks those pictures right after loading awaits `window.shanlu.lateReady()`. Passages stay at start-up (the Path's stop list needs them).
- Wrong answers (D4): `confusers(zh)` in app.js offers look-alikes (`content/look-alikes.tsv` → `tools/build-confusers.py` → `data/confusers.js`), word families, other tones (Review listening only; Path listening never), opposites and topic partners, at most 2 per Review card and 1 per Path card, none on Fill it. Words in `content/same-meaning-groups.tsv` are never options together. Test: `smoke-test-confusers.js`.
- Grammar examples: every one has a hand cut in `content/example-parts.tsv` (C4). A new or changed example needs its line there too, or it shows uncoloured; `build-grammar.py` dies on a line that no longer joins into an example.
- Mock exam retakes (E1): the exam draws through `pickF`/`pickTFF` (never `shuffle` a bank directly), which put items not yet had first, then the oldest (`freshOrder`, person pref `exseen`, per level and part). Keep every part's bank at least twice what one sitting draws; `smoke-test-exam-fresh.js` fails on a repeat that a big enough bank should have avoided.
- New exam items: `check-content.py` flags proper names (北京, 李, 王, 刘 are not on the lists; use 张, 马, 高 or 小明), 点儿 outside 一点儿, and numbers written in words in the English (write 3,500). Ties from new sentences go in `content/segment-reviewed.tsv` after checking the cut, or reword.
- Tests look things up by class names (`.mw`, `.top h1`, …). When markup changes, grep `tools/smoke-test-*.js` for the old class first.

## DeepSeek review workflow
For each claim: verify it before applying (level list, pinyin engine, web for place facts), keep the card's headword, and run the level check. Report to Alvin what was applied and what was rejected, with the reason. DeepSeek judges levels by HSK 2.0 even when told otherwise, so its level claims are usually wrong. Log each round in `CONTENT-CHECKS.md` plus a **short new** Project note; don't rewrite the long Project docs.

## Working cheaply
- Use grep and targeted reads, not whole-file reads. Pipe long command output through `tail`.
- For visual changes, ask one scoping question first (layout only, or colours too?). Screenshot only the changed view, once per round.
- When CI or audio is running, wait in long intervals rather than polling. If local checks passed, report then and confirm CI later.
- Commit trailers (end every commit message with these):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <current session URL>
  ```
