# Shanlu · HSK study path

A personal HSK study site: word webs, flashcards with a per-word memory bar, grammar lessons, listening practice, scripted speaking practice, and a daily plan built around a time goal. It follows the new HSK 3.0 (November 2025 exam syllabus).

Live site (once GitHub Pages is switched on): https://alvinyu20.github.io/hsk-path/

## What is in it

**HSK 1 is complete.** Levels 2 and 3 are not added yet; they will come one at a time, each only after it passes the checks in [CONTENT-CHECKS.md](CONTENT-CHECKS.md).

| | HSK 1 |
|---|---|
| Words | all 300 of band 1, each with a meaning and an example sentence using only HSK 1 words |
| Word webs | 25 shared-character groups, 23 opposite pairs, 20 topics (every word is in a topic) |
| Grammar | 26 lessons covering all 70 points of the band 1 grammar outline, 130 exercises |
| Listening | 24 clips with dictation, shadowing and a tone trainer |
| Speaking | 8 scripted conversations you say out loud |
| Tests | built from the words you have started, mixing meaning, listening, pinyin, fill-in and word-order questions |

**Not built yet:** AI conversation and pronunciation feedback (speaking is a script, with no scoring), the level exam itself, and sync across devices (use Export / Import progress in the footer).

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
| `data/` | Generated content the site loads. Do not edit by hand |
| `content/` | The content people edit: Chinese and English only (words, grammar lessons, word webs, speaking, listening) |
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
   ```
   This rebuilds `data/`, checks every sentence (level, pinyin, Chinese against English), regenerates the review packet and clicks through the site in a browser.
3. Commit `content/`, `data/` and `review/` together.

## Credits

- Word lists were cross-checked against [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT) and the `hsk30` Python package, used for checking only.
- Grammar explanations were compared with the free [Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar) (consulted, not copied; its content is CC BY-NC-SA).
- [morphdom](https://github.com/patrick-steele-idem/morphdom) (MIT) is included in `vendor/`. Build tools use pypinyin and jieba.
- Fonts: Bricolage Grotesque, Source Sans 3 and Noto Serif SC from Google Fonts.
