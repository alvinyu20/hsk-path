# Draws Mingming (five poses), the per-tab banners, the streak lantern and the summit as small flat SVG strings and writes them to data/art.js.
# Run: python3 tools/make-art.py   (the drawings contain no text, so they look the same everywhere).
INK='#14212A'; SKIN='#F2C9A0'; SEAL='#C2362B'; JADE='#1D6B58'; GOLD='#E9B44C'
def _o(w=4): return 'stroke="%s" stroke-width="%s" stroke-linejoin="round" stroke-linecap="round"'%(INK,w)

def mingming(pose='wave', size=200, shirt=SEAL, halo=True, bg=None):
    s=''
    if halo: s+='<circle cx="100" cy="112" r="92" fill="#fff" opacity=".34"/><circle cx="100" cy="112" r="68" fill="#fff" opacity=".26"/>'
    # arms behind/over body
    arm_up_r='<path d="M150 150 Q176 128 170 92" fill="none" stroke="%s" stroke-width="22" stroke-linecap="round"/><path d="M150 150 Q176 128 170 92" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round"/>'%(INK,shirt)
    arm_up_l=arm_up_r.replace('150 150','50 150').replace('176 128','24 128').replace('170 92','30 92')
    if pose in('wave','cheer'): s+=arm_up_r
    if pose=='cheer': s+=arm_up_l
    if pose=='think': s+='<path d="M146 160 Q150 140 118 128" fill="none" stroke="%s" stroke-width="22" stroke-linecap="round"/><path d="M146 160 Q150 140 118 128" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round"/>'%(INK,shirt)
    if pose=='thumbs': s+='<path d="M148 160 Q170 150 164 122" fill="none" stroke="%s" stroke-width="22" stroke-linecap="round"/><path d="M148 160 Q170 150 164 122" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round"/>'%(INK,shirt)
    # body
    s+='<path d="M34 210 Q34 138 100 130 Q166 138 166 210z" fill="%s" %s/>'%(shirt,_o(4.5))
    s+='<path d="M82 128 Q100 146 118 128" fill="#fff" opacity=".9" %s/>'%_o(3)   # collar
    s+='<rect x="88" y="104" width="24" height="30" rx="4" fill="%s" %s/>'%(SKIN,_o(3.6))
    # hair back + head
    s+='<path d="M60 74 Q58 34 100 34 Q142 34 140 74 Q146 104 132 114 L68 114 Q54 104 60 74z" fill="%s" %s/>'%(INK,_o(3.5))
    s+='<circle cx="100" cy="82" r="36" fill="%s" %s/>'%(SKIN,_o(4))
    s+='<path d="M64 76 Q66 44 100 44 Q134 44 136 76 Q118 58 98 60 Q78 60 64 76z" fill="%s"/>'%INK
    # eyes + mouth by pose
    if pose=='sleep':
        s+='<path d="M80 86 Q86 92 92 86M108 86 Q114 92 120 86" fill="none" %s/>'%_o(3.2)
        s+='<path d="M92 100 Q100 104 108 100" fill="none" %s/>'%_o(3)
    elif pose=='cheer':
        s+='<path d="M80 88 Q86 80 92 88M108 88 Q114 80 120 88" fill="none" %s/>'%_o(3.4)
        s+='<path d="M88 98 Q100 114 112 98z" fill="#8E2A22" %s/>'%_o(3)
    elif pose=='think':
        s+='<circle cx="86" cy="82" r="4" fill="%s"/><circle cx="114" cy="82" r="4" fill="%s"/><circle cx="87.4" cy="80.6" r="1.3" fill="#fff"/><circle cx="115.4" cy="80.6" r="1.3" fill="#fff"/>'%(INK,INK)
        s+='<path d="M92 100 Q100 98 108 101" fill="none" %s/>'%_o(3)
    else:
        s+='<circle cx="86" cy="86" r="4.2" fill="%s"/><circle cx="114" cy="86" r="4.2" fill="%s"/><circle cx="87.3" cy="84.7" r="1.4" fill="#fff"/><circle cx="115.3" cy="84.7" r="1.4" fill="#fff"/>'%(INK,INK)
        s+='<path d="M90 98 Q100 108 110 98" fill="none" %s/>'%_o(3.4)
    s+='<ellipse cx="76" cy="97" rx="6" ry="4" fill="#F29C94" opacity=".6"/><ellipse cx="124" cy="97" rx="6" ry="4" fill="#F29C94" opacity=".6"/>'
    # hands + extras
    if pose=='wave':
        s+='<circle cx="170" cy="88" r="12" fill="%s" %s/>'%(SKIN,_o(3.6))+'<path d="M184 70 q8 6 6 16M188 60 q12 8 10 24" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>'%INK
    if pose=='cheer':
        s+='<circle cx="170" cy="88" r="12" fill="%s" %s/><circle cx="30" cy="88" r="12" fill="%s" %s/>'%(SKIN,_o(3.6),SKIN,_o(3.6))
        for (x,y,r) in ((176,40,9),(26,34,7),(100,16,8)): s+='<path d="M%d %d l%d %d l%d %d l-%d %d l-%d %d l-%d -%d l%d -%d z" fill="%s" %s/>'%(x,y-r,r*.35,r*.65,r*.65,r*.35,r*.65,r*.35,r*.35,r*.65,r*.35,r*.65,r*.35,r*.65,GOLD,_o(2.2)) if False else '<circle cx="%d" cy="%d" r="%d" fill="%s" %s/>'%(x,y,r,GOLD,_o(2.4))
    if pose=='think':
        s+='<circle cx="118" cy="124" r="12" fill="%s" %s/>'%(SKIN,_o(3.6))
        s+='<circle cx="150" cy="44" r="5" fill="#fff" %s/><circle cx="162" cy="30" r="8" fill="#fff" %s/><text x="177" y="20" font-size="24" font-weight="800" font-family="Bricolage Grotesque,sans-serif" fill="%s">?</text>'%(_o(2.5),_o(2.5),INK)
    if pose=='thumbs':
        s+='<rect x="154" y="104" width="22" height="22" rx="8" fill="%s" %s/><path d="M160 106 V92 q0-8 8-6 q4 2 2 10 L176 106" fill="%s" %s/>'%(SKIN,_o(3.4),SKIN,_o(3.4))
    if pose=='sleep':
        s+='<text x="136" y="48" font-size="22" font-weight="800" font-family="Bricolage Grotesque,sans-serif" fill="%s" opacity=".8">z</text><text x="152" y="30" font-size="28" font-weight="800" font-family="Bricolage Grotesque,sans-serif" fill="%s" opacity=".6">Z</text>'%(INK,INK)
        s+='<path d="M62 54 Q100 28 138 54 L134 64 Q100 46 66 64z" fill="#3C5A8A" %s/><circle cx="100" cy="34" r="7" fill="#fff" %s/>'%(_o(3),_o(2.5))   # nightcap
    return '<svg viewBox="0 0 200 210" width="%d" height="%d" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">%s</svg>'%(size,size*210//200,s)

# ---------- banners (360x120): one small scene per tab
def _hills(c1,c2,y=84):
    return '<path d="M0 %d Q60 %d 130 %d T260 %d T360 %d V120H0z" fill="%s"/><path d="M0 %d Q90 %d 180 %d T360 %d V120H0z" fill="%s"/>'%(y,y-30,y-8,y-26,y-6,c1,y+14,y-10,y+4,y-4,c2)
def banner(kind, w=360, h=120):
    b=''
    if kind=='today':      # dawn
        b+='<defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6C9A0"/><stop offset="1" stop-color="#FBEBD3"/></linearGradient></defs><rect width="360" height="120" fill="url(#gt)"/><circle cx="268" cy="70" r="24" fill="#F29C6B"/>'+_hills('#8FB59F','#5C9A82')
    elif kind=='path':
        b+='<rect width="360" height="120" fill="#CFE6EE"/><circle cx="300" cy="28" r="14" fill="#F9DC7C"/>'+_hills('#A9CDB8','#6FA98F')+'<path d="M-10 112 Q80 86 150 98 T250 76 T380 70" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="2 12" stroke-linecap="round"/><circle cx="250" cy="76" r="9" fill="%s" %s/>'%(SEAL,_o(2.5))
    elif kind=='review':   # desk with flashcards
        b+='<rect width="360" height="120" fill="#F3E2C6"/><rect y="84" width="360" height="36" fill="#B97D54"/><rect y="82" width="360" height="6" fill="#8A5A3B"/>'
        for i,(x,r,c) in enumerate(((120,-10,'#fff'),(150,4,'#FBF3E4'),(180,14,'#fff'))): b+='<g transform="translate(%d 56) rotate(%d)"><rect x="-26" y="-34" width="52" height="68" rx="6" fill="%s" %s/><text x="0" y="8" text-anchor="middle" font-size="26" font-family="Noto Serif SC,serif" fill="%s" font-weight="700">%s</text></g>'%(x+110,r,c,_o(3),INK,'词学好'[i])
        b+='<rect x="332" y="40" width="6" height="44" fill="#6F8793"/><path d="M314 40h42l-10-30h-22z" fill="#F9D78A" %s/>'%_o(3)
    elif kind=='talk':     # two bubbles over a street
        b+='<rect width="360" height="120" fill="#DCEBE3"/><rect y="92" width="360" height="28" fill="#B8C6BE"/><rect x="20" y="40" width="46" height="52" fill="#E9A24B"/><rect x="74" y="28" width="52" height="64" fill="#6E9FB8"/><rect x="290" y="34" width="50" height="58" fill="#C2362B" opacity=".85"/>'
        b+='<g %s><path d="M120 22 h96 a14 14 0 0 1 14 14 v18 a14 14 0 0 1-14 14 h-62 l-18 14 v-14 h-16 a14 14 0 0 1-14-14 v-18 a14 14 0 0 1 14-14z" fill="#fff"/></g><text x="168" y="54" text-anchor="middle" font-size="22" font-family="Noto Serif SC,serif" font-weight="700" fill="%s">你好！</text>'%(_o(3.4),INK)
        b+='<g %s><path d="M226 48 h70 a12 12 0 0 1 12 12 v14 a12 12 0 0 1-12 12 h-8 v12 l-14-12 h-48 a12 12 0 0 1-12-12 v-14 a12 12 0 0 1 12-12z" fill="%s"/></g><circle cx="244" cy="74" r="3.4" fill="#fff"/><circle cx="258" cy="74" r="3.4" fill="#fff"/><circle cx="272" cy="74" r="3.4" fill="#fff"/>'%(_o(3.4),JADE)
    elif kind=='library':  # bookshelf
        b+='<rect width="360" height="120" fill="#EADFC9"/><rect y="52" width="360" height="7" fill="#8A5A3B"/><rect y="108" width="360" height="12" fill="#8A5A3B"/>'
        import random; random.seed(3); x=14
        for row,(y0,hh) in enumerate(((10,42),(66,42))):
            x=14+row*10
            while x<330:
                bw=random.choice((16,20,24,18)); bh=hh-random.choice((0,4,8)); c=random.choice(('#C2362B','#1D6B58','#E9A24B','#3C5A8A','#8A5A3B','#6FA98F'))
                b+='<rect x="%d" y="%d" width="%d" height="%d" rx="2" fill="%s" %s/>'%(x,y0+hh-bh,bw,bh,c,_o(2.4)); x+=bw+3
        b+='<g transform="translate(300 74) rotate(-8)"><rect x="0" y="0" width="40" height="30" rx="4" fill="#fff" %s/><text x="20" y="22" text-anchor="middle" font-size="18" font-family="Noto Serif SC,serif" font-weight="700" fill="%s">字</text></g>'%(_o(2.6),SEAL)
    elif kind=='journey':
        b+='<rect width="360" height="120" fill="#BFE0EE"/>'+'<path d="M0 100 Q70 80 140 96 T280 84 T360 92 V120H0z" fill="#9FCBB4"/>'+'<path d="M40 76 Q130 20 250 56" fill="none" stroke="#fff" stroke-width="3.2" stroke-dasharray="3 9" stroke-linecap="round"/>'
        b+='<g transform="translate(262 52) rotate(18)"><path d="M0 0 l-34-6 l-8 6 l10 4 l-4 8 l6 0 l6-7 l24 6z" fill="#fff" %s/></g><circle cx="40" cy="76" r="8" fill="%s" %s/><circle cx="318" cy="70" r="8" fill="%s" %s/>'%(_o(2.8),SEAL,_o(2.4),GOLD,_o(2.4))
    return '<svg viewBox="0 0 %d %d" width="%d" height="%d" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">%s</svg>'%(360,120,w,h,b)

def lantern(lit=True, size=44, c=SEAL):
    f=c if lit else '#D7DFDA'
    glow='<circle cx="22" cy="28" r="22" fill="#F9D78A" opacity=".55"/>' if lit else ''
    return '<svg viewBox="0 0 44 64" width="%d" height="%d" aria-hidden="true">%s<path d="M22 2v10" stroke="%s" stroke-width="2.4" stroke-linecap="round"/><rect x="12" y="10" width="20" height="5" rx="2" fill="%s"/><ellipse cx="22" cy="30" rx="15" ry="18" fill="%s" %s/><path d="M14 16Q8 30 14 44M30 16Q36 30 30 44M22 12v36" fill="none" stroke="%s" stroke-width="1.6" opacity=".5"/><rect x="12" y="44" width="20" height="5" rx="2" fill="%s"/><path d="M22 50v10" stroke="%s" stroke-width="2.4" stroke-linecap="round"/></svg>'%(size,size*64//44,glow,INK,GOLD if lit else '#BCC8C1',f,_o(2.4),INK,GOLD if lit else '#BCC8C1',INK)

def seal(zh='完成', size=96):
    return '<svg viewBox="0 0 100 100" width="%d" height="%d" aria-hidden="true"><g transform="rotate(-8 50 50)"><rect x="8" y="8" width="84" height="84" rx="10" fill="none" stroke="%s" stroke-width="6"/><rect x="15" y="15" width="70" height="70" rx="6" fill="%s"/><text x="50" y="47" text-anchor="middle" font-size="26" font-family="Noto Serif SC,serif" font-weight="700" fill="#fff">%s</text><text x="50" y="76" text-anchor="middle" font-size="22" font-family="Noto Serif SC,serif" font-weight="700" fill="#fff">%s</text></g></svg>'%(size,size,SEAL,SEAL,zh[0],zh[1])

def wordpic(kind, size=64):
    d={
    'cha':'<path d="M14 28h34q-2 24-17 24T14 28z" fill="#fff" %s/><path d="M48 32q10 0 10 8t-10 8" fill="none" %s/><path d="M24 20q-4-6 0-12M34 20q-4-6 0-12" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>'%(_o(3),_o(3),INK),
    'mao':'<path d="M14 54V26l10 8h16l10-8v28z" fill="#E9A24B" %s/><circle cx="26" cy="40" r="2.6" fill="%s"/><circle cx="38" cy="40" r="2.6" fill="%s"/><path d="M29 46h6" fill="none" %s/>'%(_o(3),INK,INK,_o(2.6)),
    'shu':'<path d="M10 14h22a6 6 0 0 1 6 6v36H16a6 6 0 0 1-6-6z" fill="#3C5A8A" %s/><path d="M54 14H38v42h22V20a6 6 0 0 0-6-6z" fill="#fff" %s/><path d="M44 26h10M44 34h10" fill="none" %s/>'%(_o(3),_o(3),_o(2.4)),
    'shui':'<path d="M32 8Q14 32 14 42a18 18 0 0 0 36 0Q50 32 32 8z" fill="#9FD0E6" %s/><path d="M24 44q2 8 9 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'%_o(3),
    'jia':'<path d="M8 32 32 10l24 22" fill="%s" %s/><rect x="14" y="30" width="36" height="26" fill="#F3D6AE" %s/><rect x="27" y="40" width="10" height="16" fill="#8A5A3B" %s/>'%(SEAL,_o(3),_o(3),_o(2.4)),
    'tai':'<circle cx="32" cy="32" r="12" fill="#F9DC7C" %s/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" fill="none" %s/>'%(_o(3),_o(3)),
    }[kind]
    return '<svg viewBox="0 0 64 64" width="%d" height="%d" aria-hidden="true">%s</svg>'%(size,size,d)

def summit(w=300,h=200,lit=True):
    return '<svg viewBox="0 0 300 200" width="%d" height="%d" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6C9A0"/><stop offset="1" stop-color="#FBEBD3"/></linearGradient></defs><rect width="300" height="200" fill="url(#gs)"/><circle cx="236" cy="52" r="22" fill="#F29C6B"/><path d="M-10 200 L90 80 L130 120 L170 40 L310 200z" fill="#8FB59F" %s/><path d="M170 40 L150 78 L166 70 L176 84 L188 66 L202 82 L194 62z" fill="#fff" %s/><path d="M170 40 V8" stroke="%s" stroke-width="4" stroke-linecap="round"/><path d="M170 8 h26 l-8 8 l8 8 h-26z" fill="%s" %s/><path d="M30 196 Q80 170 110 150 T160 110 T172 62" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/><circle cx="110" cy="150" r="8" fill="%s" %s/></svg>'%(w,h,_o(3),_o(2.4),INK,SEAL,_o(2.4),GOLD,_o(2.4))


# ---------- write data/art.js
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
def _ns(svg):
    # an SVG used as a picture needs its namespace
    return svg if 'xmlns=' in svg.split('>', 1)[0] else svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
def _notext(svg):
    # SVG pictures used as <img> cannot load the page's fonts: keep only text made of plain Latin letters (the "?" and "z" of Mingming), drop anything else
    return _ns(re.sub(r'<text[^>]*>[^<]*[^\x00-\x7F][^<]*</text>', '', svg))
art = {
    'ming': {p: _ns(mingming(p, 200)) for p in ('wave', 'think', 'cheer', 'sleep', 'thumbs')},
    'banner': {k: _notext(banner(k, 360, 120)) for k in ('today', 'path', 'review', 'talk', 'library', 'journey')},
    'lantern': {'on': _ns(lantern(True, 44)), 'off': _ns(lantern(False, 44))},
    'summit': _notext(summit(300, 200)),
}
out = '// made by tools/make-art.py: do not edit by hand\nwindow.SHANLU_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, '..', 'data', 'art.js'), 'w').write(out)
print('data/art.js', len(out), 'bytes')
