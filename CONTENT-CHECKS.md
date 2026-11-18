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
| 6b | **Second right answer in "spot the extra word"** | A question where removing a different word also leaves a correct sentence (他吃得很非常快: either 很 or 非常 can go), which would mark a right answer wrong. Certain cases (the shorter sentence is used as correct elsewhere on the site) and likely ones (both words are degree words, 也/都, 来/去 ...) must be listed as `also` in the item (then both are marked right) or, if the second word does not work, in `content/spot-reviewed.tsv` with a reason | `check-spot-alternatives.py` (check-all step 3f) |
| 11b | **Grammar review vocabulary** | A grammar-review exercise (extra exercises, write prompts) that uses a word above its level or not on the lists | `check-grammar-vocab.py` (run per level in `check-all.sh` and `check-quick.sh`) |
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

## HSK 4 (added 13 Nov 2026)

HSK 4 is the fourth level (`content/l4/`, tools run with `LEVEL=4`). The level checker allows words from HSK 1 to 4 only (小明 is the one name allowed); every check runs in both the 儿 style and the plain style. What is different from the lower levels:
- **Words: 990 cards from the 1,000 band 4 entries.** The list was read through a summarising page reader (`content/hsk4-official-1000.tsv`) and cross-checked with the open dataset's 2025 band tag; it was **not compared with the official document**. Ten entries reuse a headword from a lower level with a different sense (重 空 生 啊 等 干 两 为 着 种); they are taught in one grammar lesson ("Words you know, with a new meaning") and are not separate cards.
- **Grammar outline is my own, not the official list** (`content/l4/grammar-outline.txt`, 58 points, 27 lessons, 135 exercises), built from the grammar of the HSK 4 words and limited to patterns that use HSK 1 to 4 words. `tools/build-grammar.py` fails if a point has no lesson. Not compared with a second source.
- **Mock exam layout** follows the HSK 4 sample papers of the 2012 test (listening 10 + 15 + 20 = 45 questions: true/false on a passage, a short dialogue, a long dialogue; reading 10 + 10 + 20 = 40: blanks, three pieces to put in order, passages; every multiple-choice question has four options), because the 2025 layout was not available to me. There are no picture questions. The bank has 151 questions. Each section is scored out of 100; the site's lock asks for 80% in both sections. The writing practice (15 questions: 10 put words in order, 5 type one missing character) is practice only and does not count towards the seal.
- **Pinyin readings added** in `content/pinyin-overrides.tsv` / `pinyin-reviewed.tsv`: 量 liáng, 背 bēi, 待 dāi, 血 xiě, 弹 tán, 应 yìng (in 适应, 答应), 只 zhī (after 两), 肚子 dùzi, 大夫 dàifu, 相 xiāng (相同, 互相), 好 hǎo (after a verb), 降 jiàng, and some forty neutral-tone words (部分, 窗户, 麻烦, 客气 ...). 有空 and 没空 are solid words (yǒu kòng, méi kòng). 嗯 is shown as ń; the syllabus prints ǹg or ńg (a question for a native speaker). 说话人为什么 is waived: pypinyin reads 人为 as one word.
- **53 word boundaries were decided** in `content/lexicon-words.tsv` and `content/lexicon-split.tsv` (e.g. 大海, 钱包, 一口气 solid; 身上, 台上 written separately), and 21 segmentation ties were settled (two by a rule: 最好吃 and 一下课).
- **Character meanings.** 290 characters that appear in HSK 4 words and are not words of their own at this level got a short English meaning for the "Built from" chips (`content/char-glosses.tsv`, AI-written, not reviewed).
- **The Learn path** has a solar-term theme: 24 units, one per term (立春 to 大寒), each unit with its usual date and a story line. The names, dates and English meanings of the terms and the story lines were written by me from general knowledge, not checked against a source; the dates can be a day off.
- **Unlocking.** HSK 4 stays behind the lock: it opens when the HSK 3 exam is passed (80% in both sections), and "open lock" in Settings still lets anyone in.
- **Audio.** HSK 4 has no recorded voice files yet (the browser voice is used); `node tools/audio-texts.js` already lists its texts for the audio workflow.
- Nothing has been read by a person who reads Chinese. `tools/make-ai-review-pack-l4.py` builds the packs for that (`review/chinese-ai-hsk4/`); they have not yet been run past DeepSeek or Qwen.

## HSK 5 (added 16 Nov 2026)

HSK 5 is the fifth level (`content/l5/`, tools run with `LEVEL=5`). The level checker allows words and characters from HSK 1 to 5 only. What is different from the lower levels:
- **Words: 1,579 cards for the 1,600 band 5 entries.** 16 entries reuse a headword from a lower level with a different sense or reading (为 倒 别 喂 头 好 当 才 数 本 省 看 背 行 量 面); they are taught in one grammar lesson (`newmean5`, "Words you know, with a new meaning") and are not separate cards. 5 entries are one spelling with two readings (称 处 调 系 批); each is one card that notes both readings.
- **Grammar outline is my own** (`content/l5/grammar-outline.txt`, 78 points, 32 lessons, 160 exercises, 156 extra exercises, 156 write prompts). It is built from the grammar of the HSK 5 words, my own list, and two open grammar sites (mandarintemple.com HSK 5 pages and the Chinese Grammar Wiki). It is limited to patterns that can be written with HSK 1 to 5 words, so some patterns are not taught (see below).
- **Not taught, on purpose.** Patterns whose key word is above HSK 5 (大都 不时 偏偏 无非 以免 与否 呗 则 兼 and similar); patterns already taught at HSK 4 (随着 尽管 即使 要是…否则 差点儿 竟然 不得不); and very abstract points. The pattern 把 + verb + 成 (翻译成, 写成, 切成) cannot be shown because 成 is a level 6 character, so only 当作 / 当成 / 看作 / 变成 / 成为 are taught.
- **Explanations cross-checked against the Chinese Grammar Wiki (16 Nov 2026):** 反而 (second half of the sentence, result opposite to what you expect, no comma after it), 毕竟 (reason or fact that explains), 万一 (unlikely and usually unwelcome), 再也不 / 再也没 (never again; 不 for a decision, 没 for what did not happen), 凭 (on the basis of), 够…的 (also checked on mandarintemple.com; the wording was widened to "surprise, sympathy or complaint"), 简直 / 根本 / 难以 (three web searches). All other grammar explanations rely on my own knowledge and the outline's examples. They were written by me and have not been read by a teacher.
- **Pinyin rules added to the engine:** 了 after a verb + 得 at the end of a clause reads liǎo (吃得了吗); 将 read jiāng in the formal 把 use (`content/pinyin-reviewed.tsv`). Words with a second reading that pypinyin gets wrong went to `content/lexicon-words.tsv` (摔倒 上当 看家 看门 数数 背书 对称 中文系 水面 本月 安全性 重要性 积极性 可能性 之一 上海).
- **Extra exercises are level-checked at every level.** `tools/dump-sentences.js` includes the review-point extras (gmore.json) for HSK 1 to 5. When they were first included, the extras of HSK 2 to 4 had 8 errors and a handful of warnings (for example 常常 in an HSK 2 extra, 早点儿 with a stray 儿, English without the pronoun or number); all were fixed or waived with a reason.
- **Word webs and character meanings.** 105 topics, 40 shared-character groups and 36 opposite pairs (`content/l5/webs.json`, topics in the shared `content/topics.json`); every one of the 1,579 words is in a topic. 272 characters that appear in HSK 5 words and are not words of their own at this level got a short English meaning for the "Built from" chips (`content/char-glosses.tsv`, AI-written, not reviewed).
- **Listening, speaking, exam.** 48 listening clips (24 added on 16 Nov, see the entry below) and 8 practice scripts (`content/l5/listening.json`, `speaking.json`); an ask-a-teacher list; a preview list of HSK 5 words for HSK 4 learners (`content/preview-hsk5.tsv`). **Mock exam: 45 listening (20 short dialogues + 25 longer ones), 45 reading (3 cloze passages with 5 blanks each + 10 matching a text to a sentence + 20 passages), writing practice 15 (10 word-order + 5 type the missing character); bank of 192 questions.** The layout is my own, in the spirit of the 2012 papers; the official 2025 HSK 5 paper is different and its writing part is handwritten, which the site cannot judge.
- **The Learn path** is a pilgrimage up the Five Great Mountains (五岳): 39 units and 331 stops, five mountains (Tai, Hua, Heng in the south, Heng in the north, Song), and the level exam is the summit. The stop names are real places (岱宗坊, 红门宫 ...) written by me from general knowledge, **not checked against a source**.
- **A reward for passing a level.** The first time the HSK 5 exam is passed (80% in listening and in reading, in one sitting or in two) the learner gets 5,000 coins, once per level. The receipt is the person preference `lvlpass.N` (it is synced between devices and a reset of one level does not clear it). Levels passed before the feature existed pay on their next pass. `ShanluLevel.passBonus` holds the rule and `smoke-test-l5.js` tests it.
- **Word boundaries decided for HSK 5** (found by `check-lexicon.py` and `check-ties.py` on the full item set, extras included): 74 words written solid and 10 deliberately split in `content/lexicon-words.tsv` and `content/lexicon-split.tsv`, 15 words that win a cut in `content/segment-prefer.tsv`, 63 cuts approved one by one in `content/segment-reviewed.tsv`. The engine's cut was **wrong** in about 25 sentences until the preferences were added (的话 + 费 for 话费, 从不 + 同, 说明 + 天, 书包 + 含, 地面 + 对, 常见 + 面 ...).
- **Engine fixes found while doing it.** (1) **个人 is a headword from HSK 5 on, so the cutter joined 一个人, 两个人 and 每个人 ("yí gèrén", about 60 sentences).** Now a 个人 after a number, 每 or 几 is cut as 个 + 人 (`yí ge rén`, as at HSK 1 to 4). (2) 美国 (and 日本, 西藏) were cut per character and written in lower case ("měi guó") in HSK 4 and HSK 5; they are now solid words with a capital letter. (3) A lexicon word can now carry a first level (fourth column): 和平 and 天才 join only from HSK 5, because in HSK 3 and 4 they would steal 和平常 and 半天才. **A lexicon word beats an HSK word of the same length** (+500), so 新手 was left out (it would have turned 新手机 and 新手套 into 新手 + 机/套) and the one HSK 5 text that used it was reworded. (4) 没法儿 is in the 儿 table (plain style: 没法).
- **Fixed 17 Nov.** 中国人 is now one word (Zhōngguórén) and 天天 is tiāntiān (`content/lexicon-words.tsv`). The review-point extras are level-checked at every level (see above); the write-your-own model answers were not until 17 Nov (see the 17 Nov evening entry).

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

### 5 Nov 2026, HSK 3 second-opinion round (Qwen and DeepSeek)

**What was done.** The HSK 3 review packs (`review/chinese-ai-hsk3/`) were run past Qwen and DeepSeek, three answers from each. Every finding was checked against the real data before anything was changed. A finding was applied only when it held up (both reviewers agreed, or the sentence was clearly wrong, unnatural or misleading). Reviewers are AI, so each claim was treated as a lead to verify, not as a verdict.

**Applied (about 50 content edits)**
- Rewordings of sentences that were stiff or slightly off in Chinese, and English that did not show the taught word's meaning, in the example files, grammar lessons, speaking lines and word webs. Every rewrite went through the same automated checks again; several were bounced by the checker and redone (a word above HSK 3, 三百米 without "300", 了 without a finished action in the English, "I" without 我).
- Word topics: several words moved to the topic where a learner would look for them; one topic sentence made more natural.
- Word-order exam questions: five items now accept the other correct orders (他一边看电视一边吃饭, 我对中国文化很感兴趣, 如果你不舒服就回家休息吧, 他刚到家就接到了电话, 我没听懂他说的话). The app shows only the tiles for these, so two valid orders must both count.
- **Neutral tones (real, systematic).** Fourteen words showed full tones although the official list and the card's own note say neutral: 爱人, 地方, 行李, 头发, 电子书, 大人, 耳朵, 故事, 凉快, 明白, 清楚, 叔叔, 月亮. Added to `content/pinyin-overrides.tsv`.
- **照片** was shown zhàopiān (pypinyin's spoken form). Now zhàopiàn, as printed in the official list; `content/pinyin-reviewed.tsv` accepts it for 片.
- **Separating apostrophe (found while checking, not by a reviewer).** The engine joined syllables without it, so 十二 showed shíèr, 可爱 kěài, 喜爱 xǐài. It now writes shí'èr, kě'ài, xǐ'ài, xīngqī'èr (`join_syl` in `tools/pinyin_engine.py`). This also changed HSK 1 (十二, 十二月, 星期二); nothing else in HSK 1 or HSK 2 changed (compared file by file).
- After the changes, all 491 card pinyin readings were compared with `content/hsk3-official-500.tsv`: 0 differences (apart from hyphen and apostrophe style).

**Declined, with reasons**
- DeepSeek's "wrong answer key" on the listening question about who drives the other to the station (pack items 13-1 and 13-2): a false alarm. The review pack did not print who says each line (男 / 女), so the reviewer guessed the speakers. In the real file the woman is the second speaker and says 不用，我开车送你, so the key is right. **Fix:** the pack now prints 男： / 女： before each line.
- Qwen's tone claim that 只能 needs a different sandhi note: wrong. A third tone before a second tone is read as a "half third" (low dip), so the note is correct.
- Qwen's remarks on files 10 and 11: unreliable. It answered about grammar chunks and not about the sentences in those files, so those two batches have effectively had one reviewer (DeepSeek) only.
- Style preferences with no error (a sentence that is correct but could be more idiomatic) were left; the cards must stay inside the HSK 1 to 3 vocabulary, which limits rewording.
- Suggestion to explain in the app that HSK 3 has 500 official entries but 491 cards: not done yet (it is in the README and in this file). Optional.

**Not verified**
- Still no teacher or native speaker has read any of it. Two AI reviewers each had gaps, as above.
- The official word list was read from a third-party copy of the PDF and not compared with the document from the exam body.
- The new rewrites were read by me and by the automated rules, not by anyone else.
- The picture questions in the exam still use emoji; replacing them with drawn pictograms is queued.

### 13 Nov 2026, HSK 4 (990 words, 27 grammar lessons, 24 listening clips, mock exam, solar-term path)

**Sources used**
- Word list: the band 4 entries of the November 2025 syllabus (1,000 entries) read through a summarising page reader and cross-checked with the open dataset's 2025 band tag. Not compared with the official document. Twenty of the 990 words could not be confirmed against the dataset (窗 袋子 动车 换乘 聚餐 嗯 入住 扫码 身 使馆 售票员 头痛 网购 味 线上 线下 血 纸巾 转发 自习); they stay in the list and are left out of the HSK 3 preview words.
- Grammar: my own outline (58 points). No second source.
- Exam layout: the 2012 HSK 4 sample papers.

**Passes done**
- Automated rules (level, pinyin, Chinese against English, gloss, word boundaries, segmentation ties) on 6,684 items (5,595 distinct sentences): 0 errors, 0 unexplained warnings, 7 waivers (each with a reason in `content/check-waivers.tsv`), in both styles.
- Everything that decides how the site reads the sentences was settled by hand: 53 word boundaries, 21 segmentation ties, 12 pinyin readings that pypinyin gets wrong, 290 short meanings for characters ("Built from").
- Browser tests (`smoke-test-l4.js`) for every screen, in both styles, with all four levels together, the level lock, the exam and the writing practice; `smoke-test-path.js` opens the HSK 4 path (24 units, 219 stops).
- Two checks that were already out of date before HSK 4 were fixed on the way: the readings self-test still expected 过 to be only "guo" (the word has listed "guo / guò" since 9 Nov), and the checker raised a pinyin alarm on the word form 过 (now waived with a reason).

**Not done**
- No human has reviewed any of it. The packs are in `review/chinese-ai-hsk4/` (24 files; the first five to send are the word list, the grammar lessons, the exam, the character meanings and the solar terms).
- The word list was not compared with the official document; the grammar outline is not the official one.
- No recorded voice files for HSK 4 yet (the browser voice is used); the audio workflow has to be run with the Qwen key.
- The solar-term names, dates, English meanings and story lines are mine and not checked against a source.
- The exam layout is from older papers; there are no picture questions at HSK 4; the writing practice cannot judge handwriting.

### 16 Nov 2026, HSK 5 (1,579 words, 32 grammar lessons, 24 listening clips (48 since the doubling below), mock exam, Five Great Mountains path)

**Sources used**
- Word list: the band 5 entries of the November 2025 syllabus (1,600 entries, 1,579 distinct spellings), from three sources that agree (a full table, the `hsk30` package extracted from the official PDF, and the open dataset's 2025 band tag). Not compared with the official document by a person.
- Grammar: my own outline (78 points) built from the HSK 5 words and two open grammar sites; nine explanations (反而 毕竟 万一 再也不 凭 简直 根本 难以 够…的) were cross-checked against the Chinese Grammar Wiki, the rest rest on my own knowledge.
- Exam layout: my own (see above).

**Passes done**
- Automated rules (level, pinyin, Chinese against English, gloss, word boundaries, segmentation ties) on 14,562 items (5,413 distinct sentences visible to the learner, extras and write prompts included): 0 errors, 0 unexplained warnings, 1 waiver, in both styles. The extras of HSK 2 to 4 were never run through the checker (found on the way, not fixed).
- The official pinyin was compared with what the site shows for every word (`tools/audit-official-pinyin-l5.py`): 43 differences, all fixed except the 10 headwords that HSK 5 reuses from a lower level.
- Everything that decides how the site reads the sentences was settled by hand: 84 word boundaries, 63 segmentation cuts approved and about 25 wrong ones fixed, 272 short meanings for characters, and the pinyin readings and neutral tones found by the official-pinyin audit.
- Browser tests (`smoke-test-l5.js`, 97 checks) in both styles, for every screen, the exam (45 + 45 + writing practice), the level lock, all five levels together and the 5,000-coin reward; `smoke-test-path.js` opens the HSK 5 path.
- Engine bugs found and fixed: 不 before a tone-4 syllable after another character (从不), 着 as zháo (睡不着), 得了 / 不了 as liǎo, 个人 joined in 一个人, 美国 cut per character. HSK 1 to 4 data were rebuilt after each change; the only change was 美国 → Měiguó in four HSK 4 sentences and the 着 fix.

**Not done**
- No human has reviewed any of it. The packs are in `review/chinese-ai-hsk5/` (24 files: three word-list files, grammar, 14 sentence batches, word webs, exam, scripts and clips, character meanings, mountains). Send first: the grammar lessons, the exam, the word list, the character meanings and the mountains.
- The word list was not compared with the official document; the grammar outline is not the official one; the exam is not the official layout.
- No recorded voice files for HSK 5 yet (the browser voice is used); the audio workflow has to be run.
- The Five Great Mountains stop names, the story lines and the English names are mine and not checked against a source.

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

### 16 and 17 Nov 2026, more practice items: all five levels (HSK 5, 4, 3, 2, then 1), one level at a time
Why: the same grammar review questions came round too often and the listening clips ran out. For each level the grammar review pool per point and the listening clips are doubled, and the review picker now goes round every exercise of a point once per round (a per-point list `sc` of the exercises shown in the round, next to `sn`, the last few shown) before any comes again. Browser test `smoke-test-grv-variety.js` runs for HSK 1 to 5 (no repeat within the window, every exercise shown, each round of N questions shows each exercise once); it is in `check-all.sh` and CI.
- **HSK 5 grammar review:** +314 extra exercises in `content/l5/gmore.json` (4 per point, 6 for the "words you know" point; mix of choose, fill, build and spot), so each of the 78 points now has 8 to 11 exercises (before: 4 to 7). **Write-your-own prompts:** +157 in `content/l5/gwrite.tsv` (2 per point, 3 for the last), now 4 to 5 per point.
- **HSK 5 listening:** +24 clips (48 in all), each with two "what to listen for" notes (third-tone change, 不 and 一 changes, words with two readings, light syllables).
- **Checks:** every new sentence passed the level check (words and characters up to HSK 5), the meaning check, the pinyin check, the build rules (blank is a whole word that appears once; the extra word appears once; build sentences have 3 to 9 words) and the plain-style (no 儿) run. Two waivers were added: 三万 (the checker cannot match "30,000") and 场 in 一场比赛 (chǎng, third tone; pypinyin gives cháng). The checkers now include the extras at every level; that found 13 sentences in HSK 2 to 4 extras (an HSK 3 word in an HSK 2 sentence, 儿 endings that are not on the erhua list, English without the pronoun, number or "now"), which are fixed.
- **HSK 4:** +247 extra exercises in `content/l4/gmore.json` (4 per point for pools of 3 or 4, 5 or 6 for the larger ones), so every one of the 58 points now has 7 to 12 exercises (before: 3 to 6). +118 write-your-own prompts in `content/l4/gwrite.tsv` (4 per point, 6 for the two points that had three). +24 clips (48 in all) with two notes each; the clips cover 银行 háng, 还 huán, 重新 chóng, 爱好 hào, 长 cháng and zhǎng, 觉得 jué, 一个 yí ge and the third-tone changes. All level, meaning and pinyin checks pass. New reviewed word boundaries: 好事 (written solid, HSK 5 batch), 要点 (stays split: 您要点什么 is 要 + 点). The checker cannot tell erhua 儿 from a following syllable that starts with e (我有点儿饿了 fails), so that sentence was reworded.
- **HSK 3:** +219 extra exercises in `content/l3/gmore.json` (4 per point, 5 for the two larger ones), so every one of the 52 points now has 8 to 10 exercises (before: 4 to 5). +104 write-your-own prompts in `content/l3/gwrite.tsv` (2 per point, so 4 each in all). +24 clips (48 in all) with two notes each; the clips cover 银行 háng, 还 huán, 长 zhǎng, 得 děi, 还是 hái, 自行车 xíng, light second syllables (东西, 清楚, 有意思), 不 and 一 changes (不难, 不贵, 一般, 一起, 一直, 一遍, 一家) and third-tone changes (比我, 雨伞, 很有). All level, meaning and pinyin checks pass; no new word-boundary approvals were needed. Words that sit one level up and were reworded away: 重, 黑.
- **HSK 2:** +160 extra exercises in `content/l2/gmore.json` (4 per point, 5 for the eight points that had five), so every one of the 38 points now has 8 to 10 exercises (before: 4 to 5). +76 write-your-own prompts in `content/l2/gwrite.tsv` (2 per point, so 4 each in all). +24 clips (48 in all) with two notes each; the clips cover 两 liǎng, 还是 hái, 觉得 jué, 不 and 一 changes (一个 yí ge, 一本 yì běn, 一杯 yì bēi), third-tone changes (比我, 手表, 几点, 给你, 很晚) and light syllables (便宜, 弟弟, 眼睛, 在做饭). All level, meaning and pinyin checks pass. Words that sit one level up and were reworded away: 北京, 羊肉, 西瓜, 红, 周末, 报纸. The 三万 waiver now points at `lesson:mw:extra13` (the extras were renumbered when the new ones were added).
- **HSK 1:** +181 extra exercises in `content/gmore.json` (4 per point, 5 or 6 for the points that had five or six), so every one of the 42 points now has 8 to 12 exercises (before: 4 to 6). +85 write-your-own prompts in `content/gwrite.tsv` (2 per point, 3 for the question-words point, so 4 to 6 each in all). +24 clips (48 in all) with two notes each, using only HSK 1 words; they cover third-tone changes (你喜欢, 我想, 很好, 请你, 几点), 不 and 一 changes (不在 bú zài, 一杯 yì bēi), light syllables (妈妈, 哥哥, 朋友, 衣服, 们, 呢) and 儿 (这儿, 哪儿). All level, meaning and pinyin checks pass. HSK 1 words only: 高, 进来, 等 and 今天 without "today" in the English were reworded away.
- **Known and not changed:** 不 in a potential complement is written with the tone change (听不清楚 tīng bù qīngchu, 拿不动 ná bú dòng), as in the rest of the site; some dictionaries write it light (bu). Ask a teacher.
- **For the AI check:** `python3 tools/make-review-delta.py 5 e9176e1a` writes `review/chinese-ai-new-items/HSK5-new-review-items-1-of-4.md` to `-4-of-4.md` (only the new items, about 39 KB each, instructions on top). Not yet run past DeepSeek or Qwen; no human has reviewed the new items.
- **For the AI check, HSK 4:** `python3 tools/make-review-delta.py 4 ab1f56f4` writes `review/chinese-ai-new-items/HSK4-new-review-items-1-of-3.md` to `-3-of-3.md`. Not yet run past DeepSeek or Qwen. DeepSeek reviewed it on 16 Nov: eight spot items whose "extra" word can read as acceptable (即使因为, 尽管因为, 比如是, 赶紧快, 老是一直, 仍然还 ...) became order items, 有的人是喜欢 became a clearly wrong 了, and five write prompts were reworded (同时, 开着门, 不太清楚, 水平, 睡了整个下午). Its 还给 spelling claim is rejected as for HSK 3.
- **For the AI check, HSK 3:** `python3 tools/make-review-delta.py 3 7aa5c3f7` writes `review/chinese-ai-new-items/HSK3-new-review-items-1-of-N.md` onward. Not yet run past DeepSeek or Qwen. DeepSeek reviewed it on 16 Nov: seven spot items whose "extra" word can be read as acceptable (如果因为, 再然后, 不很, 好像是, 大概可能, 几乎差不多, 得要) became order items or got a clearly wrong inserted word; the write prompt 这本书很容易看 became 看懂. 雨伞 is now a solid word (`content/lexicon-words.tsv`, yǔsǎn) and the 看看 clip note says kànkan. Not changed: 还给 stays solid (huángěi is 还 huán + 给 gěi, written together like 还书 huánshū).
- **For the AI check, HSK 2:** `python3 tools/make-review-delta.py 2 57040784` writes `review/chinese-ai-new-items/HSK2-new-review-items-1-of-N.md` onward. DeepSeek reviewed it on 16 Nov: four spot items had two removable words (now order items) and two notes were wrong (已经 works with negatives, 太 is not "maybe"), so they were rewritten; one write prompt's English was loosened ("go right", not "turn right"). Its claims that 女孩儿, 一会儿 and 门口 are beyond HSK 2 were wrong: all three are in `content/hsk2-official-197.txt`. Its point that a doubled verb has a light second syllable was right, so `tools/pinyin_engine.py` now writes xiǎngxiang, zǒuzou, wènwen, kànkan (verbs in `REDUP_VERBS`; 天天 and 常常 keep full tones) at every level. Not yet run past Qwen. One more HSK 2 spot (虽然 + 因为, which DeepSeek listed in its HSK 4 reply) became an order item.
- **For the AI check, HSK 1:** `python3 tools/make-review-delta.py 1 6aae35df` writes `review/chinese-ai-new-items/HSK1-new-review-items-1-of-N.md` onward. DeepSeek reviewed it on 16 Nov: 10 spot/choose items were redesigned (a 是 before an adjective can be read as emphatic, and one spot sentence had a misplaced word, not an extra one). Its ~19 "above HSK 1" claims were all wrong: every word is in `content/hsk1-official-300.txt` (the 300-word band 1 list), so give reviewers that list, not the old 150-word one. Open for a teacher: DeepSeek wants 不 written light ("bu") inside A-not-A (你去不去); the site writes the tone-changed form ("bú") everywhere, in old and new items alike (57 places across levels), and sources disagree, so it was left as is. Not yet run past Qwen.

### 16 Nov 2026 (evening), DeepSeek review of the HSK 5 word list, grammar explanations, word webs and sentences

Alvin ran the HSK 5 pack (`review/chinese-ai-hsk5/`) past DeepSeek in parts: word list (3 files), grammar and webs, sentences 05 to 10. He reached his usage limit after sentence file 10, so sentence files 11 to 18, the exam and the scripts are still to do. Each claim was checked before anything changed.
- **Applied:** 91 example sentences reworded (each keeps the headword; 28 got a new English line), 23 word-list glosses and notes (加工 gloss, 简直 / 建筑 / 开通 / 克服 / 恋爱 / 路人 / 名片 examples, 结 now says jiē for bearing fruit, 连忙 / 奇迹 / 全体 / 软件 / 酸甜苦辣 / 特殊 / 提升 / 体力 / 调整 / 退还 / 保安 / 被子 / 长久 / 大爷), grammar lessons 4 (以便我们联系你), 11 (令人 + adjective: 人 means people in general) and 28 (the word order sentence now says the verb comes last), 11 word-web character meanings (业, 应用, 运用, 宠物, 体验, 体会, 果然, 情景, 装修, 度) and 47 words moved to a better topic in `content/topics.json` (个人, 私人, 家务, 天空, 邮局 ...). New words 好奇心 (lexicon) and 不断 (segment-prefer) were added.
- **Replacements are level-checked:** DeepSeek's own fixes often used words above HSK 5 (花瓶, 旋律, 充沛, 柔和, 进展, 同龄, 消耗); those were swapped for in-level words.
- **Rejected, with the reason:** every "too easy for HSK 5" claim (the site follows the official HSK 3.0 band 5 list, which includes 白, 黑, 被子, 老板, 政府 ...); 口袋 kǒudai, 队伍 duìwu and 大爷 dàye (they match `content/hsk5-official-1600.tsv`); extra parts of speech (the site shows one label, like the official list); 较 as a preposition (it is one); sentences where the "fix" would drop the headword (必, 便, 伙, 或是, 届, 近代, 久远, 似的, 特征, 访问, 更换 ...) or the original is fine Chinese (安下心来, 天空很红, 第五节车厢, 称赞他学得很认真, 快一点起床 ...); 公司逐步扩大了 (扩大 can be intransitive); the pairs 乐观/悲观 and 前进/后退 (悲观 and 后退 are not in the HSK 5 list); the item "这个城市有三十多个省份" (not in the site; the real sentence already says 中国).
- **Not done (a design decision for Alvin):** splitting the big word-web topics (Money and shopping, Directions and positions, How things are done ...) into new ones, and the missing-grammar-points list (it is a list of common teaching points, not of the official HSK 3.0 outline).

### Tools for adding practice items (17 Nov 2026)
The scripts used to double the practice items now live in `tools/` instead of a scratch folder:
- `python3 tools/view-grammar-points.py LEVEL FROM TO` shows every grammar point with all of its existing exercises, extras and write prompts, so new ones do not repeat them.
- `python3 tools/add-practice-items.py LEVEL batch.txt ... [--check]` checks and adds review extras (mc, cloze, order, spot with an optional `also`), write prompts and listening clips from batch files (format in the script's header). Then rebuild (`build-grammar.py`, `build-speech.py`, `build-site.js`), run check-all, and make the AI-check file with `make-review-delta.py`.

### 17 Nov 2026, listening passages (HSK 1 and 2) and "Hear the sentence"
- **Listening passages** (`content/listening-passages.json`, built by `tools/build-passages.py` into `data/passages.js`): 12 HSK 1 and 12 HSK 2 short dialogues (女 and 男 voices), each with 3 (HSK 1) or 4 (HSK 2) questions in Chinese, four options each, and the line that holds the answer. They are Path stops of kind `l`: `tools/build-path.py` puts each one right after the stop that teaches the last of its own-level words, so a passage only comes once all its words have been met (some were simplified so they spread over the units instead of all landing in the last ones). Every line and question goes through `check-content.py` (level, pinyin, Chinese vs English) via `dump-sentences.js`; options get the level and pinyin checks. Five false alarms waived (是……的 questions, 喝了睡不着, 就到了, 老师说 + report); one segmentation tie approved (早上 去).
- Coins: 10 a right answer and 10 more when all are right, the first time; 2 a right answer after that. The result is a person pref `psg.<id>` (best, times), so it follows the person to every device.
- Audio: the lines are in the recorded-audio list (`tools/audio-texts.js`, group `passages`, part of the `core` scope), man's voice for 男; until the recordings exist the browser or Qwen voice reads them.
- For the AI check: `python3 tools/make-passages-review.py 1 2` writes `review/chinese-ai-new-items/listening-passages-HSK1-2.md` (one message). Not yet run past DeepSeek or Qwen.
- Browser test: `tools/smoke-test-passages.js` (placement, no text before the questions, right and wrong answers, transcript, coins, the repeat rate, the saved result), in check-all and CI.
- **Hear the sentence** (Review): a word whose hearing is stable for 3 days or more gets, about half the time, a recorded example sentence instead of the word alone; you pick what the whole sentence means. Only sentences with a recording are used (HSK 1 to 4 now; HSK 5 examples are not recorded yet). Test: `tools/smoke-test-hear-sentence.js`.

### 17 Nov 2026, listening passages for HSK 3, 4 and 5 (live since 17 Nov, after the DeepSeek review below)
- 12 passages per level added to `content/listening-passages.json`: HSK 3 dialogues with 4 questions, HSK 4 dialogues with 4 questions, HSK 5 dialogues, announcements and a radio talk with 5 questions (one asks for a small sum: an internship year plus two years of work). All lines, questions and options pass `check-content.py` in both styles; 16 false alarms waived with reasons (V不了 = cannot, 要看 = depends, 要 + price, 零下 = minus, 别……了, (是)……的 and so on); 4 nouns joined in `content/lexicon-words.tsv` (羊肉, 行李箱, 小路, 上次); 7 word cuts approved (早上 去, 推迟 到, 多少 年, 飞机 票, 马上 去).
- Placement: some lines were simplified (但是 for 可是/不过, 如果 for 要是, no 按照/肯定/好像) so the passages spread over the Path instead of all landing in the last units: HSK 3 units 5 to 16, HSK 4 units 8 to 20, HSK 5 units 8 to 37.
- Kept on a branch on purpose: Alvin wants the DeepSeek check first, because a changed line means a new recording. No audio made yet. Review files: `review/chinese-ai-new-items/listening-passages-HSK3.md`, `-HSK4.md`, `-HSK5.md` (one message each).
- To put them live after the review: apply the fixes, merge the branch into main, run check-all, then start the audio workflow with scope `passages` (it only records lines that have no recording yet).

### 17 Nov 2026 (afternoon), DeepSeek review of the listening passages (HSK 1 to 5) and HSK 5 sentence files 11 to 16

Each claim was checked before anything changed; replacements were level-checked (DeepSeek's own fixes often used words above the level).
- **Passages, applied:** 你的家人; 一条鱼; 还在下雨; purpose clause first (为了提高我的汉语水平，我打算…); 银行就在路边，旁边有一个超市; p2-gift 太长 became 太大 so that 小一点儿 follows (短 is HSK 3); p4-online 网购 became 在网上买; p4-flight's impossible option 晚上三点 became 下午四点; p5-accident 暂停驾照 became 一段时间不能开车 (暂扣 and 吊销 are above HSK 5); p5-login 发一个号码 became 发一条短信，里面有几个数字 (验证 is HSK 6). A question's `line` may now be a list when the answer needs two lines (p1-fruit Q1, p1-weather Q2, p4-forest Q2); the answer box shows and plays both.
- **Passages, rejected:** 明天下雨 (natural as it is), 多大年纪 (年纪 is HSK 5), 零下三度 (度 is HSK 5; 摄氏度 is on the HSK 4 list).
- **Pinyin engine:** 过 at the start of a clause is the verb guò (过了红绿灯, 过海关, 过安检, 过了桥, 过几天, 过了很多年 were read as the particle guo); 调 right before 小/大/高/低/好 is tiáo (to adjust; the HSK 5 card is diào), with waivers because pypinyin says diào (clip 29 was wrong before).
- **HSK 5 sentences 11 to 16, applied (104):** each keeps its headword; about half use DeepSeek's wording, the rest are my own rewrite where its fix dropped the headword or used a word above HSK 5 (进度, 金额, 恐惧, 均衡, 场面, 清晰, 提拔, 节奏 are HSK 6 or 7). Examples: 地球上，海比陆地大 (the old text read as 上海), 据说他是…, 他的手机没有接收到短信, 纪念 now about a teacher who died, 伙 sentences fit its gang feel (那伙人在车站骗钱) or a casual 我们这伙人, 中期 no longer in 中期考试 (also fixed in its card note), 增了一倍. Four word-web gap sentences too (媒体, 主持, 制造, 便利).
- **HSK 5 sentences, rejected (about 50):** fixes that drop the headword where the original is fine Chinese (广大, 规模, 简单化, 缓慢, 或是, 及, 集中, 建立学校, 接收学生, 久远, 具有, 扩大操场, 良好, 领, 名牌, 平衡, 普及, 其, 如此, 如同, 善良, 爱摄影的人, 省会, 胜了对手, 使得, 随手放在了, 一所医院 (所 is the measure for hospitals), 同, 维持关系, 是伟大的, 需, 迎客人, 语音, 众多, 阻止这件事发生, 遵守时间, 赠我的, 赠送客人), 升到三年级, 不去的理由, 跳得高 and 小小的失误 (style only), and 增了三公斤 (left for the teacher question already open on 增).
- Still to review by DeepSeek: HSK 5 sentence files 17 and 18, the exam, scripts and clips, character meanings, the Five Mountains path.

### 17 Nov 2026 (evening): write prompts checked, pinyin audit for HSK 2 to 4, spacing, smaller topics

- **Write-your-own model answers are now checked** (`tools/dump-sentences.js` adds them as `write:<point>:<n>`, every level). The first run found 13 errors and 32 warnings across HSK 1 to 5: words above the level (今晚 at HSK 3: 今 is not on the lists; 有空 at HSK 3: 空 is HSK 4; 年纪 at HSK 4; 谢 alone at HSK 5) and English that did not match (a missing negative, "can" with no 能, a missing pronoun, tense). All fixed or waived with a reason. 一起床 is now cut 一 + 起床 (`segment-prefer.tsv`).
- **Pinyin audit against the official lists** (`tools/audit-official-pinyin.py LEVEL`, which replaces the HSK 5-only script). HSK 3 and 4 use the official files; HSK 2 has no official pinyin file here, so it is compared with the dataset (a weaker check; the install of the `hsk30` package with the official HSK 2 pinyin was not possible in this session). Fixed: the tone change of 不 and 一 in headwords, as the official lists print them: 不必 不便 不断 不够 不过 不论 不但 不用 不错 bú-, 一切 一共 一样 yí-, 一边 yì- (`content/pinyin-overrides.tsv`). What still differs is only a lower-level word reused with a new reading (得 dé, 地 dì, 还 huán, 长 zhǎng, 重 chóng, 干 gān, 为 wéi, 着 zháo, 种 zhòng ...), as for HSK 5.
- **Smaller Word web topics.** 21 big topics were split into 36 new ones (`content/topics.json`, each new topic placed right after its parent in `content/path.json`), for example Feelings -> Love and friendship, Stress and calm, Being moved; Money and shopping -> Prices and paying, Earning and saving, Online shopping and delivery. The biggest topic at HSK 4 and 5 went from 47 words to 29, the median from 17-18 to 14. Every new topic has its own level-checked sentence. Path stop ids of split topics changed; a stop counts as done when all its words are started, so progress is kept.

### 18 Nov 2026, DeepSeek review of HSK 5 sentence files 17 and 18 and the HSK 5 review items (A grammar questions, B write prompts, C clips)

- **Applied:** 41 sentence claims checked. Topic sentences took DeepSeek's wording where it was level-safe (系领带, 病情好转, 词汇量也很大, 手上有汗, 和…相比, 一个现代化的城市 ...); 天气变暖 became 变暖和 (暖 is HSK 6) and 事实 became 经过 (真相 is above the level). Word-web gaps keep their answer and stay one-answer-only, so they were rewritten rather than taking a fix that drops the word (偶然 我们是___认识的; 表情 看她的___; 形象 这位演员的___; 录音 我用手机___; 增强 ___了他的信心; 设立 在上海___了一个新的办公室; 开展 经常___各种活动; 展览 这次___持续一个月, which avoids reading 展览会). Grammar items keep their point: 依据 + data or rules (not 天气 or 老师的话), 从…来看 as "judging from", 如此 with a reason, 稍冷一点儿 in a comparison, 没有努力就没有成功, 公司逐步扩大了规模, 本公司有一百名员工. The 以便 blank is now the whole word. A132 (可太不简单 is natural with 了) now has a clearly wrong 了; A185's wrong option is 少尽量看 (尽力少看 is acceptable). Write prompts: 依据新的规定, 逐渐变大了, 连续病了三天, 请帮我问一下他是否有空.
- **Pinyin:** 以便 yǐbiàn and 为的是 wèideshì are written as one unit (`lexicon-words.tsv`, from HSK 5; 以便 is on the HSK 6 list, 为的是 on none, and dictionaries differ on spacing 为的是). V一V has a light 一 (zǒu yi zǒu, kàn yi kàn; not 一个一个, 一天一天). C6 调小 and C22 看看 were already right after the 17 Nov engine rules.
- **Rejected:** 早点 → 早点儿 (both fine; the plain style drops 儿 anyway), 请稍坐一会儿 (natural as it is).
- **New tool:** `tools/make-review-unseen.py` lists every sentence with an English line that never appeared in the first version of any review file (what was actually sent). First run: 1,205 sentences across HSK 1 to 5 (mostly the original grammar exercise sentences and mock exams of HSK 2 to 4, and the rewrites since the reviews), in `review/chinese-ai-new-items/unseen-HSK*.md`.
