#!/usr/bin/env python3
"""Builds data/journey.js from the region files in content/journey/*.txt.   Run:  python3 tools/build-journey.py [--check]   (needs: pip install pypinyin jieba)

A region file (one per region) looks like this; lines starting with # are notes:

  region: sichuan | 四川 | Sichuan                           id | Chinese | English (| hue 0-360, optional: the default is in journey.js)
  muni: Chongqing | Chongqing is its own municipality ...       (optional, may repeat) a municipality shown inside this region, and the note shown once when it is first reached
  air: 成都天府国际机场 | Chengdu Tianfu International Airport | TFU | 30.32 | 104.44 | note | fun | pinyin
  city: chengdu | 成都 | Chengdu | 30.67 | 104.07 | note | fun | pinyin | Chongqing      the FIRST city is the one the airport serves; the last field names a muni: municipality it belongs to
  A | 宽窄/巷子 | Wide and Narrow Alleys | note | fun | 30.67,104.05 | pinyin       A attraction, D dish, C culture (belong to the city above)

Only the Chinese and English names are required on a stop. The pinyin is worked out from the Chinese (pypinyin); put / between the words of a long
name to get spaces and capitals right (宽窄/巷子 -> Kuānzhǎi Xiàngzi). Give the pinyin as the last field to override it. Everything after the English
name is optional; leave a field empty to skip it. Coordinates are approximate until the Wikidata step refines them.
"""
import json, os, re, sys, glob
from pypinyin import pinyin, Style

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'content', 'journey')
OUT = os.path.join(ROOT, 'data', 'journey.js')
OVR = os.path.join(SRC, 'pinyin-overrides.tsv')   # zh<TAB>pinyin for names the automatic reading gets wrong

overrides = {}
if os.path.exists(OVR):
    for ln in open(OVR, encoding='utf8'):
        ln = ln.rstrip('\n')
        if ln and not ln.startswith('#') and '\t' in ln:
            a, b = ln.split('\t', 1); overrides[a.strip()] = b.strip()

VOWEL = set('aāáǎàoōóǒòeēéěè')
def seg_py(seg):
    if seg in overrides: return overrides[seg]
    syl = [x[0] for x in pinyin(seg, style=Style.TONE, errors='default', v_to_u=True)]
    out = ''
    for i, s in enumerate(syl):
        if i and s and s[0] in VOWEL and re.match(r'^[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüê]+$', syl[i - 1] or ''): out += '’'
        out += s
    return out

try:
    import jieba, logging
    jieba.setLogLevel(logging.WARNING)
except Exception:
    jieba = None   # without jieba the names are read as one run, so install it (pip install jieba) before building

GENERIC = sorted('''国家森林公园 森林公园 国家公园 国际机场 国际大巴扎 风景名胜区 风景区 旅游区 文化旅游区 博物院 博物馆 纪念馆 纪念堂 纪念碑 大学 公园 广场 大桥 长城 古镇 古城 古村 老街 夜市 遗址 石窟 大峡谷 峡谷 瀑布 湿地 海滩 国家地质公园 地质公园 保护区 发射中心 中心 学院 书院 故居 陵园 文化城 古墓 水库 草原 古道 度假区 乐园 景区 古寨 苗寨 侗寨 村寨 天主教堂 教堂 清真寺 大寺 古堡 山庄 火车站 保护区'''.split(), key=len, reverse=True)
SINGLE = '寺 庙 宫 塔 桥 湖 山 岛 洞 园 馆 楼 阁 殿 祠 陵 墓 关 港 湾 滩 河 江 海 泉 谷 岭 峰 崖 沟 洲 岩 窟 坊 街 路 堂 院 城 村 镇 寨 坝 林 池 潭 渡 门 台 亭 观 庵'.split()

def split_generic(w):
    # a long name that jieba kept whole: put the generic ending (park, temple, lake...) in its own word
    if len(w) < 4 or re.match(r'^[A-Za-z0-9 ]+$', w): return [w]
    for g in GENERIC:
        if w.endswith(g) and len(w) - len(g) >= 2: return [w[:-len(g)], g]
    for g in SINGLE:
        if w.endswith(g) and len(w) - 1 >= 3: return [w[:-1], g]
    return [w]

def words(zh):
    # split a name into words for the pinyin: jieba finds the words, and runs of single characters (a name jieba does not know) stay together
    if not jieba or len(zh) < 3: return [zh]
    out = []; run = ''
    for t in jieba.lcut(zh):
        if len(t) == 1 and not re.match(r'^[A-Za-z0-9]$', t): run += t; continue
        if run: out.append(run); run = ''
        out.append(t)
    if run: out.append(run)
    res = []
    for w in out: res += split_generic(w)
    return res

def zh_py(zh, kind):
    if zh in overrides: return overrides[zh]
    segs = zh.split('/') if '/' in zh else words(zh)
    parts = [seg_py(s) for s in segs]
    if kind in ('A', 'T', 'P'): parts = [p[:1].upper() + p[1:] for p in parts]
    s = ' '.join(parts)
    if kind in ('D', 'C'): s = s[:1].upper() + s[1:]
    return s

def fields(line, n):
    f = [x.strip() for x in line.split('|')]
    return f + [''] * (n - len(f))

def num(x):
    x = x.strip()
    return float(x) if x else None

NOTES = os.path.join(SRC, 'notes')   # per region: zh<TAB>*<TAB>note  (the longer description of a stop, and * if it is a must-see; see content/journey/notes/README.txt)

def load_notes(rid):
    out = {}
    p = os.path.join(NOTES, rid + '.tsv')
    if not os.path.exists(p): return out
    for no, ln in enumerate(open(p, encoding='utf8'), 1):
        ln = ln.rstrip('\n')
        if not ln.strip() or ln.startswith('#'): continue
        f = ln.split('\t')
        if len(f) != 3 or not f[0].strip(): out[('bad', no)] = ln; continue
        out[f[0].strip()] = (f[1].strip() == '*', f[2].strip(), no)
    return out

def build():
    regions = []; problems = []
    for path in sorted(glob.glob(os.path.join(SRC, '*.txt'))):
        R = None; C = None; muni = None; NT = None; used = set()
        for no, raw in enumerate(open(path, encoding='utf8'), 1):
            line = raw.strip()
            if not line or line.startswith('#'): continue
            where = os.path.basename(path) + ':' + str(no)
            try:
                if line.startswith('region:'):
                    f = fields(line[7:], 4)
                    R = {'id': f[0], 'zh': f[1].replace('/', ''), 'py': zh_py(f[1], 'T'), 'en': f[2], 'cities': []}
                    NT = load_notes(f[0]); used = set()
                    if f[3]: R['hue'] = int(f[3])
                    regions.append(R)
                elif line.startswith('muni:'):
                    f = fields(line[5:], 2); muni = f[0]; R.setdefault('munis', {})[f[0]] = f[1]
                elif line.startswith('air:'):
                    f = fields(line[4:], 8)
                    R['air'] = {'zh': f[0].replace('/', ''), 'py': f[7] or zh_py(f[0], 'P'), 'en': f[1], 'code': f[2], 'lat': num(f[3]), 'lon': num(f[4]), 'note': f[5], 'fun': f[6]}
                elif line.startswith('city:'):
                    f = fields(line[5:], 9)
                    C = {'id': f[0], 'zh': f[1].replace('/', ''), 'py': f[7] or zh_py(f[1], 'T'), 'en': f[2], 'lat': num(f[3]), 'lon': num(f[4]), 'note': f[5], 'fun': f[6], 'stops': []}
                    if f[8]: C['muni'] = muni if f[8] == 'muni' else f[8]
                    if C.get('muni') and C['muni'] not in R.get('munis', {}): problems.append(where + ' unknown municipality ' + C['muni'])
                    if C['lat'] is None or C['lon'] is None: problems.append(where + ' city without coordinates')
                    R['cities'].append(C)
                elif line[:1] in 'ADC' and line[1:2] in ' |':
                    f = fields(line[line.index('|') + 1:], 6)
                    k = line[0]
                    ll = [x for x in f[4].replace(' ', '').split(',') if x] if f[4] else []
                    s = [k, f[0].replace('/', ''), f[5] or zh_py(f[0], k), f[1], f[2], f[3]]
                    if len(ll) == 2: s += [float(ll[0]), float(ll[1])]
                    nt = NT.get(s[1]) if NT else None
                    if nt:
                        used.add(s[1]); s[4] = nt[1]
                        if nt[0]:
                            while len(s) < 8: s.append(None)
                            s.append(1)
                    while s and s[-1] in ('', None): s.pop()
                    if not f[0] or not f[1]: problems.append(where + ' needs a Chinese and an English name')
                    C['stops'].append(s)
                else:
                    problems.append(where + ' not understood: ' + line[:50])
            except Exception as e:
                problems.append(where + ' ' + repr(e))
        if R and NT:
            for k, v in NT.items():
                if isinstance(k, tuple): problems.append('notes/%s.tsv:%d not understood (zh<TAB>*<TAB>note): %s' % (R['id'], k[1], v[:40]))
                elif k not in used: problems.append('notes/%s.tsv:%d %s is not a stop of this region' % (R['id'], v[2], k))
            nstops = sum(len(c['stops']) for c in R['cities']); nsp = sum(1 for c in R['cities'] for t in c['stops'] if len(t) > 8)
            if nsp > max(3, round(nstops * 0.12)): problems.append('%s has %d must-see stops of %d (keep it to about 5-10%%)' % (R['id'], nsp, nstops))
        if R and not R.get('air'): problems.append(path + ' has no air: line')
        if R and not R['cities']: problems.append(path + ' has no cities')
    # an airport sits in the first city
    return regions, problems

def main():
    regions, problems = build()
    # tidy: drop empty strings to keep the file small
    def trim(o):
        if isinstance(o, dict): return {k: trim(v) for k, v in o.items() if v not in ('', None) or k in ('note',)}
        if isinstance(o, list): return [trim(x) for x in o]
        return o
    data = {'regions': trim(regions)}
    js = '/* GENERATED by tools/build-journey.py from content/journey/*.txt. Do not edit by hand. */\nwindow.JOURNEY = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    n = sum(len(c['stops']) + 1 for r in regions for c in r['cities']) + len(regions)
    for p in problems: print('PROBLEM', p)
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf8').read() if os.path.exists(OUT) else ''
        if cur != js: print('data/journey.js is out of date: run python3 tools/build-journey.py'); sys.exit(1)
        sys.exit(1 if problems else 0)
    open(OUT, 'w', encoding='utf8').write(js)
    print('wrote', OUT, len(js), 'bytes;', len(regions), 'regions;', n, 'stops incl. cities and airports')
    sys.exit(1 if problems else 0)

main()
