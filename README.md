# Shanlu · HSK study path

A personal HSK study site: word webs, flashcards with a per-word memory bar, listening practice, a grammar lesson, and a daily plan built around a time goal. It targets HSK 3.0.

Live site (after GitHub Pages is switched on): https://alvinyu20.github.io/hsk-path/

## Status

- **Content:** HSK 1 only, so far: 40 words, 1 grammar lesson, 4 listening clips, 1 scripted conversation. HSK 2 and 3 will be added one level at a time, after they pass the checks below.
- **Not built yet:** AI conversation, pronunciation feedback, the level exam itself, and sync across devices (use Export / Import progress in the footer for now).
- **Accuracy:** the Chinese is checked by AI against a community HSK dataset and read through once as a teacher would. It has **not** been reviewed by a human teacher. Every example has a "Report a mistake" link that opens a prefilled GitHub issue.

## Run it locally

No build step. Serve the folder with any static server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it works

| File | What it does |
|---|---|
| `index.html` | Page shell and the screen templates (`{{holes}}`, `<sc-if>`, `<sc-for>`) |
| `runtime.js` | Tiny template runtime that renders the templates and patches the page |
| `app.js` | State, scheduling model, all screens' logic, saving to the browser |
| `data/hsk1.js` | All HSK 1 content (words, sentences, lessons, clips) in one reviewable file |
| `styles.css` | Look and feel, light and dark |
| `vendor/` | morphdom (MIT), used to update the page without losing focus or animations |
| `tools/` | Content audit, pinyin check, and a browser smoke test |

Progress is saved in your browser (localStorage). Use **Export progress** and **Import progress** in the footer to move it to another device.

## Adding or changing content

1. Edit the file for the level in `data/` (one file per level).
2. Check the words and sentences:
   ```
   git clone --depth 1 https://github.com/drkameleon/complete-hsk-vocabulary ../hsk-dataset
   node tools/audit-content.js ../hsk-dataset/complete.json 1
   pip install pypinyin && python3 tools/check-pinyin.py .
   ```
   The audit flags pinyin that differs from the dataset and any word above the level in the 2025 syllabus tags. It cannot judge grammar or naturalness, so grammar and example sentences still need a person who knows Chinese.
3. Run the browser test: `npm i playwright && node tools/smoke-test.js`.

## Credits

- Word levels and pinyin were checked against [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT).
- [morphdom](https://github.com/patrick-steele-idem/morphdom) (MIT) is included in `vendor/`.
- Fonts: Bricolage Grotesque, Source Sans 3 and Noto Serif SC from Google Fonts.
