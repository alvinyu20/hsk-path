#!/usr/bin/env python3
"""Content checks for every Chinese sentence in the app (all levels, all screens).

    node tools/dump-sentences.js 1 > /tmp/sentences.json
    python3 tools/check-content.py /tmp/sentences.json --level 1 --dataset /path/to/complete.json
    python3 tools/check-content.py --selftest          # proves the rules catch known past mistakes

What it checks (rule ids in brackets, so findings can be traced and waived):
  [level]     every word is at or below the level (dataset "newest" tags + the official list), no unknown characters
  [pinyin]    the shown pinyin matches an independent pypinyin reading (tone changes for 不/一 and neutral tones allowed)
  [meaning]   the English really says what the Chinese says: want/would like, can, negation, pronouns, numbers, times,
              dates, question marks, 吗 with question words, measure words, please/thank/sorry, tense hints
  [gloss]     every content word's gloss shows up in the English (catches wrong or missing translations)
  [style]     capital letters, final punctuation

ERROR findings fail the run. WARN findings need a human look. Known false alarms go in content/check-waivers.tsv
with a reason (where-prefix <TAB> rule <TAB> reason).
This tool can catch a lot. It cannot catch everything. A person who reads Chinese must still review the content.
"""
import argparse, collections, csv, json, os, re, sys

try:
    from pypinyin import lazy_pinyin, Style
except ImportError:
    sys.exit('pip install pypinyin')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUNCT_ZH = '，。？！、：；“”（）…—'
NAMES = {'小明'}

# ---------------------------------------------------------------- helpers
def en_words(en):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", en.lower().replace('’', "'"))


def has(en, pattern):
    return re.search(pattern, en.lower().replace('’', "'")) is not None


def strip_punct(zh):
    return ''.join(c for c in zh if c not in PUNCT_ZH and not c.isspace())


CN = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
EN_NUM = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split())}
EN_NUM.update({'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
               'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10})
MONTHS = 'january february march april may june july august september october november december'.split()


def parse_cn(s):
    total = cur = 0
    for ch in s:
        if ch in CN:
            cur = CN[ch]
        elif ch == '十':
            total += (cur or 1) * 10
            cur = 0
        elif ch == '百':
            total += cur * 100
            cur = 0
        elif ch == '千':
            total += cur * 1000
            cur = 0
    return total + cur


def en_number_set(en):
    t = en.lower()
    nums = set()
    for h, m in re.findall(r'(\d{1,2}):(\d{2})', t):
        nums.add(int(h))
        nums.add(int(m))
    t2 = re.sub(r'\d{1,2}:\d{2}', ' ', t)
    for d in re.findall(r'\d[\d,]*', t2):
        nums.add(int(d.replace(',', '')))
    for w in re.findall(r'[a-z]+', t2):
        if w in EN_NUM:
            nums.add(EN_NUM[w])
    return nums


# ---------------------------------------------------------------- meaning rules
PRONOUN_MAP = [
    ('我们', r"\b(we|us|our|ours|let's)\b"), ('你们', r'\b(you|your|yours)\b'), ('他们', r'\b(they|them|their|theirs)\b'),
    ('她们', r'\b(they|them|their|theirs)\b'), ('它们', r'\b(they|them|their|theirs)\b'),
]
SINGLE_PRON = [
    ('我', r"\b(i|me|my|mine|myself|i'm|i'll|i'd|i've)\b"), ('你', r"\b(you|your|yours|you're)\b"), ('您', r"\b(you|your)\b"),
    ('他', r"\b(he|him|his|he's)\b"), ('她', r"\b(she|her|hers|she's)\b"), ('它', r"\b(it|its|it's)\b"),
]
TIME_WORDS = [
    ('今天', r'today|this (morning|evening)|tonight'), ('明天', r'tomorrow'), ('昨天', r'yesterday'), ('今年', r'this year'),
    ('明年', r'next year'), ('去年', r'last year'), ('早上', r'morning'), ('上午', r'morning'), ('中午', r'noon|midday|lunch'),
    ('下午', r'afternoon'), ('晚上', r'evening|night|tonight|dinner'), ('白天', r'day|daytime'),
    ('星期天', r'sunday'), ('星期日', r'sunday'),
]
EN_TIME_BACK = [
    (r'\btomorrow\b', '明天'), (r'\byesterday\b', '昨天'), (r'\bnext year\b', '明年'), (r'\blast year\b', '去年'),
    (r'\bthis year\b', '今年'), (r'\bsunday\b', '星期'), (r'\bafternoon\b', '下午'),
]
MEASURE_NEEDS = {'书': '本', '衣服': '件', '猫': '只', '狗': '只'}   # noun -> required measure word (instead of the all-purpose 个)
QUESTION_WORDS = ['什么', '谁', '哪', '几', '多少', '怎么', '怎么样', '哪儿', '哪里']
LEXICAL_NEG = ['不客气', '对不起', '没关系', '没事', '不好意思']
PAST_EN = r"\b(ate|bought|saw|heard|went|was|were|did|drank|had|got|said|took|came|made|read|wrote|studied|worked|lived|asked|called|finished|\w+ed)\b"
PAST_ADJ = {'tired', 'excited', 'interested', 'married', 'bored', 'surprised', 'crowded', 'need', 'seed', 'speed', 'red', 'bed', 'weed', 'indeed', 'hundred', 'thousand'}


def meaning_checks(zh, en):
    out = []                                   # (severity, rule, message)
    e = en.lower().replace('’', "'")
    e_full = e                                                 # keeps "may" for the month check
    e = re.sub(r'\bmay (\d)', r'MONTH \1', e)               # May 1st is a month, not "may"
    e = e.replace('excuse me', 'excuse')                       # "me" in "excuse me" is not the pronoun
    z = zh
    zc = strip_punct(zh)

    # want / would like
    if re.search(r"\b(want|wants|wanted|would (?:you |he |she |they )?like|'d like|wish)\b", e) and not re.search('想|要|希望|愿意', z):
        out.append(('ERROR', 'meaning', 'English says "want / would like" but the Chinese has no 想 or 要'))
    if re.search('想', z) and not re.search(r"want|would (?:you |he |she |they )?like|'d like|think|miss|feel|plan|wish|going to|will|need", e):
        out.append(('WARN', 'meaning', '想 in the Chinese but no want/think/miss in the English'))
    if re.search('要', z.replace('不要', '').replace('需要', '')) and not re.search(r"want|would (?:you |he |she |they )?like|'d like|need|will|going to|have|take|'ll|must|should|order|get|require", e):
        out.append(('WARN', 'meaning', '要 in the Chinese but no want/need/will in the English'))
    # habitual vs offer
    if re.search(r'^(would you|do you want|would he|would she)\b', e) and not re.search('想|要|可以|愿意', z):
        out.append(('ERROR', 'meaning', 'English is an offer ("would you / do you want") but the Chinese is a plain habit question (needs 想/要)'))

    # can / may
    if re.search(r"\b(can|can't|cannot|could|able to|may|allowed|know how)\b", e) and not re.search('会|能|可以', z):
        out.append(('ERROR', 'meaning', 'English says can/may/able but the Chinese has no 会 / 能 / 可以'))
    if re.search('会|能|可以', z) and not re.search(r"can|could|able|may|allowed|know how|will|might|should|be able|please", e):
        out.append(('WARN', 'meaning', '会/能/可以 in the Chinese but no can/may/will in the English'))

    # negation
    zneg = z
    for p in LEXICAL_NEG:
        zneg = zneg.replace(p, '')
    zneg = re.sub(r'(.{1,2})[不没]\1', '', zneg)   # A-not-A questions: 是不是, 有没有, 喜欢不喜欢
    zneg = zneg.replace('不要', '不要')
    en_neg = re.search(r"\b(not|no|never|don't|doesn't|isn't|aren't|won't|can't|cannot|didn't|nothing|nobody|without|isn't)\b|n't", e)
    if re.search('不|没|别|无', zneg) and not en_neg and not re.search(r"\b(don't|do not|never|few|little|nothing|nobody)\b", e):
        # 没有 meaning "don't have" always shows up as a negative; 没 in 没事 is stripped above
        out.append(('ERROR', 'meaning', 'Chinese has a negative (不/没) but the English has no negative'))
    if en_neg and not re.search('不|没|别|无|少', z) and not re.search(r'\bno problem\b', e):
        out.append(('ERROR', 'meaning', 'English has a negative but the Chinese has no 不/没/别'))

    # pronouns (Chinese -> English)
    zp = re.sub('你好|您好|你们好|大家好', '', z)
    for pz, pat in PRONOUN_MAP:
        if pz in zp:
            if not re.search(pat, e):
                out.append(('ERROR', 'meaning', '%s in the Chinese but no matching pronoun in the English' % pz))
            zp = zp.replace(pz, '')
    imperative = re.match(r"^(please |let's |have |come |take |go |listen|sit |look |wait|read |write |say |speak |eat |drink |try |give |call |ask |tell |stop|don't|do not|be |buy |open |close |turn )", e)
    for pz, pat in SINGLE_PRON:
        if pz in zp and not re.search(pat, e) and not (imperative and pz in '你您'):
            out.append(('ERROR', 'meaning', '%s in the Chinese but no matching pronoun in the English' % pz))
    # pronouns (English -> Chinese), only for the clear ones
    # (possessives like "his room" are often left out in Chinese, so only subject pronouns are checked this way)
    if re.search(r"\b(he|she)\b", e) and not re.search('他|她', z):
        out.append(('WARN', 'meaning', 'English has he/she but the Chinese has no 他/她'))
    if re.search(r"\bi\b|\bi'm\b", e) and '我' not in z:
        out.append(('WARN', 'meaning', 'English has "I" but the Chinese has no 我'))
    if (re.search(r"\bwe\b", e) or (re.search(r"\blet's\b", e) and '吧' not in z)) and not re.search('我们|咱们', z):
        out.append(('WARN', 'meaning', 'English has "we" but the Chinese has no 我们'))

    # question marks and 吗
    if zh.count('？') != en.count('?'):
        out.append(('ERROR', 'meaning', 'question mark count differs between Chinese (%d) and English (%d)' % (zh.count('？'), en.count('?'))))
    if '吗' in z and any(q in re.sub('什么时候', '', z) for q in QUESTION_WORDS):
        out.append(('WARN', 'meaning', '吗 together with a question word: usually a mistake (unless 什么/哪 means "some/any")'))
    if '吗' in z and re.search(r'(.{1,2})[不没]\1', z):
        out.append(('ERROR', 'meaning', '吗 together with an A-not-A question'))

    # times, dates, numbers
    for tz, pat in TIME_WORDS:
        if tz in z and not re.search(pat, e):
            out.append(('ERROR', 'meaning', '%s in the Chinese but the English does not say it' % tz))
    for pat, tz in EN_TIME_BACK:
        if re.search(pat, e) and tz not in z:
            out.append(('ERROR', 'meaning', 'English says "%s" but the Chinese has no %s' % (pat.strip('\\b'), tz)))
    zvals = set()
    for m in re.finditer(r'[零一二两三四五六七八九十百千]+', zc):
        s, st, ed = m.group(0), m.start(), m.end()
        before = zc[st - 1] if st > 0 else ''
        after = zc[ed] if ed < len(zc) else ''
        if before == '第':
            continue
        if after in '月号日点' and after:
            continue
        if after == '分' and not zc[ed:ed + 2] == '分钟':
            continue
        v = parse_cn(s)
        if v == 1:
            continue
        if re.fullmatch(r'十[零一二三四五六七八九]?', s) and before in '' and False:
            continue
        zvals.add(v)
    # times and dates
    for m in re.finditer(r'([零一二两三四五六七八九十]+)点(半|([零一二三四五六七八九十]+)分)?', zc):
        zvals.add(parse_cn(m.group(1)))
        if m.group(2) == '半':
            if not re.search(r'half|:30|thirty', e):
                out.append(('ERROR', 'meaning', '半 in the time but the English does not say half past / :30'))
        elif m.group(3):
            zvals.add(parse_cn(m.group(3)))
    for m in re.finditer(r'([零一二三四五六七八九十]+)月', zc):
        mo = parse_cn(m.group(1))
        if not (1 <= mo <= 12) or MONTHS[mo - 1] not in e_full:
            if 1 <= mo <= 12:
                out.append(('ERROR', 'meaning', 'month %s should be %s in the English' % (m.group(1), MONTHS[mo - 1].title())))
    for m in re.finditer(r'月([零一二三四五六七八九十]+)[号日]', zc):
        zvals.add(parse_cn(m.group(1)))
    for m in re.finditer(r'([零一二三四五六七八九十]+)[号日]', zc):
        zvals.add(parse_cn(m.group(1)))
    evals = en_number_set(en)
    evals.discard(1)
    for v in zvals:
        if v != 1 and v not in evals:
            out.append(('ERROR', 'meaning', 'number %d in the Chinese is not in the English' % v))
    month_nums = set()
    for m in re.finditer(r'([零一二三四五六七八九十]+)月', zc):
        month_nums.add(parse_cn(m.group(1)))
    for v in evals:
        if v not in zvals and v not in (1,) and not any(w in e for w in ('half',)):
            out.append(('WARN', 'meaning', 'number %d in the English is not in the Chinese' % v))
    if '半' in z and not re.search(r'half|:30|thirty', e):
        out.append(('ERROR', 'meaning', '半 in the Chinese but the English does not say half'))
    if re.search(r'\bhalf\b', e) and '半' not in z:
        out.append(('ERROR', 'meaning', 'English says half but the Chinese has no 半'))

    # measure words
    for noun, needs in MEASURE_NEEDS.items():
        if re.search('[零一二两三四五六七八九十几]个' + noun, z):
            out.append(('ERROR', 'meaning', '%s takes the measure word %s, not 个' % (noun, needs)))
    for mw, nouns in (('本', '书'), ('件', '衣事'), ('口', '人')):
        for m in re.finditer(r'[零一二两三四五六七八九十几]' + mw + r'(.)', zc):
            nxt = m.group(1)
            ok = nxt in nouns or (mw == '件' and nxt in '新')
            if mw == '口' and nxt not in '人':
                ok = False
            if not ok and not (mw == '本' and nxt in '新好小大'):
                out.append(('WARN', 'meaning', 'measure word %s followed by %s: check it fits' % (mw, nxt)))

    # please, thanks, sorry, hello
    if re.search(r'\bplease\b', e) and '请' not in z:
        out.append(('ERROR', 'meaning', 'English says please but the Chinese has no 请'))
    if re.search(r'\bthank', e) and '谢' not in z:
        out.append(('ERROR', 'meaning', 'English says thanks but the Chinese has no 谢'))
    if re.search(r'\bsorry\b', e) and not re.search('对不起|不好意思', z):
        out.append(('ERROR', 'meaning', 'English says sorry but the Chinese has no 对不起'))
    if '请' in z.replace('请问', '') and not re.search(r'please|invite|ask|excuse', e):
        out.append(('WARN', 'meaning', '请 in the Chinese but no please/invite in the English'))

    # tense hints
    toks_past = [w for w in re.findall(r"[a-z]+", e) if re.fullmatch(r'\w+ed', w) and w not in PAST_ADJ] + [w for w in re.findall(r'[a-z]+', e) if w in ('ate', 'bought', 'saw', 'heard', 'went', 'drank', 'had', 'got', 'said', 'took', 'came', 'made', 'wrote', 'was', 'were', 'did')]
    if toks_past and not re.search('了|没|昨天|去年|过|以前|是.*的|看见|听见', z):
        out.append(('WARN', 'meaning', 'English is in the past (%s) but the Chinese has no 了 or past time word' % toks_past[0]))
    if '了' in z and '太' not in z and not re.search(r"\b(\w+ed|ate|bought|saw|heard|went|drank|had|got|said|took|came|made|wrote|was|were|did|is now|are now|has|have|already|now|'s|turned|become|became|got|over|finished|ill|sick|snowed|raining|late)\b", e):
        out.append(('WARN', 'meaning', '了 in the Chinese: English shows no completed action or change of state'))
    # ZH 在 + verb = in progress
    if re.search('正在|(?<![不要])在(看|吃|喝|做|写|读|听|打|找|玩|睡|说话)', z) and not re.search(r'\b\w+ing\b|\bright now\b|\bat\b|\bin\b', e):
        out.append(('WARN', 'meaning', '在 + verb (in progress) but the English has no -ing form'))
    return out


# ---------------------------------------------------------------- style
def style_checks(zh, en):
    out = []
    if not re.search(r'[。？！]$', zh.strip()):
        out.append(('WARN', 'style', 'Chinese does not end with 。？！'))
    if en and not re.search(r'[.?!")]$', en.strip()):
        out.append(('WARN', 'style', 'English does not end with punctuation'))
    if en and not re.match(r'[A-Z"]', en.strip()):
        out.append(('WARN', 'style', 'English does not start with a capital letter'))
    return out


# ---------------------------------------------------------------- level
def load_vocab(dataset_path, level, official_dir):
    higher, allowed = {}, set(NAMES)
    if dataset_path and os.path.exists(dataset_path):
        for w in json.load(open(dataset_path, encoding='utf-8')):
            lv = [int(t.split('-')[1]) for t in w['level'] if t.startswith('newest-') and t.split('-')[1].isdigit()]
            if t.startswith('newest-7') if False else False:
                pass
            lv2 = [7 if t == 'newest-7' else int(t.split('-')[1]) for t in w['level'] if t.startswith('newest-')]
            if not lv2:
                continue
            m = min(lv2)
            if m <= level:
                allowed.add(w['simplified'])
            else:
                higher[w['simplified']] = m
    for n in range(1, level + 1):
        for fn in os.listdir(official_dir):
            if re.match(r'hsk%d-official.*\.txt$' % n, fn):
                for l in open(os.path.join(official_dir, fn), encoding='utf-8'):
                    if l.strip():
                        allowed.add(l.strip())
    extra = os.path.join(official_dir, 'allowed-extra.tsv')
    if os.path.exists(extra):
        for line in open(extra, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if p and p[0] and not line.startswith('#'):
                allowed.add(p[0])
    return allowed, higher


def segment(zh, allowed, higher):
    """Cheapest split into words: allowed word = 0, higher-level word = 1, unknown single character = 3."""
    text = ''.join(c for c in zh if c not in PUNCT_ZH and not c.isspace() and not c.isascii())
    n = len(text)
    best = [(0, [])] + [None] * n
    for i in range(1, n + 1):
        cands = []
        for j in range(max(0, i - 6), i):
            w = text[j:i]
            if best[j] is None:
                continue
            if w in allowed:
                cost = 0
            elif w in higher and len(w) > 1:
                cost = 1
            elif len(w) == 1:
                cost = 3
            else:
                continue
            cands.append((best[j][0] + cost, len(best[j][1]) + 1, best[j][1] + [w]))
        if cands:
            c = min(cands, key=lambda x: (x[0], x[1]))
            best[i] = (c[0], c[2])
    return best[n][1] if best[n] else list(text)


# ---------------------------------------------------------------- pinyin
TONE_MARKS = {'ā': ('a', 1), 'á': ('a', 2), 'ǎ': ('a', 3), 'à': ('a', 4), 'ē': ('e', 1), 'é': ('e', 2), 'ě': ('e', 3), 'è': ('e', 4),
              'ī': ('i', 1), 'í': ('i', 2), 'ǐ': ('i', 3), 'ì': ('i', 4), 'ō': ('o', 1), 'ó': ('o', 2), 'ǒ': ('o', 3), 'ò': ('o', 4),
              'ū': ('u', 1), 'ú': ('u', 2), 'ǔ': ('u', 3), 'ù': ('u', 4), 'ǖ': ('v', 1), 'ǘ': ('v', 2), 'ǚ': ('v', 3), 'ǜ': ('v', 4), 'ü': ('v', 0)}


def split_display(py, exp):
    """Cut the displayed pinyin into syllables, guided by the expected toneless syllables. Returns list of (letters, tone) or None."""
    s = re.sub(r"[\s'.,!?;:\"—/-]", '', py)
    letters, tones = [], []
    for ch in s:
        if ch in TONE_MARKS:
            base, t = TONE_MARKS[ch]
            letters.append(base)
            tones.append(t)
        else:
            letters.append(ch.lower())
            tones.append(0)
    res, pos = [], 0
    for syl in exp:
        if syl == 'er' and pos < len(letters) and letters[pos] == 'r' and (pos + 1 >= len(letters) or letters[pos + 1] != 'e'):
            res.append(('r', tones[pos]))   # erhua written as r
            pos += 1
            continue
        L = len(syl)
        if ''.join(letters[pos:pos + L]) != syl:
            return None
        t = next((tones[k] for k in range(pos, pos + L) if tones[k]), 0)
        res.append((syl, t))
        pos += L
    if pos != len(letters):
        return None
    return res


def pinyin_check(zh, py):
    if not py:
        return []
    chars = [c for c in zh if c not in PUNCT_ZH and not c.isspace()]
    zc = ''.join(chars)
    exp = lazy_pinyin(zc, style=Style.TONE3, v_to_u=False, neutral_tone_with_five=True)
    exp_syl = [re.sub(r'\d', '', s).replace('ü', 'v') for s in exp]
    exp_syl = ['shei' if chars[k] == '谁' else x for k, x in enumerate(exp_syl)]
    exp_tone = [int(re.findall(r'\d', s)[0]) if re.findall(r'\d', s) else 0 for s in exp]
    exp_tone = [0 if t == 5 else t for t in exp_tone]
    disp = split_display(py, exp_syl)
    if disp is None:
        return [('ERROR', 'pinyin', 'pinyin letters do not match pypinyin (%s)' % ' '.join(exp))]
    out = []
    for k, ((syl, t), et) in enumerate(zip(disp, exp_tone)):
        ch = chars[k]
        if t == et or t == 0 or ch in '不一' or (et == 0):
            continue
        if ch in '个了的们吗吧呢么':
            continue
        out.append(('WARN', 'pinyin', 'tone differs at %s: shown %s, pypinyin %s' % (ch, t, et)))
    return out


# ---------------------------------------------------------------- gloss coverage
STOP = set('to a an the of in on for be one something someone it is as with your by used also before after its and or at from into than that this these those you your his her their my me i we us'.split())


def gloss_keys(gloss, extra):
    keys = set()
    for w in re.findall(r"[a-z]+", re.sub(r'\(.*?\)', ' ', gloss.lower())):
        if w not in STOP and len(w) >= 3:
            keys.add(w)
    for w in extra:
        keys.add(w.strip().lower())
    return keys


def en_has_key(en_tokens, key):
    k = key.lower()
    stem = k[:-1] if k.endswith('e') and len(k) > 3 else k
    stem = stem if len(stem) >= 3 else k
    return any(t == k or t.startswith(stem) for t in en_tokens)


def load_words_for_gloss(level):
    p = os.path.join(ROOT, 'data', 'hsk%d-words.js' % level)
    if not os.path.exists(p):
        return {}
    txt = open(p, encoding='utf-8').read()
    body = txt[txt.index('['):txt.rindex(']') + 1]
    data = json.loads(body)
    return {w['zh']: w for w in data}


# ---------------------------------------------------------------- self test
SELFTEST_BAD = [
    ('你喝热茶吗？', 'Do you want hot tea?', 'meaning'),
    ('好的。你想喝热茶吗？', 'Okay. Would you like hot tea?', None),
    ('你吃东西吗？', 'Would you like something to eat?', 'meaning'),
    ('我有三个书。', 'I have three books.', 'meaning'),
    ('我有两只书。', 'I have two books.', None),   # not covered by rule table on purpose: documented limitation
    ('我想去中国。', 'I go to China.', 'meaning'),
    ('他是我的老师。', 'She is my teacher.', 'meaning'),
    ('我们都是学生。', 'They are all students.', 'meaning'),
    ('我不是老师。', 'I am a teacher.', 'meaning'),
    ('现在是八点零五分。', 'It is 8:15 now.', 'meaning'),
    ('明天你去学校吗？', 'Did you go to school yesterday?', 'meaning'),
    ('你是学生吗？', 'You are a student.', 'meaning'),
    ('你想吃什么吗？', 'What do you want to eat?', 'meaning'),
    ('请坐。', 'Sit down.', 'meaning'),
]
SELFTEST_GOOD = [
    ('你想喝热茶吗？', 'Would you like hot tea?'), ('我有三本书。', 'I have three books.'), ('谢谢！——不客气。', "Thank you! You're welcome."),
    ('今天是十月三十号。', 'Today is October 30th.'), ('现在七点半。', 'It is half past seven now.'), ('我会说一点儿汉语。', 'I can speak a little Chinese.'),
    ('我有一只猫。', 'I have a cat.'), ('你好，我叫小明。', 'Hello, my name is Xiaoming.'),
]


def selftest():
    fails = 0
    for zh, en, expect in SELFTEST_BAD:
        found = [f for f in meaning_checks(zh, en) if f[0] == 'ERROR' or f[0] == 'WARN']
        if expect and not found:
            print('SELFTEST FAIL: not caught:', zh, '/', en)
            fails += 1
        elif expect is None and found and zh == '好的。你想喝热茶吗？':
            print('SELFTEST FAIL: false alarm on a correct pair:', zh, '/', en, found)
            fails += 1
    for zh, en in SELFTEST_GOOD:
        found = [f for f in meaning_checks(zh, en) if f[0] == 'ERROR']
        if found:
            print('SELFTEST FAIL: false alarm:', zh, '/', en, found)
            fails += 1
    print('selftest: %s' % ('FAILED (%d)' % fails if fails else 'ok'))
    return fails


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sentences', nargs='?')
    ap.add_argument('--level', type=int, default=1)
    ap.add_argument('--dataset', default='')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--quiet', action='store_true', help='only print ERRORs and the summary')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(1 if selftest() else 0)
    if not a.sentences:
        ap.error('give the sentences json (from tools/dump-sentences.js)')
    items = json.load(open(a.sentences, encoding='utf-8'))

    waivers = []
    wp = os.path.join(ROOT, 'content', 'check-waivers.tsv')
    if os.path.exists(wp):
        for line in open(wp, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if len(p) >= 3 and not line.startswith('#'):
                waivers.append((p[0], p[1], p[2]))

    allowed, higher = load_vocab(a.dataset, a.level, os.path.join(ROOT, 'content'))
    allowed_chars = {c for w in allowed for c in w}
    gwords = load_words_for_gloss(a.level)
    syn = {}
    sp = os.path.join(ROOT, 'content', 'gloss-synonyms.tsv')
    if os.path.exists(sp):
        for line in open(sp, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if len(p) >= 2 and not line.startswith('#'):
                syn[p[0]] = p[1].split(',')

    findings = []
    for it in items:
        zh, py, en, where = it['zh'], it.get('py', ''), it.get('en', ''), it['where']
        found = []
        # level
        for w in segment(zh, allowed, higher):
            if w in allowed:
                continue
            if it.get('levelOnly') and len(w) == 1 and w in allowed_chars:
                continue                                  # a single character quoted from a word of the level
            if w in higher:
                found.append(('ERROR', 'level', 'word above level %d: %s (level %d)' % (a.level, w, higher[w])))
            else:
                found.append(('ERROR', 'level', 'unknown or out-of-list character: %s' % w))
        if en and not it.get('levelOnly'):
            found += meaning_checks(zh, en)
            found += style_checks(zh, en)
        if not it.get('levelOnly'):
            found += pinyin_check(zh, py)
        # gloss coverage
        if en and gwords and it.get('word') in gwords:
            toks = en_words(en)
            w = it['word']
            g = gwords[w]
            if g['pos'] in ('n', 'v', 'adj', 'time'):
                keys = gloss_keys(g['en'], syn.get(w, []))
                if keys and not any(en_has_key(toks, k) for k in keys):
                    found.append(('WARN', 'gloss', 'the word being taught, %s (%s), is not reflected in the English' % (w, g['en'])))
        for sev, rule, msg in found:
            waived = next((r for p, ru, r in waivers if where.startswith(p) and ru == rule), None)
            findings.append((sev, rule, where, zh, en, msg, waived))

    errors = [f for f in findings if f[0] == 'ERROR' and not f[6]]
    warns = [f for f in findings if f[0] == 'WARN' and not f[6]]
    waived = [f for f in findings if f[6]]
    for f in sorted(findings, key=lambda x: (x[0] != 'ERROR', x[1], x[2])):
        if f[6]:
            continue
        if a.quiet and f[0] != 'ERROR':
            continue
        print('%s [%s] %s\n    %s  /  %s\n    -> %s' % (f[0], f[1], f[2], f[3], f[4], f[5]))
    print('\nchecked %d sentences: %d errors, %d warnings to review, %d waived' % (len(items), len(errors), len(warns), len(waived)))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
