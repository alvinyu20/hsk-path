#!/usr/bin/env python3
"""Builds ready-to-upload review packs for a Chinese AI model for HSK 4 (review/chinese-ai-hsk4/*.md) from what the learner sees (plain style).
Run:  node tools/dump-sentences.js 4 --plain > /tmp/p4.json && python3 tools/make-ai-review-pack-l4.py /tmp/p4.json
Pack order: word list and glosses, grammar lessons, sentences in batches, word webs, the mock exam, practice scripts and clips,
the meanings shown under each character ("Built from"), then the 24 solar terms of the Learn path.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-hsk4')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.md'):
        os.remove(os.path.join(OUT, f))
items = json.load(open(sys.argv[1], encoding='utf-8'))


def node_json(expr, files=None):
    # the data is loaded and then switched to the plain style (no 儿 endings), exactly as the default site shows it
    files = files or ['words', 'grammar', 'webs', 'listen', 'speak', 'exam']
    code = ("global.window={};const R=process.argv[1];" + json.dumps(files) + ".forEach(n=>require(R+'/data/hsk4-'+n+'.js'));"
            "require(R+'/data/hsk1-erhua.js');require(R+'/erhua.js').make(window.HSK1_ERHUA).apply(window);console.log(JSON.stringify(" + expr + "))")
    return json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())


HEAD = """你好！我正在做一个 HSK 4 学习网站（学习者已学过 HSK 1、2、3 的约 1000 个词，现在学 HSK 4 的 990 个新词，总共约 2000 个词）。请你以中国母语者和汉语老师的身份，检查下面的内容。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的内容。对每个问题，请写：编号 / 原文 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（只用 HSK 1 到 HSK 4 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教（或口语被当成书面语）；5) 对 HSK 4 来说太难的词；6) 多音字和轻声的拼音是否正确。
如果某一部分全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK 4 study site (learners know the ~1,000 words of HSK 1 to 3 and are now learning the 990 new HSK 4 words, about 2,000 in all). Please act as a native speaker and Chinese teacher and check the items below.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (using only HSK 1 to 4 words).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken (or the reverse); 5) words too hard for HSK 4; 6) wrong pinyin for words with more than one reading and for neutral tones.
If a part has no problems, answer "No problems found".

---

"""


ERHUA = []
for line in open(os.path.join(ROOT, 'content', 'erhua.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        cols = line.rstrip('\n').split('\t')
        ERHUA.append((cols[0], cols[1]))


def write(name, body):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)


def head(what):
    return HEAD.replace('检查下面的内容', what)


files = []

# 1. the word list and glosses
words = node_json('window.HSK4_WORDS.map(w=>({zh:w.zh,py:w.py,pos:w.pos,en:w.en,note:w.note||""}))')
lines = []
for i, w in enumerate(words, 1):
    lines.append('%d. %s | %s | %s | %s%s' % (i, w['zh'], w['py'], w['pos'], w['en'], (' | note: ' + w['note']) if w['note'] else ''))
TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńň'
# a word with fewer tone marks than Chinese characters has a neutral-tone syllable (the pinyin is written solid, so syllables are counted by tone marks)
neutral = [w['zh'] + ' ' + w['py'] for w in words if '/' not in w['py'] and sum(c in TONED for c in w['py']) < len(re.findall('[一-鿿]', w['zh']))]
ask = """
Extra questions for this part:
A. The site has %d cards. The November 2025 HSK 3.0 syllabus has 1,000 entries at band 4. Ten of them reuse a headword from an earlier level with a different sense or reading (重, 空, 生, 啊, 等, 干, 两, 为, 着, 种); those are taught in one lesson about words you know with a new meaning, not as separate cards. Is that how band 4 is built? Which band-4 words do you think are missing from the list below, and which words below do not belong at band 4?
B. For each word, is the pinyin right for the meaning given? Look especially at words with more than one reading or where a dictionary program guesses wrong: 量 (liáng "to measure" and liàng "quantity"), 背 (bēi "to carry on the back" and bèi "the back"), 待 (dāi "to stay" and dài "to treat"), 肚子 (dùzi), 大夫 (dàifu), 只 (zhī / zhǐ), 好 (hǎo / hào), 应 (yīng / yìng), 血 (xiě in speech, xuè in writing), 弹 (tán / dàn), 相 (xiāng / xiàng), 降 (jiàng / xiáng), 差 (chà / chā), 行 (xíng / háng), 空 (kōng / kòng), 有空 and 没空 (yǒu kòng, méi kòng), 种 (zhǒng / zhòng), 为 (wéi / wèi), 着 (zhe / zháo / zhuó), 重 (zhòng / chóng), 干 (gān / gàn), 还 (hái / huán), 数, 教, 调, 角, 假, 号.
C. Neutral tones: the site follows the dictionary. These HSK 4 words are shown with at least one neutral-tone syllable: %s. Please say which you would show differently for a beginner (for example where northern and southern speakers differ).
D. The site writes 差点 and 干活 without 儿 by default (and as 差点儿 and 干活儿, as the syllabus prints them, when a switch is on). Is that how you would write them in plain Mandarin text? 儿童 keeps its 儿 in both styles, because there it means "child".
E. 嗯 is shown as ń (the pronunciation many dictionaries give for the "uh-huh" sound); the syllabus prints ǹg or ńg. Which is better for a learner?
F. Glosses I am least sure of: 恐怕 (I am afraid that), 难道 (can it be that), 竟然 (unexpectedly), 究竟 (exactly; on earth), 毕竟, 本来 and 原来, 顺便, 稍微, 偶尔, 尽管, 以及, 否则, 于是, 与其, 甚至, 何况, 从而, 相当, 尤其, 实在. Is each gloss right, and is the part of speech right?
""" % (len(words), ', '.join(neutral))
write('01-word-list.md', head('检查下面的 HSK 4 词表（拼音、词性、英文解释）') + 'Words (word | pinyin | part of speech | English):\n\n' + '\n'.join(lines) + '\n' + ask)
files.append(('01-word-list.md', 'the %d words: pinyin, glosses, notes, the official-list question, neutral tones' % len(words)))

# 2. grammar lessons
lessons = node_json('window.HSK4_GRAMMAR.lessons')
outline = [l.strip() for l in open(os.path.join(ROOT, 'content', 'l4', 'grammar-outline.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
g = []
for i, L in enumerate(lessons, 1):
    g.append('### Lesson %d: %s' % (i, L['title']))
    for e in L['explain']:
        g.append('- ' + e)
    for m in L['mistakes']:
        g.append('- (common mistake) ' + m)
    for e in L['examples']:
        g.append('- example: %s / %s' % (e['zh'], e['en']))
    g.append('')
claims = """
Specific claims to check (the ones I am least sure of; say right or wrong, with a counter-example if wrong):
1. 连…也 / 都…: "他连我的名字都不知道", "他连水都不喝". Is 连 + noun + 都/也 explained correctly, and is 甚至 correctly taught as a separate way to say "even"?
2. 即使…也… and 尽管…: "即使下雨，我也要去" (even if, not yet true) versus "尽管很累，他还是来了" (although, already true). Is the difference between 即使 and 尽管 right?
3. 不管 / 无论…都…: "不管天气怎么样，我都去", "无论你去不去，我都去". Is 不管 colloquial and 无论 more written, as taught? Must the clause before 都 contain a question word or an A-or-B pair?
4. 要是…就… (spoken) and 既然…就… ("since, now that"): "既然你不舒服，就早点休息吧". Right?
5. 否则 and 由于…因此… and 于是: is 否则 always followed by a result, and are 由于 and 因此 written-style words taught as such? Is 于是 ("so, and then") explained correctly?
6. 然而, 不过, 并且, 而: is the register right (然而 = written "however", 不过 = spoken "but")? Is "并且" = "and also" right when it joins two verbs or adjectives?
7. 既…又… and 不是…而是…: "他既聪明又努力", "不是我不想去，而是我没有时间".
8. 首先…其次…, 另外, 例如, 同时: any wrong or unnatural examples? Is 同时 taught correctly as "at the same time" and "also"?
9. 不得不, 来不及, 赶快: "我不得不早点走", "来不及了". Is 不得不 ("have no choice but to") right? Is 来不及 followed by a verb ("来不及吃饭") taught correctly?
10. 难道…吗, 到底, 究竟: "难道你不知道吗？", "你到底想去哪儿？". Is 难道 + 吗 (a rhetorical question) correct? Are 到底 and 究竟 equally natural in speech?
11. 竟然, 原来, 本来: "他竟然忘了我的生日" (surprise), "原来你在这儿" (discovery), "我本来想去，可是太累了" (originally). Right?
12. 确实, 实在, 完全, 十分: "确实" (indeed), "实在" (really, truly, often with a complaint), "完全" (completely), "十分" (very, a little formal). Are the registers right?
13. 从来, 并, 往往: "我从来没去过", "我并不累" (并 before a negative), "他往往很早起床" (tends to). Is "从来" only used with a negative, or can it be used in the positive ("他从来都很准时")? Is the grammar right?
14. 偶尔, 不断, 老是, 差点儿: "我昨天差点儿迟到" (and I was NOT late). Is it right that 差点儿 + a bad thing that did not happen means "nearly"? Is "老是" a spoken word with a complaint?
15. 至少, 左右, 大约, 尤其, 其中: "至少三个小时", "三十岁左右", "大约五点". Is 左右 correctly placed after the number?
16. 也许, 恐怕, 估计, 肯定, 千万, 无法: "你千万别忘了" (be sure not to), "我无法回答" (formal). Is 千万 used only with a command or a warning?
17. 仍然, 重新, 继续, 最终: are 仍然 and 还 distinguished correctly? Is 重新 "start again from the beginning" explained right?
18. 稍微, 有点儿, 多么, 却, 倒: "请稍微等一下", "这个菜有点儿辣", "多么漂亮啊！", "他很累，却还在工作", "这个办法倒不错". Is each use natural, especially 倒 (a mild contrast or concession)?
19. 更加, 不如, 相同, 同样: "他不如我高" and "这两个办法同样好". Right?
20. 对于, 对…来说, 通过, 随着: "对我来说", "通过努力", "随着时间的过去". Is the difference between 对于 and 对…来说 right?
21. 按照, 作为, 与…相比, 使: "按照规定", "作为学生", "与去年相比", "这件事使我很高兴". Right?
22. 一…就… and 任何 / 随便: "他一下课就去打篮球", "任何人都可以来", "你随便坐". Is "一…就…" correct for both "as soon as" and "whenever"?
23. 所有, 各, 一切, 许多, 大量, 部分, 全部, 整个: are the nuances (所有 = every, 整个 = the whole, 各 = each) right?
24. 有的…有的…, 互相, 共同: "有的人喜欢…，有的人喜欢…" Right?
25. 之前, 之后, 之间, 当时, 从此, 接着: is each placement right ("两个人之间", "从此以后")?
26. 说明, 表示, 成为: "这个数字说明了问题", "他表示同意", "他成为了医生". Is 表示 correctly taught for both "to show/express" and "to say (formal)"?
27. The lesson "Words you know, with a new meaning" teaches second senses of 重 (chóng again), 空 (kòng free time), 生 (raw; give birth), 啊, 等, 干, 两, 为, 着, 种. Are the second senses and their pinyin right and the ones a learner meets first?
28. Missing grammar: below is my own list of %d grammar points for HSK 4 (the official numbered list was not available to me). Which important HSK 4 grammar points are missing? Which of mine belong to another level? If you know the official HSK 3.0 level-4 grammar outline (November 2025 syllabus), say how it differs.
""" % len(outline) + '\n'.join('   %d. %s' % (i, o) for i, o in enumerate(outline, 1)) + '\n'
write('02-grammar-explanations.md', head('检查下面的语法课（解释、常见错误、例句）') + 'Lessons:\n\n' + '\n'.join(g) + claims)
files.append(('02-grammar-explanations.md', 'the %d grammar lessons, the claims I am least sure of, and the grammar outline question' % len(lessons)))

# 3. sentences in batches (everything with Chinese and English that the learner sees, except the mock exam which has its own pack)
sent, seen = [], set()
for it in items:
    w = it['where']
    if w.startswith('exam:') or w.startswith('wordform:') or it.get('levelOnly') or it.get('fragment') or not it.get('en'):
        continue
    key = (it['zh'].strip(), it['en'].strip())
    if key in seen:
        continue
    seen.add(key)
    sent.append(key)
BATCH = 220
batches = [sent[i:i + BATCH] for i in range(0, len(sent), BATCH)]
for n, b in enumerate(batches, 1):
    name = '%02d-sentences-%d-of-%d.md' % (n + 2, n, len(batches))
    write(name, head('检查下面的句子') + 'Sentences (Chinese / English):\n\n' + '\n'.join('%d. %s  /  %s' % (i + 1, zh, en) for i, (zh, en) in enumerate(b)) + '\n')
    files.append((name, '%d example, exercise, dialogue and listening sentences' % len(b)))

# 4. word webs
webs = node_json('window.HSK4_WEBS')
w = []
for h in webs['hubs']:
    w.append('### Shared character %s (%s): %s' % (h['hub'], h['py'], h['en']))
    for x in h['words']:
        w.append('- %s = %s' % (x['zh'], ' + '.join('%s (%s)' % (p[0], p[1]) for p in x['parts'])))
    w.append('')
w.append('### Pairs and opposites')
for o in webs['opps']:
    w.append('- %s / %s: %s' % (o['a'], o['b'], o['note']))
w.append('')
w.append('### Topics (words grouped for learning)')
for t in webs['topics']:
    w.append('- %s: %s' % (t['name'], ' '.join(t['words'])))
name = '%02d-word-webs.md' % (len(batches) + 3)
write(name, head('检查下面的“词网”内容（字的意思、反义词、主题分组）')
      + 'Also check: is each part meaning (for example 机 = machine inside 耳机, 关机, 司机) right and not misleading? Does each opposite-pair note say something true? Is any word grouped in a topic where it does not belong? I am least sure of the big topics "Everyday actions" and "Feelings" (they hold many words), and of where 经济, 社会, 文化 and 艺术 should go.\n\n' + '\n'.join(w) + '\n')
files.append((name, 'character meanings inside words, the opposite pairs and notes, the topic groups'))

# 5. the mock exam
lb = json.load(open(os.path.join(ROOT, 'content', 'l4', 'exam-4-listening.json'), encoding='utf-8'))
rb = json.load(open(os.path.join(ROOT, 'content', 'l4', 'exam-4-reading.json'), encoding='utf-8'))
wb = json.load(open(os.path.join(ROOT, 'content', 'l4', 'exam-4-writing.json'), encoding='utf-8'))
ex = []


def says(lines):
    """The spoken lines with who says them (男 = the man, 女 = the woman), so a question like 男的为什么没吃饭？ can be checked."""
    return ' / '.join(('%s：%s' % (l['s'], l['zh'])) if l.get('s') else l['zh'] for l in lines)


ex.append('## Listening part 1 (true or false): a passage is spoken, then a printed sentence is shown')
for st in lb['L1']:
    ex.append('- 短文“%s” 说法“%s” → %s' % (says(st['say']), st['st'][0], '正确' if st['ok'] else '错误'))
ex.append('\n## Listening part 2 (short dialogue, question, four options; the FIRST option listed is the right one)')
for st in lb['L2']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Listening part 3 (longer dialogue, question, four options; the FIRST option listed is the right one)')
for st in lb['L3']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Reading part 1 (fill the blank with one of six words; each set has several blanks)')
for si, st in enumerate(rb['R1'], 1):
    ex.append('Set %d words: %s' % (si, ' '.join(o for o in st['opts'])))
    for it in st['items']:
        ex.append('- “%s” → %s' % (it['zh'], st['opts'][it['ans']]))
ex.append('\n## Reading part 2 (put three pieces in order; the pieces are listed in the right order)')
for st in rb['R2']:
    ex.append('- %s' % ' / '.join(st['words']))
ex.append('\n## Reading part 3 (passage, question, four options; the FIRST option listed is the right one)')
for st in rb['R3']:
    ex.append('- 短文“%s” 问题“%s” 选项：%s' % (st['zh'], st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Writing practice 1 (put the words in order; every accepted order is listed)')
for it in wb['W1']:
    ex.append('- 词：%s → %s%s' % (' '.join(it['words']), ''.join(it['words']), ('；也接受：' + '；'.join(''.join(a) for a in it['alts'])) if it.get('alts') else ''))
ex.append('\n## Writing practice 2 (type the missing character)')
for it in wb['W2']:
    ex.append('- “%s” → %s' % (it['zh'], it['ans']))
name = '%02d-exam.md' % (len(batches) + 4)
write(name, head('检查下面的考试题（听力、阅读和写作练习）')
      + 'Besides the usual checks, please say: (1) whether any "true / false" statement is ambiguous or both true and false; (2) whether every multiple-choice question has exactly ONE right answer and three clearly wrong ones (name any question where a second option could also be right); (3) whether the three pieces of each reading "put in order" item have only one natural order (list any item with a second natural order that the site marks wrong); (4) whether each blank in reading part 1 has only one word that fits among the six; (5) whether the writing items accept every natural order. '
      + 'Note: the layout (listening 10 + 15 + 20, reading 10 + 10 + 20, writing practice 10 + 5) follows the 2012 sample papers; I could not find the 2025 layout. If you know it, please say how it differs. The site has no picture questions at HSK 4.\n\n' + '\n'.join(ex) + '\n')
files.append((name, 'the mock exam: true/false, dialogues, blanks, ordering, passages and the writing practice'))

# 6. the pieces that need a native ear
sp = node_json('window.HSK4_SPEAK')
ls = node_json('window.HSK4_LISTEN')
n = []
n.append('## Practice scripts (8 conversations the learner reads aloud)')
for sc in sp['scenarios']:
    n.append('### %s (%s)' % (sc['title'], sc['sub']))
    for k, turn in enumerate(sc['ai']):
        n.append('- 对方：%s  /  %s' % (turn['zh'], turn['en']))
        if k < len(sc['you']):
            n.append('- 学习者：%s  /  %s' % (sc['you'][k]['zh'], sc['you'][k]['en']))
n.append('\n## Useful phrases')
for ph in sp.get('phrases', []):
    n.append('- %s  /  %s' % (ph.get('zh', ''), ph.get('en', '')))
n.append('\n## Listening clips: the passage, the English and the "what to listen for" notes')
for c in ls['clips']:
    n.append('- %s  /  %s' % (c['zh'], c['en']))
    for t in c.get('notes', []):
        n.append('    note: %s' % (t if isinstance(t, str) else t.get('t', '')))
name = '%02d-scripts-and-clips.md' % (len(batches) + 5)
write(name, head('检查下面的练习对话、常用句和听力短文') + 'Also check: do the practice conversations sound like something people really say (a job interview, renting a flat, sending a parcel, saying sorry for being late, booking a table, a visa office, a coach, cheering up a friend)? Would a native speaker reply in these words? Are the "what to listen for" notes true?\n\n' + '\n'.join(n) + '\n')
files.append((name, 'the 8 practice conversations, the phrases, the 24 listening clips and their notes'))

# 7. the meanings under each character ("Built from"): AI-written, one short gloss per character that is not a word of its own yet
gl = {}
for line in open(os.path.join(ROOT, 'content', 'char-glosses.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        c, _, m = line.rstrip('\n').partition('\t')
        gl[c] = m
w4 = node_json('window.HSK4_WORDS.map(w=>w.zh)', ['words'])
old = set()
for lv in (1, 2, 3):
    code = "global.window={};require(process.argv[1]+'/data/hsk%d-words.js');console.log(JSON.stringify(window.HSK%d_WORDS.map(w=>w.zh)))" % (lv, lv)
    for z in json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode()):
        old.update(z)
seen_chars, rows = set(), []
for z in w4:
    for ch in z:
        if ch in gl and ch not in old and ch not in seen_chars and len(z) > 1:
            seen_chars.add(ch)
            rows.append('%s | %s | in %s' % (ch, gl[ch], z))
name = '%02d-character-meanings.md' % (len(batches) + 6)
write(name, head('检查下面单个汉字的简短英文解释')
      + 'The site shows a short meaning under each character of a word ("Built from"), for characters that are not words of their own at the learner\'s level. Each line is: character | the short meaning I wrote | the HSK 4 word where it first appears. Is each short meaning (a) a real meaning of this character and (b) the meaning it has in the word shown (not a different, rarer meaning)? Where a character only exists inside one word (葡 and 萄 in 葡萄, 乒 and 乓 in 乒乓球, 胳 and 膊 in 胳膊, 垃 and 圾 in 垃圾, 钥 and 匙 in 钥匙) I wrote "(in …)": is that the right way to say it?\n\n' + '\n'.join(rows) + '\n')
files.append((name, 'the %d short character meanings shown under words ("Built from")' % len(rows)))

# 8. the Learn path of HSK 4: 24 solar terms
pth = None
code = ("global.window={};require(process.argv[1]+'/data/path.js');console.log(JSON.stringify(window.SHANLU_PATH[4]))")
pth = json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())
th = pth['theme']
t = []
t.append('The HSK 4 Learn path is a year told through the 24 solar terms (节气), one term for each unit. The term names are real; the dates are the usual ones (they can move by a day); the short story line for each unit is mine.')
t.append('')
t.append('Path title: %s | tag: %s | blurb: %s' % (th['name'], th['tag'], th['blurb']))
for gp in th['groups']:
    t.append('Season %s: %s · %s — %s' % (gp['zh'], gp['title'], gp['sub'], gp.get('line', '')))
t.append('')
t.append('Each line: number | term (characters, pinyin, English meaning, usual date) | unit title | the line the learner reads | what the unit teaches')
for i, u in enumerate(pth['units'], 1):
    e = th['units'][u['id']]
    t.append('%d | %s %s · %s · c. %s | %s | %s | %s' % (i, e['zh'], e['py'], e['en'], e['date'], u['title'], e['scene'], u['blurb']))
name = '%02d-solar-terms-path.md' % (len(batches) + 7)
write(name, head('检查下面的二十四节气和学习路径文字')
      + 'Please check: (1) the 24 term names, their order and their usual dates (which of my dates are more than one day off?); (2) the pinyin and the English meaning of each term (is "Grain rain", "Grain fills", "Grain in ear" the usual way to say 谷雨, 小满, 芒种 in English?); (3) whether the one-line story for each term is true to the season in China (for example what people eat or do) and not misleading; (4) whether anything is culturally wrong or awkward.\n\n' + '\n'.join(t) + '\n')
files.append((name, 'the 24 solar terms of the Learn path: names, pinyin, English, dates and the season lines'))

readme = """# Review packs for a Chinese AI model: HSK 4

Each file is ready to UPLOAD (they are too long to paste): open DeepSeek (chat.deepseek.com) and/or Qwen Chat (chat.qwen.ai), start a **new chat for each file**, attach the file, and send this message: "Please read the attached file and do what it asks." Then paste the answer back to Claude.
Each file asks the model to report **problems only**, so the answers stay short. Where two models disagree, that item goes to a human teacher.
Nothing on the HSK 4 side has been checked by a person who reads Chinese; these packs are how that gets done. (The Alibaba questions are in `review/chinese-ai-hsk2/`; they do not depend on the level.)

| File | What it checks |
|---|---|
""" + '\n'.join('| %s | %s |' % f for f in files) + '\n'
write('00-README.md', readme)
print('wrote %d files to review/chinese-ai-hsk4 (%d distinct sentences in %d batches)' % (len(files) + 1, len(sent), len(batches)))
