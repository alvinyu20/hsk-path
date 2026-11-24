/* How well does pitch.js read the tones of the site's own recordings (one voice, textbook style)? Not a CI test: a tuning tool.
 *   node tools/eval-pitch.js [max words per kind] [--show]
 * Single-syllable words of HSK 1-3 (tone from the pinyin mark) and the two-syllable words of the tone-pair trainer (HSK*_LISTEN.pairs).
 * Needs ffmpeg and the audio/ folder. 3 + 3 words also count as right when the first syllable is read as a 2 (tone sandhi). */
const path = require('path'), fs = require('fs'), cp = require('child_process');
const root = path.join(__dirname, '..');
global.window = global;
require(path.join(root, 'data', 'audio-manifest.js'));
const AL = require(path.join(root, 'audiolist.js'));
const P = require(path.join(root, 'pitch.js'));
[1, 2, 3].forEach((n) => { require(path.join(root, 'data', 'hsk' + n + '-words.js')); require(path.join(root, 'data', 'hsk' + n + '-listen.js')); });
const MAX = Number(process.argv[2]) || 150, SHOW = process.argv.includes('--show');
const MARK = { 'ā':1,'á':2,'ǎ':3,'à':4,'ē':1,'é':2,'ě':3,'è':4,'ī':1,'í':2,'ǐ':3,'ì':4,'ō':1,'ó':2,'ǒ':3,'ò':4,'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4 };
const toneOf = (py) => { const m = Array.from(py).map(c => MARK[c]).filter(Boolean); return m.length === 1 ? m[0] : 0; };
const pcm = (file) => { const b = cp.execFileSync('ffmpeg', ['-v', 'quiet', '-i', path.join(root, file), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1e8 }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const items = [];
const seen = new Set();
[1, 2, 3].forEach((n) => window['HSK' + n + '_WORDS'].forEach((w) => {
  if (Array.from(w.zh).length !== 1 || /[\/,]/.test(w.py) || seen.has(w.zh) || '不一'.includes(w.zh)) return;
  const t = toneOf(w.py); if (!t) return; seen.add(w.zh); items.push({ zh:w.zh, py:w.py, t:[t] });
}));
const singles = items.splice(0).slice(0, MAX);
const pairs = [];
[1, 2, 3].forEach((n) => (window['HSK' + n + '_LISTEN'].pairs || []).forEach((p) => { if (!seen.has(p.zh)) { seen.add(p.zh); pairs.push({ zh:p.zh, py:p.py, t:p.t }); } }));
// target-aware judging (what the app uses): right tones accepted, and every wrong tone rejected?
const runJudge = (list, label) => {
  let acc = 0, nAcc = 0; const rej = {}, rejN = {}; const missed = [];
  list.slice(0, MAX).forEach((it) => {
    const f = AL.file(it.zh); if (!f || !fs.existsSync(path.join(root, f))) return;
    const r = P.analyse(pcm(f), 16000, it.t.length); if (!r.ok) { nAcc++; missed.push(it.zh + ' no pitch'); return; }
    const ctx = (i) => ({ last:i === it.t.length - 1, next:it.t[i + 1] });
    const good = it.t.every((t, i) => P.judge(r.syl[i], t, ctx(i)).ok);
    nAcc++; if (good) acc++; else missed.push(it.zh + ' ' + it.t.join('') + ' ' + r.syl.map((s, i) => s.shape + (P.judge(s, it.t[i], ctx(i)).ok ? '' : '✗') + ' s' + (s.s || 0).toFixed(1) + ' e' + (s.e || 0).toFixed(1) + ' m' + (s.mean || 0).toFixed(1)).join(' | '));
    it.t.forEach((t, i) => { if (t === 5) return; [1, 2, 3, 4].forEach((w) => { if (w === t || (i === 0 && t === 3 && it.t[1] === 3 && w === 2)) return; const k = t + '→' + w; rejN[k] = (rejN[k] || 0) + 1; if (!P.judge(r.syl[i], w, ctx(i)).ok) rej[k] = (rej[k] || 0) + 1; }); });
  });
  console.log(label + ': right tones accepted ' + acc + ' of ' + nAcc + ' (' + Math.round(100 * acc / Math.max(1, nAcc)) + '%)');
  console.log('  wrong tone rejected (said→asked): ' + Object.keys(rejN).sort().map(k => k + ' ' + Math.round(100 * (rej[k] || 0) / rejN[k]) + '%').join(', '));
  if (SHOW) missed.slice(0, 30).forEach(m => console.log('  ' + m));
};
const run = (list, label) => {
  let ok = 0, n = 0, conf = {}; const bad = [];
  list.slice(0, MAX).forEach((it) => {
    const f = AL.file(it.zh); if (!f || !fs.existsSync(path.join(root, f))) return;
    const r = P.analyse(pcm(f), 16000, it.t.length); n++;
    const got = r.syl.map(s => s.tone);
    const good = it.t.every((t, i) => t === 5 || got[i] === t || (i === 0 && t === 3 && it.t[1] === 3 && got[i] === 2));
    if (good) ok++; else bad.push(it.zh + ' ' + it.py + ' want ' + it.t.join('') + ' got ' + got.join('') + ' (' + r.syl.map(s => s.shape + ' s' + (s.s || 0).toFixed(1) + ' e' + (s.e || 0).toFixed(1) + ' m' + (s.mean || 0).toFixed(1)).join(' | ') + ')');
    it.t.forEach((t, i) => { const k = t + '>' + (got[i] || 0); conf[k] = (conf[k] || 0) + 1; });
  });
  console.log(label + ': ' + ok + ' of ' + n + ' read right (' + Math.round(100 * ok / Math.max(1, n)) + '%)');
  console.log('  want>got: ' + Object.keys(conf).sort().map(k => k + ' ' + conf[k]).join(', '));
  if (SHOW) bad.slice(0, 40).forEach(b => console.log('  ' + b));
  return { ok, n };
};
if (process.argv.includes('--blind')) { run(singles, 'one syllable'); run(pairs, 'two syllables'); }
runJudge(singles, 'one syllable'); runJudge(pairs, 'two syllables');
