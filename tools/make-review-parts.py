#!/usr/bin/env python3
"""Review packs for the coloured grammar examples (content/example-parts.tsv, C4) and the look-alike table (content/look-alikes.tsv, D4),
to paste into DeepSeek / Qwen. Writes review/chinese-ai-new-items/colours-HSK*.md and look-alikes.md.
Run:  python3 tools/make-review-parts.py"""
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'review', 'chinese-ai-new-items')
ROLE = {'who': '主语', 'when': '时间/地点', 'does': '动作/描写', 'thing': '宾语/事物', 'k': '关键词'}
ROLE_EN = {'who': 'subject', 'when': 'time/place', 'does': 'verb/description', 'thing': 'object/thing', 'k': 'key word'}


def lessons():
    out = []
    files = [('1', f) for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'grammar-*.json')))]
    for n in '2345':
        files += [(n, f) for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'l' + n, 'grammar-*.json')))]
    for lv, f in files:
        for L in json.load(open(f, encoding='utf-8')):
            out.append((lv, L))
    return out


def cuts():
    t = {}
    for line in open(os.path.join(ROOT, 'content', 'example-parts.tsv'), encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        lid, cut = line.rstrip('\n').split('\t')
        pieces = []
        for p in cut.split(' | '):
            m = re.match(r'^(who|when|does|thing|k)=(.*)$', p)
            pieces.append((m.group(1), m.group(2)) if m else ('', p))
        t[(lid, ''.join(x for _, x in pieces))] = pieces
    return t


HEAD = """你好！我在做一个 HSK 学习网站。语法课的例句被分成几块，每块用一种颜色标出它在句子里的作用，和这一课的公式一样。
请你作为母语者和中文老师检查这些分法。**只列出有问题的地方**，不用表扬。

标记：【主语：…】【时间/地点：…】【动作/描写：…】【宾语/事物：…】【关键词：…】。没有方括号的字不上色，这是故意的。
规则：“词序”课按公式的角色上色；“框架”“选一个”“加一点”课只标出这一课的关键词（红色），别的不上色。

请检查：1) 某一块的角色标错了（比如把宾语标成主语）；2) 关键词标错或少标了（这一课真正要学的词）；3) 切分不对（一个词被切开了，或者一块里混了两个角色）。
每个问题请写：编号 / 原句 / 问题（简单的中文，再加一句英文）/ 你建议的分法。如果全部没问题，请回答“没有发现问题”。

Hello! On my HSK study site, grammar lesson examples are cut into pieces, each coloured by its job in the sentence, like the lesson's formula.
Please act as a native speaker and Chinese teacher and check the cuts. **Report only problems**, no praise.
Marks: 【主语 subject】【时间/地点 time/place】【动作/描写 verb/description】【宾语/事物 object/thing】【关键词 key word】. Text outside brackets is left uncoloured on purpose.
Rule: "word order" lessons colour the roles of the formula; "frame", "pick one" and "add-on" lessons only mark the lesson's key words (red).
Please check: 1) a piece with the wrong role; 2) a key word marked wrongly or missing (the word the lesson teaches); 3) a bad cut (a word split in two, or one piece mixing two roles).
For each problem: number / sentence / the problem (simple Chinese plus one line of English) / your suggested cut. If everything is fine, answer "No problems found".

---
"""


def shape(L):
    F = L['formula']; ft = ' '.join(x.lstrip('*=') for x in F)
    if '…' in L['title'] and re.search('因为|所以|不但|如果|只要|除了|先|越|虽然|一边', ft):
        return '框架 frame'
    if len(F) <= 3 and any(re.search('Sentence|Statement|Situation', x) for x in F):
        return '加一点 add-on'
    if '/' in ft and any(x.startswith('*') for x in F) and len(F) <= 3:
        return '选一个 pick one'
    return '词序 word order'


def main():
    T = cuts()
    packs = {'1-2': [], '3': [], '4-5': []}
    which = {'1': '1-2', '2': '1-2', '3': '3', '4': '4-5', '5': '4-5'}
    for lv, L in lessons():
        packs[which[lv]].append((lv, L))
    for name, ls in packs.items():
        lines, n = [HEAD], 0
        for lv, L in ls:
            f = ' + '.join(('【' + x[1:] + '】' if x.startswith('*') else x.lstrip('=')) for x in L['formula'])
            lines.append('\n## HSK %s · %s · %s\n公式 formula: %s\n' % (lv, L['title'], shape(L), f))
            for e in L['examples']:
                n += 1
                pcs = T.get((L['id'], e['zh']))
                s = ''.join(('【%s：%s】' % (ROLE[r], x)) if r else x for r, x in pcs) if pcs else e['zh'] + '  (没有分 / not cut)'
                lines.append('%d. %s  /  %s' % (n, s, e['en']))
        p = os.path.join(OUT, 'colours-HSK%s.md' % name)
        open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        print('wrote %s: %d examples' % (os.path.relpath(p, ROOT), n))




LOOK_HEAD = """你好！我在做一个 HSK 学习网站。选择题的错误选项里，我会放一些学习者容易看错的词：两个词长度一样，只差一个“形近字”（比如 买/卖、他/她、午/牛）。
下面是我的形近字组，以及网站上真的会一起出现的词对（同一个 HSK 级别里）。请你作为中文老师检查。**只列出有问题的地方**。
请检查：1) 某一组里的字其实不太像，学习者一般不会看错（请说明哪个字应该去掉）；2) 很常见的形近字我漏掉了（只要 HSK 1-5 里的字）；3) 某个词对放在一起做错误选项不合适（比如两个都对）。
每个问题请写：组号或词对 / 问题（简单的中文，再加一句英文）/ 建议。如果全部没问题，请回答“没有发现问题”。

Hello! On my HSK study site, some wrong answers on multiple-choice cards are words a learner could misread: same length, differing only in look-alike characters (买/卖, 他/她, 午/牛).
Below are my look-alike groups and the word pairs that really appear together on the site (within one HSK level). Please act as a Chinese teacher. **Report only problems.**
Check: 1) characters in a group that do not really look alike, so learners would not mix them up (say which to drop); 2) common look-alikes I missed (HSK 1-5 characters only); 3) a pair that is unfair as a wrong answer (e.g. both would be right).
For each problem: group number or pair / the problem (simple Chinese plus one line of English) / your suggestion. If everything is fine, answer "No problems found".

---
"""


def look_pack():
    src = open(os.path.join(ROOT, 'data', 'confusers.js'), encoding='utf-8').read()
    look = json.loads(src[src.index('= ') + 2:].rstrip().rstrip(';'))['look']
    idx_src = open(os.path.join(ROOT, 'data', 'levels-index.js'), encoding='utf-8').read()
    idx = json.loads(idx_src[idx_src.index('window.SHANLU_INDEX = ') + 22:].rstrip().rstrip(';'))
    grp = {}
    for i, g in enumerate(look):
        for ch in g:
            grp.setdefault(ch, set()).add(i)
    alike = lambda a, b: a != b and bool(grp.get(a, set()) & grp.get(b, set()))
    lines = [LOOK_HEAD, '## 形近字组 / look-alike groups\n']
    for i, g in enumerate(look, 1):
        lines.append('%d. %s' % (i, ' '.join(g)))
    lines.append('\n## 会一起出现的词对 / pairs offered together\n')
    n = 0
    for lv in sorted(idx, key=int):
        ws = idx[lv]['w']; en = {w[0]: w[2] for w in ws}; seen = set()
        pairs = []
        for a in en:
            for b in en:
                if a >= b or len(a) != len(b) or (a, b) in seen:
                    continue
                d = [(x, y) for x, y in zip(a, b) if x != y]
                if d and all(alike(x, y) for x, y in d):
                    seen.add((a, b)); pairs.append('%s (%s) / %s (%s)' % (a, en[a], b, en[b]))
        lines.append('\nHSK %s:' % lv)
        for p in pairs:
            n += 1; lines.append('%d. %s' % (n, p))
    p = os.path.join(OUT, 'look-alikes.md')
    open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('wrote %s: %d groups, %d pairs' % (os.path.relpath(p, ROOT), len(look), n))


if __name__ == '__main__':
    main()
    look_pack()
