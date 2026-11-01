#!/usr/bin/env python3
"""Builds ready-to-paste review packs for a Chinese AI model for HSK 2 (review/chinese-ai-hsk2/*.md) from what the learner sees.
Run:  node tools/dump-sentences.js 2 --plain > /tmp/p2.json && python3 tools/make-ai-review-pack-l2.py /tmp/p2.json
Pack order: word list and glosses, grammar lessons, sentences in batches, word webs, then questions about the AI services.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-hsk2')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.md'):
        os.remove(os.path.join(OUT, f))
items = json.load(open(sys.argv[1], encoding='utf-8'))


def node_json(expr):
    code = "global.window={};['words','grammar','webs'].forEach(n=>require(process.argv[1]+'/data/hsk2-'+n+'.js'));console.log(JSON.stringify(" + expr + "))"
    return json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())


HEAD = """你好！我正在做一个 HSK 2 学习网站（学习者已学过 HSK 1 的约 300 个词，现在学 HSK 2 的 200 个新词，总共约 500 个词）。请你以中国母语者和汉语老师的身份，检查下面的内容。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的内容。对每个问题，请写：编号 / 原文 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（只用 HSK 1 和 HSK 2 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教；5) 对 HSK 2 来说太难的词；6) 多音字的拼音是否正确。
如果某一部分全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK 2 study site (learners know the ~300 HSK 1 words and are now learning the 200 new HSK 2 words, about 500 in all). Please act as a native speaker and Chinese teacher and check the items below.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (using only HSK 1 and HSK 2 words).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken; 5) words too hard for HSK 2; 6) wrong pinyin for words with more than one reading.
If a part has no problems, answer "No problems found".

---

"""


def write(name, body):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)


files = []

# 1. the word list and glosses
words = node_json('window.HSK2_WORDS.map(w=>({zh:w.zh,py:w.py,pos:w.pos,en:w.en,note:w.note||""}))')
lines = []
for i, w in enumerate(words, 1):
    lines.append('%d. %s | %s | %s | %s%s' % (i, w['zh'], w['py'], w['pos'], w['en'], (' | note: ' + w['note']) if w['note'] else ''))
ask = """
Extra questions for this part:
A. The site has 197 words. The November 2025 HSK 3.0 syllabus says level 2 adds 200 new words. Which of the official 200 new level-2 words are NOT in my list (I think three are missing), and does my list contain any word that is not an official level-2 word? If you are not sure of the official list, say so instead of guessing.
B. For each word, is the pinyin right for the meaning given? I fixed 长 (cháng), 教 (jiāo), 地/得/过/着 (de, de, guo, zhe) by hand. Please look for other words where the shown reading is not the one that goes with the gloss.
C. Neutral tones: I show the dictionary neutral tones for 爷爷 yéye, 奶奶 nǎinai, 丈夫 zhàngfu, 眼睛 yǎnjing, 告诉 gàosu, 事情 shìqing, 还是 háishi, 回来 huílai, 回去 huíqu, 下来 xiàlai, 起来 qǐlai, but 上来 shànglái, 进来 jìnlái, 出来 chūlái, 过来 guòlái without them. Is that how you would teach them to a beginner? What is the usual reading of each?
D. 一会儿 is shown as yíhuìr (with the tone change). Is that right, or should a beginner see yīhuìr?
E. Glosses I am least sure of: 名 (measure word for people, formal), 面 (side; noodles), 花 (flower; the "to spend" meaning is not taught), 打 (hit; play a ball game; make a call), 就 (then; just; as early as), 着, 地, 得, 过 (particles), 红茶 (black tea), 爱好 (hobby), 啊, 时 (time; when), 位, 间, 条, 万, 快 (fast; soon), 长 (long), 还是 (or; still), 让, 可能, 正, 周, 每, 自己. Is each gloss correct and the most useful first meaning for a beginner? Which important common meaning is missing?
F. The site writes 男孩, 女孩, 小孩 without 儿 by default (and with 儿, as the official list prints them, when a switch is on), but 一会儿 always keeps its 儿. Is that how you would write them in plain Mandarin text? Does 一会 without 儿 sound unnatural?
"""
write('01-word-list.md', '' + HEAD.replace('检查下面的内容', '检查下面的 HSK 2 词表（拼音、词性、英文解释）') + 'Words (word | pinyin | part of speech | English):\n\n' + '\n'.join(lines) + '\n' + ask)
files.append(('01-word-list.md', 'the 197 words: pinyin, glosses, the three missing words, neutral tones'))

# 2. grammar lessons
lessons = node_json('window.HSK2_GRAMMAR.lessons')
outline = [l.strip() for l in open(os.path.join(ROOT, 'content', 'l2', 'grammar-outline.txt'), encoding='utf-8') if l.strip()]
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
Specific claims to check (these are the ones I am least sure of; please say right or wrong with a counter-example if wrong):
1. 比: "他比我高多了" and "这个比那个好一点" are fine, and a 比 sentence cannot take 很. Is 没有 + 那么 the normal way to say "not as ... as"?
2. 着: "他笑着说话", "弟弟坐着看电视", "门开着". I say "门没开" (not 门没开着) for "the door is not open". Is 门没开着 also used?
3. 快要 vs 就要: I say 明天快要考试了 is wrong and 明天就要考试了 is right. Is that true in everyday speech?
4. 别…了: "别笑了" means stop laughing. 让 can mean "make": "这个电影让我很高兴". Natural?
5. 因为…所以…, 虽然…但是…: I say the second part of 虽然 needs 但是 or 但. Is "虽然很累，很高兴" really unnatural without a "but" word?
6. 得: "他跑很快" is not standard; "她汉语说得很好" is the usual word order. Is "他跑很快" really wrong, or just colloquial?
7. 是…的: "我是昨天来了的" is wrong. Is the negative "我不是坐地铁来的" right?
8. 可能: "不可能" means impossible and "可能不来" means might not come. Is "他可能不在家" natural?
9. 二万 vs 两万 for 20,000 in speech.
10. 来/去: "请进来" said from inside the room, "我进去了" said by the person going in. 起来: "快起来", "她笑起来了". Are these the natural uses?
11. 过: "我去过三次中国" (and "我去过中国三次"). Do both orders work? Is "他看过这个电影两次" natural?
12. 还是 also means "had better": "太远了，我们还是打车吧".
13. 到/在 after a verb: "我住在学校旁边", "她站在门口", "妈妈六点到家了". Anything wrong?
14. 经常 / 有时 / 每…都 / 什么都: "我什么都喜欢吃", "我什么都不想吃".
15. 条, 位, 间, 次: "一条鱼", "一位老师", "这间教室", "请再说一次".
16. Missing grammar: below is my own list of 33 grammar points for HSK 2 (the official numbered list was not available to me). Which important HSK 2 grammar points are missing? Which of mine belong to HSK 3 instead? If you know the official HSK 3.0 level-2 grammar outline (November 2025 syllabus), say which of its points I do not cover.
""" + '\n'.join('   %d. %s' % (i, o) for i, o in enumerate(outline, 1)) + '\n'
write('02-grammar-explanations.md', '' + HEAD.replace('检查下面的内容', '检查下面的语法课（解释、常见错误、例句）') + 'Lessons:\n\n' + '\n'.join(g) + claims)
files.append(('02-grammar-explanations.md', 'the %d grammar lessons and the claims I am least sure of, plus the grammar outline question' % len(lessons)))

# 3. sentences in batches (everything with Chinese and English that the learner sees)
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
    write(name, '' + HEAD.replace('检查下面的内容', '检查下面的句子') + 'Sentences (Chinese / English):\n\n' + '\n'.join('%d. %s  /  %s' % (i + 1, zh, en) for i, (zh, en) in enumerate(b)) + '\n')
    files.append((name, '%d example, exercise and fill-in sentences' % len(b)))

# 4. word webs
webs = node_json('window.HSK2_WEBS')
w = []
for h in webs['hubs']:
    w.append('### Shared character %s (%s): %s' % (h['hub'], h['py'], h['en']))
    for x in h['words']:
        w.append('- %s = %s (%s) + %s (%s)' % (x['zh'], x['parts'][0][0], x['parts'][0][1], x['parts'][1][0], x['parts'][1][1]))
    w.append('')
w.append('### Pairs and opposites')
for o in webs['opps']:
    w.append('- %s / %s: %s' % (o['a'], o['b'], o['note']))
w.append('')
w.append('### Topics (words grouped for learning)')
for t in webs['topics']:
    w.append('- %s: %s' % (t['name'], ' '.join(t['words'])))
name = '%02d-word-webs.md' % (len(batches) + 3)
write(name, '' + HEAD.replace('检查下面的内容', '检查下面的“词网”内容（字的意思、反义词、主题分组）')
      + 'Also check: is each part meaning (for example 出 = out, 过 = cross, 子 = noun ending, 么 left out) right and not misleading? Does each opposite-pair note say something true? Is any word grouped in a topic where it does not belong?\n\n' + '\n'.join(w) + '\n')
files.append((name, 'character meanings inside words, the opposite pairs and notes, the topic groups'))

# 4b. the mock exam
ex = []
seenx = set()
for it in items:
    if it['where'].startswith('exam:') and it.get('en') and not it.get('levelOnly'):
        l = '%s  /  %s' % (it['zh'].strip(), it['en'].strip())
        if l not in seenx:
            seenx.add(l); ex.append(l)
bank = json.load(open(os.path.join(ROOT, 'content', 'l2', 'exam-2.json'), encoding='utf-8'))
pic = []
for pc, zh, en, ok in bank['L1']:
    pic.append('听力第1部分：图片 %s ＋ 句子“%s” → %s' % (pc, zh, '相符' if ok else '不相符'))
for st in bank['L2']:
    for i in st['items']:
        pic.append('听力第2部分：对话“%s” → 正确图片 %s （这一组的图片：%s）' % (' '.join(l['zh'] for l in i['say']), st['opts'][i['ans']], ' '.join(st['opts'])))
for st in bank['R1']:
    for i in st['items']:
        pic.append('阅读第1部分：句子“%s” → 正确图片 %s （这一组的图片：%s）' % (i['zh'], st['opts'][i['ans']], ' '.join(st['opts'])))
for a, b, aen, ben, same in bank['R3']:
    pic.append('阅读第3部分：“%s” 和 “%s” → %s' % (a, b, '意思相同' if same else '意思不同'))
name = '%02d-exam.md' % (len(batches) + 4)
write(name, HEAD.replace('检查下面的内容', '检查下面的考试题（句子、对话和图片配对题）') + 'Besides the usual checks, please say whether any picture question is AMBIGUOUS (two pictures could fit, or an emoji does not clearly show the meaning), and whether every "same meaning / different meaning" pair in reading part 3 is really the same or different.\n\nSentences and dialogues:\n\n' + '\n'.join('%d. %s' % (i + 1, l) for i, l in enumerate(ex)) + '\n\nPicture and pair items (emoji stand in for pictures; the first picture named is the intended answer):\n\n' + '\n'.join(pic) + '\n')
files.append((name, 'the mock exam: sentences, dialogues, picture matches and same-meaning pairs'))

# 5. questions for Alibaba
name = '%02d-questions-for-alibaba.md' % (len(batches) + 5)
write(name, """# Questions to settle about the Alibaba (Qwen) connection

These are about Alibaba's service, not about Chinese. Ask Alibaba Cloud's documentation, their support chat, or Qwen itself (Qwen may not know current details, so check any answer against the Model Studio documentation).
The site calls the International (Singapore) endpoint straight from the browser, and has only been tested against a fake Alibaba server.

1. CORS: can a web page (https://alvinyu20.github.io, no server of mine) call `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions` and `https://{workspace}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions` directly with an `Authorization: Bearer <key>` header? Do those endpoints answer the browser's preflight (OPTIONS) request and send `Access-Control-Allow-Origin`? If not, what is the supported way to call Qwen from a static page?
2. Model names: are `qwen-flash` and `qwen-plus` current model names on the International endpoint? Which model is the best for short Mandarin conversation for a beginner at the lowest cost?
3. Voice recognition: is `qwen3-asr-flash` available through `/compatible-mode/v1/chat/completions` with an `input_audio` content part holding a base64 data URI (`data:audio/wav;base64,...`, 16 kHz mono)? Are other formats (webm/opus from a browser MediaRecorder) accepted directly? What is the maximum audio length and file size?
4. Is there a language hint (for example Mandarin only) for the recogniser, and does it return punctuation?
5. Free quota: how many free tokens or audio minutes does a new International account get, for how long, and what happens when it runs out (an error, or automatic charging)? Is there a spending limit I can set so nothing is charged by surprise?
6. Key safety: the key sits in the browser's local storage on my own device. Can I limit a key to certain models or set a per-key budget?
7. Which region should a key be created in so it works with the endpoints above (Singapore)? What does the workspace ID do, and is it needed?
8. Anything that changed recently in the terms for using these models for a personal learning site?
""")
files.append((name, 'practical questions for Alibaba support or documentation (not about Chinese)'))

readme = """# Review packs for a Chinese AI model: HSK 2

Each file is ready to UPLOAD (they are too long to paste): open DeepSeek (chat.deepseek.com) and/or Qwen Chat (chat.qwen.ai), start a **new chat for each file**, attach the file, and send this message: "Please read the attached file and do what it asks." Then paste the answer back to Claude.
Each file asks the model to report **problems only**, so the answers stay short. Where two models disagree, that item goes to a human teacher.
Nothing on the HSK 2 side has been checked by a person who reads Chinese; these packs are how that gets done.

| File | What it checks |
|---|---|
""" + '\n'.join('| %s | %s |' % f for f in files) + '\n'
write('00-README.md', readme)
print('wrote %d files to review/chinese-ai-hsk2 (%d distinct sentences in %d batches)' % (len(files) + 1, len(sent), len(batches)))
