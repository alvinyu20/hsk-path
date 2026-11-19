#!/usr/bin/env python3
"""Builds review files for a Chinese AI model (DeepSeek, Qwen) with ONLY the sentences it has not seen yet: every sentence the site
shows now (tools/dump-sentences.js, all levels) whose Chinese does not appear in the FIRST committed version of any file under review/.
The first version is what was sent; later versions of a pack can hold fixes made after the review, which the reviewer never saw.

Run:  python3 tools/make-review-unseen.py [ROUND]   (needs the data files built: bash tools/check-all.sh does that)
Writes review/chinese-ai-new-items/unseen-HSKN-1-of-K.md (round 1) or unseenROUND-HSKN-1-of-K.md (files of about 38 KB, each with the
instructions on top). Use a new ROUND number for each round, so earlier rounds' files stay in the repo.

"Seen" is every file ever added under review/ (also ones deleted since), in its first version, plus the later versions listed in
SENT_AGAIN: a pack that was regenerated and sent again (19 Nov: HSK 5 pack files 20 to 23, refreshed before they were first sent).
"""
import collections, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-new-items')
MAXB = 38000


def git(*a):
    return subprocess.check_output(['git'] + list(a), cwd=ROOT).decode('utf-8')


def squash(s):
    return re.sub(r'[\s　]', '', s)


# everything a reviewer has been sent: the first version of each review file (also files deleted since) ...
SENT_AGAIN = [('853c49b8', 'review/chinese-ai-hsk5/20-exam.md'), ('853c49b8', 'review/chinese-ai-hsk5/21-scripts-and-clips.md'),
              ('853c49b8', 'review/chinese-ai-hsk5/22-character-meanings.md'), ('853c49b8', 'review/chinese-ai-hsk5/23-five-mountains-path.md')]
seen = []
ever = sorted(set(x for x in git('log', '--all', '--diff-filter=A', '--format=', '--name-only', '--', 'review').split('\n') if x.strip()))
for f in ever:
    if not f.endswith(('.md', '.csv', '.tsv')):
        continue
    first = git('log', '--diff-filter=A', '--format=%H', '--', f).split()
    if not first:
        continue
    try:
        seen.append(git('show', first[-1] + ':' + f))
    except subprocess.CalledProcessError:
        pass
for c, f in SENT_AGAIN:   # ... and the versions sent again later
    seen.append(git('show', c + ':' + f))
SEEN = squash('\n'.join(seen))
ROUND = sys.argv[1] if len(sys.argv) > 1 else ''
PREFIX = 'unseen%s-HSK' % ROUND

KIND = collections.OrderedDict([
    ('word-ex', 'Word examples'), ('word-extra', 'More word examples'), ('lesson', 'Grammar lessons and extra questions'), ('point', 'Grammar review points'),
    ('write', 'Write-your-own model answers'), ('topic-sentence', 'Word web topic sentences'), ('hub-gap', 'Word web fill-the-gap'),
    ('passage', 'Listening passages'), ('clip', 'Listening clips'), ('scenario', 'Speaking scripts'), ('exam', 'Mock exam'),
])

HEAD = """你好！我正在做一个 HSK 学习网站。下面是网站上 HSK %(lv)d 的句子（中文 / 英文），都是新写的或改过的，你还没有看过。学习者已学过 HSK 1 到 %(prev)s 的词，现在学 HSK %(lv)d。
请你作为母语者和中文老师检查。**只列出有问题的地方**，不用表扬，也不用重复没问题的内容。每个问题请写：编号 / 原文 / 问题是什么（简单的中文，再加一句英文）/ 更自然的说法（只用 HSK 1 到 %(lv)d 的词）。
需要特别注意：1) 不自然或不地道的说法；2) 语法错误；3) 英文翻译和中文意思不一致；4) 书面语被当成口语教；5) 对 HSK %(lv)d 来说太难的词（请按新版 HSK 3.0（2021）词表判断，不是旧的 HSK 2.0 词表；很多旧版的高级词在新版里级别更低）。“___”是填空题的空，答案在后面。
如果全部没问题，请回答“没有发现问题”。

Hello! These are HSK %(lv)d sentences from my study site (Chinese / English) that are new or changed since you last checked; you have not seen them. Learners know HSK 1 to %(prev)s and are learning HSK %(lv)d. Please act as a native speaker and Chinese teacher.
**Report only the problems**, no praise. For each problem give: number / the item / what is wrong (simple Chinese plus one line of English) / a more natural version (HSK 1 to %(lv)d words only).
Please watch for: 1) unnatural wording; 2) grammar mistakes; 3) English that does not match the Chinese; 4) written style taught as spoken; 5) words too hard for HSK %(lv)d (judge by the new HSK 3.0 (2021) word lists, not the old HSK 2.0 lists; many words moved to a lower level). "___" is a blank, its answer follows.
If there are no problems, answer "No problems found".

---
"""


def main():
    for f in os.listdir(OUT):
        if f.startswith(PREFIX):
            os.remove(os.path.join(OUT, f))
    total = 0
    for lv in range(1, 6):
        items = json.loads(subprocess.check_output(['node', 'tools/dump-sentences.js', str(lv)], cwd=ROOT))
        plain = json.loads(subprocess.check_output(['node', 'tools/dump-sentences.js', str(lv), '--plain'], cwd=ROOT))   # packs may show either style
        alt = {it['zh']: plain[i]['zh'] for i, it in enumerate(items) if i < len(plain) and plain[i]['where'] == it['where']}
        groups = collections.OrderedDict((k, []) for k in KIND)
        other = []
        done = set()
        for it in items:
            zh = it.get('zh') or ''
            k = it['where'].split(':')[0]
            # whole sentences with an English line only (not single words, word notes, wrong options or answer tokens)
            if not zh or zh in done or k not in KIND or not (it.get('en') or '').strip() or len(squash(zh)) < 4:
                continue
            done.add(zh)
            if any(len(squash(z)) >= 2 and squash(z) in SEEN for z in (zh, alt.get(zh, zh)) if '___' not in z):
                continue
            if '___' in zh:   # a gap: seen when its text around the blank was sent
                if any(all(p in SEEN for p in ps) and ps for ps in ([squash(p) for p in z.split('___') if len(squash(p)) >= 2] for z in (zh, alt.get(zh, zh)))):
                    continue
            line = zh + '  /  ' + (it.get('en') or '') + (('  (answer: ' + it['ans'] + ')') if it.get('ans') else '')
            (groups[k] if k in groups else other).append(line)
        n = sum(len(v) for v in groups.values())
        total += n
        if not n:
            print('HSK %d: nothing unseen' % lv)
            continue
        head = HEAD % {'lv': lv, 'prev': str(lv - 1) if lv > 1 else '0 (beginners)'}
        pieces, num = [], 0
        for k, lines in groups.items():
            if not lines:
                continue
            pieces.append('\n## %s\n' % KIND[k])
            for l in lines:
                num += 1
                pieces.append('%d. %s' % (num, l))
        files, cur = [], ''
        for p in pieces:
            if len((head + cur + p).encode('utf-8')) > MAXB and cur.strip():
                files.append(cur)
                cur = ''
            cur += p + '\n'
        files.append(cur)
        for i, body in enumerate(files):
            name = PREFIX + '%d-%d-of-%d.md' % (lv, i + 1, len(files))
            open(os.path.join(OUT, name), 'w', encoding='utf-8').write(head + body)
        print('HSK %d: %d unseen sentence(s) in %d file(s)' % (lv, n, len(files)))
    print('total', total)


main()
