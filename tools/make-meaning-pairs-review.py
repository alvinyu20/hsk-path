#!/usr/bin/env python3
"""Writes the DeepSeek/Qwen review pack for words that share the same English meaning (the 19 Nov 2026 sweep):
review/chinese-ai-new-items/same-meaning-N-of-M.md, one message each. Groups = words whose English was identical before the sweep
(listed in content/same-meaning-groups.tsv), plus 游 / 游泳. Run: python3 tools/make-meaning-pairs-review.py"""
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
words = {}
for n in range(1, 6):
    p = os.path.join(ROOT, 'data', 'hsk%d-words.js' % n)
    for line in open(p, encoding='utf-8'):
        t = line.strip().rstrip(',')
        if t.startswith('{"zh"'):
            w = json.loads(t); words.setdefault(w['zh'], dict(w, lv=n))
groups = []
for line in open(os.path.join(ROOT, 'content', 'same-meaning-groups.tsv'), encoding='utf-8'):
    if line.startswith('#') or not line.strip(): continue
    p = line.rstrip('\n').split('\t'); groups.append((p[0], p[1].split()))
PER = 40
chunks = [groups[i:i + PER] for i in range(0, len(groups), PER)]
head_zh = ('你好！我正在做一个 HSK 学习网站（新版 HSK 3.0，一到五级）。下面每一组词在网站上原来的英文意思完全一样，学习者分不清。'
  '我给每个词加了一个区分用的英文说明（括号里），并写了用法说明（什么时候用哪个），说明里有小例子。\n'
  '请你作为母语者和中文老师检查。**只列出有问题的地方**，不用表扬。每个问题请写：组号 / 词 / 问题是什么（简单的中文，再加一句英文）/ 更准确的说法。\n'
  '需要特别注意：1) 区别说错了（比如说某个词是“书面语”“北方话”“口语”，但其实不是）；2) 例子不自然或不对；3) 英文意思和中文不一致；'
  '4) 漏掉了更重要的区别；5) 两个词其实可以互换，但说明说不能（或者反过来）。说明里的中文例子只能用该词级别及以下的词，所以低级别的词有时不提高级别的近义词，这是故意的。\n'
  '如果全部没问题，请回答“没有发现问题”。\n\n')
head_en = ('Hello! These are word groups from my HSK study site (HSK 3.0, levels 1 to 5). In each group the words used to have exactly the same English '
  'meaning, so learners could not tell them apart. Each word now has a distinguishing label (in brackets) and a usage note saying when to use which, with short examples.\n'
  'Please act as a native speaker and Chinese teacher. **Report only the problems**, no praise. For each problem give: group number / the word / what is wrong '
  '(simple Chinese plus one line of English) / a more accurate version.\n'
  'Please watch for: 1) a wrong distinction (a word called written, northern or spoken when it is not); 2) unnatural or wrong examples; '
  '3) English that does not match the Chinese; 4) a more important difference that was missed; 5) words that are in fact interchangeable where the note says they are not, or the reverse. '
  'Chinese examples in a note may only use words at or below that word\'s level, so a lower-level word sometimes does not name its higher-level partner: that is on purpose.\n'
  'If there are no problems, answer "No problems found".\n\n---\n\n')
out_dir = os.path.join(ROOT, 'review', 'chinese-ai-new-items')
k = 0
for ci, ch in enumerate(chunks, 1):
    lines = [head_zh + head_en]
    for title, zs in ch:
        k += 1
        lines.append('## %d. %s\n' % (k, title))
        for z in zs:
            w = words[z]
            lines.append('- **%s** (%s, HSK %d): %s' % (z, w['py'], w['lv'], w['en']))
            if w.get('note'): lines.append('  - Note: %s' % w['note'])
            lines.append('  - Example: %s / %s' % (w['ex']['zh'], w['ex']['en']))
        lines.append('')
    p = os.path.join(out_dir, 'same-meaning-%d-of-%d.md' % (ci, len(chunks)))
    open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(p, ROOT), '(%d groups, %d characters)' % (len(ch), len('\n'.join(lines))))
