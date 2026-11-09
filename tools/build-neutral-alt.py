#!/usr/bin/env python3
"""Writes data/neutral-alt.js: for words with a light (neutral-tone) syllable, the spelling with that syllable's OWN tone.

Typing 眼睛 as yan3jing1 (睛 is jīng on its own) is accepted as right, besides yǎnjing: a learner who knows the character's tone
should not be marked wrong for it. Not allowed (stays strict) when:
  - the word is a repeated syllable (妈妈, 谢谢, 看看): there the light second syllable IS the lesson;
  - the character has more than one reading in pypinyin (子, 么, 的 ...), so its "own tone" is not clear.
Run:  python3 tools/build-neutral-alt.py        Needs: pip install pypinyin
"""
import json, os, re, subprocess, unicodedata
from pypinyin import pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = re.compile('[̄́̌̀]')


def words():
    out = subprocess.check_output(['node', '-e', r"""
const vm=require('vm'),fs=require('fs');const ctx={window:{}};vm.createContext(ctx);
for(const f of ['hsk1-words','hsk2-words','hsk3-words'])vm.runInContext(fs.readFileSync('data/'+f+'.js','utf8'),ctx);
console.log(JSON.stringify([].concat(ctx.window.HSK1_WORDS,ctx.window.HSK2_WORDS,ctx.window.HSK3_WORDS).map(w=>[w.zh,w.py])));
"""], cwd=ROOT).decode('utf-8')
    return json.loads(out)


def letters(s):   # the letters of a syllable without tone marks (ü kept)
    d = unicodedata.normalize('NFD', s)
    return unicodedata.normalize('NFC', MARK.sub('', d)).lower().replace("'", '')


def has_mark(s):
    return bool(MARK.search(unicodedata.normalize('NFD', s)))


def take(py, n):
    """the first n base letters of py (with their marks), and the rest"""
    d = unicodedata.normalize('NFD', py)
    out, count, i = '', 0, 0
    while i < len(d) and count < n:
        c = d[i]
        out += c
        i += 1
        if unicodedata.combining(c) == 0:
            count += 1
        while i < len(d) and unicodedata.combining(d[i]) and d[i] != '̈':
            out += d[i]
            i += 1
        while i < len(d) and d[i] == '̈':
            out += d[i]
            i += 1
            while i < len(d) and unicodedata.combining(d[i]):
                out += d[i]
                i += 1
    return unicodedata.normalize('NFC', out), unicodedata.normalize('NFC', d[i:])


# words where the full-tone spelling is a DIFFERENT word, so it must not be accepted
KEEP_STRICT = {'东西', '地方', '丈夫', '大人', '爱人'}   # dōngxi thing / dōngxī east-west; dìfang place / dìfāng region; zhàngfu husband / zhàngfū man; dàren adult / dàrén sir; àiren spouse / àirén lover


# Characters that are light in some words but have a clear tone of their own, which a learner knows from the character (边 biān, 子 zǐ, 头 tóu, 里 lǐ, 得 dé, 头发's 发 fà).
# Not here: 的 了 么 们 吗 呢 (no tone of their own, or the other reading is another word).
OWN_TONE = {'边': 'biān', '子': 'zǐ', '头': 'tóu', '里': 'lǐ', '得': 'dé', '发': 'fà'}


# 一 and 不 change tone before another syllable (sandhi); their own tone is yī and bù
SANDHI = {'一': 'yī', '不': 'bù'}


def own(ch):
    """The character's own tone: its usual reading, unless the dictionary also lists a light reading of it (子 zi, 得 de, 么 me, 的 de ...)."""
    if ch in OWN_TONE:
        return OWN_TONE[ch]
    allr = pinyin(ch, style=Style.TONE, heteronym=True)[0]
    if any(not has_mark(x) for x in allr):
        return None
    d = pinyin(ch, style=Style.TONE)[0][0]
    return d if has_mark(d) else None


def main():
    alt = {}
    for zh0, py0 in words():
        zh, py = zh0, py0
        erhua = len(zh) > 1 and zh.endswith('儿') and py.rstrip().endswith('r')   # 这儿 zhèr: 儿 is ér on its own
        if erhua:
            zh, py = zh[:-1], py.rstrip()[:-1]
        if zh0 in KEEP_STRICT or (len(zh) < 2 and not erhua) or '/' in py or not all('一' <= c <= '鿿' for c in zh):
            continue
        rest = unicodedata.normalize('NFC', py.replace("'", '').replace(' ', '')).lower()   # 不客气 is written "bú kèqi" in the word list
        syl, ok = [], True
        for i, ch in enumerate(zh):
            c = pinyin(ch, style=Style.TONE, heteronym=True)[0]
            base = [letters(x) for x in c]
            # the length of this character's syllable: from the unique reading, or any reading's letters that fits
            n = None
            for b in base:
                if letters(rest).startswith(b) and (n is None or len(b) > n):
                    n = len(b)
            if n is None:
                ok = False
                break
            s, rest = take(rest, n)
            syl.append(s)
        if not ok or rest:
            continue
        opts = []   # per syllable: the written spelling, and (when there is one) the spelling with the character's own tone
        for i, s in enumerate(syl):
            o = None
            if zh[i] in SANDHI and has_mark(s) and letters(SANDHI[zh[i]]) == letters(s) and s != SANDHI[zh[i]]:   # 不要 is búyào, 一样 is yíyàng: the own tone (bù, yī) is accepted too
                o = SANDHI[zh[i]]
            elif i > 0 and not has_mark(s) and zh[i] != zh[i - 1]:   # a light syllable that is not a repeated one
                t = own(zh[i])
                if t and letters(t) == letters(s):
                    o = t
            opts.append([s] + ([o] if o else []))
        vs = ['']
        for o in opts:
            vs = [v + x for v in vs for x in o]
        variants = [v for v in vs if v != ''.join(syl)]
        if erhua:   # 这儿 zhèr: 儿 is ér on its own
            variants = [v + 'ér' for v in [''.join(syl)] + variants]
        if variants:
            alt[zh0] = '/'.join(variants)
    path = os.path.join(ROOT, 'data', 'neutral-alt.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* Words with a light (neutral) syllable, with that syllable\'s own tone: also accepted when typed. GENERATED by tools/build-neutral-alt.py. Do not edit by hand.\n')
        f.write(' * 眼睛 is yǎnjing; yǎnjīng is accepted too. Repeated words (妈妈) and characters with more than one reading are left out. */\n')
        f.write('window.SHANLU_NEUTRAL_ALT = {\n')
        f.write(',\n'.join('%s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(alt[k], ensure_ascii=False)) for k in sorted(alt)))
        f.write('\n};\n')
    print('neutral alternatives: %d words' % len(alt))
    for k in list(alt)[:25]:
        print(' ', k, alt[k])


if __name__ == '__main__':
    main()
