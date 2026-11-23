#!/usr/bin/env python3
"""Review packs for exam items and speaking scenes added since a git commit, to paste into DeepSeek / Qwen.
Writes review/chinese-ai-new-items/exam-additions.md and speaking-additions.md.
Run:  python3 tools/make-review-additions.py <git ref of the commit before the additions>"""
import glob, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-new-items')
REF = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'


def old(path):
    try:
        return json.loads(subprocess.check_output(['git', 'show', '%s:%s' % (REF, path)], cwd=ROOT, stderr=subprocess.DEVNULL).decode('utf-8'))
    except subprocess.CalledProcessError:
        return {}


def added(path):
    new = json.load(open(os.path.join(ROOT, path), encoding='utf-8')); was = old(path)
    out = {}
    for k, v in new.items():
        if isinstance(v, list):
            before = {json.dumps(x, ensure_ascii=False, sort_keys=True) for x in was.get(k, [])}
            got = [x for x in v if json.dumps(x, ensure_ascii=False, sort_keys=True) not in before]
            if got:
                out[k] = got
    return out


EXAM_HEAD = """你好！我在做一个 HSK 学习网站。下面是模拟考试里新写的题（HSK {lv}），你还没有看过。学习者已学过 HSK 1 到 {lv} 的词。
请你作为母语者和中文老师检查。**只列出有问题的地方**，不用表扬。每个问题请写：编号 / 原文 / 问题是什么（简单的中文，再加一句英文）/ 更好的说法（只用 HSK 1 到 {lv} 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) **标着 ✓ 的答案是不是唯一正确的答案**，别的选项会不会也对；5) 判断题（对 / 错）判断得对不对；6) 排列题：除了给出的顺序，还有没有别的顺序也对；7) 对 HSK {lv} 来说太难的词（请按新版 HSK 3.0（2021）词表判断）。
如果全部没问题，请回答“没有发现问题”。

Hello! These are new mock-exam questions (HSK {lv}) from my study site; you have not seen them. Learners know HSK 1 to {lv}.
Please act as a native speaker and Chinese teacher. **Report only problems**, no praise. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a better version (HSK 1 to {lv} words only).
Please watch for: 1) unnatural wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) **whether the answer marked ✓ is the only right one**, or another option could also be right; 5) whether a true/false item is judged correctly; 6) for ordering items, whether another order is also correct; 7) words too hard for HSK {lv} (judge by the new HSK 3.0 (2021) lists).
If there are no problems, answer "No problems found".

---
"""
PART_NAME = {'L1': '听力', 'L2': '听力', 'L3': '听力', 'L4': '听力', 'R1': '阅读', 'R2': '阅读', 'R3': '阅读', 'W1': '书写'}


def say(lines):
    return '\n'.join('   %s%s  /  %s' % ((l['s'] + '：') if l.get('s') else '', l['zh'], l['en']) for l in lines)


def exam_item(n, part, e):
    if 'st' in e:   # a passage and a statement: does it match?
        return '%d. [%s %s] %s\n   判断 / statement: %s  /  %s  → %s' % (n, PART_NAME[part[0] + '1'], part, say(e['say']).strip(), e['st'][0], e['st'][1], '✓ 对 (matches)' if e['ok'] else '✓ 错 (does not match)')
    if 'words' in e:   # put pieces in order
        alts = ['/'.join(a) for a in e.get('alts', [])]
        return '%d. [%s %s] 正确顺序 / right order: %s  /  %s%s' % (n, PART_NAME[part[0] + '1'], part, ' | '.join(e['words']), e['en'], ('\n   也算对 / also accepted: ' + '; '.join(alts)) if alts else '')
    head = say(e['say']) if 'say' in e else '   %s  /  %s' % (e['zh'], e['en'])
    opts = '   '.join(('✓ ' if i == 0 else '  ') + o for i, o in enumerate(e['opts']))
    return '%d. [%s %s]\n%s\n   问题 / question: %s  /  %s\n   选项 / options:   %s' % (n, PART_NAME[part[0] + '1'], part, head, e['q']['zh'], e['q']['en'], opts)


def exam_pack():
    parts = []
    for lv in '345':
        items = {}
        for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'l' + lv, 'exam-*.json'))):
            for k, v in added(os.path.relpath(f, ROOT)).items():
                items.setdefault(k, []).extend(v)
        if not items:
            continue
        lines, n = [EXAM_HEAD.format(lv=lv)], 0
        for part in sorted(items):
            for e in items[part]:
                n += 1; lines.append(exam_item(n, part, e) + '\n')
        p = os.path.join(OUT, 'exam-additions-HSK%s.md' % lv)
        open(p, 'w', encoding='utf-8').write('\n'.join(lines))
        parts.append('%s: %d' % (os.path.relpath(p, ROOT), n))
    return parts


SPEAK_HEAD = """你好！我在做一个 HSK 学习网站。下面是“说一说”练习里新写的对话，你还没有看过。学习者说“你”的话，明明说另一方的话。
有的对话里，学习者可以从两句话里选一句（A / B），明明的下一句会跟着变。有的是“倒霉的一天”版本：事情不顺利（没有茶了、火车晚点了），学习者要处理问题。
请你作为母语者和中文老师检查。**只列出有问题的地方**，不用表扬。每个问题请写：编号 / 原文 / 问题是什么（简单的中文，再加一句英文）/ 更好的说法（只用这个级别和以下的词）。
需要特别注意：1) 不自然或不地道的说法，尤其是服务员、司机、经理会不会这样说；2) 语法错误；3) 英文和中文意思不一致；4) A / B 两句和明明的回答对不对得上；5) 太难的词（请按新版 HSK 3.0（2021）词表判断）。
如果全部没问题，请回答“没有发现问题”。

Hello! These are new dialogues for the speaking practice on my study site; you have not seen them. The learner says the 你 lines; Mingming says the other side.
In some, the learner chooses one of two lines (A / B) and Mingming's next line follows that choice. Some are "bad day" versions where things go wrong (no tea left, the train is late) and the learner has to deal with it.
Please act as a native speaker and Chinese teacher. **Report only problems**, no praise. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a better version (words of this level or below only).
Please watch for: 1) unnatural wording, especially whether a waiter, driver or manager would really say it; 2) grammar mistakes; 3) English that does not match the Chinese; 4) whether the A / B lines and Mingming's answers fit together; 5) words too hard for the level (judge by the new HSK 3.0 (2021) lists).
If there are no problems, answer "No problems found".

---
"""


def speak_pack():
    lines, n = [SPEAK_HEAD], 0
    for lv, f in [('1', 'content/speaking.json')] + [(x, 'content/l%s/speaking.json' % x) for x in '2345']:
        new = added(f).get('scenarios', [])
        for s in new:
            kind = '倒霉的一天 / bad day of "%s"' % s['bad'] if s.get('bad') else '新对话 / new dialogue'
            lines.append('\n## HSK %s · %s · %s' % (lv, s['title'], kind))
            for k in range(len(s['ai'])):
                a = s['ai'][k]
                if a.get('alt'):
                    n += 1; lines.append('%d. 明明（回答 A）：%s  /  %s' % (n, a['zh'], a['en']))
                    n += 1; lines.append('%d. 明明（回答 B）：%s  /  %s' % (n, a['alt']['zh'], a['alt']['en']))
                else:
                    n += 1; lines.append('%d. 明明：%s  /  %s' % (n, a['zh'], a['en']))
                if k < len(s['you']):
                    y = s['you'][k]
                    if y.get('alt'):
                        n += 1; lines.append('%d. 你（A）：%s  /  %s' % (n, y['zh'], y['en']))
                        n += 1; lines.append('%d. 你（B）：%s  /  %s' % (n, y['alt']['zh'], y['alt']['en']))
                    else:
                        n += 1; lines.append('%d. 你：%s  /  %s' % (n, y['zh'], y['en']))
    p = os.path.join(OUT, 'speaking-additions.md')
    open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return ['%s: %d lines' % (os.path.relpath(p, ROOT), n)]


if __name__ == '__main__':
    for x in exam_pack() + speak_pack():
        print('wrote ' + x)
