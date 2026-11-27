# Handoff: 26 Nov 2026

This is for the next agent working on Shanlu (this repo). It covers what the project is, what's built, what's still open, and what Alvin has already decided.

- **Read `CLAUDE.md` first.** It has the file map, commands, content formats and traps.
- The detailed history is in Alvin's claude.ai Project docs (`claude/session-*.md`, the 20 Nov site review, the 21 Nov brainstorm). You may not be able to read those. This file has what you need from them.

**Latest commit:** 5f756d29 on `main` (the postcard wall). The full UI check passed locally on it. The previous push (5320a21b, D2) was green in CI.

---

## 1. The project in short
- **Shanlu (山路, "mountain road")** is a free study site for HSK 1–5 on the HSK 3.0 syllabus. It's a static HTML/JS site that GitHub Pages serves from `main`, so **a push to `main` deploys**. Repo `alvinyu20/hsk-path`.
- **Who it's for:** Alvin (the owner) and a small group of friends learning Chinese. He wants it to feel like a game you come back to daily, with real learning underneath.
- **How it's built:**
  - No framework. `index.html` is one template with all screens, `runtime.js` diffs it (morphdom), and `app.js` (~6k lines) holds the state `S`, the handlers and `renderVals()`.
  - Content is hand-edited in `content/` (Chinese and English only). Python builders in `tools/` turn it into `data/*.js`, adding pinyin, levels and checks.
  - Friends, sync and an optional AI relay run on a Cloudflare Worker (`worker/`, D1 database).
  - Recorded audio lives in `audio/` (Qwen voice longanhuan, about 270 MB), recorded by the `audio.yml` GitHub workflow.
- **Checking:** there's no teacher. Every piece of new content goes through review packs that Alvin pastes into DeepSeek or Qwen; we verify each claim before applying it (CLAUDE.md, "DeepSeek review workflow"). CI (`ci.yml`) runs the content checks, the unit tests and about 40 browser smoke tests.

## 2. Where things stand
- **Live** on GitHub Pages from `main`.
- **Content:** HSK 1–5 are open. HSK 6 hasn't been started.
- **Sections:**
  - Today (Home): Today's plan and the mountain trail;
  - Learn: the Path (lessons), the Library and Games;
  - Review: words, grammar and the Test (mock exam);
  - Talk: listening lab (with the tone trainer), speaking scenes and AI chat;
  - Journey: Explore, Map, Passport, Souvenirs, Postcards, Food.
- **Nothing is half-finished.**

### Built 23–26 Nov (this round)
- **Bug fixes (W1, W2, W3, X14):**
  - The flaky friends sync is fixed: a progress sync asked for while one is running now waits for it, then runs once more.
  - Small regions: Hong Kong and Macau already had the map marker. Singapore isn't on the map, so the small-region button you're in now gets a "You are here" tag. Finishing a small region scrolls to its button, which bounces with a ring in the region's colour.
  - Path group headers count the units folded into "done" ("4 units · 3 done").
- **Lighter start-up (B1, B2):**
  - The audio list is now 152 KB instead of 1 MB: only the first 7 hex digits of each recording's SHA-1, and `audiolist.js` works out the file name.
  - Path scenes, speaking scenes, exam drawings and Journey photos (about 1.1 MB) load right after the first draw.
- **Coloured grammar examples (C4), done:** all 671 grammar examples (HSK 1–5) are hand-cut in `content/example-parts.tsv`.
- **Smarter wrong answers (D4):** multiple-choice cards now offer what learners actually mix up: look-alikes, word families, other tones (Review listening only), opposites and topic partners. At most 2 per Review card, 1 per Path card, none on Fill it. Same-meaning words are never offered together, and an option whose English means the same is skipped (a fix on 24 Nov: 别 "do not" no longer gets 不要 "don't" as a wrong answer).
- **Mock exam retakes (E1):** the exam remembers what you've had and draws unseen questions first. 98 new HSK 3–5 questions mean every part's bank is at least twice one sitting's draw.
- **Speaking scenes (E3):**
  - 10 new scenes, each with a choice of what to say (Mingming answers the one you picked).
  - 10 "bad day" versions, switched with Good day / Bad day in the chat.
  - The new scenes have Path stops (stop counts went up by 2 per level).
- **Review round:** 8 review packs went through DeepSeek. We applied the look-alike fixes, 8 speaking line fixes and 17 colour cuts, and rejected its level claims (it judges by HSK 2.0). The log is in `CONTENT-CHECKS.md`.
- **Audio:** all new lines are recorded (levels 1–5, one run each).
- **Tone feedback (D2):** Listening lab > Tone trainer > **Say it**.
  - You say a syllable or a two-syllable word. `pitch.js` tracks your pitch in the browser (nothing is uploaded), cuts the word into syllables and judges each tone.
  - It's strict for one syllable and lenient in words (only clear mistakes). Light tones aren't judged, and 3+3 may be said 2+3.
  - Your curve is drawn next to the model's (decoded from the word's own recording), with a verdict and a tip per syllable.
  - Measured on the site's recordings: 96% of single syllables and 93% of two-syllable words are accepted as right. **It was tuned on one synthetic voice only; real voices are untested.**
- **Postcard wall (26 Nov):** the Postcards tab is a cork board in a wooden frame. Postcards are landscape, the photo printed to a white border with the name on the picture. Each is pinned or taped up a little crooked, the same way every visit. A turned card comes to the front and can grow taller than its front when the message needs the room.

### Built 21–23 Nov (the round before)
- **First session** is the first Path stop (one red "Start my first stop" button on Home). It pays 50 coins, enough for the next Journey stop.
- **Sounds course** on the Start card and as a Today's plan row until finished.
- **Host box:** the first flight lands with your host waving, with 你好 to hear.
- **Quick sort:** "I know a little" (and Settings > Level): up to 30 words, Know it / Not yet, a meaning check every 4th "Know it".
- **Journey finds** each have a button to where they went (table, wall, passport, shelf) with an arrival animation. Must-sees turn gold. Travel sounds. Shanlu Air status tiers (Bronze 0, Silver 3, Gold 8, Platinum 15 regions). The next region stays a secret until you land. Postcards carry a postmark. 12 souvenir sets (100 coins once each). Packed Journey save (about 5× smaller). Achievement toasts wait for modals.
- **Review > Test** pays 3 a right answer (4 from the third in a row).

---

## 3. Open items
Effort: **S** < 1 h, **M** = one session, **L** = several. 🟡 partly done.

Alvin picks what comes next. **Don't start big items unprompted.** Ask which one, and ask one scoping question before visual work.

### Small fixes
| # | Item | Effort |
|---|---|---|
| N5 | **Day-one Home zeros:** hide "Your memory" until there's at least one word in memory. It shows 0 / 0% / 0 min on day one. | S |
| D2+ | **Tone feedback on real voices:** once Alvin has tried Say it on his phone, loosen whichever checks reject tones he says right. Tune with `node tools/eval-pitch.js 600` and keep the 96% / 93% figures. Third-tone confusions are the weakest part. | S–M |

### First visit (new friends)
| # | Item | Effort |
|---|---|---|
| N3 | **Fewer screens before the first word** (today about 11 taps). Options: <br>• cut the six guide cards to 2–3, and turn the rest into one-line tips the first time each screen opens; <br>• show the Home Screen card on the 2nd visit, only if not already running as an app; <br>• ask for the name and study group after the first session. <br>Alvin chose the current order on 13 Nov, so offer these as options. | S–M |
| N7 | **A planned first week** through Today's plan rows. The sounds row is done; the rest isn't. No new Home sections. | S–M |
| N9 | **QR code** of the personal link in Friends, for moving to a new device. | S–M |
| N10 | **"Tomorrow" line and reminder opt-in:** the first session's result says what tomorrow holds, plus a "remind me tomorrow?" opt-in (needs F1). | S |
| N11 | **First-week passport page:** 7 day boxes, souvenirs on day 3 and 7. Ask first: it is close to a "daily quest" he rejected for Home. | M |
| N13 | **Onboarding step in friends stats:** add the step reached to the friends-board stats, to see where friends drop off. | S |

### Journey (Alvin wants it as a fun side game that brings him back daily; Chinese learning inside it is a low priority)
| # | Item | Effort |
|---|---|---|
| J1 | **Travel all ready stops at once:** a quick montage, then a summary card ("7 places: 3 dishes, 2 sights…"). Today 30 ready stops means 30 taps. | S–M |
| X2 | **Travel happens in the world:** <br>• the 我 marker walks along the Explore road; <br>• a train runs to a new city; <br>• on phones, the country map shows for a flight. The plane animation (`jyPlayFly`) already exists, but phones never see it: the map column is hidden on Explore under 1000 px. <br>Drop the four step pills and the self-lighting button in the trip dialog. | M |
| X3 | **Tap to flip, hold to stamp:** the person taps the mystery card to flip it, or holds to stamp it, instead of a timer. | S–M |
| X6 | **Road events:** about 1 stop in 12 brings a small event (tea with a local +60 coins, a bonus street snack, a rainy postcard, a festival). | M |
| X7 | **"While you were studying" unpack:** coins earned since the last visit pour out when the Journey opens ("+620 since yesterday · 2 stops ready"). | S–M |
| X8 | **Region ranks** at 25 / 50 / 75 / 100% (游客 / 旅人 / 本地人 / 海南通). | S–M |
| X10 | **Night's rest scene:** a small inn scene when no stop is ready, instead of only a grey button. | S |
| X11 | **Friends feed line on Explore:** "Lin just landed in Yunnan". | S |
| X12 | **Shop of looks:** boarding-pass designs, passport covers, avatar frames. Coins are lifetime earnings, so this needs a separate spending record in the balance and in sync. | M–L |
| J3 | **Fill the empty bottom of the Food tab** with a line about your table. | S |
| J4 | **Earn button text:** the small "How to earn?" button reads "50 coins ≈ one Path stop". | S |
| J5 | **Province finale:** a short listening passage set in the region. Ties in with E4. | M–L |
| J7 | **Dish tags:** flavour and type tags on dishes, a "your palate" view and food badges. | S–M |
| J8 | **Choose your road:** sometimes choose between two cities (station signs in Chinese). The province stays random. | M |
| J9 | **Send a postcard:** send a friend a postcard with a one-line message (templates, or AI-checked). Uses the Worker. Fits the new postcard wall. | M |
| J10 | **Pace line on Explore:** "Hainan stamped around [date] at your pace". | S |
| J13 | **Friend meet-ups:** a meet-up stop when two friends are in the same region. | M |
| J14 / F6 | **Festival stops and events** tied to real dates (Spring Festival is early 2027; check the date). | M each |
| F3 | **"Order it" at dishes:** a 30-second mini-dialogue at Feast dishes. | M |
| D3 | **Graded reading on postcards:** 3–5 sentences at the reader's level, tap for meanings. Pilot with the 52 Hainan stops. | L |
| J2 | **A small Chinese moment per stop:** a check-in question, a level-matched "Say it there", known characters lit up in names, add a stop's word to Review. Low priority now. | S–M each |

### Speed and infrastructure
| # | Item | Effort |
|---|---|---|
| B3 | **Render only the open screen:** every tap rebuilds every screen's values (`renderVals`). Compute only the open screen's values and cache derived numbers. | M |
| B4 | **Move the audio before HSK 6:** move `audio/` (about 270 MB) off GitHub Pages before HSK 6 (1 GB limit), e.g. Cloudflare R2. | M |
| B5 | **Keep the full review log:** only the newest 800 answers are kept. Add an append-only table in the Worker's D1 database. This unlocks D6. | M |
| B6 | **Run tests in WebKit (Safari):** run the smoke tests in WebKit in CI, plus screenshot comparisons. | M |
| B7 | **Split `app.js`** into ES modules. Low urgency. | L |

### Learning
| # | Item | Effort |
|---|---|---|
| D5 | **Pinyin that fades:** hide pinyin on "what does it mean" after the first meeting, with a tap to peek. | S |
| D7 | ✅ **Done 27 Nov** (with the mistake notebook, Review > Mistakes). **Leech words** (4+ lapses): a contrast card, an extra example, the mistake notebook. | M |
| D6 | **Review schedule fitted to the person (FSRS).** Needs B5. | M–L |
| D9 | **English → Chinese sentence building**, AI-checked strictly. | M |
| D1 🟡 | **Listening ladder, the rest:** background noise, more voices, Common Voice clips, natural reductions. Speed rungs, shadowing and Quick-fire numbers are done. | M each |
| E4 | **2–3× more listening at HSK 4–5**, with longer passages. | M |
| E5 | **Older open items:** <br>• separate records for two-reading characters (还 / 行 / 得); <br>• same-meaning sweep round 2 (558 groups, ask first); <br>• Fill it beyond the classic pairs; <br>• ~~a mistake notebook~~ (done 27 Nov; spoken re-practice still open); <br>• real time-on-task; <br>• HSK 6. | mixed |
| Games | **Games follow-ups:** <br>• feed game misses into Review / Grammar review; <br>• recorded audio for game sentences (the browser voice reads them now); <br>• time real play on a phone to check coin rates. | S–M |

### Fun and coming back
| # | Item | Effort |
|---|---|---|
| F1 | ✅ **Done 27 Nov** (Settings > Reminders; Alvin adds the VAPID secrets and an hourly cron trigger, see worker/README.md). **Phone reminders (Web Push)** through the Worker. iOS needs the Home Screen app. | M |
| F2 | **A role-play to finish each Path chapter.** Could reuse the E3 choice lines. | M–L |
| F4 | **Friends:** a weekly group goal, ghost duels, voice cheers. | M |
| F5 🟡 | **1.5× club on the friends board.** The achievements exist; the board comparison doesn't. | S |
| F7 | **Weekly recap card.** | S–M |
| F8 | **Combo meter in Review** (auto-graded cards only; risk: it rewards speed). | S |
| F9 | **Listening radio:** hands-free, with lock-screen controls. | M |
| G | **Wild ideas:** a comprehension meter (paste text, see % known), label your home, the AI chat steering to due words, a subtitle player, mountain seasons, an own domain. | M–L |

### Parked (only if Alvin brings them up)
- The Fill it first-letter hint.
- Photos for the 387 dishes without one.
- An og:image share preview.
- An own domain.

---

## 4. Decisions to respect

**Never suggest:**
- stroke order or handwriting, radicals, Word of the day;
- a redesign of Home's task list (a single next-task hero, lanterns, quests, a road hero);
- map teasers (fog, ghost landmarks, a first-flight quest, zoom to home, postcard teasers, a Ming guide);
- back-paying level coins;
- progress counts on Library tiles.

**Journey rules:**
- Each next province is random and stays a secret until you land.
- The next stop shows only its category, and never hints at a souvenir.
- Price ladder: 0, 50, 100, 200, 300, 400, then 500 per stop.
- Theme: "Illustrated Adventure". Real photos on postcards (now on a cork-board wall), and the passport book and Food feast room as they are.
- About 2,000 stops. Food matters most to Alvin.

**Coins:**

| What | Pays |
|---|---|
| Path word stop | 10 (the first session: 50) |
| Review card | 2–5 |
| Review > Test | 3–4 |
| Grammar | 10–18 (keep as is) |
| Games | 3–4 a card, +10 for a perfect round |
| Level exam pass | 5,000 once |
| Treasure chest | 50 / 100 / 200 / 500 at 40 / 30 / 20 / 10% |
| Souvenir set | 100 once |

**Home:**
- Keep the HSK level / streak / coins row.
- Today's plan has 1–4 Path steps.
- No Home redesign that takes attention from the tasks.

**Content:**
- Word levels come from the site's own lists.
- No 儿 forms in the plain style.
- Everything is checked by Alvin pasting review packs into DeepSeek or Qwen. CLAUDE.md has the workflow. DeepSeek's level claims are usually wrong (HSK 2.0).
- No teacher has read any content.

**Audio:**
- All recorded in Qwen longanhuan: neutral, textbook style.

**Working with Alvin:**
- Casual tone. Say plainly when you're unsure rather than guessing confidently.
- Work token-efficiently, without cutting corners on accuracy.
- Update the handoff only when he asks.
- For visual work, ask one scoping question first, then screenshot only the changed view.
- **Always commit and push to `main`** (his standing rule since 26 Nov): finished, checked work goes straight to `main` without asking. Run the smallest check that covers the change first, because a push deploys. If the session can't push, ask him to say "attach the repo with push access" in the chat.

---

## 5. Things to check on the real iPhone
- **Say it (tone feedback):** does it accept tones you say right, and does the microphone start? Only tested with Chromium's fake microphone and synthetic voices.
- **The postcard wall:** how the board, pins and tape look, and turning a card over on a small phone.
- **Speaking scenes:** the choice of what to say and the Good day / Bad day switch.
- How the travel sounds feel and how loud they are (volumes were guessed), and whether the icon flying to its tab is noticeable.
- Shadowing with a real microphone.
- The quick sort swipe and the thumb-zone quiz buttons.
- Game coin rates, timed in real play.

## 6. Practical notes for a new session
- **Clone without audio** (about 270 MB) when you don't need it: `git clone --filter=blob:none --sparse <repo>`, then `git sparse-checkout set --no-cone '/*' '!/audio/'`. Without `audio/`, `tools/test-audio.js`, `smoke-test-audio.js` and `tools/eval-pitch.js` don't work locally. That's expected; CI runs the tests.
- **Before running browser tests:**
  - `pip install --break-system-packages pypinyin jieba`. If jieba's wheel fails to build, `pip download --no-binary jieba jieba` and copy its `jieba/` folder into site-packages;
  - `cd worker && npm install` for the friends test;
  - Playwright with Chromium (pre-installed in cloud sessions).
- **After any site change:** `node tools/build-site.js`, then the smallest check. `sh tools/check-quick.sh ui` can take over 30 minutes, so run it in the background with a long timeout.
- **Recording audio:** dispatch `audio.yml` one level at a time (`scope=all`, `level=N`, ref `main`) and wait for each run. Dry run first: `python3 -W ignore tools/make-audio.py --scope all --level N --dry-run`.
- **Review packs** for new content: `tools/make-review-parts.py` (colour cuts, look-alikes), `tools/make-review-additions.py <git ref before the additions>` (exam items, speaking scenes), `tools/make-review-unseen.py 3` (next unseen round). Packs go in `review/chinese-ai-new-items/`.
- **Where the code lives** (app.js unless noted):
  - first visit: `onbStartPath`, `obGuideShow`; quick sort: `qsOpen` / `qsVals`;
  - Journey finds: `jyFinds` / `jyLand` / `jyFlyFinds`; status tiers: `FF_TIERS`; sets: `SV_SETS`; toast holding: `msBusy`;
  - packed save: `JY.pack` / `JY.unpack` in journey.js, `jyRead` / `jySave` in app.js; the secret next region: `secret` / `VR`;
  - postcard wall: `jyCards` (tilt `rot`, nudge `dx`/`dy`, `pin`), styles under "postcards: a cork board" in styles.css;
  - wrong answers: `confusers(zh)`, `content/look-alikes.tsv` → `tools/build-confusers.py` → `data/confusers.js`;
  - exam retakes: `freshOrder` / `pickF` / `pickTFF` / `exRemember`, person pref `exseen`;
  - speaking choices and bad days: `SCEN_LIST`, `BAD_OF`, `scnPick`, `scnLine`, state `salt`;
  - tone feedback: `pitch.js` (`analyse`, `judge`), `sayStart` / `sayJudge` / `sayModel` and `sayView` in app.js; tests `tools/test-pitch.js`, `smoke-test-say-tones.js`;
  - audio file names: `audiolist.js`; late data: `ShanluData.load`, `app.lateReady()`.
- **Questions waiting on a Chinese teacher:** is the 不 in A-not-A questions read bú or bu? And the 增 card.
