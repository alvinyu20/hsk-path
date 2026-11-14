"""Crops the screenshots taken by make-tour-shots.js into the five tour pictures (tour/*.jpg). Usage: crop-tour-shots.py <screenshot dir> <output dir>"""
import os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
def img(n): return Image.open(os.path.join(src, n + '.png')).convert('RGB')
def save(im, n): im.save(os.path.join(out, n + '.jpg'), quality=88); print(n, im.size)
BG = (237, 240, 236)
# 1. the winding path: words, a grammar stop and the speaking stops
save(img('trail').crop((16, 240, 764, 1000)), 'path')
# 2. a Review card with the answer and the four grade buttons
save(img('review').crop((16, 370, 764, 1172)), 'review')
# 3. Home: the top of the Today card, then "More ways to study" (the plan rows between them are left out)
h = img('home'); top = h.crop((16, 615, 764, 905)); bot = h.crop((16, 1328, 764, 1760))
c = Image.new('RGB', (748, top.height + bot.height), BG); c.paste(top, (0, 0)); c.paste(bot, (0, top.height)); save(c, 'today')
# 4. the Friends board
save(img('friends').crop((16, 205, 764, 928)), 'friends')
# 5. the Journey: the map, with the Passport and the souvenir Shelf under it (already cut out by make-tour-shots.js)
m = img('jymap'); p = img('jypassport'); s = img('jyshelf')
hw = 370; ph = round(p.height * hw / p.width); sh = round(s.height * hw / s.width); m2 = m.resize((748, round(m.height * 748 / m.width)))
c = Image.new('RGB', (748, m2.height + 8 + max(ph, sh)), BG); c.paste(m2, (0, 0)); c.paste(p.resize((hw, ph)), (0, m2.height + 8)); c.paste(s.resize((hw, sh)), (378, m2.height + 8)); save(c, 'journey')
