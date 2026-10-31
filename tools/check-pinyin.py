"""Cross-check the pinyin of every example sentence against pypinyin.
   pip install pypinyin
   python3 tools/check-pinyin.py
Compares syllable by syllable. Marked tones must match; a neutral (unmarked) syllable in our text is allowed.
Known limits: pypinyin has no tone sandhi (we write dictionary tones too), and polyphonic characters
such as 了, 得, 地 and 行 can be wrong, so look at each reported difference."""
import json, re, subprocess, sys, unicodedata
from pypinyin import pinyin, Style

js = r'''
const fs=require('fs'),vm=require('vm'),path=require('path');
const sb={window:{}}; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(process.argv[1],'data','hsk1.js'),'utf8'),sb);
const H=sb.window.HSK1; const out=[];
Object.keys(H.EX).forEach(k=>out.push(['EX '+k,H.EX[k].zh,H.EX[k].py]));
H.GRAM_EX.forEach((x,i)=>out.push(['GRAM_EX '+i,x.zh,x.py]));
H.AI.forEach((x,i)=>out.push(['AI '+i,x.zh,x.py])); H.YOU.forEach((x,i)=>out.push(['YOU '+i,x.zh,x.py]));
H.TOPICS.forEach((t,i)=>out.push(['TOPIC '+i,t.sentence.zh,t.sentence.py]));
console.log(JSON.stringify(out));
'''
root = sys.argv[1] if len(sys.argv) > 1 else '.'
items = json.loads(subprocess.check_output(['node', '-e', js, root], text=True))
norm = lambda s: unicodedata.normalize('NFC', s.lower())
def syllables(py):
    py = re.sub(r"[^A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňḿ ']", ' ', py)
    out = []
    for w in py.split():
        out += re.findall(r"[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+?(?=[bpmfdtnlgkhjqxzcsrywBPMFDTNLGKHJQXZCSRYW]|$)", w) or [w]
    return out
bad = 0
for src, zh, mine in items:
    theirs = [s[0] for s in pinyin(re.sub(r'[^一-鿿]', '', zh), style=Style.TONE)]
    ours = ''.join(re.findall(r"[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+", mine)).lower()
    want = ''.join(theirs).lower()
    if '儿' in zh: want = want.replace('ér', 'r')
    strip = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    same_letters = strip(ours).replace('ü', 'u').replace('v', 'u') == strip(want).replace('ü', 'u')
    # compare tones: allow our neutral (no mark) where theirs is marked
    def tones(s):
        return [ (unicodedata.normalize('NFD', ch)[1:] or '') for ch in s ]
    ok = same_letters
    if ok:
        for a, b in zip(unicodedata.normalize('NFC', ours), unicodedata.normalize('NFC', want)):
            ta, tb = unicodedata.normalize('NFD', a)[1:], unicodedata.normalize('NFD', b)[1:]
            if ta and tb and ta != tb: ok = False
    if not ok:
        bad += 1
        print('DIFF', src, zh, '| ours:', mine, '| pypinyin:', ' '.join(theirs))
print('pinyin differences:', bad)
sys.exit(1 if bad else 0)
