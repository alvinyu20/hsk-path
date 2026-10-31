# Shanlu · HSK study path

A personal HSK study site: word webs, flashcards with a per-word memory bar, grammar lessons, listening practice, scripted speaking practice, and a daily plan built around a time goal. It follows the new HSK 3.0 (November 2025 exam syllabus).

Live site (once GitHub Pages is switched on): https://alvinyu20.github.io/hsk-path/

## What is in it

**HSK 1 is complete. HSK 2 is added, with fewer parts.** HSK 3 is not added yet; each level comes only after it passes the checks in [CONTENT-CHECKS.md](CONTENT-CHECKS.md).

| | HSK 1 | HSK 2 |
|---|---|---|
| Words | all 300 of band 1 (297 on the site, see 儿 below), each with a meaning and three example sentences using only HSK 1 words | 197 of the 200 new band 2 words (the open dataset lists 197; three could not be identified), each with a meaning and three example sentences using only HSK 1 and HSK 2 words |
| Word webs | 25 shared-character groups, 23 opposite pairs, 20 topics | 17 groups, 16 opposite pairs, 13 topics (every word is in a topic) |
| Grammar | 26 lessons covering all 70 points of the band 1 grammar outline, 130 exercises | 18 lessons, 90 exercises. The points are **not** the official numbered list: they are chosen from the grammar of the HSK 2 words and the Chinese Grammar Wiki's HSK 2 list (`content/l2/grammar-outline.txt`, 33 points) |
| Listening | 24 clips with dictation, shadowing and a tone trainer | not built (the screen says so) |
| Speaking | 8 scripted conversations you say out loud | no scripts; Speak opens the AI conversation, with six role-play settings |
| Tests | built from the words you have started, mixing meaning, listening, pinyin, fill-in and word-order questions | the same, from the HSK 2 words you have started |
| Level exam | mock exam, 20 listening + 20 reading questions | not built |

**Levels.** The switch in the header (and the Level card in Settings) chooses HSK 1 or HSK 2; the page reloads. Each level keeps its own progress in this browser (`shanlu-progress-v1` for HSK 1, `shanlu-progress-v1-l2` for HSK 2), its own export file (the file says which level it is; importing the wrong level is refused) and its own file in the same sync gist (`shanlu-progress.json`, `shanlu-progress-hsk2.json`). `level.js` reads the choice (`?level=2` also works and is saved). The 儿 switch applies to HSK 1 words only.

**Study tools.** Every word has at least three example sentences (word cards cycle through them, reviews show a different one each day, tests pick one at random). A real-time review scheduler (each skill remembers when it was last reviewed). A mock exam built like the official HSK 1 sample papers (20 listening + 20 reading questions, timed, scored by section and part, drawn from a bank of 123 questions). Speaking practice has a listen-only mode and an optional AI conversation (see below). Phone layout with a bottom tab bar; keyboard shortcuts (review: Space, 1-4; exam: arrows, A-F).

**Sync.** Settings → Sync across devices keeps one private copy of your progress in a GitHub gist (paste a classic token with only the gist permission on each device). The merge is order-independent: per word and skill the most recent review wins. Not tested against the real GitHub API from the build machine, only against a fake one.

**Screens redesigned from the mockups.** Home: the trail first with one "Climb" button, then Today and four skill rings for the level exam. My words: a summary bar, search, filters and one line per word with a five-dot strength meter. Word webs: content first, the new-words-per-day setting sits behind a small pill. Grammar: the formula, the full explanation (always shown), example cards and a Practise button; on phones the lesson list is a picker.

**The ascent (home screen).** Three views of the same progress, chosen with the Trail / Mist / Stairs switch (the choice is saved). *Trail*: an illustrated mountain path with a camp for each HSK level (HSK 2.0 or 3.0), a "You are here" marker, small cairns at 10, 25, 50, 100, 150, 200 and 250 words, and cards for the next cairn, the streak ("campfire") and today's minutes. *Mist*: one mountain for each Word web topic; the mist thins as you start its words, a mountain with every word started gets a 熟 seal, and mountains a few words from clear are highlighted (tap one to open that topic). *Stairs*: the original level blocks. The art is drawn by `ascent.js` (tested by `tools/test-ascent.js`). The trail counts words started; grammar, listening and speaking count towards the level exam.

**AI conversation.** Settings → AI conversation: save a key for Claude (Anthropic) and/or Qwen (Alibaba Cloud Model Studio, International edition) and choose which one is in use ("Use … for conversation"). Keys are stored on the device only. "Talk with AI" then appears in Speak. At HSK 1 Mingming uses mainly HSK 1 words and may use a few HSK 2 words as a preview; at HSK 2 she uses the HSK 1 and HSK 2 lists and nothing else (no preview); HSK 2 words come with pinyin and English from `data/hsk2-preview.js` (built by `tools/build-preview.py` from `content/preview-hsk2.tsv`, pinyin checked against the dataset, glosses AI-written and not teacher-reviewed). Words on neither list are flagged and shown without pinyin. Your line is judged ("a more natural way: ..."), and "Suggest a reply" shows a suggested answer with pinyin that you can say and be checked against. Voice input: the browser's own speech recognition (Chrome desktop and Android, Safari; keeps listening through pauses and offers other guesses), or, with an Alibaba key, a recording sent to Qwen3-ASR (records, converts to a 16 kHz WAV, stops by itself after a pause). **Untested against the real Alibaba service** (it was tested only against a fake one): whether Alibaba allows calls from a web page, the current model names and the free-quota rules are unconfirmed. "Test connection" in Settings checks the chat model and the recogniser.

**儿 endings.** The official HSK 1 list prints seven words with a northern 儿 ending (面条儿, 一点儿, 有点儿, 好玩儿, 这儿, 那儿, 哪儿). The site uses the plain forms by default (面条, 一点, 有点, 好玩, 这里, 那里, 哪里); "Voice and 儿 style" in the footer switches to the exam-style forms. The table is `content/erhua.tsv`, the rewrite is `erhua.js`, and `tools/erhua-diff.js` lists every line that changes (`review/HSK1-plain-forms.md`).

**Word notes.** A word row can have an optional sixth column, a short note shown under "Show example" (汉语 and 中文 have one).

**Not built yet:** pronunciation scoring (the AI conversation shows what the browser heard, not a score), the HSK 2 listening lab, practice scripts and mock exam, HSK 3, and native audio recordings.

## Accuracy

Everything was written by AI and checked by tools and by AI. **No human teacher has reviewed it.** Every example has a "Report a mistake" link that opens a prefilled GitHub issue. [CONTENT-CHECKS.md](CONTENT-CHECKS.md) lists every check, what they cannot catch, and every error found so far. The folder `review/` has a packet a teacher can skim.

## Run it locally

No build step for the site. Serve the folder with any static server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Progress is saved in your browser (localStorage).

## How it is built

| Path | What it does |
|---|---|
| `index.html`, `styles.css` | Page shell, screen templates and look (light and dark) |
| `runtime.js` | Tiny template runtime that renders the templates and patches the page |
| `app.js` | State, the memory model, quizzes, saving to the browser |
| `level.js` | Which level the page shows (runs before the data files) |
| `data/` | Generated content the site loads. Do not edit by hand |
| `content/` | The content people edit: Chinese and English only (words, grammar lessons, word webs, speaking, listening). HSK 2 is in `content/l2/` |
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
   # HSK 2 tools take LEVEL=2:  LEVEL=2 python3 tools/build-words.py  (also build-grammar.py, build-webs.py)
   ```
   This rebuilds `data/`, checks every sentence (level, pinyin, Chinese against English), regenerates the review packet and clicks through the site in a browser.
3. Commit `content/`, `data/` and `review/` together.

HSK 2 packs for a Chinese AI (words, grammar claims, sentences, word webs, and questions about Alibaba) are built by `tools/make-ai-review-pack-l2.py` into `review/chinese-ai-hsk2/`.

Every sentence is checked twice, once with the 儿 endings and once without, and the browser test runs in both styles.

## Credits

- Word lists were cross-checked against [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT) and the `hsk30` Python package, used for checking only.
- Grammar explanations were compared with the free [Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar) (consulted, not copied; its content is CC BY-NC-SA).
- [morphdom](https://github.com/patrick-steele-idem/morphdom) (MIT) is included in `vendor/`. Build tools use pypinyin and jieba.
- Fonts: Bricolage Grotesque, Source Sans 3 and Noto Serif SC from Google Fonts.
