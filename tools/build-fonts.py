#!/usr/bin/env python3
"""Builds the fonts/ folder: the three typefaces the site uses, trimmed to the characters it needs, so the page does not load
anything from Google Fonts (works offline, and visitors' addresses are not sent to Google).

  python3 tools/build-fonts.py [dir-with-node_modules]

Needs: pip install fonttools brotli; and in the given folder (default /tmp/fontwork):
  npm i @fontsource-variable/bricolage-grotesque @fontsource-variable/source-sans-3 @fontsource/noto-serif-sc
All three fonts are under the SIL Open Font License 1.1 (see fonts/LICENSE.txt), which allows copying them into this site.

What it keeps
  - Latin: letters, digits, punctuation, and the accented vowels pinyin needs (ā á ǎ à ... ǖ ǘ ǚ ǜ ü), as two small files per family.
  - Chinese (Noto Serif SC, weights 500 and 700): every Chinese character that appears in the site's own files, plus the common
    punctuation. A character outside that set (for example something new in an AI reply) is drawn by the system's Chinese font.
Run it again after adding content with new characters; the output is committed. Then run: node tools/build-site.js
"""
import glob, io, os, re, sys
from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else '/tmp/fontwork'
NM = os.path.join(SRC, 'node_modules')
OUT = os.path.join(ROOT, 'fonts')
os.makedirs(OUT, exist_ok=True)

def used_chinese():
    chars = set()
    files = glob.glob(os.path.join(ROOT, 'data', '*.js')) + [os.path.join(ROOT, f) for f in ('index.html', 'app.js', 'ascent.js', 'erhua.js', 'level.js', 'friends.js', 'sync.js')]
    for f in files:
        for c in open(f, encoding='utf8').read():
            o = ord(c)
            if 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF:
                chars.add(o)
    # punctuation and a few symbols that appear next to Chinese text
    for c in '，。？！、：；“”‘’（）《》—…·～＋－×÷％／＝０１２３４５６７８９':
        chars.add(ord(c))
    return chars

LATIN = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | {0x131, 0x152, 0x153, 0x2C6, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026,
    0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2215, 0x00B7, 0x25CF, 0x2713, 0xFEFF}
# every tone-marked vowel and capital pinyin can need, plus the combining marks themselves
PINYIN = set(ord(c) for c in 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜńňǹḿɡ') | set(range(0x300, 0x30D)) | {0x2C9, 0x2CA, 0x2C7, 0x2CB, 0x2D9}

def subset_to(font_path, unicodes, out_path, layout=('kern', 'liga', 'ccmp', 'locl', 'mark', 'mkmk', 'calt')):
    opts = subset.Options()
    opts.flavor = 'woff2'; opts.layout_features = list(layout); opts.name_IDs = [1, 2, 3, 4, 6]; opts.notdef_outline = True
    opts.glyph_names = False; opts.hinting = False; opts.desubroutinize = True
    font = TTFont(font_path)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(unicodes))
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(out_path)
    return os.path.getsize(out_path)

def variable_latin(pkg, part, axes, out_name):
    """a variable font slice limited to the weights the site uses"""
    src = os.path.join(NM, pkg, 'files', part)
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, axes)
    tmp = os.path.join('/tmp', 'shanlu-' + out_name)
    font.flavor = None; font.save(tmp.replace('.woff2', '.ttf'))
    return subset_to(tmp.replace('.woff2', '.ttf'), pinyin_or_latin[out_name], os.path.join(OUT, out_name))

pinyin_or_latin = {}
def build_latin():
    sizes = {}
    for fam, pkg, axes in (('bricolage', '@fontsource-variable/bricolage-grotesque', {'wght': (500, 800)}),
                           ('sourcesans', '@fontsource-variable/source-sans-3', {'wght': (400, 700)})):
        stem = 'bricolage-grotesque' if fam == 'bricolage' else 'source-sans-3'
        wk = 'opsz' if fam == 'bricolage' else 'wght'
        for part, ext in (('latin', LATIN), ('latin-ext', PINYIN)):
            name = '%s-%s.woff2' % (fam, part)
            pinyin_or_latin[name] = ext
            sizes[name] = variable_latin(pkg, '%s-%s-%s-normal.woff2' % (stem, part, wk), axes, name)
    return sizes

def noto_slices(weight):
    css = open(os.path.join(NM, '@fontsource', 'noto-serif-sc', '%d.css' % weight), encoding='utf8').read()
    out = []
    for m in re.finditer(r'noto-serif-sc-\[(\d+)\]-%d-normal \*/.*?unicode-range: ([^;]+);' % weight, css, re.S):
        ranges = []
        for part in m.group(2).split(','):
            part = part.strip().replace('U+', '')
            if '-' in part:
                a, b = part.split('-'); ranges.append((int(a, 16), int(b, 16)))
            else:
                ranges.append((int(part, 16), int(part, 16)))
        out.append((int(m.group(1)), ranges))
    return out

def build_noto(weight, want):
    slices = noto_slices(weight)
    parts, covered = [], set()
    for n, ranges in slices:
        mine = sorted(u for u in want if any(a <= u <= b for a, b in ranges))
        if not mine: continue
        covered.update(mine)
        src = os.path.join(NM, '@fontsource', 'noto-serif-sc', 'files', 'noto-serif-sc-%d-%d-normal.woff2' % (n, weight))
        tmp = '/tmp/shanlu-noto-%d-%d.ttf' % (weight, n)
        f = TTFont(src); f.flavor = None; f.save(tmp)
        out = '/tmp/shanlu-noto-sub-%d-%d.ttf' % (weight, n)
        opts = subset.Options(); opts.layout_features = []; opts.name_IDs = [1, 2, 3, 4, 6]; opts.hinting = False; opts.notdef_outline = True
        font = TTFont(tmp); sub = subset.Subsetter(opts); sub.populate(unicodes=mine); sub.subset(font); font.save(out)
        parts.append(out)
    merged = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    merged.flavor = 'woff2'
    dest = os.path.join(OUT, 'noto-serif-sc-%d.woff2' % weight)
    merged.save(dest)
    return os.path.getsize(dest), sorted(want - covered)

def main():
    want = used_chinese()
    print('Chinese characters wanted:', len(want))
    sizes = build_latin()
    for weight in (500, 700):
        size, missing = build_noto(weight, want)
        sizes['noto-serif-sc-%d.woff2' % weight] = size
        if missing: print('  weight %d: no glyph for %s' % (weight, ' '.join(chr(u) for u in missing[:40])))
    for k in sorted(sizes): print('%7d  %s' % (sizes[k], k))
    print('total %d bytes' % sum(sizes.values()))

main()
