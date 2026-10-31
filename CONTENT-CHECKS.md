# How content is checked

A study site that teaches wrong Chinese is worse than no site. This file says how every sentence, lesson and gloss is checked, what the checks can and cannot prove, and what a new level has to pass before it goes live.

**The honest limit:** everything here was written by AI and checked by tools and by AI. That catches a lot, but it does not replace a person who reads Chinese. The site says so in its footer and every example has a "Report a mistake" link. The review packet (`review/`) exists to make a human check cheap.

## How content flows

```
content/*.tsv, *.json     what a person edits: Chinese + English only, no pinyin
        |  tools/build-*.py   pinyin, word splitting, quiz answers are generated
        v
data/hsk1-*.js            what the site loads (generated, committed, never edited by hand)
        |  tools/dump-sentences.js   every sentence on every screen, in one list
        v
tools/check-content.py    the checks below
```

Run everything with `sh tools/check-all.sh /path/to/complete.json`. It rebuilds the data, runs the checks and clicks through the site in a browser.

## The checks

| # | Check | Catches | Tool |
|---|---|---|---|
| 1 | **Word list** | A word missing, extra or duplicated against the official 300 | `build-words.py` |
| 2 | **Level** | A word above HSK 1 inside a sentence, an unknown character | `check-content.py` `[level]` |
| 3 | **Pinyin** | A wrong syllable or tone. Pinyin is generated, then compared with a second reading from pypinyin (tone changes of 不 and 一 and neutral tones are allowed) | `[pinyin]` |
| 4 | **Chinese vs English** | The English says something the Chinese does not. Rules: want / would like needs 想 or 要; can / may needs 会, 能 or 可以; negatives; he / she / we; numbers, clock times and dates; today / tomorrow and the other time words; question marks; 吗 next to a question word; the right measure word for the noun; please / thanks / sorry; past tense without 了 | `[meaning]` |
| 5 | **Gloss** | The word a sentence is meant to teach does not show up in its English | `[gloss]` |
| 6 | **Build rules for lessons** | A fill-in blank that is not a whole word, a "spot the mistake" word that is not in the sentence, a multiple-choice answer that is not an option, a word in no topic | `build-grammar.py`, `build-webs.py` |
| 7 | **Self-test** | The rules above stop working. It replays the real mistakes found so far and fails if any is no longer caught | `check-content.py --selftest` |
| 8 | **Browser test** | A broken screen. Reads each quiz question from the running site and answers it, right and wrong | `smoke-test.js` |
| 9 | **Blind back-translation** (by hand, per level) | What a rule cannot see. Translate each Chinese sentence cold, without looking at the English, then compare | see the log |
| 10 | **High-risk word read** (by hand, per level) | List every sentence with 了, 在, 呢, 吧, 会, 能, 可以, 想, 要, 还, 再, 也, 都 and read each one against its English | see the log |
| 11 | **Cross-check of grammar explanations** | An explanation that is wrong. Each point is compared with the official outline's example sentences and the Chinese Grammar Wiki | see the log |
| 12 | **Teacher review** | Everything above. Natural-sounding Chinese, tone of phrases, whether an explanation will mislead | `review/` packet |

Known false alarms go in `content/check-waivers.tsv`, each with a reason. Questions only a native speaker can answer go in `content/ask-a-teacher.tsv`.

## A level goes live only when

1. `sh tools/check-all.sh` ends with "all checks passed" (0 errors; every warning fixed or waived with a reason).
2. Blind back-translation (9) is done for every new sentence, and findings are fixed and logged below.
3. The high-risk word read (10) is done and logged.
4. Every grammar point is matched to the official outline and every explanation was cross-checked (11). Points that could not be cross-checked are listed in the log.
5. The review packet is regenerated and the log says whether a person has reviewed it.
6. Nothing is labelled "teacher-checked" unless a person actually did it.

## Rules learned the hard way

- A plain verb question is not an offer. 你喝茶吗？ asks whether you drink tea. Offers and "what would you like" need 想: 你想喝茶吗？ (reported by the learner, 30 Oct 2026; now rule `[meaning]` and a lesson).
- Never write pinyin by hand. Generate it.
- Keep Chinese and English as separate fields so the checker can compare them.
- A sentence can have correct words and correct grammar and still say the wrong thing. Only comparing the meaning catches that.
- When an explanation says "never" or "always", look for a counter-example. (Example: 不要 is not only a command; it can be a firm "I don't want to", so the lesson teaches 不想 as the safe form.)

## Review log

### 30 Oct 2026, HSK 1 (300 words, 26 grammar lessons)

**Sources used**
- Word list: the 300 words of band 1 in the November 2025 HSK 3.0 exam syllabus, from two community transcriptions that agree (a dataset with 294 and a package with 300; the 6 phrase-like entries 一下, 你好, 哪个, 没事, 这个, 那个 were added). Not checked against the official PDF.
- Grammar outline: 70 points for band 1, from a third-party transcription of the 2025 syllabus (one source says 70 points, another says 66; not resolved). The 2021 standard had 48. Not checked against the official PDF.
- Explanations cross-checked against the Chinese Grammar Wiki (free; its levels follow the older HSK test): 了 (finished action, change of state, "now"), 呢, 吧, 想 and 要, 会 / 能 / 可以, 都, 也, 在 (in progress). All other points rely on the official outline's example sentences and my own knowledge, not a second source.

**Errors found and fixed**
1. 你喝热茶吗？ was translated "Do you want hot tea?" and 你吃东西吗？ "Will you eat anything?" in the café script, and the replies matched. Reported by the learner. Fixed to use 想. Also found by the new rules in a sentence written minutes later (女士，您喝茶吗？).
2. 我的电话在桌子上 sounded unnatural (手机 is the usual word). Fixed earlier.
3. A lesson used 面条 (HSK 2 form) instead of the listed 面条儿.
4. Early translations that were too loose: 认识你，我很高兴 ("I am glad" is literal), 你们家人都很好吧？ (吧 is "right?", not "I hope"), 喂，你好！ had a question mark in English but not in Chinese, 今天下雪了 ("it snowed" vs "it is snowing").
5. English glosses polished after blind translation: 读书 shown as "studying", "over by the school", "wearing new clothes".
6. Pinyin layout bugs found while reading the generated output: 只 (zhī or zhǐ by context), numbers like 二十 split in two, 们 not attached, no capitals for 中国 and 汉语, 谁 as shéi.
7. A claim in my own draft was wrong: 不要 never means "don't want to". The Wiki's own example shows it can. The lesson now teaches 不想 for a plain "I don't want to".

**Passes done**
- Automated rules: 1,901 items, 0 errors, 0 unexplained warnings, 9 waivers (all with reasons in `content/check-waivers.tsv`).
- Blind back-translation: all 300 word sentences and 155 distinct grammar sentences. Result: no mistranslations, 5 English polish items (above).
- High-risk word read: every sentence with 了, 在, 呢, 吧, 会, 能, 可以, 想, 要, 还, 再, 也 or 都 (about 140 listings across six groups, some sentences in two). One change (下雪了).
- Browser test: every screen, all question types (right and wrong answers), saving across reloads, phone width.

**Not done**
- No human has reviewed any of it. The packet is in `review/`.
- The word list and grammar outline were not compared with the official PDFs.
- Character glosses inside the word webs (for example 脑 = brain inside 电脑) and the "what to listen for" notes were written by AI and have no second source.
- The browser's voice is used for all audio. Its Chinese can be wrong or odd, especially in context, and the quality varies by device.
- Questions only a native speaker can settle: `content/ask-a-teacher.tsv`.
