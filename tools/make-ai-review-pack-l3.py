#!/usr/bin/env python3
"""Builds ready-to-upload review packs for a Chinese AI model for HSK 3 (review/chinese-ai-hsk3/*.md) from what the learner sees (plain style).
Run:  node tools/dump-sentences.js 3 --plain > /tmp/p3.json && python3 tools/make-ai-review-pack-l3.py /tmp/p3.json
Pack order: word list and glosses, grammar lessons, sentences in batches, word webs, the mock exam, then the HSK 3 items that need a native ear.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-hsk3')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.md'):
        os.remove(os.path.join(OUT, f))
items = json.load(open(sys.argv[1], encoding='utf-8'))


def node_json(expr):
    # the data is loaded and then switched to the plain style (no 儿 endings), exactly as the default site shows it
    code = ("global.window={};const R=process.argv[1];['words','grammar','webs','listen','speak','exam'].forEach(n=>require(R+'/data/hsk3-'+n+'.js'));"
            "require(R+'/data/hsk1-erhua.js');require(R+'/erhua.js').make(window.HSK1_ERHUA).apply(window);console.log(JSON.stringify(" + expr + "))")
    return json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())


HEAD = """你好！我正在做一个 HSK 3 学习网站（学习者已学过 HSK 1 和 HSK 2 的约 500 个词，现在学 HSK 3 的 491 个新词，总共约 1000 个词）。请你以中国母语者和汉语老师的身份，检查下面的内容。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的内容。对每个问题，请写：编号 / 原文 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（只用 HSK 1、HSK 2 和 HSK 3 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教；5) 对 HSK 3 来说太难的词；6) 多音字的拼音是否正确。
如果某一部分全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK 3 study site (learners know the ~500 words of HSK 1 and 2 and are now learning the 491 new HSK 3 words, about 1,000 in all). Please act as a native speaker and Chinese teacher and check the items below.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (using only HSK 1, 2 and 3 words).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken; 5) words too hard for HSK 3; 6) wrong pinyin for words with more than one reading.
If a part has no problems, answer "No problems found".

---

"""


ERHUA = []
for line in open(os.path.join(ROOT, 'content', 'erhua.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        cols = line.rstrip('\n').split('\t')
        ERHUA.append((cols[0], cols[1]))


def plain(text):
    for official, simple in ERHUA:
        text = text.replace(official, simple)
    return text


def write(name, body):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)


def head(what):
    return HEAD.replace('检查下面的内容', what)


files = []

# 1. the word list and glosses
words = node_json('window.HSK3_WORDS.map(w=>({zh:w.zh,py:w.py,pos:w.pos,en:w.en,note:w.note||""}))')
lines = []
for i, w in enumerate(words, 1):
    lines.append('%d. %s | %s | %s | %s%s' % (i, w['zh'], w['py'], w['pos'], w['en'], (' | note: ' + w['note']) if w['note'] else ''))
TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'
# a word with fewer tone marks than Chinese characters has a neutral-tone syllable (the pinyin is written solid, so syllables are counted by tone marks)
neutral = [w['zh'] + ' ' + w['py'] for w in words if '/' not in w['py'] and sum(c in TONED for c in w['py']) < len(re.findall('[\u4e00-\u9fff]', w['zh']))]
ask = """
Extra questions for this part:
A. The site has %d cards. The November 2025 HSK 3.0 syllabus has 500 entries at band 3. Nine of them reuse a headword from an earlier level with a different sense or reading (得 dé and děi, 地, 过去, 还 huán, 会 huì "a meeting", 站, 长 zhǎng, 只 zhǐ); those are taught in a lesson about new meanings of known words, not as separate cards. I read the list from a third-party copy of the syllabus PDF, so please tell me which official band 3 words are NOT in my list and which of my words are NOT official band 3 words (as far as you know the list).
B. For each word, is the pinyin right for the meaning given? Look especially at words with more than one reading: 长, 发, 行, 好, 重, 数, 教, 种, 调, 角, 假, 号, 差, 干, 便宜, 地方, 觉得, 还 (huán / hái), 会 (huì / kuài), 只 (zhī / zhǐ), 得 (de / děi / dé), 地 (de / dì), 着 (zhe / zháo), 了 (le / liǎo).
C. Neutral tones: the site follows the dictionary. These HSK 3 words are shown with at least one neutral-tone syllable: %s. Please say which you would show differently for a beginner.
D. The site writes 聊天 and 一块 without 儿 by default (and with 儿, as the syllabus prints them, when a switch is on). Is that how you would write them in plain Mandarin text?
E. Glosses I am least sure of: 层 (floor; layer), 间 (room measure word), 号 (date; number), 假 (leave; holiday), 担 and 担心, 干 (do), 差 (poor; lacking), 重 (heavy; important), 关系 (relationship; connection), 着急 versus 担心, 满意, 合适, 熟, 影响. Is each gloss correct and the most useful first meaning for a beginner? Which important common meaning is missing?
""" % (len(words), ', '.join(neutral))
write('01-word-list.md', head('检查下面的 HSK 3 词表（拼音、词性、英文解释）') + 'Words (word | pinyin | part of speech | English):\n\n' + '\n'.join(lines) + '\n' + ask)
files.append(('01-word-list.md', 'the %d words: pinyin, glosses, notes, the official-list question, neutral tones' % len(words)))

# 2. grammar lessons
lessons = node_json('window.HSK3_GRAMMAR.lessons')
outline = [l.strip() for l in open(os.path.join(ROOT, 'content', 'l3', 'grammar-outline.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
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
1. 把: "我把书放在桌子上了", "我没把作业做完" (the negative goes before 把). Can a 把 sentence ever be left without a result word (like 放在, 做完, 关上)?
2. 被: "杯子被我打坏了", "我的书没被借走". Is 被 used only for things that are unpleasant, or is that old advice? Is "被老师叫到办公室" natural?
3. 除了…以外 / 除了…还…: "除了苹果，我还买了西瓜" (adds) and "除了他，大家都来了" (excludes). Is it right to teach both meanings with 除了?
4. 只要…就… and 只有…才…: "只要努力，就能学好" and "只有多练习，才能说好". Is the difference (enough condition versus only condition) explained correctly?
5. 才 and 就 with time: "他八点才到" (late) and "他六点就起床了" (early). Is this the right way to teach 才/就 at this level?
6. 刚, 刚刚 and 刚才: "我刚到家", "刚才有人找你". Is 刚才 a time word (can go before the subject) while 刚 cannot?
7. 一直, 总是, 常常, 平时: are the glosses and examples distinct enough, e.g. "他总忘记带手机" versus "他总是很忙"?
8. 什么都 / 谁都 / 哪里都: "我什么都不想吃", "谁都知道这件事", "我哪里都不想去". Natural?
9. 越来越 and 越…越…: "天气越来越冷", "汉语越学越有意思".
10. 起来 / 下去 / 进来 / 回去: "他笑起来了", "请说下去", "他走进来了", "孩子们向老师跑去了". Are the tones and uses correct?
11. Potential complements: "我听不懂", "这么多菜，我吃不完", "我找不到我的手机". Is the explanation of 得/不 + result complement right?
12. 得 (děi) "must": "我得走了" and "你得多休息". Is it natural to teach it next to 应该 and 该?
13. 不用 and 别: "你不用买票" versus "别担心". Is the difference clear?
14. 一边…一边…, 又…又…, 先…然后…, 先…再…: any wrong or unnatural examples?
15. 比: "他比我高多了", "今天比昨天还冷", "他比我更高". Are 更 and 还 explained correctly after 比?
16. Missing grammar: below is my own list of %d grammar points for HSK 3 (the official numbered list was not available to me). Which important HSK 3 grammar points are missing? Which of mine belong to another level? If you know the official HSK 3.0 level-3 grammar outline (November 2025 syllabus), say which of its points I do not teach.
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
webs = node_json('window.HSK3_WEBS')
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
      + 'Also check: is each part meaning (for example 机 = machine inside 耳机, 关机, 司机) right and not misleading? Does each opposite-pair note say something true? Is any word grouped in a topic where it does not belong?\n\n' + '\n'.join(w) + '\n')
files.append((name, 'character meanings inside words, the opposite pairs and notes, the topic groups'))

# 5. the mock exam
lb = json.load(open(os.path.join(ROOT, 'content', 'l3', 'exam-3-listening.json'), encoding='utf-8'))
rb = json.load(open(os.path.join(ROOT, 'content', 'l3', 'exam-3-reading.json'), encoding='utf-8'))
wb = json.load(open(os.path.join(ROOT, 'content', 'l3', 'exam-3-writing.json'), encoding='utf-8'))
ex = []


def says(lines):
    """The spoken lines with who says them (男 = the man, 女 = the woman), so a question like 男的为什么没吃饭？ can be checked."""
    return ' / '.join(('%s：%s' % (l['s'], l['zh'])) if l.get('s') else l['zh'] for l in lines)


ex.append('## Listening part 1 (picture matching): each set has six pictures; the dialogue is spoken; the learner picks the picture')
for si, st in enumerate(lb['L1'], 1):
    ex.append('Set %d pictures: %s' % (si, '  '.join('%d=%s' % (k + 1, p) for k, p in enumerate(st['opts']))))
    for it in st['items']:
        ex.append('- 对话“%s” → 正确图片 %s' % (says(it['say']), st['opts'][it['ans']]))
ex.append('\n## Listening part 2 (true or false): a passage is spoken, then a statement is shown')
for st in lb['L2']:
    ex.append('- 短文“%s” 说法“%s” → %s' % (' '.join(l['zh'] for l in st['say']), st['st'][0], '正确' if st['ok'] else '错误'))
ex.append('\n## Listening part 3 (dialogue, question, three options; the FIRST option listed is the right one)')
for st in lb['L3']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Listening part 4 (longer dialogue, question, three options; the FIRST option listed is the right one)')
for st in lb['L4']:
    ex.append('- 对话“%s” 问题“%s” 选项：%s' % (says(st['say']), st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Reading part 1 (match each question to its reply)')
for si, st in enumerate(rb['R1'], 1):
    ex.append('Set %d replies: %s' % (si, '  '.join('%s' % o for o in st['opts'])))
    for it in st['items']:
        ex.append('- 问题“%s” → 正确回答“%s”' % (it['zh'], st['opts'][it['ans']]))
ex.append('\n## Reading part 2 (fill the blank with one of six words)')
for si, st in enumerate(rb['R2'], 1):
    ex.append('Set %d words: %s' % (si, ' '.join(o for o in st['opts'])))
    for it in st['items']:
        ex.append('- “%s” → %s' % (it['zh'], st['opts'][it['ans']]))
ex.append('\n## Reading part 3 (passage, question, three options; the FIRST option listed is the right one)')
for st in rb['R3']:
    ex.append('- 短文“%s” 问题“%s” 选项：%s' % (st['zh'], st['q']['zh'], ' | '.join(st['opts'])))
ex.append('\n## Writing practice 1 (put the words in order; every accepted order is listed)')
for it in wb['W1']:
    ex.append('- 词：%s → %s%s' % (' '.join(it['words']), ''.join(it['words']), ('；也接受：' + '；'.join(''.join(a) for a in it['alts'])) if it.get('alts') else ''))
ex.append('\n## Writing practice 2 (type the missing character)')
for it in wb['W2']:
    ex.append('- “%s” → %s' % (it['zh'], it['ans']))
name = '%02d-exam.md' % (len(batches) + 4)
write(name, head('检查下面的考试题（听力、阅读和写作练习）') + 'Besides the usual checks, please say: (1) whether any PICTURE question is ambiguous (two of the six emoji could fit the dialogue, or an emoji does not clearly show the meaning); (2) whether every "true / false" statement is clearly true or clearly false from the passage; (3) whether, in the three-option questions, a wrong option could also be defended as right; (4) whether each reading blank has exactly one possible word among the six; (5) whether any accepted word order in the writing practice is wrong Chinese, and whether an acceptable order is missing.\n\n' + plain('\n'.join(ex)) + '\n')
files.append((name, 'the mock exam: pictures, true/false, questions, replies, blanks and the writing practice'))

# 6. the pieces that need a native ear
sp = node_json('window.HSK3_SPEAK')
ls = node_json('window.HSK3_LISTEN')
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
write(name, head('检查下面的练习对话、常用句和听力短文') + 'Also check: do the practice conversations sound like something people really say (cafe, hotel, doctor, directions ...)? Would a native speaker reply in these words? Are the "what to listen for" notes true?\n\n' + '\n'.join(n) + '\n')
files.append((name, 'the 8 practice conversations, the phrases, the 24 listening clips and their notes'))

readme = """# Review packs for a Chinese AI model: HSK 3

Each file is ready to UPLOAD (they are too long to paste): open DeepSeek (chat.deepseek.com) and/or Qwen Chat (chat.qwen.ai), start a **new chat for each file**, attach the file, and send this message: "Please read the attached file and do what it asks." Then paste the answer back to Claude.
Each file asks the model to report **problems only**, so the answers stay short. Where two models disagree, that item goes to a human teacher.
Nothing on the HSK 3 side has been checked by a person who reads Chinese; these packs are how that gets done. (The Alibaba questions are in `review/chinese-ai-hsk2/`; they do not depend on the level.)

| File | What it checks |
|---|---|
""" + '\n'.join('| %s | %s |' % f for f in files) + '\n'
write('00-README.md', readme)
print('wrote %d files to review/chinese-ai-hsk3 (%d distinct sentences in %d batches)' % (len(files) + 1, len(sent), len(batches)))
