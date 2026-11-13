// Sanity checks for the shared Word web topics (content/topics.json -> data/hsk*-webs.js).
// Run: node tools/test-topics.js
global.window = {};
const fs = require('fs');
const has = (f) => fs.existsSync(__dirname + '/../data/' + f + '.js');
const LEVELS = [1, 2, 3, 4].filter(n => has('hsk' + n + '-words') && has('hsk' + n + '-webs'));   // a level counts once its words and word webs are built
for (const n of LEVELS) for (const f of ['words', 'webs']) eval(fs.readFileSync(__dirname + '/../data/hsk' + n + '-' + f + '.js', 'utf8'));
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };
const master = JSON.parse(fs.readFileSync(__dirname + '/../content/topics.json', 'utf8')).topics;
const L = {}, T = {};
for (const n of LEVELS) { L[n] = window['HSK' + n + '_WORDS'].map(w => w.zh); T[n] = window['HSK' + n + '_WEBS'].topics; }
const topicsOf = (zh) => master.filter(t => t.words.includes(zh)).map(t => t.name);
const sameTopic = (a, b) => master.some(t => t.words.includes(a) && t.words.includes(b));

for (const n of LEVELS) {
  const inTopic = new Set(); T[n].forEach(t => t.words.forEach(z => inTopic.add(z)));
  check(L[n].every(z => inTopic.has(z)), 'every HSK ' + n + ' word is in a topic');
  check(T[n].every(t => t.words.every(z => L[n].includes(z))), 'HSK ' + n + ' topics hold only HSK ' + n + ' words');
  check(T[n].every(t => t.group && t.sentence && t.sentence.zh && t.sentence.py && t.sentence.en && typeof t.order === 'number'), 'every HSK ' + n + ' topic has a group, an order and a sentence');
  check(new Set(T[n].map(t => t.name)).size === T[n].length, 'HSK ' + n + ' topic names are unique');
  check(T[n].every((t, i) => i === 0 || T[n][i - 1].order < t.order), 'HSK ' + n + ' topics are in the shared order');
  check(T[n].every(t => t.words.length >= 3) || T[n].filter(t => t.words.length < 3).every(t => t.words.some(z => !T[n].some(o => o !== t && o.words.includes(z)))), 'HSK ' + n + ': a topic under 3 words exists only when it is the only home of a word');
}
check(new Set(master.map(t => t.name)).size === master.length, 'master topic names are unique');
// the things that were wrong before
check(topicsOf('万').includes('Numbers'), '万 (ten thousand) is in Numbers');
check(topicsOf('千').includes('Numbers') && topicsOf('百').includes('Numbers'), '百 and 千 are in Numbers');
check(['狗', '猫', '鸟', '鱼'].every(z => topicsOf(z).includes('Animals and nature')), 'dog, cat, bird and fish are in Animals');
check(!topicsOf('篮球').some(n => topicsOf('猫').includes(n)) && !topicsOf('忙').some(n => topicsOf('猫').includes(n)), 'sports and "busy" are not in a topic with cat');
check(!sameTopic('从小', '晴') && !sameTopic('从小', '雨') && !sameTopic('从小', '天气'), 'since childhood is not grouped with weather words');
check(topicsOf('从小').includes('Age and growing up'), '从小 is with the age and growing up words');
check(!sameTopic('左', '商场') && !sameTopic('右边', '商场') && !sameTopic('前面', '超市'), 'left, right and in front are not grouped with shops');
check(topicsOf('左').includes('Directions and positions') && topicsOf('右边').includes('Directions and positions'), 'left and right are in Directions');
check(topicsOf('个').includes('Measure words') && !topicsOf('个').includes('How much and how many'), 'measure words are separate from amounts');
check(['多', '少', '一些', '一点儿'].every(z => topicsOf(z).includes('How much and how many')), 'amount words have their own topic');
check(topicsOf('下雨').includes('Weather') && topicsOf('冷').includes('Weather'), 'weather words are together');
check(!master.some(t => t.words.includes('篮球') && t.words.some(z => ['猫', '狗', '忙', '晴', '商场'].includes(z))), 'sports are only grouped with sports-like words');
// grammar categories (content/categories-grammar.json): every lesson of every level is in exactly one category
const GL = [1, 2, 3, 4].filter(n => has('hsk' + n + '-grammar'));
for (const n of GL) eval(fs.readFileSync(__dirname + '/../data/hsk' + n + '-grammar.js', 'utf8'));
const cats = JSON.parse(fs.readFileSync(__dirname + '/../content/categories-grammar.json', 'utf8')).categories;
const listed = cats.flatMap(c => c.lessons);
const lessons = [].concat(...GL.map(n => window['HSK' + n + '_GRAMMAR'].lessons));
check(lessons.every(l => listed.filter(x => x === l.id).length === 1) && listed.every(id => lessons.some(l => l.id === id)), 'every grammar lesson is in exactly one category');
check(lessons.every(l => l.cat && typeof l.catOrder === 'number' && l.catBlurb), 'every grammar lesson carries its category');
check(cats.every(c => c.lessons.length >= 3 && c.blurb), 'every grammar category has at least 3 lessons and a description');
check(cats.some(c => c.lessons.some(id => window.HSK1_GRAMMAR.lessons.some(l => l.id === id)) && c.lessons.some(id => window.HSK2_GRAMMAR.lessons.some(l => l.id === id))), 'grammar categories mix HSK 1 and HSK 2 lessons');
console.log(failures ? failures + ' topic check(s) failed' : 'all topic checks passed');
process.exit(failures ? 1 : 0);
