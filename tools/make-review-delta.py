#!/usr/bin/env python3
"""Builds one ready-to-upload file for a Chinese AI model (DeepSeek, Qwen) with ONLY the new review items of a level:
the new extra grammar-review questions (gmore.json), the new write-your-own prompts (gwrite.tsv) and the new listening clips
(listening.json), compared with an earlier git revision.

Run:  python3 tools/make-review-delta.py LEVEL BASE_REV      e.g.  python3 tools/make-review-delta.py 5 e9176e1a
Needs data/hskN-grammar.js and data/hskN-listen.js to be built already (node tools/build-site.js is not needed).
Writes review/chinese-ai-new-items/HSKN-new-review-items-1-of-K.md ... (files of about 38 KB, each with the instructions on top)
"""
import collections, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LV = int(sys.argv[1])
BASE = sys.argv[2]
SUB = 'content' if LV == 1 else 'content/l%d' % LV
OUT = os.path.join(ROOT, 'review', 'chinese-ai-new-items')
os.makedirs(OUT, exist_ok=True)


def old(path):
    try:
        return subprocess.check_output(['git', 'show', '%s:%s/%s' % (BASE, SUB, path)], cwd=ROOT, stderr=subprocess.DEVNULL).decode('utf-8')
    except subprocess.CalledProcessError:
        return ''


def cur(path):
    return open(os.path.join(ROOT, SUB, path), encoding='utf-8').read()


def node_json(expr):
    code = ("global.window={};const R=process.argv[1];['grammar','listen'].forEach(n=>require(R+'/data/hsk" + str(LV) + "-'+n+'.js'));console.log(JSON.stringify(" + expr + "))")
    return json.loads(subprocess.check_output(['node', '-e', code, ROOT]).decode())


G = node_json('window.HSK%d_GRAMMAR' % LV)
LISTEN = node_json('window.HSK%d_LISTEN.clips' % LV)
points = {p['id']: p for p in G['points']}
lesson_of = {l['id']: l for l in G['lessons']}
py_of = {}
for l in G['lessons']:
    for q in l.get('qx', []):
        py_of[q['sentence']['zh']] = q['sentence']['py']

more_old = {m['zh'] for m in json.loads(old('gmore.json') or '[]')}
more_new = [m for m in json.loads(cur('gmore.json')) if m['zh'] not in more_old]
write_old = {l.split('\t')[2] for l in old('gwrite.tsv').splitlines() if l.strip() and l[0] != '#' and len(l.split('\t')) > 2}
write_new = []
for l in cur('gwrite.tsv').splitlines():
    if l.strip() and l[0] != '#':
        f = l.split('\t')
        if f[2] not in write_old:
            write_new.append(f)
clips_old = {c['zh'] for c in json.loads(old('listening.json') or '{"clips":[]}')['clips']}
clips_new = [c for c in json.load(open(os.path.join(ROOT, SUB, 'listening.json'), encoding='utf-8'))['clips'] if c['zh'] not in clips_old]
clip_py = {c['zh']: c['py'] for c in LISTEN}

HEAD = """你好！我正在做一个 HSK %(lv)d 学习网站（学习者已学过 HSK 1 到 %(prev)d 的词，现在学 HSK %(lv)d 的新词）。下面是我新加的练习题：语法复习题、“自己写句子”的提示和答案、听力短句。请你以中国母语者和汉语老师的身份检查。
**只报告有问题的地方**，不要夸奖，也不要重复没问题的内容。对每个问题，请写：编号 / 原文 / 哪里不好（简单中文，再加一句英文）/ 更自然的说法（只用 HSK 1 到 HSK %(lv)d 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教（或口语被当成书面语）；5) 对 HSK %(lv)d 来说太难的词；6) 拼音是否正确（多音字、轻声、词与词之间的空格）；7) 选择题里“错误的选项”是不是真的错（不能是另一种也说得通的说法）；8) “找出多余的词”题里，去掉那个词以后句子是否真的正确，而带着它的句子是否真的不对；9) 听力短句后面两条“听什么”的说明（声调、变调、多音字、轻声）是否准确。
如果某一部分全部没问题，请回答“没有发现问题”。

Hello! I am building an HSK %(lv)d study site (learners know HSK 1 to %(prev)d and are now learning HSK %(lv)d). Below are the NEW practice items I just added: grammar review questions, "write your own sentence" prompts with a model answer, and listening clips. Please act as a native speaker and Chinese teacher and check them.
**Report only the problems**, no praise and no repeating good items. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (using only HSK 1 to %(lv)d words).
Please watch for: 1) unnatural or non-idiomatic wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken (or the reverse); 5) words too hard for HSK %(lv)d; 6) wrong pinyin (words with more than one reading, neutral tones, spaces between words); 7) in multiple-choice items, the "wrong" option must really be wrong (not another way that also works); 8) in "spot the extra word" items, the sentence without the word must be correct and the sentence with it must really be wrong; 9) the two "what to listen for" notes under each clip (tones, tone changes, readings, light syllables) must be accurate.
If a part has no problems, answer "No problems found".

---

""" % dict(lv=LV, prev=LV - 1)

units = []   # pieces that are never split: a heading with its items

units.append('# HSK %d: new review items (%d review questions, %d write-your-own prompts, %d listening clips)\n' % (LV, len(more_new), len(write_new), len(clips_new)))
units.append('\n## A. Grammar review questions\n\nEach item belongs to one grammar point. Types: **choose** (pick the sentence that says the English; option 1 is the right one), **fill** (the blank is a word), **build** (put the words in order; the sentence is the answer), **spot** (tap the extra word; the sentence with the extra word is wrong).\n')
by_point = collections.OrderedDict()
for m in more_new:
    by_point.setdefault(m['p'], []).append(m)
n = 0
for pid, items in by_point.items():
    p = points.get(pid, {})
    u = ['\n### %s  %s  (lesson: %s)\n' % (pid, p.get('title', ''), (lesson_of.get(p.get('lesson'), {}).get('title') or ''))]
    for m in items:
        n += 1
        zh = m['zh']
        py = py_of.get(zh, '')
        t = m['t']
        if t == 'mc':
            u.append('A%d. **choose**. English: %s\n   - right: %s  (%s)\n   - wrong: %s\n   - note shown to the learner: %s' % (n, m['en'], zh, py, m['options'][1], m['explain']))
        elif t == 'cloze':
            u.append('A%d. **fill**. %s  (%s)\n   - English: %s\n   - blank: %s\n   - note shown to the learner: %s' % (n, zh.replace(m['blank'], '___', 1), py, m['en'], m['blank'], m['explain']))
        elif t == 'order':
            u.append('A%d. **build**. %s  (%s)\n   - English: %s\n   - note shown to the learner: %s' % (n, zh, py, m['en'], m['explain']))
        else:
            u.append('A%d. **spot**. sentence with the extra word: %s\n   - extra word: %s\n   - correct sentence: %s  (%s)\n   - English: %s\n   - note shown to the learner: %s' % (n, m['wrong'], m['remove'], zh, py, m['en'], m['explain']))
    units.append('\n'.join(u))

units.append('\n\n## B. "Write your own sentence" prompts\n\nThe learner sees the English, writes a Chinese sentence, and is checked for the required words (a+b: all of them; a|b: any one). The model answer is shown afterwards.\n')
cur_p = None
u = []
for k, f in enumerate(write_new, 1):
    if f[0] != cur_p:
        if u:
            units.append('\n'.join(u))
        cur_p = f[0]
        u = ['\n### %s  %s\n' % (cur_p, points.get(cur_p, {}).get('title', ''))]
    u.append('B%d. English: %s\n   - model answer: %s\n   - required: %s' % (k, f[1], f[2], f[3] if len(f) > 3 else ''))
if u:
    units.append('\n'.join(u))

units.append('\n\n## C. Listening clips\n\nEach clip is read aloud; the learner types what they hear. Two notes under it say what to listen for.\n')
u = []
for k, c in enumerate(clips_new, 1):
    u.append('C%d. %s  (%s)\n   - English: %s\n   - note 1: %s\n   - note 2: %s' % (k, c['zh'], clip_py.get(c['zh'], ''), c['en'], c['notes'][0], c['notes'][1] if len(c['notes']) > 1 else ''))
units.append('\n'.join(u))

# pack the pieces into files of at most MAXB bytes, each with the instructions on top, so each fits in one chat message
MAXB = 38000
parts, curp, size = [], [], 0
for u in units:
    ub = len(u.encode('utf-8'))
    if curp and size + ub > MAXB:
        parts.append(curp); curp, size = [], 0
    curp.append(u); size += ub
if curp:
    parts.append(curp)
for f in os.listdir(OUT):
    if f.startswith('HSK%d-new-review-items' % LV):
        os.remove(os.path.join(OUT, f))
for i, part in enumerate(parts, 1):
    name = 'HSK%d-new-review-items-%d-of-%d.md' % (LV, i, len(parts))
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(HEAD + '\n'.join(part) + '\n')
    print('wrote review/chinese-ai-new-items/%s (%d bytes)' % (name, os.path.getsize(os.path.join(OUT, name))))
print('%d review questions, %d write prompts, %d clips in %d files' % (len(more_new), len(write_new), len(clips_new), len(parts)))
