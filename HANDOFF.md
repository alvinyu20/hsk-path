# Handoff: 23 Nov 2026

This is for the next agent working on Shanlu (this repo). It covers what's built, what's still open, and what Alvin has already decided.

- **Read `CLAUDE.md` first.** It has the file map, commands, content formats and traps.
- The detailed history is in Alvin's claude.ai Project docs (`claude/session-*.md`, the 20 Nov site review, the 21 Nov brainstorm). You may not be able to read those. This file has what you need from them.

**Latest commit:** b3fdb2a0. CI is green, but one friends test needed a re-run (see Known warts).

---

## 1. Where things stand
- **Live** on GitHub Pages from `main`. A push to `main` deploys.
- **Content:** HSK 1–5 are open. HSK 6 hasn't been started.
- **Sections:**
  - Today (Home) with Today's plan and the mountain trail;
  - Learn: the Path (lessons), the Library and Games;
  - Review: words, grammar and the Test;
  - Talk: listening, speaking and AI chat;
  - Journey: Explore, Map, Passport, Souvenirs, Postcards, Food.
- **Behind it:** friends and sync through a Cloudflare Worker (`worker/`). Recorded audio in `audio/` (Qwen voice longanhuan). An optional AI relay for friends.
- **Nothing is half-finished.**

### Built in the last few sessions (21–23 Nov)
- **First session:** it's the first Path stop. Home has one red "Start my first stop" button, which opens that stop's card on the Path. The stop pays 50 coins, enough for the next Journey stop.
- **Sounds course:** brand-new people get it on the Start card and as a Today's plan row, until it's finished.
- **Host box:** the first flight lands with your host waving, with 你好 to hear. The guide cards wait until that page is closed.
- **Quick sort:** "I know a little" opens it, and Settings > Level has it next to Check my level.
  - Up to 30 words, Know it / Not yet.
  - Every 4th "Know it" gets a meaning check.
  - Known Path stops count as done.
- **Session score:** a session of only new words now counts them in "right first time". It used to show 0%.
- **Journey finds:** each find has a button to where it went: table, wall, passport or shelf. It arrives there with an animation. NEW tags and tab dots stay until you look, and icons fly to their tab.
- **Rarer reveals:** a must-see turns gold and flips slowly. A souvenir gets its own beat.
- **Travel sounds:** plane, train or footsteps, then a sound of the place, then the stamp.
- **Shanlu Air status:** Bronze 0, Silver 3, Gold 8, Platinum 15 regions. It shows on boarding passes, the passport cover and the region pop-up.
- **Next region is a secret** until you land ("Somewhere new").
- **Postcards** carry a postmark with the day you were there.
- **12 souvenir sets:** 100 coins once per finished set.
- **Packed Journey save:** about 5× smaller.
- **Achievement toasts wait** while modals, the travel moment, a new stop page or the region pop-up are up.
- **Review > Test pays 3 a right answer** (4 from the third in a row). It used to pay the grammar rate.

---

## 2. Open items
Effort: **S** < 1 h, **M** = one session, **L** = several. ⬜ not started, 🟡 partly done.

Alvin picks what comes next. **Don't start big items unprompted.** Ask which one, and ask one scoping question before visual work.

### Bugs and small fixes
| # | Item | Effort |
|---|---|---|
| W1 | **Friends CI test is flaky:** `smoke-test-friends.js` "coins earned in the All-levels view reach the same person's other device" failed once in CI and passed on re-run. Probably a race between `friendsProgressSync()` calls; make the test wait for the sync to finish. | S |
| W2 | **No "you" marker on the country map in small regions:** Hong Kong / Macau (maybe Singapore) show no `.jy-me` marker. Seen in a test, not looked into: the region has no `cc`/`cd` point in the map data. Check whether that's intended. | S |
| W3 | **Path group header count:** a header like "Morning · Arrive" still says "4 units" while 3 are folded into "✓ 3 units done". | S |
| N5 | **Day-one Home zeros:** hide "Your memory" until there's at least one word in memory. It shows 0 / 0% / 0 min on day one. | S |
| X14 | **Small-region finish:** finishing Hong Kong / Macau / Singapore: "See it on the map" lands where the region is only a small button. Make its fill and bounce visible. | S |

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
| J9 | **Send a postcard:** send a friend a postcard with a one-line message (templates, or AI-checked). Uses the Worker. | M |
| J10 | **Pace line on Explore:** "Hainan stamped around [date] at your pace". | S |
| J13 | **Friend meet-ups:** a meet-up stop when two friends are in the same region. | M |
| J14 / F6 | **Festival stops and events** tied to real dates (Spring Festival is early 2027; check the date). | M each |
| F3 | **"Order it" at dishes:** a 30-second mini-dialogue at Feast dishes. | M |
| D3 | **Graded reading on postcards:** 3–5 sentences at the reader's level, tap for meanings. Pilot with the 52 Hainan stops. | L |
| J2 | **A small Chinese moment per stop:** a check-in question, a level-matched "Say it there", known characters lit up in names, add a stop's word to Review. Low priority now. | S–M each |

### Speed and infrastructure
| # | Item | Effort |
|---|---|---|
| B1 | **Audio manifest:** `data/audio-manifest.js` (about 1 MB) loads at start-up. Work the file names out in the browser (`sha1(text)[:14].mp3`) instead. | S–M |
| B2 | **Lazy-load the big data files:** Journey, Feast, speak scenes, passages, path scenes and exam art (about 1 MB+ of JS) load at start-up. Load them when their screen opens. Newcomers land on the Journey first, so its data stays early for them. | M |
| B3 | **Render only the open screen:** every tap rebuilds every screen's values (`renderVals`). Compute only the open screen's values and cache derived numbers. | M |
| B4 | **Move the audio before HSK 6:** move `audio/` (about 270 MB) off GitHub Pages before HSK 6 (1 GB limit), e.g. Cloudflare R2. | M |
| B5 | **Keep the full review log:** only the newest 800 answers are kept. Add an append-only table in the Worker's D1 database. This unlocks D6. | M |
| B6 | **Run tests in WebKit (Safari):** run the smoke tests in WebKit in CI, plus screenshot comparisons. | M |
| B7 | **Split `app.js`** into ES modules. Low urgency. | L |

### Learning
| # | Item | Effort |
|---|---|---|
| D4 | **Smarter wrong answers:** same-meaning partners, look-alike characters (已/己, 买/卖), sound-alikes. Today they come from the same stop. | S–M |
| D5 | **Pinyin that fades:** hide pinyin on "what does it mean" after the first meeting, with a tap to peek. | S |
| D7 | **Leech words** (4+ lapses): a contrast card, an extra example, the mistake notebook. | M |
| D6 | **Review schedule fitted to the person (FSRS).** Needs B5. | M–L |
| D9 | **English → Chinese sentence building**, AI-checked strictly. | M |
| D2 | **Tone feedback from a pitch curve**, in the browser. | L |
| D1 🟡 | **Listening ladder, the rest:** background noise, more voices, Common Voice clips, natural reductions. Speed rungs, shadowing and Quick-fire numbers are done. | M each |
| C4 🟡 | **More coloured grammar examples:** only 60 are hand-cut in `content/example-parts.tsv`. Automatic cutting was tried and dropped as unreliable. | M |
| E1 | **Bigger exam banks**, with unseen items first on retakes. | M–L |
| E3 | **More speaking scenes:** branching and "bad day" versions. | M–L |
| E4 | **2–3× more listening at HSK 4–5**, with longer passages. | M |
| E5 | **Older open items:** <br>• separate records for two-reading characters (还 / 行 / 得); <br>• same-meaning sweep round 2 (558 groups, ask first); <br>• Fill it beyond the classic pairs; <br>• a mistake notebook with spoken re-practice; <br>• real time-on-task; <br>• HSK 6. | mixed |
| Games | **Games follow-ups:** <br>• feed game misses into Review / Grammar review; <br>• recorded audio for game sentences (the browser voice reads them now); <br>• time real play on a phone to check coin rates. | S–M |

### Fun and coming back
| # | Item | Effort |
|---|---|---|
| F1 | **Phone reminders (Web Push)** through the Worker. iOS needs the Home Screen app. | M |
| F2 | **A role-play to finish each Path chapter.** | M–L |
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

## 3. Decisions to respect

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
- Theme: "Illustrated Adventure". Real photos on postcards, and the passport book and Food feast room as they are.
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
- Everything is checked by Alvin pasting review packs into DeepSeek or Qwen. CLAUDE.md has the workflow.
- No teacher has read any content.

**Audio:**
- All recorded in Qwen longanhuan: neutral, textbook style.

**Working with Alvin:**
- Casual tone. Say plainly when you're unsure rather than guessing confidently.
- Work token-efficiently, without cutting corners on accuracy.
- Update the handoff only when he asks.
- For visual work, ask one scoping question first, then screenshot only the changed view.

---

## 4. Things to check on the real iPhone
- How the travel sounds feel and how loud they are (volumes were guessed), and whether the icon flying to its tab is noticeable.
- Shadowing with a real microphone (only tested with Chromium's fake mic).
- The quick sort swipe.
- The thumb-zone quiz buttons.
- Game coin rates, timed in real play.
- After this update, an older open tab of the site may show an empty Journey until it reloads, because it can't read the packed save. Sync keeps the real progress.

## 5. Practical notes for a new session
- **Clone without audio** (about 270 MB) when you don't need it: `git clone --filter=blob:none --sparse <repo>`, then `git sparse-checkout set --no-cone '/*' '!/audio/'`. Without `audio/`, `tools/test-audio.js` and `smoke-test-audio.js` fail locally. That's expected; CI runs them.
- **Before running browser tests:**
  - `pip install --break-system-packages pypinyin jieba`;
  - `cd worker && npm install` for the friends test;
  - Playwright with Chromium.
- **After any site change:** `node tools/build-site.js`, then the smallest check (`sh tools/check-quick.sh ui`, etc.).
- **Where the new code lives** (all in app.js unless noted):
  - first visit: `onbStartPath`, `obGuideShow`;
  - quick sort: `qsOpen` / `qsVals`;
  - Journey finds: `jyFinds` / `jyLand` / `jyFlyFinds`;
  - status tiers: `FF_TIERS`;
  - sets: `SV_SETS`;
  - packed save: `JY.pack` / `JY.unpack` in journey.js, `jyRead` / `jySave` in app.js;
  - toast holding: `msBusy`;
  - travel sounds: `SFX` sounds plane / train / walk / stamp / gold / found / waves / wind / birds;
  - the secret next region: `secret` / `VR` in the Journey view.
- **Questions waiting on a Chinese teacher:** is the 不 in A-not-A questions read bú or bu? And the 增 card.
- **Next unseen DeepSeek round:** `python3 tools/make-review-unseen.py 3`.
