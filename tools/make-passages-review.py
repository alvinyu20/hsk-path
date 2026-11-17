#!/usr/bin/env python3
"""Writes the file to paste into a Chinese AI (DeepSeek, Qwen) to check the listening passages of one or more levels.

Usage:  python3 tools/make-passages-review.py 1 2      -> review/chinese-ai-new-items/listening-passages-HSK1-2.md
Reads data/passages.js (run tools/build-passages.py first), so the pinyin is the one the site shows.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
levels = [a for a in sys.argv[1:] if a.isdigit()] or ['1', '2']
src = open(os.path.join(ROOT, 'data', 'passages.js'), encoding='utf-8').read()
data = json.loads(src[re.search(r'window\.SHANLU_PASSAGES\s*=', src).end():].strip().rstrip(';'))
top = max(int(l) for l in levels)
out = ['''以下是我为 HSK %(lv)s 学习网站写的“听力短文”（一段对话或一个人说的一段话，然后用中文回答问题）。学习者先听录音（看不到文字），再回答问题。
请你作为母语者和中文老师检查。**只列出有问题的地方**，不用表扬，也不用重复没问题的内容。每个问题请写：编号 / 原文 / 问题是什么（简单的中文，加一行英文）/ 更自然的说法（只用 HSK 1 到 HSK %(top)d 的词）。
需要特别注意：1) 对话是否自然、像真的生活里的对话；2) 语法错误；3) 英文翻译和中文意思不一致；4) 每个问题是否只有一个正确答案（标 ✓ 的那个），其他三个选项是否确实错，但又不是一眼就能排除；5) 问题能不能只靠听这段对话回答；6) “答案在第几句”是否指对了那一句；7) 对 HSK %(lv)s 来说太难的词；8) 拼音（多音字、轻声、变调、词与词之间的空格）。
如果全部没问题，请回答“没有发现问题”。

Hello! These are "listening passages" for an HSK study site (HSK %(lv)s): a short dialogue or talk that the learner hears without seeing the text, then questions in Chinese with four options. Please act as a native speaker and Chinese teacher and check them.
**Report only the problems**, no praise. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (HSK 1 to %(top)d words only).
Please watch for: 1) unnatural dialogue; 2) grammar mistakes; 3) English that does not match the Chinese; 4) each question must have exactly one right answer (the one marked ✓), and the other three must really be wrong but not silly; 5) every question must be answerable from the dialogue alone; 6) "answer in line N" must point at the right line; 7) words too hard for the level; 8) pinyin (multiple readings, neutral tones, tone changes, spaces between words).
If there are no problems, answer "No problems found".

---
''' % dict(lv=' and '.join(levels), top=top)]
k = 0
for lv in levels:
    for p in data.get(lv, []):
        k += 1
        out.append('\n## P%d. HSK %s · %s (%s)\n%s\n' % (k, lv, p['title'], p['id'], p['scene']))
        for i, l in enumerate(p['lines']):
            out.append('%d. %s：%s  (%s)\n   - %s' % (i + 1, l['s'], l['zh'], l['py'], l['en']))
        out.append('')
        for j, q in enumerate(p['qs']):
            opts = ' / '.join(('✓ ' if n == 0 else '') + o['zh'] for n, o in enumerate(q['opts']))
            out.append('Q%d. %s  (%s)\n   - English: %s\n   - options: %s\n   - answer in %s' % (j + 1, q['zh'], q['py'], q['en'], opts, ('line %d' % (q['line'] + 1)) if isinstance(q['line'], int) else 'lines ' + ' and '.join(str(x + 1) for x in q['line'])))
dest = os.path.join(ROOT, 'review', 'chinese-ai-new-items', 'listening-passages-HSK%s.md' % '-'.join(levels))
open(dest, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('wrote %s (%d passages, %d bytes)' % (os.path.relpath(dest, ROOT), k, os.path.getsize(dest)))
