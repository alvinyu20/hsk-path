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
| 8b | **App checks** (not about content) | Sync losing or resurrecting progress, a reset not reaching other devices, a friends-server change, a too-loose security policy, a broken offline copy or update, a save that fails silently, a connection test that lies | `test-sync.js`, `test-secrets.js`, `test-friends.js`, `worker/test.mjs`, `smoke-test-friends.js`, `smoke-test-pwa.js` (run on every push by `.github/workflows/ci.yml`) |
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

- Rewriting words in bulk is dangerous. The "plain" version of the content (no 儿 endings) is made by swapping 7 words, but the notes said things like "这儿 / 这里" and "在哪儿 or 在哪里", which a blind swap turns into "这里 / 这里". So the swap collapses those patterns, one note about 儿 itself is replaced by hand (`content/erhua-overrides.tsv`), the 儿 word of a pair that already has a plain twin is dropped instead of renamed, and every changed line is listed in `review/HSK1-plain-forms.md` to be read. The checks run on the plain version exactly as the learner sees it.
- 汉语 and 中文 are not "spoken" and "written". The characters hint at it (语 speech, 文 writing) but in modern use both mean "Chinese (the language)" and are mostly interchangeable; 中文 is the more everyday word and is also used for speaking, 汉语 sounds a bit more formal. Both words carry a note saying so (reported by the learner, 30 Oct 2026, who guessed the split; the sources checked say it does not hold).
- If an example box can show an extra note, give it its own CSS class. A new `.exbox` class silently restyled the review card.

- A scheduler that never looks at the clock never schedules anything. The first version stored "days since review" as a fixed number, so reviewed words never came due. Each skill now stores the time of its last review and the days are computed from the clock; the browser test sets a word reviewed three days ago and checks it is due.
- Two Chinese AIs (Qwen, DeepSeek) agreed that a bare 前, 后, 下 or 外 after a noun (学校前, 桌子下) is not natural. A lesson I wrote had taught it. Everything now uses 前边, 后边, 下边, 外边. Single-character localizers were a trap created by the HSK 1 word limit: the natural form (前面) needs a character that is not on the list.
- Example sentences multiply the surface for mistakes. All ~800 extras go through the same checker, and the false alarms are either fixed or waived with a reason (check-waivers.tsv); nothing is waived silently.
- Picture questions need an unambiguous answer. Grouped parts (matching five items to six pictures or five answers) use fixed, hand-checked sets rather than random combinations, because a random mix can make two answers fit one blank.
- A review pack for a Chinese AI is generated from what the learner actually sees (plain style): review/chinese-ai/.
- **The pinyin check accepts any reading a dictionary lists for a character.** So 长 (cháng, "long") was shown as zhǎng, 教 (jiāo, "to teach") as jiào, and the particles 得, 地 and 过 as dé, dì and guò, and every check passed (found 31 Oct 2026, while preparing the HSK 2 review packs). Fixes: `content/pinyin-overrides.tsv` (what the site shows); `content/pinyin-reviewed.tsv` (tells the checker that for these characters pypinyin's usual reading is not the taught one, so both readings are accepted); a self-test that fails if the shown readings regress; and a scan that compares every token's reading with the context reading from pypinyin and lists the differences for a human to read (the differences that remain are neutral tones and 一/不 changes, by design). Read the list again for every new level.
- Neutral tones: the site follows the dictionary (爷爷 yéye, 还是 háishi, 回来 huílai); a Chinese AI should say whether a beginner should see them.
- **Whole-sentence pinyin rules are separate from word readings.** Reading each token on its own with pypinyin hid errors that the sentence rules fix (只 zhī/zhǐ, 过 guo/guò, 得 děi/dé/de). The HSK 3 scan found 星期六只开半天 read with zhī (a measure word) and 过得, 过马路, 过生日 read with guo, which also affected the live HSK 2 exam. They are now rules in `tools/pinyin_engine.py`. When you scan for polyphones, scan the finished sentences, not the tokens.
- **A solid word in the lexicon wins over context.** 还给 is entered as huán gěi ("give back"), so 我买了一双新鞋，还给朋友写了一封信 ("... and also wrote a letter to a friend") was shown as huángěi. The sentence was reworded (也给朋友写了…). If a lexicon word can also be two ordinary words in a sentence, do not write the second reading.
- **A random draw can hand out the answer.** The word-order exam question shuffles the words; for a sentence with repeated words the shuffle sometimes came out in the right order (1 failed browser run in about 5). The shuffle now rejects any order that is right or in the list of accepted orders, and the test checks it.
- **A `//` comment at the end of a line of generated JavaScript swallowed the next statement** and the page stopped loading. Comments go on their own line.

## HSK 2 (added 31 Oct 2026)

HSK 2 is a separate level (`content/l2/`, tools run with `LEVEL=2`). The level checker allows words from HSK 1 and HSK 2 only; every check runs in both the 儿 style and the plain style. What is different from HSK 1:
- **Words: 197 of the official 200.** The open dataset tags 197 words as new at level 2; the three others could not be identified. DeepSeek and Qwen were asked and named different words (and Qwen's answer doubted itself), so the list was not changed on their say-so. Glosses, example sentences (three per word) and notes were written by AI.
- **Grammar outline is my own, not the official list** (`content/l2/grammar-outline.txt`, 36 points). It is based on the grammar of the HSK 2 words and the Chinese Grammar Wiki's HSK 2 list (79 points, written for the older test). The official numbered outline for band 2 was not available. `tools/build-grammar.py` fails if any point is not covered by a lesson. DeepSeek and Qwen reviewed the 18 first lessons; what they agreed on was applied, and a lesson on 多 questions, …的时候 and doubled verbs was added.
- **Mock exam layout** follows the HSK 2 sample papers of the 2012 test (listening 10 + 10 + 10 + 5, reading 5 + 5 + 5 + 10, pass mark 120 of 200). I could not find the layout of the 2025 band 2 exam. Pictures are emoji; every picture set was written to have one answer per picture, but emoji can be ambiguous (the exam pack in `review/chinese-ai-hsk2/` asks a Chinese AI to look for that).
- **Waivers.** 130 findings of the meaning checks were waived with a reason each (mostly 了 and 要 in the "about to" and "already" patterns, numbers like 两万 and prices, past-time context words, a few idioms). They are in `content/check-waivers.tsv`.
- **Neutral tones.** Words are shown with the dictionary's neutral tones (爷爷 yéye, 还是 háishi), but the direction compounds (回来, 回去, 上来, 下来, 起来 ...) all show their full tones so there is one rule. 一会儿 is shown with the tone change (yíhuìr), like 一起 yìqǐ at HSK 1.
- **HSK 3 preview words** for the AI conversation at HSK 2 come from the dataset's level-3 words (481 of 487; six whose sense I was unsure of were left out).
- Nothing has been read by a person who reads Chinese. `tools/make-ai-review-pack-l2.py` builds the packs for that (`review/chinese-ai-hsk2/`).

## HSK 3 (added 5 Nov 2026)

HSK 3 is the third level (`content/l3/`, tools run with `LEVEL=3`). The level checker allows words from HSK 1, 2 and 3 only (小明 is the one name allowed; 没 and 杯 come in through `content/allowed-extra.tsv`); every check runs in both the 儿 style and the plain style. What is different from HSK 1 and HSK 2:
- **Words: 491 cards from the 500 band 3 entries.** The list was read from a third-party copy of the syllabus PDF (`content/hsk3-official-500.tsv`) in two independent passes by a summarising fetch tool; both passes agree on all 500 headwords. It was **not compared with the official document**. Nine entries reuse a headword from a lower level with a different sense or reading (得 dé and děi, 地, 过去, 还, 会, 站, 长, 只); they are taught in a grammar lesson on new meanings, not as separate cards. Glosses, parts of speech, notes and three example sentences per word were written by AI.
- **Grammar outline is my own, not the official list** (`content/l3/grammar-outline.txt`, 52 points, 28 lessons, 140 exercises), built from the grammar of the HSK 3 words and the Chinese Grammar Wiki's lists. `tools/build-grammar.py` fails if a point has no lesson. Only four lessons were compared page by page with the Wiki.
- **Mock exam layout** follows the HSK 3 sample papers of the 2012 test (listening 10 + 10 + 10 + 10 = 40 questions, reading 10 + 10 + 10 = 30), because the 2025 layout was not available to me. The bank has 78 listening and 56 reading questions. Each section is scored out of 100; 120 of 200 (60%) is the official-style pass mark and the site's lock asks for 80% in both sections. Pictures are emoji (every set was written to have one answer per picture; emoji can still be ambiguous).
- **Writing practice** (10 questions: put 5 word sets in order, type one missing character in 5 sentences; bank of 32) is offered on its own. It is practice, typed or tapped: it cannot judge handwriting, and it does **not** count towards the seal.
- **Pinyin rules added:** 只 after 星期X is zhǐ; 过 is guò before 得, 马路, 生日, 日子; solid words 长得 (zhǎng de), 从来, 对面, 热水, 车上 (and others) in `content/lexicon-words.tsv`. Re-scanned with a list of 141 distinct polyphone tokens (below).
- **Topics were re-thought, as the process above says.** "Phones and the internet" became "Phones, email and the internet", "Movies, music and TV" became "Movies, music, TV and news", and "Body and health" was split into "Parts of the body" and "Health and illness". Progress is saved by word, so nothing is lost. The word webs have 28 shared-character groups, 29 opposite pairs and 72 topics at HSK 3.
- **Unlocking.** HSK 3 stays behind the lock: it opens when the HSK 2 exam is passed (80% in both sections), and "open lock" in Settings still lets anyone in.
- Nothing has been read by a person who reads Chinese. `tools/make-ai-review-pack-l3.py` builds the packs for that (`review/chinese-ai-hsk3/`); they have not yet been run past DeepSeek or Qwen.

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

### 5 Nov 2026, HSK 3 (491 words, 28 grammar lessons, 24 listening clips, mock exam)

**Sources used**
- Word list: the band 3 entries of the November 2025 syllabus from a third-party copy of the PDF, read twice by a summarising tool (agree on all 500). Not compared with the official document.
- Grammar: my own outline (52 points). Four lessons compared with the Chinese Grammar Wiki; the others rely on my own knowledge.
- Exam layout: the 2012 HSK 3 sample papers.

**Errors found and fixed**
1. 长 was read cháng in 他长得又高又瘦 (the verb 长得 "to look", zhǎng de). Fixed with a solid lexicon entry.
2. 星期六只开半天 showed 只 as zhī. Fixed in the engine (after 星期 and 礼拜 it is zhǐ).
3. 过 was read guo in 过得, 过马路, 过生日. Fixed in the engine; this also corrected the live HSK 2 exam ("guo shēngrì").
4. 还给朋友写了一封信 was read huángěi ("give back"). Reworded with 也. Found by the polyphone scan of the finished sentences.
5. The exam bank, when first checked, contained words above HSK 3, names other than 小明, 儿 endings in the wrong style, English that did not match, and 的哥 (a pypinyin misreading). All reworded.
6. Word-boundary check: 面条, 对面, 热水, 车上 were split into single characters; they are now written 面条儿 in the sources and entered as solid words (with 从来).
7. The word-order exam question could shuffle into the right order. Fixed in the app; the test now checks it.
8. The first HSK 3 plain-style checks were not valid until the 儿 switch covered HSK 3. Fixed, and re-run (0 errors in both styles).
9. About a dozen small corrections found by reading every sentence next to its English (below). Chinese: 这个楼, 这个铅笔 and 这个酒 (measure words that sound off) became 我们楼, 我的铅笔 and 这种酒; 花已经开花了 became 树已经开花了; 什么事发生了 became 发生什么事了; 一块是十毛 became 一块钱是十毛; 我们三年不见了 became 我们好久不见了. English: "There are my clothes in this suitcase", the answer to 是啊 that began "No", "Please switch it off in class" (nothing for "it" to refer to), and the spellings "metro", "lift", "Mum" and curly apostrophes now match the rest of the site.

**Passes done**
- Automated rules (level, pinyin, Chinese against English, gloss, word boundaries, segmentation ties) on 4,199 items (2,234 distinct sentences): 0 errors, 0 unexplained warnings, 4 waivers (each with a reason in `content/check-waivers.tsv`), in both styles.
- A read of **every distinct sentence next to its English** (2,234). This is **not a blind back-translation**: the sentences were written in the same project, so the read is biased towards agreeing with them. It found the small items above and nothing that changes a meaning.
- A read of all 28 grammar explanations and mistake lines for claims that are wrong or too strong. Two lines were reworded: 又 is "not for a plan or a request" (not "not for the future", since 明天又是星期一 is fine) and the 刚 mistake example 我刚吃饭 (incomplete as a sentence) became 我刚到家.
- A polyphone scan of the finished sentences: 141 distinct tokens with more than one possible reading (的, 得, 地, 了, 着, 过, 还, 行, 长, 会, 重, 发, 数, 好, 都, 为, 觉, 假 ...) were read with an example. One real error (还给) and one false alarm (a word note that is shown without pinyin).
- Browser tests (`smoke-test-l3.js`, 80 checks of the exam alone) for every screen, in both styles, with all three levels together, and the level lock.

**Not done**
- No human has reviewed any of it. The packs are in `review/chinese-ai-hsk3/`.
- The word list was not compared with the official document; the grammar outline is not the official one; only four lessons were cross-checked against a second source.
- The separate "high-risk word read" (了, 在, 呢, 吧, 会, 能, 可以, 想, 要, 还, 再, 也, 都) was not done as its own pass; those sentences were covered by the full read above and by the automated meaning rules.
- 园里的花都开了 (the example for the word 园) is a little unusual because 园 is mostly used inside words; the word's note says so. A teacher should say whether to keep it.
- The exam layout is from older papers; exam pictures are emoji; the writing practice cannot judge handwriting.
- The pinyin of the "what to listen for" notes in the listening clips was only checked by script.
- `review/audio-script-hsk2.tsv` has not been regenerated and is out of date.

## Word web topics (content/topics.json)
One shared list of topics for every level, written by hand: each topic has a group, the words (from any level), and a sentence per level. A level shows only its own words in a topic; a topic with fewer than 3 words at a level is hidden unless it is the only home of one of them (tools/topics.py). All Word web topic sentences go through the same sentence checks. `node tools/test-topics.js` checks that every word is in a topic and that known bad groupings do not come back (万 with numbers, dog/cat with animals, 从小 not with weather, left/right not with shops). When adding a word to a topic, ask: would a learner see why these words belong together? A word may sit in more than one topic.

## When a new HSK level is added: revisit the categories
The Word web topics (content/topics.json) and the Grammar categories (content/categories-grammar.json) are meant to be re-thought whenever a level is added, not just extended. Moving words, topics or lessons around is fine if it helps learning. For each new level:
1. Put every new word in at least one topic where a learner would see why the words belong together. Add topics when a group does not fit (do not stretch a topic to fit). Check the new words against the old topics: a new family or animal word belongs with the old family or animal words, not in a topic of its own.
2. Re-read the whole topic list: split a topic that has become too big or mixed (a topic should stay about one idea), merge ones that have become tiny, and rename if the name no longer fits. Add a sentence for the new level to every topic that has new words (it may use earlier words).
3. Put every new grammar lesson in a category (or add one), and check that the lessons inside each category still run from easy to harder and the category blurbs are still true.
4. Run `node tools/test-topics.js` and the content checks for every level, then look at Word webs and Grammar in All levels mode.
5. Tell the learner what moved. Progress is saved by word and lesson id, so moving things between topics or categories does not lose progress (never rename a lesson id or a word).


## Word boundaries in the pinyin (spacing)
The pinyin engine knows the HSK lists plus `content/lexicon-words.tsv`: words written solid that are not on the lists (每天 měitiān, 前边 qiánbian, 外国人 wàiguórén, weekday and month names ...). Without an entry, a natural word outside the lists would be split per character (měi tiān) and learners copy that spacing. `tools/check-lexicon.py` fails when a noun, time, place or localizer word from the big dataset is split in a sentence and is in neither `lexicon-words.tsv` (written solid) nor `lexicon-split.tsv` (reviewed, stays split, with the reason). Verbs and adverbs (在家, 吃饭, 回家 ...) are not checked: whether they are one word is a matter of taste. The same list feeds the pinyin of the AI conversation (`data/lexicon.js`, built by `tools/build-lexicon.py`).
- Decisions that were AI-made and not read by a teacher: the entries in both files; the neutral tone on 前边/后边/下边 (like 外边, 左边, 右边).
- **Measure word 个** is shown with a neutral tone (`yí ge`, `liǎng ge`), as spoken after a number. Some textbooks print `gè`. Deliberate, not an oversight.
