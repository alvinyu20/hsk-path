#!/usr/bin/env python3
"""Find "spot the extra word" questions where ANOTHER word could be removed too (他吃得很非常快: either 很 or 非常 can go).

Such a question marks a correct answer wrong. The fix is either a clearer question, or listing the other word as `also` in the item
(content/.../gmore.json, or the lesson file), which marks it right as well.

Usage:  python3 tools/check-spot-alternatives.py [LEVEL ...]        (default: every level 1 to 5; reads the built data/hskN-grammar.js)
Two kinds of finding:
  CERTAIN   removing the other word gives a sentence that the site itself uses as a correct sentence somewhere: it is surely fine.
            check-all fails on these unless the word is listed as `also`.
  POSSIBLE  the removed word and another word in the sentence belong to the same "can stand in for each other" group
            (degree words, 来/去, 多/几, 也/还 ...): someone has to look. If the second word really works, add it as `also`; if it does
            not (他比我很更高: without 更 it is still wrong), list it in content/spot-reviewed.tsv (wrong sentence <TAB> word <TAB> why).
            check-all fails on any CERTAIN finding without `also` and on any POSSIBLE finding that is not reviewed.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = [a for a in sys.argv[1:] if a.isdigit()] or ['1', '2', '3', '4', '5']
GROUPS = [set('很 非常 太 特别 挺 十分 比较 更 最 有点儿 有点 相当'.split()), set('来 去'.split()), set('多 几 左右 大概 大约 差不多 可能 也许'.split()),
          set('也 还 又 再 都 仍然 还是 依然 一直 老是 总是 经常 常常'.split()), set('是 就是 正是'.split()), set('因为 由于 所以 因此 于是 然后 再 接着'.split()),
          set('要 得 必须 应该 需要 想 会 能 可以'.split()), set('了 过 着'.split()), set('快 赶紧 马上 立刻 赶快'.split())]


def load(lv):
    js = "const w={};new Function('window',require('fs').readFileSync(process.argv[1],'utf8'))(w);process.stdout.write(JSON.stringify(w['HSK%s_GRAMMAR']))" % lv
    return json.loads(subprocess.run(['node', '-e', js, os.path.join(ROOT, 'data', 'hsk%s-grammar.js' % lv)], capture_output=True, text=True).stdout)


def known_sentences():
    seen = set()
    for lv in ['1', '2', '3', '4', '5']:
        out = subprocess.run(['node', os.path.join(ROOT, 'tools', 'dump-sentences.js'), lv], capture_output=True, text=True, cwd=ROOT).stdout
        for s in json.loads(out):
            if not s.get('levelOnly') and s.get('en'):
                seen.add(s['zh'])
    return seen


def reviewed():
    p = os.path.join(ROOT, 'content', 'spot-reviewed.tsv'); out = set()
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            if l.strip() and not l.startswith('#'):
                c = l.rstrip('\n').split('\t'); out.add((re.sub(r'[，。？！、：；,.?!]', '', c[0]), c[1]))
    return out


def main():
    known = known_sentences(); ok = reviewed()
    certain, possible = [], []
    for lv in LEVELS:
        G = load(lv)
        for l in G['lessons']:
            for q in (l.get('q') or []) + (l.get('qx') or []):
                if q.get('type') != 'spot':
                    continue
                toks, spot, also = q['tokens'], q['spot'], set(q.get('also') or [])
                wrong = ''.join(toks) + (q.get('punct') or '')
                rem = toks[spot]
                for i, t in enumerate(toks):
                    if i == spot or i in also:
                        continue
                    cand = ''.join(toks[:i] + toks[i + 1:]) + (q.get('punct') or '')
                    where = 'HSK %s %s: %s (extra word %s; %s could go too: %s)' % (lv, q.get('pt') or l['id'], wrong, rem, t, cand)
                    if cand in known:
                        certain.append(where)
                    elif any(rem in g and t in g for g in GROUPS) and (''.join(toks), t) not in ok:
                        possible.append(where)
    for w in certain:
        print('CERTAIN  ' + w)
    for w in possible:
        print('POSSIBLE ' + w)
    print('spot questions: %d certain and %d unreviewed possible second answers (certain ones need `also`; possible ones need `also` or a line in content/spot-reviewed.tsv)' % (len(certain), len(possible)))
    sys.exit(1 if certain or possible else 0)


if __name__ == '__main__':
    main()
