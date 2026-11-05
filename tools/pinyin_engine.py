"""Shared pinyin engine: word pinyin, sentence pinyin with tone changes, and word splitting.

Used by build-words.py and build-grammar.py so every piece of content gets pinyin the same way.
Pinyin is generated (pypinyin + content/pinyin-overrides.tsv + rules for 不 and 一), never typed by hand.
"""
import os, re, tempfile
from math import log
import jieba
from pypinyin import lazy_pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')

NAMES = ['小明']
P_MAP = {'，': ',', '。': '.', '？': '?', '！': '!', '、': ',', '：': ':', '；': ';', '“': '"', '”': '"', '（': '(', '）': ')', '…': '...'}
NUMBER_PREV = '第月期十二三四五六七八九零'
DIGITS = '二三四五六七八九'
NUM_CHARS = '一二两三四五六七八九十百千零'
PROPER = {'中国', '汉语', '中文', '小明'}
DEI_PREV = {'我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '大家', '也', '还', '都', '就', '先', '再', '今天', '明天', '现在', '晚上', '早上', '下午', '中午', '以后'}   # before 得 these make it děi
ZHI_ONLY_NEXT = '是有能会想要好在可需用知爱喜吃去来看说做' + ''     # after 这/那 these start a verb, so 只 means "only"
ATTACH = {'们'}
TONES = {'ā': 1, 'ē': 1, 'ī': 1, 'ō': 1, 'ū': 1, 'ǖ': 1, 'á': 2, 'é': 2, 'í': 2, 'ó': 2, 'ú': 2, 'ǘ': 2,
         'ǎ': 3, 'ě': 3, 'ǐ': 3, 'ǒ': 3, 'ǔ': 3, 'ǚ': 3, 'à': 4, 'è': 4, 'ì': 4, 'ò': 4, 'ù': 4, 'ǜ': 4}
# words that are not in the HSK 1 list but are allowed in grammar lessons (explained in content/check-waivers.tsv)
EXTRA_TOKENS = ['杯']


def tone_of(syl):
    for ch in syl:
        if ch in TONES:
            return TONES[ch]
    return 0


def read_tsv(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip('\n')
            if line.strip() and not line.startswith('#'):
                rows.append((n, line.split('\t')))
    return rows


class _Tokenizer(jieba.Tokenizer):
    """jieba's own cut, with its ties made deterministic.
    The weights here are 1000*len**3, so two ways of cutting a string often score exactly the same
    (马路|上 and 马|路上, 不但|是 and 不|但是, 常常|用 and 常|常用). jieba breaks such a tie towards the longer
    first word, but it compares floats, so adding any word to the dictionary could flip the result by
    rounding noise alone. Rounding the scores keeps the tie a tie and so the cut always goes to the longer first word."""
    def calc(self, sentence, DAG, route):
        N = len(sentence)
        route[N] = (0, 0)
        logtotal = log(self.total)
        for idx in range(N - 1, -1, -1):
            route[idx] = max((round(log(self.FREQ.get(sentence[idx:x + 1]) or 1) - logtotal + route[x + 1][0], 8), x)
                             for x in DAG[idx])


class _TokenizerRight(_Tokenizer):
    """The same cut with ties going to the shorter first word. Only used by tools/check-ties.py to find the sentences where a tie exists."""
    def calc(self, sentence, DAG, route):
        N = len(sentence)
        route[N] = (0, 0)
        logtotal = log(self.total)
        for idx in range(N - 1, -1, -1):
            best = max((round(log(self.FREQ.get(sentence[idx:x + 1]) or 1) - logtotal + route[x + 1][0], 8), -x) for x in DAG[idx])
            route[idx] = (best[0], -best[1])


class Engine:
    def __init__(self, official):
        self.official = list(official)
        self.overrides = {r[0]: r[1] for _, r in read_tsv(os.path.join(C, 'pinyin-overrides.tsv'))}
        self.wpy = {}
        for z in self.official:
            self.wpy[z] = self.overrides.get(z) or ''.join(lazy_pinyin(z, style=Style.TONE, v_to_u=True))
        entries = {}
        for z in self.official + NAMES + EXTRA_TOKENS:
            entries[z] = 1000 * len(z) ** 3
        for z in self.official + EXTRA_TOKENS:
            for ch in z:
                entries.setdefault(ch, 50)
        entries['你好'] = 10          # "你好吗" splits as 你 / 好 / 吗
        # words written solid that are not on the HSK list (每天, 前边, 外国人 ...): content/lexicon-words.tsv
        self.lex = {}
        lp = os.path.join(C, 'lexicon-words.tsv')
        if os.path.exists(lp):
            for _, r in read_tsv(lp):
                if r[0] and r[0] not in entries:
                    self.lex[r[0]] = r[1] if len(r) > 1 else ''
                    entries[r[0]] = 1000 * len(r[0]) ** 3 + 500
        # words that win a tie: 有时间 is 有 + 时间, not 有时 + 间 (content/segment-prefer.tsv)
        pp = os.path.join(C, 'segment-prefer.tsv')
        if os.path.exists(pp):
            for _, r in read_tsv(pp):
                if r[0] in entries:
                    entries[r[0]] += 1
        tmp = tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8')
        for k, v in entries.items():
            tmp.write('%s %d\n' % (k, v))
        tmp.close()
        self.tk = _Tokenizer(dictionary=tmp.name)
        self.tk.initialize()
        os.unlink(tmp.name)

    def word_py(self, z):
        if z in self.wpy:
            return self.wpy[z]
        if self.lex.get(z):
            return self.lex[z]
        return ''.join(lazy_pinyin(z, style=Style.TONE, v_to_u=True))

    def tokens(self, zh):
        return [t for t in self.tk.cut(zh, HMM=False) if t.strip()]

    def tokens_right(self, zh):
        """The cut with ties going the other way (see _TokenizerRight)."""
        if not hasattr(self, '_tk_right'):
            import copy
            self._tk_right = copy.copy(self.tk)
            self._tk_right.__class__ = _TokenizerRight
        return [t for t in self._tk_right.cut(zh, HMM=False) if t.strip()]

    def word_tokens(self, zh):
        return [t for t in self.tokens(zh) if t not in P_MAP and t not in ('—', '——')]

    def sentence(self, zh):
        """Returns (pinyin string, list of word tokens without punctuation)."""
        toks = self.tokens(zh)
        parts = []
        for t in toks:
            if t in P_MAP:
                parts.append(('p', t, P_MAP[t]))
            elif t in ('—', '——'):
                parts.append(('d', t, '—'))
            else:
                parts.append(('w', t, self.word_py(t)))
        merged = []
        for p in parts:
            if p[0] == 'd' and merged and merged[-1][0] == 'd':
                continue
            merged.append(p)
        parts = merged
        # numbers 11-99 are one word (shíèr, èrshí)
        i = 0
        while i < len(parts):
            p = parts[i]
            if p[0] == 'w' and p[1] == '十':
                lo = hi = i
                py = p[2]
                if i > 0 and parts[i - 1][0] == 'w' and parts[i - 1][1] in DIGITS:
                    lo = i - 1
                    py = parts[i - 1][2] + py
                if i + 1 < len(parts) and parts[i + 1][0] == 'w' and parts[i + 1][1] in DIGITS + '一':
                    hi = i + 1
                    py = py + ('yī' if parts[i + 1][1] == '一' else parts[i + 1][2])
                if hi > lo or lo < i:
                    parts[lo:hi + 1] = [('w', ''.join(x[1] for x in parts[lo:hi + 1]), py)]
                    i = lo
            i += 1
        # suffix 们 attaches to the word before
        i = 1
        while i < len(parts):
            if parts[i][0] == 'w' and parts[i][1] in ATTACH and parts[i - 1][0] == 'w':
                parts[i - 1] = ('w', parts[i - 1][1] + parts[i][1], parts[i - 1][2] + parts[i][2])
                del parts[i]
            else:
                i += 1
        # 只: zhī (the measure word) after a number, or after 几 这 那 哪 每 when a noun follows; zhǐ ("only") otherwise
        for i, p in enumerate(parts):
            if p[0] == 'w' and p[1] == '只':
                prev = parts[i - 1][1] if i > 0 and parts[i - 1][0] == 'w' else ''
                nxt = parts[i + 1][1] if i + 1 < len(parts) and parts[i + 1][0] == 'w' else ''
                measure = bool(prev) and (prev[-1] in NUM_CHARS or (prev[-1] in '几这那哪每' and nxt[:1] not in ZHI_ONLY_NEXT))
                parts[i] = ('w', '只', 'zhī' if measure else 'zhǐ')
        # 得: děi ("must") before a verb after a pronoun, a time word, an adverb like 也 还 都 就 先 or at the start of a clause;
        #     dé ("to get") in 得了 + a number (他考试得了一百分); de (the particle) after a verb (跑得很快), which is the default reading
        for i, p in enumerate(parts):
            if p[0] == 'w' and p[1] == '得':
                prev = parts[i - 1] if i > 0 else None
                pw = prev[1] if prev and prev[0] == 'w' else ''
                nxt = parts[i + 1] if i + 1 < len(parts) else None
                nw = nxt[1] if nxt and nxt[0] == 'w' else ''
                nn = parts[i + 2][1] if i + 2 < len(parts) and parts[i + 2][0] == 'w' else ''
                if nw == '了' and nn and nn[0] in NUM_CHARS:
                    parts[i] = ('w', '得', 'dé')
                elif nw and nw != '了' and (prev is None or prev[0] == 'p' or pw in DEI_PREV):
                    parts[i] = ('w', '得', 'děi')
        # proper nouns get a capital
        for i, p in enumerate(parts):
            if p[0] == 'w' and p[1] in PROPER:
                parts[i] = ('w', p[1], p[2][:1].upper() + p[2][1:])
        # 不 and 一 tone changes
        for i, p in enumerate(parts):
            if p[0] != 'w' or p[1] not in ('不', '一'):
                continue
            nxt = parts[i + 1] if i + 1 < len(parts) else None
            nxt_tone = tone_of(nxt[2]) if nxt and nxt[0] == 'w' else 0
            prev = parts[i - 1][1] if i > 0 and parts[i - 1][0] == 'w' else ''
            if p[1] == '不':
                parts[i] = ('w', p[1], 'bú' if nxt_tone == 4 else 'bù')
            elif nxt is None or nxt[0] != 'w' or (prev and prev[-1] in NUMBER_PREV):
                parts[i] = ('w', p[1], 'yī')
            else:
                parts[i] = ('w', p[1], 'yí' if nxt_tone == 4 else 'yì')
        out = ''
        for p in parts:
            if p[0] == 'p':
                out += p[2] + ' '
            elif p[0] == 'd':
                out = out.rstrip() + ' — '
            else:
                out += ('ge' if p[1] == '个' else p[2]) + ' '
        out = out.strip()
        for a in (' ,', ' .', ' ?', ' !', ' :', ' ;'):
            out = out.replace(a, a[1])
        out = re.sub(r'(^|[.?!]\s+|—\s+)([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])', lambda m: m.group(1) + m.group(2).upper(), out)
        words = [p[1] for p in parts if p[0] == 'w']
        # tokens for "put the words in order": split merged numbers/suffixes back into the original tokens
        return out, [t for t in toks if t not in P_MAP and t not in ('—', '——')]
