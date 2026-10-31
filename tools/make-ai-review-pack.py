#!/usr/bin/env python3
"""Builds ready-to-paste review packs for a Chinese AI model (review/chinese-ai/*.md) from what the learner sees
(plain style, no 儿 endings). Run: node tools/dump-sentences.js 1 --plain > /tmp/p.json && python3 tools/make-ai-review-pack.py /tmp/p.json
"""
import json, os, sys, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.md'):
        os.remove(os.path.join(OUT, f))
items = json.load(open(sys.argv[1], encoding='utf-8'))

HEAD = """你好！我正在做一个 HSK 1（汉语入门，只有约 300 个最常用词）学习网站。请你以中国母语者和汉语老师的身份，检查下面的内容。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的句子。对每个问题，请写：编号 / 原句 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（尽量只用 HSK 1 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教；5) 对 HSK 1 来说太难的词。
如果某一批全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK 1 study site (learners only know ~300 very common words). Please act as a native speaker and Chinese teacher and check the items below.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the sentence / what is wrong (simple Chinese plus one line of English) / a more natural version (HSK 1 words if possible).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken; 5) words too hard for HSK 1.
If a batch has no problems, answer "No problems found".

---

"""

def clean(it):
    return it['zh'].strip(), (it.get('en') or '').strip()

sent = []
seen = set()
for it in items:
    w = it['where']
    if w.startswith('exam:') or w.startswith('wordform:') or it.get('levelOnly') or it.get('fragment'):
        continue
    if not it.get('en'):
        continue
    zh, en = clean(it)
    key = (zh, en)
    if key in seen:
        continue
    seen.add(key)
    sent.append((zh, en))

# 1. sentences, in batches
BATCH = 220
batches = [sent[i:i + BATCH] for i in range(0, len(sent), BATCH)]
for n, b in enumerate(batches, 1):
    lines = ['%d. %s  /  %s' % (i + 1, zh, en) for i, (zh, en) in enumerate(b)]
    open(os.path.join(OUT, '%02d-sentences-%d-of-%d.md' % (n + 1, n, len(batches))), 'w', encoding='utf-8').write(
        '# Sentences, batch %d of %d (%d sentences)\n\nCopy everything below the line.\n\n---\n\n' % (n, len(batches), len(b)) + HEAD + 'Sentences (Chinese / English):\n\n' + '\n'.join(lines) + '\n')

# 2. grammar explanations
node = os.popen('node -e "global.window={};[\'grammar\'].forEach(n=>require(process.argv[1]+\'/data/hsk1-\'+n+\'.js\'));console.log(JSON.stringify(window.HSK1_GRAMMAR.lessons))" ' + ROOT).read()
lessons = json.loads(node)
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
open(os.path.join(OUT, '01-grammar-explanations.md'), 'w', encoding='utf-8').write(
    '# Grammar explanations (26 lessons)\n\nCopy everything below the line. For these, also check every "always" / "never" claim for counter-examples.\n\n---\n\n' + HEAD.replace('检查下面的内容', '检查下面 26 个语法课（解释、常见错误、例句）') + '\n'.join(g) + '\n')

# 3. exam
ex = []
for it in items:
    if it['where'].startswith('exam:'):
        zh, en = clean(it)
        ex.append('%s  /  %s' % (zh, en))
exq = []
seenx = set()
for l in ex:
    if l not in seenx:
        seenx.add(l); exq.append(l)
bank = json.loads(open(os.path.join(ROOT, 'content', 'exam-1.json'), encoding='utf-8').read())
pic = []
for part in ('L2',):
    for zh, en, opts in bank[part]:
        pic.append('听力第2部分：句子“%s” → 正确图片 %s ；干扰图片 %s' % (zh, opts[0], ' '.join(opts[1:])))
for part in ('L1', 'R1'):
    for p, zh, en, ok in bank[part]:
        pic.append('%s：图片 %s ＋ 词语“%s” → %s' % (part, p, zh, '相符' if ok else '不相符'))
for si, s in enumerate(bank['L3'] + bank['R2']):
    for it in s['items']:
        t = ' '.join(l['zh'] for l in it['say']) if 'say' in it else it['zh']
        pic.append('配图题：“%s” → %s （这一组的图片：%s）' % (t, s['opts'][it['ans']], ' '.join(s['opts'])))
open(os.path.join(OUT, '%02d-exam.md' % (len(batches) + 2)), 'w', encoding='utf-8').write(
    '# Mock exam questions\n\nCopy everything below the line. Besides the usual checks, please say whether any picture question is AMBIGUOUS (two pictures could fit) or whether an emoji does not clearly show the meaning.\n\n---\n\n'
    + HEAD.replace('检查下面的内容', '检查下面的考试题（句子和图片配对题）') + '\nSentences and dialogues:\n\n' + '\n'.join('%d. %s' % (i + 1, l) for i, l in enumerate(exq))
    + '\n\nPicture items (emoji stand in for pictures; first picture listed is the intended answer):\n\n' + '\n'.join(pic) + '\n')

readme = """# Review packs for a Chinese AI model

Order: do the files in numeric order. Open DeepSeek (chat.deepseek.com) and/or Qwen Chat (chat.qwen.ai), start a **new chat for each file**, paste everything below the line, and paste the answer back to Claude.
Each file asks the model to report **problems only**, so the answers stay short. Where two models disagree, that item goes to a human teacher.

| File | What it checks |
|---|---|
| 01-grammar-explanations.md | all 26 grammar lessons (explanations, mistakes, examples) |
""" + '\n'.join('| %02d-sentences-%d-of-%d.md | %d example, exercise and script sentences |' % (n + 1, n, len(batches), len(b)) for n, b in enumerate(batches, 1)) + """
| %02d-exam.md | the mock exam sentences and picture questions |

The 13 questions from before are in review/ask-a-chinese-ai.md (already answered).
""" % (len(batches) + 2)
open(os.path.join(OUT, '00-README.md'), 'w', encoding='utf-8').write(readme)
print('wrote %d files to review/chinese-ai (%d distinct sentences in %d batches)' % (len(batches) + 3, len(sent), len(batches)))
