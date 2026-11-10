# Shanlu · HSK study path

A personal HSK study site: word webs, flashcards with a per-word memory bar, grammar lessons, listening practice, scripted speaking practice, and a daily plan built around a time goal. It follows the new HSK 3.0 (November 2025 exam syllabus).

Live site (once GitHub Pages is switched on): https://alvinyu20.github.io/hsk-path/

## What is in it

**HSK 1, HSK 2 and HSK 3 are in.** Each level goes live only after it passes the checks in [CONTENT-CHECKS.md](CONTENT-CHECKS.md); HSK 4 is not started.

| | HSK 1 | HSK 2 | HSK 3 |
|---|---|---|---|
| Words | all 300 of band 1 (297 on the site, see 儿 below), each with a meaning and three example sentences using only HSK 1 words | 197 of the 200 new band 2 words (the open dataset lists 197; three could not be identified), each with a meaning and three example sentences using only HSK 1 and HSK 2 words | 491 new cards from the 500 band 3 entries (the other 9 reuse an earlier word in a new sense and are taught in a grammar lesson on new meanings), each with a meaning and three example sentences using only HSK 1, 2 and 3 words. The list was read from a third-party copy of the syllabus PDF and not compared with the official document |
| Word webs | 25 shared-character groups, 23 opposite pairs, 20 topics | 17 groups, 16 pairs and opposites, 14 topics (every word is in a topic) | 28 shared-character groups, 29 opposite pairs, 72 topics (every word is in a topic) |
| Grammar | 26 lessons covering all 70 points of the band 1 grammar outline, 130 exercises | 19 lessons, 95 exercises. The points are **not** the official numbered list: they are chosen from the grammar of the HSK 2 words and the Chinese Grammar Wiki's HSK 2 list (`content/l2/grammar-outline.txt`, 36 points) | 28 lessons, 140 exercises. As at HSK 2 the 52 points are **not** the official numbered list (`content/l3/grammar-outline.txt`) |
| Listening | 24 clips with dictation, shadowing and a tone trainer (single syllables, and a two-syllable trainer with 133 real words) | 24 clips with dictation, shadowing and the same tone trainer (236 two-syllable words) | 24 clips with dictation, shadowing and the same tone trainer (559 two-syllable words) |
| Speaking | 8 scripted conversations you say out loud | 8 scripted conversations you say out loud | 8 scripted conversations you say out loud |
| Tests | built from the words you have started, mixing meaning, listening, pinyin, fill-in and word-order questions | the same, from the HSK 2 words you have started | the same, from the HSK 3 words you have started |
| Level exam | mock exam, 20 listening + 20 reading questions (the official HSK 1 sample layout) | mock exam, 35 listening + 25 reading questions in the layout of the 2012 HSK 2 sample papers (the 2025 layout was not available to me), from a bank of 141 questions | mock exam, 40 listening + 30 reading questions in the layout of the 2012 HSK 3 sample papers (the 2025 layout was not available to me), from a bank of 78 listening and 56 reading questions. A 10-question writing practice (put words in order, type one missing character) can be sat on its own; it is practice only and does not count towards the seal |

**Levels.** The switch in the header (and the Level card in Settings) chooses HSK 1, HSK 2 or HSK 3 (and All levels, which lists only the levels that are open); the page reloads. Each level keeps its own progress in this browser (`shanlu-progress-v1` for HSK 1, `shanlu-progress-v1-l2` for HSK 2, `shanlu-progress-v1-l3` for HSK 3), its own export file (the file says which level it is; importing the wrong level is refused) and its own file in the same sync gist (`shanlu-progress.json`, `shanlu-progress-hsk2.json`, `shanlu-progress-hsk3.json`). `level.js` reads the choice (`?level=2` also works and is saved). The 儿 switch covers all three levels (男孩儿, 女孩儿, 小孩儿, 聊天儿, 一块儿 and the HSK 1 儿 words; 一会儿 keeps its 儿 in both styles).

**The lock.** A level opens only after the level before it has been passed: the mock exam with at least 80% in listening and 80% in reading (each section can be sat and retaken on its own; the best result of each counts; Settings can switch the lock to open) (stricter than the official 60%; `PASS_PCT` in `level.js`). HSK 2 is locked until the HSK 1 exam is passed, and HSK 3 until the HSK 2 exam is passed. (The HSK 3 exam opens nothing yet; there is no HSK 4.) A locked level shows a lock on its button, and a saved choice or a `?level=` address cannot get past it. The pass is read from the saved exam results (so a pass synced from another device counts once that level has synced) and remembered in `shanlu-passed`, so resetting a level's progress does not lock the next one again.

**Study tools.** Every word has at least three example sentences (word cards cycle through them, reviews show a different one each day, tests pick one at random). A real-time review scheduler (each skill remembers when it was last reviewed). A mock exam built like the official HSK 1 sample papers (20 listening + 20 reading questions, timed, scored by section and part, drawn from a bank of 123 questions). Speaking practice has a listen-only mode and an optional AI conversation (see below). Phone layout with a bottom tab bar; keyboard shortcuts (review: Space, 1-4; exam: arrows, A-F).

**Sync.** Settings → Sync across devices keeps one private copy of your progress in a GitHub gist (paste a classic token with only the gist permission on each device). The merge is order-independent: per word and skill the most recent review wins. Not tested against the real GitHub API from the build machine, only against a fake one.

**Screens redesigned from the mockups.** Home: the trail first with one "Climb" button, then Today and four skill rings for the level exam. My words: a summary bar, search, filters and one line per word with a five-dot strength meter. Word webs: content first, the new-words-per-day setting sits behind a small pill. Grammar: the formula, the full explanation (always shown), example cards and a Practise button; on phones the lesson list is a picker.

**The ascent (home screen).** Three views of the same progress, chosen with the Trail / Mist / Stairs switch (the choice is saved). *Trail*: an illustrated mountain path with a camp for each HSK level (HSK 2.0 or 3.0), a "You are here" marker, small cairns at 10, 25, 50, 100, 150, 200 and 250 words, and cards for the next cairn, the streak ("campfire") and today's minutes. *Mist*: one mountain for each Word web topic; the mist thins as you start its words, a mountain with every word started gets a 熟 seal, and mountains a few words from clear are highlighted (tap one to open that topic). *Stairs*: the original level blocks. The art is drawn by `ascent.js` (tested by `tools/test-ascent.js`). The trail counts words started; grammar, listening and speaking count towards the level exam.

**AI conversation.** Settings → AI conversation: save a key for Claude (Anthropic) and/or Qwen (Alibaba Cloud Model Studio, International edition) and choose which one is in use ("Use … for conversation"). Keys are stored on the device only. "Talk with AI" then appears in Speak. At HSK 1 Mingming uses mainly HSK 1 words and may use a few HSK 2 words as a preview; at HSK 3 she uses the HSK 1, 2 and 3 lists and no preview words (there is no HSK 4 list); at HSK 2 she uses the HSK 1 and HSK 2 lists and may use a few HSK 3 words as a preview (`data/hsk3-preview.js`, 481 words from the open dataset with glosses shortened or fixed by AI, pinyin checked against the dataset, not reviewed by a teacher); HSK 2 words come with pinyin and English from `data/hsk2-preview.js` (built by `tools/build-preview.py` from `content/preview-hsk2.tsv`, pinyin checked against the dataset, glosses AI-written and not teacher-reviewed). Words on neither list are flagged and shown without pinyin. Your line is judged ("a more natural way: ..."), and "Suggest a reply" shows a suggested answer with pinyin that you can say and be checked against. Voice input: the browser's own speech recognition (Chrome desktop and Android, Safari; keeps listening through pauses and offers other guesses), or, with an Alibaba key, a recording sent to Qwen3-ASR (records, converts to a 16 kHz WAV, stops by itself after a pause). **Untested against the real Alibaba service** (it was tested only against a fake one): whether Alibaba allows calls from a web page, the current model names and the free-quota rules are unconfirmed. "Test connection" in Settings checks the chat model and the recogniser.

**儿 endings.** The official HSK 1 list prints seven words with a northern 儿 ending (面条儿, 一点儿, 有点儿, 好玩儿, 这儿, 那儿, 哪儿). The site uses the plain forms by default (面条, 一点, 有点, 好玩, 这里, 那里, 哪里); "Voice and 儿 style" in the footer switches to the exam-style forms. The table is `content/erhua.tsv`, the rewrite is `erhua.js`, and `tools/erhua-diff.js` lists every line that changes (`review/HSK1-plain-forms.md`).

**Word notes.** A word row can have an optional sixth column, a short note shown under "Show example" (汉语 and 中文 have one).

**Tone pairs.** Listening lab → Tone trainer → Two syllables: the device voice says a real two-character word and you pick the tone of each syllable (the second can be the light tone). The words come from `tools/build-speech.py`, which reads the tones from the pinyin the site shows (not words with 不, 一 or 儿). For 3 + 3 words, 2 + 3 also counts as right, because the first third tone is said as a rising tone.

**Recorded audio.** The site plays an audio file instead of a synthetic voice for any text that has one, with or without an Alibaba key. The files are made once with the Qwen voice (`qwen3-tts-flash`): add the repository secret `DASHSCOPE_API_KEY` (Settings, Secrets and variables, Actions; never paste the key anywhere else) and run the **Qwen audio** workflow from the Actions tab. Start with scope `words`, listen, then (to hear how whole sentences and very short words sound before spending more) run scope `trial`: about 42 recordings for 1 cent, shown at the top of `review/audio-check.html`; scope `style` tries the instruct model (`qwen3-tts-instruct-flash`, which accepts a reading instruction; the model the site uses has none) on a few texts and shows the results there; then `examples`, `lab` and `exams` (or `core` for all four; `extra` adds grammar examples and Speak scenarios). It skips lines that already have a file, so a stopped run can be started again. Locally: `DASHSCOPE_API_KEY=... python3 tools/make-audio.py --scope words [--dry-run]`, then `python3 tools/build-audio.py`. Files go in `audio/` named by a short hash and listed in `audio/index.json`; `data/audio-manifest.js` maps each text to its file (a key starting `m|` is the man's voice, used for 男 lines in exam conversations; the woman is Maia, the man Kai). Hand-made recordings named `<text>.mp3` also work. Anything without a file keeps being read by the live Qwen voice (where the app uses it: word learning, Review, Tests, the exam, the Listening lab) or by the browser voice. Redo a line with `--redo "text"`. Lines are listed by `tools/audio-texts.js`; the 儿-style forms of sentences are not recorded. Only words that Qwen may read with the wrong reading need a listen: 只 过 了 得 地 还 会 好 行 长 重 数 教 种 发 角 假 号 差 干 都 为 着.

**Not built yet:** pronunciation scoring (the AI conversation shows what the browser heard, not a score), HSK 4, handwriting (the HSK 3 writing practice is typed or tapped, so it cannot judge stroke order or neatness), and the recordings themselves. The exam pictures are emoji; drawn pictograms are planned.

## Accuracy

Everything was written by AI and checked by tools and by AI. **No human teacher has reviewed it.** Every example has a "Report a mistake" link that opens a prefilled GitHub issue. [CONTENT-CHECKS.md](CONTENT-CHECKS.md) lists every check, what they cannot catch, and every error found so far. The folder `review/` has a packet a teacher can skim.

## Run it locally

Serve the folder with any static server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Progress is saved in your browser (localStorage). (The offline copy and the install prompt only work on https or localhost; the security policy applies everywhere.)

**After changing any script, style, font, icon or `index.html`, run `node tools/build-site.js`.** It puts a version number on every file address (`app.js?v=…`, so a phone never mixes old and new files), writes the security policy (which addresses the page may load code from or talk to, built from `config.js`), and rewrites `sw.js`, the list of files kept for offline use. `node tools/build-site.js --check` only verifies this is up to date (the tests and CI run it). After adding new Chinese characters to the content, run `python3 tools/build-fonts.py <scratch folder>` to rebuild the font subset in `fonts/`.

**Checks:** `sh tools/check-quick.sh ui` (about a minute; unit, worker and browser tests) for app changes; `sh tools/check-quick.sh content <dataset>` for content (see CONTENT-CHECKS.md). On GitHub, `.github/workflows/ci.yml` runs the unit, worker and browser tests on every push and every morning; the content checks need the HSK dataset, which is not in the repository, so they stay manual.

## How it is built

| Path | What it does |
|---|---|
| `index.html`, `styles.css` | Page shell, screen templates and look (light and dark) |
| `runtime.js` | Tiny template runtime that renders the templates and patches the page |
| `app.js` | State, the memory model, quizzes, saving to the browser |
| `sync.js`, `friends.js`, `secrets.js` | Order-independent merge and GitHub-gist sync; the friends-server client; passphrase encryption for API keys synced between devices |
| `manifest.webmanifest`, `icons/`, `sw.js` | Install-as-an-app files and the offline copy (`sw.js` is generated by `tools/build-site.js`) |
| `fonts/` | The three typefaces, subset to the characters the site uses and served from the site itself (OFL licences included) |
| `worker/` | The optional friends server (Cloudflare Worker + D1) and its tests |
| `level.js` | Which level the page shows (runs before the data files) |
| `data/` | Generated content the site loads. Do not edit by hand |
| `content/` | The content people edit: Chinese and English only (words, grammar lessons, word webs, speaking, listening). HSK 2 is in `content/l2/`, HSK 3 in `content/l3/` |
| `tools/` | Builders, checkers and the browser test |
| `review/` | The packet for a human reviewer (generated) |
| `vendor/` | morphdom (MIT), used to update the page without losing focus |

## Editing content

1. Edit the files in `content/`. Never type pinyin; it is generated.
2. Run everything:
   ```
   git clone --depth 1 https://github.com/drkameleon/complete-hsk-vocabulary ../hsk-dataset
   pip install pypinyin jieba
   npm i playwright
   sh tools/check-all.sh ../hsk-dataset/complete.json
   # smaller changes can use the quick modes:  sh tools/check-quick.sh content|ui|l2|full
   # HSK 2 and HSK 3 tools take LEVEL=2 or LEVEL=3:  LEVEL=3 python3 tools/build-words.py  (also build-grammar.py, build-webs.py, build-exam.py)
   ```
   This rebuilds `data/`, checks every sentence (level, pinyin, Chinese against English), regenerates the review packet and clicks through the site in a browser.
3. Commit `content/`, `data/` and `review/` together.

HSK 2 packs for a Chinese AI (words, grammar claims, sentences, word webs, and questions about Alibaba) are built by `tools/make-ai-review-pack-l2.py` into `review/chinese-ai-hsk2/`. HSK 3 packs (words, grammar claims, sentences, word webs, the mock exam including the writing practice, and the practice scripts and listening clips) are built by `tools/make-ai-review-pack-l3.py` into `review/chinese-ai-hsk3/`; they have been built but not yet run past DeepSeek or Qwen.

Every sentence is checked twice, once with the 儿 endings and once without, and the browser test runs in both styles.

## Credits

- Word lists were cross-checked against [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT) and the `hsk30` Python package, used for checking only.
- Grammar explanations were compared with the free [Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar) (consulted, not copied; its content is CC BY-NC-SA).
- [morphdom](https://github.com/patrick-steele-idem/morphdom) (MIT) is included in `vendor/`. Build tools use pypinyin and jieba.
- Fonts: Bricolage Grotesque, Source Sans 3 and Noto Serif SC (SIL Open Font License 1.1; licence texts in `fonts/`), subset and served from this site (built from the Fontsource packages).
