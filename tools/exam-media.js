#!/usr/bin/env node
/* Finds real photos for the mock-exam pictures (the exam uses emoji; concrete things such as an apple, a dog or a bus can be shown as a photo).
 *
 *   node tools/exam-media.js --find     looks up up to 4 candidate photos per picture on Wikipedia / Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA only)
 *                                       and writes tools/exam-media-candidates.json and review/exam-photos.html (a contact sheet to choose from)
 *   node tools/exam-media.js --build    reads tools/exam-media-picks.json ({ "🍎": 1, ... } = candidate number, 0 or missing = keep the emoji)
 *                                       and writes data/exam-media.js, which the exam uses
 *
 * Only concrete things get a photo. Buildings (hospital, school), actions, feelings, weather and clock times stay emoji: a photo of a building does not
 * say "hospital", and a clock face is clearer as a drawing. Nobody can check a photo without looking at it, so the finder only PROPOSES; a person picks.
 * The workspace cannot reach Wikimedia, so --find runs in the "Exam photos" GitHub Action (.github/workflows/exam-media.yml).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const J = require('./journey-media.js');

const ROOT = path.join(__dirname, '..');
const CANDS = path.join(__dirname, 'exam-media-candidates.json');
const PICKS = path.join(__dirname, 'exam-media-picks.json');
const REJECT = path.join(__dirname, 'exam-media-reject.json');   // Commons file names a person turned down: never proposed again
const OUT = path.join(ROOT, 'data', 'exam-media.js');
const SHEET = path.join(ROOT, 'review', 'exam-photos.html');
const MAX = 4;

// the picture's key: the emoji without its variation selector
const key = (e) => String(e).replace(/️/g, '');

// emoji -> what it is, the English Wikipedia pages whose first picture shows it, and Commons searches as a second source
const ITEMS = [
  ['🍎', 'apple', ['Apple'], ['red apple']],
  ['✈️', 'aeroplane', ['Airliner', 'Airplane'], ['airliner in flight']],
  ['💻', 'laptop computer', ['Laptop'], ['laptop computer']],
  ['📱', 'mobile phone', ['Smartphone'], ['smartphone']],
  ['🚗', 'car', ['Car'], ['passenger car']],
  ['📺', 'television', ['Television set'], ['television set']],
  ['🍵', 'cup of tea', ['Tea'], ['cup of tea', 'Chinese tea cup']],
  ['🐱', 'cat', ['Cat', 'Domestic short-haired cat'], ['domestic cat']],
  ['🐶', 'dog', ['Dog'], ['dog portrait']],
  ['👕', 'T-shirt', ['T-shirt'], ['t-shirt']],
  ['🚇', 'subway train', ['Rapid transit'], ['metro train station']],
  ['🚆', 'train', ['Train'], ['passenger train']],
  ['⚽', 'football (soccer ball)', ['Ball (association football)', 'Football (ball)'], ['association football ball']],
  ['🐟', 'fish', ['Fish'], ['fish']],
  ['🍚', 'bowl of rice', ['Cooked rice', 'Rice'], ['bowl of cooked rice']],
  ['🍞', 'bread', ['Bread'], ['loaf of bread']],
  ['🥛', 'glass of milk', ['Milk'], ['glass of milk']],
  ['💧', 'water', ['Drinking water'], ['glass of water']],
  ['🍳', 'fried egg', ['Fried egg'], ['fried egg']],
  ['🍜', 'noodles', ['Noodle'], ['bowl of noodles']],
  ['👖', 'trousers', ['Jeans', 'Trousers'], ['jeans']],
  ['🛏️', 'bed', ['Bed'], ['bed bedroom']],
  ['🧳', 'suitcase', ['Suitcase'], ['suitcase']],
  ['🥟', 'dumplings', ['Jiaozi'], ['jiaozi dumplings']],
  ['🚕', 'taxi', ['Taxicab'], ['taxi']],
  ['🚌', 'bus', ['Bus'], ['city bus']],
  ['📚', 'books', ['Book'], ['books on a shelf', 'pile of books']],
  ['📖', 'open book', ['Book'], ['open book']],
  ['☂️', 'umbrella', ['Umbrella'], ['open umbrella']],
  ['🚲', 'bicycle', ['Bicycle'], ['bicycle']],
  ['👟', 'sports shoes', ['Sneakers'], ['sneakers']],
  ['📷', 'camera', ['Camera'], ['digital camera']],
  ['🎂', 'birthday cake', ['Birthday cake'], ['birthday cake']],
  ['🌸', 'cherry blossom', ['Cherry blossom'], ['cherry blossom']],
  ['🌙', 'moon', ['Moon'], ['moon night sky']],
  ['💊', 'pills', ['Pill'], ['pills tablets']],
];

// file names that are not photographs of the thing itself
const NOT_SUBJECT = /diagram|chart|map\b|illustration|drawing|painting|sketch|vector|clip ?art|logo|icon|symbol|flag|stamp|coin|banknote|poster|screenshot|infographic|cartoon|engraving|woodcut|lithograph|\bsvg\b|collage|montage|comparison|\bgrid\b/i;
const IS_BITMAP = /\.(jpe?g|png|webp)$/i;

async function candidatesFor(api, item, reject) {
  const [, en, titles, queries] = item;
  const out = [], seen = new Set(reject || []);
  const add = async (name, why) => {
    if (out.length >= MAX || !name) return;
    name = String(name).replace(/^File:/, '').replace(/_/g, ' ');
    if (seen.has(name) || !IS_BITMAP.test(name) || NOT_SUBJECT.test(name)) return;
    seen.add(name);
    let r;
    try { r = await J.fileEntry(api, name, en, {}); } catch (e) { return; }
    if (r && r.entry) out.push(Object.assign({}, r.entry, { n: name, via: why }));
  };
  for (const t of titles) {   // 1. the first picture of the Wikipedia page, then the page's other pictures
    let page = null;
    try { const q = await api.page(t, 'en'); page = q && q.query && q.query.pages && q.query.pages[0]; } catch (e) { /* next */ }
    if (!page || page.missing || (page.pageprops && page.pageprops.disambiguation !== undefined)) continue;
    await add(page.pageimage, 'Wikipedia: ' + t);
    try {
      const im = await api.images(page.title || t, 'en');
      const ip = im && im.query && im.query.pages && im.query.pages[0];
      for (const x of ((ip && ip.images) || []).slice(0, 25)) await add(J.nm(x.title), 'Wikipedia: ' + t);
    } catch (e) { /* next */ }
  }
  for (const q of queries) {   // 2. a Commons search
    if (out.length >= MAX) break;
    try {
      const r = await api.cfiles(q);
      for (const x of ((r && r.query && r.query.search) || [])) await add(J.nm(x.title), 'Commons: ' + q);
    } catch (e) { /* next */ }
  }
  return out;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sheet(cands) {
  let h = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exam photos: choose</title>' +
    '<style>body{font:15px system-ui;margin:12px;max-width:980px}h1{font-size:20px}.it{border-top:1px solid #ccc;padding:10px 0}.hd{font-size:18px;margin-bottom:6px}' +
    '.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px}.c{flex:0 0 170px;font-size:11.5px;border:3px solid transparent;border-radius:10px;padding:3px;cursor:pointer}' +
    '.c.on{border-color:#2e8b6a;background:#e6f4ee}.c img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;background:#eee;display:block}.num{font-weight:700;font-size:14px}' +
    '.none{flex:0 0 90px;display:flex;align-items:center;justify-content:center;border:3px solid transparent;border-radius:10px;cursor:pointer;color:#666}.none.on{border-color:#a33;color:#a33}' +
    '#out{position:sticky;bottom:0;background:#fff;border-top:2px solid #333;padding:8px}#out textarea{width:100%;height:60px;font:15px monospace}button{font-size:16px;padding:8px 14px}</style>';
  h += '<h1>Choose a photo for each picture</h1><p>Tap the photo you want (the crop shown is what the exam will show). Tap <b>keep emoji</b> if none is clearly the thing. ' +
    'Then tap <b>Copy my choices</b> and paste them into the chat. The photo must clearly show the thing, alone and easy to recognise, as a learner would meet it.</p>';
  ITEMS.forEach((it) => {
    const k = key(it[0]), list = cands[k] || [];
    h += '<div class="it" data-k="' + esc(k) + '"><div class="hd">' + esc(it[0]) + ' ' + esc(it[1]) + '</div><div class="row">';
    list.forEach((c, i) => {
      h += '<div class="c' + (i === 0 ? '' : '') + '" data-i="' + (i + 1) + '"><img loading="lazy" referrerpolicy="no-referrer" src="' + esc(c.u) + '" alt=""><span class="num">' + (i + 1) + '</span> ' +
        esc(c.c).slice(0, 60) + '<br><a href="https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(String(c.n).replace(/ /g, '_')) + '" target="_blank" rel="noopener">file page</a></div>';
    });
    h += '<div class="none on" data-i="0">' + (list.length ? 'keep emoji' : 'nothing found: keep emoji') + '</div></div></div>';
  });
  h += '<div id="out"><button id="copy">Copy my choices</button> <span id="msg"></span><textarea id="txt" readonly></textarea></div>';
  h += '<script>(function(){var sel={};function upd(){var t=[];document.querySelectorAll(".it").forEach(function(it){var k=it.dataset.k;var v=sel[k]||0;t.push(k+" "+v);});' +
    'document.getElementById("txt").value=t.join("\\n");}' +
    'document.querySelectorAll(".it").forEach(function(it){it.addEventListener("click",function(e){var c=e.target.closest(".c,.none");if(!c||e.target.tagName==="A")return;' +
    'it.querySelectorAll(".c,.none").forEach(function(x){x.classList.remove("on")});c.classList.add("on");sel[it.dataset.k]=Number(c.dataset.i);upd();});});' +
    'document.getElementById("copy").onclick=function(){var t=document.getElementById("txt");t.select();var ok=false;try{ok=document.execCommand("copy")}catch(e){}' +
    'try{navigator.clipboard.writeText(t.value);ok=true}catch(e){}document.getElementById("msg").textContent=ok?"Copied. Paste it in the chat.":"Select the text below and copy it.";};upd();})();</script>';
  return h;
}

function buildData(cands, picks) {
  const out = {};
  for (const it of ITEMS) {
    const k = key(it[0]), n = Number(picks[k] || picks[it[0]] || 0), c = (cands[k] || [])[n - 1];
    if (n > 0 && c) out[k] = { u: c.u, c: c.c, a: it[1] };
  }
  return out;
}

function writeData(data) {
  const body = Object.keys(data).map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(data[k])).join(',\n');
  fs.writeFileSync(OUT, '/* Photos for the mock-exam pictures, built by tools/exam-media.js from the choices in tools/exam-media-picks.json: emoji (without its variation selector) -> { u: image address, c: credit line, a: what it shows }.\n' +
    ' * Only public-domain, CC0, CC BY and CC BY-SA pictures from Wikimedia Commons. A picture without an entry stays an emoji. */\nwindow.SHANLU_EXAM_MEDIA = {\n' + body + '\n};\n');
}

async function find() {
  const api = J.makeApi((u, o) => fetch(u, o));
  const reject = (() => { try { return JSON.parse(fs.readFileSync(REJECT, 'utf8')); } catch (e) { return []; } })();
  let old = {}; try { old = JSON.parse(fs.readFileSync(CANDS, 'utf8')); } catch (e) { /* first run */ }
  const cands = {};
  for (const it of ITEMS) {
    const k = key(it[0]);
    cands[k] = await candidatesFor(api, it, reject);
    console.log(it[0], it[1], cands[k].length, 'candidates', cands[k].map((c) => c.n).join(' | ').slice(0, 160));
  }
  fs.writeFileSync(CANDS, JSON.stringify(cands, null, 1));
  fs.mkdirSync(path.dirname(SHEET), { recursive: true });
  fs.writeFileSync(SHEET, sheet(cands));
  console.log('items with at least one candidate:', Object.keys(cands).filter((k) => cands[k].length).length + '/' + ITEMS.length, '(previous run: ' + Object.keys(old).length + ' items)');
}

function build() {
  const cands = JSON.parse(fs.readFileSync(CANDS, 'utf8'));
  const picks = (() => { try { return JSON.parse(fs.readFileSync(PICKS, 'utf8')); } catch (e) { return {}; } })();
  const data = buildData(cands, picks);
  writeData(data);
  console.log('exam photos in use:', Object.keys(data).length);
}

module.exports = { ITEMS, key, candidatesFor, sheet, buildData, writeData, NOT_SUBJECT };
if (require.main === module) {
  const run = process.argv.includes('--find') ? find : process.argv.includes('--build') ? build : null;
  if (!run) { console.error('use --find or --build'); process.exit(2); }
  Promise.resolve(run()).catch((e) => { console.error(e); process.exit(1); });
}
