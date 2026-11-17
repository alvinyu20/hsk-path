#!/usr/bin/env python3
"""Builds ready-to-upload review packs for a Chinese AI model for HSK 5 (review/chinese-ai-hsk5/*.md) from what the learner sees (plain style).
Run:  node tools/dump-sentences.js 5 --plain > /tmp/p5.json && python3 tools/make-ai-review-pack-l5.py /tmp/p5.json
Pack order: word list and glosses, grammar lessons, sentences in batches, word webs, the mock exam, practice scripts and clips,
the meanings shown under each character ("Built from"), then the 39 stops of the Five Great Mountains path.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-hsk5')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.md'):
        os.remove(os.path.join(OUT, f))
items = json.load(open(sys.argv[1], encoding='utf-8'))


def node_json(expr, files=None, level=5):
    # the data is loaded and then switched to the plain style (no 儿 endings), exactly as the default site shows it
    files = files or ['words', 'grammar', 'webs', 'listen', 'speak', 'exam']
    code = ("global.window={};const R=process.argv[1];" + json.dumps(files) + ".forEach(n=>require(R+'/data/hsk" + str(level) + "-'+n+'.js'));"
            "require(R+'/data/hsk1-erhua.js');require(R+'/erhua.js').make(window.HSK1_ERHUA).apply(window);console.log(JSON.stringify(" + expr + "))")
    return json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())


HEAD = """你好！我正在做一个 HSK 5 学习网站（学习者已学过 HSK 1 到 4 的约 2000 个词，现在学 HSK 5 的约 1580 个新词）。请你以中国母语者和汉语老师的身份，检查下面的内容。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的内容。对每个问题，请写：编号 / 原文 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（只用 HSK 1 到 HSK 5 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教（或口语被当成书面语）；5) 对 HSK 5 来说太难的词；6) 多音字和轻声的拼音是否正确，词与词之间的空格是否合理（例如“每个人”写成 měi ge rén，“一个人”写成 yí ge rén，“天气预报”写成 tiānqì yùbào）；7) 一个词在句子里的意思是否和词表里给出的意思一致。
如果某一部分全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK 5 study site (learners know the ~2,000 words of HSK 1 to 4 and are now learning about 1,580 new HSK 5 words). Please act as a native speaker and Chinese teacher and check the items below.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (using only HSK 1 to 5 words).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken (or the reverse); 5) words too hard for HSK 5; 6) wrong pinyin for words with more than one reading and for neutral tones, and wrong spaces between words in the pinyin (měi ge rén, yí ge rén, tiānqì yùbào); 7) a word used in a sense different from the one the word list gives.
If a part has no problems, answer "No problems found".

---

"""


def write(name, body):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)


def head(what):
    return HEAD.replace('检查下面的内容', what)


files = []

# 1. the word list and glosses, in chunks small enough for one chat
words = node_json('window.HSK5_WORDS.map(w=>({zh:w.zh,py:w.py,pos:w.pos,en:w.en,note:w.note||""}))')
TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńň'
old = set()
for lv in (1, 2, 3, 4):
    old.update(node_json('window.HSK%d_WORDS.map(w=>w.zh)' % lv, ['words'], lv))
WCHUNK = 540
wchunks = [words[i:i + WCHUNK] for i in range(0, len(words), WCHUNK)]
for ci, chunk in enumerate(wchunks, 1):
    first = ci * 0 + (ci - 1) * WCHUNK
    lines = []
    for i, w in enumerate(chunk, first + 1):
        lines.append('%d. %s | %s | %s | %s%s' % (i, w['zh'], w['py'], w['pos'], w['en'], (' | note: ' + w['note']) if w['note'] else ''))
    # a word with fewer tone marks than Chinese characters has a neutral-tone syllable (the pinyin is written solid, so syllables are counted by tone marks)
    neutral = [w['zh'] + ' ' + w['py'] for w in chunk if '/' not in w['py'] and sum(c in TONED for c in w['py']) < len(re.findall('[一-鿿]', w['zh']))]
    recycled = [w['zh'] for w in chunk if w['zh'] in old]
    ask = """
Extra questions for this part:
A. The site has %d cards in all; this file holds cards %d to %d. Please say which of these look like the wrong level (too easy, so they belong to HSK 4 or lower, or too hard or too rare for a learner at this level).%s
B. For each word, is the pinyin right for the meaning given? Look especially at words with more than one reading or where a dictionary program guesses wrong: 重 (zhòng / chóng), 长 (cháng / zhǎng), 得 (de / dé / děi), 着 (zhe / zháo / zhuó), 觉, 假, 差, 调, 行, 会, 还, 只, 为, 都, 难, 率, 模, 薄, 角, 乐, 恶, 弹, 传, 供, 号, 降, 空, 量, 没, 省, 数, 载, 间, 咽.
C. Neutral tones: the site follows the dictionary. These words of this file are shown with at least one neutral-tone syllable: %s. Please say which you would show differently for a beginner (for example where northern and southern speakers differ).
D. The site writes 没法 without 儿 by default (and as 没法儿, as the syllabus prints it, when a switch is on). Is that how you would write it in plain Mandarin text?
E. The note under a word is a short usage hint. Please say which notes are wrong, misleading, or say that a word is "formal" or "casual" when you would not.
F. Glosses I am least sure of (if they are in this file): 毕竟, 到底 and 究竟, 未必, 不见得, 何必, 难怪, 怪不得, 以免, 免得, 以便, 何况, 况且, 反而, 不然 and 要不, 居然, 简直, 终于 and 总算, 迟早, 早晚, 偶然 and 偶尔, 往往, 通常, 与其, 宁可, 姑且, 固然, 势必, 未免, 无非, 恰好 and 恰巧.
""" % (len(words), first + 1, first + len(chunk),
       (' %d cards in this file reuse a headword that is also on an earlier level, with a different sense or reading (%s); the card says which sense is taught here.' % (len(recycled), ' '.join(recycled))) if recycled else '',
       ', '.join(neutral) if neutral else '(none)')
    name = '%02d-word-list-%d-of-%d.md' % (ci, ci, len(wchunks))
    write(name, head('检查下面的 HSK 5 词表（拼音、词性、英文解释）') + 'Words (word | pinyin | part of speech | English):\n\n' + '\n'.join(lines) + '\n' + ask)
    files.append((name, 'words %d to %d: pinyin, glosses, notes, level, neutral tones' % (first + 1, first + len(chunk))))
NW = len(wchunks)

# 2. grammar lessons
lessons = node_json('window.HSK5_GRAMMAR.lessons')
outline = [l.strip() for l in open(os.path.join(ROOT, 'content', 'l5', 'grammar-outline.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
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
1. 一旦…就… ("once, as soon as it happens, then"), 因而 and 从而: is 一旦 always about something that may happen (often something undesirable), and are 因而 ("so, therefore") and 从而 ("and so, thereby", followed by the result of an action) separated correctly?
2. 或是…或是…, …也好…也好…, 加上: "喝茶也好，喝咖啡也好，我都可以". Is "…也好…也好" (whether … or …) followed by 都 or 总, and is 加上 ("plus, on top of that") correct as a link between two reasons?
3. 再…也… ("however … still") and 没有…就没有…: "再难也要坚持", "没有你的帮助，就没有今天的我". Is 再…也… correct for a hypothetical "however hard", and is the second pattern natural as taught?
4. 为的是, 以便, 以…为…: is 为的是 placed after the action ("他每天跑步，为的是身体好一点") and is 以便 ("so that, in order to", written style) used for the second clause? Is "以…为…" (take X as Y: 以…为目标 / 以…为主) taught with natural examples?
5. 反而, 不然 and 要不, 毕竟: is 反而 ("instead, on the contrary") used only when the result is the opposite of what was expected? Are 不然 ("otherwise", after a statement) and 要不 (casual "or else / how about") separated correctly? Is 毕竟 ("after all") correct?
6. 果然, 居然, 似乎: "果然下雨了" (as expected), "他居然忘了" (unexpectedly), "他似乎有点累" (it seems). Is the difference between 果然 and 居然 right?
7. 从…来看, 拿…来说, 在…看来: are the three patterns separated correctly ("从这个角度来看", "拿我来说", "在我看来")? Are the examples natural?
8. 由此, 总之, 到…为止: "到今天为止", "由此可见". Right?
9. 凭, 依据, 靠 and 依靠: "凭什么？", "凭经验", "靠自己". Are the nuances right? Is 依据 only written style?
10. 将, 由 and 所…的 (formal written style): "他将书放在桌上" (将 as a formal 把), "这件事由他负责", "他所说的话". Is the explanation right that these are written, not spoken? Is "所…的" correct as "what someone … "?
11. 令, 使 and 让: "这个消息令人高兴", "使我很感动". Is 令 + person + feeling taught correctly as formal?
12. 彼此 and 如此: "我们彼此了解", "如此重要". Right?
13. 过于, 稍, 够…的, 可: "过于紧张", "稍大一点", "这个房间够大的", "这可不行". Is 够…的 (quite … enough, often with a feeling) correct, and is 可 (emphasis) used right?
14. 将要, 时常, 时刻, 立刻 and 立即: is 将要 ("about to") written style? Is 时刻 correct as "always, at every moment" (时刻准备着)? Are 立刻 and 立即 equally natural?
15. 渐渐, 始终, 连续: "天渐渐黑了", "他始终没有放弃", "连续三天". Right?
16. 再次, 随后, 此后, 先后, 陆续: "再次见面", "他随后也来了", "他们先后到了", "客人陆续来了". Is each placement right?
17. 简直, 绝对, 根本, 难以: "简直不敢相信", "绝对没问题", "根本没有", "难以相信". Is 根本 + negative correct as "not at all"?
18. 尽量, 尽力 and 万一: "尽量早点来", "他尽力了", "万一下雨怎么办？". Right?
19. 再也不 / 没 and 怎么都 / 也 + 不 / 没: "我再也不去了", "我怎么都睡不着". Right?
20. A来A去, A着A着, 说A就A: "想来想去", "走着走着", "说走就走". Is each pattern explained correctly and are the examples natural?
21. 有A有B, X也不是Y也不是, 一来…二来…: "有说有笑", "去也不是，不去也不是", "一来我没时间，二来我不想去". Right?
22. 看你…的, X什么X, 什么…不…的: "看你急的", "哭什么哭", "什么累不累的". Are these spoken patterns explained correctly, and is the tone (impatient, joking) described right?
23. 不得了, 极了, 得很: "好得不得了", "好极了", "累得很". Is 得很 correctly shown as a spoken pattern more used in the north? Is 不得了 also correctly used for "terrible" (出事了，不得了了)?
24. V得 + clause, 得了 and 不了: "累得说不出话来", "吃得了 / 吃不了". Is the second reading liǎo of 了 right, and is the difference from 得 (de) clear?
25. 起来, 下去, 下来, 上 beyond their direction: "看起来很好", "说下去", "安静下来", "爱上了". Are the second meanings right?
26. 有着 and 把…当作…: "有着悠久的历史", "把他当作朋友". Is 有着 written style?
27. "饭做好了" (a meaning-passive without 被) and "来了一位新同学" (a person arrives; things are lost): are the two patterns explained correctly?
28. The lesson on word order ("time, place, manner and serial verbs") teaches the order before the verb. Is it right and complete?
29. 跟…相比 and 比 + amount: "跟去年相比", "他比我大三岁". Right?
30. New measure words 朵, 幅, 颗, 匹, 扇, 册, 届: "一朵花", "一幅画", "一颗心 / 星", "一匹马", "一扇门 / 窗", "一册书", "第十届". Are the pairings the ones a native speaker would use? (颗 for round small things: 星星, 种子, 牙; 扇 for doors, windows.)
31. 性, 本, 之一, 是否: "安全性", "本公司", "…之一", "是否同意". Is 本 correct as "this (formal)", and is 是否 ("whether", written) explained right?
32. The lesson "Words you know, with a new meaning" teaches second senses of words learners already know. Are the second senses and their pinyin right and the ones a learner meets first?
33. Missing grammar: below is my own list of %d grammar points for HSK 5 (the official numbered list was not available to me; I used only patterns of HSK 1 to 5). Which important HSK 5 grammar points are missing? Which of mine belong to another level? If you know the official HSK 3.0 level-5 grammar outline (November 2025 syllabus), say how it differs.
""" % len(outline) + '\n'.join('   %d. %s' % (i, o) for i, o in enumerate(outline, 1)) + '\n'
write('%02d-grammar-explanations.md' % (NW + 1), head('检查下面的语法课（解释、常见错误、例句）') + 'Lessons:\n\n' + '\n'.join(g) + claims)
files.append(('%02d-grammar-explanations.md' % (NW + 1), 'the %d grammar lessons, the claims I am least sure of, and the grammar outline question' % len(lessons)))

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
BATCH = 400
batches = [sent[i:i + BATCH] for i in range(0, len(sent), BATCH)]
for n, b in enumerate(batches, 1):
    name = '%02d-sentences-%d-of-%d.md' % (n + NW + 1, n, len(batches))
    write(name, head('检查下面的句子') + 'Sentences (Chinese / English):\n\n' + '\n'.join('%d. %s  /  %s' % (i + 1, zh, en) for i, (zh, en) in enumerate(b)) + '\n')
    files.append((name, '%d example, exercise, dialogue and listening sentences' % len(b)))

# 4. word webs
webs = node_json('window.HSK5_WEBS')
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
name = '%02d-word-webs.md' % (len(batches) + NW + 2)
write(name, head('检查下面的“词网”内容（字的意思、反义词、主题分组）')
      + 'Also check: is each part meaning (for example 业 = industry, work inside 工业, 毕业, 专业) right and not misleading? Does each opposite-pair note say something true, and are the two words really opposites in the sense taught? Is any word grouped in a topic where it does not belong? There are %d topics; the big ones ("Everyday actions", "Feelings", "Abstract ideas") hold many words, so please say if any of them should be split or if a word in them has a much better home.\n\n' % len(webs['topics'])
      + '\n'.join(w) + '\n')
files.append((name, 'character meanings inside words, the opposite pairs and notes, the topic groups'))

# 5. the mock exam
lb = json.load(open(os.path.join(ROOT, 'content', 'l5', 'exam-5-listening.json'), encoding='utf-8'))
rb = json.load(open(os.path.join(ROOT, 'content', 'l5', 'exam-5-reading.json'), encoding='utf-8'))
wb = json.load(open(os.path.join(ROOT, 'content', 'l5', 'exam-5-writing.json'), encoding='utf-8'))
ex = []


def says(lines):
    """The spoken lines with who says them (男 = the man, 女 = the woman), so a question like 男的为什么没吃饭？ can be checked."""
    return ' / '.join(('%s：%s' % (l['s'], l['zh'])) if l.get('s') else l['zh'] for l in lines)


ex.append('## Listening part 1 (short dialogue, question, four options; the FIRST option listed is the right one; the site shuffles them)')
for st in lb['L1']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Listening part 2 (longer dialogue or passage, question, four options; the FIRST option listed is the right one)')
for st in lb['L2']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Reading part 1 (a passage with five blanks; each blank has four words, the FIRST is the right one)')
for si, st in enumerate(rb['R1'], 1):
    full = st['zh']
    k = 0
    while '___' in full:
        k += 1
        full = full.replace('___', '【%d】' % k, 1)
    ex.append('Passage %d: %s' % (si, full))
    for k, b in enumerate(st['blanks'], 1):
        ex.append('  - 【%d】 right: %s | other choices: %s' % (k, b[0], ' | '.join(b[1:])))
ex.append('\n## Reading part 2 (a short text, then four sentences; the FIRST option listed is the one that matches the text)')
for st in rb['R2']:
    ex.append('- 短文“%s” 选项：%s' % (st['zh'], ' | '.join(st['opts'])))
ex.append('\n## Reading part 3 (passage, question, four options; the FIRST option listed is the right one)')
for st in rb['R3']:
    ex.append('- 短文“%s” 问题“%s” 选项：%s' % (st['zh'], st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Writing practice 1 (put the words in order; the order shown here is the right one; other accepted orders follow)')
for it in wb['W1']:
    ex.append('- 词：%s → %s%s' % (' '.join(it['words']), ''.join(it['words']), ('；也接受：' + '；'.join(''.join(a) for a in it['alts'])) if it.get('alts') else ''))
ex.append('\n## Writing practice 2 (type the missing character)')
for it in wb['W2']:
    ex.append('- “%s” → %s%s' % (it['zh'], it['ans'], ('（提示：%s）' % it['hint']) if it.get('hint') else ''))
name = '%02d-exam.md' % (len(batches) + NW + 3)
write(name, head('检查下面的考试题（听力、阅读和写作练习）')
      + 'Besides the usual checks, please say: (1) whether every multiple-choice question has exactly ONE right answer and three clearly wrong ones (name any question where a second option could also be right); (2) for the reading part 1 passages, whether every blank has exactly one word that fits (name any blank where a second word of the four could also be correct, which is the most likely fault); (3) whether each listening answer can be worked out from what is said alone; (4) whether the writing practice word orders are the only natural ones (name any where a different order is also correct but is not listed); (5) whether the typed character in each writing practice sentence is the only character that fits.\n'
      + 'Note: the layout (listening 20 + 25, reading 15 + 10 + 20, writing practice 10 + 5) is my own; the official HSK 3.0 level-5 paper is different (and its writing part is handwritten). I could not find the 2025 layout. If you know it, please say how it differs. The site has no picture questions at HSK 5.\n\n' + '\n'.join(ex) + '\n')
files.append((name, 'the mock exam: dialogues, the three cloze passages, text matching, passages and the writing practice'))

# 6. the pieces that need a native ear
sp = node_json('window.HSK5_SPEAK')
ls = node_json('window.HSK5_LISTEN')
n = []
n.append('## Practice scripts (%d conversations the learner reads aloud)' % len(sp['scenarios']))
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
name = '%02d-scripts-and-clips.md' % (len(batches) + NW + 4)
write(name, head('检查下面的练习对话、常用句和听力短文')
      + 'Also check: do the practice conversations sound like something people really say (returning a faulty product, a clinic, a bank account, a contract and a probation period, a complaint to a hotel, a meeting, asking the way, volunteering)? Would a native speaker reply the way the other person does? Are the learner lines polite enough and not too stiff? Do the 24 listening clips sound like speech or announcements people really make (and not like a textbook)?\n\n' + '\n'.join(n) + '\n')
files.append((name, 'the %d practice conversations, the phrases, the %d listening clips and their notes' % (len(sp['scenarios']), len(ls['clips']))))

# 7. the meanings under each character ("Built from"): AI-written, one short gloss per character that is not a word of its own yet
gl = {}
for line in open(os.path.join(ROOT, 'content', 'char-glosses.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        c, _, m = line.rstrip('\n').partition('\t')
        gl[c] = m
w5 = node_json('window.HSK5_WORDS.map(w=>w.zh)', ['words'])
oldc = set()
for z in old:
    oldc.update(z)
seen_chars, rows = set(), []
for z in w5:
    for ch in z:
        if ch in gl and ch not in oldc and ch not in seen_chars and len(z) > 1:
            seen_chars.add(ch)
            rows.append('%s | %s | in %s' % (ch, gl[ch], z))
name = '%02d-character-meanings.md' % (len(batches) + NW + 5)
write(name, head('检查下面单个汉字的简短英文解释')
      + 'The site shows a short meaning under each character of a word ("Built from"), for characters that are not words of their own at the learner\'s level. Each line is: character | the short meaning I wrote | the HSK 5 word where it first appears. Is each short meaning (a) a real meaning of this character and (b) the meaning it has in that word? Say which are wrong or misleading, and give a better short meaning.\n\n' + '\n'.join(rows) + '\n')
files.append((name, 'the %d short character meanings shown under words ("Built from")' % len(rows)))

# 8. the Learn path of HSK 5: the Five Great Mountains
code = "global.window={};require(process.argv[1]+'/data/path.js');console.log(JSON.stringify(window.SHANLU_PATH[5]))"
pth = json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())
th = pth['theme']
t = []
t.append('The HSK 5 Learn path is a pilgrimage up the Five Great Mountains (五岳 Wǔ Yuè): Mount Tai in the east, Mount Hua in the west, Mount Heng in the south (衡山, Hunan), Mount Heng in the north (恒山, Shanxi) and Mount Song in the centre. Each unit is one stop on a trail; the level exam is the summit. The stop names are real places or sights on each mountain (an archway, a temple, a pavilion, a rock); the short story line for each unit is mine.')
t.append('')
t.append('Path title: %s | tag: %s | blurb: %s' % (th['name'], th['tag'], th['blurb']))
for gp in th['groups']:
    t.append('Mountain %s: %s · %s — %s' % (gp['zh'], gp['title'], gp['sub'], gp.get('line', '')))
t.append('')
t.append('Each line: number | stop (characters, pinyin, English) | stage | unit title | the line the learner reads | what the unit teaches')
for i, u in enumerate(pth['units'], 1):
    e = th['units'][u['id']]
    t.append('%d | %s %s · %s | %s | %s | %s | %s' % (i, e['zh'], e['py'], e['en'], e.get('stage', ''), u['title'], e['scene'], u['blurb']))
name = '%02d-five-mountains-path.md' % (len(batches) + NW + 6)
write(name, head('检查下面的五岳学习路径文字')
      + 'Please check: (1) that each stop name is a real place, building, gate or sight on that mountain, and on the right mountain (say which are wrong, invented, or only exist on a different mountain); (2) the pinyin and the English name of each stop (is "Daizong Archway", "Red Gate Palace" and so on the usual way to say it in English?); (3) the order along the trail (does the climb go from the foot to the summit in a sensible order?); (4) whether the one-line story for each stop is true to the place or at least harmless; (5) whether the two mountains called Heng are written, pronounced and located correctly (衡山 Héng Shān in Hunan, 恒山 Héng Shān in Shanxi), and whether the order east, west, south, north, centre is a fair one.\n\n' + '\n'.join(t) + '\n')
files.append((name, 'the 39 stops of the Five Great Mountains path: real place names, pinyin, English, order'))

readme = """# Review packs for a Chinese AI model: HSK 5

Each file is ready to UPLOAD (they are too long to paste): open DeepSeek (chat.deepseek.com) and/or Qwen Chat (chat.qwen.ai), start a **new chat for each file**, attach the file, and send this message: "Please read the attached file and do what it asks." Then paste the answer back to Claude.
Each file asks the model to report **problems only**, so the answers stay short. Where two models disagree, that item goes to a human teacher.
Nothing on the HSK 5 side has been checked by a person who reads Chinese; these packs are how that gets done. (The Alibaba questions are in `review/chinese-ai-hsk2/`; they do not depend on the level.)

| File | What it checks |
|---|---|
""" + '\n'.join('| %s | %s |' % f for f in files) + '\n'
write('00-README.md', readme)
print('wrote %d files to review/chinese-ai-hsk5 (%d distinct sentences in %d batches)' % (len(files) + 1, len(sent), len(batches)))
